import React from 'react';

import { AppIcon as Icon } from 'components';

import { BRL, FMT } from '../../utils/helpers';

// ─── tab === 'diarias' ───
export default function TabDiarias({ diarias, exportarRomaneioComoDialia, handleDeleteDiaria, handleDeleteRomaneio, mes, motorista, openCreateDiaria, openEditDiaria, romaneiosDiarias, setViewDiaria, totalDiarias, totalDiariasAvulsas, totalDiariasRomaneios }) {
    return (
        <div className="space-y-5">
                                    {/* Cards de resumo */}
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        <div className="rounded-xl border p-3" style={{ borderColor: '#C7D2FE', backgroundColor: '#EEF2FF' }}>
                                            <p className="text-xs font-medium text-indigo-600 mb-1">Total Consolidado</p>
                                            <p className="text-2xl font-bold font-data text-indigo-700">{BRL(totalDiarias)}</p>
                                        </div>
                                        <div className="rounded-xl border p-3" style={{ borderColor: '#BBF7D0', backgroundColor: '#F0FDF4' }}>
                                            <p className="text-xs font-medium text-emerald-600 mb-1">Via Romaneios</p>
                                            <p className="text-xl font-bold font-data text-emerald-700">{BRL(totalDiariasRomaneios)}</p>
                                            <p className="text-xs text-emerald-500 mt-0.5">{romaneiosDiarias.length} romaneio{romaneiosDiarias.length !== 1 ? 's' : ''}</p>
                                        </div>
                                        <div className="rounded-xl border p-3 flex items-start justify-between" style={{ borderColor: 'var(--color-border)', backgroundColor: '#F8FAFC' }}>
                                            <div>
                                                <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-muted-foreground)' }}>Diárias Avulsas</p>
                                                <p className="text-xl font-bold font-data" style={{ color: 'var(--color-text-primary)' }}>{BRL(totalDiariasAvulsas)}</p>
                                                <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted-foreground)' }}>{diarias.length} lançamento{diarias.length !== 1 ? 's' : ''}</p>
                                            </div>
                                            <button onClick={openCreateDiaria}
                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white flex-shrink-0"
                                                style={{ backgroundColor: 'var(--color-primary)' }}>
                                                <Icon name="Plus" size={12} color="white" /> Nova
                                            </button>
                                        </div>
                                    </div>

                                    {/* Seção: Diárias de Romaneios */}
                                    <div>
                                        <div className="flex items-center gap-2 mb-3">
                                            <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#D1FAE5' }}>
                                                <Icon name="FileText" size={13} color="#059669" />
                                            </div>
                                            <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Diárias via Romaneios</h3>
                                            <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: '#D1FAE5', color: '#065F46' }}>
                                                Automático
                                            </span>
                                        </div>
                                        {romaneiosDiarias.length === 0 ? (
                                            <div className="flex flex-col items-center justify-center py-8 rounded-xl border border-dashed" style={{ borderColor: '#BBF7D0', backgroundColor: '#F0FDF4' }}>
                                                <Icon name="FileText" size={24} color="#6EE7B7" />
                                                <p className="text-sm mt-2" style={{ color: '#059669' }}>Nenhum romaneio com diária no período</p>
                                                <p className="text-xs mt-1" style={{ color: '#6EE7B7' }}>As diárias vêm do valor de "custo motorista" lançado em cada romaneio</p>
                                            </div>
                                        ) : (
                                            <div className="bg-white rounded-xl border overflow-x-auto" style={{ borderColor: '#BBF7D0' }}>
                                                <table className="w-full text-sm min-w-[500px]">
                                                    <thead className="text-xs border-b" style={{ backgroundColor: '#F0FDF4', borderColor: '#BBF7D0', color: '#065F46' }}>
                                                        <tr>
                                                            {['Romaneio', 'Destino', 'Saída', 'Diária lançada em', 'Status', 'Diária', ''].map(h =>
                                                                <th key={h} className="px-3 py-2.5 text-left font-medium whitespace-nowrap">{h}</th>
                                                            )}
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {romaneiosDiarias.map((r, i) => {
                                                            const statusColors = {
                                                                'Finalizado':  { bg: '#F3F4F6', text: '#374151' },
                                                                'Em Trânsito': { bg: '#D1FAE5', text: '#065F46' },
                                                                'Carregando':  { bg: '#DBEAFE', text: '#1D4ED8' },
                                                                'Aguardando':  { bg: '#FEF9C3', text: '#B45309' },
                                                                'Cancelado':   { bg: '#FEE2E2', text: '#991B1B' },
                                                            };
                                                            const sc = statusColors[r.status] || statusColors['Finalizado'];
                                                            return (
                                                                <tr key={r.id} className="border-t hover:bg-emerald-50/30 transition-colors" style={{ borderColor: '#D1FAE5', backgroundColor: i % 2 === 0 ? '#fff' : '#F0FDF4' }}>
                                                                    <td className="px-3 py-2.5">
                                                                        <span className="font-data font-bold text-blue-700">{r.numero}</span>
                                                                    </td>
                                                                    <td className="px-3 py-2.5 max-w-[150px] truncate text-xs" style={{ color: 'var(--color-muted-foreground)' }}>{r.destino || '—'}</td>
                                                                    <td className="px-3 py-2.5 whitespace-nowrap text-xs">{r.saida ? FMT(r.saida.slice(0,10)) : '—'}</td>
                                                                    <td className="px-3 py-2.5 whitespace-nowrap text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                                                                        {r.diaria_mes_referencia ? FMT(r.diaria_mes_referencia.slice(0,10))
                                                                            : r.diaria_criada_em ? FMT(r.diaria_criada_em.slice(0,10))
                                                                            : (r.saida ? FMT(r.saida.slice(0,10)) : FMT(r.created_at.slice(0,10)))}
                                                                    </td>
                                                                    <td className="px-3 py-2.5">
                                                                        <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: sc.bg, color: sc.text }}>{r.status}</span>
                                                                    </td>
                                                                    <td className="px-3 py-2.5 font-data font-semibold text-emerald-700">{BRL(r.custo_motorista)}</td>
                                                                    <td className="px-3 py-2.5">
                                                                        <div className="flex gap-1">
                                                                            <button onClick={() => setViewDiaria({
                                                                                motorista: { name: motorista.name },
                                                                                veiculo: { placa: r.placa || motorista.veiculo?.placa || '' },
                                                                                data_inicio: r.saida ? r.saida.slice(0,10) : '',
                                                                                quantidade_dias: r.dias_diaria || 1,
                                                                                valor_dia: r.valor_diaria_dia || (r.custo_motorista / (r.dias_diaria || 1)),
                                                                                valor_total: Number(r.custo_motorista || 0),
                                                                                descricao: r.diaria_descricao || r.destino || '',
                                                                                viagem: { numero: r.numero, destino: r.destino },
                                                                                assinatura_logistica: r.assinatura_diaria_logistica || null,
                                                                                assinatura_logistica_at: r.assinatura_diaria_logistica_at || null,
                                                                                assinatura_transporte: r.assinatura_diaria_transporte || null,
                                                                                assinatura_transporte_at: r.assinatura_diaria_transporte_at || null,
                                                                                _romaneioId: r.id,
                                                                                _exportFn: () => exportarRomaneioComoDialia(r),
                                                                            })} title="Visualizar diária" className="p-1.5 rounded hover:bg-emerald-50">
                                                                                <Icon name="Eye" size={13} color="#059669" />
                                                                            </button>
                                                                            <button onClick={() => handleDeleteRomaneio(r.id)} title="Excluir romaneio" className="p-1.5 rounded hover:bg-red-50">
                                                                                <Icon name="Trash2" size={16} color="#DC2626" />
                                                                            </button>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                    <tfoot>
                                                        <tr style={{ backgroundColor: '#D1FAE5', borderTop: '2px solid #6EE7B7' }}>
                                                            <td colSpan={4} className="px-3 py-2 text-xs font-bold text-emerald-800">SUBTOTAL ROMANEIOS</td>
                                                            <td colSpan={3} className="px-3 py-2 font-data font-bold text-emerald-700">{BRL(totalDiariasRomaneios)}</td>
                                                        </tr>
                                                    </tfoot>
                                                </table>
                                            </div>
                                        )}
                                    </div>

                                    {/* Seção: Diárias Avulsas */}
                                    <div>
                                        <div className="flex items-center gap-2 mb-3">
                                            <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#EEF2FF' }}>
                                                <Icon name="CalendarDays" size={13} color="#4F46E5" />
                                            </div>
                                            <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Diárias Avulsas</h3>
                                            <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: '#EEF2FF', color: '#4F46E5' }}>
                                                Manual
                                            </span>
                                        </div>
                                        {diarias.length === 0 ? (
                                            <div className="flex flex-col items-center justify-center py-8 rounded-xl border border-dashed" style={{ borderColor: '#C7D2FE', backgroundColor: '#EEF2FF' }}>
                                                <Icon name="CalendarDays" size={24} color="#A5B4FC" />
                                                <p className="text-sm mt-2 text-indigo-600">Nenhuma diária avulsa no período</p>
                                                <button onClick={openCreateDiaria} className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ backgroundColor: '#4F46E5' }}>
                                                    <Icon name="Plus" size={12} color="white" /> Lançar diária avulsa
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="bg-white rounded-xl border overflow-x-auto" style={{ borderColor: 'var(--color-border)' }}>
                                                <table className="w-full text-sm min-w-[480px]">
                                                    <thead className="text-xs border-b" style={{ backgroundColor: 'var(--color-muted)', borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                                                        <tr>{['Data', 'Dias', 'Valor/Dia', 'Total', 'Descrição', ''].map(h =>
                                                            <th key={h} className="px-3 py-2.5 text-left font-medium whitespace-nowrap">{h}</th>
                                                        )}</tr>
                                                    </thead>
                                                    <tbody>
                                                        {diarias.map((d, i) => (
                                                            <tr key={d.id} className="border-t hover:bg-gray-50" style={{ borderColor: 'var(--color-border)', backgroundColor: i%2===0?'#fff':'#F8FAFC' }}>
                                                                <td className="px-3 py-2.5 whitespace-nowrap">{FMT(d.data_inicio)}</td>
                                                                <td className="px-3 py-2.5 font-data text-center">{d.quantidade_dias}</td>
                                                                <td className="px-3 py-2.5 font-data">{BRL(d.valor_dia)}</td>
                                                                <td className="px-3 py-2.5 font-data font-semibold text-indigo-600">{BRL(d.valor_total)}</td>
                                                                <td className="px-3 py-2.5 text-xs max-w-[180px] truncate" style={{ color: 'var(--color-muted-foreground)' }}>{d.descricao || '—'}</td>
                                                                <td className="px-3 py-2.5">
                                                                    <div className="flex gap-1">
                                                                        <button onClick={() => setViewDiaria(d)} title="Visualizar diária" className="p-1.5 rounded hover:bg-indigo-50"><Icon name="Eye" size={13} color="#4F46E5" /></button>
                                                                        <button onClick={() => openEditDiaria(d)} className="p-1.5 rounded hover:bg-blue-50"><Icon name="Pencil" size={16} color="#1D4ED8" /></button>
                                                                        <button onClick={() => handleDeleteDiaria(d.id)} className="p-1.5 rounded hover:bg-red-50"><Icon name="Trash2" size={16} color="#DC2626" /></button>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                    <tfoot>
                                                        <tr style={{ backgroundColor: '#EEF2FF', borderTop: '2px solid #C7D2FE' }}>
                                                            <td colSpan={3} className="px-3 py-2 text-xs font-bold text-indigo-800">SUBTOTAL AVULSAS</td>
                                                            <td className="px-3 py-2 font-data font-bold text-indigo-700">{BRL(totalDiariasAvulsas)}</td>
                                                            <td colSpan={2} />
                                                        </tr>
                                                    </tfoot>
                                                </table>
                                            </div>
                                        )}
                                    </div>

                                    {/* Linha de total geral */}
                                    {(romaneiosDiarias.length > 0 || diarias.length > 0) && (
                                        <div className="rounded-xl p-4 flex items-center justify-between" style={{ background: 'linear-gradient(135deg, #4F46E5, #7C3AED)' }}>
                                            <div className="flex items-center gap-2">
                                                <Icon name="Wallet" size={18} color="white" />
                                                <span className="text-sm font-semibold text-white">Total Geral de Diárias — {mes}</span>
                                            </div>
                                            <span className="text-xl font-bold font-data text-white">{BRL(totalDiarias)}</span>
                                        </div>
                                    )}
                                </div>
    );
}
