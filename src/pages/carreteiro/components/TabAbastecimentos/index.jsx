import React from 'react';

import { AppIcon as Icon } from 'components';

import { BRL, FMT_DATE } from '../../utils/helpers';

// ─── tab === 'abastecimentos' ───
export default function TabAbastecimentos({ abastFiltrados, handleDeleteAbast, handleEditAbast, seletorPlaca, totais }) {
    return (
        <div>
                                            {seletorPlaca && <div className="flex justify-end mb-3">{seletorPlaca}</div>}
                                            <div className="grid grid-cols-2 gap-3 mb-4">
                                                <div className="bg-white rounded-xl border p-3 shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
                                                    <p className="text-xs mb-1" style={{ color: 'var(--color-muted-foreground)' }}>Diesel Total</p>
                                                    <p className="text-lg font-bold font-data text-blue-600">{totais.litrosDiesel.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} L</p>
                                                </div>
                                                <div className="bg-white rounded-xl border p-3 shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
                                                    <p className="text-xs mb-1" style={{ color: 'var(--color-muted-foreground)' }}>Gasto Total</p>
                                                    <p className="text-lg font-bold font-data text-purple-600">{BRL(totais.gastoTotal)}</p>
                                                </div>
                                            </div>
                                            <div className="flex flex-col gap-2">
                                                {abastFiltrados.length === 0
                                                    ? <div className="bg-white rounded-xl border p-6 flex flex-col items-center justify-center gap-2" style={{ borderColor: 'var(--color-border)' }}><Icon name="Fuel" size={24} color="var(--color-muted-foreground)" /><span className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Nenhum abastecimento no período</span></div>
                                                    : abastFiltrados.map(a => (
                                                        <div key={a.id} className="bg-white rounded-xl border p-3 shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
                                                            <div className="flex items-center justify-between mb-1">
                                                                <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{FMT_DATE(a.data_abastecimento)}</span>
                                                                <span className="font-data font-bold text-purple-600">{BRL(a.valor_total)}</span>
                                                            </div>
                                                            <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                                                                <span className="font-data">{a.veiculo?.placa || '—'}</span>
                                                                {a.posto && <span>{a.posto}</span>}
                                                                <span className="text-blue-600">{Number(a.litros_diesel || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} L diesel</span>
                                                                {Number(a.litros_arla) > 0 && <span className="text-emerald-600">{Number(a.litros_arla).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} L arla</span>}
                                                            </div>
                                                            {a.cupom_fiscal && (
                                                                <div className="mt-1 text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                                                                    Cupom: <span className="font-data font-medium" style={{ color: 'var(--color-text-primary)' }}>{a.cupom_fiscal}</span>
                                                                </div>
                                                            )}
                                                            <div className="flex justify-end gap-2 mt-2 pt-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
                                                                <button onClick={() => handleEditAbast(a)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-blue-200 text-blue-600 hover:bg-blue-50">
                                                                    <Icon name="Pencil" size={16} />Editar
                                                                </button>
                                                                <button onClick={() => handleDeleteAbast(a.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-red-200 text-red-600 hover:bg-red-50">
                                                                    <Icon name="Trash2" size={16} />Excluir
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))
                                                }
                                            </div>
                                        </div>
    );
}
