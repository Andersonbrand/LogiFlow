import React from 'react';

import { AppIcon as Icon, Button, PaginationBar } from 'components';

import { PERIOD_OPTIONS } from '../../utils/constants';
import { BRL } from '../../utils/helpers';

// ─── tab === 'bonificacoes' ───
export default function TabBonificacoes({ bonusExtras, bonusExtrasPag, carregamentosComBonus, carregamentosComBonusPag, period, periodoCustom, periodoCustomInput, setPeriodoCustom, setPeriodoCustomInput, totais }) {
    return (
        <div className="flex flex-col gap-4">
                                            {/* Filtro de período personalizado */}
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
                                            {/* Resumo */}
                                            <div className="bg-white rounded-xl border p-4 shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
                                                <h3 className="font-heading font-semibold text-sm mb-3" style={{ color: 'var(--color-text-primary)' }}>Resumo do Período</h3>
                                                <div className="grid grid-cols-3 gap-3">
                                                    <div>
                                                        <p className="text-xs font-caption" style={{ color: 'var(--color-muted-foreground)' }}>Bônus Viagens</p>
                                                        <p className="text-xl font-bold font-data text-purple-600">{BRL(totais.totalBonusViagens)}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-caption" style={{ color: 'var(--color-muted-foreground)' }}>Bônus Extras</p>
                                                        <p className="text-xl font-bold font-data text-amber-600">{BRL(totais.totalBonusExtras)}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-caption" style={{ color: 'var(--color-muted-foreground)' }}>Total a Receber</p>
                                                        <p className="text-xl font-bold font-data text-emerald-600">{BRL(totais.totalBonus)}</p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Bônus por carregamentos */}
                                            <div>
                                                <p className="text-sm font-semibold px-1 mb-2" style={{ color: 'var(--color-text-secondary)' }}>Bônus por carregamento</p>
                                                <div className="flex flex-col gap-2">
                                                    {carregamentosComBonus.length === 0
                                                        ? <div className="bg-white rounded-xl border p-6 flex flex-col items-center justify-center gap-2" style={{ borderColor: 'var(--color-border)' }}><Icon name="Package" size={24} color="var(--color-muted-foreground)" /><span className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Nenhum carregamento no período</span></div>
                                                        : carregamentosComBonusPag.pageItems.map(c => (
                                                            <div key={c.id} className="bg-white rounded-xl border p-3 flex items-center justify-between shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
                                                                <div>
                                                                    <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{c.destino || '—'}</p>
                                                                    <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted-foreground)' }}>
                                                                        {c.data_carregamento ? new Date(c.data_carregamento + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}
                                                                        {c.veiculo?.placa ? ` · ${c.veiculo.placa}` : ''}
                                                                    </p>
                                                                </div>
                                                                <span className="font-data font-bold text-purple-600">{BRL(c.bonus)}</span>
                                                            </div>
                                                        ))
                                                    }
                                                </div>
                                                <PaginationBar page={carregamentosComBonusPag.page} setPage={carregamentosComBonusPag.setPage} totalPages={carregamentosComBonusPag.totalPages}
                                                    totalItems={carregamentosComBonusPag.totalItems} pageSize={carregamentosComBonusPag.pageSize} itemLabel="carregamento" itemLabelPlural="carregamentos" className="rounded-xl border bg-white mt-2" />
                                            </div>

                                            {/* Bonificações extras */}
                                            <div>
                                                <p className="text-sm font-semibold px-1 mb-2" style={{ color: 'var(--color-text-secondary)' }}>Bonificações extras</p>
                                                <div className="flex flex-col gap-2">
                                                    {bonusExtras.length === 0
                                                        ? <div className="bg-white rounded-xl border p-6 flex flex-col items-center justify-center gap-2" style={{ borderColor: 'var(--color-border)' }}><Icon name="Award" size={24} color="var(--color-muted-foreground)" /><span className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Nenhuma bonificação extra no período</span></div>
                                                        : bonusExtrasPag.pageItems.map(e => (
                                                            <div key={e.id} className="bg-white rounded-xl border p-3 shadow-sm" style={{ borderColor: '#FDE68A', backgroundColor: '#FFFBEB' }}>
                                                                <div className="flex items-center justify-between mb-1">
                                                                    <span className="text-xs font-medium" style={{ color: 'var(--color-muted-foreground)' }}>
                                                                        {e.data ? new Date(e.data + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}
                                                                    </span>
                                                                    <span className="font-data font-bold text-amber-600">{BRL(e.valor)}</span>
                                                                </div>
                                                                <p className="text-sm" style={{ color: 'var(--color-text-primary)' }}>{e.observacao || '—'}</p>
                                                            </div>
                                                        ))
                                                    }
                                                </div>
                                                <PaginationBar page={bonusExtrasPag.page} setPage={bonusExtrasPag.setPage} totalPages={bonusExtrasPag.totalPages}
                                                    totalItems={bonusExtrasPag.totalItems} pageSize={bonusExtrasPag.pageSize} itemLabel="bonificação" itemLabelPlural="bonificações" className="rounded-xl border bg-white mt-2" />
                                            </div>
                                        </div>
    );
}
