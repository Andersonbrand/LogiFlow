import React from 'react';

import { Button, AppIcon as Icon, PaginationBar } from 'components';

import { FMT_DATE, BRL } from '../../../../utils/helpers';

// ─── subTab === 'extras' ───
export default function TabExtras({ abrirEditExtra, abrirNovaExtra, excluirExtra, extrasFiltrados, extrasPag, isAdmin, pesquisa }) {
    return (
        <div>
                            <div className="flex justify-between items-center mb-4">
                                <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                                    Bonificações avulsas lançadas pelo gestor para cada motorista
                                </p>
                                {isAdmin && (
                                    <Button onClick={abrirNovaExtra} iconName="Plus" size="sm">Nova Bonificação Extra</Button>
                                )}
                            </div>
                            <div className="bg-white rounded-xl border shadow-sm overflow-x-auto" style={{ borderColor: 'var(--color-border)' }}>
                                <table className="w-full text-sm min-w-[600px]">
                                    <thead className="text-xs border-b" style={{ backgroundColor: 'var(--color-muted)', borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                                        <tr>{['Motorista','Data','Valor','Observação','Criado por',''].map(h => <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>)}</tr>
                                    </thead>
                                    <tbody>
                                        {extrasFiltrados.length === 0
                                            ? <tr><td colSpan={6} className="text-center py-10" style={{ color: 'var(--color-muted-foreground)' }}>
                                                <div className="flex flex-col items-center gap-2">
                                                    <Icon name="Award" size={24} color="var(--color-muted-foreground)" />
                                                    <span className="text-sm">{pesquisa ? `Nenhum resultado para "${pesquisa}"` : 'Nenhuma bonificação extra no período'}</span>
                                                </div>
                                              </td></tr>
                                            : extrasPag.pageItems.map((e, i) => (
                                                <tr key={e.id} className="border-t hover:bg-gray-50" style={{ borderColor: 'var(--color-border)', backgroundColor: i % 2 === 0 ? '#fff' : '#F8FAFC' }}>
                                                    <td className="px-4 py-3 font-medium">{e.motorista?.name || '—'}</td>
                                                    <td className="px-4 py-3 whitespace-nowrap">{FMT_DATE(e.data)}</td>
                                                    <td className="px-4 py-3 font-data font-bold text-amber-600">{BRL(e.valor)}</td>
                                                    <td className="px-4 py-3 max-w-[220px]">
                                                        <p className="text-sm line-clamp-2" style={{ color: 'var(--color-text-primary)' }}>{e.observacao || '—'}</p>
                                                    </td>
                                                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-muted-foreground)' }}>{e.criador?.name || '—'}</td>
                                                    <td className="px-4 py-3">
                                                        {isAdmin && (
                                                            <div className="flex gap-1">
                                                                <button onClick={() => abrirEditExtra(e)} className="p-2 rounded hover:bg-blue-50"><Icon name="Pencil" size={16} color="#1D4ED8" /></button>
                                                                <button onClick={() => excluirExtra(e.id)} className="p-2 rounded hover:bg-red-50"><Icon name="Trash2" size={16} color="#DC2626" /></button>
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))
                                        }
                                    </tbody>
                                </table>
                                <PaginationBar page={extrasPag.page} setPage={extrasPag.setPage} totalPages={extrasPag.totalPages}
                                    totalItems={extrasPag.totalItems} pageSize={extrasPag.pageSize} itemLabel="bonificação" itemLabelPlural="bonificações" />
                            </div>
                        </div>
    );
}
