import React from 'react';

import { AppIcon as Icon } from 'components';

import { BRL, FMT } from '../../utils/helpers';

// ─── tab === 'abastecimentos' ───
export default function TabAbastecimentos({ abast, handleDeleteAbastecimento, openEditAbastecimento, openNovoAbastecimento, totaisAbast }) {
    return (
        <div className="space-y-4">
                                    <div className="flex justify-end">
                                        <button onClick={openNovoAbastecimento}
                                            className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold text-white"
                                            style={{ backgroundColor: 'var(--color-primary)' }}>
                                            <Icon name="Plus" size={15} color="white" /> Novo abastecimento
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                        {[
                                            { l: 'Diesel (L)', v: totaisAbast.litrosDiesel.toLocaleString('pt-BR', { maximumFractionDigits: 1 }), c: '#1D4ED8', bg: '#EFF6FF', i: 'Fuel' },
                                            { l: 'Custo Diesel', v: BRL(totaisAbast.valorDiesel), c: '#1D4ED8', bg: '#EFF6FF', i: 'DollarSign' },
                                            { l: 'Arla 32 (L)', v: totaisAbast.litrosArla.toLocaleString('pt-BR', { maximumFractionDigits: 1 }), c: '#059669', bg: '#D1FAE5', i: 'Droplets' },
                                            { l: 'Total Gasto', v: BRL(totaisAbast.total), c: '#7C3AED', bg: '#EDE9FE', i: 'Receipt' },
                                        ].map(k => (
                                            <div key={k.l} className="bg-gray-50 rounded-xl border p-3" style={{ borderColor: 'var(--color-border)' }}>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <div className="rounded-lg flex items-center justify-center" style={{ width: 26, height: 26, backgroundColor: k.bg }}>
                                                        <Icon name={k.i} size={13} color={k.c} />
                                                    </div>
                                                    <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>{k.l}</span>
                                                </div>
                                                <p className="text-base font-bold font-data" style={{ color: k.c }}>{k.v}</p>
                                            </div>
                                        ))}
                                    </div>
                                    {abast.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-12 rounded-xl border" style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                                            <Icon name="Fuel" size={32} color="var(--color-muted-foreground)" />
                                            <p className="text-sm mt-2 text-center">Nenhum abastecimento registrado no período</p>
                                            <p className="text-xs mt-1 text-center">Os lançamentos do motorista aparecerão aqui</p>
                                            <button onClick={openNovoAbastecimento}
                                                className="mt-4 flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold text-white"
                                                style={{ backgroundColor: 'var(--color-primary)' }}>
                                                <Icon name="Plus" size={15} color="white" /> Lançar abastecimento
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="bg-white rounded-xl border overflow-x-auto" style={{ borderColor: 'var(--color-border)' }}>
                                            <table className="w-full text-sm min-w-[600px]">
                                                <thead className="text-xs border-b" style={{ backgroundColor: 'var(--color-muted)', borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                                                    <tr>{['Data', 'Placa', 'Posto', 'Diesel (L)', 'R$ Diesel', 'Arla (L)', 'R$ Arla', 'Total', ''].map(h =>
                                                        <th key={h} className="px-3 py-2.5 text-left font-medium whitespace-nowrap">{h}</th>
                                                    )}</tr>
                                                </thead>
                                                <tbody>
                                                    {abast.map((a, i) => (
                                                        <tr key={a.id} className="border-t hover:bg-gray-50" style={{ borderColor: 'var(--color-border)', backgroundColor: i % 2 === 0 ? '#fff' : '#F8FAFC' }}>
                                                            <td className="px-3 py-2.5 whitespace-nowrap">{FMT(a.data_abastecimento)}</td>
                                                            <td className="px-3 py-2.5 font-data font-medium text-blue-700">{a.veiculo?.placa || a.veiculo_caminhao_placa || '—'}</td>
                                                            <td className="px-3 py-2.5 text-xs max-w-[120px] truncate" style={{ color: 'var(--color-muted-foreground)' }}>{a.posto || '—'}</td>
                                                            <td className="px-3 py-2.5 font-data text-right text-blue-700">{Number(a.litros_diesel||0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</td>
                                                            <td className="px-3 py-2.5 font-data text-right">{BRL(a.valor_diesel)}</td>
                                                            <td className="px-3 py-2.5 font-data text-right text-emerald-600">{Number(a.litros_arla||0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</td>
                                                            <td className="px-3 py-2.5 font-data text-right text-emerald-700">{BRL(a.valor_arla)}</td>
                                                            <td className="px-3 py-2.5 font-data font-semibold text-right text-purple-600">{BRL(a.valor_total)}</td>
                                                            <td className="px-3 py-2.5">
                                                                <div className="flex gap-1 justify-end">
                                                                    <button onClick={() => openEditAbastecimento(a)} title="Editar" className="p-1.5 rounded hover:bg-blue-50"><Icon name="Pencil" size={16} color="#1D4ED8" /></button>
                                                                    <button onClick={() => handleDeleteAbastecimento(a)} title="Excluir" className="p-1.5 rounded hover:bg-red-50"><Icon name="Trash2" size={16} color="#DC2626" /></button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                                <tfoot>
                                                    <tr style={{ backgroundColor: '#F0F9FF', borderTop: '2px solid #BFDBFE' }}>
                                                        <td colSpan={3} className="px-3 py-2 text-xs font-bold text-blue-800">TOTAL</td>
                                                        <td className="px-3 py-2 font-data font-bold text-right text-blue-700">{totaisAbast.litrosDiesel.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</td>
                                                        <td className="px-3 py-2 font-data font-bold text-right text-blue-700">{BRL(totaisAbast.valorDiesel)}</td>
                                                        <td className="px-3 py-2 font-data font-bold text-right text-emerald-700">{totaisAbast.litrosArla.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</td>
                                                        <td className="px-3 py-2 font-data font-bold text-right text-emerald-700">{BRL(totaisAbast.valorArla)}</td>
                                                        <td className="px-3 py-2 font-data font-bold text-right text-purple-700">{BRL(totaisAbast.total)}</td>
                                                        <td />
                                                    </tr>
                                                </tfoot>
                                            </table>
                                        </div>
                                    )}
                                </div>
    );
}
