import React from 'react';

import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Bar, PieChart, Pie, Cell } from 'recharts';

import { AppIcon as Icon } from 'components';

import KpiCard from '../KpiCard';
import { fmtBRL } from '../../utils/helpers';
import ChartCard from '../ChartCard';
import { COLORS } from '../../utils/constants';

// ─── tab === 'financeiro' ───
export default function TabFinanceiroPainel({ despesasFiltradas, despesasPorCategoria, despesasPorMes, totalDespesasCaminhoes }) {
    return (
        <div className="flex flex-col gap-6 mt-2">
                            <div className="flex items-center gap-2 pb-1 border-b border-slate-200">
                                <Icon name="Truck" size={16} color="#1E3A5F" />
                                <p className="text-sm font-semibold text-slate-700">Despesas de Caminhões</p>
                                <span className="ml-auto text-xs text-slate-400">{despesasFiltradas.length} registros no período</span>
                            </div>

                            <div className="grid grid-cols-2 tab:grid-cols-3 gap-4">
                                <KpiCard label="Total de Despesas" value={fmtBRL(totalDespesasCaminhoes)} icon="Receipt" color="#DC2626" sub="Caminhões no período" />
                                <KpiCard label="Categorias" value={despesasPorCategoria.length} icon="Tag" color="#7C3AED" sub="Tipos de despesa" />
                                <KpiCard label="Média por Despesa" value={despesasFiltradas.length > 0 ? fmtBRL(totalDespesasCaminhoes / despesasFiltradas.length) : 'R$ 0,00'} icon="Calculator" color="#D97706" sub="Custo médio por registro" />
                            </div>

                            {despesasPorMes.length > 0 && (
                                <ChartCard title="Despesas por Mês" height={220}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={despesasPorMes}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                                            <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                                            <YAxis tick={{ fontSize: 11 }} tickFormatter={v => 'R$' + (v/1000).toFixed(0) + 'k'} />
                                            <Tooltip formatter={(v) => fmtBRL(v)} />
                                            <Bar dataKey="total" name="Despesas" fill="#DC2626" radius={[4,4,0,0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </ChartCard>
                            )}

                            {despesasPorCategoria.length > 0 && (
                                <div className="grid grid-cols-1 tab:grid-cols-2 gap-5">
                                    <ChartCard title="Despesas por Categoria" height={200}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie data={despesasPorCategoria.filter(d => d.value > 0)} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75}
                                                    label={({ name, percent }) => `${name.length > 10 ? name.slice(0,10)+'…' : name} ${(percent*100).toFixed(0)}%`}>
                                                    {despesasPorCategoria.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                                </Pie>
                                                <Tooltip formatter={v => fmtBRL(v)} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </ChartCard>

                                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                        <div className="px-4 py-3 border-b border-slate-100">
                                            <p className="text-sm font-semibold text-slate-700">Top Categorias</p>
                                        </div>
                                        <div className="divide-y divide-slate-50">
                                            {despesasPorCategoria.slice(0, 6).map((c, i) => (
                                                <div key={i} className="px-4 py-2.5 flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                                                        <span className="text-xs text-slate-700">{c.name}</span>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-xs font-semibold text-slate-800">{fmtBRL(c.value)}</p>
                                                        <p className="text-xs text-slate-400">{totalDespesasCaminhoes > 0 ? ((c.value/totalDespesasCaminhoes)*100).toFixed(1) : 0}%</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {despesasFiltradas.length === 0 && (
                                <div className="bg-white rounded-xl border border-slate-200 p-10 flex flex-col items-center justify-center gap-2">
                                    <Icon name="Truck" size={40} color="#CBD5E1" />
                                    <p className="text-sm font-medium text-slate-400">Nenhuma despesa de caminhão no período</p>
                                    <p className="text-xs text-center text-slate-400">Cadastre despesas no módulo de Despesas Caminhões</p>
                                </div>
                            )}
                        </div>
    );
}
