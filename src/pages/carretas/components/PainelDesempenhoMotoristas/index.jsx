import React from 'react';

import { AppIcon as Icon } from 'components';

// ─── Sub-aba: Desempenho de Motoristas (KM, horas, consumo médio, jornada) ───
// Usa só dados que já existem em Pontos de Parada + Abastecimentos — não
// cria nenhuma tabela nova nem altera as telas do motorista.
export default function PainelDesempenhoMotoristas({ dados, alertasDiarios, alertasSemanais, loading, onExport }) {
    const BRL = v => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const fmtHoras = h => `${(Number(h) || 0).toFixed(1).replace('.', ',')}h`;
    const fmtKm = km => `${Math.round(Number(km) || 0).toLocaleString('pt-BR')} km`;

    if (loading) {
        return (
            <div className="flex justify-center py-16">
                <div className="animate-spin h-7 w-7 rounded-full border-4" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
            </div>
        );
    }

    if (!dados.length) {
        return (
            <div className="bg-white rounded-xl border p-12 flex flex-col items-center gap-3" style={{ borderColor: 'var(--color-border)' }}>
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#EFF6FF' }}>
                    <Icon name="Gauge" size={28} color="#1D4ED8" />
                </div>
                <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>Nenhum dado no período selecionado</p>
                <p className="text-xs text-center" style={{ color: 'var(--color-muted-foreground)' }}>
                    Ajuste os filtros de motorista/período acima para ver o desempenho.
                </p>
            </div>
        );
    }

    return (
        <div>
            <div className="flex justify-end mb-3">
                <button onClick={onExport} disabled={!dados.length}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}>
                    <Icon name="Download" size={13} /> Exportar
                </button>
            </div>
            {/* Ranking por motorista */}
            <div className="rounded-xl border overflow-hidden shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b text-xs uppercase tracking-wide" style={{ borderColor: 'var(--color-border)', backgroundColor: '#F9FAFB', color: 'var(--color-muted-foreground)' }}>
                                <th className="px-4 py-3 text-left">Motorista</th>
                                <th className="px-4 py-3 text-right">KM Rodado</th>
                                <th className="px-4 py-3 text-right">Horas Trabalhadas</th>
                                <th className="px-4 py-3 text-right">Paradas</th>
                                <th className="px-4 py-3 text-right">Litros (Diesel)</th>
                                <th className="px-4 py-3 text-right">Gasto Combustível</th>
                                <th className="px-4 py-3 text-right">Consumo (km/L)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {dados.map((d, idx) => (
                                <tr key={d.motoristaId} className="border-t hover:bg-blue-50/30 transition-colors"
                                    style={{ borderColor: 'var(--color-border)', backgroundColor: idx % 2 === 0 ? 'white' : '#F9FAFB' }}>
                                    <td className="px-4 py-3 font-semibold" style={{ color: 'var(--color-text-primary)' }}>{d.nome}</td>
                                    <td className="px-4 py-3 text-right font-data" style={{ color: 'var(--color-text-primary)' }}>{fmtKm(d.kmTotal)}</td>
                                    <td className="px-4 py-3 text-right font-data" style={{ color: 'var(--color-text-primary)' }}>{fmtHoras(d.horasTotal)}</td>
                                    <td className="px-4 py-3 text-right font-data" style={{ color: 'var(--color-muted-foreground)' }}>{d.paradasTotal}</td>
                                    <td className="px-4 py-3 text-right font-data" style={{ color: 'var(--color-muted-foreground)' }}>{d.litrosDiesel.toFixed(1)} L</td>
                                    <td className="px-4 py-3 text-right font-data" style={{ color: 'var(--color-muted-foreground)' }}>{BRL(d.gastoTotal)}</td>
                                    <td className="px-4 py-3 text-right font-data font-semibold" style={{ color: d.consumoMedio ? '#059669' : 'var(--color-muted-foreground)' }}>
                                        {d.consumoMedio ? `${d.consumoMedio.toFixed(2)} km/L` : '—'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="px-4 py-2 border-t text-xs" style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)', backgroundColor: '#F9FAFB' }}>
                    {dados.length} motorista{dados.length !== 1 ? 's' : ''} · consumo médio calculado sobre litros de diesel (arla não entra, pois não move o veículo)
                </div>
            </div>
        </div>
    );
}
