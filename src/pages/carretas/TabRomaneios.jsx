import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRecarregarAoVoltar } from 'utils/useRecarregarAoVoltar';
import Button from 'components/ui/Button';
import Icon from 'components/AppIcon';
import Toast from 'components/ui/Toast';
import { useToast } from 'utils/useToast';
import { useConfirm } from 'components/ui/ConfirmDialog';
import { EditButton, DeleteButton, ViewButton, ActionButtonsGroup } from 'components/ActionButtons';
import {
    fetchRomaneios, createRomaneio, updateRomaneio, deleteRomaneio,
    fetchCarretasVeiculos, fetchTodosMotoristas, fetchCarreteirosPropriosOnly, fetchEmpresas,
    STATUS_ROMANEIO, STATUS_ROMANEIO_COLORS,
    fetchRomaneiosFerragem,
    fetchFretesCidades,
} from 'utils/carretasService';
import { fetchMaterials } from 'utils/materialService';
import { fetchAllUsers } from 'utils/userService';
import { subscribeTabela } from 'utils/supabaseClient';
import { printRomaneioCarretas, exportRomaneioModelo1, toModelo1Romaneio } from 'utils/excelUtils';
import * as XLSX from 'xlsx';
import PrettySelect from 'components/ui/PrettySelect';
import { FRETE_CATEGORIAS, calcularFretePedidoMulti, fmtPct } from 'utils/freteConfig';
import CidadesAdicionaisField, { parseParadas } from 'components/ui/CidadesAdicionaisField';

// Modos de cálculo do frete do romaneio inteiro — 'percentual_pedido' é o
// padrão de sempre (soma o percentual de cada pedido); os outros dois
// substituem esse cálculo por um valor único pro romaneio todo.
const TIPOS_CALCULO_FRETE_ROMANEIO = [
    { value: 'percentual_pedido', label: 'Percentual por pedido (padrão)' },
    { value: 'percentual_fixo',   label: 'Percentual fixo sobre o valor total' },
    { value: 'valor_fixo',        label: 'Valor fixo em R$ (combinado com o transporte)' },
];

// ─── SearchInput — campo de busca reutilizável (local a este arquivo) ────────
function SearchInput({ value, onChange, placeholder = 'Buscar...', width = '260px' }) {
    return (
        <div className="relative flex-shrink-0" style={{ minWidth: width }}>
            <Icon name="Search" size={13} color="var(--color-muted-foreground)"
                style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            <input
                type="text"
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder={placeholder}
                className="w-full pl-7 pr-7 py-2 rounded-lg border text-xs outline-none transition-all focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)', color: 'var(--color-text-primary)' }}
            />
            {value && (
                <button onClick={() => onChange('')}
                    style={{ position: 'absolute', right: '7px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted-foreground)', fontSize: '13px', lineHeight: 1 }}>✕</button>
            )}
        </div>
    );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const BRL = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const FMT_DATE = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—';
const inputCls = 'w-full px-3 py-2 rounded-lg border text-sm outline-none transition-all focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500';
const inputStyle = { borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' };

// ─── Select de Destino com auto-preenchimento de frete ───────────────────────
function DestinoSelect({ value, onChange, onFreteAutoFill, fretes }) {
    const [open, setOpen] = useState(false);
    const [q, setQ] = useState('');
    const ref = React.useRef();

    React.useEffect(() => {
        const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const filtered = fretes.filter(f => f.cidade.toLowerCase().includes(q.toLowerCase()));

    const select = (frete) => {
        onChange(frete.cidade);
        if (onFreteAutoFill) onFreteAutoFill(frete.frete_por_saco);
        setQ('');
        setOpen(false);
    };

    return (
        <div ref={ref} className="relative">
            <div className="flex">
                <input
                    value={value}
                    onChange={e => { onChange(e.target.value); setQ(e.target.value); setOpen(true); }}
                    onFocus={() => setOpen(true)}
                    className={inputCls + ' pr-9'}
                    style={inputStyle}
                    placeholder="Cidade / Endereço"
                />
                <button type="button" onClick={() => setOpen(o => !o)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-gray-100"
                    style={{ color: 'var(--color-primary)' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
                </button>
            </div>
            {open && (
                <div className="absolute z-50 w-full mt-1 bg-white rounded-xl border shadow-lg overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
                    <div className="max-h-52 overflow-y-auto">
                        {filtered.length === 0 ? (
                            <div className="px-3 py-2 text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                                {fretes.length === 0 ? 'Cadastre cidades na aba Fretes' : 'Nenhuma cidade encontrada'}
                            </div>
                        ) : filtered.map(f => (
                            <button key={f.id} type="button" onClick={() => select(f)}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 flex items-center justify-between gap-2">
                                <span className="font-medium" style={{ color: 'var(--color-text-primary)' }}>{f.cidade}</span>
                                <span className="text-xs font-mono font-semibold flex-shrink-0" style={{ color: '#059669' }}>
                                    {Number(f.frete_por_saco).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/saco
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
function ModalOverlay({ children, onClose, wide, sm }) {
    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)' }}>
            <div className={`bg-white rounded-2xl shadow-2xl flex flex-col ${wide ? 'w-full max-w-4xl' : sm ? 'w-full max-w-md' : 'w-full max-w-3xl'}`}
                style={{ maxHeight: 'calc(100vh - 32px)' }}>
                {children}
            </div>
        </div>
    );
}

function ModalHeader({ title, icon, onClose }) {
    return (
        <div className="flex items-center justify-between p-5 border-b flex-shrink-0"
            style={{ borderColor: 'var(--color-border)' }}>
            <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: '#EFF6FF' }}>
                    <Icon name={icon} size={18} color="#1D4ED8" />
                </div>
                <h2 className="font-heading font-bold text-lg" style={{ color: 'var(--color-text-primary)' }}>{title}</h2>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                <Icon name="X" size={18} color="var(--color-muted-foreground)" />
            </button>
        </div>
    );
}

function Field({ label, children, required, className = '' }) {
    return (
        <div className={className}>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                {label}{required && <span className="text-red-500 ml-0.5">*</span>}
            </label>
            {children}
        </div>
    );
}

function StatusBadge({ status }) {
    const cfg = STATUS_ROMANEIO_COLORS[status] || STATUS_ROMANEIO_COLORS['Aguardando'];
    return (
        <span className="px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap"
            style={{ backgroundColor: cfg.bg, color: cfg.text }}>
            {status}
        </span>
    );
}

// ─── Linha de item do romaneio ─────────────────────────────────────────────────
function ItemRow({ item, index, materiais, onUpdate, onRemove }) {
    const mat = materiais.find(m => String(m.id) === String(item.material_id));

    // Peso unitário: prioriza o armazenado no item (confiável), fallback no cadastro do material
    const pesoUnit = item.peso_unit && Number(item.peso_unit) > 0
        ? Number(item.peso_unit)
        : (mat?.peso && Number(mat.peso) > 0 ? Number(mat.peso) : null);

    // Peso exibido no input — para modo auto: calcula direto do estado (não drift com pesoUnit)
    // Assim o input controlado sempre reflete o estado real
    const pesoExibido = item._pesoManual
        ? (item.peso_total || '')
        : (item.peso_total || '');  // estado sempre sincronizado (ver onUpdate abaixo)

    return (
        <div className="grid grid-cols-12 gap-2 items-start p-3 rounded-xl border"
            style={{ borderColor: 'var(--color-border)', backgroundColor: index % 2 === 0 ? '#F8FAFC' : '#fff' }}>

            {/* Nº */}
            <div className="col-span-12 sm:col-span-1 flex items-center justify-center pt-6">
                <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                    style={{ backgroundColor: 'var(--color-primary)' }}>{index + 1}</span>
            </div>

            {/* Material */}
            <div className="col-span-12 sm:col-span-4">
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Material</label>
                <PrettySelect
                    value={item.material_id || ''}
                    onChange={e => {
                        const mid = e.target.value;
                        const m = materiais.find(x => String(x.id) === String(mid));
                        const pu = m?.peso && Number(m.peso) > 0 ? Number(m.peso) : null;
                        const qtd = Number(item.quantidade || 1);
                        onUpdate(index, {
                            material_id: mid,
                            descricao:   m?.nome    || '',
                            unidade:     m?.unidade || item.unidade,
                            peso_unit:   pu ? String(pu) : '',
                            _pesoManual: false,
                            peso_total:  pu ? String(pu * qtd) : '',
                        });
                    }}
                    className={inputCls} style={inputStyle}>
                    <option value="">Selecione...</option>
                    {materiais.map(m => (
                        <option key={m.id} value={m.id}>{m.nome}</option>
                    ))}
                    {/* Material do item não está (mais) na lista carregada — ex.: removido/renomeado
                        no catálogo depois que este pedido foi salvo. Sem isso o select ficava em
                        branco mesmo com o item corretamente salvo (peso/qtd vêm direto do item,
                        não dependem desse lookup — só o nome pra exibição precisa desse fallback). */}
                    {item.material_id && !materiais.some(m => String(m.id) === String(item.material_id)) && (
                        <option value={item.material_id}>{item.descricao || 'Material não encontrado no catálogo'}</option>
                    )}
                </PrettySelect>
                {item.material_id && !mat && (
                    <p className="text-xs mt-1 font-medium text-amber-600">
                        ⚠ Este material não está mais no catálogo — o valor salvo é mantido, mas confira se ainda é o correto
                    </p>
                )}
                {mat && !pesoUnit && item.material_id && (
                    <p className="text-xs mt-1 font-medium text-amber-600">
                        ⚠ Peso não cadastrado em /materiais — preencha manualmente
                    </p>
                )}
                {pesoUnit && (
                    <p className="text-xs mt-1 font-medium" style={{ color: '#059669' }}>
                        {pesoUnit.toLocaleString('pt-BR')} kg/un
                    </p>
                )}
            </div>

            {/* Qtd */}
            <div className="col-span-5 sm:col-span-2">
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Qtd</label>
                <input type="number" step="0.001" min="0"
                    value={item.quantidade}
                    onChange={e => {
                        const newQtd = e.target.value;
                        const newPeso = pesoUnit && !item._pesoManual
                            ? String(pesoUnit * Number(newQtd))
                            : item.peso_total;
                        onUpdate(index, { quantidade: newQtd, peso_total: newPeso });
                    }}
                    className={inputCls} style={inputStyle} placeholder="0" />
            </div>

            {/* Unidade */}
            <div className="col-span-7 sm:col-span-2">
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Unidade</label>
                <PrettySelect value={item.unidade} onChange={e => onUpdate(index, { unidade: e.target.value })}
                    className={inputCls} style={inputStyle}>
                    {['sc', 'ton', 'kg', 'un', 'cx', 'm³', 'pallet', 'br', 'mt'].map(u => <option key={u} value={u}>{u}</option>)}
                </PrettySelect>
            </div>

            {/* Peso */}
            <div className="col-span-10 sm:col-span-2">
                <div className="flex items-center gap-1 mb-1">
                    <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>Peso (kg)</label>
                    {pesoUnit && !item._pesoManual
                        ? <span className="px-1 py-0.5 rounded text-xs font-semibold" style={{ backgroundColor: '#D1FAE5', color: '#065F46' }}>auto</span>
                        : pesoUnit
                            ? <button type="button" onClick={() => onUpdate(index, { _pesoManual: false, peso_total: String(pesoUnit * Number(item.quantidade || 0)) })}
                                className="px-1 py-0.5 rounded text-xs" style={{ backgroundColor: '#FEF9C3', color: '#B45309' }}>↻ auto</button>
                            : null
                    }
                </div>
                <input type="number" step="0.01" min="0"
                    value={pesoExibido}
                    onChange={e => onUpdate(index, { peso_total: e.target.value, _pesoManual: true })}
                    className={inputCls}
                    style={{
                        ...inputStyle,
                        borderColor: pesoUnit && !item._pesoManual ? '#6EE7B7' : 'var(--color-border)',
                        backgroundColor: pesoUnit && !item._pesoManual ? '#F0FDF4' : undefined,
                    }}
                    placeholder={pesoUnit ? '—' : 'Digite o peso'} />
                {pesoUnit && !item._pesoManual && item.quantidade && (
                    <p className="text-xs mt-0.5" style={{ color: '#059669' }}>
                        {Number(item.quantidade).toLocaleString('pt-BR')} × {pesoUnit.toLocaleString('pt-BR')}
                    </p>
                )}
            </div>

            {/* Remove */}
            <div className="col-span-2 sm:col-span-1 flex items-end pb-0.5 pt-6">
                <button onClick={() => onRemove(index)}
                    className="w-full flex items-center justify-center h-9 rounded-lg border border-red-200 hover:bg-red-50 transition-colors">
                    <Icon name="Trash2" size={16} color="#DC2626" />
                </button>
            </div>
        </div>
    );
}

// ─── Card de Pedido — cabeçalho (cliente/vendedor/frete) + materiais do pedido ─
const EMPTY_PEDIDO_CARRETAS = () => ({
    numero_pedido: '', cidade_destino: '', valor_pedido: '', categoria_frete: 'Cimento',
    categorias_extra: [], empresa: '', nome_cliente: '', nome_vendedor: '', itens: [], observacao: '',
});

function PedidoCardCarretas({ pedido, index, materiais, empresas, onUpdate, onRemove, defaultAberto = false }) {
    const [aberto, setAberto] = useState(defaultAberto);
    const freteMulti = calcularFretePedidoMulti(pedido);
    const nVal = v => Number(v) || 0;

    const patch = p => onUpdate(index, p);
    const addItem = () => patch({ itens: [...pedido.itens, {
        material_id: '', descricao: '', quantidade: '1', unidade: 'sc', peso_unit: '', peso_total: '', _pesoManual: false,
    }] });
    const updateItem = (idx, p) => patch({ itens: pedido.itens.map((it, i) => i === idx ? { ...it, ...p } : it) });
    const removeItem = (idx) => patch({ itens: pedido.itens.filter((_, i) => i !== idx) });

    const addCategoriaExtra = () => patch({ categorias_extra: [...(pedido.categorias_extra || []), { categoria: 'Outros', valor: '' }] });
    const updateCategoriaExtra = (eIdx, k, v) => patch({ categorias_extra: (pedido.categorias_extra || []).map((e, j) => j !== eIdx ? e : { ...e, [k]: v }) });
    const removeCategoriaExtra = (eIdx) => patch({ categorias_extra: (pedido.categorias_extra || []).filter((_, j) => j !== eIdx) });

    return (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: '#C4B5FD' }}>
            <button type="button" onClick={() => setAberto(v => !v)}
                className="w-full px-4 py-3 flex items-center justify-between gap-2 text-left hover:brightness-95 transition-all"
                style={{ backgroundColor: '#FAF5FF' }}>
                <div className="flex items-center gap-2 min-w-0">
                    <Icon name={aberto ? 'ChevronUp' : 'ChevronDown'} size={14} color="#7C3AED" className="flex-shrink-0" />
                    <p className="text-xs font-semibold text-purple-700 truncate">
                        📦 Pedido {index + 1}{pedido.numero_pedido ? ` — Nº ${pedido.numero_pedido}` : ''}
                        {!aberto && pedido.nome_cliente ? ` — ${pedido.nome_cliente}` : ''}
                    </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                    {!aberto && nVal(pedido.valor_pedido) > 0 && (
                        <span className="text-xs font-data font-semibold text-purple-700">{BRL(freteMulti.total)}</span>
                    )}
                    <span onClick={e => { e.stopPropagation(); onRemove(index); }} role="button"
                        className="p-1 rounded hover:bg-red-50">
                        <Icon name="Trash2" size={14} color="#DC2626" />
                    </span>
                </div>
            </button>
            {aberto && (
            <div className="p-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Field label="Nº do Pedido">
                        <input value={pedido.numero_pedido} onChange={e => patch({ numero_pedido: e.target.value })}
                            className={inputCls} style={inputStyle} placeholder="Ex: 43601" />
                    </Field>
                    <Field label="Cliente">
                        <input value={pedido.nome_cliente} onChange={e => patch({ nome_cliente: e.target.value })}
                            className={inputCls} style={inputStyle} placeholder="Nome do cliente" />
                    </Field>
                    <Field label="Vendedor">
                        <input value={pedido.nome_vendedor} onChange={e => patch({ nome_vendedor: e.target.value })}
                            className={inputCls} style={inputStyle} placeholder="Nome do vendedor" />
                    </Field>
                    <Field label="Cidade de Destino">
                        <input value={pedido.cidade_destino} onChange={e => patch({ cidade_destino: e.target.value })}
                            className={inputCls} style={inputStyle} placeholder="Ex: Ibotirama" />
                    </Field>
                    <Field label="Empresa">
                        <PrettySelect value={pedido.empresa} onChange={e => patch({ empresa: e.target.value })}
                            className={inputCls} style={inputStyle}>
                            <option value="">Selecione...</option>
                            {empresas.map(e => <option key={e.id} value={e.nome}>{e.nome}</option>)}
                        </PrettySelect>
                    </Field>
                    <Field label="Valor do Pedido (R$)">
                        <input type="number" min="0" step="0.01" value={pedido.valor_pedido}
                            onChange={e => patch({ valor_pedido: e.target.value })}
                            className={inputCls} style={inputStyle} placeholder="0,00" />
                    </Field>
                    <Field label="Categoria de Frete">
                        <PrettySelect value={pedido.categoria_frete} onChange={e => patch({ categoria_frete: e.target.value })}
                            className={inputCls} style={inputStyle}>
                            {FRETE_CATEGORIAS.map(f => <option key={f.categoria} value={f.categoria}>{f.label} – {fmtPct(f.percentual)}</option>)}
                        </PrettySelect>
                    </Field>
                </div>

                {/* Categorias extras — frete com percentual variável dentro do mesmo pedido (ex.: telhas de zinco) */}
                <div className="rounded-lg border p-3" style={{ borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' }}>
                    <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-medium" style={{ color: 'var(--color-text-primary)' }}>Outras categorias neste pedido</label>
                        <button type="button" onClick={addCategoriaExtra}
                            className="flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg hover:bg-purple-50" style={{ color: '#7C3AED' }}>
                            <Icon name="Plus" size={12} /> Adicionar categoria
                        </button>
                    </div>
                    {(pedido.categorias_extra || []).length === 0 ? (
                        <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                            Use isso quando o pedido tiver materiais de mais de uma categoria de frete (ex.: Telhas de Zinco 2% + Ferragens 6% no mesmo pedido).
                        </p>
                    ) : (
                        <div className="flex flex-col gap-2">
                            <p className="text-[11px]" style={{ color: 'var(--color-muted-foreground)' }}>
                                A categoria principal acima ({pedido.categoria_frete}) passa a valer sobre o restante: {BRL(freteMulti.valorPrincipal)}.
                            </p>
                            {pedido.categorias_extra.map((extra, eIdx) => (
                                <div key={eIdx} className="flex items-center gap-2">
                                    <PrettySelect value={extra.categoria} onChange={e => updateCategoriaExtra(eIdx, 'categoria', e.target.value)}
                                        className="flex-1 h-9 px-2 rounded-lg border border-gray-200 text-xs bg-white">
                                        {FRETE_CATEGORIAS.map(f => <option key={f.categoria} value={f.categoria}>{f.label} – {fmtPct(f.percentual)}</option>)}
                                    </PrettySelect>
                                    <input type="number" min="0" step="0.01" value={extra.valor} onChange={e => updateCategoriaExtra(eIdx, 'valor', e.target.value)}
                                        placeholder="Valor (R$)" className="w-32 h-9 px-3 rounded-lg border border-gray-200 text-xs bg-white font-data" />
                                    <button type="button" onClick={() => removeCategoriaExtra(eIdx)} className="p-1.5 rounded-lg hover:bg-red-50 flex-shrink-0">
                                        <Icon name="X" size={14} color="#DC2626" />
                                    </button>
                                </div>
                            ))}
                            {freteMulti.valorExtras > nVal(pedido.valor_pedido) && (
                                <p className="text-xs text-red-600 flex items-center gap-1">
                                    <Icon name="AlertTriangle" size={12} /> A soma das categorias extras ultrapassa o valor do pedido.
                                </p>
                            )}
                        </div>
                    )}
                </div>

                {freteMulti.total > 0 && (
                    <div className="p-2.5 rounded-lg flex items-center justify-between" style={{ backgroundColor: '#7C3AED' }}>
                        <span className="text-xs font-medium text-white">💰 Frete deste pedido:</span>
                        <span className="text-sm font-bold font-data text-white">{BRL(freteMulti.total)}</span>
                    </div>
                )}

                {/* Materiais deste pedido */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                            Materiais deste pedido {pedido.itens.length > 0 && `(${pedido.itens.length})`}
                        </label>
                        <button type="button" onClick={addItem}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border border-purple-300 hover:bg-purple-50" style={{ color: '#7C3AED' }}>
                            <Icon name="Plus" size={12} /> Adicionar Material
                        </button>
                    </div>
                    {pedido.itens.length === 0 ? (
                        <div className="text-center py-5 rounded-lg border-2 border-dashed cursor-pointer hover:bg-gray-50" style={{ borderColor: 'var(--color-border)' }} onClick={addItem}>
                            <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>Clique para adicionar materiais a este pedido</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {pedido.itens.map((item, idx) => (
                                <ItemRow key={idx} item={item} index={idx} materiais={materiais} onUpdate={updateItem} onRemove={removeItem} />
                            ))}
                        </div>
                    )}
                </div>

                {/* Observação específica deste pedido — some acompanha esse pedido em
                    específico (diferente da observação geral do romaneio) */}
                <Field label="Observação do pedido">
                    <textarea value={pedido.observacao || ''} onChange={e => patch({ observacao: e.target.value })}
                        rows={2} className={inputCls} style={inputStyle} placeholder="Alguma observação sobre este pedido específico..." />
                </Field>
            </div>
            )}
        </div>
    );
}

// ─── Modal Formulário Romaneio ─────────────────────────────────────────────────
function RomaneioFormModal({ modal, onClose, onSaved, motoristas, veiculos, empresas, materiais, fretesFretas = [], adminsFrete = [] }) {
    const { toast, showToast } = useToast();
    const isEdit = modal?.mode === 'edit';
    const rom = modal?.data;

    const emptyForm = () => ({
        status: 'Aguardando',
        motorista_id: '',
        vincularMotorista: true,
        veiculo_id: '',
        empresa: '',
        data_saida: new Date().toISOString().split('T')[0],
        data_chegada: '',
        destino: '',
        numero_nf: '',
        numero_pedido: '',
        valor_carga: '',
        tipo_calculo_frete: 'percentual_pedido',
        percentual_frete_fixo: '',
        frete_fixo_responsavel: '',
        frete_fixo_combinado_em: new Date().toISOString().split('T')[0],
        valor_frete: '',
        observacoes: '',
    });

    const [form, setForm] = useState(emptyForm());
    const [pedidos, setPedidos] = useState([]);
    const [paradas, setParadas] = useState([]); // cidades adicionais além do destino principal
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (isEdit && rom) {
            setForm({
                status:               rom.status || 'Aguardando',
                motorista_id:         rom.motorista_id || '',
                vincularMotorista:    !!rom.motorista_id,
                veiculo_id:           rom.veiculo_id || '',
                empresa:              rom.empresa || '',
                data_saida:           rom.data_saida || '',
                data_chegada:         rom.data_chegada || '',
                destino:              rom.destino || '',
                numero_nf:            rom.numero_nf || '',
                numero_pedido:        rom.numero_pedido || '',
                valor_carga:          rom.valor_carga != null ? String(rom.valor_carga) : '',
                tipo_calculo_frete:   rom.tipo_calculo_frete || 'percentual_pedido',
                percentual_frete_fixo:    rom.percentual_frete_fixo != null ? String(rom.percentual_frete_fixo * 100) : '',
                frete_fixo_responsavel:   rom.frete_fixo_responsavel || '',
                frete_fixo_combinado_em:  rom.frete_fixo_combinado_em || new Date().toISOString().split('T')[0],
                valor_frete:          rom.valor_frete != null ? String(rom.valor_frete) : '',
                observacoes:          rom.observacoes || '',
            });
            setParadas(parseParadas(rom.paradas));
            const itemToForm = it => {
                const matPeso = it.material?.peso && Number(it.material.peso) > 0 ? Number(it.material.peso) : null;
                const pesoTotalSalvo = it.peso_total != null ? Number(it.peso_total) : null;
                const qtd = Number(it.quantidade || 1);
                const foiManual = matPeso && pesoTotalSalvo !== null ? Math.abs(pesoTotalSalvo - matPeso * qtd) > 0.01 : true;
                return {
                    material_id: it.material_id || '', descricao: it.descricao || '', quantidade: String(qtd),
                    unidade: it.unidade || 'sc', peso_unit: matPeso ? String(matPeso) : '',
                    peso_total: pesoTotalSalvo != null ? String(pesoTotalSalvo) : '', _pesoManual: foiManual,
                };
            };
            let pedidosCarregados = (rom.pedidos || []).map(p => ({
                id: p.id,
                numero_pedido: p.numero_pedido || '', cidade_destino: p.cidade_destino || '',
                valor_pedido: p.valor_pedido != null ? String(p.valor_pedido) : '',
                categoria_frete: p.categoria_frete || 'Cimento',
                categorias_extra: Array.isArray(p.categorias_extra) ? p.categorias_extra : [],
                empresa: p.empresa || '', nome_cliente: p.nome_cliente || '', nome_vendedor: p.nome_vendedor || '',
                observacao: p.observacao || '',
                itens: (rom.itens || []).filter(it => it.pedido_id === p.id).map(itemToForm),
            }));
            // Romaneio antigo (de antes de "Pedidos múltiplos" existir) — tinha
            // materiais soltos, sem pedido. Envolve tudo num pedido único pra não
            // perder nada, já convertendo pro novo formato ao salvar de novo.
            if (pedidosCarregados.length === 0 && (rom.itens || []).length > 0) {
                pedidosCarregados = [{
                    numero_pedido: rom.numero_pedido || '', cidade_destino: rom.destino || '',
                    valor_pedido: rom.valor_carga != null ? String(rom.valor_carga) : '',
                    categoria_frete: 'Cimento', categorias_extra: [],
                    empresa: rom.empresa || '', nome_cliente: '', nome_vendedor: '',
                    itens: (rom.itens || []).map(itemToForm),
                }];
            }
            setPedidos(pedidosCarregados);
        } else {
            setForm(emptyForm());
            setPedidos([]);
            setParadas([]);
        }
    }, [modal]); // eslint-disable-line

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const addPedido = () => setPedidos(p => [...p, { ...EMPTY_PEDIDO_CARRETAS(), empresa: form.empresa || '', _novo: true }]);
    const updatePedido = (idx, patch) => setPedidos(p => p.map((pd, i) => i === idx ? { ...pd, ...patch } : pd));
    const removePedido = (idx) => setPedidos(p => p.filter((_, i) => i !== idx));

    // Totais calculados a partir dos pedidos
    const totaisPedidos = useMemo(() => {
        const valorCarga = pedidos.reduce((s, p) => s + (Number(p.valor_pedido) || 0), 0);
        const pesoItens = pedidos.reduce((s, p) => s + p.itens.reduce((s2, it) => s2 + (Number(it.peso_total) || 0), 0), 0);
        // Frete "por pedido" — só usado de fato quando o modo do romaneio é
        // 'percentual_pedido'; nos outros dois modos o frete final vem de um
        // valor único pro romaneio inteiro (ver freteFinal em handleSave).
        const fretePorPedido = pedidos.reduce((s, p) => s + calcularFretePedidoMulti(p).total, 0);
        let frete = fretePorPedido;
        if (form.tipo_calculo_frete === 'percentual_fixo') {
            frete = valorCarga * (Number(form.percentual_frete_fixo || 0) / 100);
        } else if (form.tipo_calculo_frete === 'valor_fixo') {
            frete = Number(form.valor_frete || 0);
        }
        return { valorCarga, frete, fretePorPedido, pesoItens };
    }, [pedidos, form.tipo_calculo_frete, form.percentual_frete_fixo, form.valor_frete]);

    const handleSave = async () => {
        if (!form.destino) { showToast('Destino é obrigatório', 'error'); return; }
        if (form.tipo_calculo_frete === 'percentual_fixo' && !(Number(form.percentual_frete_fixo) > 0)) {
            showToast('Informe o percentual fixo do frete', 'error'); return;
        }
        if (form.tipo_calculo_frete === 'valor_fixo') {
            if (!(Number(form.valor_frete) > 0)) { showToast('Informe o valor fixo do frete', 'error'); return; }
            if (!form.frete_fixo_responsavel.trim()) { showToast('Informe quem combinou o valor fixo com o transporte', 'error'); return; }
        }
        setSaving(true);
        try {
            const itensPayloadFrom = (lista) => lista.filter(it => it.material_id || it.descricao).map(it => {
                const matIt = materiais.find(m => m.id === it.material_id);
                // Prioridade: peso_unit do item > peso do material > null
                const pu = it.peso_unit
                    ? Number(it.peso_unit)
                    : (matIt?.peso && Number(matIt.peso) > 0 ? Number(matIt.peso) : null);
                const pesoSalvo = (pu && !it._pesoManual && it.quantidade)
                    ? String(pu * Number(it.quantidade))
                    : it.peso_total;
                // Não persistir campos de controle interno no banco
                const { _pesoManual, peso_unit, ...itemClean } = it;
                return { ...itemClean, peso_total: pesoSalvo };
            });

            if (pedidos.length === 0) { showToast('Adicione pelo menos um pedido', 'error'); setSaving(false); return; }
            const pedidosPayload = pedidos.map(p => {
                const freteMulti = calcularFretePedidoMulti(p);
                return {
                    numero_pedido: p.numero_pedido || null,
                    cidade_destino: p.cidade_destino || null,
                    valor_pedido: Number(p.valor_pedido) || 0,
                    categoria_frete: p.categoria_frete || null,
                    categorias_extra: (p.categorias_extra || []).filter(e => Number(e.valor) > 0).map(e => ({ categoria: e.categoria, valor: Number(e.valor) })),
                    percentual_frete: FRETE_CATEGORIAS.find(f => f.categoria === p.categoria_frete)?.percentual || null,
                    frete_calculado: freteMulti.total,
                    empresa: p.empresa || null,
                    nome_cliente: (p.nome_cliente || '').trim() || null,
                    nome_vendedor: (p.nome_vendedor || '').trim() || null,
                    observacao: (p.observacao || '').trim() || null,
                };
            });
            // Itens ganham pedido_index (posição no array de pedidos) para o
            // service vincular ao pedido_id correto depois de inserir os pedidos.
            const itensPayload = pedidos.flatMap((p, pIdx) =>
                itensPayloadFrom(p.itens).map(it => ({ ...it, pedido_index: pIdx }))
            );
            const valorCargaFinal = totaisPedidos.valorCarga;
            const freteFinal = totaisPedidos.frete;

            // Soma o peso (kg) de todos os itens e converte para toneladas — é o campo
            // 'toneladas' que listas, exportações e relatórios financeiros usam para
            // exibir o peso do romaneio. Sem isso, a soma calculada nos itens ficava só
            // na prévia do modal e nunca era gravada no romaneio.
            const pesoItensKg = itensPayload.reduce((s, it) => s + (Number(it.peso_total) || 0), 0);
            const toneladasCalculadas = pesoItensKg > 0 ? pesoItensKg / 1000 : (rom?.toneladas ?? null);

            const payload = {
                status:              form.status,
                destino:             form.destino,
                data_saida:          form.data_saida   || undefined,
                data_chegada:        form.data_chegada || undefined,
                // "Sem motorista (só a carga)" precisa gravar null explicitamente —
                // undefined seria removido do payload logo abaixo e o motorista_id
                // antigo continuaria salvo no banco, mesmo aparecendo desmarcado na tela.
                motorista_id:        form.vincularMotorista === false ? null : (form.motorista_id || undefined),
                veiculo_id:          form.veiculo_id   || undefined,
                empresa:             form.empresa       || undefined,
                numero_nf:           form.numero_nf     || undefined,
                numero_pedido:       form.numero_pedido || undefined,
                valor_carga:         valorCargaFinal,
                tipo_calculo_frete:  form.tipo_calculo_frete,
                percentual_frete_fixo: form.tipo_calculo_frete === 'percentual_fixo'
                    ? Number(form.percentual_frete_fixo) / 100 : null,
                frete_fixo_responsavel: form.tipo_calculo_frete === 'valor_fixo'
                    ? form.frete_fixo_responsavel.trim() : null,
                frete_fixo_combinado_em: form.tipo_calculo_frete === 'valor_fixo'
                    ? (form.frete_fixo_combinado_em || null) : null,
                valor_frete:         freteFinal,
                observacoes:         form.observacoes   || undefined,
                toneladas:           toneladasCalculadas,
                paradas:             paradas.filter(p => p && p.trim()),
                itens: itensPayload,
                _pedidos: pedidosPayload,
            };
            // Remove undefined
            Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);

            if (isEdit) await updateRomaneio(rom.id, payload);
            else        await createRomaneio(payload);

            showToast(isEdit ? 'Romaneio atualizado!' : 'Romaneio criado!', 'success');
            setTimeout(() => { onSaved(); onClose(); }, 800);
        } catch (e) {
            console.error(e);
            showToast('Erro: ' + (e.message || JSON.stringify(e)), 'error');
        } finally {
            setSaving(false);
        }
    };

    return (
        <ModalOverlay onClose={onClose}>
            <ModalHeader
                title={isEdit ? `Editar Romaneio ${rom?.numero || ''}` : 'Novo Romaneio'}
                icon="FileText"
                onClose={onClose}
            />

            <div className="p-5 space-y-5 overflow-y-auto flex-1">

                {/* ── Bloco 1: Identificação ── */}
                <div className="p-4 rounded-xl border" style={{ borderColor: '#BFDBFE', backgroundColor: '#EFF6FF' }}>
                    <p className="text-xs font-semibold text-blue-700 mb-3">🚛 Identificação do Romaneio</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {isEdit && (
                            <Field label="Status">
                                <PrettySelect value={form.status} onChange={e => set('status', e.target.value)}
                                    className={inputCls} style={inputStyle}>
                                    {STATUS_ROMANEIO.map(s => <option key={s} value={s}>{s}</option>)}
                                </PrettySelect>
                            </Field>
                        )}
                        <Field label="Placa do Veículo" required>
                            <PrettySelect value={form.veiculo_id} onChange={e => set('veiculo_id', e.target.value)}
                                className={inputCls} style={inputStyle}>
                                <option value="">Selecione a placa...</option>
                                {veiculos.map(v => <option key={v.id} value={v.id}>{v.placa} — {v.modelo}</option>)}
                            </PrettySelect>
                        </Field>
                        <Field label="Motorista">
                            <div className="flex items-center gap-2 mb-2">
                                <button type="button" onClick={() => set('vincularMotorista', true)}
                                    className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors"
                                    style={form.vincularMotorista !== false
                                        ? { backgroundColor: '#EFF6FF', color: '#1D4ED8', borderColor: '#BFDBFE' }
                                        : { backgroundColor: '#fff', color: 'var(--color-muted-foreground)', borderColor: 'var(--color-border)' }}>
                                    Vincular a um motorista
                                </button>
                                <button type="button" onClick={() => { set('vincularMotorista', false); set('motorista_id', ''); }}
                                    className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors"
                                    style={form.vincularMotorista === false
                                        ? { backgroundColor: '#EFF6FF', color: '#1D4ED8', borderColor: '#BFDBFE' }
                                        : { backgroundColor: '#fff', color: 'var(--color-muted-foreground)', borderColor: 'var(--color-border)' }}>
                                    Sem motorista (só a carga)
                                </button>
                            </div>
                            {form.vincularMotorista !== false && (
                                <PrettySelect value={form.motorista_id} onChange={e => set('motorista_id', e.target.value)}
                                    className={inputCls} style={inputStyle}>
                                    <option value="">Selecione o motorista...</option>
                                    {motoristas.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                </PrettySelect>
                            )}
                        </Field>
                        <Field label="Destino de Entrega" required>
                            <DestinoSelect
                                value={form.destino}
                                onChange={v => set('destino', v)}
                                fretes={fretesFretas}
                            />
                        </Field>
                        <Field label="Empresa">
                            <PrettySelect value={form.empresa} onChange={e => set('empresa', e.target.value)}
                                className={inputCls} style={inputStyle}>
                                <option value="">Selecione...</option>
                                {empresas.map(e => <option key={e.id} value={e.nome}>{e.nome}</option>)}
                            </PrettySelect>
                        </Field>
                        <Field label="Data de Saída">
                            <input type="date" value={form.data_saida} onChange={e => set('data_saida', e.target.value)}
                                className={inputCls} style={inputStyle} />
                        </Field>
                        <Field label="Data de Chegada (prevista)">
                            <input type="date" value={form.data_chegada} onChange={e => set('data_chegada', e.target.value)}
                                className={inputCls} style={inputStyle} />
                        </Field>
                    </div>
                    <div className="mt-3">
                        <CidadesAdicionaisField
                            cidades={[...new Set((fretesFretas || []).map(f => f.cidade).filter(Boolean))]}
                            value={paradas}
                            onChange={setParadas}
                            label="Cidades adicionais desta viagem"
                        />
                    </div>
                </div>

                {/* ── Bloco 2: Frete total (padrão: soma automática dos pedidos; ou um modo fixo pro romaneio inteiro) ── */}
                <div className="p-4 rounded-xl border" style={{ borderColor: '#C4B5FD', backgroundColor: '#FAF5FF' }}>
                    <p className="text-xs font-semibold text-purple-700 mb-3">💰 Resumo do Frete</p>

                    <Field label="Modo de cálculo do frete">
                        <PrettySelect value={form.tipo_calculo_frete} onChange={e => set('tipo_calculo_frete', e.target.value)}
                            className={inputCls} style={inputStyle}>
                            {TIPOS_CALCULO_FRETE_ROMANEIO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </PrettySelect>
                    </Field>

                    {form.tipo_calculo_frete === 'percentual_fixo' && (
                        <div className="mt-3">
                            <Field label="Percentual fixo sobre o valor total da carga (%)">
                                <input type="number" min="0" step="0.01" value={form.percentual_frete_fixo}
                                    onChange={e => set('percentual_frete_fixo', e.target.value)}
                                    className={inputCls} style={inputStyle} placeholder="Ex: 5" />
                            </Field>
                        </div>
                    )}

                    {form.tipo_calculo_frete === 'valor_fixo' && (
                        <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                            <Field label="Valor fixo do frete (R$)">
                                <input type="number" min="0" step="0.01" value={form.valor_frete}
                                    onChange={e => set('valor_frete', e.target.value)}
                                    className={inputCls} style={inputStyle} placeholder="Ex: 1200" />
                            </Field>
                            <Field label="Combinado com">
                                <PrettySelect value={form.frete_fixo_responsavel} onChange={e => set('frete_fixo_responsavel', e.target.value)}
                                    className={inputCls} style={inputStyle}>
                                    <option value="">Selecione o responsável...</option>
                                    {adminsFrete.map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
                                    {/* Mantém o valor salvo visível mesmo se o admin não estiver mais na lista (ex.: desativado depois) */}
                                    {form.frete_fixo_responsavel && !adminsFrete.some(a => a.name === form.frete_fixo_responsavel) && (
                                        <option value={form.frete_fixo_responsavel}>{form.frete_fixo_responsavel}</option>
                                    )}
                                </PrettySelect>
                            </Field>
                            <Field label="Data combinada">
                                <input type="date" value={form.frete_fixo_combinado_em}
                                    onChange={e => set('frete_fixo_combinado_em', e.target.value)}
                                    className={inputCls} style={inputStyle} />
                            </Field>
                        </div>
                    )}

                    <div className="mt-3 p-3 rounded-xl bg-purple-600 text-white flex items-center justify-between flex-wrap gap-2">
                        <div>
                            <span className="text-sm font-medium block">Valor da carga: {BRL(totaisPedidos.valorCarga)}</span>
                            <span className="text-xs opacity-80">
                                {form.tipo_calculo_frete === 'percentual_pedido'
                                    ? `${pedidos.length} pedido${pedidos.length !== 1 ? 's' : ''} — cada um com seu percentual de frete`
                                    : TIPOS_CALCULO_FRETE_ROMANEIO.find(t => t.value === form.tipo_calculo_frete)?.label}
                            </span>
                        </div>
                        <span className="text-lg font-bold font-data">{BRL(totaisPedidos.frete)} de frete</span>
                    </div>
                    {totaisPedidos.pesoItens > 0 && (
                        <div className="mt-3 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200">
                            <p className="text-xs text-emerald-700 font-medium">
                                ⚖️ Peso total dos itens: <strong>{totaisPedidos.pesoItens.toLocaleString('pt-BR')} kg</strong>
                            </p>
                        </div>
                    )}
                </div>

                {/* ── Bloco 3: Pedidos do Romaneio (cliente, vendedor, frete e materiais de cada um) ── */}
                <div>
                    {form.tipo_calculo_frete !== 'percentual_pedido' && (
                        <div className="mb-3 p-2.5 rounded-lg bg-amber-50 border border-amber-200">
                            <p className="text-xs text-amber-700">
                                ℹ️ O frete deste romaneio está no modo "{TIPOS_CALCULO_FRETE_ROMANEIO.find(t => t.value === form.tipo_calculo_frete)?.label}".
                                O percentual de cada pedido abaixo continua sendo salvo (útil pra relatórios por categoria), mas não é somado no frete total do romaneio.
                            </p>
                        </div>
                    )}
                    <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                            📦 Pedidos do Romaneio
                            {pedidos.length > 0 && (
                                <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                                    {pedidos.length} pedido{pedidos.length !== 1 ? 's' : ''}
                                </span>
                            )}
                        </p>
                        <button onClick={addPedido}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-purple-300 text-purple-700 hover:bg-purple-50 transition-colors">
                            <Icon name="Plus" size={13} /> Adicionar Pedido
                        </button>
                    </div>
                    {pedidos.length === 0 ? (
                        <div className="text-center py-8 rounded-xl border-2 border-dashed cursor-pointer hover:bg-gray-50 transition-colors"
                            style={{ borderColor: 'var(--color-border)' }} onClick={addPedido}>
                            <Icon name="Package" size={28} color="var(--color-muted-foreground)" className="mx-auto" />
                            <p className="text-sm mt-2" style={{ color: 'var(--color-muted-foreground)' }}>Clique para adicionar o primeiro pedido</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {pedidos.map((pedido, idx) => (
                                <PedidoCardCarretas key={idx} pedido={pedido} index={idx} materiais={materiais} empresas={empresas}
                                    onUpdate={updatePedido} onRemove={removePedido}
                                    defaultAberto={pedido._novo} />
                            ))}
                        </div>
                    )}
                </div>

                {/* ── Observações ── */}
                <Field label="Observações">
                    <textarea value={form.observacoes} onChange={e => set('observacoes', e.target.value)}
                        className={inputCls} style={inputStyle} rows={3}
                        placeholder="Observações gerais sobre o romaneio..." />
                </Field>
            </div>

            {/* Footer */}
            <div className="flex gap-3 p-5 justify-end border-t flex-shrink-0"
                style={{ borderColor: 'var(--color-border)' }}>
                <button onClick={onClose}
                    className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50"
                    style={{ borderColor: 'var(--color-border)' }}>
                    Cancelar
                </button>
                <Button onClick={handleSave} size="sm" iconName={saving ? 'Loader' : 'Check'} disabled={saving}>
                    {saving ? 'Salvando...' : (isEdit ? 'Atualizar' : 'Criar Romaneio')}
                </Button>
            </div>
            <Toast toast={toast} />
        </ModalOverlay>
    );
}

// ─── Modal de detalhe ──────────────────────────────────────────────────────────
function RomaneioDetailModal({ romaneio, onClose }) {
    if (!romaneio) return null;
    return (
        <ModalOverlay onClose={onClose}>
            <ModalHeader title={`Romaneio ${romaneio.numero}`} icon="FileText" onClose={onClose} />
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {[
                        { l: 'Status',      v: <StatusBadge status={romaneio.status} /> },
                        { l: 'Motorista',   v: romaneio.motorista?.name || '—' },
                        { l: 'Placa',       v: romaneio.veiculo?.placa  || '—' },
                        { l: 'Destino',     v: romaneio.destino          || '—' },
                        { l: 'Cidades adicionais', v: parseParadas(romaneio.paradas).length > 0 ? parseParadas(romaneio.paradas).join(', ') : '—' },
                        { l: 'Data Saída',  v: FMT_DATE(romaneio.data_saida) },
                        { l: 'Data Chegada',v: FMT_DATE(romaneio.data_chegada) },
                        { l: 'Modo de frete', v: TIPOS_CALCULO_FRETE_ROMANEIO.find(t => t.value === (romaneio.tipo_calculo_frete || 'percentual_pedido'))?.label || '—' },
                        ...(romaneio.tipo_calculo_frete === 'valor_fixo' && romaneio.frete_fixo_responsavel
                            ? [{ l: 'Frete combinado com', v: `${romaneio.frete_fixo_responsavel}${romaneio.frete_fixo_combinado_em ? ' em ' + FMT_DATE(romaneio.frete_fixo_combinado_em) : ''}` }]
                            : []),
                    ].map(({ l, v }) => (
                        <div key={l} className="p-3 rounded-xl border" style={{ borderColor: 'var(--color-border)' }}>
                            <p className="text-xs mb-1" style={{ color: 'var(--color-muted-foreground)' }}>{l}</p>
                            <div className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{v}</div>
                        </div>
                    ))}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                        { l: 'Valor da Carga', v: romaneio.valor_carga ? BRL(romaneio.valor_carga) : '—', color: '#065F46' },
                        { l: 'Frete',          v: romaneio.valor_frete  ? BRL(romaneio.valor_frete)  : '—', color: '#7C3AED' },
                        { l: 'Frete sobre a carga', v: (Number(romaneio.valor_carga) > 0)
                            ? `${((Number(romaneio.valor_frete || 0) / Number(romaneio.valor_carga)) * 100).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
                            : '—', color: '#DB2777' },
                        { l: 'Peso Total',     v: (() => {
                            const p = (romaneio.itens || []).reduce((s, it) => s + Number(it.peso_total || 0), 0);
                            return p > 0 ? `${p.toLocaleString('pt-BR')} kg` : (romaneio.toneladas ? `${Number(romaneio.toneladas).toLocaleString('pt-BR')} t` : '—');
                        })(), color: '#B45309' },
                    ].map(({ l, v, color }) => (
                        <div key={l} className="p-3 rounded-xl border" style={{ borderColor: 'var(--color-border)' }}>
                            <p className="text-xs mb-1" style={{ color: 'var(--color-muted-foreground)' }}>{l}</p>
                            <p className="text-base font-bold font-data" style={{ color }}>{v}</p>
                        </div>
                    ))}
                </div>
                {(romaneio.pedidos?.length || 0) > 0 && (
                    <div>
                        <p className="text-sm font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>
                            Pedidos ({romaneio.pedidos.length})
                        </p>
                        <div className="space-y-2">
                            {romaneio.pedidos.map(p => {
                                const freteMulti = calcularFretePedidoMulti(p);
                                return (
                                    <div key={p.id} className="p-3 rounded-xl border" style={{ borderColor: '#E9D5FF', backgroundColor: '#FAF5FF' }}>
                                        <div className="flex items-center justify-between flex-wrap gap-1">
                                            <span className="text-xs font-data font-semibold" style={{ color: '#7C3AED' }}>
                                                {p.numero_pedido ? `#${p.numero_pedido}` : 'Sem número'}
                                            </span>
                                            <span className="text-xs font-data font-semibold" style={{ color: '#7C3AED' }}>{BRL(freteMulti.total)} de frete</span>
                                        </div>
                                        <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                                            {p.nome_cliente && <span><span style={{ color: 'var(--color-muted-foreground)' }}>Cliente: </span>{p.nome_cliente}</span>}
                                            {p.nome_vendedor && <span><span style={{ color: 'var(--color-muted-foreground)' }}>Vendedor: </span>{p.nome_vendedor}</span>}
                                            {p.cidade_destino && <span><span style={{ color: 'var(--color-muted-foreground)' }}>Cidade: </span>{p.cidade_destino}</span>}
                                            {p.empresa && <span><span style={{ color: 'var(--color-muted-foreground)' }}>Empresa: </span>{p.empresa}</span>}
                                            <span><span style={{ color: 'var(--color-muted-foreground)' }}>Valor: </span>{BRL(p.valor_pedido)}</span>
                                            <span><span style={{ color: 'var(--color-muted-foreground)' }}>Categoria: </span>{p.categoria_frete}{Array.isArray(p.categorias_extra) && p.categorias_extra.length > 0 ? ` +${p.categorias_extra.length}` : ''}</span>
                                        </div>
                                        {p.observacao && (
                                            <p className="mt-1.5 text-xs italic px-2 py-1.5 rounded-lg bg-white" style={{ color: '#7C3AED', border: '1px dashed #E9D5FF' }}>
                                                💬 {p.observacao}
                                            </p>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
                {(romaneio.itens?.length || 0) > 0 && (
                    <div>
                        <p className="text-sm font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>
                            Materiais ({romaneio.itens.length})
                        </p>
                        <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
                            <table className="w-full text-sm">
                                <thead className="text-xs border-b"
                                    style={{ backgroundColor: 'var(--color-muted)', borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                                    <tr>
                                        {['Material','Qtd','Unid.','Peso (kg)'].map(h => (
                                            <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {romaneio.itens.map((it, i) => (
                                        <tr key={it.id} className="border-t"
                                            style={{ borderColor: 'var(--color-border)', backgroundColor: i % 2 === 0 ? '#fff' : '#F8FAFC' }}>
                                            <td className="px-3 py-2 font-medium">{it.material?.nome || it.descricao || '—'}</td>
                                            <td className="px-3 py-2 font-data">{Number(it.quantidade).toLocaleString('pt-BR')}</td>
                                            <td className="px-3 py-2">{it.unidade}</td>
                                            <td className="px-3 py-2 font-data">{it.peso_total ? Number(it.peso_total).toLocaleString('pt-BR') : '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
                {romaneio.observacoes && (
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800">
                        <p className="font-medium mb-0.5">Observações:</p>
                        <p>{romaneio.observacoes}</p>
                    </div>
                )}
            </div>
            <div className="flex gap-3 p-5 justify-end border-t flex-shrink-0">
                {(romaneio.pedidos || []).length > 0 && (
                    <button onClick={() => exportRomaneioModelo1(toModelo1Romaneio(romaneio))}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium hover:bg-green-50"
                        style={{ borderColor: '#A7F3D0', color: '#059669' }}
                        title="Exportar no modelo Excel Araguaia (mesmo modelo dos caminhões)">
                        <Icon name="FileSpreadsheet" size={14} color="#059669" /> Exportar Excel
                    </button>
                )}
                <button onClick={() => printRomaneioCarretas(romaneio)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50"
                    style={{ borderColor: 'var(--color-border)' }}>
                    <Icon name="Printer" size={14} /> Imprimir
                </button>
                <button onClick={onClose}
                    className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50"
                    style={{ borderColor: 'var(--color-border)' }}>
                    Fechar
                </button>
            </div>
        </ModalOverlay>
    );
}

// ─── COMPONENTE PRINCIPAL ──────────────────────────────────────────────────────
export default function TabRomaneios({ isAdmin }) {
    const { toast, showToast } = useToast();
    const { confirm, ConfirmDialog } = useConfirm();

    const [guia, setGuia]               = useState('cimento'); // 'cimento' | 'ferragens'
    const [romaneios, setRomaneios]     = useState([]);
    const [romaneiosFerragem, setRomaneiosFerragem] = useState([]);
    const [motoristas, setMotoristas]   = useState([]);
    const [veiculos, setVeiculos]       = useState([]);
    const [empresas, setEmpresas]       = useState([]);
    const [materiais, setMateriais]     = useState([]);
    const [fretesFretas, setFretesFretas] = useState([]);
    const [adminsFrete, setAdminsFrete] = useState([]); // usuários com role 'admin' — quem pode combinar frete fixo
    const [loading, setLoading]         = useState(true);
    const [modal, setModal]             = useState(null);
    const [detailModal, setDetailModal] = useState(null);
    const [filtroStatus, setFiltroStatus] = useState('');
    const mesAtualRomaneios = (() => { const h = new Date(); return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}`; })();
    const [filtroMes, setFiltroMes] = useState(() => {
        try { return sessionStorage.getItem('carretas_romaneios_filtroMes') ?? mesAtualRomaneios; } catch { return mesAtualRomaneios; }
    });
    const handleSetFiltroMes = (v) => {
        setFiltroMes(v);
        try { sessionStorage.setItem('carretas_romaneios_filtroMes', v); } catch {}
    };
    const [filtroDia, setFiltroDia]       = useState(''); // dia específico (YYYY-MM-DD)
    const [periodoCustom, setPeriodoCustom] = useState({ inicio: '', fim: '' }); // tem prioridade sobre dia/mês
    const [usarPeriodo, setUsarPeriodo] = useState(false);
    const [pesquisa, setPesquisa] = useState('');

    const romaneiosFiltrados = useMemo(() => {
        if (!pesquisa.trim()) return romaneios;
        const q = pesquisa.toLowerCase();
        return romaneios.filter(r =>
            (r.numero || '').toLowerCase().includes(q) ||
            (r.motorista?.name || '').toLowerCase().includes(q) ||
            (r.veiculo?.placa || '').toLowerCase().includes(q) ||
            (r.destino || '').toLowerCase().includes(q) ||
            (r.empresa || '').toLowerCase().includes(q) ||
            (r.numero_nf || '').toLowerCase().includes(q) ||
            (r.numero_pedido || '').toLowerCase().includes(q)
        );
    }, [romaneios, pesquisa]);

    const romaneiosFerragemFiltrados = useMemo(() => {
        if (!pesquisa.trim()) return romaneiosFerragem;
        const q = pesquisa.toLowerCase();
        return romaneiosFerragem.filter(r =>
            (r.numero || '').toLowerCase().includes(q) ||
            (r.motorista?.name || '').toLowerCase().includes(q) ||
            (r.veiculo?.placa || '').toLowerCase().includes(q) ||
            (r.destino || '').toLowerCase().includes(q) ||
            (r.empresa || '').toLowerCase().includes(q) ||
            (r.numero_nf || '').toLowerCase().includes(q)
        );
    }, [romaneiosFerragem, pesquisa]);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const f = {};
            if (filtroStatus) f.status = filtroStatus;
            // Período personalizado > dia específico > mês
            if (usarPeriodo && periodoCustom.inicio && periodoCustom.fim) {
                f.dataInicio = periodoCustom.inicio;
                f.dataFim    = periodoCustom.fim;
            } else if (filtroDia) {
                f.dataInicio = filtroDia;
                f.dataFim    = filtroDia;
            } else if (filtroMes) {
                f.dataInicio = filtroMes + '-01';
                f.dataFim    = filtroMes + '-' + String(new Date(
                    Number(filtroMes.split('-')[0]),
                    Number(filtroMes.split('-')[1]), 0
                ).getDate()).padStart(2, '0');
            }
            // Filtro de data da aba "Viagens lançadas pelos motoristas" — mesmo período do
            // mês/dia acima, mas sem o filtro de status (que é exclusivo da aba Romaneios)
            const fFerragem = {};
            if (f.dataInicio) fFerragem.dataInicio = f.dataInicio;
            if (f.dataFim)    fFerragem.dataFim    = f.dataFim;

            const [r, v, m, e, matResult, rf, fr, admins] = await Promise.all([
                fetchRomaneios(f),
                fetchCarretasVeiculos(),
                fetchCarreteirosPropriosOnly(),
                fetchEmpresas(),
                fetchMaterials().catch(err => { console.warn('[TabRomaneios] fetchMaterials falhou:', err); return []; }),
                fetchRomaneiosFerragem(fFerragem),
                fetchFretesCidades('frota'),
                fetchAllUsers().catch(err => { console.warn('[TabRomaneios] fetchAllUsers falhou:', err); return []; }),
            ]);
            // Enriquece materiais com dados do join dos romaneios (garante peso mesmo se catalog parcial)
            const matMap = {};
            (matResult || []).forEach(mat => { matMap[mat.id] = mat; });
            (r || []).forEach(rom => {
                (rom.itens || []).forEach(it => {
                    if (it.material_id && it.material && !matMap[it.material_id]) {
                        matMap[it.material_id] = it.material;
                    } else if (it.material_id && it.material && matMap[it.material_id] && !matMap[it.material_id].peso && it.material.peso) {
                        matMap[it.material_id] = { ...matMap[it.material_id], peso: it.material.peso };
                    }
                });
            });
            const mat = Object.values(matMap).sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
            setRomaneios(r); setVeiculos((v || []).filter(x => !x.is_terceiro)); setMotoristas(m); setEmpresas(e); setMateriais(mat);
            setRomaneiosFerragem(rf || []);
            setFretesFretas(fr || []);
            setAdminsFrete((admins || []).filter(u => u.role === 'admin'));
        } catch (e) { showToast('Erro ao carregar: ' + e.message, 'error'); }
        finally { setLoading(false); }
    }, [filtroStatus, filtroMes, filtroDia, usarPeriodo, periodoCustom]); // eslint-disable-line

    useEffect(() => {
        load();
        // Realtime: sincroniza admin e motorista automaticamente
        const unsub = subscribeTabela('carretas_romaneios', load);
        return unsub;
    }, [load]);
    useRecarregarAoVoltar(load);

    const handleStatusChange = async (id, novoStatus) => {
        try {
            await updateRomaneio(id, { status: novoStatus });
            // Atualiza em ambas as listas (romaneio pode estar em qualquer uma)
            setRomaneios(prev => prev.map(r => r.id === id ? { ...r, status: novoStatus } : r));
            setRomaneiosFerragem(prev => prev.map(r => r.id === id ? { ...r, status: novoStatus } : r));
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };

    const handleDelete = async (id) => {
        const ok = await confirm({
            title: 'Excluir romaneio?',
            message: 'Esta ação não pode ser desfeita.',
            confirmLabel: 'Excluir',
            variant: 'danger',
        });
        if (!ok) return;
        try { await deleteRomaneio(id); showToast('Excluído!', 'warning'); load(); }
        catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };

    const exportar = () => {
        if (!romaneios.length) { showToast('Nenhum romaneio para exportar', 'error'); return; }
        // Uma linha por PEDIDO (não por romaneio) — um romaneio pode ter
        // pedidos de empresas diferentes, então quebrar por pedido é o que
        // permite separar corretamente a receita de frete por empresa.
        // Romaneios sem nenhum pedido (só carga solta) ainda geram 1 linha,
        // usando os dados do próprio romaneio.
        const linhas = [];
        romaneios.forEach(r => {
            const peds = r.pedidos || [];
            if (peds.length === 0) {
                linhas.push({
                    'Romaneio': r.numero, 'Status': r.status, 'Motorista': r.motorista?.name || '', 'Placa': r.veiculo?.placa || '',
                    'Empresa': r.empresa || '', 'Data Saída': FMT_DATE(r.data_saida), 'Nº Pedido': r.numero_pedido || '',
                    'Cidade Destino': r.destino || '', 'NF': r.numero_nf || '',
                    'Valor Pedido (R$)': Number(r.valor_carga || 0), 'Frete (R$)': Number(r.valor_frete || 0),
                });
            } else {
                peds.forEach(p => {
                    const pct = Number(p.percentual_frete || 0.05);
                    linhas.push({
                        'Romaneio': r.numero, 'Status': r.status, 'Motorista': r.motorista?.name || '', 'Placa': r.veiculo?.placa || '',
                        'Empresa': p.empresa || r.empresa || '', 'Data Saída': FMT_DATE(r.data_saida), 'Nº Pedido': p.numero_pedido || '',
                        'Cidade Destino': p.cidade_destino || r.destino || '', 'NF': r.numero_nf || '',
                        'Valor Pedido (R$)': Number(p.valor_pedido || 0), 'Frete (R$)': Number(p.valor_pedido || 0) * pct,
                    });
                });
            }
        });
        // Ordena por Empresa pra ficar tudo agrupado visualmente na planilha
        linhas.sort((a, b) => (a['Empresa'] || 'zzz').localeCompare(b['Empresa'] || 'zzz') || a['Romaneio'].localeCompare(b['Romaneio']));

        const ws = XLSX.utils.json_to_sheet(linhas);
        ws['!cols'] = [10, 16, 20, 12, 22, 12, 12, 22, 12, 14, 14].map(w => ({ wch: w }));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Romaneios por Pedido');

        // Resumo por empresa — total de pedidos, valor de carga e frete gerado,
        // pra ver de cara quanto cada empresa solicitante gerou de receita.
        const porEmpresa = {};
        linhas.forEach(l => {
            const emp = l['Empresa'] || '(sem empresa)';
            if (!porEmpresa[emp]) porEmpresa[emp] = { pedidos: 0, valorCarga: 0, frete: 0 };
            porEmpresa[emp].pedidos++;
            porEmpresa[emp].valorCarga += l['Valor Pedido (R$)'];
            porEmpresa[emp].frete += l['Frete (R$)'];
        });
        const resumoRows = Object.entries(porEmpresa)
            .sort((a, b) => b[1].frete - a[1].frete)
            .map(([emp, v]) => ({
                'Empresa': emp, 'Pedidos': v.pedidos,
                'Valor de Carga (R$)': v.valorCarga, 'Frete Gerado (R$)': v.frete,
            }));
        resumoRows.push({
            'Empresa': 'TOTAL', 'Pedidos': linhas.length,
            'Valor de Carga (R$)': resumoRows.reduce((s, r) => s + r['Valor de Carga (R$)'], 0),
            'Frete Gerado (R$)': resumoRows.reduce((s, r) => s + r['Frete Gerado (R$)'], 0),
        });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumoRows), 'Resumo por Empresa');

        XLSX.writeFile(wb, `romaneios_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.xlsx`);
        showToast('Exportado!', 'success');
    };

    const kpis = useMemo(() => {
        const freteTotal = romaneios.reduce((s, r) => s + Number(r.valor_frete || 0), 0);
        return {
            total:       romaneios.length,
            transito:    romaneios.filter(r => r.status === 'Em Trânsito').length,
            finalizados: romaneios.filter(r => r.status === 'Entrega finalizada').length,
            freteTotal,
        };
    }, [romaneios]);

    return (
        <div>
            {/* ── Guias Cimento / Ferragens ── */}
            <div className="flex gap-1 mb-5 p-1 rounded-xl border" style={{ borderColor: 'var(--color-border)', backgroundColor: '#F9FAFB', width: 'fit-content' }}>
                {[
                    { id: 'cimento',   label: 'Romaneios',                          icon: 'Package',  color: '#1D4ED8' },
                    { id: 'ferragens', label: 'Viagens lançadas pelos motoristas',   icon: 'Truck',    color: '#059669' },
                ].map(g => (
                    <button key={g.id} onClick={() => setGuia(g.id)}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
                        style={guia === g.id
                            ? { backgroundColor: 'white', color: g.color, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', fontWeight: 600 }
                            : { color: 'var(--color-muted-foreground)' }}>
                        <Icon name={g.icon} size={14} color={guia === g.id ? g.color : 'var(--color-muted-foreground)'} />
                        {g.label}
                        <span className="ml-1 text-xs px-1.5 py-0.5 rounded-full font-semibold"
                            style={guia === g.id
                                ? { backgroundColor: g.id === 'cimento' ? '#EFF6FF' : '#ECFDF5', color: g.color }
                                : { backgroundColor: '#F3F4F6', color: 'var(--color-muted-foreground)' }}>
                            {g.id === 'cimento' ? romaneios.length : romaneiosFerragem.length}
                        </span>
                    </button>
                ))}
            </div>

            {/* ═══ GUIA FERRAGENS ═══ */}
            {guia === 'ferragens' && (
                <div>
                    <div className="flex items-center gap-2 p-3 rounded-xl border mb-4" style={{ backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }}>
                        <Icon name="Info" size={14} color="#065F46" />
                        <p className="text-xs" style={{ color: '#065F46' }}>Viagens registradas diretamente pelos motoristas carreteiros no app deles. Use para conferência e acompanhamento.</p>
                    </div>
                    <div className="flex flex-wrap items-end gap-2 mb-4">
                        <div>
                            <input type="month" value={filtroMes} onChange={e => { handleSetFiltroMes(e.target.value); setFiltroDia(''); setUsarPeriodo(false); }}
                                className="px-3 py-2 rounded-lg border text-sm" style={inputStyle}
                                title="Filtrar por mês" />
                        </div>
                        <input type="date" value={filtroDia} onChange={e => { setFiltroDia(e.target.value); handleSetFiltroMes(''); setUsarPeriodo(false); }}
                            className="px-3 py-2 rounded-lg border text-sm" style={inputStyle}
                            title="Filtrar por dia específico" />
                        <button type="button" onClick={() => setUsarPeriodo(v => !v)}
                            className="px-2.5 py-2 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap"
                            style={usarPeriodo
                                ? { backgroundColor: '#EFF6FF', color: '#1D4ED8', borderColor: '#BFDBFE' }
                                : { borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                            {usarPeriodo ? '✓ Período ativo' : 'Usar período'}
                        </button>
                        {usarPeriodo && (
                            <>
                                <input type="date" value={periodoCustom.inicio} onChange={e => setPeriodoCustom(p => ({ ...p, inicio: e.target.value }))}
                                    className="px-2.5 py-2 rounded-lg border text-sm" style={inputStyle} title="Data inicial" />
                                <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>até</span>
                                <input type="date" value={periodoCustom.fim} onChange={e => setPeriodoCustom(p => ({ ...p, fim: e.target.value }))}
                                    className="px-2.5 py-2 rounded-lg border text-sm" style={inputStyle} title="Data final" />
                            </>
                        )}
                        {(filtroMes || filtroDia || usarPeriodo) && (
                            <button onClick={() => { handleSetFiltroMes(''); setFiltroDia(''); setUsarPeriodo(false); setPeriodoCustom({ inicio: '', fim: '' }); }}
                                className="px-2 py-1.5 rounded-lg border text-xs font-medium hover:bg-gray-50 transition-colors"
                                style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}
                                title="Limpar filtro de data">
                                ✕ Data
                            </button>
                        )}
                        <SearchInput value={pesquisa} onChange={setPesquisa} placeholder="Nº, motorista, placa, NF, destino..." />
                    </div>
                    {loading ? (
                        <div className="flex justify-center py-12"><div className="animate-spin h-7 w-7 rounded-full border-4" style={{ borderColor: '#059669', borderTopColor: 'transparent' }} /></div>
                    ) : romaneiosFerragemFiltrados.length === 0 ? (
                        <div className="bg-white rounded-xl border p-12 flex flex-col items-center justify-center gap-3" style={{ borderColor: 'var(--color-border)' }}>
                            <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#ECFDF5' }}>
                                <Icon name="FileText" size={28} color="#059669" />
                            </div>
                            <p className="font-semibold text-sm" style={{ color: 'var(--color-text-primary)' }}>{pesquisa ? `Nenhum resultado para "${pesquisa}"` : 'Nenhum romaneio de ferragens'}</p>
                            <p className="text-xs text-center" style={{ color: 'var(--color-muted-foreground)' }}>Quando um motorista registrar um romaneio de ferragens, ele aparecerá aqui.</p>
                        </div>
                    ) : (
                        <div className="rounded-xl border overflow-hidden shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
                            <table className="w-full text-sm">
                                <thead>
                                    <tr style={{ backgroundColor: '#059669' }}>
                                        {['Nº ROM', 'Vínculo', 'Motorista', 'Placa', 'NF', 'Data Saída', 'Destino', 'Peso', 'Empresa', 'Status'].map(h => (
                                            <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-white whitespace-nowrap">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {romaneiosFerragemFiltrados.map((r, idx) => {
                                        const sc = STATUS_ROMANEIO_COLORS[r.status] || { bg: '#F3F4F6', text: '#6B7280' };
                                        return (
                                            <tr key={r.id} className="border-t hover:bg-green-50/30 transition-colors"
                                                style={{ borderColor: 'var(--color-border)', backgroundColor: idx % 2 === 0 ? 'white' : '#F9FAFB' }}>
                                                <td className="px-3 py-3 font-data font-semibold text-xs" style={{ color: '#059669' }}>{r.numero}</td>
                                                <td className="px-3 py-3 text-xs">
                                                    {r.lancado_por_motorista
                                                        ? <span className="px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: '#DCFCE7', color: '#166534', fontSize: '10px' }}>✓ Vinculado</span>
                                                        : <span className="px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: '#FEF9C3', color: '#92400E', fontSize: '10px' }}>⏳ Aguard. motorista</span>
                                                    }
                                                </td>
                                                <td className="px-3 py-3 text-xs font-medium" style={{ color: 'var(--color-text-primary)' }}>{r.motorista?.name || '—'}</td>
                                                <td className="px-3 py-3 font-data text-xs" style={{ color: 'var(--color-text-primary)' }}>{r.veiculo?.placa || '—'}</td>
                                                <td className="px-3 py-3 font-data font-semibold text-xs" style={{ color: '#1D4ED8' }}>{r.numero_nf || '—'}</td>
                                                <td className="px-3 py-3 font-data text-xs whitespace-nowrap" style={{ color: 'var(--color-text-primary)' }}>{r.data_saida ? FMT_DATE(r.data_saida) : '—'}</td>
                                                <td className="px-3 py-3 text-xs" style={{ color: 'var(--color-text-primary)' }}>{r.destino || '—'}</td>
                                                <td className="px-3 py-3 font-data text-xs text-right" style={{ color: '#7C3AED' }}>
                                                    {r.toneladas ? `${Number(r.toneladas).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} ton` : '—'}
                                                </td>
                                                <td className="px-3 py-3 text-xs" style={{ color: 'var(--color-text-secondary)' }}>{r.empresa || '—'}</td>
                                                <td className="px-3 py-3">
                                                    {isAdmin ? (
                                                        <PrettySelect
                                                            value={r.status}
                                                            onChange={e => handleStatusChange(r.id, e.target.value)}
                                                            className="text-xs font-semibold rounded-full px-2.5 py-1 border-0 cursor-pointer outline-none"
                                                            style={{ backgroundColor: sc.bg, color: sc.text }}
                                                            title="Clique para mudar o status">
                                                            {STATUS_ROMANEIO.map(s => <option key={s} value={s}>{s}</option>)}
                                                        </PrettySelect>
                                                    ) : (
                                                        <span className="text-xs font-medium px-2 py-1 rounded-full whitespace-nowrap" style={{ backgroundColor: sc.bg, color: sc.text }}>{r.status}</span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                            <div className="px-4 py-2 border-t text-xs" style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)', backgroundColor: '#F9FAFB' }}>
                                {romaneiosFerragemFiltrados.length} viagem{romaneiosFerragemFiltrados.length !== 1 ? 's' : ''} registrada{romaneiosFerragemFiltrados.length !== 1 ? 's' : ''} pelo motorista
                            </div>
                        </div>
                    )}
                </div>
            )}

            {guia === 'cimento' && (<>

            {/* ── Toolbar ── */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                <div className="flex flex-wrap gap-2 items-center">
                    <PrettySelect value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}
                        className="px-3 py-2 rounded-lg border text-sm" style={inputStyle}>
                        <option value="">Todos os status</option>
                        {STATUS_ROMANEIO.map(s => <option key={s} value={s}>{s}</option>)}
                    </PrettySelect>
                    <input type="month" value={filtroMes} onChange={e => { handleSetFiltroMes(e.target.value); setFiltroDia(''); setUsarPeriodo(false); }}
                        className="px-3 py-2 rounded-lg border text-sm" style={inputStyle}
                        title="Filtrar por mês" />
                    <input type="date" value={filtroDia} onChange={e => { setFiltroDia(e.target.value); handleSetFiltroMes(''); setUsarPeriodo(false); }}
                        className="px-3 py-2 rounded-lg border text-sm" style={inputStyle}
                        title="Filtrar por dia específico" />
                    <button type="button" onClick={() => setUsarPeriodo(v => !v)}
                        className="px-2.5 py-2 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap"
                        style={usarPeriodo
                            ? { backgroundColor: '#EFF6FF', color: '#1D4ED8', borderColor: '#BFDBFE' }
                            : { borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                        {usarPeriodo ? '✓ Período ativo' : 'Usar período'}
                    </button>
                    {usarPeriodo && (
                        <>
                            <input type="date" value={periodoCustom.inicio} onChange={e => setPeriodoCustom(p => ({ ...p, inicio: e.target.value }))}
                                className="px-2.5 py-2 rounded-lg border text-sm" style={inputStyle} title="Data inicial" />
                            <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>até</span>
                            <input type="date" value={periodoCustom.fim} onChange={e => setPeriodoCustom(p => ({ ...p, fim: e.target.value }))}
                                className="px-2.5 py-2 rounded-lg border text-sm" style={inputStyle} title="Data final" />
                        </>
                    )}
                    {(filtroMes || filtroDia || usarPeriodo) && (
                        <button onClick={() => { handleSetFiltroMes(''); setFiltroDia(''); setUsarPeriodo(false); setPeriodoCustom({ inicio: '', fim: '' }); }}
                            className="px-2 py-1.5 rounded-lg border text-xs font-medium hover:bg-gray-50 transition-colors"
                            style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}
                            title="Limpar filtro de data">
                            ✕ Data
                        </button>
                    )}
                    <SearchInput value={pesquisa} onChange={setPesquisa} placeholder="Nº, motorista, placa, NF, destino..." />
                </div>
                <div className="flex gap-2 flex-wrap">
                    <button onClick={load}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium hover:bg-gray-50 transition-colors"
                        style={{ borderColor: 'var(--color-border)' }} title="Atualizar">
                        <Icon name="RefreshCw" size={14} color="var(--color-muted-foreground)" />
                    </button>
                    {isAdmin && (
                        <>
                            <button onClick={exportar}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium hover:bg-gray-50 transition-colors"
                                style={{ borderColor: 'var(--color-border)' }}>
                                <Icon name="FileDown" size={14} /> Exportar
                            </button>
                            <Button onClick={() => setModal({ mode: 'create' })} iconName="Plus" size="sm">
                                Novo Romaneio
                            </Button>
                        </>
                    )}
                </div>
            </div>

            {/* ── KPIs ── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                {[
                    { l: 'Total',       v: kpis.total,           c: '#1D4ED8', bg: '#EFF6FF', i: 'FileText'    },
                    { l: 'Em Trânsito', v: kpis.transito,        c: '#7C3AED', bg: '#EDE9FE', i: 'Truck'       },
                    { l: 'Finalizados', v: kpis.finalizados,     c: '#065F46', bg: '#D1FAE5', i: 'CheckCircle2' },
                    { l: 'Frete Total', v: BRL(kpis.freteTotal), c: '#B45309', bg: '#FEF9C3', i: 'DollarSign'  },
                ].map(k => (
                    <div key={k.l} className="bg-white rounded-xl border p-4 shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
                        <div className="flex items-center gap-2 mb-1">
                            <div className="rounded-lg flex items-center justify-center" style={{ width: 28, height: 28, backgroundColor: k.bg }}>
                                <Icon name={k.i} size={14} color={k.c} />
                            </div>
                            <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>{k.l}</span>
                        </div>
                        <p className="text-lg font-bold font-data" style={{ color: k.c }}>{k.v}</p>
                    </div>
                ))}
            </div>

            {/* ── Lista de Cards ── */}
            {loading ? (
                <div className="flex justify-center py-16">
                    <div className="animate-spin h-7 w-7 rounded-full border-4"
                        style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
                </div>
            ) : romaneiosFiltrados.length === 0 ? (
                <div className="bg-white rounded-xl border p-12 flex flex-col items-center justify-center gap-2" style={{ borderColor: 'var(--color-border)' }}>
                    <Icon name="FileText" size={40} color="var(--color-muted-foreground)" />
                    <p className="text-sm font-medium" style={{ color: 'var(--color-muted-foreground)' }}>
                        {pesquisa ? `Nenhum resultado para "${pesquisa}"` : 'Nenhum romaneio cadastrado'}
                    </p>
                    {isAdmin && !pesquisa && (
                        <button onClick={() => setModal({ mode: 'create' })}
                            className="mt-2 flex items-center gap-2 mx-auto px-4 py-2 rounded-lg text-sm font-medium text-white"
                            style={{ backgroundColor: 'var(--color-primary)' }}>
                            <Icon name="Plus" size={14} color="white" /> Criar primeiro romaneio
                        </button>
                    )}
                </div>
            ) : (
                <div className="bg-white rounded-xl border shadow-card overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="text-xs font-caption border-b" style={{ backgroundColor: 'var(--color-muted)', borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                                <tr>
                                    <th className="px-3 py-3 text-left font-medium">Número</th>
                                    <th className="px-3 py-3 text-left font-medium hidden sm:table-cell">Motorista</th>
                                    <th className="px-3 py-3 text-left font-medium hidden md:table-cell">Destino</th>
                                    <th className="px-3 py-3 text-left font-medium hidden tab:table-cell">Placa</th>
                                    <th className="px-3 py-3 text-right font-medium hidden tab:table-cell whitespace-nowrap">Peso</th>
                                    <th className="px-3 py-3 text-left font-medium hidden tab:table-cell">Saída</th>
                                    <th className="px-3 py-3 text-left font-medium hidden tab:table-cell">Chegada</th>
                                    <th className="px-3 py-3 text-right font-medium hidden lg:table-cell">Valor Carga</th>
                                    <th className="px-3 py-3 text-right font-medium hidden lg:table-cell">Frete</th>
                                    <th className="px-3 py-3 text-center font-medium">Vínculo</th>
                                    <th className="px-3 py-3 text-center font-medium">Status</th>
                                    <th className="px-3 py-3 text-center font-medium">Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {romaneiosFiltrados.map((r, idx) => {
                                    const statusCfg = STATUS_ROMANEIO_COLORS[r.status] || STATUS_ROMANEIO_COLORS['Aguardando'];
                                    const isCancelado = r.status === 'Cancelado';
                                    const pesoItens = (r.itens || []).reduce((s, it) => s + Number(it.peso_total || 0), 0);
                                    return (
                                        <tr key={r.id} className="border-t transition-colors"
                                            style={{
                                                borderColor: 'var(--color-border)',
                                                borderLeft: isCancelado ? '3px solid #9CA3AF' : '3px solid transparent',
                                                backgroundColor: isCancelado ? '#F9FAFB' : (idx % 2 === 0 ? 'white' : '#F9FAFB'),
                                            }}>
                                            <td className="px-3 py-3">
                                                <button onClick={() => setDetailModal(r)}
                                                    className="font-data text-xs font-semibold hover:underline whitespace-nowrap"
                                                    style={{ color: isCancelado ? '#6B7280' : 'var(--color-primary)', textDecoration: isCancelado ? 'line-through' : 'none' }}>
                                                    {r.numero}
                                                </button>
                                                <p className="text-xs mt-0.5 sm:hidden" style={{ color: isCancelado ? '#9CA3AF' : '#64748b' }}>{r.motorista?.name || ''}</p>
                                            </td>
                                            <td className="px-3 py-3 hidden sm:table-cell" style={{ color: isCancelado ? '#9CA3AF' : 'var(--color-text-primary)' }}>{r.motorista?.name || '—'}</td>
                                            <td className="px-3 py-3 hidden md:table-cell" style={{ color: isCancelado ? '#9CA3AF' : 'var(--color-text-secondary)' }}>{r.destino || '—'}</td>
                                            <td className="px-3 py-3 hidden tab:table-cell font-data text-xs" style={{ color: 'var(--color-text-secondary)' }}>{r.veiculo?.placa || '—'}</td>
                                            <td className="px-3 py-3 text-right hidden tab:table-cell font-data text-xs whitespace-nowrap" style={{ color: 'var(--color-text-secondary)' }}>
                                                {pesoItens > 0 ? `${pesoItens.toLocaleString('pt-BR')} kg` : '—'}
                                            </td>
                                            <td className="px-3 py-3 hidden tab:table-cell text-xs font-caption" style={{ color: 'var(--color-text-secondary)' }}>{FMT_DATE(r.data_saida)}</td>
                                            <td className="px-3 py-3 hidden tab:table-cell text-xs font-caption" style={{ color: 'var(--color-text-secondary)' }}>{FMT_DATE(r.data_chegada)}</td>
                                            <td className="px-3 py-3 text-right hidden lg:table-cell font-data text-xs font-semibold whitespace-nowrap" style={{ color: '#065F46' }}>{r.valor_carga ? BRL(r.valor_carga) : '—'}</td>
                                            <td className="px-3 py-3 text-right hidden lg:table-cell font-data text-xs font-semibold whitespace-nowrap" style={{ color: '#7C3AED' }}>{r.valor_frete ? BRL(r.valor_frete) : '—'}</td>
                                            <td className="px-3 py-3 text-center">
                                                <div className="flex items-center justify-center" title={r.motorista_id ? 'Vinculado a um motorista' : 'Pendente — sem motorista vinculado'}>
                                                    <Icon name={r.motorista_id ? 'CheckCircle2' : 'Clock'} size={20} color={r.motorista_id ? '#059669' : '#9CA3AF'} className="flex-shrink-0" />
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <PrettySelect
                                                    value={r.status}
                                                    onChange={e => handleStatusChange(r.id, e.target.value)}
                                                    className="px-2 py-1 rounded-full text-xs font-medium border cursor-pointer font-caption focus:outline-none"
                                                    style={{ backgroundColor: statusCfg.bg, color: statusCfg.text, borderColor: statusCfg.bg }}>
                                                    {STATUS_ROMANEIO.map(s => <option key={s}>{s}</option>)}
                                                </PrettySelect>
                                            </td>
                                            <td className="px-4 py-3">
                                                <ActionButtonsGroup className="justify-center">
                                                    <ViewButton onClick={() => setDetailModal(r)} title="Ver detalhes" />
                                                    {isAdmin && (<>
                                                        <EditButton onClick={() => setModal({ mode: 'edit', data: r })} />
                                                        <DeleteButton onClick={() => handleDelete(r.id)} />
                                                    </>)}
                                                </ActionButtonsGroup>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    <div className="px-4 py-3 border-t text-xs font-caption text-right" style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                        Exibindo {romaneiosFiltrados.length} de {romaneios.length} romaneios
                    </div>
                </div>
            )}

            {modal && (
                <RomaneioFormModal
                    modal={modal}
                    onClose={() => setModal(null)}
                    onSaved={load}
                    motoristas={motoristas}
                    veiculos={veiculos}
                    empresas={empresas}
                    materiais={materiais}
                    fretesFretas={fretesFretas}
                    adminsFrete={adminsFrete}
                />
            )}

            {detailModal && (
                <RomaneioDetailModal
                    romaneio={detailModal}
                    onClose={() => setDetailModal(null)}
                />
            )}

            </>)} {/* fim guia cimento */}

            <Toast toast={toast} />
            {ConfirmDialog}
        </div>
    );
}
