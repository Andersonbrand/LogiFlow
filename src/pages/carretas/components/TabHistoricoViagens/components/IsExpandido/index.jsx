import React from 'react';

import { AppIcon as Icon } from 'components';

import { FMT_DATE } from '../../../../utils/helpers';

// ─── isExpandido ───
export default function IsExpandido({ heatColor, m, maxCount }) {
    return (
        <>
                                        {/* Heatmap de destinos */}
                                        <div className="p-5">
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                                {m.destinos.map(d => {
                                                    const cor = heatColor(d.count, maxCount);
                                                    const ultimaData = d.datas.length > 0
                                                        ? d.datas.sort().reverse()[0]
                                                        : null;
                                                    const finalizadas = d.status.filter(s => s === 'Entrega finalizada').length;
                                                    return (
                                                        <div key={d.cidade}
                                                            className="flex items-center gap-3 p-3 rounded-xl border"
                                                            style={{ borderColor: cor.bg === '#F8FAFC' ? 'var(--color-border)' : cor.bg, backgroundColor: cor.bg }}>
                                                            <div className="flex-shrink-0 text-center">
                                                                <p className="text-lg font-bold font-data leading-none" style={{ color: cor.text }}>{d.count}</p>
                                                                <p className="text-xs font-medium" style={{ color: cor.text }}>viag.</p>
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>{d.cidade}</p>
                                                                <div className="flex items-center gap-2 mt-0.5">
                                                                    {ultimaData && (
                                                                        <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                                                                            Última: {FMT_DATE(ultimaData)}
                                                                        </p>
                                                                    )}
                                                                    {finalizadas > 0 && (
                                                                        <span className="text-xs text-green-600">✓{finalizadas}</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            {d.count >= 3 && (
                                                                <div className="flex-shrink-0" title="Rota frequente — considere redistribuir">
                                                                    <Icon name="AlertTriangle" size={14} color="#D97706" />
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* Legenda do heatmap */}
                                        <div className="flex items-center gap-3 px-5 py-2 border-t text-xs" style={{ borderColor: 'var(--color-border)', backgroundColor: '#FAFAFA' }}>
                                            <span style={{ color: 'var(--color-muted-foreground)' }}>Frequência:</span>
                                            {[
                                                { bg: '#F0F9FF', text: '#0369A1', label: 'Raro' },
                                                { bg: '#DCFCE7', text: '#166534', label: 'Moderado' },
                                                { bg: '#FEF9C3', text: '#B45309', label: 'Frequente' },
                                                { bg: '#FEE2E2', text: '#991B1B', label: 'Muito frequente' },
                                            ].map(c => (
                                                <div key={c.label} className="flex items-center gap-1">
                                                    <div className="w-3 h-3 rounded-sm border" style={{ backgroundColor: c.bg, borderColor: c.text + '40' }} />
                                                    <span style={{ color: 'var(--color-muted-foreground)' }}>{c.label}</span>
                                                </div>
                                            ))}
                                        </div>
                                        </>
    );
}
