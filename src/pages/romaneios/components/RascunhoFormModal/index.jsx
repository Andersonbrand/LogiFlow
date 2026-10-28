import React, { useState, useEffect } from 'react';

import { calcularFretePedidoMulti, FRETE_CATEGORIAS } from 'config/freteConfig';
import { AppIcon as Icon } from 'components';

import { brl } from '../../utils/helpers';
import TabDados from './components/TabDados';
import TabPedidos from './components/TabPedidos';
import TabIa from './components/TabIa';

// ═══════════════════════════════════════════════════════════════════════════════
// MODAL DE RASCUNHO
// ═══════════════════════════════════════════════════════════════════════════════
export default function RascunhoFormModal({ rascunho, vehicles, materials, motoristasComId, onClose, onSave }) {
    const isEdit = !!rascunho;

    const EMPTY_FORM    = { motorista: '', motorista_id: '', placa: '', vehicle_id: '', destino: '', saida: '', observacoes: '' };
    const EMPTY_PEDIDO  = () => ({ numero_pedido: '', empresa: 'Comercial Araguaia', valor_pedido: '', categoria_frete: 'Ferragens', categorias_extra: [], cidade_destino: '', nome_cliente: '', nome_vendedor: '', itens: [] });
    const EMPTY_ITEM    = () => ({ material_id: '', quantidade: '1', peso_unit: '', peso_total: '', is_telha_zinco: false, comprimento_telha: '', metros_totais: '' });

    const [form, setForm]       = useState(EMPTY_FORM);
    const [pedidos, setPedidos] = useState([EMPTY_PEDIDO()]);
    const [tab, setTab]         = useState('dados');
    const [saving, setSaving]   = useState(false);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiSugestao, setAiSugestao] = useState('');
    const [buscaPedido, setBuscaPedido] = useState('');
    const [openPedidos, setOpenPedidos] = useState(() => new Set([0]));
    const togglePedido = idx => setOpenPedidos(s => {
        const n = new Set(s);
        n.has(idx) ? n.delete(idx) : n.add(idx);
        return n;
    });

    useEffect(() => {
        if (rascunho) {
            setForm({ motorista: rascunho.motorista || '', motorista_id: rascunho.motorista_id || '', placa: rascunho.placa || '', vehicle_id: rascunho.vehicle_id || '', destino: rascunho.destino || '', saida: rascunho.saida || '', observacoes: rascunho.observacoes || '' });
            const peds = rascunho.romaneio_pedidos || [];
            setPedidos(peds.length > 0 ? peds.map(p => ({
                numero_pedido: p.numero_pedido || '', empresa: p.empresa || 'Comercial Araguaia',
                valor_pedido: String(p.valor_pedido || ''), categoria_frete: p.categoria_frete || 'Ferragens',
                categorias_extra: Array.isArray(p.categorias_extra) ? p.categorias_extra : [],
                cidade_destino: p.cidade_destino || '',
                nome_cliente: p.nome_cliente || '', nome_vendedor: p.nome_vendedor || '',
                itens: (rascunho.romaneio_itens || []).filter(i => i.pedido_id === p.id).map(i => ({
                    material_id: i.material_id || '', quantidade: String(i.quantidade || 1),
                    peso_unit: i.materials?.peso ? String(i.materials.peso) : '',
                    peso_total: i.peso_total != null ? String(i.peso_total) : '',
                    is_telha_zinco: i.is_telha_zinco || i.materials?.is_telha_zinco || false,
                    comprimento_telha: i.comprimento_telha != null ? String(i.comprimento_telha) : '',
                    metros_totais: i.metros_totais != null ? String(i.metros_totais) : '',
                })),
            })) : [EMPTY_PEDIDO()]);
            setAiSugestao(rascunho.sugestao_veiculo || '');
        } else {
            setForm(EMPTY_FORM); setPedidos([EMPTY_PEDIDO()]); setAiSugestao('');
        }
        setTab('dados');
        setBuscaPedido('');
        setOpenPedidos(new Set([0]));
    }, [rascunho]); // eslint-disable-line

    const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const updPedido = (idx, patch) => setPedidos(p => p.map((x, i) => i === idx ? { ...x, ...patch } : x));
    // Categorias extras — permite mais de uma categoria de material (com percentuais
    // diferentes) dentro do mesmo pedido, igual ao romaneio já publicado.
    const addCategoriaExtra = idx => setPedidos(p => p.map((x, i) => i !== idx ? x : {
        ...x, categorias_extra: [...(x.categorias_extra || []), { categoria: 'Outros', valor: '' }],
    }));
    const updCategoriaExtra = (idx, eIdx, patch) => setPedidos(p => p.map((x, i) => i !== idx ? x : {
        ...x, categorias_extra: (x.categorias_extra || []).map((e, j) => j !== eIdx ? e : { ...e, ...patch }),
    }));
    const delCategoriaExtra = (idx, eIdx) => setPedidos(p => p.map((x, i) => i !== idx ? x : {
        ...x, categorias_extra: (x.categorias_extra || []).filter((_, j) => j !== eIdx),
    }));
    const addPedido = () => {
        setPedidos(p => {
            setOpenPedidos(s => new Set([...s, p.length]));
            return [...p, EMPTY_PEDIDO()];
        });
    };
    const delPedido = idx => {
        setPedidos(p => p.filter((_, i) => i !== idx));
        setOpenPedidos(s => new Set([...s].filter(i => i !== idx).map(i => i > idx ? i - 1 : i)));
    };

    // useRef garante que materials sempre aponta para a versão mais recente
    // sem criar stale closure (o problema que causava peso_total não calcular)
    const materialsRef = React.useRef(materials);
    React.useEffect(() => { materialsRef.current = materials; }, [materials]);

    const updItem = (pIdx, iIdx, patch) => setPedidos(p => p.map((ped, pi) => {
        if (pi !== pIdx) return ped;
        const mats = materialsRef.current || [];
        const newItens = ped.itens.map((it, ii) => {
            if (ii !== iIdx) return it;
            const merged = { ...it, ...patch };

            // Se material mudou: detecta telha de zinco e (re)inicializa campos
            if (patch.material_id !== undefined) {
                const mat = mats.find(m => String(m.id) === String(patch.material_id));
                merged.is_telha_zinco = !!mat?.is_telha_zinco;
                if (merged.is_telha_zinco) {
                    // Telha: quantidade = nº de peças, calculada a partir de metros totais
                    // ÷ comprimento de cada peça — mesma lógica usada em Romaneios.
                    merged.comprimento_telha = merged.comprimento_telha || '';
                    merged.metros_totais     = merged.metros_totais || '';
                    merged.peso_unit  = '';
                    merged.quantidade = merged.quantidade || '';
                    merged.peso_total = '';
                } else {
                    merged.is_telha_zinco = false;
                    merged.comprimento_telha = '';
                    merged.metros_totais = '';
                    if (mat?.peso) {
                        merged.peso_unit  = String(mat.peso);
                        merged.peso_total = String(Math.round(Number(mat.peso) * Number(merged.quantidade || 1) * 1000) / 1000);
                    } else {
                        merged.peso_unit  = '';
                        if (!merged._manualPeso) merged.peso_total = '';
                    }
                }
            }

            if (merged.is_telha_zinco) {
                // Recalcula sempre que comprimento ou metros totais mudarem
                const mat = mats.find(m => String(m.id) === String(merged.material_id));
                const pesoBaseMetro = Number(mat?.peso_base_metro) || Number(mat?.peso) || 3.80;
                const comp = Number(merged.comprimento_telha) || 0;
                const metros = Number(merged.metros_totais) || 0;
                if (comp > 0) {
                    const pesoUnit = pesoBaseMetro * comp;
                    merged.peso_unit = String(Math.round(pesoUnit * 1000) / 1000);
                    if (metros > 0) {
                        const qtdTelhas = Math.round(metros / comp);
                        merged.quantidade = String(qtdTelhas);
                        merged.peso_total = String(Math.round(qtdTelhas * pesoUnit * 1000) / 1000);
                    } else {
                        merged.quantidade = '';
                        merged.peso_total = '';
                    }
                } else {
                    merged.peso_unit  = '';
                    merged.quantidade = '';
                    merged.peso_total = '';
                }
                return merged;
            }

            // Se quantidade mudou e temos peso_unit: recalcula (se não editado manualmente)
            if (patch.quantidade !== undefined && merged.peso_unit && !merged._manualPeso) {
                merged.peso_total = String(Math.round(Number(merged.peso_unit) * Number(merged.quantidade || 1) * 1000) / 1000);
            }
            // Garante que peso_total nunca fique '' se temos peso_unit e quantidade
            if (!merged._manualPeso && merged.peso_unit && merged.quantidade && merged.peso_total === '') {
                merged.peso_total = String(Math.round(Number(merged.peso_unit) * Number(merged.quantidade) * 1000) / 1000);
            }
            return merged;
        });
        return { ...ped, itens: newItens };
    }));
    const addItem = pIdx => setPedidos(p => p.map((ped, pi) => pi === pIdx ? { ...ped, itens: [...ped.itens, EMPTY_ITEM()] } : ped));
    const delItem = (pIdx, iIdx) => setPedidos(p => p.map((ped, pi) => pi === pIdx ? { ...ped, itens: ped.itens.filter((_, ii) => ii !== iIdx) } : ped));

    const totais = React.useMemo(() => {
        const valorCarga  = pedidos.reduce((s, p) => s + Number(p.valor_pedido || 0), 0);
        const frete       = pedidos.reduce((s, p) => s + calcularFretePedidoMulti(p).total, 0);
        const peso = pedidos.flatMap(p => p.itens).reduce((s, i) => {
            // Usa peso_total do state; se vazio, calcula na hora com peso_unit × quantidade
            const pt = i.peso_total !== '' && i.peso_total != null
                ? Number(i.peso_total)
                : (i.peso_unit && i.quantidade ? Number(i.peso_unit) * Number(i.quantidade) : 0);
            return s + pt;
        }, 0);
        return { valorCarga, frete, peso };
    }, [pedidos]);

    // Sugestão de veículo — lógica local gratuita (sem API paga)
    // Analisa capacidade dos veículos disponíveis vs peso total da carga
    const sugerirVeiculo = async () => {
        setAiLoading(true);
        await new Promise(r => setTimeout(r, 600)); // simula "pensando"
        try {
            const disponiveis = (vehicles || []).filter(v =>
                v.status !== 'Em Manutenção' && v.status !== 'Inativo'
            );

            if (disponiveis.length === 0) {
                setAiSugestao('Nenhum veículo disponível no momento. Verifique o cadastro de veículos.');
                return;
            }

            const peso = totais.peso;
            const frete = totais.frete;
            const nPedidos = pedidos.filter(p => p.numero_pedido).length;

            // Função para extrair capacidade do veículo
            const getCap = v => Number(v.capacidade_peso || v.capacidade_carga || v.tara || 0);

            // Ordena: primeiro os que cabem a carga (cap >= peso), depois os maiores
            const ordenados = [...disponiveis].sort((a, b) => {
                const capA = getCap(a), capB = getCap(b);
                const aFit = capA >= peso, bFit = capB >= peso;
                if (aFit && !bFit) return -1;
                if (!aFit && bFit) return 1;
                // Ambos cabem: prefere o menor (mais eficiente)
                if (aFit && bFit) return capA - capB;
                // Nenhum cabe: prefere o maior
                return capB - capA;
            });

            const melhor = ordenados[0];
            const cap = getCap(melhor);
            const ocup = cap > 0 ? Math.round((peso / cap) * 100) : null;
            const status = melhor.status || 'Disponível';

            let linhas = [];

            // Veículo recomendado
            linhas.push(`✅ Veículo recomendado: ${melhor.placa}${melhor.modelo ? ` — ${melhor.modelo}` : ''} (${status})`);

            if (cap > 0) {
                if (peso > 0) {
                    linhas.push(`📦 Carga: ${peso.toLocaleString('pt-BR')} kg de ${cap.toLocaleString('pt-BR')} kg de capacidade (${ocup}% de ocupação)`);
                    if (ocup >= 95) linhas.push('⚠️  Carga próxima do limite — verifique o peso com o motorista antes de carregar.');
                    else if (ocup >= 70) linhas.push('✔️  Ocupação boa. Veículo bem aproveitado para esta viagem.');
                    else if (ocup < 40) linhas.push('ℹ️  Baixa ocupação. Considere consolidar com outra carga para reduzir custo por kg.');
                } else {
                    linhas.push('ℹ️  Peso não informado — adicione materiais para calcular a ocupação.');
                }
            }

            if (frete > 0) linhas.push(`💰 Frete estimado: ${brl(frete)}`);
            if (nPedidos > 0) linhas.push(`📋 ${nPedidos} pedido${nPedidos > 1 ? 's' : ''} vinculado${nPedidos > 1 ? 's' : ''} a esta carga.`);

            // Alternativas
            const alternativas = ordenados.slice(1, 3).filter(v => getCap(v) >= peso);
            if (alternativas.length > 0) {
                linhas.push('');
                linhas.push('🔄 Alternativas disponíveis:');
                alternativas.forEach(v => {
                    const c = getCap(v);
                    const o = c > 0 && peso > 0 ? ` — ${Math.round((peso/c)*100)}% ocupação` : '';
                    linhas.push(`  • ${v.placa}${v.modelo ? ` (${v.modelo})` : ''}${o}`);
                });
            }

            // Alerta se nenhum veículo cabe a carga
            if (peso > 0 && cap > 0 && cap < peso) {
                linhas.push('');
                linhas.push(`⚠️  Atenção: nenhum veículo disponível tem capacidade suficiente para ${peso.toLocaleString('pt-BR')} kg. Verifique o cadastro ou divida a carga.`);
            }

            setAiSugestao(linhas.join('\n'));
        } catch (e) {
            setAiSugestao('Erro ao gerar sugestão: ' + (e.message || String(e)));
        } finally { setAiLoading(false); }
    };

    const handleSave = async () => {
        if (!form.destino.trim()) { alert('Destino é obrigatório'); setTab('dados'); return; }
        setSaving(true);
        try {
            const allItens = pedidos.flatMap((ped, pIdx) =>
                ped.itens.filter(i => i.material_id).map(i => ({
                    material_id: i.material_id, quantidade: Number(i.quantidade) || 1,
                    peso_total: i.peso_total ? Number(i.peso_total) : null,
                    pedido_index: pIdx,
                }))
            );
            await onSave({
                ...form,
                peso_total:            totais.peso      || null,
                valor_frete:           totais.frete     || null,
                valor_frete_calculado: totais.frete     || null,
                valor_total_carga:     totais.valorCarga || null,
                sugestao_veiculo:      aiSugestao       || null,
                _pedidos: pedidos.filter(p => p.numero_pedido || p.valor_pedido).map(p => ({
                    numero_pedido:   p.numero_pedido || '',
                    cidade_destino:  p.cidade_destino || form.destino,
                    valor_pedido:    Number(p.valor_pedido || 0),
                    categoria_frete: p.categoria_frete || 'Outros',
                    categorias_extra: (p.categorias_extra || []).filter(e => Number(e.valor) > 0).map(e => ({ categoria: e.categoria, valor: Number(e.valor) })),
                    empresa:         p.empresa || '',
                    nome_cliente:    (p.nome_cliente || '').trim(),
                    nome_vendedor:   (p.nome_vendedor || '').trim(),
                    percentual_frete: (FRETE_CATEGORIAS || []).find(f => f.categoria === p.categoria_frete)?.percentual || 0,
                    frete_calculado:  calcularFretePedidoMulti(p).total,
                })),
            }, allItens);
        } finally { setSaving(false); }
    };

    const inputCls   = 'w-full px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 transition-all';
    const inputStyle = { borderColor: 'var(--color-border)', color: 'var(--color-text-primary)', backgroundColor: '#ffffff' };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)' }}>
            <div className="bg-white rounded-2xl shadow-2xl flex flex-col w-full max-w-3xl" style={{ maxHeight: 'calc(100vh - 32px)', backgroundColor: '#ffffff' }}>

                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0" style={{ borderColor: 'var(--color-border)' }}>
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#FFFBEB' }}>
                            <Icon name="ClipboardList" size={18} color="#D97706" />
                        </div>
                        <h2 className="font-heading font-bold text-lg" style={{ color: 'var(--color-text-primary)' }}>
                            {isEdit ? 'Editar Rascunho' : 'Novo Rascunho de Romaneio'}
                        </h2>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                        <Icon name="X" size={18} color="var(--color-muted-foreground)" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b flex-shrink-0 px-5 pt-3 gap-1" style={{ borderColor: 'var(--color-border)' }}>
                    {[
                        { id: 'dados',   label: 'Identificação',               icon: 'FileText'    },
                        { id: 'pedidos', label: `Pedidos (${pedidos.length})`, icon: 'ShoppingCart' },
                        { id: 'ia',      label: 'Sugestão Veículo',            icon: 'Truck'       },
                    ].map(t => (
                        <button key={t.id} onClick={() => setTab(t.id)}
                            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors"
                            style={tab === t.id ? { borderColor: '#D97706', color: '#D97706' } : { borderColor: 'transparent', color: 'var(--color-muted-foreground)' }}>
                            <Icon name={t.icon} size={13} color={tab === t.id ? '#D97706' : 'var(--color-muted-foreground)'} />
                            {t.label}
                        </button>
                    ))}
                </div>

                {/* Body */}
                <div className="p-5 overflow-y-auto flex-1 space-y-4">

                    {/* ── ABA: Identificação ── */}
                    {tab === 'dados' && (
                        <TabDados
                    form={form}
                    inputCls={inputCls}
                    inputStyle={inputStyle}
                    motoristasComId={motoristasComId}
                    setF={setF}
                    vehicles={vehicles}
                />
                    )}

                    {/* ── ABA: Pedidos ── */}
                    {tab === 'pedidos' && (
                        <TabPedidos
                    addCategoriaExtra={addCategoriaExtra}
                    addItem={addItem}
                    addPedido={addPedido}
                    buscaPedido={buscaPedido}
                    delCategoriaExtra={delCategoriaExtra}
                    delItem={delItem}
                    delPedido={delPedido}
                    form={form}
                    inputCls={inputCls}
                    inputStyle={inputStyle}
                    materials={materials}
                    openPedidos={openPedidos}
                    pedidos={pedidos}
                    setBuscaPedido={setBuscaPedido}
                    togglePedido={togglePedido}
                    totais={totais}
                    updCategoriaExtra={updCategoriaExtra}
                    updItem={updItem}
                    updPedido={updPedido}
                />
                    )}

                    {/* ── ABA: Sugestão IA ── */}
                    {tab === 'ia' && (
                        <TabIa aiLoading={aiLoading} aiSugestao={aiSugestao} pedidos={pedidos} sugerirVeiculo={sugerirVeiculo} totais={totais} />
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-5 py-4 border-t flex-shrink-0" style={{ borderColor: 'var(--color-border)' }}>
                    <button onClick={onClose} className="px-4 py-2 rounded-xl border text-sm font-medium" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>
                        Cancelar
                    </button>
                    <button onClick={handleSave} disabled={saving}
                        className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-60"
                        style={{ backgroundColor: '#D97706' }}>
                        {saving
                            ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Salvando...</>
                            : <><Icon name="Save" size={14} color="white" /> {isEdit ? 'Salvar Alterações' : 'Criar Rascunho'}</>}
                    </button>
                </div>
            </div>
        </div>
    );
}
