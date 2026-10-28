import React, { useState } from 'react';
import { calcularFretePedidoMulti, FRETE_CATEGORIAS, fmtPct } from 'config/freteConfig';
import { AppIcon as Icon, PrettySelect, Field } from 'components';
import { BRL } from '../../utils/helpers';
import { inputCls, inputStyle } from '../../utils/constants';
import ItemRow from '../ItemRow';

export default function PedidoCardCarretas({ pedido, index, materiais, empresas, onUpdate, onRemove, defaultAberto = false }) {
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
