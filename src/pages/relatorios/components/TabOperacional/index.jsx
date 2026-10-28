import React from 'react';

import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Bar, PieChart, Pie, Cell } from 'recharts';

import KpiCard from '../KpiCard';
import ChartCard from '../ChartCard';
import { COLORS } from '../../utils/constants';

function fmtKg(n) { return Number(n || 0).toLocaleString('pt-BR') + ' kg'; }

// ─── tab === 'operacional' ───
export default function TabOperacional({ finalizados, mediaDia, periodo, periodoLabel, pesoTotal, porDia, porStatus, topDestinos, totalViagens }) {
    return (
        <div className="flex flex-col gap-6">
                            <div className="grid grid-cols-2 tab:grid-cols-4 gap-4">
                                <KpiCard label="Total de Viagens" value={totalViagens} icon="FileText" color="#1E3A5F" sub={periodoLabel} />
                                <KpiCard label="Finalizadas" value={finalizados} icon="CheckCircle2" color="#059669" sub={`${totalViagens > 0 ? Math.round(finalizados/totalViagens*100) : 0}% do total`} />
                                <KpiCard label="Peso Transportado" value={fmtKg(pesoTotal)} icon="Weight" color="#D97706" sub="Entregas finalizadas" />
                                <KpiCard label="Média / Dia" value={mediaDia} icon="TrendingUp" color="#7C3AED" sub="Viagens por dia" />
                            </div>

                            <div className="grid grid-cols-1 tab:grid-cols-2 gap-5">
                                <ChartCard title={periodo === 'mes' ? `Romaneios por Dia (${periodoLabel})` : 'Romaneios por Dia (últimos 14 dias)'} height={220}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={porDia}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                                            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                                            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                                            <Tooltip />
                                            <Bar dataKey="count" name="Romaneios" fill="#1E3A5F" radius={[4,4,0,0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </ChartCard>

                                <ChartCard title="Status dos Romaneios" height={220}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            {porStatus.filter(d => d.value > 0).length > 0 && (
                                                <Pie data={porStatus.filter(d => d.value > 0)} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`}>
                                                    {porStatus.filter(d => d.value > 0).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                                </Pie>
                                            )}
                                            <Tooltip />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </ChartCard>
                            </div>

                            <ChartCard title="Top Destinos (por número de viagens)" height={220}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={topDestinos} layout="vertical">
                                        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                                        <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                                        <YAxis dataKey="destino" type="category" tick={{ fontSize: 11 }} width={120} />
                                        <Tooltip />
                                        <Bar dataKey="count" name="Viagens" fill="#4A6741" radius={[0,4,4,0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </ChartCard>
                        </div>
    );
}
