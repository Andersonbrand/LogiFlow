import React from 'react';

import { AppIcon as Icon, PaginationBar } from 'components';

import { FMT_DATE, BRL } from '../../../../utils/helpers';

// ─── subTab === 'viagens' ───
export default function TabViagens({ carregamentosBonosFiltrados, carregamentosBonosPag, pesquisa }) {
    return (
        <div className="bg-white rounded-xl border shadow-sm overflow-x-auto" style={{ borderColor: 'var(--color-border)' }}>
                            <table className="w-full text-sm min-w-[640px]">
                                <thead className="text-xs border-b" style={{ backgroundColor: 'var(--color-muted)', borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                                    <tr>{['Motorista','Placa','Destino','Data','Nota Fiscal','Qtd (sacos)','Bônus'].map(h => <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>)}</tr>
                                </thead>
                                <tbody>
                                    {carregamentosBonosFiltrados.length === 0
                                        ? <tr><td colSpan={7} className="text-center py-10" style={{ color: 'var(--color-muted-foreground)' }}>
                                            <div className="flex flex-col items-center gap-2">
                                                <Icon name="Package" size={24} color="var(--color-muted-foreground)" />
                                                <span className="text-sm">{pesquisa ? `Nenhum resultado para "${pesquisa}"` : 'Nenhum carregamento no período'}</span>
                                            </div>
                                          </td></tr>
                                        : carregamentosBonosPag.pageItems.map((c, i) => (
                                            <tr key={c.id} className="border-t hover:bg-gray-50" style={{ borderColor: 'var(--color-border)', backgroundColor: i % 2 === 0 ? '#fff' : '#F8FAFC' }}>
                                                <td className="px-4 py-3 font-medium">{c.motorista?.name || '—'}</td>
                                                <td className="px-4 py-3 font-data text-xs">{c.veiculo?.placa || '—'}</td>
                                                <td className="px-4 py-3">{c.destino || '—'}</td>
                                                <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-muted-foreground)' }}>{FMT_DATE(c.data_carregamento)}</td>
                                                <td className="px-4 py-3 font-data text-xs">{c.numero_nota_fiscal ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-medium" style={{ backgroundColor: '#EFF6FF', color: '#1D4ED8' }}>NF {c.numero_nota_fiscal}</span> : <span style={{ color: 'var(--color-muted-foreground)' }}>—</span>}</td>
                                                <td className="px-4 py-3 font-data text-right">{Number(c.quantidade || 0).toLocaleString('pt-BR')}</td>
                                                <td className="px-4 py-3 font-data font-semibold text-purple-600">{BRL(c.bonus)}</td>
                                            </tr>
                                        ))
                                    }
                                </tbody>
                            </table>
                            <PaginationBar page={carregamentosBonosPag.page} setPage={carregamentosBonosPag.setPage} totalPages={carregamentosBonosPag.totalPages}
                                totalItems={carregamentosBonosPag.totalItems} pageSize={carregamentosBonosPag.pageSize} itemLabel="carregamento" itemLabelPlural="carregamentos" />
                        </div>
    );
}
