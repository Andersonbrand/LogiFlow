import React from 'react';

import { CollapseChevron, AppIcon as Icon, PaginationBar } from 'components';

import { BRL, FMT_DATE } from '../../../../utils/helpers';

// ─── guiaDespesas === 'registros' ───
export default function TabRegistros({ categoriasOpen, despesasFiltradas, despesasPag, handleDelete, isAdmin, loading, openEdit, pesquisa, pgBadge, setModalBaixa, setViewDespesa, toggleCategorias, totalPeriodo, totalPorCategoria }) {
    return (
        <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                <div className="bg-white rounded-xl border p-4 shadow-sm sm:col-span-2" style={{ borderColor: 'var(--color-border)' }}>
                    <p className="text-xs mb-1" style={{ color: 'var(--color-muted-foreground)' }}>Total no Período</p>
                    <p className="text-2xl font-bold font-data text-red-600">{BRL(totalPeriodo)}</p>
                </div>
                {totalPorCategoria.slice(0, 2).map(([cat, val]) => (
                    <div key={cat} className="bg-white rounded-xl border p-4 shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
                        <p className="text-xs mb-1 truncate" style={{ color: 'var(--color-muted-foreground)' }}>{cat}</p>
                        <p className="text-lg font-bold font-data text-orange-600">{BRL(val)}</p>
                    </div>
                ))}
            </div>

            {totalPorCategoria.length > 0 && (
                <div className="bg-white rounded-xl border shadow-sm mb-5 overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
                    <button type="button" onClick={toggleCategorias}
                        className="w-full px-4 py-3 flex items-center justify-between gap-2 hover:bg-gray-50 transition-colors">
                        <p className="text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Distribuição por categoria</p>
                        <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-xs font-data font-semibold" style={{ color: '#F97316' }}>{BRL(totalPeriodo)}</span>
                            <CollapseChevron open={categoriasOpen} color="var(--color-text-secondary)" />
                        </div>
                    </button>
                    {categoriasOpen && (
                        <div className="px-4 pb-4 space-y-2">
                            {totalPorCategoria.map(([cat, val]) => {
                                const pct = totalPeriodo > 0 ? (val / totalPeriodo) * 100 : 0;
                                return (
                                    <div key={cat}>
                                        <div className="flex justify-between text-xs mb-1">
                                            <span style={{ color: 'var(--color-text-primary)' }}>{cat}</span>
                                            <span className="font-data font-medium">{BRL(val)} <span style={{ color: 'var(--color-muted-foreground)' }}>({pct.toFixed(1)}%)</span></span>
                                        </div>
                                        <div className="w-full h-1.5 rounded-full bg-gray-100 overflow-hidden">
                                            <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: '#F97316' }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {loading ? <div className="flex justify-center py-12"><div className="animate-spin h-7 w-7 rounded-full border-4" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} /></div> : (
                <div className="bg-white rounded-xl border shadow-sm overflow-x-auto" style={{ borderColor: 'var(--color-border)' }}>
                    <table className="w-full text-sm min-w-[740px]">
                        <thead className="text-xs border-b" style={{ backgroundColor: 'var(--color-muted)', borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                            <tr>{['Data','Placa','Categoria','Fornecedor','Descrição','NF','Pagamento','Valor',''].map(h => <th key={h} className="px-3 py-3 text-left font-medium">{h}</th>)}</tr>
                        </thead>
                        <tbody>
                            {despesasFiltradas.length === 0 ? <tr><td colSpan={9} className="text-center py-12" style={{ color: 'var(--color-muted-foreground)' }}>
                                <div className="flex flex-col items-center gap-2">
                                    <Icon name="Receipt" size={28} color="var(--color-muted-foreground)" />
                                    <span className="text-sm">{pesquisa ? `Nenhum resultado para "${pesquisa}"` : 'Nenhuma despesa registrada'}</span>
                                </div>
                            </td></tr>
                            : despesasPag.pageItems.map((d, i) => (
                                <tr key={d.id} className="border-t hover:bg-gray-50" style={{ borderColor: 'var(--color-border)', backgroundColor: i % 2 === 0 ? '#fff' : '#F8FAFC' }}>
                                    <td className="px-3 py-3 whitespace-nowrap">{FMT_DATE(d.data_despesa)}</td>
                                    <td className="px-3 py-3 font-data">{d.veiculo?.placa || '—'}</td>
                                    <td className="px-3 py-3"><span className="px-2 py-0.5 rounded-full text-xs bg-orange-100 text-orange-700 font-medium">{d.categoria}</span></td>
                                    <td className="px-3 py-3 text-xs max-w-[130px] truncate font-medium" style={{ color: 'var(--color-text-primary)' }}>{d.fornecedor || '—'}</td>
                                    <td className="px-3 py-3 text-xs max-w-[130px] truncate" style={{ color: 'var(--color-muted-foreground)' }}>{d.descricao || '—'}</td>
                                    <td className="px-3 py-3 text-xs font-data" style={{ color: 'var(--color-muted-foreground)' }}>{d.nota_fiscal || '—'}</td>
                                    <td className="px-3 py-3">
                                        {pgBadge(d)}
                                        {(() => {
                                            const boletosPend = (d.boletos || []).filter(b => !b.pago);
                                            const naoEntregues = (d.boletos || []).filter(b => !b.entregue_financeiro);
                                            const numeros = (d.boletos || []).map(b => b.numero_boleto).filter(Boolean);
                                            if (!boletosPend.length) return null;
                                            return (
                                                <div className="mt-1 flex flex-col gap-0.5">
                                                    <span className="text-[11px] text-amber-600 font-data">
                                                        {boletosPend.length} pend.{numeros.length > 0 ? ` (${numeros.join(', ')})` : ''}
                                                    </span>
                                                    {naoEntregues.length > 0 && (
                                                        <span className="text-[11px] text-red-500 flex items-center gap-0.5"><Icon name="AlertCircle" size={9} /> {naoEntregues.length} não entregue{naoEntregues.length > 1 ? 's' : ''}</span>
                                                    )}
                                                </div>
                                            );
                                        })()}
                                    </td>
                                    <td className="px-3 py-3 font-data font-semibold text-red-600">{BRL(d.valor)}</td>
                                    <td className="px-3 py-3">
                                        <div className="flex gap-1 items-center">
                                            <button onClick={() => setViewDespesa(d)} title="Visualizar despesa"
                                                className="p-1.5 rounded hover:bg-indigo-50 transition-colors">
                                                <Icon name="Eye" size={16} color="#4F46E5" />
                                            </button>
                                            <button onClick={() => setModalBaixa(d)}
                                                className="p-1.5 rounded hover:bg-green-50 transition-colors"
                                                title="Dar baixa em pagamentos">
                                                <Icon name="CheckCircle2" size={16} color={(d.forma_pagamento === 'a_prazo' && (d.boletos?.length > 0 || d.parcelas_cartao?.length > 0)) ? "#059669" : "#9CA3AF"} />
                                            </button>
                                            {isAdmin && <button onClick={() => openEdit(d)} className="p-1.5 rounded hover:bg-blue-50 transition-colors"><Icon name="Pencil" size={16} color="#1D4ED8" /></button>}
                                            {isAdmin && <button onClick={() => handleDelete(d.id)} className="p-1.5 rounded hover:bg-red-50 transition-colors"><Icon name="Trash2" size={16} color="#DC2626" /></button>}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <PaginationBar page={despesasPag.page} setPage={despesasPag.setPage} totalPages={despesasPag.totalPages}
                        totalItems={despesasPag.totalItems} pageSize={despesasPag.pageSize} itemLabel="despesa" itemLabelPlural="despesas" />
                </div>
            )}
            </>
    );
}
