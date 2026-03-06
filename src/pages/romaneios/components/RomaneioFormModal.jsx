import React, { useState, useEffect, useMemo } from 'react';
import Icon from 'components/AppIcon';
import Button from 'components/ui/Button';
import Autocomplete from 'components/ui/Autocomplete';
import { fetchMotoristas, fetchDestinos } from 'utils/romaneioService';
import { FRETE_CATEGORIAS, detectarCategoriaFrete, calcularFretePedido, getCategoriaConfig, fmtPct } from 'utils/freteConfig';

const STATUS_OPTIONS = ['Aguardando', 'Carregando', 'Em Trânsito', 'Finalizado', 'Cancelado'];
const brl = v => Number(v||0).toLocaleString('pt-BR', { style:'currency', currency:'BRL' });
const n   = v => Number(v||0);

const EMPTY_FORM = {
    motorista:'', placa:'', destino:'', status:'Aguardando', saida:'', observacoes:'',
    vehicle_id:'', distancia_km:'', custo_combustivel:'', custo_pedagio:'', custo_motorista:'',
};
const EMPTY_PEDIDO = { numero_pedido:'', valor_pedido:'', categoria_frete:'Ferragens', itens:[] };

export default function RomaneioFormModal({ isOpen, onClose, onSave, editingRomaneio, vehicles=[], materials=[] }) {
    const [form, setForm]           = useState(EMPTY_FORM);
    const [pedidos, setPedidos]     = useState([]);           // array de pedidos com seus itens
    const [tab, setTab]             = useState('dados');       // dados | pedidos | financeiro
    const [errors, setErrors]       = useState({});
    const [loading, setLoading]     = useState(false);
    const [motoristas, setMotoristas] = useState([]);
    const [destinos, setDestinos]   = useState([]);

    // Novo pedido sendo montado
    const [novoPedido, setNovoPedido]   = useState(EMPTY_PEDIDO);
    const [novoItem, setNovoItem]       = useState({ material_id:'', quantidade:1 });
    const [expandedPedido, setExpanded] = useState(null); // índice do pedido expandido

    useEffect(() => {
        fetchMotoristas().then(setMotoristas);
        fetchDestinos().then(setDestinos);
    }, []);

    useEffect(() => {
        if (!isOpen) return;
        if (editingRomaneio) {
            setForm({
                motorista:         editingRomaneio.motorista         || '',
                placa:             editingRomaneio.placa             || '',
                destino:           editingRomaneio.destino           || '',
                status:            editingRomaneio.status            || 'Aguardando',
                saida:             editingRomaneio.saida ? editingRomaneio.saida.slice(0,16) : '',
                observacoes:       editingRomaneio.observacoes       || '',
                vehicle_id:        editingRomaneio.vehicle_id        || '',
                distancia_km:      editingRomaneio.distancia_km      || '',
                custo_combustivel: editingRomaneio.custo_combustivel || '',
                custo_pedagio:     editingRomaneio.custo_pedagio     || '',
                custo_motorista:   editingRomaneio.custo_motorista   || '',
            });
            // Rebuild pedidos from romaneio_pedidos if editing
            const pedidosExistentes = editingRomaneio.romaneio_pedidos || [];
            if (pedidosExistentes.length > 0) {
                setPedidos(pedidosExistentes.map(p => ({
                    id: p.id,
                    numero_pedido:   p.numero_pedido,
                    valor_pedido:    String(p.valor_pedido || ''),
                    categoria_frete: p.categoria_frete || 'Ferragens',
                    itens: (editingRomaneio.romaneio_itens || [])
                        .filter(i => i.pedido_id === p.id)
                        .map(i => ({
                            material_id: i.material_id, quantidade: i.quantidade,
                            peso_total: i.peso_total,
                            nome: i.materials?.nome || '', unidade: i.materials?.unidade || '',
                            peso_unit: i.materials?.peso || 0,
                        })),
                })));
            } else {
                // Legacy: no pedidos — show items as one default pedido
                const itensHerdados = (editingRomaneio.romaneio_itens || []).map(i => ({
                    material_id: i.material_id, quantidade: i.quantidade, peso_total: i.peso_total,
                    nome: i.materials?.nome || '', unidade: i.materials?.unidade || '',
                    peso_unit: i.materials?.peso || 0,
                }));
                setPedidos(itensHerdados.length > 0 ? [{
                    numero_pedido:'', valor_pedido:'', categoria_frete:'Ferragens', itens: itensHerdados
                }] : []);
            }
        } else {
            setForm(EMPTY_FORM);
            setPedidos([]);
        }
        setNovoPedido(EMPTY_PEDIDO);
        setNovoItem({ material_id:'', quantidade:1 });
        setErrors({});
        setTab('dados');
        setExpanded(null);
    }, [isOpen, editingRomaneio]);

    const setF = (k, v) => {
        setForm(prev => {
            const next = { ...prev, [k]: v };
            if (k === 'vehicle_id') {
                const veh = vehicles.find(v2 => String(v2.id) === v);
                if (veh) next.placa = veh.placa;
            }
            return next;
        });
        setErrors(prev => ({ ...prev, [k]:'' }));
    };

    // ── Pedido helpers ──────────────────────────────────────────
    const addItemToPedido = (pedidoIdx) => {
        if (!novoItem.material_id) return;
        const mat = materials.find(m => String(m.id) === String(novoItem.material_id));
        if (!mat) return;
        const qty = Number(novoItem.quantidade) || 1;
        setPedidos(prev => prev.map((p, i) => {
            if (i !== pedidoIdx) return p;
            const existing = p.itens.findIndex(it => String(it.material_id) === String(mat.id));
            if (existing >= 0) {
                const newItens = p.itens.map((it, j) => j === existing
                    ? { ...it, quantidade: it.quantidade + qty, peso_total: (it.quantidade + qty) * it.peso_unit }
                    : it);
                return { ...p, itens: newItens };
            }
            // Auto-detect categoria_frete from material
            const catFrete = mat.categoria_frete || detectarCategoriaFrete(mat.nome);
            return { ...p,
                categoria_frete: p.categoria_frete || catFrete,
                itens: [...p.itens, {
                    material_id: mat.id, quantidade: qty,
                    peso_total: qty * mat.peso, nome: mat.nome,
                    unidade: mat.unidade, peso_unit: mat.peso,
                }]
            };
        }));
        setNovoItem({ material_id:'', quantidade:1 });
    };

    const removeItemFromPedido = (pedidoIdx, itemIdx) => {
        setPedidos(prev => prev.map((p, i) =>
            i !== pedidoIdx ? p : { ...p, itens: p.itens.filter((_, j) => j !== itemIdx) }
        ));
    };

    const addPedido = () => {
        setPedidos(prev => [...prev, { ...EMPTY_PEDIDO, itens:[] }]);
        setExpanded(pedidos.length);
    };

    const removePedido = (idx) => {
        setPedidos(prev => prev.filter((_, i) => i !== idx));
        setExpanded(null);
    };

    const updatePedidoField = (idx, k, v) => {
        setPedidos(prev => prev.map((p, i) => i !== idx ? p : { ...p, [k]: v }));
    };

    // ── Totais calculados ──────────────────────────────────────
    const totais = useMemo(() => {
        const valorTotalCarga    = pedidos.reduce((a, p) => a + n(p.valor_pedido), 0);
        const freteCalculado     = pedidos.reduce((a, p) => {
            const pct = FRETE_CATEGORIAS.find(f => f.categoria === p.categoria_frete)?.percentual || 0.05;
            return a + n(p.valor_pedido) * pct;
        }, 0);
        const pesoTotal          = pedidos.flatMap(p => p.itens).reduce((a, i) => a + n(i.peso_total), 0);
        const totalItens         = pedidos.flatMap(p => p.itens).length;
        const custoOperacional   = n(form.custo_combustivel) + n(form.custo_pedagio) + n(form.custo_motorista);
        const margem             = freteCalculado - custoOperacional;
        return { valorTotalCarga, freteCalculado, pesoTotal, totalItens, custoOperacional, margem };
    }, [pedidos, form.custo_combustivel, form.custo_pedagio, form.custo_motorista]);

    // ── Breakdown do frete por categoria ──────────────────────
    const freteBreakdown = useMemo(() => {
        const map = {};
        pedidos.forEach(p => {
            const pct = FRETE_CATEGORIAS.find(f => f.categoria === p.categoria_frete)?.percentual || 0.05;
            const frete = n(p.valor_pedido) * pct;
            if (!map[p.categoria_frete]) map[p.categoria_frete] = { valor:0, pedidos:0 };
            map[p.categoria_frete].valor += frete;
            map[p.categoria_frete].pedidos++;
        });
        return Object.entries(map).map(([cat, d]) => ({ cat, ...d, cfg: getCategoriaConfig(cat) }));
    }, [pedidos]);

    // ── Validação e submit ─────────────────────────────────────
    const validate = () => {
        const e = {};
        if (!form.motorista.trim()) e.motorista = 'Motorista é obrigatório';
        if (!form.destino.trim())   e.destino   = 'Destino é obrigatório';
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleSubmit = async () => {
        if (!validate()) { setTab('dados'); return; }
        setLoading(true);
        try {
            // Flatten all itens across all pedidos
            const allItens = pedidos.flatMap((p, pIdx) =>
                p.itens.map(i => ({
                    material_id:    i.material_id,
                    quantidade:     i.quantidade,
                    peso_total:     i.peso_total,
                    pedido_index:   pIdx, // used to link to pedido in service
                }))
            );
            await onSave({
                ...form,
                peso_total:             totais.pesoTotal,
                vehicle_id:             form.vehicle_id || null,
                distancia_km:           n(form.distancia_km),
                custo_combustivel:      n(form.custo_combustivel),
                custo_pedagio:          n(form.custo_pedagio),
                custo_motorista:        n(form.custo_motorista),
                valor_frete:            totais.freteCalculado,   // frete calculado pelos pedidos
                valor_frete_calculado:  totais.freteCalculado,
                valor_total_carga:      totais.valorTotalCarga,
                _pedidos: pedidos.map(p => ({
                    numero_pedido:   p.numero_pedido || '',
                    valor_pedido:    n(p.valor_pedido),
                    categoria_frete: p.categoria_frete || 'Outros',
                    percentual_frete: FRETE_CATEGORIAS.find(f => f.categoria === p.categoria_frete)?.percentual || 0.05,
                })),
            }, allItens);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40" onClick={onClose} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor:'var(--color-border)' }}>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center rounded-lg" style={{ width:36, height:36, backgroundColor:'var(--color-primary)' }}>
                            <Icon name="FileText" size={18} color="#fff" />
                        </div>
                        <div>
                            <h2 className="font-heading font-bold text-lg" style={{ color:'var(--color-text-primary)' }}>
                                {editingRomaneio ? 'Editar Romaneio' : 'Novo Romaneio'}
                            </h2>
                            <p className="text-xs font-caption" style={{ color:'var(--color-muted-foreground)' }}>
                                {editingRomaneio?.numero || 'Preencha os dados da viagem'}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100">
                        <Icon name="X" size={18} color="var(--color-muted-foreground)" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b px-6" style={{ borderColor:'var(--color-border)' }}>
                    {[
                        ['dados',      'Dados da Viagem', 'Truck'],
                        ['pedidos',    `Pedidos (${pedidos.length})`, 'ShoppingCart'],
                        ['financeiro', 'Frete & Financeiro', 'DollarSign'],
                    ].map(([key, label, icon]) => (
                        <button key={key} onClick={() => setTab(key)}
                            className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium font-caption border-b-2 transition-colors whitespace-nowrap
                                ${tab === key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                            <Icon name={icon} size={14} color="currentColor" />
                            {label}
                        </button>
                    ))}
                </div>

                {/* Body */}
                <div className="overflow-y-auto flex-1 px-6 py-5">

                    {/* ── TAB: DADOS ──────────────────────────────── */}
                    {tab === 'dados' && (
                        <div className="flex flex-col gap-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <Autocomplete label="Motorista" required name="motorista"
                                    value={form.motorista} onChange={v => setF('motorista', v)}
                                    suggestions={motoristas} placeholder="Nome do motorista" error={errors.motorista} />
                                <Autocomplete label="Destino" required name="destino"
                                    value={form.destino} onChange={v => setF('destino', v)}
                                    suggestions={destinos} placeholder="Cidade, UF" error={errors.destino} />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium font-caption mb-1.5" style={{ color:'var(--color-text-primary)' }}>Veículo</label>
                                    <select value={form.vehicle_id} onChange={e => setF('vehicle_id', e.target.value)}
                                        className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm bg-white">
                                        <option value="">Selecione um veículo</option>
                                        {vehicles.map(v => <option key={v.id} value={v.id}>{v.placa} — {v.tipo}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium font-caption mb-1.5" style={{ color:'var(--color-text-primary)' }}>Placa</label>
                                    <input value={form.placa} onChange={e => setF('placa', e.target.value)} placeholder="ABC-1234"
                                        className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm bg-white font-data uppercase" />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium font-caption mb-1.5" style={{ color:'var(--color-text-primary)' }}>Data/Hora de Saída</label>
                                    <input type="datetime-local" value={form.saida} onChange={e => setF('saida', e.target.value)}
                                        className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm bg-white" />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium font-caption mb-1.5" style={{ color:'var(--color-text-primary)' }}>Status</label>
                                    <select value={form.status} onChange={e => setF('status', e.target.value)}
                                        className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm bg-white">
                                        {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium font-caption mb-1.5" style={{ color:'var(--color-text-primary)' }}>Observações</label>
                                <textarea value={form.observacoes} onChange={e => setF('observacoes', e.target.value)} rows={3}
                                    placeholder="Instruções especiais, restrições..."
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white resize-none" />
                            </div>
                        </div>
                    )}

                    {/* ── TAB: PEDIDOS ────────────────────────────── */}
                    {tab === 'pedidos' && (
                        <div className="flex flex-col gap-4">
                            {pedidos.length === 0 && (
                                <div className="text-center py-8 rounded-xl border-2 border-dashed" style={{ borderColor:'var(--color-border)' }}>
                                    <Icon name="ShoppingCart" size={36} color="var(--color-muted-foreground)" />
                                    <p className="text-sm mt-2 font-caption" style={{ color:'var(--color-muted-foreground)' }}>
                                        Nenhum pedido adicionado
                                    </p>
                                    <p className="text-xs mt-1 font-caption" style={{ color:'var(--color-muted-foreground)' }}>
                                        Adicione pedidos para calcular o frete automaticamente
                                    </p>
                                </div>
                            )}

                            {pedidos.map((pedido, pIdx) => {
                                const pedidoFrete = calcularFretePedido(pedido.valor_pedido, pedido.categoria_frete);
                                const cfg = getCategoriaConfig(pedido.categoria_frete);
                                const isExpanded = expandedPedido === pIdx;
                                const pesoPedido = pedido.itens.reduce((a, i) => a + n(i.peso_total), 0);
                                return (
                                    <div key={pIdx} className="rounded-xl border overflow-hidden"
                                        style={{ borderColor: isExpanded ? cfg.cor : 'var(--color-border)' }}>
                                        {/* Pedido header */}
                                        <div className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                                            style={{ backgroundColor: isExpanded ? cfg.bg : 'var(--color-muted)' }}
                                            onClick={() => setExpanded(isExpanded ? null : pIdx)}>
                                            <div className="flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold text-white"
                                                style={{ backgroundColor: cfg.cor }}>
                                                {pIdx + 1}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="text-sm font-medium font-caption" style={{ color:'var(--color-text-primary)' }}>
                                                        {pedido.numero_pedido ? `Pedido ${pedido.numero_pedido}` : `Pedido ${pIdx + 1}`}
                                                    </span>
                                                    <span className="text-xs px-2 py-0.5 rounded-full font-caption"
                                                        style={{ backgroundColor: cfg.bg, color: cfg.cor }}>
                                                        {pedido.categoria_frete}
                                                    </span>
                                                    <span className="text-xs font-caption" style={{ color:'var(--color-muted-foreground)' }}>
                                                        {pedido.itens.length} item(s) · {pesoPedido.toLocaleString('pt-BR', { maximumFractionDigits:0 })} kg
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-3 mt-0.5">
                                                    <span className="text-xs font-data" style={{ color:'var(--color-muted-foreground)' }}>
                                                        Valor: {brl(pedido.valor_pedido)}
                                                    </span>
                                                    <span className="text-xs font-data font-semibold" style={{ color: cfg.cor }}>
                                                        Frete: {brl(pedidoFrete)} ({fmtPct(FRETE_CATEGORIAS.find(f=>f.categoria===pedido.categoria_frete)?.percentual||0)})
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1 flex-shrink-0">
                                                <button onClick={e => { e.stopPropagation(); removePedido(pIdx); }}
                                                    className="p-1.5 rounded-lg hover:bg-red-100 transition-colors">
                                                    <Icon name="Trash2" size={14} color="#DC2626" />
                                                </button>
                                                <Icon name={isExpanded ? 'ChevronUp' : 'ChevronDown'} size={16} color="var(--color-muted-foreground)" />
                                            </div>
                                        </div>

                                        {/* Pedido body */}
                                        {isExpanded && (
                                            <div className="px-4 py-4 flex flex-col gap-4 border-t" style={{ borderColor:'var(--color-border)' }}>
                                                {/* Fields row */}
                                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                    <div>
                                                        <label className="block text-xs font-caption mb-1" style={{ color:'var(--color-text-secondary)' }}>Nº do Pedido</label>
                                                        <input value={pedido.numero_pedido}
                                                            onChange={e => updatePedidoField(pIdx,'numero_pedido',e.target.value)}
                                                            placeholder="Ex: 37443"
                                                            className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm bg-white font-data" />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-caption mb-1" style={{ color:'var(--color-text-secondary)' }}>Valor do Pedido (R$)</label>
                                                        <input type="number" min="0" step="0.01" value={pedido.valor_pedido}
                                                            onChange={e => updatePedidoField(pIdx,'valor_pedido',e.target.value)}
                                                            placeholder="0,00"
                                                            className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm bg-white font-data" />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-caption mb-1" style={{ color:'var(--color-text-secondary)' }}>Categoria de Frete</label>
                                                        <select value={pedido.categoria_frete}
                                                            onChange={e => updatePedidoField(pIdx,'categoria_frete',e.target.value)}
                                                            className="w-full h-9 px-2 rounded-lg border border-gray-200 text-xs bg-white">
                                                            {FRETE_CATEGORIAS.map(f => (
                                                                <option key={f.categoria} value={f.categoria}>{f.label} – {fmtPct(f.percentual)}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                </div>

                                                {/* Add material to pedido */}
                                                <div>
                                                    <label className="block text-xs font-caption mb-1.5" style={{ color:'var(--color-text-secondary)' }}>
                                                        Adicionar material a este pedido
                                                    </label>
                                                    <div className="flex gap-2">
                                                        <select value={novoItem.material_id}
                                                            onChange={e => setNovoItem(p => ({...p, material_id:e.target.value}))}
                                                            className="flex-1 h-9 px-3 rounded-lg border border-gray-200 text-xs bg-white">
                                                            <option value="">Selecionar material...</option>
                                                            {materials.map(m => (
                                                                <option key={m.id} value={m.id}>{m.nome} ({m.unidade})</option>
                                                            ))}
                                                        </select>
                                                        <input type="number" min="0.001" step="0.001" value={novoItem.quantidade}
                                                            onChange={e => setNovoItem(p => ({...p, quantidade:e.target.value}))}
                                                            className="w-20 h-9 px-2 rounded-lg border border-gray-200 text-sm font-data text-center bg-white" />
                                                        <button onClick={() => addItemToPedido(pIdx)}
                                                            className="h-9 px-3 rounded-lg text-white text-xs font-medium flex items-center gap-1 transition-colors"
                                                            style={{ backgroundColor:'var(--color-primary)' }}>
                                                            <Icon name="Plus" size={13} color="#fff" />
                                                            Add
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Items table */}
                                                {pedido.itens.length > 0 && (
                                                    <div className="rounded-lg border overflow-hidden" style={{ borderColor:'var(--color-border)' }}>
                                                        <table className="w-full text-xs">
                                                            <thead style={{ backgroundColor:'var(--color-muted)', color:'var(--color-muted-foreground)' }}>
                                                                <tr>
                                                                    <th className="px-3 py-2 text-left font-caption font-medium">Material</th>
                                                                    <th className="px-3 py-2 text-center font-caption font-medium">Qtd</th>
                                                                    <th className="px-3 py-2 text-right font-caption font-medium">Peso Total</th>
                                                                    <th className="px-3 py-2 w-8"></th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {pedido.itens.map((item, iIdx) => (
                                                                    <tr key={iIdx} className="border-t" style={{ borderColor:'var(--color-border)' }}>
                                                                        <td className="px-3 py-2 font-caption">{item.nome}</td>
                                                                        <td className="px-3 py-2 text-center">
                                                                            <input type="number" min="0.001" step="0.001" value={item.quantidade}
                                                                                onChange={e => {
                                                                                    const qty = Number(e.target.value)||0;
                                                                                    setPedidos(prev => prev.map((p, pi) =>
                                                                                        pi !== pIdx ? p : {
                                                                                            ...p, itens: p.itens.map((it, ii) =>
                                                                                                ii !== iIdx ? it : { ...it, quantidade:qty, peso_total:qty*it.peso_unit }
                                                                                            )
                                                                                        }
                                                                                    ));
                                                                                }}
                                                                                className="w-16 text-center px-2 py-1 rounded border border-gray-200 font-data focus:outline-none" />
                                                                        </td>
                                                                        <td className="px-3 py-2 text-right font-data">
                                                                            {n(item.peso_total).toLocaleString('pt-BR',{minimumFractionDigits:2})} kg
                                                                        </td>
                                                                        <td className="px-2 py-2">
                                                                            <button onClick={() => removeItemFromPedido(pIdx, iIdx)}
                                                                                className="p-1 rounded hover:bg-red-50">
                                                                                <Icon name="X" size={12} color="#DC2626" />
                                                                            </button>
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                        <div className="px-3 py-2 border-t flex justify-between text-xs font-data font-semibold"
                                                            style={{ borderColor:'var(--color-border)', color:'var(--color-text-primary)' }}>
                                                            <span>Peso total</span>
                                                            <span>{pesoPedido.toLocaleString('pt-BR',{minimumFractionDigits:2})} kg</span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}

                            <button onClick={addPedido}
                                className="w-full py-3 rounded-xl border-2 border-dashed text-sm font-caption flex items-center justify-center gap-2 transition-colors hover:bg-blue-50 hover:border-blue-400"
                                style={{ borderColor:'var(--color-border)', color:'var(--color-primary)' }}>
                                <Icon name="Plus" size={16} color="currentColor" />
                                Adicionar Pedido
                            </button>

                            {/* Resumo carga */}
                            {pedidos.length > 0 && (
                                <div className="rounded-xl border p-4" style={{ backgroundColor:'var(--color-muted)', borderColor:'var(--color-border)' }}>
                                    <p className="text-xs font-caption font-semibold mb-2" style={{ color:'var(--color-text-secondary)' }}>RESUMO DA CARGA</p>
                                    <div className="grid grid-cols-3 gap-3">
                                        {[
                                            ['Pedidos',       String(pedidos.length),                                    'ShoppingCart'],
                                            ['Peso Total',    totais.pesoTotal.toLocaleString('pt-BR',{maximumFractionDigits:0})+' kg', 'Weight'],
                                            ['Valor da Carga',brl(totais.valorTotalCarga),                               'DollarSign'],
                                        ].map(([label, val, icon]) => (
                                            <div key={label} className="text-center">
                                                <Icon name={icon} size={16} color="var(--color-primary)" className="mx-auto mb-1" />
                                                <p className="text-xs font-caption" style={{ color:'var(--color-muted-foreground)' }}>{label}</p>
                                                <p className="text-sm font-data font-bold" style={{ color:'var(--color-text-primary)' }}>{val}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── TAB: FINANCEIRO ─────────────────────────── */}
                    {tab === 'financeiro' && (
                        <div className="flex flex-col gap-4">
                            {/* Frete calculado */}
                            <div className="rounded-xl border-2 p-4" style={{ borderColor:'#059669', backgroundColor:'#F0FDF4' }}>
                                <div className="flex items-center gap-2 mb-3">
                                    <Icon name="Calculator" size={16} color="#059669" />
                                    <span className="text-sm font-semibold" style={{ color:'#065F46' }}>Frete Calculado Automaticamente</span>
                                </div>
                                {freteBreakdown.length === 0 ? (
                                    <p className="text-xs font-caption" style={{ color:'#065F46' }}>
                                        Adicione pedidos com valor para calcular o frete automaticamente.
                                    </p>
                                ) : (
                                    <div className="space-y-2">
                                        {freteBreakdown.map(({ cat, valor, pedidos: qtd, cfg }) => (
                                            <div key={cat} className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs px-2 py-0.5 rounded font-caption"
                                                        style={{ backgroundColor:cfg.bg, color:cfg.cor }}>
                                                        {cat}
                                                    </span>
                                                    <span className="text-xs font-caption" style={{ color:'var(--color-muted-foreground)' }}>
                                                        {qtd} pedido(s) · {fmtPct(cfg.percentual)}
                                                    </span>
                                                </div>
                                                <span className="text-sm font-data font-semibold" style={{ color:cfg.cor }}>{brl(valor)}</span>
                                            </div>
                                        ))}
                                        <div className="border-t pt-2 flex justify-between items-center" style={{ borderColor:'#BBF7D0' }}>
                                            <span className="text-sm font-semibold" style={{ color:'#065F46' }}>Total Frete</span>
                                            <span className="text-lg font-bold font-data" style={{ color:'#059669' }}>{brl(totais.freteCalculado)}</span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Custo operacional */}
                            <div>
                                <p className="text-xs font-caption font-semibold uppercase tracking-wider mb-3" style={{ color:'var(--color-muted-foreground)' }}>
                                    Custos Operacionais da Viagem
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <MoneyInput label="Distância (km)" name="distancia_km" value={form.distancia_km}
                                        onChange={e => setF(e.target.name, e.target.value)} prefix="km" />
                                    <MoneyInput label="Combustível (R$)" name="custo_combustivel" value={form.custo_combustivel}
                                        onChange={e => setF(e.target.name, e.target.value)} />
                                    <MoneyInput label="Pedágios (R$)" name="custo_pedagio" value={form.custo_pedagio}
                                        onChange={e => setF(e.target.name, e.target.value)} />
                                    <MoneyInput label="Diária Motorista (R$)" name="custo_motorista" value={form.custo_motorista}
                                        onChange={e => setF(e.target.name, e.target.value)} />
                                </div>
                            </div>

                            {/* Resumo final */}
                            <div className="rounded-xl border p-4" style={{ backgroundColor:'var(--color-muted)', borderColor:'var(--color-border)' }}>
                                <p className="text-xs font-caption font-semibold mb-3" style={{ color:'var(--color-muted-foreground)' }}>RESULTADO DA VIAGEM</p>
                                <div className="space-y-2">
                                    <FinRow label="Valor Total da Carga"    value={totais.valorTotalCarga}  icon="Package" />
                                    <FinRow label="(+) Frete Calculado"     value={totais.freteCalculado}   icon="TrendingUp" green />
                                    <FinRow label="(-) Combustível"         value={-n(form.custo_combustivel)} icon="Fuel" />
                                    <FinRow label="(-) Pedágios"            value={-n(form.custo_pedagio)}  icon="Navigation" />
                                    <FinRow label="(-) Motorista"           value={-n(form.custo_motorista)}icon="User" />
                                    <div className="border-t pt-2 flex justify-between items-center" style={{ borderColor:'var(--color-border)' }}>
                                        <span className="font-semibold text-sm" style={{ color:'var(--color-text-primary)' }}>Margem da Viagem</span>
                                        <div className="text-right">
                                            <span className={`text-lg font-bold font-data ${totais.margem >= 0 ? 'text-green-600':'text-red-500'}`}>
                                                {totais.margem >= 0 ? '+':''}{brl(totais.margem)}
                                            </span>
                                            {totais.freteCalculado > 0 && (
                                                <p className={`text-xs font-caption ${totais.margem >= 0 ? 'text-green-600':'text-red-500'}`}>
                                                    {((totais.margem / totais.freteCalculado)*100).toFixed(1)}% sobre o frete
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t flex justify-between items-center gap-2" style={{ borderColor:'var(--color-border)' }}>
                    <div className="flex items-center gap-3">
                        <span className="text-xs font-caption" style={{ color:'var(--color-muted-foreground)' }}>
                            {pedidos.length} pedido(s) · {totais.pesoTotal.toLocaleString('pt-BR',{maximumFractionDigits:0})} kg
                        </span>
                        {totais.freteCalculado > 0 && (
                            <span className="text-xs font-data font-semibold text-green-600">
                                Frete: {brl(totais.freteCalculado)}
                            </span>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
                        <Button variant="default" onClick={handleSubmit} loading={loading} iconName="Save" iconSize={15}>
                            {editingRomaneio ? 'Salvar Alterações' : 'Criar Romaneio'}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function MoneyInput({ label, name, value, onChange, prefix='R$' }) {
    return (
        <div>
            <label className="block text-xs font-medium font-caption mb-1.5" style={{ color:'var(--color-text-primary)' }}>{label}</label>
            <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-caption" style={{ color:'var(--color-muted-foreground)' }}>{prefix}</span>
                <input type="number" name={name} value={value} onChange={onChange} min="0" step="0.01" placeholder="0,00"
                    className="w-full h-10 pl-8 pr-3 rounded-lg border border-gray-200 text-sm font-data focus:outline-none bg-white" />
            </div>
        </div>
    );
}

function FinRow({ label, value, icon, green }) {
    return (
        <div className="flex justify-between items-center">
            <span className="text-xs font-caption flex items-center gap-1.5" style={{ color:'var(--color-muted-foreground)' }}>
                <Icon name={icon} size={12} color="currentColor" />{label}
            </span>
            <span className={`text-xs font-data font-medium ${value < 0 ? 'text-red-500' : green ? 'text-green-600' : 'text-gray-700'}`}>
                {value < 0 ? '-':''}{Math.abs(value).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
            </span>
        </div>
    );
}
