import React, {    } from 'react';


import { useToast } from 'hooks/useToast';
import { useBonusConfig, useCaptacaoConfig } from 'services/settingsService';
import {            } from 'services/carretas';
import {  } from 'services/custosFrotaService';
import { } from 'services/vehicleService';
import {  } from 'utils/despesasParcelasUtils';
import { PrettySelect, Button, AppIcon as Icon, Toast } from 'components';

import {  BRL } from '../../utils/helpers';
import { inputStyle } from '../../utils/constants';
import { useRelatorioFinanceiroDados, useExportRelatorioFinanceiro } from './hooks';

// ─── TAB: Relatório Financeiro ───────────────────────────────────────────────
export default function TabRelatorioFinanceiro({ isAdmin }) {
    const { toast, showToast } = useToast();
    const { bonusConfig } = useBonusConfig();
    const { captacaoConfig } = useCaptacaoConfig();

    const { periodoInicio, setPeriodoInicio, periodoFim, setPeriodoFim, empresa, setEmpresa, empresas, veiculos, filtroPlaca, setFiltroPlaca, dados, loading, calcularRelatorio, dadosPorPlaca } = useRelatorioFinanceiroDados({ bonusConfig, captacaoConfig, showToast });
    
    
    
    
    
    
    
     
    
    
     const { exportarExcel, exportarPorPlaca } = useExportRelatorioFinanceiro({ bonusConfig, dados, dadosPorPlaca, filtroPlaca, showToast });
    
    
    const fmtPct = v => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;

    return (
        <div>
            {/* ── Filtros ─────────────────────────────────────────────── */}
            <div className="bg-white rounded-xl border p-4 shadow-sm mb-5" style={{ borderColor: 'var(--color-border)' }}>
                <h3 className="font-heading font-semibold text-sm mb-4" style={{ color: 'var(--color-text-primary)' }}>
                    Parâmetros do Relatório
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                    <div>
                        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                            Mês inicial <span className="text-red-500">*</span>
                        </label>
                        <input type="month" value={periodoInicio} onChange={e => setPeriodoInicio(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }} />
                    </div>
                    <div>
                        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                            Mês final <span className="text-red-500">*</span>
                        </label>
                        <input type="month" value={periodoFim} onChange={e => setPeriodoFim(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }} />
                    </div>
                    <div>
                        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                            Filtrar por empresa (opcional)
                        </label>
                        <PrettySelect value={empresa} onChange={e => setEmpresa(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}>
                            <option value="">Todas as empresas</option>
                            {empresas.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
                        </PrettySelect>
                    </div>
                </div>
                <div className="flex flex-wrap gap-3">
                    <Button onClick={calcularRelatorio} iconName={loading ? 'Loader' : 'BarChart3'} disabled={loading}>
                        {loading ? 'Calculando...' : 'Gerar Relatório'}
                    </Button>
                    {dados && (
                        <button onClick={exportarExcel}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50 transition-colors"
                            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}>
                            <Icon name="FileDown" size={16} />
                            Exportar Excel
                        </button>
                    )}
                </div>
            </div>

            {/* ── Resultado ──────────────────────────────────────────────── */}
            {!dados && !loading && (
                <div className="bg-white rounded-xl border p-10 flex flex-col items-center text-center" style={{ borderColor: 'var(--color-border)' }}>
                    <Icon name="BarChart3" size={40} color="var(--color-muted-foreground)" />
                    <p className="text-sm mt-3 font-medium" style={{ color: 'var(--color-muted-foreground)' }}>
                        Selecione o período e clique em "Gerar Relatório"
                    </p>
                </div>
            )}

            {loading && (
                <div className="flex justify-center py-16">
                    <div className="animate-spin h-8 w-8 rounded-full border-4" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
                </div>
            )}

            {dados && !loading && (
                <div className="flex flex-col gap-5">

                    {/* Cabeçalho do período */}
                    <div className="flex items-center gap-2 px-1">
                        <Icon name="Calendar" size={16} color="var(--color-muted-foreground)" />
                        <span className="text-sm font-medium" style={{ color: 'var(--color-muted-foreground)' }}>
                            Período: <strong style={{ color: 'var(--color-text-primary)' }}>{dados.periodo}</strong>
                        </span>
                    </div>

                    {/* ── Cards de margem ─────────────────────────────────── */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                        {[
                            { l: 'Receita Total',     v: BRL(dados.receitaTotal),     c: '#065F46', bg: '#D1FAE5', i: 'TrendingUp',  sub: `${dados.totalCarregamentos} carregamentos + ${dados.totalRomaneios || 0} romaneios` },
                            { l: 'Desp. Combustível', v: BRL(dados.despesaCombustivel), c: '#B45309', bg: '#FEF9C3', i: 'Fuel',        sub: `${dados.litrosDiesel.toFixed(0)}L diesel` },
                            { l: 'Bônus Motoristas',  v: BRL(dados.bonusTotal),       c: '#7C3AED', bg: '#EDE9FE', i: 'Award',       sub: `${dados.viagensFinalizadas} viagens finalizadas` },
                            { l: 'Despesas Extras',   v: BRL(dados.totalDespesasExtras), c: '#EA580C', bg: '#FEF3C7', i: 'Receipt',    sub: `${Object.keys(dados.despesasPorCategoria).length} categoria(s)` },
                            { l: 'Diárias',           v: BRL(dados.totalDiariasLancadas), c: '#4F46E5', bg: '#EEF2FF', i: 'CalendarDays', sub: 'motoristas' },
                            { l: 'Margem Líquida',    v: BRL(dados.margemLiquida),    c: dados.margemLiquida >= 0 ? '#1D4ED8' : '#DC2626', bg: dados.margemLiquida >= 0 ? '#DBEAFE' : '#FEE2E2', i: dados.margemLiquida >= 0 ? 'TrendingUp' : 'TrendingDown', sub: fmtPct(dados.margemPct) },
                        ].map(k => (
                            <div key={k.l} className="bg-white rounded-xl border p-4 shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="rounded-lg flex items-center justify-center" style={{ width: 30, height: 30, backgroundColor: k.bg }}>
                                        <Icon name={k.i} size={15} color={k.c} />
                                    </div>
                                    <span className="text-xs font-medium" style={{ color: 'var(--color-muted-foreground)' }}>{k.l}</span>
                                </div>
                                <p className="text-lg font-bold font-data leading-tight break-all" style={{ color: k.c }}>{k.v}</p>
                                <p className="text-xs mt-1" style={{ color: 'var(--color-muted-foreground)' }}>{k.sub}</p>
                            </div>
                        ))}
                    </div>

                    {/* ── DRE Simplificado ────────────────────────────────── */}
                    <div className="bg-white rounded-xl border shadow-sm overflow-x-auto" style={{ borderColor: 'var(--color-border)' }}>
                        <div className="px-5 py-3 border-b flex items-center gap-2" style={{ borderColor: 'var(--color-border)', backgroundColor: '#F8FAFC' }}>
                            <Icon name="FileText" size={16} color="var(--color-muted-foreground)" />
                            <h3 className="font-heading font-semibold text-sm" style={{ color: 'var(--color-text-primary)' }}>
                                Demonstrativo de Resultado (DRE)
                            </h3>
                        </div>
                        <div className="p-5 space-y-1">

                            {/* Receitas */}
                            <div className="flex justify-between py-2 border-b" style={{ borderColor: '#F1F5F9' }}>
                                <span className="text-xs font-semibold uppercase tracking-wide text-green-700">Receitas</span>
                            </div>
                            <div className="flex justify-between py-1.5 pl-3">
                                <span className="text-sm" style={{ color: 'var(--color-text-primary)' }}>Receita de Fretes</span>
                                <span className="font-data font-semibold text-green-700">{BRL(dados.receitaTotal)}</span>
                            </div>
                            {(dados.receitaCarregamentos > 0 || dados.receitaRomaneios > 0) && (
                                <>
                                    <div className="flex justify-between py-1 pl-6">
                                        <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>↳ Carregamentos ({dados.totalCarregamentos})</span>
                                        <span className="text-xs font-data" style={{ color: 'var(--color-muted-foreground)' }}>{BRL(dados.receitaCarregamentos || 0)}</span>
                                    </div>
                                    {dados.receitaCarregamentos > 0 && dados.valorCaptacaoPorSaco > 0 && (
                                        <div className="ml-6 mb-1 px-3 py-2 rounded-lg" style={{ backgroundColor: '#FAF5FF', border: '1px solid #E9D5FF' }}>
                                            <p className="text-[10px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: '#7C3AED' }}>
                                                Captação × Distribuição (frete de cimento — frota própria)
                                            </p>
                                            <div className="flex justify-between py-0.5">
                                                <span className="text-xs" style={{ color: '#6D28D9' }}>↳ Captação · MOC → Estoque ({dados.totalSacosCarregamentos} sacos × {BRL(dados.valorCaptacaoPorSaco)})</span>
                                                <span className="text-xs font-data font-semibold" style={{ color: '#6D28D9' }}>{BRL(dados.valorCaptacaoTotal)}</span>
                                            </div>
                                            <div className="flex justify-between py-0.5">
                                                <span className="text-xs" style={{ color: '#059669' }}>↳ Distribuição · Estoque → Região</span>
                                                <span className="text-xs font-data font-semibold" style={{ color: '#059669' }}>
                                                    {BRL(dados.valorDistribuicaoTotal)}
                                                    <span className="ml-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: '#D1FAE5', color: '#065F46' }}>
                                                        {dados.percentualDistribuicao.toFixed(1)}%
                                                    </span>
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                    {dados.receitaCarregamentos > 0 && dados.valorCaptacaoPorSaco === 0 && (
                                        <div className="ml-6 mb-1 px-3 py-1.5 rounded-lg text-[11px] flex items-center gap-1.5" style={{ backgroundColor: '#FFFBEB', border: '1px solid #FDE68A', color: '#92400E' }}>
                                            <Icon name="Info" size={11} color="#D97706" />
                                            Configure o "Valor de Captação" em Fretes → Fretes da Frota para ver o detalhamento captação × distribuição aqui.
                                        </div>
                                    )}
                                    <div className="flex justify-between py-1 pl-6">
                                        <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>↳ Romaneios de Carga ({dados.totalRomaneios || 0})</span>
                                        <span className="text-xs font-data" style={{ color: 'var(--color-muted-foreground)' }}>{BRL(dados.receitaRomaneios || 0)}</span>
                                    </div>
                                </>
                            )}
                            {Object.entries(dados.receitaPorEmpresa).map(([nome, val]) => (
                                <div key={nome} className="flex justify-between py-1 pl-6">
                                    <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>↳ {nome}</span>
                                    <span className="text-xs font-data" style={{ color: 'var(--color-muted-foreground)' }}>{BRL(val)}</span>
                                </div>
                            ))}

                            {/* Despesas */}
                            <div className="flex justify-between py-2 border-b mt-2" style={{ borderColor: '#F1F5F9' }}>
                                <span className="text-xs font-semibold uppercase tracking-wide text-amber-700">Despesas</span>
                            </div>
                            <div className="flex justify-between py-1.5 pl-3">
                                <span className="text-sm" style={{ color: 'var(--color-text-primary)' }}>Combustível (Total)</span>
                                <span className="font-data font-semibold text-amber-700">({BRL(dados.despesaCombustivel)})</span>
                            </div>
                            {/* item 6: diesel e arla separados com valores */}
                            <div className="flex justify-between py-1 pl-6">
                                <span className="text-xs text-blue-700 font-medium">↳ 🛢️ Diesel: {dados.litrosDiesel.toFixed(1)} L</span>
                                <span className="text-xs font-data text-blue-700 font-semibold">{BRL(dados.valorDiesel)}</span>
                            </div>
                            {dados.litrosArla > 0 && (
                                <div className="flex justify-between py-1 pl-6">
                                    <span className="text-xs text-emerald-700 font-medium">↳ 💧 Arla 32: {dados.litrosArla.toFixed(1)} L</span>
                                    <span className="text-xs font-data text-emerald-700 font-semibold">{BRL(dados.valorArla)}</span>
                                </div>
                            )}
                            <div className="flex justify-between py-1.5 pl-3">
                                <span className="text-sm" style={{ color: 'var(--color-text-primary)' }}>Bônus Motoristas</span>
                                <span className="font-data font-semibold text-purple-600">({BRL(dados.bonusTotal)})</span>
                            </div>
                            {dados.bonusTotalViagens > 0 && (
                                <div className="flex justify-between py-1 pl-6">
                                    <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>↳ Bônus por viagens</span>
                                    <span className="text-xs font-data" style={{ color: 'var(--color-muted-foreground)' }}>{BRL(dados.bonusTotalViagens)}</span>
                                </div>
                            )}
                            {dados.bonusTotalExtras > 0 && (
                                <div className="flex justify-between py-1 pl-6">
                                    <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>↳ Bonificações extras</span>
                                    <span className="text-xs font-data" style={{ color: 'var(--color-muted-foreground)' }}>{BRL(dados.bonusTotalExtras)}</span>
                                </div>
                            )}
                            {dados.totalDiariasLancadas > 0 && (
                                <div className="flex justify-between py-1.5 pl-3">
                                    <span className="text-sm" style={{ color: 'var(--color-text-primary)' }}>Diárias de Motoristas</span>
                                    <span className="font-data font-semibold text-indigo-600">({BRL(dados.totalDiariasLancadas)})</span>
                                </div>
                            )}
                            {dados.totalDespesasExtras > 0 && (
                                <div className="flex justify-between py-1.5 pl-3">
                                    <span className="text-sm" style={{ color: 'var(--color-text-primary)' }}>Despesas Extras (veículos)</span>
                                    <span className="font-data font-semibold text-orange-600">({BRL(dados.totalDespesasExtras)})</span>
                                </div>
                            )}
                            {dados.totalDespesasExtras > 0 && Object.entries(dados.despesasPorCategoria).map(([cat, val]) => (
                                <div key={cat} className="flex justify-between py-0.5 pl-6">
                                    <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>↳ {cat}</span>
                                    <span className="text-xs font-data" style={{ color: 'var(--color-muted-foreground)' }}>{BRL(val)}</span>
                                </div>
                            ))}
                            {dados.custoRodagemTotalFretes > 0 && (
                                <div className="flex justify-between py-1.5 pl-3">
                                    <span className="text-sm flex items-center gap-1.5" style={{ color: 'var(--color-text-primary)' }}>
                                        Custo de Rodagem (estimado)
                                        <span title="Custo estimado de rodagem (pneus/óleo/manutenção/depreciação etc., rateados por KM e por dia) casado com o destino de cada frete. Configurável em Custos de Rodagem.">
                                            <Icon name="Info" size={12} color="var(--color-muted-foreground)" />
                                        </span>
                                    </span>
                                    <span className="font-data font-semibold text-rose-700">({BRL(dados.custoRodagemEstimado)})</span>
                                </div>
                            )}
                            {dados.custoRodagemSemMatch > 0 && (
                                <div className="flex justify-between py-1 pl-6">
                                    <span className="text-xs" style={{ color: '#B45309' }}>↳ {dados.custoRodagemSemMatch} de {dados.custoRodagemTotalFretes} fretes sem destino cadastrado (não abatidos)</span>
                                </div>
                            )}

                            {/* Separador margem bruta */}
                            <div className="flex justify-between py-2.5 px-3 rounded-lg mt-2" style={{ backgroundColor: '#F0FDF4' }}>
                                <span className="text-sm font-semibold text-green-800">Margem Bruta (−Custos Operacionais)</span>
                                <span className="font-data font-bold text-green-700">{BRL(dados.margemBruta)}</span>
                            </div>

                            {/* Margem líquida */}
                            <div className="flex justify-between py-2.5 px-3 rounded-lg" style={{
                                backgroundColor: dados.margemLiquida >= 0 ? '#EFF6FF' : '#FEF2F2',
                                border: `1px solid ${dados.margemLiquida >= 0 ? '#BFDBFE' : '#FECACA'}`,
                            }}>
                                <div>
                                    <span className="text-sm font-bold" style={{ color: dados.margemLiquida >= 0 ? '#1D4ED8' : '#DC2626' }}>
                                        Margem Líquida
                                    </span>
                                    <span className="ml-2 text-xs px-1.5 py-0.5 rounded-full font-medium"
                                        style={{ backgroundColor: dados.margemLiquida >= 0 ? '#DBEAFE' : '#FEE2E2', color: dados.margemLiquida >= 0 ? '#1D4ED8' : '#DC2626' }}>
                                        {fmtPct(dados.margemPct)}
                                    </span>
                                </div>
                                <span className="font-data font-bold" style={{ color: dados.margemLiquida >= 0 ? '#1D4ED8' : '#DC2626' }}>
                                    {BRL(dados.margemLiquida)}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* ── Receita por empresa ─────────────────────────────── */}
                    {Object.keys(dados.receitaPorEmpresa).length > 0 && (
                        <div className="bg-white rounded-xl border shadow-sm overflow-x-auto" style={{ borderColor: 'var(--color-border)' }}>
                            <div className="px-5 py-3 border-b flex items-center gap-2" style={{ borderColor: 'var(--color-border)', backgroundColor: '#F8FAFC' }}>
                                <Icon name="Building2" size={16} color="var(--color-muted-foreground)" />
                                <h3 className="font-heading font-semibold text-sm" style={{ color: 'var(--color-text-primary)' }}>Receita por Empresa</h3>
                            </div>
                            <div className="p-5 space-y-3">
                                {Object.entries(dados.receitaPorEmpresa)
                                    .sort((a, b) => b[1] - a[1])
                                    .map(([nome, val]) => {
                                        const pct = dados.receitaTotal > 0 ? (val / dados.receitaTotal) * 100 : 0;
                                        return (
                                            <div key={nome}>
                                                <div className="flex justify-between items-center mb-1">
                                                    <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{nome}</span>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>{pct.toFixed(1)}%</span>
                                                        <span className="font-data font-semibold text-green-700">{BRL(val)}</span>
                                                    </div>
                                                </div>
                                                <div className="w-full h-1.5 rounded-full bg-gray-100 overflow-hidden">
                                                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: '#059669' }} />
                                                </div>
                                            </div>
                                        );
                                    })}
                            </div>
                        </div>
                    )}

                    {/* ── Relatório por Placa ──────────────────────────── */}
                    <div className="bg-white rounded-xl border shadow-sm overflow-x-auto" style={{ borderColor: 'var(--color-border)' }}>
                        <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--color-border)', backgroundColor: '#F8FAFC' }}>
                            <div className="flex items-center gap-2">
                                <Icon name="Truck" size={16} color="var(--color-muted-foreground)" />
                                <h3 className="font-heading font-semibold text-sm" style={{ color: 'var(--color-text-primary)' }}>Relatório por Placa</h3>
                            </div>
                            <div className="flex items-center gap-2">
                                <PrettySelect value={filtroPlaca} onChange={e => setFiltroPlaca(e.target.value)} className="px-3 py-1.5 rounded-lg border text-xs" style={inputStyle}>
                                    <option value="">Selecione a placa...</option>
                                    {veiculos.map(v => <option key={v.id} value={v.id}>{v.placa} — {v.modelo || ''}</option>)}
                                </PrettySelect>
                                {dadosPorPlaca && (
                                    <button onClick={exportarPorPlaca} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium hover:bg-gray-50 transition-colors" style={{ borderColor: 'var(--color-border)' }}>
                                        <Icon name="FileDown" size={13} /> Exportar Excel
                                    </button>
                                )}
                            </div>
                        </div>
                        {!filtroPlaca ? (
                            <div className="p-8 text-center text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
                                Selecione uma placa para ver o relatório detalhado
                            </div>
                        ) : !dadosPorPlaca ? (
                            <div className="flex flex-col items-center justify-center p-8 gap-2" style={{ color: 'var(--color-muted-foreground)' }}>
                                <Icon name="FileSearch" size={32} color="var(--color-muted-foreground)" />
                                <span className="text-sm">Nenhum dado encontrado para esta placa no período</span>
                            </div>
                        ) : (
                            <div className="p-5 space-y-4 overflow-y-auto flex-1">
                                {/* KPI cards */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    {[
                                        { l: 'Receita Fretes', v: BRL(dadosPorPlaca.receita), c: '#065F46', bg: '#D1FAE5', i: 'TrendingUp' },
                                        { l: 'Total Combustível', v: BRL(dadosPorPlaca.combustivel), c: '#B45309', bg: '#FEF9C3', i: 'Fuel',
                                          sub: `🛢️ ${BRL(dadosPorPlaca.vDiesel)} · 💧 ${BRL(dadosPorPlaca.vArla)}` },
                                        { l: 'Total Despesas', v: BRL(dadosPorPlaca.totalDesp), c: '#DC2626', bg: '#FEE2E2', i: 'Receipt' },
                                        { l: 'Margem Líquida', v: BRL(dadosPorPlaca.margem), c: dadosPorPlaca.margem >= 0 ? '#1D4ED8' : '#DC2626', bg: dadosPorPlaca.margem >= 0 ? '#DBEAFE' : '#FEE2E2', i: dadosPorPlaca.margem >= 0 ? 'TrendingUp' : 'TrendingDown' },
                                    ].map(k => (
                                        <div key={k.l} className="rounded-xl border p-3 shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
                                            <div className="flex items-center gap-1.5 mb-1">
                                                <div className="rounded-lg flex items-center justify-center" style={{ width: 24, height: 24, backgroundColor: k.bg }}>
                                                    <Icon name={k.i} size={12} color={k.c} />
                                                </div>
                                                <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>{k.l}</span>
                                            </div>
                                            <p className="text-base font-bold font-data" style={{ color: k.c }}>{k.v}</p>
                                            {k.sub && <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted-foreground)' }}>{k.sub}</p>}
                                        </div>
                                    ))}
                                </div>
                                {/* DRE por placa */}
                                <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
                                    <div className="px-4 py-2 border-b text-xs font-semibold" style={{ backgroundColor: '#F8FAFC', borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>
                                        DRE — {dadosPorPlaca.veic?.placa} · {dadosPorPlaca.veic?.modelo || ''} · {dadosPorPlaca.viags.length} viagens · {dadosPorPlaca.carrg.length} fretes
                                    </div>
                                    <div className="p-4 space-y-1 text-sm">
                                        <div className="flex justify-between py-1 font-semibold text-green-700">
                                            <span>Receita de Fretes</span><span className="font-data">{BRL(dadosPorPlaca.receita)}</span>
                                        </div>
                                        <div className="flex justify-between py-1 text-amber-700">
                                            <span>(-) Diesel {dadosPorPlaca.lDiesel.toFixed(1)}L</span><span className="font-data">({BRL(dadosPorPlaca.vDiesel)})</span>
                                        </div>
                                        <div className="flex justify-between py-1 text-emerald-700">
                                            <span>(-) Arla 32 {dadosPorPlaca.lArla.toFixed(1)}L</span><span className="font-data">({BRL(dadosPorPlaca.vArla)})</span>
                                        </div>
                                        {dadosPorPlaca.bonus > 0 && <div className="flex justify-between py-1 text-purple-700"><span>(-) Bônus Motoristas</span><span className="font-data">({BRL(dadosPorPlaca.bonus)})</span></div>}
                                        {dadosPorPlaca.diarias > 0 && <div className="flex justify-between py-1 text-indigo-700"><span>(-) Diárias</span><span className="font-data">({BRL(dadosPorPlaca.diarias)})</span></div>}
                                        {dadosPorPlaca.despExtra > 0 && <div className="flex justify-between py-1 text-orange-700"><span>(-) Despesas Extras</span><span className="font-data">({BRL(dadosPorPlaca.despExtra)})</span></div>}
                                        {dadosPorPlaca.custoRodagem > 0 && <div className="flex justify-between py-1 text-rose-700"><span>(-) Custo de Rodagem (estimado)</span><span className="font-data">({BRL(dadosPorPlaca.custoRodagem)})</span></div>}
                                        <div className="flex justify-between py-2 px-3 rounded-lg font-bold mt-2" style={{ backgroundColor: dadosPorPlaca.margem >= 0 ? '#EFF6FF' : '#FEF2F2', border: `1px solid ${dadosPorPlaca.margem >= 0 ? '#BFDBFE' : '#FECACA'}` }}>
                                            <span style={{ color: dadosPorPlaca.margem >= 0 ? '#1D4ED8' : '#DC2626' }}>Margem Líquida</span>
                                            <span className="font-data" style={{ color: dadosPorPlaca.margem >= 0 ? '#1D4ED8' : '#DC2626' }}>{BRL(dadosPorPlaca.margem)} ({dadosPorPlaca.receita > 0 ? ((dadosPorPlaca.margem / dadosPorPlaca.receita) * 100).toFixed(1) : 0}%)</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
            <Toast toast={toast} />
        </div>
    );
}
