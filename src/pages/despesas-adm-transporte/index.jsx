import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import NavigationBar from 'components/ui/NavigationBar';
import BreadcrumbTrail from 'components/ui/BreadcrumbTrail';
import Button from 'components/ui/Button';
import Icon from 'components/AppIcon';
import Toast from 'components/ui/Toast';
import { useToast } from 'utils/useToast';
import { useConfirm } from 'components/ui/ConfirmDialog';
import { useAuth } from 'utils/AuthContext';
import {
    CATEGORIAS_DESPESA_ADM,
    fetchDespesasAdmTransporte,
    createDespesaAdmTransporte,
    updateDespesaAdmTransporte,
    deleteDespesaAdmTransporte,
    pagarBoletoAdmTransporte,
    revogarBoletoAdmTransporte,
    pagarParcelaCartaoAdmTransporte,
    revogarParcelaCartaoAdmTransporte,
} from 'utils/despesasAdmTransporteService';
import * as XLSX from 'xlsx';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const BRL = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const FMT = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—';
const inputCls = 'w-full px-3 py-2 rounded-lg border text-sm outline-none transition-all focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500';
const inputStyle = { borderColor: 'var(--color-border)', color: 'var(--color-text-primary)', backgroundColor: 'transparent' };

// Paleta de cores para categorias
const CAT_COLORS = [
    '#3B82F6','#8B5CF6','#EC4899','#F97316','#10B981',
    '#06B6D4','#EAB308','#EF4444','#6366F1','#14B8A6',
    '#F59E0B','#84CC16','#A855F7','#0EA5E9','#D946EF',
    '#22C55E','#FB923C','#E11D48','#7C3AED','#0891B2',
];
const getCatColor = (cat) => CAT_COLORS[CATEGORIAS_DESPESA_ADM.indexOf(cat) % CAT_COLORS.length] || '#6B7280';

// ─── Componentes Reutilizáveis ─────────────────────────────────────────────────
function ModalOverlay({ children, onClose, wide }) {
    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)' }}
            onClick={e => e.target === e.currentTarget && onClose()}>
            <div className={`bg-white rounded-2xl shadow-2xl flex flex-col ${wide ? 'w-full max-w-4xl' : 'w-full max-w-2xl'}`}
                style={{ maxHeight: 'calc(100vh - 32px)' }}>
                {children}
            </div>
        </div>
    );
}

function ModalHeader({ title, icon, onClose }) {
    return (
        <div className="flex items-center justify-between p-5 border-b shrink-0"
            style={{ borderColor: 'var(--color-border)' }}>
            <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#F0FDF4' }}>
                    <Icon name={icon} size={18} color="#059669" />
                </div>
                <h2 className="font-heading font-bold text-lg" style={{ color: 'var(--color-text-primary)' }}>{title}</h2>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                <Icon name="X" size={18} color="var(--color-muted-foreground)" />
            </button>
        </div>
    );
}

function Field({ label, required, children, className = '' }) {
    return (
        <div className={className}>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                {label}{required && <span className="text-red-500 ml-0.5">*</span>}
            </label>
            {children}
        </div>
    );
}

function PgBadge({ d }) {
    if (!d) return null;
    if (d.forma_pagamento === 'a_prazo') {
        const map = { boleto: 'Boleto', cartao_prazo: '💳 Cartão Parc.', permuta: 'Permuta', cheque: 'Cheque' };
        const isCard = d.tipo_pagamento === 'cartao_prazo';
        return <span className={`px-2 py-0.5 rounded text-xs font-medium ${isCard ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-700'}`}>{map[d.tipo_pagamento] || 'A Prazo'}</span>;
    }
    const map = { pix: 'PIX', dinheiro: 'Dinheiro', transferencia_m: 'Transf.', cartao: '💳 Cartão' };
    const isCard = d.tipo_pagamento === 'cartao';
    return <span className={`px-2 py-0.5 rounded text-xs font-medium ${isCard ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'}`}>{map[d.tipo_pagamento] || 'À Vista'}</span>;
}

function BoletosPendentes({ despesa }) {
    const pendBoletos = (despesa.boletos || []).filter(b => !b.pago);
    const pendParcelas = (despesa.parcelas_cartao || []).filter(p => !p.pago);
    if (!pendBoletos.length && !pendParcelas.length) return null;
    return (
        <div className="mt-1 flex items-center gap-1">
            {pendBoletos.length > 0 && (
                <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-xs font-medium">
                    {pendBoletos.length} boleto{pendBoletos.length > 1 ? 's' : ''} pendente{pendBoletos.length > 1 ? 's' : ''}
                </span>
            )}
            {pendParcelas.length > 0 && (
                <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 text-xs font-medium">
                    {pendParcelas.length} parcela{pendParcelas.length > 1 ? 's' : ''} pendente{pendParcelas.length > 1 ? 's' : ''}
                </span>
            )}
        </div>
    );
}

// ─── Modal de Baixa / Revogação ───────────────────────────────────────────────
function ModalBaixa({ despesa, onClose, onBaixado, isAdmin }) {
    const { toast, showToast } = useToast();
    const [loading, setLoading] = useState(false);

    const act = async (fn, successMsg) => {
        setLoading(true);
        try { await fn(); showToast(successMsg, successMsg.includes('Revogada') ? 'warning' : 'success'); onBaixado(); }
        catch (e) { showToast('Erro: ' + e.message, 'error'); }
        finally { setLoading(false); }
    };

    const boletos  = despesa.boletos || [];
    const parcelas = despesa.parcelas_cartao || [];

    return (
        <ModalOverlay onClose={onClose}>
            <ModalHeader title="Baixa em Pagamentos" icon="CheckCircle2" onClose={onClose} />
            <div className="p-5 overflow-y-auto flex-1 space-y-5">
                {boletos.length > 0 && (
                    <div>
                        <p className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>Boletos</p>
                        <div className="space-y-2">
                            {boletos.map((b, idx) => (
                                <div key={idx} className="flex items-center gap-3 p-3 rounded-xl border"
                                    style={{ borderColor: 'var(--color-border)', backgroundColor: b.pago ? '#F0FDF4' : '#FFFBEB' }}>
                                    <div className="flex-1">
                                        <p className="text-sm font-medium font-data" style={{ color: 'var(--color-text-primary)' }}>
                                            Parcela {idx + 1} — {BRL(b.valor)}
                                        </p>
                                        <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>Vencimento: {FMT(b.vencimento)}</p>
                                        {b.pago && <p className="text-xs text-green-600 font-medium">✓ Pago em {b.pago_em ? new Date(b.pago_em).toLocaleDateString('pt-BR') : '—'}</p>}
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        {!b.pago ? (
                                            <button onClick={() => act(() => pagarBoletoAdmTransporte(despesa.id, idx), 'Boleto baixado!')}
                                                disabled={loading}
                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-60">
                                                <Icon name="Check" size={13} /> Dar baixa
                                            </button>
                                        ) : (
                                            <>
                                                <span className="px-3 py-1.5 rounded-lg text-xs font-medium bg-green-100 text-green-700">Pago</span>
                                                {isAdmin && (
                                                    <button onClick={() => act(() => revogarBoletoAdmTransporte(despesa.id, idx), 'Baixa Revogada!')}
                                                        disabled={loading}
                                                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-colors disabled:opacity-60">
                                                        <Icon name="RotateCcw" size={12} /> Revogar
                                                    </button>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                {parcelas.length > 0 && (
                    <div>
                        <p className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>Parcelas do Cartão</p>
                        <div className="space-y-2">
                            {parcelas.map((p, idx) => (
                                <div key={idx} className="flex items-center gap-3 p-3 rounded-xl border"
                                    style={{ borderColor: 'var(--color-border)', backgroundColor: p.pago ? '#F0FDF4' : '#FAF5FF' }}>
                                    <div className="flex-1">
                                        <p className="text-sm font-medium font-data" style={{ color: 'var(--color-text-primary)' }}>
                                            Parcela {idx + 1} — {BRL(p.valor)}
                                        </p>
                                        <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                                            Vencimento: {FMT(p.vencimento)}{p.cartao ? ` · ${p.cartao}` : ''}
                                        </p>
                                        {p.pago && <p className="text-xs text-purple-600 font-medium">✓ Pago em {p.pago_em ? new Date(p.pago_em).toLocaleDateString('pt-BR') : '—'}</p>}
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        {!p.pago ? (
                                            <button onClick={() => act(() => pagarParcelaCartaoAdmTransporte(despesa.id, idx), 'Parcela baixada!')}
                                                disabled={loading}
                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-600 text-white hover:bg-purple-700 transition-colors disabled:opacity-60">
                                                <Icon name="Check" size={13} /> Dar baixa
                                            </button>
                                        ) : (
                                            <>
                                                <span className="px-3 py-1.5 rounded-lg text-xs font-medium bg-purple-100 text-purple-700">Pago</span>
                                                {isAdmin && (
                                                    <button onClick={() => act(() => revogarParcelaCartaoAdmTransporte(despesa.id, idx), 'Baixa Revogada!')}
                                                        disabled={loading}
                                                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-colors disabled:opacity-60">
                                                        <Icon name="RotateCcw" size={12} /> Revogar
                                                    </button>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                {boletos.length === 0 && parcelas.length === 0 && (
                    <p className="text-sm text-center py-6" style={{ color: 'var(--color-muted-foreground)' }}>Nenhum boleto ou parcela cadastrado.</p>
                )}
            </div>
            <Toast toast={toast} />
        </ModalOverlay>
    );
}

// ─── Modal de Formulário ──────────────────────────────────────────────────────
function ModalDespesa({ modal, onClose, onSaved }) {
    const { toast, showToast } = useToast();
    const xmlRef = useRef(null);
    const comprovanteRef = useRef(null);
    const permutaRef = useRef(null);
    const barcodeInputRef = useRef(null);
    const [barcodeMode, setBarcodeMode] = useState(false);
    const [barcodeBuffer, setBarcodeBuffer] = useState('');
    const [loadingNFe, setLoadingNFe] = useState(false);
    const [saving, setSaving] = useState(false);
    const [categoriasExtras, setCategoriasExtras] = useState(() => {
        try { return JSON.parse(localStorage.getItem('adm_transporte_categorias_extras') || '[]'); } catch { return []; }
    });
    const [novaCategoria, setNovaCategoria] = useState('');
    const [showNovaCategoria, setShowNovaCategoria] = useState(false);
    const [novoBoleto, setNovoBoleto] = useState({ vencimento: '', valor: '' });
    const [novoCheque, setNovoCheque] = useState({ numero: '', banco: '', valor: '', vencimento: '' });
    const [novaParcela, setNovaParcela] = useState({ vencimento: '', valor: '', cartao: '' });

    const todasCategorias = useMemo(() => [...CATEGORIAS_DESPESA_ADM, ...categoriasExtras], [categoriasExtras]);
    const isEdit = modal?.mode === 'edit';

    const emptyForm = () => ({
        categoria: CATEGORIAS_DESPESA_ADM[0], descricao: '', valor: '',
        data_despesa: new Date().toISOString().split('T')[0],
        nota_fiscal: '', fornecedor: '', empresa: '', observacoes: '',
        notas_fiscais: [], nf_itens: [],
        forma_pagamento: 'a_vista', tipo_pagamento: 'pix',
        comprovante_url: '', boletos: [], parcelas_cartao: [],
        permuta_obs: '', permuta_doc_url: '', cheques: [],
    });

    const [form, setForm] = useState(() => {
        if (isEdit && modal?.data) {
            const d = modal.data;
            return {
                categoria: d.categoria, descricao: d.descricao || '',
                valor: String(d.valor || ''), data_despesa: d.data_despesa,
                nota_fiscal: d.nota_fiscal || '', fornecedor: d.fornecedor || '',
                empresa: d.empresa || '', observacoes: d.observacoes || '',
                notas_fiscais: d.notas_fiscais || [], nf_itens: d.nf_itens || [],
                forma_pagamento: d.forma_pagamento || 'a_vista',
                tipo_pagamento: d.tipo_pagamento || 'pix',
                comprovante_url: d.comprovante_url || '',
                boletos: d.boletos || [], parcelas_cartao: d.parcelas_cartao || [],
                permuta_obs: d.permuta_obs || '', permuta_doc_url: d.permuta_doc_url || '',
                cheques: d.cheques || [],
            };
        }
        return emptyForm();
    });

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const adicionarCategoria = () => {
        const cat = novaCategoria.trim();
        if (!cat || todasCategorias.includes(cat)) { showToast(cat ? 'Categoria já existe' : 'Digite o nome', 'error'); return; }
        const novas = [...categoriasExtras, cat];
        setCategoriasExtras(novas);
        localStorage.setItem('adm_transporte_categorias_extras', JSON.stringify(novas));
        set('categoria', cat);
        setNovaCategoria(''); setShowNovaCategoria(false);
        showToast(`Categoria "${cat}" criada!`, 'success');
    };

    // ── XML NF-e ───────────────────────────────────────────────────────────────
    const handleXmlNF = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const parser = new DOMParser();
                const xml = parser.parseFromString(ev.target.result, 'application/xml');
                const nNF      = xml.querySelector('nNF')?.textContent || '';
                const dhEmi    = xml.querySelector('dhEmi')?.textContent?.slice(0, 10) || '';
                const vnf      = xml.querySelector('vNF')?.textContent || '';
                const emitNome = xml.querySelector('emit xNome')?.textContent || '';
                const emitCNPJ = xml.querySelector('emit CNPJ')?.textContent || '';
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
                const novaNF = { numero: nNF, fornecedor, valor: vnf, data: dhEmi, descricao: '', nf_itens: itens };
                setForm(f => {
                    const novasNFs = [...(f.notas_fiscais || []), novaNF];
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
            } catch { showToast('Erro ao ler XML. Verifique o arquivo.', 'error'); }
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    // ── Código de barras ───────────────────────────────────────────────────────
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
                fornecedor: fornecedor || f.fornecedor || `CNPJ ${cnpjFmt}`,
                descricao: f.descricao || `NF ${nNF} · Série ${serie}`,
            }));
            showToast(fornecedor ? `✅ NF ${nNF} — ${fornecedor}` : `NF ${nNF} lida.`, fornecedor ? 'success' : 'info');
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
            setTimeout(() => document.getElementById('adm-despesa-valor')?.focus(), 100);
        }
        if (e.key === 'Escape') { setBarcodeMode(false); setBarcodeBuffer(''); }
    };

    // ── Boletos / parcelas / cheques ───────────────────────────────────────────
    const addBoleto = () => {
        if (!novoBoleto.vencimento || !novoBoleto.valor) { showToast('Preencha vencimento e valor', 'error'); return; }
        setForm(f => ({ ...f, boletos: [...(f.boletos || []), { ...novoBoleto, pago: false }] }));
        setNovoBoleto({ vencimento: '', valor: '' });
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

    const handleSave = async () => {
        if (!form.categoria || !form.valor || !form.data_despesa) { showToast('Categoria, valor e data são obrigatórios', 'error'); return; }
        setSaving(true);
        try {
            const payload = {
                ...form,
                valor: Number(form.valor),
                notas_fiscais: form.notas_fiscais || [],
                nf_itens: form.nf_itens || [],
                boletos: form.boletos || [],
                parcelas_cartao: form.parcelas_cartao || [],
                cheques: form.cheques || [],
            };
            if (isEdit) await updateDespesaAdmTransporte(modal.data.id, payload);
            else await createDespesaAdmTransporte(payload);
            showToast('Despesa salva!', 'success');
            onSaved(); onClose();
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
        finally { setSaving(false); }
    };

    return (
        <ModalOverlay onClose={onClose} wide>
            <ModalHeader title={isEdit ? 'Editar Despesa' : 'Nova Despesa Administrativa'} icon="ShoppingCart" onClose={onClose} />
            <div className="p-5 space-y-4 overflow-y-auto flex-1">

                {/* ── NF-e ──────────────────────────────────────────────── */}
                <div className="p-3 rounded-xl border" style={{ borderColor: '#BFDBFE', backgroundColor: '#EFF6FF' }}>
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-semibold text-blue-700">
                            📄 Notas Fiscais
                            {(form.notas_fiscais || []).length > 0 && (
                                <span className="ml-2 px-1.5 py-0.5 rounded-full bg-blue-600 text-white text-xs">{(form.notas_fiscais || []).length}</span>
                            )}
                        </p>
                        <button type="button"
                            onClick={() => setForm(f => ({ ...f, notas_fiscais: [...(f.notas_fiscais || []), { numero: '', fornecedor: '', data: '', descricao: '', valor: '', nf_itens: [], _manual: true }] }))}
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
                                        <span className="text-xs font-semibold text-blue-800">NF {nfIdx + 1} {nf._manual ? '— manual' : '— XML'}</span>
                                        <button type="button"
                                            onClick={() => setForm(f => { const novas = f.notas_fiscais.filter((_, i) => i !== nfIdx); const soma = novas.reduce((s, n) => s + Number(n.valor || 0), 0); return { ...f, notas_fiscais: novas, valor: soma > 0 ? String(soma) : f.valor }; })}
                                            className="p-1 rounded hover:bg-red-100"><Icon name="X" size={12} color="#DC2626" /></button>
                                    </div>
                                    <div className="p-3 grid grid-cols-2 gap-2">
                                        {[
                                            { label: 'Nº da NF', field: 'numero', placeholder: 'Ex: 35520' },
                                            { label: 'Valor (R$)', field: 'valor', placeholder: '0,00', type: 'number' },
                                            { label: 'Fornecedor', field: 'fornecedor', placeholder: 'Nome do fornecedor' },
                                            { label: 'Data de emissão', field: 'data', placeholder: '', type: 'date' },
                                        ].map(({ label, field, placeholder, type }) => (
                                            <div key={field}>
                                                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>{label}</label>
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
                                            <input value={nf.descricao || ''} placeholder="Ex: Compra de pneus"
                                                onChange={e => setForm(f => { const a = [...f.notas_fiscais]; a[nfIdx] = { ...a[nfIdx], descricao: e.target.value }; return { ...f, notas_fiscais: a }; })}
                                                className={inputCls} style={inputStyle} />
                                        </div>
                                    </div>
                                    {nf.nf_itens?.length > 0 && (
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

                {/* ── Dados básicos ──────────────────────────────────────── */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Categoria" required>
                        <div className="space-y-2">
                            <div className="flex gap-2">
                                <select value={form.categoria} onChange={e => set('categoria', e.target.value)} className={inputCls} style={inputStyle}>
                                    {todasCategorias.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                                <button type="button" onClick={() => setShowNovaCategoria(s => !s)}
                                    className="shrink-0 px-2.5 py-2 rounded-lg border text-xs font-medium hover:bg-green-50"
                                    style={{ borderColor: '#6EE7B7', color: '#059669' }}>
                                    <Icon name={showNovaCategoria ? 'X' : 'Plus'} size={14} />
                                </button>
                            </div>
                            {showNovaCategoria && (
                                <div className="flex gap-2 p-2 rounded-lg" style={{ backgroundColor: '#F0FDF4', border: '1px solid #6EE7B7' }}>
                                    <input value={novaCategoria} onChange={e => setNovaCategoria(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && adicionarCategoria()}
                                        className={inputCls + ' flex-1'} style={inputStyle} placeholder="Nova categoria..." autoFocus />
                                    <button type="button" onClick={adicionarCategoria} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-green-600 text-white">Criar</button>
                                </div>
                            )}
                        </div>
                    </Field>
                    <Field label="Data" required>
                        <input type="date" value={form.data_despesa} onChange={e => set('data_despesa', e.target.value)} className={inputCls} style={inputStyle} />
                    </Field>
                    <Field label="Valor (R$)" required>
                        <input id="adm-despesa-valor" type="number" step="0.01" min="0" value={form.valor} onChange={e => set('valor', e.target.value)} className={inputCls} style={inputStyle} placeholder="0,00" />
                    </Field>
                    <Field label="Empresa">
                        <input value={form.empresa} onChange={e => set('empresa', e.target.value)} className={inputCls} style={inputStyle} placeholder="Ex: Distribuidora Silva Ltda" />
                    </Field>
                    <Field label="Fornecedor" className="sm:col-span-2">
                        <input value={form.fornecedor || ''} onChange={e => set('fornecedor', e.target.value)} className={inputCls} style={inputStyle} placeholder="Ex: Fórum Papelaria" />
                    </Field>
                    <Field label="Nº Nota Fiscal">
                        <input value={form.nota_fiscal} onChange={e => set('nota_fiscal', e.target.value)} className={inputCls} style={inputStyle} placeholder="Ex: 12345" />
                    </Field>
                    <Field label="Descrição" className="sm:col-span-2">
                        <input value={form.descricao} onChange={e => set('descricao', e.target.value)} className={inputCls} style={inputStyle} placeholder="Ex: 10 resmas de papel A4, canetas, grampeadores" />
                    </Field>
                </div>

                {/* ── Forma de Pagamento ─────────────────────────────────── */}
                <div className="space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-secondary)' }}>Forma de Pagamento</p>
                    <div className="flex gap-2">
                        {[['a_vista', '💳 À Vista'], ['a_prazo', '📋 A Prazo']].map(([v, l]) => (
                            <button key={v} type="button"
                                onClick={() => setForm(f => ({ ...f, forma_pagamento: v, tipo_pagamento: v === 'a_vista' ? 'pix' : 'boleto' }))}
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
                                    <button type="button" onClick={() => comprovanteRef.current?.click()}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium hover:bg-green-50" style={{ borderColor: '#BBF7D0' }}>
                                        <Icon name="Paperclip" size={13} /> Anexar comprovante
                                    </button>
                                    {form.comprovante_url && <span className="text-xs text-green-700 flex items-center gap-1"><Icon name="CheckCircle2" size={12} /> Anexado</span>}
                                    <input ref={comprovanteRef} type="file" accept="image/*,.pdf"
                                        onChange={e => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = ev => set('comprovante_url', ev.target.result); r.readAsDataURL(f); }}
                                        className="hidden" />
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

                            {form.tipo_pagamento === 'boleto' && (
                                <div className="space-y-2">
                                    <p className="text-xs font-medium text-amber-800">Boletos / Parcelas</p>
                                    {(form.boletos || []).map((b, idx) => (
                                        <div key={idx} className="flex items-center gap-2 p-2 rounded-lg bg-white border text-xs" style={{ borderColor: '#FED7AA' }}>
                                            <span className="text-amber-700 font-medium">Parcela {idx + 1}</span>
                                            <span className="font-data">{FMT(b.vencimento)}</span>
                                            <span className="font-data font-semibold text-amber-800">{BRL(b.valor)}</span>
                                            <span className={`px-1.5 py-0.5 rounded ${b.pago ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{b.pago ? 'Pago' : 'Pendente'}</span>
                                            <button type="button" onClick={() => setForm(f => ({ ...f, boletos: f.boletos.filter((_, i) => i !== idx) }))} className="ml-auto p-1 rounded hover:bg-red-50"><Icon name="X" size={11} color="#DC2626" /></button>
                                        </div>
                                    ))}
                                    <div className="grid grid-cols-2 gap-2 mt-2">
                                        <Field label="Vencimento"><input type="date" value={novoBoleto.vencimento} onChange={e => setNovoBoleto(b => ({ ...b, vencimento: e.target.value }))} className={inputCls} style={inputStyle} /></Field>
                                        <Field label="Valor (R$)"><input type="number" step="0.01" value={novoBoleto.valor} onChange={e => setNovoBoleto(b => ({ ...b, valor: e.target.value }))} className={inputCls} style={inputStyle} placeholder="0,00" /></Field>
                                    </div>
                                    <button type="button" onClick={addBoleto} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-amber-300 text-amber-700 hover:bg-amber-50"><Icon name="Plus" size={12} /> Adicionar boleto</button>
                                </div>
                            )}

                            {form.tipo_pagamento === 'cartao_prazo' && (
                                <div className="space-y-2">
                                    <p className="text-xs font-medium text-amber-800">Parcelas do Cartão</p>
                                    {(form.parcelas_cartao || []).map((p, idx) => (
                                        <div key={idx} className="flex items-center gap-2 p-2 rounded-lg bg-white border text-xs" style={{ borderColor: '#FED7AA' }}>
                                            <span className="text-amber-700 font-medium">Parcela {idx + 1}</span>
                                            <span className="font-data">{FMT(p.vencimento)}</span>
                                            <span className="font-data font-semibold text-amber-800">{BRL(p.valor)}</span>
                                            {p.cartao && <span className="text-amber-600 truncate max-w-[80px]">{p.cartao}</span>}
                                            <span className={`ml-auto px-1.5 py-0.5 rounded ${p.pago ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{p.pago ? 'Pago' : 'Pendente'}</span>
                                            <button type="button" onClick={() => setForm(f => ({ ...f, parcelas_cartao: f.parcelas_cartao.filter((_, i) => i !== idx) }))} className="p-1 rounded hover:bg-red-50"><Icon name="X" size={11} color="#DC2626" /></button>
                                        </div>
                                    ))}
                                    <div className="grid grid-cols-3 gap-2 mt-2">
                                        <Field label="Vencimento"><input type="date" value={novaParcela.vencimento} onChange={e => setNovaParcela(p => ({ ...p, vencimento: e.target.value }))} className={inputCls} style={inputStyle} /></Field>
                                        <Field label="Valor (R$)"><input type="number" step="0.01" value={novaParcela.valor} onChange={e => setNovaParcela(p => ({ ...p, valor: e.target.value }))} className={inputCls} style={inputStyle} placeholder="0,00" /></Field>
                                        <Field label="Cartão"><input value={novaParcela.cartao} onChange={e => setNovaParcela(p => ({ ...p, cartao: e.target.value }))} className={inputCls} style={inputStyle} placeholder="Ex: Nubank" /></Field>
                                    </div>
                                    <button type="button" onClick={addParcela} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-amber-300 text-amber-700 hover:bg-amber-50"><Icon name="Plus" size={12} /> Adicionar parcela</button>
                                </div>
                            )}

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

                            {form.tipo_pagamento === 'permuta' && (
                                <div className="space-y-2">
                                    <Field label="Observações da permuta">
                                        <textarea value={form.permuta_obs} onChange={e => set('permuta_obs', e.target.value)} className={inputCls} style={inputStyle} rows={3} placeholder="Descreva os termos da permuta..." />
                                    </Field>
                                    <div className="flex items-center gap-2">
                                        <button type="button" onClick={() => permutaRef.current?.click()}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium hover:bg-amber-50" style={{ borderColor: '#FED7AA' }}>
                                            <Icon name="Paperclip" size={13} /> Anexar documento
                                        </button>
                                        {form.permuta_doc_url && <span className="text-xs text-amber-700 flex items-center gap-1"><Icon name="CheckCircle2" size={12} /> Anexado</span>}
                                        <input ref={permutaRef} type="file" accept="image/*,.pdf"
                                            onChange={e => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = ev => set('permuta_doc_url', ev.target.result); r.readAsDataURL(f); }}
                                            className="hidden" />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <Field label="Observações">
                    <textarea value={form.observacoes} onChange={e => set('observacoes', e.target.value)} className={inputCls} style={inputStyle} rows={2} placeholder="Observações adicionais..." />
                </Field>
            </div>

            <div className="flex gap-3 p-5 justify-end border-t shrink-0" style={{ borderColor: 'var(--color-border)' }}>
                <button onClick={onClose} className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50" style={{ borderColor: 'var(--color-border)' }}>Cancelar</button>
                <Button onClick={handleSave} size="sm" iconName={saving ? 'Loader' : 'Check'} disabled={saving}>
                    {saving ? 'Salvando...' : (isEdit ? 'Atualizar' : 'Salvar Despesa')}
                </Button>
            </div>
            <Toast toast={toast} />
        </ModalOverlay>
    );
}

// ─── PÁGINA PRINCIPAL ─────────────────────────────────────────────────────────
export default function DespesasAdmTransporte() {
    const { isAdmin } = useAuth();
    const { toast, showToast } = useToast();
    const { confirm, ConfirmDialog } = useConfirm();
    const admin = isAdmin();

    const [despesas, setDespesas]     = useState([]);
    const [loading, setLoading]       = useState(true);
    const [modal, setModal]           = useState(null);
    const [modalBaixa, setModalBaixa] = useState(null);
    const [filtro, setFiltro]         = useState({ categoria: '', mes: '', formaPgto: '' });
    const [categoriasExtras]          = useState(() => { try { return JSON.parse(localStorage.getItem('adm_transporte_categorias_extras') || '[]'); } catch { return []; } });

    const todasCategorias = useMemo(() => [...CATEGORIAS_DESPESA_ADM, ...categoriasExtras], [categoriasExtras]);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const f = {};
            if (filtro.categoria) f.categoria = filtro.categoria;
            if (filtro.formaPgto) f.formaPgto = filtro.formaPgto;
            if (filtro.mes) {
                f.dataInicio = filtro.mes + '-01';
                f.dataFim    = filtro.mes + '-' + String(new Date(Number(filtro.mes.split('-')[0]), Number(filtro.mes.split('-')[1]), 0).getDate()).padStart(2, '0');
            }
            setDespesas(await fetchDespesasAdmTransporte(f));
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
        finally { setLoading(false); }
    }, [filtro]); // eslint-disable-line
    useEffect(() => { load(); }, [load]);

    const handleDelete = async (id) => {
        const ok = await confirm({ title: 'Excluir despesa?', message: 'Esta ação não pode ser desfeita.', confirmLabel: 'Excluir', variant: 'danger' });
        if (!ok) return;
        try { await deleteDespesaAdmTransporte(id); showToast('Despesa excluída!', 'warning'); load(); }
        catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };

    const totalPeriodo = useMemo(() => despesas.reduce((s, d) => s + Number(d.valor || 0), 0), [despesas]);

    const totalPorCategoria = useMemo(() => {
        const acc = {};
        despesas.forEach(d => { acc[d.categoria] = (acc[d.categoria] || 0) + Number(d.valor || 0); });
        return Object.entries(acc).sort((a, b) => b[1] - a[1]);
    }, [despesas]);

    const boletosVencendo = useMemo(() => {
        const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
        const em7 = new Date(hoje); em7.setDate(em7.getDate() + 7);
        const alertas = [];
        despesas.forEach(d => {
            (d.boletos || []).forEach((b, idx) => {
                if (!b.pago && b.vencimento) {
                    const venc = new Date(b.vencimento + 'T00:00:00');
                    if (venc <= em7) alertas.push({ despesa: d, idx, boleto: b, venc, atrasado: venc < hoje });
                }
            });
            (d.parcelas_cartao || []).forEach((p, idx) => {
                if (!p.pago && p.vencimento) {
                    const venc = new Date(p.vencimento + 'T00:00:00');
                    if (venc <= em7) alertas.push({ despesa: d, idx, parcela: p, venc, atrasado: venc < hoje });
                }
            });
        });
        return alertas;
    }, [despesas]);

    const exportar = () => {
        if (!despesas.length) { showToast('Nenhuma despesa no período', 'error'); return; }
        const rows = despesas.map(d => ({
            'Data': FMT(d.data_despesa), 'Categoria': d.categoria,
            'Empresa': d.empresa || '', 'Fornecedor': d.fornecedor || '',
            'Descrição': d.descricao || '', 'NF': d.nota_fiscal || '',
            'Forma Pgto': d.forma_pagamento === 'a_vista' ? 'À Vista' : 'A Prazo',
            'Tipo': d.tipo_pagamento || '', 'Valor (R$)': Number(d.valor || 0),
            'Observações': d.observacoes || '',
        }));
        rows.push({ 'Data': 'TOTAL', 'Valor (R$)': totalPeriodo });
        const ws = XLSX.utils.json_to_sheet(rows);
        ws['!cols'] = [12, 25, 22, 25, 30, 12, 12, 14, 14, 30].map(w => ({ wch: w }));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Desp. Adm. Transporte');
        XLSX.writeFile(wb, `despesas_adm_transporte_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.xlsx`);
        showToast('Exportado!', 'success');
    };

    return (
        <div className="min-h-screen" style={{ backgroundColor: 'var(--color-background)' }}>
            <NavigationBar />
            <main className="main-content">
                <div className="max-w-screen-2xl mx-auto px-4 lg:px-8 py-6">
                    <BreadcrumbTrail className="mb-4" />

                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                        <div>
                            <h1 className="font-heading font-bold text-2xl md:text-3xl flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
                                <Icon name="ShoppingCart" size={28} color="#059669" /> Despesas Administrativas — Transporte
                            </h1>
                            <p className="text-sm mt-1" style={{ color: 'var(--color-muted-foreground)' }}>
                                Controle de compras e despesas administrativas do setor de transporte
                            </p>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                            <button onClick={exportar} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium hover:bg-gray-50 transition-colors" style={{ borderColor: 'var(--color-border)' }}>
                                <Icon name="FileDown" size={14} /> Exportar Excel
                            </button>
                            {admin && (
                                <Button onClick={() => setModal({ mode: 'create' })} iconName="Plus">Nova Despesa</Button>
                            )}
                        </div>
                    </div>

                    {/* Alertas vencimento */}
                    {boletosVencendo.length > 0 && (
                        <div className="mb-5 p-4 rounded-2xl border flex items-start gap-3" style={{ backgroundColor: '#FFF7ED', borderColor: '#FED7AA' }}>
                            <Icon name="AlertTriangle" size={20} color="#D97706" />
                            <div className="flex-1">
                                <p className="text-sm font-semibold text-amber-800 mb-1">
                                    ⚠️ {boletosVencendo.length} pagamento{boletosVencendo.length > 1 ? 's' : ''} vencendo nos próximos 7 dias
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {boletosVencendo.map((alerta, i) => (
                                        <button key={i} onClick={() => setModalBaixa(alerta.despesa)}
                                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors"
                                            style={{ backgroundColor: alerta.atrasado ? '#FEE2E2' : '#FEF3C7', color: alerta.atrasado ? '#B91C1C' : '#92400E', border: `1px solid ${alerta.atrasado ? '#FECACA' : '#FDE68A'}` }}>
                                            {alerta.atrasado ? '🔴' : '🟡'}
                                            {alerta.despesa.categoria} · {BRL(alerta.boleto?.valor || alerta.parcela?.valor)} · {FMT(alerta.boleto?.vencimento || alerta.parcela?.vencimento)}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Filtros */}
                    <div className="flex flex-wrap gap-2 items-center mb-5">
                        <select value={filtro.categoria} onChange={e => setFiltro(f => ({ ...f, categoria: e.target.value }))} className="px-3 py-2 rounded-lg border text-sm" style={inputStyle}>
                            <option value="">Todas categorias</option>
                            {todasCategorias.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <select value={filtro.formaPgto} onChange={e => setFiltro(f => ({ ...f, formaPgto: e.target.value }))} className="px-3 py-2 rounded-lg border text-sm" style={inputStyle}>
                            <option value="">Todas as formas</option>
                            <option value="a_vista">À Vista</option>
                            <option value="a_prazo">A Prazo</option>
                        </select>
                        <input type="month" value={filtro.mes} onChange={e => setFiltro(f => ({ ...f, mes: e.target.value }))} className="px-3 py-2 rounded-lg border text-sm" style={inputStyle} />
                        <button onClick={load} className="p-2 rounded-lg border hover:bg-gray-50" style={{ borderColor: 'var(--color-border)' }} title="Atualizar">
                            <Icon name="RefreshCw" size={14} color="var(--color-muted-foreground)" />
                        </button>
                        {(filtro.categoria || filtro.mes || filtro.formaPgto) && (
                            <button onClick={() => setFiltro({ categoria: '', mes: '', formaPgto: '' })}
                                className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 border border-red-200">
                                <Icon name="X" size={12} /> Limpar filtros
                            </button>
                        )}
                    </div>

                    {/* KPI Cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                        {/* Total */}
                        <div className="rounded-2xl border p-4 shadow-sm sm:col-span-2" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface, white)' }}>
                            <p className="text-xs mb-1" style={{ color: 'var(--color-muted-foreground)' }}>Total no Período</p>
                            <p className="text-2xl font-bold font-data" style={{ color: '#DC2626' }}>{BRL(totalPeriodo)}</p>
                            <p className="text-xs mt-1" style={{ color: 'var(--color-muted-foreground)' }}>{despesas.length} lançamento{despesas.length !== 1 ? 's' : ''}</p>
                        </div>
                        {totalPorCategoria.slice(0, 2).map(([cat, val]) => (
                            <div key={cat} className="rounded-2xl border p-4 shadow-sm" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface, white)' }}>
                                <p className="text-xs mb-1 truncate" style={{ color: 'var(--color-muted-foreground)' }}>{cat}</p>
                                <p className="text-lg font-bold font-data" style={{ color: getCatColor(cat) }}>{BRL(val)}</p>
                                <p className="text-xs mt-1" style={{ color: 'var(--color-muted-foreground)' }}>
                                    {totalPeriodo > 0 ? ((val / totalPeriodo) * 100).toFixed(1) : 0}% do total
                                </p>
                            </div>
                        ))}
                    </div>

                    {/* Resumo por categoria */}
                    {totalPorCategoria.length > 0 && (
                        <div className="rounded-2xl border p-4 shadow-sm mb-5" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface, white)' }}>
                            <p className="text-xs font-semibold mb-4" style={{ color: 'var(--color-text-secondary)' }}>
                                Resumo de Gastos por Categoria
                            </p>
                            <div className="space-y-3">
                                {totalPorCategoria.map(([cat, val]) => {
                                    const pct = totalPeriodo > 0 ? (val / totalPeriodo) * 100 : 0;
                                    const color = getCatColor(cat);
                                    return (
                                        <div key={cat}>
                                            <div className="flex justify-between items-center text-xs mb-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                                                    <span className="font-medium" style={{ color: 'var(--color-text-primary)' }}>{cat}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-data font-semibold" style={{ color }}>{BRL(val)}</span>
                                                    <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ backgroundColor: color + '20', color }}>
                                                        {pct.toFixed(1)}%
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden">
                                                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Tabela */}
                    {loading ? (
                        <div className="flex justify-center py-16">
                            <div className="animate-spin h-7 w-7 rounded-full border-4" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
                        </div>
                    ) : despesas.length === 0 ? (
                        <div className="rounded-2xl border p-16 flex flex-col items-center justify-center gap-3" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface, white)' }}>
                            <Icon name="ShoppingCart" size={40} color="var(--color-muted-foreground)" />
                            <p className="text-base font-medium" style={{ color: 'var(--color-muted-foreground)' }}>Nenhuma despesa administrativa registrada</p>
                            {admin && (
                                <button onClick={() => setModal({ mode: 'create' })}
                                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white"
                                    style={{ backgroundColor: '#059669' }}>
                                    <Icon name="Plus" size={14} color="white" /> Registrar primeira despesa
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="rounded-2xl border shadow-sm overflow-x-auto" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface, white)' }}>
                            <table className="w-full text-sm min-w-[760px]">
                                <thead className="text-xs border-b" style={{ backgroundColor: 'var(--color-muted)', borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                                    <tr>{['Data', 'Categoria', 'Empresa / Fornecedor', 'Descrição', 'NF', 'Pagamento', 'Valor', ''].map(h => (
                                        <th key={h} className="px-3 py-3 text-left font-medium whitespace-nowrap">{h}</th>
                                    ))}</tr>
                                </thead>
                                <tbody>
                                    {despesas.map((d, i) => (
                                        <tr key={d.id} className="border-t hover:bg-gray-50 transition-colors" style={{ borderColor: 'var(--color-border)', backgroundColor: i % 2 === 0 ? 'transparent' : 'var(--color-muted, #F8FAFC)' }}>
                                            <td className="px-3 py-3 whitespace-nowrap text-xs" style={{ color: 'var(--color-muted-foreground)' }}>{FMT(d.data_despesa)}</td>
                                            <td className="px-3 py-3">
                                                <span className="px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap"
                                                    style={{ backgroundColor: getCatColor(d.categoria) + '20', color: getCatColor(d.categoria) }}>
                                                    {d.categoria}
                                                </span>
                                            </td>
                                            <td className="px-3 py-3 text-xs max-w-[150px]">
                                                {d.empresa && <p className="font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>{d.empresa}</p>}
                                                {d.fornecedor && <p className="truncate" style={{ color: 'var(--color-muted-foreground)' }}>{d.fornecedor}</p>}
                                                {!d.empresa && !d.fornecedor && <span style={{ color: 'var(--color-muted-foreground)' }}>—</span>}
                                            </td>
                                            <td className="px-3 py-3 text-xs max-w-[160px] truncate" style={{ color: 'var(--color-muted-foreground)' }}>{d.descricao || '—'}</td>
                                            <td className="px-3 py-3 text-xs font-data" style={{ color: 'var(--color-muted-foreground)' }}>{d.nota_fiscal || '—'}</td>
                                            <td className="px-3 py-3">
                                                <div className="flex flex-col gap-0.5">
                                                    <PgBadge d={d} />
                                                    <BoletosPendentes despesa={d} />
                                                </div>
                                            </td>
                                            <td className="px-3 py-3 font-data font-bold whitespace-nowrap" style={{ color: '#DC2626' }}>{BRL(d.valor)}</td>
                                            <td className="px-3 py-3">
                                                <div className="flex items-center gap-1">
                                                    {((d.boletos || []).length > 0 || (d.parcelas_cartao || []).length > 0) && (
                                                        <button onClick={() => setModalBaixa(d)} title="Gerenciar pagamentos"
                                                            className="p-1.5 rounded hover:bg-green-50 transition-colors">
                                                            <Icon name="CheckCircle2" size={13} color="#059669" />
                                                        </button>
                                                    )}
                                                    {admin && (
                                                        <>
                                                            <button onClick={() => setModal({ mode: 'edit', data: d })} className="p-1.5 rounded hover:bg-blue-50 transition-colors">
                                                                <Icon name="Pencil" size={13} color="#1D4ED8" />
                                                            </button>
                                                            <button onClick={() => handleDelete(d.id)} className="p-1.5 rounded hover:bg-red-50 transition-colors">
                                                                <Icon name="Trash2" size={13} color="#DC2626" />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="border-t-2" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-muted)' }}>
                                    <tr>
                                        <td colSpan={6} className="px-3 py-3 text-xs font-semibold text-right" style={{ color: 'var(--color-text-secondary)' }}>Total</td>
                                        <td className="px-3 py-3 font-data font-bold text-red-600 text-base">{BRL(totalPeriodo)}</td>
                                        <td />
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}
                </div>
            </main>

            {modal && (
                <ModalDespesa modal={modal} onClose={() => setModal(null)} onSaved={load} />
            )}
            {modalBaixa && (
                <ModalBaixa
                    despesa={modalBaixa}
                    onClose={() => setModalBaixa(null)}
                    onBaixado={() => { load(); setModalBaixa(null); }}
                    isAdmin={admin}
                />
            )}

            <Toast toast={toast} />
            {ConfirmDialog}
        </div>
    );
}
