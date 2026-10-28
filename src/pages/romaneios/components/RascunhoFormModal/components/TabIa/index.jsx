import React from 'react';

import { AppIcon as Icon } from 'components';

import { brl } from '../../../../utils/helpers';

// ─── tab === 'ia' ───
export default function TabIa({ aiLoading, aiSugestao, pedidos, sugerirVeiculo, totais }) {
    return (
        <div className="space-y-4">
                            <div className="p-4 rounded-xl border" style={{ backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }}>
                                <div className="flex items-center justify-between mb-3">
                                    <div>
                                        <p className="text-sm font-semibold" style={{ color: '#065F46' }}>🚛 Sugestão de Veículo</p>
                                        <p className="text-xs mt-0.5" style={{ color: '#059669' }}>Analisa peso, pedidos e veículos disponíveis para recomendar o melhor para esta viagem.</p>
                                    </div>
                                    <button onClick={sugerirVeiculo} disabled={aiLoading}
                                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white disabled:opacity-60 flex-shrink-0 ml-3"
                                        style={{ backgroundColor: '#059669' }}>
                                        {aiLoading
                                            ? <><div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> Consultando...</>
                                            : <><Icon name="Truck" size={13} color="white" /> Sugerir veículo</>}
                                    </button>
                                </div>
                                {aiSugestao ? (
                                    <div className="p-3 rounded-xl bg-white border" style={{ borderColor: '#BBF7D0' }}>
                                        <p className="text-xs leading-relaxed" style={{ color: '#065F46' }}>{aiSugestao}</p>
                                    </div>
                                ) : (
                                    <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>Adicione pedidos e clique em "Sugerir veículo".</p>
                                )}
                            </div>
                            <div className="p-4 rounded-xl border" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-subtle)' }}>
                                <p className="text-xs font-semibold mb-3" style={{ color: 'var(--color-text-secondary)' }}>RESUMO DA CARGA</p>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div><span style={{ color: 'var(--color-muted-foreground)' }}>Peso total:</span> <strong>{totais.peso > 0 ? `${totais.peso.toLocaleString('pt-BR')} kg` : '—'}</strong></div>
                                    <div><span style={{ color: 'var(--color-muted-foreground)' }}>Frete total:</span> <strong style={{ color: '#059669' }}>{brl(totais.frete)}</strong></div>
                                    <div><span style={{ color: 'var(--color-muted-foreground)' }}>Valor carga:</span> <strong>{brl(totais.valorCarga)}</strong></div>
                                    <div><span style={{ color: 'var(--color-muted-foreground)' }}>Nº pedidos:</span> <strong>{pedidos.filter(p => p.numero_pedido).length}</strong></div>
                                </div>
                            </div>
                        </div>
    );
}
