import React from 'react';

import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Bar, PieChart, Pie, Cell, Legend } from 'recharts';

import KpiCard from '../KpiCard';
import ChartCard from '../ChartCard';

// ─── tab === 'frota' ───
export default function TabFrota({ disponiveis, emTransito, frota, frotaStatus, manutencao, periodoLabel, utilizacaoMedia, utilizacaoVeiculos, vehicles }) {
    return (
        <div className="flex flex-col gap-6">
                            <div className="grid grid-cols-2 tab:grid-cols-4 gap-4">
                                <KpiCard label="Total de Veículos" value={frota} icon="Truck" color="#1E3A5F" />
                                <KpiCard label="Disponíveis" value={disponiveis} icon="CheckCircle2" color="#059669" sub={frota > 0 ? `${Math.round(disponiveis/frota*100)}% da frota` : ''} />
                                <KpiCard label="Em Trânsito" value={emTransito} icon="Navigation" color="#D97706" />
                                <KpiCard label="Utilização Média" value={`${utilizacaoMedia.toFixed(0)}%`} icon="Activity" color={utilizacaoMedia > 80 ? '#DC2626' : '#059669'} sub={`${periodoLabel}${manutencao > 0 ? ` · ${manutencao} em manutenção` : ''}`} />
                            </div>

                            <div className="grid grid-cols-1 tab:grid-cols-2 gap-5">
                                <ChartCard title={`Utilização por Veículo (%) — ${periodoLabel}`} height={Math.max(200, vehicles.length * 35)}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={utilizacaoVeiculos} layout="vertical">
                                            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                                            <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} tickFormatter={v => v + '%'} />
                                            <YAxis dataKey="placa" type="category" tick={{ fontSize: 11 }} width={80} />
                                            <Tooltip formatter={v => v + '%'} />
                                            <Bar dataKey="utilizacao" name="Utilização" radius={[0,4,4,0]}
                                                fill="#1E3A5F"
                                                label={{ position: 'right', fontSize: 10, formatter: v => v + '%' }} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </ChartCard>

                                <ChartCard title="Status da Frota" height={220}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            {frotaStatus.filter(d => d.value > 0).length > 0 && (
                                                <Pie data={frotaStatus.filter(d => d.value > 0)} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}
                                                    label={({ name, value }) => `${name}: ${value}`}>
                                                    {frotaStatus.filter(d => d.value > 0).map((_, i) => <Cell key={i} fill={['#059669','#D97706','#DC2626'][i]} />)}
                                                </Pie>
                                            )}
                                            <Tooltip />
                                            <Legend />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </ChartCard>
                            </div>

                            {/* Tabela de veículos */}
                            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                <div className="px-5 py-4 border-b border-slate-100">
                                    <p className="text-sm font-semibold text-slate-700">Detalhe da Frota</p>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-slate-50">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Placa</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide hidden tab:table-cell">Tipo</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Cap. Peso</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide hidden lg:table-cell">Cap. Volume</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide hidden tab:table-cell">Utilização</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {vehicles.map((v, i) => (
                                                <tr key={v.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                                                    <td className="px-4 py-2.5">
                                                        <p className="font-data font-bold text-slate-800 text-xs">{v.placa}</p>
                                                        <p className="text-xs text-slate-400 sm:hidden">{v.tipo}</p>
                                                    </td>
                                                    <td className="px-4 py-2.5 text-slate-600 text-xs hidden tab:table-cell">{v.tipo}</td>
                                                    <td className="px-4 py-2.5">
                                                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${
                                                            v.status === 'Disponível' ? 'bg-green-100 text-green-700' :
                                                            v.status === 'Em Trânsito' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                                                            {v.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-2.5 font-data text-xs hidden md:table-cell">{(v.capacidadePeso||0).toLocaleString('pt-BR')} kg</td>
                                                    <td className="px-4 py-2.5 font-data text-xs hidden lg:table-cell">{(v.capacidadeVolume||0).toLocaleString('pt-BR')} m³</td>
                                                    <td className="px-4 py-2.5 hidden tab:table-cell">
                                                        <div className="flex items-center gap-2">
                                                            <div className="flex-1 bg-slate-100 rounded-full h-1.5">
                                                                <div className="h-1.5 rounded-full" style={{ width: `${v.utilizacao||0}%`, backgroundColor: (v.utilizacao||0) > 90 ? '#DC2626' : '#059669' }} />
                                                            </div>
                                                            <span className="text-xs font-data">{v.utilizacao||0}%</span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
    );
}
