import React from 'react';

import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Bar, PieChart, Pie, Cell } from 'recharts';

import { AppIcon as Icon } from 'components';

import KpiCard from '../KpiCard';
import { fmtBRL } from '../../utils/helpers';
import ChartCard from '../ChartCard';
import { COLORS } from '../../utils/constants';

// ─── tab === 'financeiro' ───
export default function TabFinanceiro({ custoTotal, custosBreakdown, exportBonificacoesExcel, exportConsolidadoExcel, exportFinanceiroExcel, financeiroPorMes, margemLucro, receitaTotal, romFinalizados, ticketMedio, topRotas }) {
    return (
        <div className="flex flex-col gap-6">
                            <div className="flex flex-wrap gap-2 justify-end">
                                <button onClick={exportFinanceiroExcel}
                                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-colors hover:bg-slate-50 whitespace-nowrap"
                                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>
                                    <Icon name="FileSpreadsheet" size={13} color="currentColor" />
                                    <span className="hidden xs:inline sm:inline">Financeiro Excel</span>
                                    <span className="xs:hidden sm:hidden">Fin.</span>
                                </button>
                                <button onClick={exportBonificacoesExcel}
                                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-colors hover:bg-slate-50 whitespace-nowrap"
                                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>
                                    <Icon name="Award" size={13} color="currentColor" />
                                    <span className="hidden sm:inline">Bonificações</span>
                                    <span className="sm:hidden">Bonif.</span>
                                </button>
                                <button onClick={exportConsolidadoExcel}
                                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap"
                                    style={{ backgroundColor: 'var(--color-primary)', color: 'white' }}>
                                    <Icon name="Download" size={13} color="white" />
                                    <span className="hidden sm:inline">Rel. Consolidado</span>
                                    <span className="sm:hidden">Consolidado</span>
                                </button>
                            </div>

                            <div className="grid grid-cols-2 tab:grid-cols-4 gap-4">
                                <KpiCard label="Receita Total" value={fmtBRL(receitaTotal)} icon="TrendingUp" color="#059669" sub="Fretes cobrados" />
                                <KpiCard label="Custo Total" value={fmtBRL(custoTotal)} icon="TrendingDown" color="#DC2626" sub="Operacional" />
                                <KpiCard label="Margem de Lucro" value={`${margemLucro.toFixed(1)}%`} icon="Percent" color={margemLucro >= 20 ? '#059669' : '#D97706'} sub={fmtBRL(receitaTotal - custoTotal) + ' líquido'} />
                                <KpiCard label="Ticket Médio" value={fmtBRL(ticketMedio)} icon="Receipt" color="#7C3AED" sub="Por viagem finalizada" />
                            </div>

                            {financeiroPorMes.length > 0 ? (
                                <ChartCard title="Receita vs Custo por Mês" height={240}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={financeiroPorMes}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                                            <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                                            <YAxis tick={{ fontSize: 11 }} tickFormatter={v => 'R$' + (v/1000).toFixed(0) + 'k'} />
                                            <Tooltip formatter={(v) => fmtBRL(v)} />
                                            <Legend />
                                            <Bar dataKey="receita" name="Receita" fill="#059669" radius={[4,4,0,0]} />
                                            <Bar dataKey="custo" name="Custo" fill="#DC2626" radius={[4,4,0,0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </ChartCard>
                            ) : (
                                <div className="bg-white rounded-xl border border-slate-200 p-10 flex flex-col items-center justify-center gap-2">
                                    <Icon name="DollarSign" size={40} color="#CBD5E1" />
                                    <p className="text-sm font-medium text-slate-400">Nenhum dado financeiro no período</p>
                                    <p className="text-xs text-center text-slate-400">Cadastre valores de frete e custos nos romaneios finalizados</p>
                                </div>
                            )}

                            <div className="grid grid-cols-1 tab:grid-cols-2 gap-5">
                                {custosBreakdown.length > 0 && (
                                    <ChartCard title="Composição dos Custos" height={200}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                {custosBreakdown.length > 0 && custosBreakdown.some(d => d.value > 0) && (
                                                <Pie data={custosBreakdown.filter(d => d.value > 0)} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75}
                                                    label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`}>
                                                    {custosBreakdown.filter(d => d.value > 0).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                                </Pie>
                                                )}
                                                <Tooltip formatter={v => fmtBRL(v)} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </ChartCard>
                                )}

                                {topRotas.length > 0 && (
                                    <ChartCard title="Top Rotas por Receita" height={200}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={topRotas} layout="vertical">
                                                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                                                <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => 'R$'+(v/1000).toFixed(0)+'k'} />
                                                <YAxis dataKey="destino" type="category" tick={{ fontSize: 10 }} width={100} />
                                                <Tooltip formatter={v => fmtBRL(v)} />
                                                <Bar dataKey="receita" name="Receita" fill="#1E3A5F" radius={[0,4,4,0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </ChartCard>
                                )}
                            </div>

                            {/* Tabela detalhada */}
                            {romFinalizados.length > 0 && (
                                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                    <div className="px-5 py-4 border-b border-slate-100">
                                        <p className="text-sm font-semibold text-slate-700">Detalhe por Romaneio</p>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead className="bg-slate-50">
                                                <tr>
                                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Romaneio</th>
                                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide hidden tab:table-cell">Destino</th>
                                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Frete</th>
                                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Custo</th>
                                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Margem</th>
                                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide hidden tab:table-cell">%</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {romFinalizados.slice(0, 20).map((r, i) => {
                                                    const custo = (r.custo_combustivel||0)+(r.custo_pedagio||0)+(r.custo_motorista||0);
                                                    const margem = (r.valor_frete||0) - custo;
                                                    const pct = r.valor_frete > 0 ? margem/r.valor_frete*100 : 0;
                                                    return (
                                                        <tr key={r.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                                                            <td className="px-3 py-2.5">
                                                                <p className="font-data font-medium text-blue-700 text-xs whitespace-nowrap">{r.numero}</p>
                                                                <p className="text-slate-400 text-xs sm:hidden">{r.destino}</p>
                                                            </td>
                                                            <td className="px-4 py-2.5 text-slate-600 text-xs hidden tab:table-cell">{r.destino}</td>
                                                            <td className="px-4 py-2.5 font-data text-green-700 text-xs">{fmtBRL(r.valor_frete)}</td>
                                                            <td className="px-4 py-2.5 font-data text-red-600 text-xs hidden md:table-cell">{fmtBRL(custo)}</td>
                                                            <td className="px-4 py-2.5 font-data font-semibold text-xs" style={{ color: margem >= 0 ? '#059669' : '#DC2626' }}>{fmtBRL(margem)}</td>
                                                            <td className="px-4 py-2.5 hidden tab:table-cell">
                                                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${pct >= 20 ? 'bg-green-100 text-green-700' : pct >= 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                                                                    {pct.toFixed(1)}%
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
    );
}
