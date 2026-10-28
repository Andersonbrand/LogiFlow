import React from 'react';

import { AppIcon as Icon } from 'components';

const STATUS_ROM = {
    'Aguardando':  { bg: '#FEF9C3', text: '#B45309' },
    'Carregando':  { bg: '#DBEAFE', text: '#1D4ED8' },
    'Em Trânsito': { bg: '#D1FAE5', text: '#065F46' },
    'Finalizado':  { bg: '#F3F4F6', text: '#374151' },
    'Cancelado':   { bg: '#FEE2E2', text: '#991B1B' },
};

// ─── tab === 'viagens' ───
export default function TabViagens({ romaneios }) {
    return (
        <div className="flex flex-col gap-2">
                                            {romaneios.length === 0
                                                ? <div className="bg-white rounded-xl border p-8 flex flex-col items-center justify-center gap-2" style={{ borderColor: 'var(--color-border)' }}><Icon name="FileText" size={28} color="var(--color-muted-foreground)" /><span className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Nenhuma viagem no período</span></div>
                                                : romaneios.map(r => {
                                                    const sc = STATUS_ROM[r.status] || STATUS_ROM['Finalizado'];
                                                    return (
                                                        <div key={r.id} className="bg-white rounded-xl border p-4 shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
                                                            <div className="flex items-start justify-between mb-2">
                                                                <span className="font-data font-bold text-blue-700">{r.numero}</span>
                                                                <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: sc.bg, color: sc.text }}>{r.status}</span>
                                                            </div>
                                                            <p className="text-sm mb-2" style={{ color: 'var(--color-text-primary)' }}>{r.destino || '—'}</p>
                                                            <div className="flex items-center justify-between text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                                                                <div className="flex items-center gap-3">
                                                                    {r.saida && <span>{new Date(r.saida).toLocaleDateString('pt-BR')}</span>}
                                                                    <span className="font-data">{Number(r.peso_total||0).toLocaleString('pt-BR')} kg</span>
                                                                </div>
                                                                {r.aprovado
                                                                    ? <span className="flex items-center gap-1 text-green-600 font-medium"><Icon name="CheckCircle2" size={12} color="#059669" />Aprovado</span>
                                                                    : <span className="flex items-center gap-1 text-amber-600"><Icon name="Clock" size={12} color="#D97706" />Pendente</span>
                                                                }
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            }
                                        </div>
    );
}
