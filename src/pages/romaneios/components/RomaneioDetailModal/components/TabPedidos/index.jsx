import React from 'react';

import { AppIcon as Icon } from 'components';
import { getCategoriaConfig, fmtPct } from 'config/freteConfig';
import { getTelhaInfo } from 'utils/telhaUtils';

import { n, brl } from '../../utils/helpers';

// ─── tab === 'pedidos' ───
export default function TabPedidos({ frete, itens, openPedidos, pedidos, setOpenPedidos, togglePedido, valorCarga }) {
    return (
        <div className="flex flex-col gap-3">
                            {pedidos.length === 0 ? (
                                <div className="text-center py-8" style={{ color:'var(--color-muted-foreground)' }}>
                                    <Icon name="ShoppingCart" size={32} color="currentColor" />
                                    <p className="text-sm mt-2">Nenhum pedido registrado neste romaneio.</p>
                                </div>
                            ) : (<>
                            <div className="flex justify-end">
                                <button onClick={() => setOpenPedidos(s => s.size === pedidos.length ? new Set() : new Set(pedidos.map((_,i)=>i)))}
                                    className="text-xs font-caption font-medium" style={{ color:'var(--color-primary)' }}>
                                    {openPedidos.size === pedidos.length ? 'Recolher todos' : 'Expandir todos'}
                                </button>
                            </div>
                            {pedidos.map((p, i) => {
                                const cfg     = getCategoriaConfig(p.categoria_frete);
                                const fretePed = n(p.frete_calculado) || n(p.valor_pedido) * (n(p.percentual_frete)||0.05);
                                // itens deste pedido
                                const pedItens = itens.filter(it => it.pedido_id === p.id);
                                const aberto = openPedidos.has(i);
                                return (
                                    <div key={i} className="rounded-xl border overflow-hidden" style={{ borderColor: cfg.cor }}>
                                        <div onClick={() => togglePedido(i)}
                                            className="px-4 py-3 flex items-center justify-between cursor-pointer select-none"
                                            style={{ backgroundColor: cfg.bg }}>
                                            <div className="flex items-center gap-2 min-w-0">
                                                <Icon name={aberto ? 'ChevronDown' : 'ChevronRight'} size={14} color={cfg.cor} />
                                                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                                                    style={{ backgroundColor: cfg.cor }}>{i+1}</div>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-medium truncate" style={{ color: cfg.cor }}>
                                                        {p.numero_pedido ? `Pedido ${p.numero_pedido}` : `Pedido ${i+1}`}
                                                    </p>
                                                    {aberto && (
                                                        <p className="text-xs font-caption" style={{ color: cfg.cor, opacity:.7 }}>
                                                            {p.categoria_frete} · {fmtPct(p.percentual_frete)}
                                                            {Array.isArray(p.categorias_extra) && p.categorias_extra.length > 0 &&
                                                                ` + ${p.categorias_extra.map(e => `${e.categoria} (${brl(e.valor)})`).join(', ')}`}
                                                        </p>
                                                    )}
                                                    {!aberto && p.nome_cliente && (
                                                        <p className="text-xs font-caption truncate" style={{ color: cfg.cor, opacity:.7 }}>{p.nome_cliente}</p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="text-right flex-shrink-0">
                                                {aberto && <p className="text-xs font-caption" style={{ color: cfg.cor, opacity:.7 }}>Valor do pedido</p>}
                                                <p className="text-sm font-data font-semibold" style={{ color: cfg.cor }}>{brl(p.valor_pedido)}</p>
                                            </div>
                                        </div>
                                        {aberto && (<>
                                        {(p.nome_cliente || p.nome_vendedor) && (
                                            <div className="px-4 pt-3 flex flex-wrap gap-x-5 gap-y-1 border-t" style={{ borderColor: cfg.cor + '40' }}>
                                                {p.nome_cliente && (
                                                    <span className="text-xs font-caption" style={{ color:'var(--color-text-secondary)' }}>
                                                        <span style={{ color:'var(--color-muted-foreground)' }}>Cliente: </span>{p.nome_cliente}
                                                    </span>
                                                )}
                                                {p.nome_vendedor && (
                                                    <span className="text-xs font-caption" style={{ color:'var(--color-text-secondary)' }}>
                                                        <span style={{ color:'var(--color-muted-foreground)' }}>Vendedor: </span>{p.nome_vendedor}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                        {p.observacao && (
                                            <div className="px-4 pt-3 flex items-start gap-1.5 border-t" style={{ borderColor: cfg.cor + '40' }}>
                                                <Icon name="MessageSquare" size={12} color="#B45309" className="mt-0.5 flex-shrink-0" />
                                                <span className="text-xs font-caption" style={{ color:'#92400E' }}>{p.observacao}</span>
                                            </div>
                                        )}
                                        <div className="px-4 py-3 flex items-center justify-between border-t" style={{ borderColor: cfg.cor + '40' }}>
                                            <span className="text-xs font-caption" style={{ color:'var(--color-muted-foreground)' }}>
                                                Frete calculado: {fmtPct(p.percentual_frete)} × {brl(p.valor_pedido)}
                                            </span>
                                            <span className="text-sm font-data font-bold" style={{ color: cfg.cor }}>{brl(fretePed)}</span>
                                        </div>
                                        {pedItens.length > 0 && (
                                            <div className="px-4 pb-3">
                                                <p className="text-xs font-caption text-gray-400 mb-1.5">Materiais deste pedido</p>
                                                <div className="flex flex-wrap gap-1">
                                                    {pedItens.map((it, j) => {
                                                        const { isTelha: itTelha, compTelha: itComp } = getTelhaInfo(it);
                                                        return (
                                                        <span key={j} className="text-[11px] px-2 py-0.5 rounded bg-gray-100 text-gray-600 font-caption">
                                                            {it.materials?.nome || `Mat.${it.material_id}`} × {it.quantidade}
                                                            {itTelha && itComp > 0 ? ` (${itComp.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}m/pç)` : ''}
                                                        </span>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                        </>)}
                                    </div>
                                );
                            })}
                            </>)}
                            {pedidos.length > 0 && (
                                <div className="rounded-xl border p-4 mt-1" style={{ backgroundColor:'var(--color-muted)', borderColor:'var(--color-border)' }}>
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm font-semibold" style={{ color:'var(--color-text-primary)' }}>Total Frete</span>
                                        <span className="text-lg font-bold font-data text-green-600">{brl(frete)}</span>
                                    </div>
                                    <div className="flex justify-between items-center mt-1">
                                        <span className="text-xs font-caption" style={{ color:'var(--color-muted-foreground)' }}>Valor Total da Carga</span>
                                        <span className="text-sm font-data font-semibold" style={{ color:'var(--color-text-primary)' }}>{brl(valorCarga)}</span>
                                    </div>
                                </div>
                            )}
                        </div>
    );
}
