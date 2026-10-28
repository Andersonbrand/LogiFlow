import React from 'react';

import { AppIcon as Icon, Button, PaginationBar } from 'components';

import { PERIOD_OPTIONS } from '../../utils/constants';
import { BRL } from '../../utils/helpers';

// ─── tab === 'bonificacoes' ───
export default function TabBonificacoes({ bonificacoesComValor, bonificacoesPag, bonusExtras = [], period, periodoCustom, periodoCustomInput, setPeriodoCustom, setPeriodoCustomInput, totais }) {
    return (
        <div className="flex flex-col gap-4">
                                            <div className="bg-white rounded-xl border p-4 shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
                                                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                                                    <h3 className="font-heading font-semibold text-sm" style={{ color: 'var(--color-text-primary)' }}>Filtrar por período específico</h3>
                                                    {(periodoCustom || periodoCustomInput) && (
                                                        <button onClick={() => { setPeriodoCustom(null); setPeriodoCustomInput(null); }}
                                                            className="text-xs font-medium flex items-center gap-1" style={{ color: 'var(--color-primary)' }}>
                                                            <Icon name="X" size={12} /> Limpar filtro
                                                        </button>
                                                    )}
                                                </div>
                                                <div className="flex items-end gap-2 flex-wrap">
                                                    <div>
                                                        <label className="block text-xs mb-1" style={{ color: 'var(--color-muted-foreground)' }}>De</label>
                                                        <input type="date" value={periodoCustomInput?.inicio || ''}
                                                            onChange={e => setPeriodoCustomInput(pc => ({ inicio: e.target.value, fim: pc?.fim || '' }))}
                                                            className="h-10 px-3 rounded-lg border text-sm" style={{ borderColor: 'var(--color-border)' }} />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs mb-1" style={{ color: 'var(--color-muted-foreground)' }}>Até</label>
                                                        <input type="date" value={periodoCustomInput?.fim || ''}
                                                            onChange={e => setPeriodoCustomInput(pc => ({ inicio: pc?.inicio || '', fim: e.target.value }))}
                                                            className="h-10 px-3 rounded-lg border text-sm" style={{ borderColor: 'var(--color-border)' }} />
                                                    </div>
                                                    <Button size="sm" iconName="Search" disabled={!periodoCustomInput?.inicio || !periodoCustomInput?.fim}
                                                        onClick={() => setPeriodoCustom(periodoCustomInput)}>
                                                        Buscar viagens
                                                    </Button>
                                                </div>
                                                {periodoCustom?.inicio && periodoCustom?.fim && (
                                                    <p className="text-xs mt-2" style={{ color: 'var(--color-muted-foreground)' }}>
                                                        <Icon name="Info" size={11} className="inline mr-1" />
                                                        Os cards abaixo mostram os valores de {new Date(periodoCustom.inicio + 'T00:00:00').toLocaleDateString('pt-BR')} até {new Date(periodoCustom.fim + 'T00:00:00').toLocaleDateString('pt-BR')}, em vez do filtro de "{PERIOD_OPTIONS.find(p=>p.days===period)?.label || (typeof period === 'number' ? period + ' dias' : period)}" da barra lateral.
                                                    </p>
                                                )}
                                            </div>
                                            <div className="bg-white rounded-xl border p-4 shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
                                                <h3 className="font-heading font-semibold text-sm mb-3" style={{ color: 'var(--color-text-primary)' }}>Resumo do Período</h3>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>Total Bônus (romaneios + extras)</p>
                                                        <p className="text-2xl font-bold font-data text-purple-600">{BRL(totais.totalBonus)}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>Bônus extras</p>
                                                        <p className="text-xl font-bold font-data text-amber-600">{BRL(totais.totalBonusExtras)}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>Finalizados</p>
                                                        <p className="text-2xl font-bold font-data" style={{ color: 'var(--color-text-primary)' }}>{totais.finalizadas}</p>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex flex-col gap-2">
                                                {bonificacoesComValor.length === 0
                                                    ? <div className="bg-white rounded-xl border p-6 flex flex-col items-center justify-center gap-2" style={{ borderColor: 'var(--color-border)' }}><Icon name="DollarSign" size={24} color="var(--color-muted-foreground)" /><span className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Nenhuma bonificação no período</span></div>
                                                    : bonificacoesPag.pageItems.map(r => (
                                                        <div key={r.id} className="bg-white rounded-xl border p-4 shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
                                                            <div className="flex items-start justify-between mb-2">
                                                                <div>
                                                                    <span className="font-data font-bold text-blue-700 text-sm">{r.numero}</span>
                                                                    <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted-foreground)' }}>{r.destino || '—'}</p>
                                                                </div>
                                                                <p className="font-data font-bold text-purple-600">{BRL(r.bonif?.valorTotal)}</p>
                                                            </div>
                                                            <div className="flex gap-3 text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                                                                {r.bonif?.toneladasFerragem > 0 && <span>{r.bonif.toneladasFerragem.toFixed(3)} t · {BRL(r.bonif.valorFerragem)}</span>}
                                                                {r.bonif?.temCimento && <span>Cimento: {BRL(r.bonif.valorCimento)}</span>}
                                                            </div>
                                                        </div>
                                                    ))
                                                }
                                            </div>
                                            {bonusExtras.length > 0 && (
                                                <div className="bg-white rounded-xl border p-4 shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
                                                    <h3 className="font-heading font-semibold text-sm mb-3" style={{ color: 'var(--color-text-primary)' }}>Bônus extras recebidos</h3>
                                                    <div className="flex flex-col divide-y" style={{ borderColor: 'var(--color-border)' }}>
                                                        {bonusExtras.map(e => (
                                                            <div key={e.id} className="py-2 flex items-start justify-between gap-3">
                                                                <div className="min-w-0">
                                                                    <p className="text-xs font-medium" style={{ color: 'var(--color-text-primary)' }}>{new Date(String(e.data).slice(0, 10) + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
                                                                    <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>{e.observacao || '—'}</p>
                                                                </div>
                                                                <p className="font-data font-bold text-amber-600 flex-shrink-0">{BRL(e.valor)}</p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            <PaginationBar page={bonificacoesPag.page} setPage={bonificacoesPag.setPage} totalPages={bonificacoesPag.totalPages}
                                                totalItems={bonificacoesPag.totalItems} pageSize={bonificacoesPag.pageSize} itemLabel="bonificação" itemLabelPlural="bonificações" className="rounded-xl border bg-white" />
                                        </div>
    );
}
