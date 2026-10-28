import React from 'react';

import { AppIcon as Icon, PrettySelect } from 'components';
import { calcularFretePedidoMulti, FRETE_CATEGORIAS } from 'config/freteConfig';

import { brl } from '../../../../utils/helpers';

// ─── tab === 'pedidos' ───
export default function TabPedidos({ addCategoriaExtra, addItem, addPedido, buscaPedido, delCategoriaExtra, delItem, delPedido, form, inputCls, inputStyle, materials, openPedidos, pedidos, setBuscaPedido, togglePedido, totais, updCategoriaExtra, updItem, updPedido }) {
    return (
        <div className="space-y-4">
                            <div className="flex items-center gap-2">
                                <div className="relative flex-1">
                                    <Icon name="Search" size={14} color="var(--color-muted-foreground)" className="absolute left-3 top-1/2 -translate-y-1/2" />
                                    <input value={buscaPedido} onChange={e => setBuscaPedido(e.target.value)}
                                        className={inputCls} style={{ ...inputStyle, paddingLeft: 32 }}
                                        placeholder="Buscar por nº do pedido, empresa ou cidade..." />
                                </div>
                                <button onClick={addPedido} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white flex-shrink-0" style={{ backgroundColor: '#D97706' }}>
                                    <Icon name="Plus" size={12} color="white" /> Adicionar pedido
                                </button>
                            </div>

                            {(() => {
                                const termo = buscaPedido.trim().toLowerCase();
                                const visiveis = pedidos
                                    .map((ped, pIdx) => ({ ped, pIdx }))
                                    .filter(({ ped }) => !termo ||
                                        (ped.numero_pedido || '').toLowerCase().includes(termo) ||
                                        (ped.empresa || '').toLowerCase().includes(termo) ||
                                        (ped.cidade_destino || '').toLowerCase().includes(termo));
                                if (visiveis.length === 0) return (
                                    <div className="flex flex-col items-center justify-center py-8 gap-1 rounded-xl border border-dashed" style={{ borderColor: 'var(--color-border)' }}>
                                        <Icon name="SearchX" size={20} color="var(--color-muted-foreground)" />
                                        <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>Nenhum pedido encontrado para "{buscaPedido}"</p>
                                    </div>
                                );
                                return visiveis.map(({ ped, pIdx }) => {
                                const freteMulti = calcularFretePedidoMulti(ped);
                                const frete = freteMulti.total;
                                const temExtras = (ped.categorias_extra || []).some(e => Number(e.valor) > 0);
                                const pct   = (FRETE_CATEGORIAS || []).find(f => f.categoria === ped.categoria_frete)?.percentual || 0;
                                const aberto = openPedidos.has(pIdx);
                                return (
                                    <div key={pIdx} className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
                                        {/* Cabeçalho pedido — clique expande/recolhe */}
                                        <div onClick={() => togglePedido(pIdx)}
                                            className="flex items-center justify-between px-4 py-2 border-b cursor-pointer select-none"
                                            style={{ backgroundColor: 'var(--color-subtle)', borderColor: 'var(--color-border)' }}>
                                            <div className="flex items-center gap-2 min-w-0">
                                                <Icon name={aberto ? 'ChevronDown' : 'ChevronRight'} size={14} color="var(--color-muted-foreground)" />
                                                <span className="text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0" style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}>
                                                    Pedido #{pIdx + 1}
                                                </span>
                                                {ped.numero_pedido && <span className="text-xs font-mono font-semibold" style={{ color: 'var(--color-primary)' }}>#{ped.numero_pedido}</span>}
                                                {!aberto && ped.nome_cliente && <span className="text-xs truncate" style={{ color: 'var(--color-text-secondary)' }}>{ped.nome_cliente}</span>}
                                                {!aberto && ped.empresa && <span className="text-xs truncate" style={{ color: 'var(--color-muted-foreground)' }}>{ped.empresa}</span>}
                                                {!aberto && ped.itens?.length > 0 && <span className="text-xs flex-shrink-0" style={{ color: 'var(--color-muted-foreground)' }}>· {ped.itens.length} item(s)</span>}
                                                {frete > 0 && <span className="text-xs font-semibold flex-shrink-0" style={{ color: '#059669' }}>Frete: {brl(frete)} ({temExtras ? `${(freteMulti.percentualEfetivo*100).toFixed(1)}% médio` : `${(pct * 100).toFixed(0)}%`})</span>}
                                            </div>
                                            {pedidos.length > 1 && (
                                                <button onClick={e => { e.stopPropagation(); delPedido(pIdx); }} className="text-xs flex items-center gap-1 flex-shrink-0" style={{ color: '#DC2626' }}>
                                                    <Icon name="X" size={12} color="#DC2626" /> Remover
                                                </button>
                                            )}
                                        </div>

                                        {aberto && (
                                        <div className="p-4 space-y-3">
                                            {/* Campos do pedido */}
                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                                <div>
                                                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Nº do Pedido</label>
                                                    <input value={ped.numero_pedido} onChange={e => updPedido(pIdx, { numero_pedido: e.target.value })} className={inputCls} style={inputStyle} placeholder="Ex: 37443" />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Empresa</label>
                                                    <PrettySelect value={ped.empresa} onChange={e => updPedido(pIdx, { empresa: e.target.value })} className={inputCls} style={inputStyle}>
                                                        {['Comercial Araguaia', 'Aços Confiance', 'Confiance'].map(e => <option key={e} value={e}>{e}</option>)}
                                                    </PrettySelect>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Valor do Pedido (R$)</label>
                                                    <input type="number" step="0.01" min="0" value={ped.valor_pedido} onChange={e => updPedido(pIdx, { valor_pedido: e.target.value })} className={inputCls} style={inputStyle} placeholder="0,00" />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Categoria de Frete</label>
                                                    <PrettySelect value={ped.categoria_frete} onChange={e => updPedido(pIdx, { categoria_frete: e.target.value })} className={inputCls} style={inputStyle}>
                                                        {(FRETE_CATEGORIAS || []).map(f => <option key={f.categoria} value={f.categoria}>{f.label || f.categoria} ({(f.percentual * 100).toFixed(0)}%)</option>)}
                                                    </PrettySelect>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Cidade Destino do Pedido</label>
                                                    <input value={ped.cidade_destino} onChange={e => updPedido(pIdx, { cidade_destino: e.target.value })} className={inputCls} style={inputStyle} placeholder={form.destino || 'Cidade'} />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Cliente</label>
                                                    <input value={ped.nome_cliente} onChange={e => updPedido(pIdx, { nome_cliente: e.target.value })} className={inputCls} style={inputStyle} placeholder="Nome do cliente" />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Vendedor</label>
                                                    <input value={ped.nome_vendedor} onChange={e => updPedido(pIdx, { nome_vendedor: e.target.value })} className={inputCls} style={inputStyle} placeholder="Nome do vendedor" />
                                                </div>
                                                <div className="flex items-end">
                                                    <div className="w-full p-2.5 rounded-lg border" style={{ backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }}>
                                                        <p className="text-xs" style={{ color: '#065F46' }}>Frete calculado</p>
                                                        <p className="text-sm font-bold" style={{ color: '#059669' }}>{brl(frete)}</p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Categorias extras — quando o pedido mistura materiais de mais de uma
                                                categoria de frete, cada uma com seu próprio percentual */}
                                            <div className="rounded-lg border p-3" style={{ borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' }}>
                                                <div className="flex items-center justify-between mb-2">
                                                    <label className="text-xs font-medium" style={{ color: 'var(--color-text-primary)' }}>
                                                        Outras categorias neste pedido
                                                    </label>
                                                    <button type="button" onClick={() => addCategoriaExtra(pIdx)}
                                                        className="flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg hover:bg-blue-50"
                                                        style={{ color: 'var(--color-primary)' }}>
                                                        <Icon name="Plus" size={12} /> Adicionar categoria
                                                    </button>
                                                </div>
                                                {(ped.categorias_extra || []).length === 0 ? (
                                                    <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                                                        Use isso quando o pedido tiver materiais de mais de uma categoria (ex: Telha 2% + Vergalhão 6% no mesmo pedido).
                                                    </p>
                                                ) : (
                                                    <div className="flex flex-col gap-2">
                                                        <p className="text-[11px]" style={{ color: 'var(--color-muted-foreground)' }}>
                                                            A categoria principal acima ({ped.categoria_frete}) passa a valer sobre o restante do valor do pedido: {brl(freteMulti.valorPrincipal)}.
                                                        </p>
                                                        {ped.categorias_extra.map((extra, eIdx) => (
                                                            <div key={eIdx} className="flex items-center gap-2">
                                                                <PrettySelect value={extra.categoria}
                                                                    onChange={e => updCategoriaExtra(pIdx, eIdx, { categoria: e.target.value })}
                                                                    className="flex-1 h-9 px-2 rounded-lg border border-gray-200 text-xs bg-white">
                                                                    {(FRETE_CATEGORIAS || []).map(f => <option key={f.categoria} value={f.categoria}>{f.label || f.categoria} ({(f.percentual * 100).toFixed(0)}%)</option>)}
                                                                </PrettySelect>
                                                                <input type="number" min="0" step="0.01" value={extra.valor}
                                                                    onChange={e => updCategoriaExtra(pIdx, eIdx, { valor: e.target.value })}
                                                                    placeholder="Valor (R$)"
                                                                    className="w-32 h-9 px-3 rounded-lg border border-gray-200 text-xs bg-white font-mono" />
                                                                <button type="button" onClick={() => delCategoriaExtra(pIdx, eIdx)}
                                                                    className="p-1.5 rounded-lg hover:bg-red-50 flex-shrink-0">
                                                                    <Icon name="X" size={14} color="#DC2626" />
                                                                </button>
                                                            </div>
                                                        ))}
                                                        {freteMulti.valorExtras > Number(ped.valor_pedido || 0) && (
                                                            <p className="text-xs text-red-600 flex items-center gap-1">
                                                                <Icon name="AlertTriangle" size={12} />
                                                                A soma das categorias extras ultrapassa o valor do pedido.
                                                            </p>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Itens / Materiais do pedido */}
                                            <div className="rounded-lg border p-3" style={{ borderColor: '#E9D5FF', backgroundColor: '#FAF5FF' }}>
                                                <div className="flex items-center justify-between mb-2">
                                                    <p className="text-xs font-semibold" style={{ color: '#6D28D9' }}>📦 Materiais / Itens</p>
                                                    <button onClick={() => addItem(pIdx)} className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-white" style={{ backgroundColor: '#7C3AED' }}>
                                                        <Icon name="Plus" size={11} color="white" /> Adicionar
                                                    </button>
                                                </div>
                                                {ped.itens.length === 0 ? (
                                                    <div className="flex flex-col items-center justify-center py-4 gap-1"><Icon name="Package" size={18} color="var(--color-muted-foreground)" /><p className="text-xs text-center" style={{ color: 'var(--color-muted-foreground)' }}>Nenhum material adicionado</p></div>
                                                ) : (
                                                    <div className="space-y-2">
                                                        {ped.itens.map((item, iIdx) => {
                                                            const mat = (materials || []).find(m => m.id === item.material_id);
                                                            const isTelha = item.is_telha_zinco || mat?.is_telha_zinco;
                                                            if (isTelha) {
                                                                return (
                                                                    <div key={iIdx} className="grid grid-cols-4 gap-2 items-end bg-white rounded-lg p-2 border" style={{ borderColor: '#DDD6FE' }}>
                                                                        <div className="col-span-4 sm:col-span-1">
                                                                            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Material</label>
                                                                            <PrettySelect value={item.material_id} onChange={e => updItem(pIdx, iIdx, { material_id: e.target.value })} className={inputCls} style={{ ...inputStyle, fontSize: '11px', padding: '6px 8px' }}>
                                                                                <option value="">Selecione...</option>
                                                                                {(materials || []).map(m => <option key={m.id} value={m.id}>{m.nome} {m.peso ? `(${m.peso}kg/${m.unidade})` : ''}</option>)}
                                                                            </PrettySelect>
                                                                        </div>
                                                                        <div>
                                                                            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Comp. (m)</label>
                                                                            <input type="number" min="0.5" step="0.5" value={item.comprimento_telha} onChange={e => updItem(pIdx, iIdx, { comprimento_telha: e.target.value })} placeholder="Ex: 2.5" className={inputCls} style={{ ...inputStyle, fontSize: '12px', padding: '6px 8px' }} />
                                                                        </div>
                                                                        <div>
                                                                            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Metros totais</label>
                                                                            <input type="number" min="0" step="0.01" value={item.metros_totais} onChange={e => updItem(pIdx, iIdx, { metros_totais: e.target.value })} placeholder="Ex: 100" className={inputCls} style={{ ...inputStyle, fontSize: '12px', padding: '6px 8px' }} />
                                                                        </div>
                                                                        <div className="flex items-end gap-1">
                                                                            <div className="flex-1">
                                                                                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Peças / Peso</label>
                                                                                <div className="px-2 py-1.5 rounded-lg border bg-gray-50 text-xs font-data" style={{ borderColor: '#DDD6FE' }}>
                                                                                    {item.quantidade ? `${item.quantidade} pç` : '—'} · {item.peso_total ? `${Number(item.peso_total).toLocaleString('pt-BR')} kg` : '—'}
                                                                                </div>
                                                                            </div>
                                                                            <button onClick={() => delItem(pIdx, iIdx)} className="mb-0.5 p-1.5 rounded-lg hover:bg-red-50 transition-colors flex-shrink-0">
                                                                                <Icon name="X" size={12} color="#DC2626" />
                                                                            </button>
                                                                        </div>
                                                                        {!item.comprimento_telha && (
                                                                            <p className="col-span-4 text-[11px] flex items-center gap-1" style={{ color: '#B45309' }}>
                                                                                <Icon name="AlertTriangle" size={11} color="#B45309" /> Informe o comprimento de cada telha (m) para calcular peças e peso.
                                                                            </p>
                                                                        )}
                                                                    </div>
                                                                );
                                                            }
                                                            return (
                                                                <div key={iIdx} className="grid grid-cols-4 gap-2 items-end bg-white rounded-lg p-2 border" style={{ borderColor: '#DDD6FE' }}>
                                                                    <div className="col-span-2">
                                                                        <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Material</label>
                                                                        <PrettySelect value={item.material_id} onChange={e => updItem(pIdx, iIdx, { material_id: e.target.value })} className={inputCls} style={{ ...inputStyle, fontSize: '11px', padding: '6px 8px' }}>
                                                                            <option value="">Selecione...</option>
                                                                            {(materials || []).map(m => <option key={m.id} value={m.id}>{m.nome} {m.peso ? `(${m.peso}kg/${m.unidade})` : ''}</option>)}
                                                                        </PrettySelect>
                                                                    </div>
                                                                    <div>
                                                                        <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Qtd ({mat?.unidade || 'un'})</label>
                                                                        <input type="number" min="1" value={item.quantidade} onChange={e => updItem(pIdx, iIdx, { quantidade: e.target.value })} className={inputCls} style={{ ...inputStyle, fontSize: '12px', padding: '6px 8px' }} />
                                                                    </div>
                                                                    <div className="flex items-end gap-1">
                                                                        <div className="flex-1">
                                                                            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Peso (kg)</label>
                                                                            <input type="number" min="0" step="0.1" value={item.peso_total !== '' ? item.peso_total : (item.peso_unit && item.quantidade ? String(Math.round(Number(item.peso_unit) * Number(item.quantidade) * 100) / 100) : '')} onChange={e => updItem(pIdx, iIdx, { peso_total: e.target.value, _manualPeso: true })} className={inputCls} style={{ ...inputStyle, fontSize: '12px', padding: '6px 8px' }} placeholder="auto" />
                                                                        </div>
                                                                        <button onClick={() => delItem(pIdx, iIdx)} className="mb-0.5 p-1.5 rounded-lg hover:bg-red-50 transition-colors flex-shrink-0">
                                                                            <Icon name="X" size={12} color="#DC2626" />
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                                {ped.itens.length > 0 && (
                                                    <p className="text-xs mt-2 font-medium" style={{ color: '#6D28D9' }}>
                                                        Peso do pedido: <strong>{ped.itens.reduce((s, i) => s + Number(i.peso_total || 0), 0).toLocaleString('pt-BR')} kg</strong>
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        )}
                                    </div>
                                );
                                });
                            })()}

                            {/* Resumo totais */}
                            <div className="grid grid-cols-3 gap-3">
                                {[
                                    { label: 'Frete Total', value: brl(totais.frete), color: '#059669', bg: '#ECFDF5' },
                                    { label: 'Valor Carga', value: brl(totais.valorCarga), color: '#1D4ED8', bg: '#EFF6FF' },
                                    { label: 'Peso Total', value: totais.peso > 0 ? `${totais.peso.toLocaleString('pt-BR')} kg` : '—', color: '#7C3AED', bg: '#FAF5FF' },
                                ].map(s => (
                                    <div key={s.label} className="p-3 rounded-xl border text-center" style={{ backgroundColor: s.bg, borderColor: s.color + '44' }}>
                                        <p className="text-xs mb-1" style={{ color: s.color }}>{s.label}</p>
                                        <p className="text-sm font-bold" style={{ color: s.color }}>{s.value}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
    );
}
