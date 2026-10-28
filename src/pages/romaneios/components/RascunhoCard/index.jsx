import React from 'react';

import { AppIcon as Icon } from 'components';
import { calcularFretePedidoMulti } from 'config/freteConfig';

import { brl } from '../../utils/helpers';

export default function RascunhoCard({ r, onEdit, onDelete, onPromover }) {
    const pedidos  = r.romaneio_pedidos || [];
    const itens    = r.romaneio_itens   || [];
    const pesoTotal  = itens.reduce((s, i) => s + (Number(i.peso_total) || 0), 0);
    const freteTotal = Number(r.valor_frete_calculado || r.valor_frete || 0);
    const valorCarga = Number(r.valor_total_carga || 0);

    return (
        <div className="bg-white rounded-2xl border shadow-sm overflow-hidden" style={{ borderColor: '#FDE68A' }}>
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b" style={{ backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }}>
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#FEF3C7' }}>
                        <Icon name="ClipboardList" size={16} color="#D97706" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm font-bold" style={{ color: '#92400E' }}>Rascunho</p>
                        <p className="text-xs truncate" style={{ color: '#B45309' }}>
                            {r.destino || 'Destino não definido'}{r.motorista ? ` · ${r.motorista}` : ''}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <button onClick={() => onEdit(r)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border hover:bg-amber-50 transition-colors" style={{ borderColor: '#FDE68A', color: '#92400E' }}>
                        <Icon name="Pencil" size={16} color="#92400E" /> Editar
                    </button>
                    <button onClick={() => onDelete(r.id)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border hover:bg-red-50 transition-colors" style={{ borderColor: '#FECACA', color: '#DC2626' }}>
                        <Icon name="Trash2" size={16} color="#DC2626" /> Excluir
                    </button>
                    <button onClick={() => onPromover(r.id)} className="flex items-center gap-1 px-4 py-1.5 rounded-xl text-xs font-semibold text-white hover:opacity-90 transition-opacity" style={{ backgroundColor: '#059669' }}>
                        <Icon name="ArrowRightCircle" size={12} color="white" /> Promover para Romaneio
                    </button>
                </div>
            </div>

            {/* Badges resumo */}
            <div className="px-5 py-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                    { icon: 'FileText',   label: 'Pedidos',     value: pedidos.length > 0 ? `${pedidos.length} pedido${pedidos.length > 1 ? 's' : ''}` : '—', color: '#D97706', bg: '#FFFBEB' },
                    { icon: 'Scale',      label: 'Peso Total',  value: pesoTotal > 0 ? `${pesoTotal.toLocaleString('pt-BR')} kg` : '—',                        color: '#7C3AED', bg: '#FAF5FF' },
                    { icon: 'DollarSign', label: 'Frete Total', value: freteTotal > 0 ? brl(freteTotal) : '—',                                                  color: '#059669', bg: '#ECFDF5' },
                    { icon: 'BarChart2',  label: 'Valor Carga', value: valorCarga > 0 ? brl(valorCarga) : '—',                                                  color: '#1D4ED8', bg: '#EFF6FF' },
                ].map(b => (
                    <div key={b.label} className="flex items-center gap-2 p-3 rounded-xl" style={{ backgroundColor: b.bg }}>
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: b.color + '22' }}>
                            <Icon name={b.icon} size={13} color={b.color} />
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>{b.label}</p>
                            <p className="text-xs font-bold truncate" style={{ color: b.color }}>{b.value}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Chips pedidos */}
            {pedidos.length > 0 && (
                <div className="px-5 pb-4">
                    <p className="text-xs font-semibold mb-2" style={{ color: 'var(--color-text-secondary)' }}>PEDIDOS VINCULADOS</p>
                    <div className="flex flex-wrap gap-2">
                        {pedidos.map((p, i) => {
                            const frete = calcularFretePedidoMulti(p).total;
                            return (
                                <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs" style={{ borderColor: '#FDE68A', backgroundColor: '#FFFBEB' }}>
                                    {p.numero_pedido && <span className="font-semibold" style={{ color: '#92400E' }}>#{p.numero_pedido}</span>}
                                    {p.empresa && <span style={{ color: '#B45309' }}>{p.empresa}</span>}
                                    {frete > 0 && <span className="font-medium" style={{ color: '#059669' }}>{brl(frete)}</span>}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Sugestão IA */}
            {r.sugestao_veiculo && (
                <div className="mx-5 mb-4 p-3 rounded-xl border flex items-start gap-2" style={{ backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }}>
                    <Icon name="Cpu" size={14} color="#059669" />
                    <div>
                        <p className="text-xs font-semibold mb-0.5" style={{ color: '#065F46' }}>Sugestão de veículo</p>
                        <p className="text-xs leading-relaxed" style={{ color: '#059669' }}>{r.sugestao_veiculo}</p>
                    </div>
                </div>
            )}
        </div>
    );
}
