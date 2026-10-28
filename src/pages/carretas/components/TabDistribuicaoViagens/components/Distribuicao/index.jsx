import React from 'react';

import { AppIcon as Icon } from 'components';

// ─── distribuicao ───
export default function Distribuicao({ distribuicaoPorMotorista }) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {distribuicaoPorMotorista.map(m => (
                        <div key={m.motoristaId} className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
                            <div className="px-4 py-2.5 flex items-center gap-2" style={{ backgroundColor: '#F0FDF4' }}>
                                <Icon name="User" size={14} color="#15803D" />
                                <p className="text-sm font-bold truncate" style={{ color: '#15803D' }}>{m.motoristaNome}</p>
                                <span className="text-[10px] ml-auto flex-shrink-0" style={{ color: '#15803D' }}>
                                    {m.viagens.length} viagem{m.viagens.length !== 1 ? 's' : ''}
                                </span>
                            </div>
                            <div className="p-3 space-y-1.5">
                                {m.viagens.length === 0 ? (
                                    <p className="text-xs text-center py-3" style={{ color: 'var(--color-muted-foreground)' }}>Sem viagem nesta rodada</p>
                                ) : m.viagens.map((v, idx) => (
                                    <div key={idx} className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg" style={{ backgroundColor: 'var(--color-background)' }}>
                                        <div className="flex items-center gap-1.5 min-w-0">
                                            <Icon name="MapPin" size={12} color="var(--color-muted-foreground)" />
                                            <span className="text-xs truncate" style={{ color: 'var(--color-text-primary)' }}>{v.destino}</span>
                                        </div>
                                        <div className="flex items-center gap-1 flex-shrink-0">
                                            {v.rodizio && (
                                                <span title="Cidade de rodízio — atribuído por ser quem está há mais tempo sem entregar aqui">
                                                    <Icon name="RefreshCw" size={11} color="#059669" />
                                                </span>
                                            )}
                                            {v.repetido && (
                                                <span title="Repetiu um dos 2 últimos destinos deste motorista — não havia outra opção viável dentro do equilíbrio de viagens">
                                                    <Icon name="AlertTriangle" size={12} color="#D97706" />
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
    );
}
