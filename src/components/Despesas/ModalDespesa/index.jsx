import React, { useRef, useState } from 'react';

import { useToast } from 'hooks/useToast';
import { useConfirm, AppIcon as Icon, PrettySelect, Button, Toast, ModalHeader, ModalOverlay, Field } from 'components';
import { useAuth } from 'context/AuthContext';
import { garantirFornecedorCadastrado, adicionarDiasUteis, gerarParcelasAutomaticas, somaParcelas, buscarDespesasComMesmaNf, detectarPossiveisDuplicatas, EMPRESAS_LOGIFLOW } from 'services/parcelasGenerator';
import { fetchFornecedores, createFornecedor } from 'services/fornecedoresService';

import { FMT, BRL } from '../utils/helpers';
import { inputCls, inputStyle } from '../utils/constants';
import ModalFornecedores from '../ModalFornecedores';

// ─── Modal de Formulário de Despesa ──────────────────────────────────────────
// `config` descreve a tela de origem (serviço, textos, se tem veículo) — ver pages/despesas-*/config.js
export default function ModalDespesa({ modal, config, veiculos = [], despesasExistentes = [], categorias, onCategoriasChange, onClose, onSaved }) {
    const { servico, comVeiculo, tabela, textos } = config;
    const campoVeiculo = config.campoVeiculo || 'vehicle_id'; // coluna do veículo na tabela da tela
    const { toast, showToast } = useToast();
    const { confirm, ConfirmDialog } = useConfirm();
    const { profile } = useAuth();
    const xmlRef = useRef(null);
    const comprovanteRef = useRef(null);
    const permutaRef = useRef(null);
    const barcodeInputRef = useRef(null);
    const corpoModalRef = useRef(null);
    const [barcodeMode, setBarcodeMode] = useState(false);
    const [barcodeBuffer, setBarcodeBuffer] = useState('');
    const [loadingNFe, setLoadingNFe] = useState(false);
    const [saving, setSaving] = useState(false);
    const [showFornecedores, setShowFornecedores] = useState(false);
    const [, setSavingCategoria] = useState(false);
    const [novaCategoria, setNovaCategoria] = useState('');
    const [showNovaCategoria, setShowNovaCategoria] = useState(false);
    const [novoBoleto, setNovoBoleto] = useState({ numero_boleto: '', vencimento: '', valor: '' });
    const [novoCheque, setNovoCheque] = useState({ numero: '', banco: '', valor: '', vencimento: '' });
    const [novaParcela, setNovaParcela] = useState({ vencimento: '', valor: '', cartao: '' });
    const [gerador, setGerador] = useState({ quantidade: 2, prazoDiasUteis: 30, intervaloDias: 30, numeroBoletoInicial: '' });
    const [duplicatas, setDuplicatas] = useState([]); // achados de detectarPossiveisDuplicatas, exibidos antes de salvar

    const todasCategorias = categorias;

    const emptyForm = () => ({
        [campoVeiculo]: '', empresa: '', categoria: config.categoriaPadrao ?? categorias[0] ?? '', descricao: '', valor: '',
        data_despesa: new Date().toISOString().split('T')[0], nota_fiscal: '',
        fornecedor: '', observacoes: '',
        notas_fiscais: [], nf_itens: [],
        forma_pagamento: 'a_vista', tipo_pagamento: 'pix',
        comprovante_url: '', boletos: [], parcelas_cartao: [],
        permuta_obs: '', permuta_doc_url: '', cheques: [],
    });

    const isEdit = modal?.mode === 'edit';
    const [form, setForm] = useState(() => {
        if (isEdit && modal?.data) {
            const d = modal.data;
            return {
                [campoVeiculo]: d[campoVeiculo] || '', empresa: d.empresa || '',
                categoria: d.categoria, descricao: d.descricao || '',
                valor: String(d.valor || ''), data_despesa: d.data_despesa,
                nota_fiscal: d.nota_fiscal || '', fornecedor: d.fornecedor || '',
                observacoes: d.observacoes || '', notas_fiscais: d.notas_fiscais || [],
                nf_itens: d.nf_itens || [], forma_pagamento: d.forma_pagamento || 'a_vista',
                tipo_pagamento: d.tipo_pagamento || 'pix', comprovante_url: d.comprovante_url || '',
                boletos: d.boletos || [], parcelas_cartao: d.parcelas_cartao || [],
                permuta_obs: d.permuta_obs || '', permuta_doc_url: d.permuta_doc_url || '',
                cheques: d.cheques || [],
            };
        }
        return emptyForm();
    });

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const adicionarCategoria = async () => {
        const cat = novaCategoria.trim();
        if (!cat || todasCategorias.includes(cat)) { showToast(cat ? 'Categoria já existe' : 'Digite o nome', 'error'); return; }
        setSavingCategoria(true);
        try {
            await servico.createCategoria(cat, profile?.id || null);
            await onCategoriasChange();
            set('categoria', cat);
            setNovaCategoria(''); setShowNovaCategoria(false);
            showToast(`Categoria "${cat}" criada!`, 'success');
        } catch (e) {
            const msg = /duplicate key|unique constraint/i.test(e.message) ? 'Categoria já existe' : 'Erro: ' + e.message;
            showToast(msg, 'error');
        } finally { setSavingCategoria(false); }
    };

    // Renomeia qualquer categoria (padrão ou criada pelo usuário) e atualiza em
    // cascata as despesas já lançadas com o nome antigo.
    const editarCategoria = async (catAntiga, catNovaBruta) => {
        const catNova = catNovaBruta.trim();
        if (!catNova) { showToast('Digite o nome da categoria', 'error'); return; }
        if (catNova === catAntiga) return;
        if (todasCategorias.includes(catNova)) { showToast('Já existe uma categoria com esse nome', 'error'); return; }
        try {
            const afetadas = despesasExistentes.filter(d => d.categoria === catAntiga);
            await Promise.all(afetadas.map(d => servico.updateDespesa(d.id, { categoria: catNova })));
            await servico.renameCategoria(catAntiga, catNova);
            await onCategoriasChange();
            if (form.categoria === catAntiga) set('categoria', catNova);
            showToast(`Categoria renomeada para "${catNova}"${afetadas.length ? ` (${afetadas.length} despesa(s) atualizada(s))` : ''}!`, 'success');
        } catch (e) { showToast('Erro ao renomear categoria: ' + e.message, 'error'); }
    };

    // Exclui uma categoria da lista de opções (não apaga despesas já lançadas
    // com esse texto — elas mantêm o valor salvo).
    const excluirCategoria = async (cat) => {
        if (todasCategorias.length <= 1) { showToast('É preciso manter ao menos uma categoria', 'error'); return; }
        const emUso = despesasExistentes.filter(d => d.categoria === cat).length;
        const ok = await confirm({
            title: 'Excluir categoria?',
            message: emUso > 0
                ? `"${cat}" está sendo usada em ${emUso} despesa(s). Elas continuarão com esse texto, mas a categoria deixará de aparecer na lista de opções. Deseja continuar?`
                : `Excluir a categoria "${cat}"?`,
            confirmLabel: 'Excluir', variant: 'danger',
        });
        if (!ok) return;
        try {
            await servico.deleteCategoria(cat);
            const novas = todasCategorias.filter(c => c !== cat);
            await onCategoriasChange();
            if (form.categoria === cat) set('categoria', novas[0] || '');
            showToast('Categoria excluída!', 'success');
        } catch (e) { showToast('Erro ao excluir categoria: ' + e.message, 'error'); }
    };
    const [editandoCategoria, setEditandoCategoria] = useState(null);
    const [textoEdicaoCategoria, setTextoEdicaoCategoria] = useState('');

    // ── XML NF-e ──────────────────────────────────────────────────────────────
    const handleXmlNF = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const parser = new DOMParser();
                const xml = parser.parseFromString(ev.target.result, 'application/xml');
                const nNF        = xml.querySelector('nNF')?.textContent || '';
                const dhEmi      = xml.querySelector('dhEmi')?.textContent?.slice(0, 10) || '';
                const vnf        = xml.querySelector('vNF')?.textContent || '';
                const emitNome   = xml.querySelector('emit xNome')?.textContent || '';
                const emitCNPJ   = xml.querySelector('emit CNPJ')?.textContent || '';
                const fornecedor = emitNome || (emitCNPJ ? `CNPJ ${emitCNPJ}` : '');
                const itens = [];
                xml.querySelectorAll('det prod').forEach(p => {
                    itens.push({
                        codigo: p.querySelector('cProd')?.textContent || '',
                        descricao: p.querySelector('xProd')?.textContent || '',
                        quantidade: p.querySelector('qCom')?.textContent || '',
                        unidade: p.querySelector('uCom')?.textContent || '',
                        valor_unit: p.querySelector('vUnCom')?.textContent || '',
                        valor_total: p.querySelector('vProd')?.textContent || '',
                    });
                });
                const novaNF = { numero: nNF, fornecedor, valor: vnf, data: dhEmi, descricao: '', nf_itens: itens, _origem: 'xml' };
                setForm(f => {
                    // se a NF já tinha sido lida pelo código de barras (sem itens), o XML completa a mesma nota
                    const anteriores = (f.notas_fiscais || []).filter(n => !(n._origem === 'chave' && String(n.numero) === String(nNF) && !(n.nf_itens || []).length));
                    const novasNFs = [...anteriores, novaNF];
                    const soma = novasNFs.reduce((s, n) => s + Number(n.valor || 0), 0);
                    return {
                        ...f, nota_fiscal: f.nota_fiscal || nNF,
                        valor: soma > 0 ? String(soma) : f.valor,
                        data_despesa: f.data_despesa || dhEmi,
                        fornecedor: f.fornecedor || fornecedor,
                        descricao: (fornecedor && !f.descricao) ? `Compra — ${fornecedor}` : f.descricao,
                        nf_itens: [...(f.nf_itens || []), ...itens],
                        notas_fiscais: novasNFs,
                    };
                });
                showToast(`NF ${nNF} importada: ${fornecedor || 'emissor não identificado'} · ${itens.length} item(s)`, 'success');
                if (fornecedor) {
                    garantirFornecedorCadastrado(fetchFornecedores, createFornecedor, { nome: fornecedor, cnpj: emitCNPJ })
                        .then(r => { if (r === 'cadastrado') showToast(`Fornecedor "${fornecedor}" cadastrado automaticamente.`, 'info'); });
                }
            } catch { showToast('Erro ao ler XML. Verifique o arquivo.', 'error'); }
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    // ── Código de barras ──────────────────────────────────────────────────────
    const buscarDadosNFe = async (chave) => {
        setLoadingNFe(true);
        try {
            const nNF = chave.substring(25, 34).replace(/^0+/, '') || chave.substring(25, 34);
            const cnpjEmit = chave.substring(6, 20);
            const serie = chave.substring(22, 25).replace(/^0+/, '') || '1';
            const aamm = chave.substring(2, 6);
            const dataEmissao = `20${aamm.substring(0, 2)}-${aamm.substring(2, 4)}-01`;
            let fornecedor = '';
            try {
                const resp = await fetch(`https://receitaws.com.br/v1/cnpj/${cnpjEmit}`, { headers: { 'Accept': 'application/json' } });
                if (resp.ok) { const json = await resp.json(); if (json?.nome) fornecedor = json.nome; }
            } catch { /* silencioso */ }
            const cnpjFmt = cnpjEmit.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
            setForm(f => ({
                ...f, nota_fiscal: nNF, data_despesa: dataEmissao,
                notas_fiscais: (f.notas_fiscais || []).some(n => String(n.numero) === String(nNF))
                    ? f.notas_fiscais
                    : [...(f.notas_fiscais || []), { numero: nNF, fornecedor: fornecedor || '', valor: '', data: '', descricao: `Série ${serie}`, nf_itens: [], _origem: 'chave' }],
                fornecedor: fornecedor || f.fornecedor || `CNPJ ${cnpjFmt}`,
                descricao: f.descricao || `NF ${nNF} · Série ${serie}`,
            }));
            showToast(fornecedor ? `✅ NF ${nNF} — ${fornecedor}` : `NF ${nNF} lida. Consulte o XML para dados completos.`, fornecedor ? 'success' : 'info');
            if (fornecedor) {
                garantirFornecedorCadastrado(fetchFornecedores, createFornecedor, { nome: fornecedor, cnpj: cnpjEmit })
                    .then(r => { if (r === 'cadastrado') showToast(`Fornecedor "${fornecedor}" cadastrado automaticamente.`, 'info'); });
            }
        } catch {
            const nNF = chave.length === 44 ? chave.substring(25, 34).replace(/^0+/, '') || chave : chave;
            setForm(f => ({ ...f, nota_fiscal: nNF }));
            showToast(`NF ${nNF} lida`, 'info');
        } finally { setLoadingNFe(false); }
    };

    const handleBarcodeKeyDown = async (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const codigo = barcodeBuffer.trim();
            if (!codigo) return;
            setBarcodeBuffer(''); setBarcodeMode(false);
            if (codigo.length === 44 && /^\d{44}$/.test(codigo)) await buscarDadosNFe(codigo);
            else { setForm(f => ({ ...f, nota_fiscal: codigo })); showToast(`Código lido: ${codigo}`, 'success'); }
            setTimeout(() => document.getElementById('despesa-valor')?.focus(), 100);
        }
        if (e.key === 'Escape') { setBarcodeMode(false); setBarcodeBuffer(''); }
    };

    // ── Boletos / cheques / parcelas ──────────────────────────────────────────
    // Edita um campo de um boleto já lançado (manual ou gerado automaticamente) diretamente na lista.
    const setBoletoField = (idx, campo) => (e) => setForm(f => ({ ...f, boletos: f.boletos.map((x, i) => i === idx ? { ...x, [campo]: e.target.value } : x) }));
    const setParcelaCartaoField = (idx, campo) => (e) => setForm(f => ({ ...f, parcelas_cartao: f.parcelas_cartao.map((x, i) => i === idx ? { ...x, [campo]: e.target.value } : x) }));

    const addBoleto = () => {
        if (!novoBoleto.vencimento || !novoBoleto.valor) { showToast('Preencha vencimento e valor', 'error'); return; }
        setForm(f => ({ ...f, boletos: [...(f.boletos || []), { ...novoBoleto, pago: false, entregue_financeiro: false }] }));
        setNovoBoleto({ numero_boleto: '', vencimento: '', valor: '' });
    };
    const addCheque = () => {
        if (!novoCheque.numero || !novoCheque.valor) { showToast('Preencha número e valor', 'error'); return; }
        setForm(f => ({ ...f, cheques: [...(f.cheques || []), { ...novoCheque }] }));
        setNovoCheque({ numero: '', banco: '', valor: '', vencimento: '' });
    };
    const addParcela = () => {
        if (!novaParcela.vencimento || !novaParcela.valor) { showToast('Preencha vencimento e valor', 'error'); return; }
        setForm(f => ({ ...f, parcelas_cartao: [...(f.parcelas_cartao || []), { ...novaParcela, pago: false }] }));
        setNovaParcela({ vencimento: '', valor: '', cartao: '' });
    };

    // ── Geração automática de parcelas (boleto ou cartão) ─────────────────────
    const gerarAutomatico = (tipo) => {
        if (!form.valor || Number(form.valor) <= 0) { showToast('Informe o valor total da despesa antes de gerar as parcelas.', 'error'); return; }
        if (!form.data_despesa) { showToast('Informe a data da despesa/nota fiscal antes de gerar as parcelas.', 'error'); return; }
        const primeiroVencimento = adicionarDiasUteis(form.data_despesa, gerador.prazoDiasUteis);
        try {
            const parcelas = gerarParcelasAutomaticas({
                valorTotal: Number(form.valor),
                quantidade: gerador.quantidade,
                primeiroVencimento,
                intervaloDias: Number(gerador.intervaloDias) || 30,
                tipo,
                numeroBoletoInicial: gerador.numeroBoletoInicial || null,
                cartao: novaParcela.cartao,
            });
            if (tipo === 'boleto') setForm(f => ({ ...f, boletos: parcelas }));
            else setForm(f => ({ ...f, parcelas_cartao: parcelas }));
            showToast(`${parcelas.length} parcela(s) geradas a partir de ${FMT(primeiroVencimento)} (NF + ${gerador.prazoDiasUteis} dias úteis) — soma ${BRL(somaParcelas(parcelas))}.`, 'success');
        } catch (e) { showToast(e.message, 'error'); }
    };

    // ── Salvar ────────────────────────────────────────────────────────────────
    const handleSave = async (forcarApesarDeDuplicata = false) => {
        if (saving) return; // já tem um salvamento em andamento — ignora clique repetido
        if (!form.categoria || !form.valor || !form.data_despesa) { showToast('Categoria, valor e data são obrigatórios', 'error'); return; }
        setSaving(true); // trava já aqui — a checagem de duplicata abaixo também é assíncrona

        // Checagem de possíveis duplicatas — só avisa, não bloqueia sozinha.
        if (!forcarApesarDeDuplicata) {
            const veiculoSelecionado = veiculos.find(v => v.id === form[campoVeiculo]);
            const excluirId = isEdit ? modal.data.id : undefined;

            // Checagem GLOBAL de NF: consulta o banco inteiro, não só o que está
            //    carregado na tela (que pode estar filtrado por mês/veículo/categoria).
            let achadosNf = [];
            if (form.nota_fiscal?.trim()) {
                const existentesComMesmaNf = await buscarDespesasComMesmaNf(tabela, form.nota_fiscal, excluirId);
                achadosNf = existentesComMesmaNf.map(d => ({
                    despesa: d,
                    motivo: `Nota fiscal ${form.nota_fiscal} já lançada${d.fornecedor || d.empresa ? ` para ${d.fornecedor || d.empresa}` : ''}${d.categoria ? ` (${d.categoria})` : ''} em ${d.data_despesa ? FMT(d.data_despesa) : '—'}, valor ${BRL(d.valor)}.`,
                    confianca: 'alta',
                }));
            }

            // Checagem local (fornecedor+placa+valor+data, nº de boleto) sobre o que já está na tela.
            const achadosLocais = detectarPossiveisDuplicatas(despesasExistentes, { ...form, placa: veiculoSelecionado?.placa }, { excluirId });

            const achados = [...achadosNf, ...achadosLocais];
            if (achados.length > 0) {
                setDuplicatas(achados);
                showToast(`⚠️ Possível duplicidade encontrada (${achados.length}) — revise antes de salvar.`, 'error');
                corpoModalRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
                setSaving(false);
                return;
            }
        }

        try {
            const payload = {
                ...form,
                [campoVeiculo]: form[campoVeiculo] || null,
                valor: Number(form.valor),
                notas_fiscais: form.notas_fiscais || [],
                // lista geral de itens = itens de todas as NFs (mantém compatibilidade com despesas antigas)
                nf_itens: (form.notas_fiscais || []).length > 0 ? (form.notas_fiscais || []).flatMap(n => n.nf_itens || []) : (form.nf_itens || []),
                boletos: form.boletos || [],
                parcelas_cartao: form.parcelas_cartao || [],
                cheques: form.cheques || [],
            };
            if (!payload[campoVeiculo]) delete payload[campoVeiculo];
            if (isEdit) await servico.updateDespesa(modal.data.id, payload);
            else await servico.createDespesa(payload);
            showToast('Despesa salva!', 'success');
            onSaved();
            onClose();
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
        finally { setSaving(false); }
    };

    return (
        <>
            <ModalOverlay onClose={onClose} wide>
                <ModalHeader title={isEdit ? 'Editar Despesa' : textos.tituloNovaDespesa} icon={config.icone} onClose={onClose} />
                <div ref={corpoModalRef} className="p-5 space-y-4 overflow-y-auto flex-1">

                    {/* ── Alerta de possível duplicidade ────────────────────── */}
                    {duplicatas.length > 0 && (
                        <div className="p-3 rounded-xl border border-red-300 bg-red-50 space-y-2">
                            <p className="text-sm font-semibold text-red-700 flex items-center gap-1.5">
                                <Icon name="AlertTriangle" size={15} /> Possível lançamento duplicado
                            </p>
                            {duplicatas.map((d, i) => (
                                <p key={i} className="text-xs text-red-600 pl-1">
                                    • {d.motivo} <span className="text-red-400">({d.confianca === 'alta' ? 'alta chance' : 'checar antes de salvar'})</span>
                                </p>
                            ))}
                            <div className="flex gap-2 pt-1">
                                <button type="button" onClick={() => setDuplicatas([])} className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-red-300 text-red-700 hover:bg-red-100">
                                    Revisar lançamento
                                </button>
                                <button type="button" onClick={() => { setDuplicatas([]); handleSave(true); }} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-600 text-white hover:bg-red-700">
                                    Salvar mesmo assim
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ── NF Section ─────────────────────────────────────── */}
                    <div className="p-3 rounded-xl border" style={{ borderColor: '#BFDBFE', backgroundColor: '#EFF6FF' }}>
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-semibold text-blue-700">
                                📄 Notas Fiscais
                                {(form.notas_fiscais || []).length > 0 && <span className="ml-2 px-1.5 py-0.5 rounded-full bg-blue-600 text-white text-xs">{(form.notas_fiscais || []).length}</span>}
                            </p>
                            <button type="button" onClick={() => setForm(f => ({ ...f, notas_fiscais: [...(f.notas_fiscais || []), { numero: '', fornecedor: '', data: '', descricao: '', valor: '', nf_itens: [], _manual: true }] }))}
                                className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium border border-blue-300 text-blue-700 hover:bg-blue-100">
                                <Icon name="Plus" size={11} /> Adicionar NF manual
                            </button>
                        </div>
                        <div className="flex flex-wrap gap-2 mb-2">
                            <button type="button" onClick={() => xmlRef.current?.click()}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-700">
                                <Icon name="FileCode" size={12} /> {(form.notas_fiscais || []).length > 0 ? 'Importar outro XML' : 'Importar XML da NF'}
                            </button>
                            <input ref={xmlRef} type="file" accept=".xml" onChange={handleXmlNF} className="hidden" />
                            <button type="button"
                                onClick={() => { setBarcodeMode(b => !b); setBarcodeBuffer(''); setTimeout(() => barcodeInputRef.current?.focus(), 50); }}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors"
                                style={barcodeMode ? { backgroundColor: '#1D4ED8', color: '#fff', borderColor: '#1D4ED8' } : { borderColor: '#93C5FD', color: '#1D4ED8', backgroundColor: 'white' }}>
                                <Icon name="ScanLine" size={12} /> {barcodeMode ? 'Aguardando leitura...' : 'Ler código de barras'}
                            </button>
                        </div>
                        {barcodeMode && (
                            <div className="mt-2">
                                <p className="text-xs text-blue-600 mb-1.5">🔫 Aponte o leitor para o código de barras da NF impressa.</p>
                                <input ref={barcodeInputRef} type="text" value={barcodeBuffer}
                                    onChange={e => setBarcodeBuffer(e.target.value)} onKeyDown={handleBarcodeKeyDown}
                                    className={inputCls} style={{ ...inputStyle, borderColor: '#3B82F6', boxShadow: '0 0 0 3px rgba(59,130,246,0.15)' }}
                                    placeholder="Aguardando leitura do scanner..." autoFocus autoComplete="off" disabled={loadingNFe} />
                                {loadingNFe && <div className="flex items-center gap-2 mt-2 text-xs text-blue-600"><div className="animate-spin h-3 w-3 rounded-full border-2 border-blue-600" style={{ borderTopColor: 'transparent' }} />Consultando SEFAZ...</div>}
                                <button type="button" onClick={() => { setBarcodeMode(false); setBarcodeBuffer(''); }} className="text-xs text-blue-600 underline mt-1">Cancelar (Esc)</button>
                            </div>
                        )}
                        {(form.notas_fiscais || []).length > 0 && (
                            <div className="mt-3 space-y-2">
                                {(form.notas_fiscais || []).map((nf, nfIdx) => (
                                    <div key={nfIdx} className="rounded-xl border border-blue-200 bg-white overflow-hidden">
                                        <div className="flex items-center justify-between px-3 py-1.5 bg-blue-50 border-b border-blue-100">
                                            <span className="text-xs font-semibold text-blue-800">NF {nfIdx + 1} {nf._manual ? '— manual' : nf._origem === 'chave' ? '— código de barras' : '— XML'}</span>
                                            <button type="button" onClick={() => setForm(f => { const novas = f.notas_fiscais.filter((_, i) => i !== nfIdx); const soma = novas.reduce((s, n) => s + Number(n.valor || 0), 0); return { ...f, notas_fiscais: novas, valor: soma > 0 ? String(soma) : f.valor }; })} className="p-1 rounded hover:bg-red-100"><Icon name="X" size={12} color="#DC2626" /></button>
                                        </div>
                                        <div className="p-3 grid grid-cols-2 gap-2">
                                            {[
                                                { label: 'Nº da NF', field: 'numero', placeholder: 'Ex: 35520' },
                                                { label: 'Valor (R$)', field: 'valor', placeholder: '0,00', type: 'number' },
                                                { label: 'Fornecedor', field: 'fornecedor', placeholder: 'Nome do fornecedor' },
                                                { label: 'Data de emissão', field: 'data', placeholder: '', type: 'date' },
                                            ].map(({ label, field, placeholder, type }) => (
                                                <div key={field}>
                                                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>{label} {!nf._manual && nf[field] && <span className="text-emerald-600 font-normal text-xs">auto</span>}</label>
                                                    <input type={type || 'text'} value={nf[field] || ''} placeholder={placeholder}
                                                        onChange={e => setForm(f => {
                                                            const a = [...f.notas_fiscais];
                                                            a[nfIdx] = { ...a[nfIdx], [field]: e.target.value };
                                                            const soma = a.reduce((s, n) => s + Number(n.valor || 0), 0);
                                                            return { ...f, notas_fiscais: a, ...(field === 'valor' && soma > 0 ? { valor: String(soma) } : {}) };
                                                        })}
                                                        className={inputCls} style={inputStyle} />
                                                </div>
                                            ))}
                                            <div className="col-span-2">
                                                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Descrição</label>
                                                <input value={nf.descricao || ''} placeholder={textos.placeholderDescricaoNf}
                                                    onChange={e => setForm(f => { const a = [...f.notas_fiscais]; a[nfIdx] = { ...a[nfIdx], descricao: e.target.value }; return { ...f, notas_fiscais: a }; })}
                                                    className={inputCls} style={inputStyle} />
                                            </div>
                                        </div>
                                        {(nf._manual || nf._origem === 'chave') && (
                                            <div className="px-3 pb-3">
                                                <div className="flex items-center justify-between mb-1">
                                                    <p className="text-xs text-blue-700 font-medium">Itens da nota ({(nf.nf_itens || []).length})</p>
                                                    <button type="button" onClick={() => setForm(f => { const a = [...f.notas_fiscais]; a[nfIdx] = { ...a[nfIdx], nf_itens: [...(a[nfIdx].nf_itens || []), { codigo: '', descricao: '', quantidade: '', unidade: 'UN', valor_unit: '', valor_total: '' }] }; return { ...f, notas_fiscais: a }; })}
                                                        className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium border border-blue-300 text-blue-700 hover:bg-blue-100"><Icon name="Plus" size={11} /> Adicionar item</button>
                                                </div>
                                                {(nf.nf_itens || []).map((it, itIdx) => {
                                                    const setIt = (campo, valor) => setForm(f => {
                                                        const a = [...f.notas_fiscais];
                                                        const itens = [...(a[nfIdx].nf_itens || [])];
                                                        const novo = { ...itens[itIdx], [campo]: valor };
                                                        if (campo === 'quantidade' || campo === 'valor_unit') {
                                                            const t = Number(String(novo.quantidade).replace(',', '.')) * Number(String(novo.valor_unit).replace(',', '.'));
                                                            novo.valor_total = Number.isFinite(t) && t > 0 ? String(Math.round(t * 100) / 100) : '';
                                                        }
                                                        itens[itIdx] = novo; a[nfIdx] = { ...a[nfIdx], nf_itens: itens };
                                                        return { ...f, notas_fiscais: a };
                                                    });
                                                    return (
                                                        <div key={itIdx} className="grid grid-cols-12 gap-1.5 mb-1.5 items-center">
                                                            <input value={it.descricao || ''} onChange={e => setIt('descricao', e.target.value)} placeholder="Descrição do item / serviço" className={inputCls + ' col-span-12 sm:col-span-5'} style={inputStyle} />
                                                            <input value={it.quantidade ?? ''} onChange={e => setIt('quantidade', e.target.value)} placeholder="Qtd" inputMode="decimal" className={inputCls + ' col-span-3 sm:col-span-2'} style={inputStyle} />
                                                            <input value={it.unidade || ''} onChange={e => setIt('unidade', e.target.value)} placeholder="Un" className={inputCls + ' col-span-3 sm:col-span-1'} style={inputStyle} />
                                                            <input value={it.valor_unit ?? ''} onChange={e => setIt('valor_unit', e.target.value)} placeholder="V. unit." inputMode="decimal" className={inputCls + ' col-span-4 sm:col-span-2'} style={inputStyle} />
                                                            <span className="col-span-1 sm:col-span-1 text-xs font-data text-right text-blue-700 truncate">{it.valor_total ? BRL(it.valor_total) : '—'}</span>
                                                            <button type="button" onClick={() => setForm(f => { const a = [...f.notas_fiscais]; a[nfIdx] = { ...a[nfIdx], nf_itens: (a[nfIdx].nf_itens || []).filter((_, k) => k !== itIdx) }; return { ...f, notas_fiscais: a }; })} className="col-span-1 p-1 rounded hover:bg-red-100 justify-self-center"><Icon name="X" size={12} color="#DC2626" /></button>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                        {!nf._manual && nf._origem !== 'chave' && nf.nf_itens?.length > 0 && (
                                            <div className="px-3 pb-3 overflow-x-auto">
                                                <p className="text-xs text-blue-600 font-medium mb-1">{nf.nf_itens.length} item(s) do XML:</p>
                                                <table className="w-full text-xs">
                                                    <thead><tr className="text-blue-700">{['Cód', 'Descrição', 'Qtd', 'Un', 'V.Total'].map(h => <th key={h} className="text-left px-1 py-0.5 border-b border-blue-100 font-medium">{h}</th>)}</tr></thead>
                                                    <tbody>{nf.nf_itens.map((it, i) => (
                                                        <tr key={i} className="border-b border-blue-50">
                                                            <td className="px-1 py-1 font-data">{it.codigo}</td>
                                                            <td className="px-1 py-1 max-w-[130px] truncate">{it.descricao}</td>
                                                            <td className="px-1 py-1 font-data text-right">{it.quantidade}</td>
                                                            <td className="px-1 py-1">{it.unidade}</td>
                                                            <td className="px-1 py-1 font-data text-right text-blue-700">{BRL(it.valor_total)}</td>
                                                        </tr>
                                                    ))}</tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {(form.notas_fiscais || []).filter(n => n.valor).length > 1 && (
                                    <div className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE' }}>
                                        <span className="text-xs font-semibold text-blue-700">Total ({(form.notas_fiscais || []).length} NFs)</span>
                                        <span className="text-sm font-bold font-data text-blue-800">{BRL((form.notas_fiscais || []).reduce((s, n) => s + Number(n.valor || 0), 0))}</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* ── Dados básicos ─────────────────────────────────────── */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="Categoria" required>
                            <div className="space-y-2">
                                <div className="flex gap-2">
                                    <PrettySelect value={form.categoria} onChange={e => set('categoria', e.target.value)} className={inputCls} style={inputStyle}>
                                        {todasCategorias.map(c => <option key={c} value={c}>{c}</option>)}
                                    </PrettySelect>
                                    <button type="button" onClick={() => setShowNovaCategoria(s => !s)}
                                        className="shrink-0 px-2.5 py-2 rounded-lg border text-xs font-medium hover:bg-blue-50"
                                        style={{ borderColor: '#93C5FD', color: '#1D4ED8' }}>
                                        <Icon name={showNovaCategoria ? 'X' : 'Plus'} size={14} />
                                    </button>
                                </div>
                                {showNovaCategoria && (
                                    <div className="flex gap-2 p-2 rounded-lg" style={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE' }}>
                                        <input value={novaCategoria} onChange={e => setNovaCategoria(e.target.value)} onKeyDown={e => e.key === 'Enter' && adicionarCategoria()}
                                            className={inputCls + ' flex-1'} style={inputStyle} placeholder="Nome da nova categoria..." autoFocus />
                                        <button type="button" onClick={adicionarCategoria} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 text-white">Criar</button>
                                    </div>
                                )}
                                {showNovaCategoria && todasCategorias.length > 0 && (
                                    <div className="space-y-1 p-2 rounded-lg" style={{ backgroundColor: '#F9FAFB', border: '1px solid var(--color-border)' }}>
                                        <p className="text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--color-muted-foreground)' }}>Categorias (clique no lápis pra editar)</p>
                                        {todasCategorias.map(cat => (
                                            <div key={cat} className="flex items-center gap-2">
                                                {editandoCategoria === cat ? (
                                                    <>
                                                        <input value={textoEdicaoCategoria} onChange={e => setTextoEdicaoCategoria(e.target.value)}
                                                            onKeyDown={e => { if (e.key === 'Enter') { editarCategoria(cat, textoEdicaoCategoria); setEditandoCategoria(null); } if (e.key === 'Escape') setEditandoCategoria(null); }}
                                                            className={inputCls + ' flex-1'} style={{ ...inputStyle, padding: '4px 8px' }} autoFocus />
                                                        <button type="button" onClick={() => { editarCategoria(cat, textoEdicaoCategoria); setEditandoCategoria(null); }}
                                                            className="shrink-0 p-1.5 rounded-md text-green-600 hover:bg-green-50" title="Salvar"><Icon name="Check" size={14} /></button>
                                                        <button type="button" onClick={() => setEditandoCategoria(null)}
                                                            className="shrink-0 p-1.5 rounded-md text-gray-500 hover:bg-gray-100" title="Cancelar"><Icon name="X" size={14} /></button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <span className="flex-1 text-xs truncate" style={{ color: 'var(--color-text-primary)' }}>{cat}</span>
                                                        <button type="button" onClick={() => { setEditandoCategoria(cat); setTextoEdicaoCategoria(cat); }}
                                                            className="shrink-0 p-1.5 rounded-md hover:bg-blue-50" style={{ color: '#1D4ED8' }} title="Renomear"><Icon name="Pencil" size={16} /></button>
                                                        <button type="button" onClick={() => excluirCategoria(cat)}
                                                            className="shrink-0 p-1.5 rounded-md text-red-600 hover:bg-red-50" title="Excluir"><Icon name="Trash2" size={16} /></button>
                                                    </>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </Field>
                        {comVeiculo && (
                            <Field label="Veículo (Placa)">
                                <PrettySelect value={form[campoVeiculo]} onChange={e => set(campoVeiculo, e.target.value)} className={inputCls} style={inputStyle}>
                                    <option value="">Sem veículo específico</option>
                                    {veiculos.map(v => <option key={v.id} value={v.id}>{v.placa} — {v[config.campoDescricaoVeiculo || 'tipo'] || ''}</option>)}
                                </PrettySelect>
                            </Field>
                        )}
                        <Field label="Data" required>
                            <input type="date" value={form.data_despesa} onChange={e => set('data_despesa', e.target.value)} className={inputCls} style={inputStyle} />
                        </Field>
                        <Field label="Valor (R$)" required>
                            <input id="despesa-valor" type="number" step="0.01" min="0" value={form.valor} onChange={e => set('valor', e.target.value)} className={inputCls} style={inputStyle} placeholder="0,00" />
                        </Field>
                        <Field label="Empresa">
                            <PrettySelect value={form.empresa || ''} onChange={e => set('empresa', e.target.value)} className={inputCls} style={inputStyle}>
                                <option value="">Selecione a empresa...</option>
                                {EMPRESAS_LOGIFLOW.map(nome => <option key={nome} value={nome}>{nome}</option>)}
                            </PrettySelect>
                        </Field>
                        <Field label="Nº Nota Fiscal">
                            <input value={form.nota_fiscal} onChange={e => set('nota_fiscal', e.target.value)} className={inputCls} style={inputStyle} placeholder="Ex: 12345" />
                        </Field>
                        <Field label="Fornecedor" className="sm:col-span-2">
                            <div className="flex gap-2">
                                <input value={form.fornecedor || ''} onChange={e => set('fornecedor', e.target.value)} className={inputCls + ' flex-1'} style={inputStyle} placeholder={textos.placeholderFornecedor} />
                                <button type="button" onClick={() => setShowFornecedores(true)}
                                    className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium hover:bg-gray-50 transition-colors" style={{ borderColor: 'var(--color-border)' }}>
                                    <Icon name="Building2" size={13} /> Fornecedores
                                </button>
                            </div>
                        </Field>
                        <Field label="Descrição" className="sm:col-span-2">
                            <input value={form.descricao} onChange={e => set('descricao', e.target.value)} className={inputCls} style={inputStyle} placeholder={textos.placeholderDescricao} />
                        </Field>
                    </div>

                    {/* ── Pagamento ─────────────────────────────────────────── */}
                    <div className="space-y-3">
                        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-secondary)' }}>Forma de Pagamento</p>
                        <div className="flex gap-2">
                            {[['a_vista', '💳 À Vista'], ['a_prazo', '📋 A Prazo']].map(([v, l]) => (
                                <button key={v} type="button" onClick={() => setForm(f => ({ ...f, forma_pagamento: v, tipo_pagamento: v === 'a_vista' ? 'pix' : 'boleto' }))}
                                    className="flex-1 py-2 rounded-lg text-sm font-medium border transition-colors"
                                    style={form.forma_pagamento === v ? { backgroundColor: 'var(--color-primary)', color: '#fff', borderColor: 'var(--color-primary)' } : { borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}>
                                    {l}
                                </button>
                            ))}
                        </div>

                        {form.forma_pagamento === 'a_vista' && (
                            <div className="space-y-3 p-3 rounded-xl border" style={{ borderColor: '#BBF7D0', backgroundColor: '#F0FDF4' }}>
                                <p className="text-xs font-semibold text-green-700">Tipo de pagamento</p>
                                <div className="flex gap-2 flex-wrap">
                                    {[['pix', 'PIX'], ['dinheiro', 'Dinheiro'], ['transferencia_m', 'Transferência'], ['cartao', '💳 Cartão à vista']].map(([v, l]) => (
                                        <button key={v} type="button" onClick={() => set('tipo_pagamento', v)}
                                            className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors"
                                            style={form.tipo_pagamento === v ? { backgroundColor: '#059669', color: '#fff', borderColor: '#059669' } : { borderColor: '#BBF7D0', color: '#065F46', backgroundColor: 'white' }}>
                                            {l}
                                        </button>
                                    ))}
                                </div>
                                <div>
                                    <p className="text-xs font-medium mb-2 text-green-700">Comprovante (opcional)</p>
                                    <div className="flex items-center gap-2">
                                        <button type="button" onClick={() => comprovanteRef.current?.click()} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium hover:bg-green-50" style={{ borderColor: '#BBF7D0' }}>
                                            <Icon name="Paperclip" size={13} /> Anexar comprovante
                                        </button>
                                        {form.comprovante_url && <span className="text-xs text-green-700 flex items-center gap-1"><Icon name="CheckCircle2" size={12} /> Anexado</span>}
                                        <input ref={comprovanteRef} type="file" accept="image/*,.pdf" onChange={e => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = ev => set('comprovante_url', ev.target.result); r.readAsDataURL(f); }} className="hidden" />
                                    </div>
                                </div>
                            </div>
                        )}

                        {form.forma_pagamento === 'a_prazo' && (
                            <div className="space-y-3 p-3 rounded-xl border" style={{ borderColor: '#FED7AA', backgroundColor: '#FFF7ED' }}>
                                <p className="text-xs font-semibold text-amber-700">Tipo de pagamento a prazo</p>
                                <div className="flex gap-2 flex-wrap">
                                    {[['boleto', 'Boleto'], ['cartao_prazo', '💳 Cartão Parcelado'], ['cheque', 'Cheque'], ['permuta', 'Permuta']].map(([v, l]) => (
                                        <button key={v} type="button" onClick={() => set('tipo_pagamento', v)}
                                            className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors"
                                            style={form.tipo_pagamento === v ? { backgroundColor: '#D97706', color: '#fff', borderColor: '#D97706' } : { borderColor: '#FED7AA', color: '#92400E', backgroundColor: 'white' }}>
                                            {l}
                                        </button>
                                    ))}
                                </div>

                                {/* Boleto */}
                                {form.tipo_pagamento === 'boleto' && (
                                    <div className="space-y-2">
                                        <p className="text-xs font-medium text-amber-800">Boletos / Parcelas</p>
                                        {(form.boletos || []).map((b, idx) => (
                                            <div key={idx} className="p-2 rounded-lg bg-white border" style={{ borderColor: '#FED7AA' }}>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <input value={b.numero_boleto || ''} onChange={setBoletoField(idx, 'numero_boleto')} placeholder={`Boleto ${idx + 1}`}
                                                        className="text-xs font-medium text-amber-700 border rounded px-1.5 py-1 w-24 shrink-0" style={{ borderColor: '#FED7AA' }} title="Nº do boleto" />
                                                    <input type="date" value={b.vencimento || ''} onChange={setBoletoField(idx, 'vencimento')}
                                                        className="text-xs font-data border rounded px-1.5 py-1 shrink-0" style={{ borderColor: '#FED7AA' }} />
                                                    <input type="number" step="0.01" value={b.valor} onChange={setBoletoField(idx, 'valor')}
                                                        className="text-xs font-data font-semibold text-amber-800 border rounded px-1.5 py-1 w-24 shrink-0" style={{ borderColor: '#FED7AA' }} />
                                                    <span className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${b.pago ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{b.pago ? 'Pago' : 'Pendente'}</span>
                                                    <button type="button" onClick={() => setForm(f => ({ ...f, boletos: f.boletos.filter((_, i) => i !== idx) }))} className="ml-auto p-1 rounded hover:bg-red-50 shrink-0"><Icon name="X" size={11} color="#DC2626" /></button>
                                                </div>
                                                <label className="flex items-center gap-1 text-xs cursor-pointer mt-1.5" title="Marcar se o boleto já foi entregue ao setor financeiro">
                                                    <input type="checkbox" checked={!!b.entregue_financeiro}
                                                        onChange={() => setForm(f => ({ ...f, boletos: f.boletos.map((x, i) => i === idx ? { ...x, entregue_financeiro: !x.entregue_financeiro, entregue_financeiro_em: !x.entregue_financeiro ? new Date().toISOString() : null } : x) }))} />
                                                    <span className={b.entregue_financeiro ? 'text-blue-600' : 'text-gray-400'}>Entregue ao financeiro</span>
                                                </label>
                                                {b.entregue_financeiro && (
                                                    <div className="flex items-center gap-1.5 mt-1 text-xs">
                                                        <span style={{ color: 'var(--color-muted-foreground)' }}>Data da entrega:</span>
                                                        <input type="date" value={b.entregue_financeiro_em ? b.entregue_financeiro_em.slice(0, 10) : ''}
                                                            onChange={e => { const valor = e.target.value; setForm(f => ({ ...f, boletos: f.boletos.map((x, i) => i === idx ? { ...x, entregue_financeiro_em: valor ? new Date(`${valor}T12:00:00`).toISOString() : null } : x) })); }}
                                                            className="border rounded px-1.5 py-1" style={{ borderColor: '#FED7AA' }} />
                                                    </div>
                                                )}
                                            </div>
                                        ))}

                                        {/* Gerador automático de parcelas */}
                                        <div className="p-2.5 rounded-lg border border-dashed" style={{ borderColor: '#D97706', backgroundColor: '#FFFBEB' }}>
                                            <p className="text-xs font-semibold text-amber-800 mb-1.5 flex items-center gap-1"><Icon name="Wand2" size={12} /> Gerar parcelas automaticamente</p>
                                            <div className="grid grid-cols-4 gap-2">
                                                <Field label="Qtde parcelas"><input type="number" min="1" value={gerador.quantidade} onChange={e => setGerador(g => ({ ...g, quantidade: e.target.value }))} className={inputCls} style={inputStyle} /></Field>
                                                <Field label="Prazo (dias úteis)"><input type="number" min="0" value={gerador.prazoDiasUteis} onChange={e => setGerador(g => ({ ...g, prazoDiasUteis: e.target.value }))} className={inputCls} style={inputStyle} placeholder="Ex: 30" /></Field>
                                                <Field label="Intervalo (dias)"><input type="number" min="1" value={gerador.intervaloDias} onChange={e => setGerador(g => ({ ...g, intervaloDias: e.target.value }))} className={inputCls} style={inputStyle} /></Field>
                                                <Field label="Nº do 1º boleto (opcional)"><input value={gerador.numeroBoletoInicial} onChange={e => setGerador(g => ({ ...g, numeroBoletoInicial: e.target.value }))} className={inputCls} style={inputStyle} placeholder="Ex: 4521" /></Field>
                                            </div>
                                            <p className="text-[11px] text-amber-600 mt-1">
                                                1º vencimento calculado: <strong>{form.data_despesa && gerador.prazoDiasUteis !== '' ? FMT(adicionarDiasUteis(form.data_despesa, gerador.prazoDiasUteis)) : '—'}</strong> (data da despesa/NF + {gerador.prazoDiasUteis || 0} dias úteis).
                                                Valor total ({BRL(form.valor || 0)}) dividido pela quantidade — a diferença de centavos fica na última parcela. Isso substitui os boletos já lançados manualmente e continua editável depois.
                                            </p>
                                            <button type="button" onClick={() => gerarAutomatico('boleto')} className="mt-1.5 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-600 text-white hover:bg-amber-700"><Icon name="Wand2" size={12} /> Gerar boletos automaticamente</button>
                                        </div>

                                        <p className="text-xs font-medium text-amber-700 pt-1">ou adicione manualmente:</p>
                                        <div className="grid grid-cols-3 gap-2">
                                            <Field label="Nº do boleto"><input value={novoBoleto.numero_boleto} onChange={e => setNovoBoleto(b => ({ ...b, numero_boleto: e.target.value }))} className={inputCls} style={inputStyle} placeholder="Ex: 01/03" /></Field>
                                            <Field label="Vencimento"><input type="date" value={novoBoleto.vencimento} onChange={e => setNovoBoleto(b => ({ ...b, vencimento: e.target.value }))} className={inputCls} style={inputStyle} /></Field>
                                            <Field label="Valor (R$)"><input type="number" step="0.01" value={novoBoleto.valor} onChange={e => setNovoBoleto(b => ({ ...b, valor: e.target.value }))} className={inputCls} style={inputStyle} placeholder="0,00" /></Field>
                                        </div>
                                        <button type="button" onClick={addBoleto} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-amber-300 text-amber-700 hover:bg-amber-50"><Icon name="Plus" size={12} /> Adicionar boleto</button>
                                    </div>
                                )}

                                {/* Cartão parcelado */}
                                {form.tipo_pagamento === 'cartao_prazo' && (
                                    <div className="space-y-2">
                                        <p className="text-xs font-medium text-amber-800">Parcelas do Cartão</p>
                                        {(form.parcelas_cartao || []).map((p, idx) => (
                                            <div key={idx} className="flex items-center gap-2 p-2 rounded-lg bg-white border text-xs flex-wrap" style={{ borderColor: '#FED7AA' }}>
                                                <span className="text-amber-700 font-medium">Parcela {idx + 1}</span>
                                                <input type="date" value={p.vencimento || ''} onChange={setParcelaCartaoField(idx, 'vencimento')} className="font-data border rounded px-1.5 py-1" style={{ borderColor: '#FED7AA' }} />
                                                <input type="number" step="0.01" value={p.valor} onChange={setParcelaCartaoField(idx, 'valor')} className="font-data font-semibold text-amber-800 border rounded px-1.5 py-1 w-24" style={{ borderColor: '#FED7AA' }} />
                                                <input value={p.cartao || ''} onChange={setParcelaCartaoField(idx, 'cartao')} placeholder="Cartão" className="text-amber-600 border rounded px-1.5 py-1 w-24" style={{ borderColor: '#FED7AA' }} />
                                                <span className={`ml-auto px-1.5 py-0.5 rounded ${p.pago ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{p.pago ? 'Pago' : 'Pendente'}</span>
                                                <button type="button" onClick={() => setForm(f => ({ ...f, parcelas_cartao: f.parcelas_cartao.filter((_, i) => i !== idx) }))} className="p-1 rounded hover:bg-red-50"><Icon name="X" size={11} color="#DC2626" /></button>
                                            </div>
                                        ))}
                                        <div className="p-2.5 rounded-lg border border-dashed" style={{ borderColor: '#D97706', backgroundColor: '#FFFBEB' }}>
                                            <p className="text-xs font-semibold text-amber-800 mb-1.5 flex items-center gap-1"><Icon name="Wand2" size={12} /> Gerar parcelas automaticamente</p>
                                            <div className="grid grid-cols-3 gap-2">
                                                <Field label="Qtde parcelas"><input type="number" min="1" value={gerador.quantidade} onChange={e => setGerador(g => ({ ...g, quantidade: e.target.value }))} className={inputCls} style={inputStyle} /></Field>
                                                <Field label="Prazo (dias úteis)"><input type="number" min="0" value={gerador.prazoDiasUteis} onChange={e => setGerador(g => ({ ...g, prazoDiasUteis: e.target.value }))} className={inputCls} style={inputStyle} placeholder="Ex: 30" /></Field>
                                                <Field label="Intervalo (dias)"><input type="number" min="1" value={gerador.intervaloDias} onChange={e => setGerador(g => ({ ...g, intervaloDias: e.target.value }))} className={inputCls} style={inputStyle} /></Field>
                                            </div>
                                            <button type="button" onClick={() => gerarAutomatico('cartao')} className="mt-1.5 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-600 text-white hover:bg-amber-700"><Icon name="Wand2" size={12} /> Gerar parcelas automaticamente</button>
                                        </div>
                                        <p className="text-xs font-medium text-amber-700 pt-1">ou adicione manualmente:</p>
                                        <div className="grid grid-cols-3 gap-2 mt-2">
                                            <Field label="Vencimento"><input type="date" value={novaParcela.vencimento} onChange={e => setNovaParcela(p => ({ ...p, vencimento: e.target.value }))} className={inputCls} style={inputStyle} /></Field>
                                            <Field label="Valor (R$)"><input type="number" step="0.01" value={novaParcela.valor} onChange={e => setNovaParcela(p => ({ ...p, valor: e.target.value }))} className={inputCls} style={inputStyle} placeholder="0,00" /></Field>
                                            <Field label="Cartão"><input value={novaParcela.cartao} onChange={e => setNovaParcela(p => ({ ...p, cartao: e.target.value }))} className={inputCls} style={inputStyle} placeholder="Ex: Nubank" /></Field>
                                        </div>
                                        <button type="button" onClick={addParcela} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-amber-300 text-amber-700 hover:bg-amber-50"><Icon name="Plus" size={12} /> Adicionar parcela</button>
                                    </div>
                                )}

                                {/* Cheque */}
                                {form.tipo_pagamento === 'cheque' && (
                                    <div className="space-y-2">
                                        <p className="text-xs font-medium text-amber-800">Cheques</p>
                                        {(form.cheques || []).map((ch, idx) => (
                                            <div key={idx} className="flex items-center gap-2 p-2 rounded-lg bg-white border text-xs" style={{ borderColor: '#FED7AA' }}>
                                                <span className="font-medium text-amber-800">#{ch.numero}</span>
                                                {ch.banco && <span className="text-amber-700">{ch.banco}</span>}
                                                <span className="font-data font-semibold">{BRL(ch.valor)}</span>
                                                {ch.vencimento && <span className="text-gray-500">{FMT(ch.vencimento)}</span>}
                                                <button type="button" onClick={() => setForm(f => ({ ...f, cheques: f.cheques.filter((_, i) => i !== idx) }))} className="ml-auto p-1 rounded hover:bg-red-50"><Icon name="X" size={11} color="#DC2626" /></button>
                                            </div>
                                        ))}
                                        <div className="grid grid-cols-2 gap-2 mt-2">
                                            <Field label="Nº Cheque"><input value={novoCheque.numero} onChange={e => setNovoCheque(c => ({ ...c, numero: e.target.value }))} className={inputCls} style={inputStyle} placeholder="000123" /></Field>
                                            <Field label="Banco"><input value={novoCheque.banco} onChange={e => setNovoCheque(c => ({ ...c, banco: e.target.value }))} className={inputCls} style={inputStyle} placeholder="Bradesco" /></Field>
                                            <Field label="Valor (R$)"><input type="number" step="0.01" value={novoCheque.valor} onChange={e => setNovoCheque(c => ({ ...c, valor: e.target.value }))} className={inputCls} style={inputStyle} placeholder="0,00" /></Field>
                                            <Field label="Vencimento"><input type="date" value={novoCheque.vencimento} onChange={e => setNovoCheque(c => ({ ...c, vencimento: e.target.value }))} className={inputCls} style={inputStyle} /></Field>
                                        </div>
                                        <button type="button" onClick={addCheque} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-amber-300 text-amber-700 hover:bg-amber-50"><Icon name="Plus" size={12} /> Adicionar cheque</button>
                                    </div>
                                )}

                                {/* Permuta */}
                                {form.tipo_pagamento === 'permuta' && (
                                    <div className="space-y-2">
                                        <Field label="Observações da permuta">
                                            <textarea value={form.permuta_obs} onChange={e => set('permuta_obs', e.target.value)} className={inputCls} style={inputStyle} rows={3} placeholder="Descreva os termos da permuta..." />
                                        </Field>
                                        <div className="flex items-center gap-2">
                                            <button type="button" onClick={() => permutaRef.current?.click()} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium hover:bg-amber-50" style={{ borderColor: '#FED7AA' }}>
                                                <Icon name="Paperclip" size={13} /> Anexar documento
                                            </button>
                                            {form.permuta_doc_url && <span className="text-xs text-amber-700 flex items-center gap-1"><Icon name="CheckCircle2" size={12} /> Anexado</span>}
                                            <input ref={permutaRef} type="file" accept="image/*,.pdf" onChange={e => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = ev => set('permuta_doc_url', ev.target.result); r.readAsDataURL(f); }} className="hidden" />
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* ── Observações ────────────────────────────────────────── */}
                    <Field label="Observações">
                        <textarea value={form.observacoes} onChange={e => set('observacoes', e.target.value)} className={inputCls} style={inputStyle} rows={2} placeholder="Observações adicionais..." />
                    </Field>
                </div>

                <div className="flex gap-3 p-5 justify-end border-t shrink-0" style={{ borderColor: 'var(--color-border)' }}>
                    <button onClick={onClose} className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50" style={{ borderColor: 'var(--color-border)' }}>Cancelar</button>
                    <Button onClick={() => handleSave()} size="sm" iconName={saving ? 'Loader' : 'Check'} disabled={saving}>
                        {saving ? 'Salvando...' : (isEdit ? 'Atualizar' : 'Salvar Despesa')}
                    </Button>
                </div>
                <Toast toast={toast} />
            </ModalOverlay>

            {showFornecedores && (
                <ModalFornecedores
                    config={config}
                    onClose={() => setShowFornecedores(false)}
                    onSelect={f => { set('fornecedor', f.nome); if (f.categoria) set('categoria', f.categoria); }}
                />
            )}
            {ConfirmDialog}
        </>
    );
}
