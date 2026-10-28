import React, {    } from 'react';

import * as XLSX from 'xlsx';
import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Bar } from 'recharts';

import { useToast } from 'hooks/useToast';
import { } from 'services/romaneio';
import { } from 'services/vehicleService';
import { } from 'services/despesas/caminhoesDespesas';
import {   } from 'services/carretas';
import {   } from 'services/custosFrotaService';
import { } from 'hooks/useRecarregarAoVoltar';
import {    } from 'utils/despesasParcelasUtils';
import { exportRelatorioConsolidado, exportRelatorioBonificacoes, exportRomaneiosToExcel } from 'utils/excel';
import { NavigationBar, BreadcrumbTrail, AppIcon as Icon, Button, Toast } from 'components';
import { EMPRESAS } from 'pages/romaneios/components/RomaneioFormModal';

import TabOperacional from './components/TabOperacional';
import TabFinanceiro from './components/TabFinanceiro';
import TabFinanceiroPainel from './components/TabFinanceiroPainel';
import KpiCard from './components/KpiCard';
import { fmtBRL,  dataLocalISO } from './utils/helpers';
import ChartCard from './components/ChartCard';
import TabFrota from './components/TabFrota';
import { useRelatoriosDados, useRelatoriosPeriodo, useRelatoriosPeriodoDre, useRelatoriosOperacional, useRelatoriosFinanceiro, useRelatoriosDespesas, useRelatoriosDre, useRelatoriosFrota } from './hooks';

const TABS = [
    { id: 'operacional', label: 'Operacional', icon: 'BarChart2' },
    { id: 'financeiro',  label: 'Financeiro',  icon: 'DollarSign' },
    { id: 'frota',       label: 'Frota',        icon: 'Truck' },
    { id: 'empresas',    label: 'Por Empresa',  icon: 'Building2' },
];

function SectionTitle({ title, subtitle }) {
    return (
        <div className="mb-4">
            <h2 className="text-base font-semibold text-slate-800">{title}</h2>
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
    );
}

export default function Relatorios() {
    const { toast, showToast } = useToast();
    const { romaneios, vehicles, despesasCaminhoes, diariasAvulsasCaminhao, abastecimentosCaminhao, dadosMargemCaminhao, loading, periodo, setPeriodo, mesRef, setMesRef, dreMesInicio, setDreMesInicio, dreMesFim, setDreMesFim, tab, setTab, empresaFiltro, setEmpresaFiltro, mesFiltro, setMesFiltro } = useRelatoriosDados({ showToast });     const { periodoIni, periodoFim, diasPeriodo, periodoLabel, romFiltrados, romFinalizados, custoCombustivelRealPorMes, somaCustoCombustivelReal } = useRelatoriosPeriodo({ abastecimentosCaminhao, mesRef, periodo, romaneios, setDreMesFim, setDreMesInicio });

    const { dreInicioISO, dreFimISO, romFinalizadosDre } = useRelatoriosPeriodoDre({ dreMesFim, dreMesInicio, romaneios });

    const { totalViagens, finalizados, pesoTotal, mediaDia, porDia, porStatus, topDestinos } = useRelatoriosOperacional({ diasPeriodo, periodo, romFiltrados, romFinalizados });

    const { receitaTotal, custoTotal, margemLucro, ticketMedio, custosBreakdown, financeiroPorMes, topRotas } = useRelatoriosFinanceiro({ custoCombustivelRealPorMes, finalizados, periodoFim, periodoIni, romFinalizados, somaCustoCombustivelReal });

    const { despesasFiltradas, totalDespesasCaminhoes, despesasPorCategoria, despesasPorMes } = useRelatoriosDespesas({ despesasCaminhoes, periodoFim, periodoIni });

    const { dreMensal, dreTotais } = useRelatoriosDre({ abastecimentosCaminhao, dadosMargemCaminhao, despesasCaminhoes, diariasAvulsasCaminhao, dreFimISO, dreInicioISO, romFinalizados, romFinalizadosDre });

    const { frota, disponiveis, emTransito, manutencao, utilizacaoMedia, frotaStatus, utilizacaoVeiculos } = useRelatoriosFrota({ romFiltrados, vehicles });

    // ─── Export financeiro Excel ────────────────────────────
    const exportConsolidadoExcel = () => {
        try {
            exportRelatorioConsolidado(romFiltrados, periodoLabel);
            showToast('Relatório consolidado exportado!');
        } catch (e) {
            showToast('Erro ao exportar: ' + e.message, 'error');
        }
    };

    const exportBonificacoesExcel = () => {
        // Filtra apenas romaneios aprovados/finalizados no período selecionado
        const romBonif = romFinalizados.filter(r =>
            r.aprovado || r.status_aprovacao === 'aprovado' || r.status === 'Finalizado'
        );
        if (romBonif.length === 0) { showToast('Nenhum romaneio aprovado no período', 'error'); return; }
        try {
            const fmtDia = iso => iso ? new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR') : '';
            const di = fmtDia(periodoIni);
            const df = fmtDia(periodoFim || dataLocalISO(new Date()));
            exportRelatorioBonificacoes(romBonif, di, df);
            showToast('Relatório de bonificações exportado!', 'success');
        } catch(e) {
            showToast('Erro ao exportar: ' + e.message, 'error');
        }
    };

    const exportFinanceiroExcel = () => {
        if (romFinalizados.length === 0) { showToast('Nenhum romaneio finalizado no período', 'error'); return; }

        const n = v => Number(v) || 0;
        

        const wb = XLSX.utils.book_new();

        // ── Aba 1: Resumo por romaneio ────────────────────────────────────────
        const rowsResumo = romFinalizados.map(r => {
            const frete = n(r.valor_frete_calculado || r.valor_frete);
            const custo = n(r.custo_combustivel) + n(r.custo_pedagio) + n(r.custo_motorista);
            const margem = frete - custo;
            return {
                'Número':           r.numero,
                'Motorista':        r.motorista || '',
                'Destino':          r.destino || '',
                'Saída':            r.saida ? new Date(r.saida).toLocaleDateString('pt-BR') : '',
                'Peso (kg)':        n(r.peso_total),
                'Valor Carga (R$)': n(r.valor_total_carga),
                'Frete (R$)':       frete,
                'Combustível (R$)': n(r.custo_combustivel),
                'Pedágio (R$)':     n(r.custo_pedagio),
                'Diária Mot. (R$)': n(r.custo_motorista),
                'Custo Total (R$)': custo,
                'Margem (R$)':      margem,
                'Margem (%)':       frete > 0 ? ((margem / frete) * 100).toFixed(1) + '%' : '0%',
            };
        });
        const wsResumo = XLSX.utils.json_to_sheet(rowsResumo);
        wsResumo['!cols'] = Object.keys(rowsResumo[0] || {}).map(() => ({ wch: 18 }));
        XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo Viagens');

        // ── Aba 2: Pedidos individuais por romaneio ───────────────────────────
        const rowsPedidos = [];
        romFinalizados.forEach(r => {
            const pedidos = r.romaneio_pedidos || [];
            if (pedidos.length === 0) {
                rowsPedidos.push({
                    'Romaneio':          r.numero,
                    'Motorista':         r.motorista || '',
                    'Destino':           r.destino || '',
                    'Saída':             r.saida ? new Date(r.saida).toLocaleDateString('pt-BR') : '',
                    'Nº Pedido':         '(sem pedidos)',
                    'Cidade Destino':    '',
                    'Categoria Frete':   '',
                    '% Frete':           '',
                    'Valor Pedido (R$)': 0,
                    'Frete Calc. (R$)':  0,
                });
            } else {
                pedidos.forEach(p => {
                    const pct = n(p.percentual_frete) || 0.05;
                    const frete = n(p.frete_calculado) || (n(p.valor_pedido) * pct);
                    rowsPedidos.push({
                        'Romaneio':          r.numero,
                        'Motorista':         r.motorista || '',
                        'Destino':           r.destino || '',
                        'Saída':             r.saida ? new Date(r.saida).toLocaleDateString('pt-BR') : '',
                        'Nº Pedido':         p.numero_pedido || '',
                        'Cidade Destino':    p.cidade_destino || '',
                        'Categoria Frete':   p.categoria_frete || '',
                        '% Frete':           (pct * 100).toFixed(1) + '%',
                        'Valor Pedido (R$)': n(p.valor_pedido),
                        'Frete Calc. (R$)':  frete,
                    });
                });
            }
        });
        const wsPedidos = XLSX.utils.json_to_sheet(rowsPedidos);
        wsPedidos['!cols'] = Object.keys(rowsPedidos[0] || {}).map(() => ({ wch: 18 }));
        XLSX.utils.book_append_sheet(wb, wsPedidos, 'Pedidos por Viagem');

        const dataStr = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
        XLSX.writeFile(wb, `relatorio_financeiro_${dataStr}.xlsx`);
        showToast('Relatório exportado com 2 abas: Resumo + Pedidos!');
    };

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-background)' }}>
            <div className="text-center">
                <svg className="animate-spin h-8 w-8 mx-auto mb-3" style={{ color: 'var(--color-primary)' }} fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <p className="text-sm text-slate-500">Carregando relatórios...</p>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen" style={{ backgroundColor: 'var(--color-background)' }}>
            <NavigationBar />
            <main className="main-content">
                <div className="max-w-[1920px] mx-auto px-4 tab:px-6 lg:px-8 py-6">
                    <BreadcrumbTrail className="mb-4" />

                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
                        <div>
                            <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--color-primary)' }}>
                                <Icon name="BarChart2" size={26} color="var(--color-primary)" /> Relatórios & Análises
                            </h1>
                            <p className="text-sm text-slate-500 mt-0.5">Visão financeira e operacional da sua frota</p>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                            <button onClick={() => setPeriodo('mes')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${periodo === 'mes' ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>
                                Mês
                            </button>
                            {periodo === 'mes' && (
                                <input type="month" value={mesRef}
                                    onChange={e => { if (e.target.value) setMesRef(e.target.value); }}
                                    className="px-2 py-1 rounded-lg text-xs border border-slate-200 bg-white text-slate-700" />
                            )}
                            {['7','30','90','365'].map(d => (
                                <button key={d} onClick={() => setPeriodo(d)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${periodo === d ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>
                                    {d === '365' ? '1 ano' : `${d}d`}
                                </button>
                            ))}
                            <Button variant="outline" iconName="FileDown" iconSize={14}
                                onClick={() => exportRomaneiosToExcel(romaneios)}>Exportar</Button>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-1 bg-slate-100 p-1 rounded-xl mb-6 overflow-x-auto">
                        {TABS.map(t => (
                            <button key={t.id} onClick={() => setTab(t.id)}
                                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 ${tab === t.id ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                                <Icon name={t.icon} size={14} color="currentColor" />
                                <span className="hidden xs:inline sm:inline">{t.label}</span>
                            </button>
                        ))}
                    </div>

                    {/* ── TAB: OPERACIONAL ── */}
                    {tab === 'operacional' && (
                        <TabOperacional
                    finalizados={finalizados}
                    mediaDia={mediaDia}
                    periodo={periodo}
                    periodoLabel={periodoLabel}
                    pesoTotal={pesoTotal}
                    porDia={porDia}
                    porStatus={porStatus}
                    topDestinos={topDestinos}
                    totalViagens={totalViagens}
                />
                    )}

                    {/* ── TAB: FINANCEIRO ── */}
                    {tab === 'financeiro' && (
                        <TabFinanceiro
                    custoTotal={custoTotal}
                    custosBreakdown={custosBreakdown}
                    exportBonificacoesExcel={exportBonificacoesExcel}
                    exportConsolidadoExcel={exportConsolidadoExcel}
                    exportFinanceiroExcel={exportFinanceiroExcel}
                    financeiroPorMes={financeiroPorMes}
                    margemLucro={margemLucro}
                    receitaTotal={receitaTotal}
                    romFinalizados={romFinalizados}
                    ticketMedio={ticketMedio}
                    topRotas={topRotas}
                />
                    )}

                    {/* ── TAB: DESPESAS CAMINHÕES (dentro de Financeiro) ── */}
                    {tab === 'financeiro' && (
                        <TabFinanceiroPainel despesasFiltradas={despesasFiltradas} despesasPorCategoria={despesasPorCategoria} despesasPorMes={despesasPorMes} totalDespesasCaminhoes={totalDespesasCaminhoes} />
                    )}

                    {/* ── Seletor de período do DRE de Caminhões ── */}
                    {tab === 'financeiro' && (
                        <div className="flex flex-wrap items-center gap-3 bg-white rounded-xl border border-slate-200 px-4 py-3 mt-2">
                            <Icon name="Calendar" size={15} color="#1E3A5F" />
                            <span className="text-xs font-semibold text-slate-600">Período do DRE (Caminhões):</span>
                            <div className="flex items-center gap-1.5">
                                <label className="text-xs text-slate-400">De</label>
                                <input type="month" value={dreMesInicio} onChange={e => setDreMesInicio(e.target.value)}
                                    className="px-2 py-1.5 rounded-lg border text-xs" style={{ borderColor: '#E2E8F0' }} />
                            </div>
                            <div className="flex items-center gap-1.5">
                                <label className="text-xs text-slate-400">até</label>
                                <input type="month" value={dreMesFim} onChange={e => setDreMesFim(e.target.value)}
                                    className="px-2 py-1.5 rounded-lg border text-xs" style={{ borderColor: '#E2E8F0' }} />
                            </div>
                            <button
                                onClick={() => { const m = new Date().toISOString().slice(0, 7); setDreMesInicio(m); setDreMesFim(m); }}
                                className="text-xs font-medium text-blue-600 hover:underline">
                                Mês atual
                            </button>
                            {dreMensal.length === 0 && (
                                <span className="ml-auto text-xs text-slate-400">Nenhum dado no período selecionado.</span>
                            )}
                        </div>
                    )}

                    {/* ── DRE MENSAL CAMINHÕES (dentro de Financeiro) ── */}
                    {tab === 'financeiro' && dreMensal.length > 0 && (
                        <div className="flex flex-col gap-4 mt-2">
                            {/* Header */}
                            <div className="flex items-center gap-2 pb-1 border-b border-slate-200">
                                <Icon name="FileText" size={16} color="#1E3A5F" />
                                <p className="text-sm font-semibold text-slate-700">DRE — Resultado Mensal de Transporte (Caminhões)</p>
                            </div>

                            {/* KPIs consolidados do período */}
                            <div className="grid grid-cols-2 tab:grid-cols-5 gap-4">
                                <KpiCard label="Receita Total" value={fmtBRL(dreTotais.receita)} icon="TrendingUp" color="#059669" sub={`${dreTotais.viagens} viagens finalizadas`} />
                                <KpiCard label="Custo Operacional" value={fmtBRL(dreTotais.totalDespesas - dreTotais.despesasCaminhoes - dreTotais.custoRodagem)} icon="Fuel" color="#D97706" sub="Combustível + Pedágio + Motoristas" />
                                <KpiCard label="Custo de Rodagem" value={fmtBRL(dreTotais.custoRodagem)} icon="Gauge" color="#E11D48" sub={dreTotais.custoRodagemSemMatch > 0 ? `${dreTotais.custoRodagemSemMatch} viagens sem destino cadastrado` : 'Estimado por destino'} />
                                <KpiCard label="Despesas Caminhões" value={fmtBRL(dreTotais.despesasCaminhoes)} icon="Wrench" color="#7C3AED" sub="Manutenção e demais despesas" />
                                <KpiCard
                                    label="Resultado Líquido"
                                    value={fmtBRL(dreTotais.resultadoLiquido)}
                                    icon={dreTotais.resultadoLiquido >= 0 ? "TrendingUp" : "TrendingDown"}
                                    color={dreTotais.resultadoLiquido >= 0 ? "#059669" : "#DC2626"}
                                    sub={`Margem: ${dreTotais.margemPct.toFixed(1)}%`}
                                />
                            </div>

                            {/* Gráfico Resultado Mensal */}
                            <ChartCard title="Resultado Líquido por Mês" height={220}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={dreMensal}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                                        <XAxis dataKey="mesLabel" tick={{ fontSize: 11 }} />
                                        <YAxis tick={{ fontSize: 11 }} tickFormatter={v => 'R$' + (v/1000).toFixed(0) + 'k'} />
                                        <Tooltip formatter={(v) => fmtBRL(v)} />
                                        <Legend />
                                        <Bar dataKey="receita" name="Receita" fill="#059669" radius={[4,4,0,0]} />
                                        <Bar dataKey="totalDespesas" name="Total Despesas" fill="#DC2626" radius={[4,4,0,0]} />
                                        <Bar dataKey="resultadoLiquido" name="Resultado Líquido" fill="#1E3A5F" radius={[4,4,0,0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </ChartCard>

                            {/* Tabela DRE Mensal */}
                            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                <div className="px-5 py-4 border-b border-slate-100 bg-slate-50">
                                    <p className="text-sm font-semibold text-slate-700">Demonstrativo de Resultado — Detalhe Mensal</p>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-slate-50 border-b border-slate-200">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Mês</th>
                                                <th className="px-4 py-3 text-right text-xs font-semibold text-green-700 uppercase tracking-wide">Receita</th>
                                                <th className="px-4 py-3 text-right text-xs font-semibold text-amber-600 uppercase tracking-wide hidden md:table-cell">Combustível</th>
                                                <th className="px-4 py-3 text-right text-xs font-semibold text-amber-600 uppercase tracking-wide hidden lg:table-cell">Pedágio</th>
                                                <th className="px-4 py-3 text-right text-xs font-semibold text-amber-600 uppercase tracking-wide hidden lg:table-cell">Motoristas</th>
                                                <th className="px-4 py-3 text-right text-xs font-semibold text-purple-600 uppercase tracking-wide hidden md:table-cell">Desp. Caminhões</th>
                                                <th className="px-4 py-3 text-right text-xs font-semibold text-rose-600 uppercase tracking-wide hidden md:table-cell">Custo Rodagem</th>
                                                <th className="px-4 py-3 text-right text-xs font-semibold text-red-600 uppercase tracking-wide hidden sm:table-cell">Total Desp.</th>
                                                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-700 uppercase tracking-wide">Resultado</th>
                                                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide hidden sm:table-cell">Margem</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {dreMensal.map((m, i) => (
                                                <tr key={i} className="hover:bg-slate-50">
                                                    <td className="px-4 py-3 font-medium text-slate-800 text-xs">{m.mesLabel}</td>
                                                    <td className="px-4 py-3 text-right text-xs font-semibold text-green-700">{fmtBRL(m.receita)}</td>
                                                    <td className="px-4 py-3 text-right text-xs text-amber-600 hidden md:table-cell">({fmtBRL(m.custoCombustivel)})</td>
                                                    <td className="px-4 py-3 text-right text-xs text-amber-600 hidden lg:table-cell">({fmtBRL(m.custoPedagio)})</td>
                                                    <td className="px-4 py-3 text-right text-xs text-amber-600 hidden lg:table-cell">({fmtBRL(m.custoMotorista)})</td>
                                                    <td className="px-4 py-3 text-right text-xs text-purple-600 hidden md:table-cell">({fmtBRL(m.despesasCaminhoes)})</td>
                                                    <td className="px-4 py-3 text-right text-xs text-rose-600 hidden md:table-cell">({fmtBRL(m.custoRodagem)})</td>
                                                    <td className="px-4 py-3 text-right text-xs text-red-600 hidden sm:table-cell">({fmtBRL(m.totalDespesas)})</td>
                                                    <td className="px-4 py-3 text-right text-xs font-bold" style={{ color: m.resultadoLiquido >= 0 ? '#059669' : '#DC2626' }}>
                                                        {fmtBRL(m.resultadoLiquido)}
                                                    </td>
                                                    <td className="px-4 py-3 text-right text-xs font-medium hidden sm:table-cell">
                                                        <span className={"px-2 py-0.5 rounded-full text-xs font-semibold " + (m.margemPct >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600')}>
                                                            {m.margemPct.toFixed(1)}%
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                            {/* Linha de totais */}
                                            <tr className="bg-slate-100 font-semibold border-t-2 border-slate-300">
                                                <td className="px-4 py-3 text-xs font-bold text-slate-800">TOTAL</td>
                                                <td className="px-4 py-3 text-right text-xs font-bold text-green-700">{fmtBRL(dreTotais.receita)}</td>
                                                <td className="px-4 py-3 text-right text-xs font-bold text-amber-600 hidden md:table-cell">({fmtBRL(dreTotais.custoCombustivel)})</td>
                                                <td className="px-4 py-3 text-right text-xs font-bold text-amber-600 hidden lg:table-cell">({fmtBRL(dreTotais.custoPedagio)})</td>
                                                <td className="px-4 py-3 text-right text-xs font-bold text-amber-600 hidden lg:table-cell">({fmtBRL(dreTotais.custoMotorista)})</td>
                                                <td className="px-4 py-3 text-right text-xs font-bold text-purple-600 hidden md:table-cell">({fmtBRL(dreTotais.despesasCaminhoes)})</td>
                                                <td className="px-4 py-3 text-right text-xs font-bold text-rose-600 hidden md:table-cell">({fmtBRL(dreTotais.custoRodagem)})</td>
                                                <td className="px-4 py-3 text-right text-xs font-bold text-red-600 hidden sm:table-cell">({fmtBRL(dreTotais.totalDespesas)})</td>
                                                <td className="px-4 py-3 text-right text-xs font-bold" style={{ color: dreTotais.resultadoLiquido >= 0 ? '#059669' : '#DC2626' }}>
                                                    {fmtBRL(dreTotais.resultadoLiquido)}
                                                </td>
                                                <td className="px-4 py-3 text-right text-xs font-bold hidden sm:table-cell">
                                                    <span className={"px-2 py-0.5 rounded-full text-xs font-bold " + (dreTotais.margemPct >= 0 ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-700')}>
                                                        {dreTotais.margemPct.toFixed(1)}%
                                                    </span>
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* DRE Narrativa consolidada (estilo carretas) */}
                            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2" style={{ backgroundColor: '#F8FAFC' }}>
                                    <Icon name="FileText" size={16} color="#64748B" />
                                    <p className="text-sm font-semibold text-slate-700">Demonstrativo de Resultado (DRE) — Consolidado do Período</p>
                                </div>
                                <div className="p-5 space-y-1">
                                    {/* Receitas */}
                                    <div className="flex justify-between py-2 border-b border-slate-100">
                                        <span className="text-xs font-semibold uppercase tracking-wide text-green-700">Receitas</span>
                                    </div>
                                    <div className="flex justify-between py-1.5 pl-3">
                                        <span className="text-sm text-slate-800">Receita de Fretes (Caminhões)</span>
                                        <span className="font-semibold text-green-700">{fmtBRL(dreTotais.receita)}</span>
                                    </div>
                                    <div className="flex justify-between py-1 pl-6">
                                        <span className="text-xs text-slate-400">↳ {dreTotais.viagens} viagens finalizadas</span>
                                        <span className="text-xs text-slate-400">{dreTotais.viagens > 0 ? fmtBRL(dreTotais.receita / dreTotais.viagens) + '/viagem' : '—'}</span>
                                    </div>

                                    {/* Custos operacionais */}
                                    <div className="flex justify-between py-2 border-b border-slate-100 mt-2">
                                        <span className="text-xs font-semibold uppercase tracking-wide text-amber-700">Custos Operacionais</span>
                                    </div>
                                    <div className="flex justify-between py-1.5 pl-3">
                                        <span className="text-sm text-slate-800">Combustível</span>
                                        <span className="font-semibold text-amber-700">({fmtBRL(dreTotais.custoCombustivel)})</span>
                                    </div>
                                    {dreTotais.custoPedagio > 0 && (
                                        <div className="flex justify-between py-1.5 pl-3">
                                            <span className="text-sm text-slate-800">Pedágio</span>
                                            <span className="font-semibold text-amber-700">({fmtBRL(dreTotais.custoPedagio)})</span>
                                        </div>
                                    )}
                                    {dreTotais.custoMotorista > 0 && (
                                        <div className="flex justify-between py-1.5 pl-3">
                                            <span className="text-sm text-slate-800">Diárias / Motoristas</span>
                                            <span className="font-semibold text-amber-700">({fmtBRL(dreTotais.custoMotorista)})</span>
                                        </div>
                                    )}

                                    {/* Margem bruta */}
                                    <div className="flex justify-between py-2.5 px-3 rounded-lg mt-2" style={{ backgroundColor: '#F0FDF4' }}>
                                        <span className="text-sm font-semibold text-green-800">Margem Bruta (−Custos Operacionais)</span>
                                        <span className="font-bold text-green-700">{fmtBRL(dreTotais.margemBruta)}</span>
                                    </div>

                                    {/* Despesas caminhões */}
                                    <div className="flex justify-between py-2 border-b border-slate-100 mt-2">
                                        <span className="text-xs font-semibold uppercase tracking-wide text-purple-700">Despesas Caminhões (Manutenção e Outros)</span>
                                    </div>
                                    <div className="flex justify-between py-1.5 pl-3">
                                        <span className="text-sm text-slate-800">Despesas diversas</span>
                                        <span className="font-semibold text-purple-700">({fmtBRL(dreTotais.despesasCaminhoes)})</span>
                                    </div>
                                    {despesasPorCategoria.slice(0, 5).map(c => (
                                        <div key={c.name} className="flex justify-between py-0.5 pl-6">
                                            <span className="text-xs text-slate-400">↳ {c.name}</span>
                                            <span className="text-xs text-slate-400">{fmtBRL(c.value)}</span>
                                        </div>
                                    ))}

                                    {/* Custo de rodagem estimado */}
                                    {dreTotais.custoRodagem > 0 && (
                                        <>
                                            <div className="flex justify-between py-2 border-b border-slate-100 mt-2">
                                                <span className="text-xs font-semibold uppercase tracking-wide text-rose-700">Custo de Rodagem (estimado por destino)</span>
                                            </div>
                                            <div className="flex justify-between py-1.5 pl-3">
                                                <span className="text-sm text-slate-800 flex items-center gap-1.5">
                                                    Custo de Rodagem
                                                    <span title="Custo estimado (pneus/óleo/manutenção/depreciação etc., rateados por KM e por dia) casado com o destino de cada romaneio finalizado. Configurável em Custos de Rodagem.">
                                                        <Icon name="Info" size={12} color="#94A3B8" />
                                                    </span>
                                                </span>
                                                <span className="font-semibold text-rose-700">({fmtBRL(dreTotais.custoRodagem)})</span>
                                            </div>
                                            {dreTotais.custoRodagemSemMatch > 0 && (
                                                <div className="flex justify-between py-1 pl-6">
                                                    <span className="text-xs text-amber-600">↳ {dreTotais.custoRodagemSemMatch} de {dreTotais.custoRodagemSemMatch + dreTotais.custoRodagemComMatch} viagens sem destino cadastrado (não abatidas)</span>
                                                </div>
                                            )}
                                        </>
                                    )}

                                    {/* Resultado Líquido */}
                                    <div className="flex justify-between py-3 px-3 rounded-lg mt-2" style={{
                                        backgroundColor: dreTotais.resultadoLiquido >= 0 ? '#EFF6FF' : '#FEF2F2',
                                        border: `1px solid ${dreTotais.resultadoLiquido >= 0 ? '#BFDBFE' : '#FECACA'}`,
                                    }}>
                                        <div>
                                            <p className="text-sm font-bold" style={{ color: dreTotais.resultadoLiquido >= 0 ? '#1D4ED8' : '#DC2626' }}>
                                                Resultado Líquido do Transporte
                                            </p>
                                            <p className="text-xs mt-0.5" style={{ color: dreTotais.resultadoLiquido >= 0 ? '#3B82F6' : '#EF4444' }}>
                                                Margem líquida: {dreTotais.margemPct.toFixed(1)}%
                                            </p>
                                        </div>
                                        <span className="font-bold text-lg" style={{ color: dreTotais.resultadoLiquido >= 0 ? '#1D4ED8' : '#DC2626' }}>
                                            {fmtBRL(dreTotais.resultadoLiquido)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── TAB: FROTA ── */}
                    {tab === 'frota' && (
                        <TabFrota
                    disponiveis={disponiveis}
                    emTransito={emTransito}
                    frota={frota}
                    frotaStatus={frotaStatus}
                    manutencao={manutencao}
                    periodoLabel={periodoLabel}
                    utilizacaoMedia={utilizacaoMedia}
                    utilizacaoVeiculos={utilizacaoVeiculos}
                    vehicles={vehicles}
                />
                    )}
                    {/* ── TAB: POR EMPRESA ── */}
                    {tab === 'empresas' && (() => {
                        const empConfig = EMPRESAS.find(e => e.value === empresaFiltro) || EMPRESAS[0];

                        // Todos os pedidos de todos os romaneios no mês selecionado
                        const pedidosDoMes = romaneios.flatMap(r => {
                            const mesRom = (r.saida || r.created_at || '').slice(0, 7);
                            if (mesRom !== mesFiltro) return [];
                            return (r.romaneio_pedidos || []).map(p => ({ ...p, _rom: r }));
                        }).filter(p => {
                            // Só filtra por empresa se o campo estiver preenchido
                            // Pedidos sem empresa NÃO aparecem em nenhuma empresa (evita falso positivo)
                            const empPedido = p.empresa || '';
                            return empPedido === empresaFiltro;
                        });

                        // KPIs da empresa no mês
                        const totalPedidos    = pedidosDoMes.length;
                        const valorCarga      = pedidosDoMes.reduce((s, p) => s + Number(p.valor_pedido || 0), 0);
                        const freteTotal      = pedidosDoMes.reduce((s, p) => {
                            const pct = Number(p.percentual_frete || 0.05);
                            return s + Number(p.valor_pedido || 0) * pct;
                        }, 0);
                        // Margem: proporcional aos pedidos da empresa em cada romaneio
                        const romaneiosComPedidos = [...new Set(pedidosDoMes.map(p => p._rom.id))];
                        const margemTotal = romaneiosComPedidos.reduce((s, romId) => {
                            const rom = romaneios.find(r => r.id === romId);
                            if (!rom) return s;
                            const pedidosRom = (rom.romaneio_pedidos || []);
                            const pedidosEmpresa = pedidosRom.filter(p => p.empresa === empresaFiltro);
                            if (pedidosRom.length === 0) return s;
                            const proporcao = pedidosEmpresa.length / pedidosRom.length;
                            const custoRom = (Number(rom.custo_combustivel||0) + Number(rom.custo_pedagio||0) + Number(rom.custo_motorista||0)) * proporcao;
                            const freteEmpresa = pedidosEmpresa.reduce((sf, p) => sf + Number(p.valor_pedido||0) * Number(p.percentual_frete||0.05), 0);
                            return s + freteEmpresa - custoRom;
                        }, 0);

                        // Agrupar pedidos por romaneio para exibição
                        const pedidosPorRomaneio = romaneiosComPedidos.map(romId => {
                            const rom = romaneios.find(r => r.id === romId);
                            const peds = pedidosDoMes.filter(p => p._rom.id === romId);
                            return { rom, peds };
                        });

                        // Export Excel da empresa no mês
                        const exportEmpresaExcel = () => {
                            if (pedidosDoMes.length === 0) { showToast('Nenhum pedido no período', 'error'); return; }
                            const wb = XLSX.utils.book_new();
                            const rows = pedidosDoMes.map(p => {
                                const pct = Number(p.percentual_frete || 0.05);
                                const frete = Number(p.valor_pedido || 0) * pct;
                                return {
                                    'Romaneio':          p._rom.numero || '',
                                    'Motorista':         p._rom.motorista || '',
                                    'Saída':             p._rom.saida ? new Date(p._rom.saida).toLocaleDateString('pt-BR') : '',
                                    'Nº Pedido':         p.numero_pedido || '',
                                    'Cidade Destino':    p.cidade_destino || p._rom.destino || '',
                                    'Empresa':           p.empresa || empresaFiltro,
                                    'Categoria Frete':   p.categoria_frete || '',
                                    '% Frete':           (pct * 100).toFixed(1) + '%',
                                    'Valor Pedido (R$)': Number(p.valor_pedido || 0),
                                    'Frete (R$)':        frete,
                                    'Status Romaneio':   p._rom.status || '',
                                };
                            });
                            // Linha de totais ao final da mesma planilha — soma Valor Pedido e Frete
                            rows.push({
                                'Romaneio': `TOTAL (${rows.length} pedido${rows.length > 1 ? 's' : ''})`,
                                'Motorista': '', 'Saída': '', 'Nº Pedido': '', 'Cidade Destino': '', 'Empresa': '', 'Categoria Frete': '', '% Frete': '',
                                'Valor Pedido (R$)': valorCarga,
                                'Frete (R$)': freteTotal,
                                'Status Romaneio': '',
                            });
                            const ws = XLSX.utils.json_to_sheet(rows);
                            ws['!cols'] = Object.keys(rows[0] || {}).map(() => ({ wch: 20 }));
                            XLSX.utils.book_append_sheet(wb, ws, empresaFiltro.slice(0, 31));
                            // Aba de resumo — mesmos números dos cards exibidos na tela (Pedidos,
                            // Valor da Carga, Frete Gerado, Margem Estimada), pra bater com o que
                            // o usuário já vê antes de exportar.
                            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{
                                'Empresa': empresaFiltro,
                                'Mês': mesLabel,
                                'Pedidos no Mês': totalPedidos,
                                'Valor da Carga (R$)': valorCarga,
                                'Frete Gerado (R$)': freteTotal,
                                'Margem Estimada (R$)': margemTotal,
                            }]), 'Resumo');
                            XLSX.writeFile(wb, `relatorio_${empresaFiltro.replace(/\s/g,'_')}_${mesFiltro}.xlsx`);
                            showToast('Relatório exportado!');
                        };

                        const mesLabel = new Date(mesFiltro + '-02').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

                        return (
                            <div className="flex flex-col gap-6">
                                {/* Filtros */}
                                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col gap-4">
                                    {/* Empresa */}
                                    <div>
                                        <label className="block text-xs font-caption font-semibold mb-2 text-slate-500 uppercase tracking-wide">Empresa</label>
                                        <div className="grid grid-cols-1 xs:grid-cols-3 gap-2">
                                            {EMPRESAS.map(emp => (
                                                <button key={emp.value} onClick={() => setEmpresaFiltro(emp.value)}
                                                    className="w-full py-2.5 rounded-lg text-sm font-semibold border-2 transition-all text-center"
                                                    style={{
                                                        borderColor: empresaFiltro === emp.value ? emp.color : '#E5E7EB',
                                                        backgroundColor: empresaFiltro === emp.value ? emp.bg : 'white',
                                                        color: empresaFiltro === emp.value ? emp.color : '#9CA3AF',
                                                        minHeight: '44px',
                                                    }}>
                                                    {emp.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    {/* Mês + Exportar */}
                                    <div className="flex flex-col xs:flex-row gap-3 items-start xs:items-center">
                                        <div className="flex-1 w-full xs:w-auto">
                                            <label className="block text-xs font-caption font-semibold mb-1.5 text-slate-500 uppercase tracking-wide">Mês de Referência</label>
                                            <input type="month" value={mesFiltro} onChange={e => setMesFiltro(e.target.value)}
                                                className="w-full h-11 px-3 rounded-lg border border-gray-200 text-sm bg-white font-data" />
                                        </div>
                                        <button onClick={exportEmpresaExcel}
                                            className="flex items-center justify-center gap-2 px-4 h-11 rounded-lg text-sm font-semibold text-white transition-colors w-full xs:w-auto mt-auto"
                                            style={{ backgroundColor: empConfig.color }}>
                                            <Icon name="FileSpreadsheet" size={15} color="white" />
                                            Exportar Excel
                                        </button>
                                    </div>
                                </div>

                                {/* KPIs */}
                                <div className="grid grid-cols-2 tab:grid-cols-4 gap-4">
                                    <KpiCard label="Pedidos no Mês"   value={totalPedidos}        icon="ShoppingCart" color={empConfig.color} sub={mesLabel} />
                                    <KpiCard label="Valor da Carga"   value={fmtBRL(valorCarga)}  icon="Package"      color={empConfig.color} sub="Total transportado" />
                                    <KpiCard label="Frete Gerado"     value={fmtBRL(freteTotal)}  icon="TrendingUp"   color="#059669"         sub="Receita de frete" />
                                    <KpiCard label="Margem Estimada"  value={fmtBRL(margemTotal)} icon="Percent"      color={margemTotal >= 0 ? '#059669' : '#DC2626'} sub="Frete − custos proporcionais" />
                                </div>

                                {/* Lista de pedidos agrupados por romaneio */}
                                {pedidosPorRomaneio.length === 0 ? (
                                    <div className="bg-white rounded-xl border border-slate-200 p-12 flex flex-col items-center justify-center gap-2">
                                        <Icon name="Building2" size={40} color="#CBD5E1" />
                                        <p className="text-sm font-medium text-slate-500">Nenhum pedido encontrado</p>
                                        <p className="text-xs text-center text-slate-400">Selecione outro mês ou verifique se os pedidos têm a empresa associada</p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-4">
                                        {pedidosPorRomaneio.map(({ rom, peds }) => {
                                            const freteRom = peds.reduce((s, p) => s + Number(p.valor_pedido||0) * Number(p.percentual_frete||0.05), 0);
                                            const valorRom = peds.reduce((s, p) => s + Number(p.valor_pedido||0), 0);
                                            return (
                                                <div key={rom.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                                    {/* Header do romaneio */}
                                                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 px-4 py-3 border-b border-slate-100"
                                                        style={{ backgroundColor: empConfig.bg + '60' }}>
                                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                                            <Icon name="FileText" size={16} color={empConfig.color} />
                                                            <span className="font-data font-bold text-sm" style={{ color: empConfig.color }}>{rom.numero}</span>
                                                            <span className="text-xs text-slate-500 font-caption truncate">· {rom.motorista}</span>
                                                        </div>
                                                        <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-xs font-caption">
                                                            <span className="text-slate-400 hidden sm:inline">{rom.destino}</span>
                                                            <span className="text-slate-500">
                                                                {rom.saida ? new Date(rom.saida).toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit' }) : '—'}
                                                            </span>
                                                            <span className="font-semibold" style={{ color: empConfig.color }}>
                                                                {fmtBRL(valorRom)}
                                                            </span>
                                                            <span className="text-green-700 font-semibold">{fmtBRL(freteRom)} frete</span>
                                                            <span className={`px-2 py-0.5 rounded-full font-medium ${
                                                                rom.status === 'Finalizado' ? 'bg-green-100 text-green-700' :
                                                                rom.status === 'Em Trânsito' ? 'bg-blue-100 text-blue-700' :
                                                                rom.status === 'Cancelado' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                                                            }`}>{rom.status}</span>
                                                        </div>
                                                    </div>
                                                    {/* Tabela de pedidos */}
                                                    <div className="overflow-x-auto">
                                                        <table className="w-full text-xs">
                                                            <thead className="bg-slate-50">
                                                                <tr>
                                                                    <th className="px-4 py-2 text-left font-caption font-semibold text-slate-400 uppercase tracking-wide">Nº Pedido</th>
                                                                    <th className="px-4 py-2 text-left font-caption font-semibold text-slate-400 uppercase tracking-wide hidden sm:table-cell">Cidade</th>
                                                                    <th className="px-4 py-2 text-left font-caption font-semibold text-slate-400 uppercase tracking-wide hidden md:table-cell">Categoria</th>
                                                                    <th className="px-4 py-2 text-left font-caption font-semibold text-slate-400 uppercase tracking-wide hidden tab:table-cell">% Frete</th>
                                                                    <th className="px-4 py-2 text-right font-caption font-semibold text-slate-400 uppercase tracking-wide">Valor Pedido</th>
                                                                    <th className="px-4 py-2 text-right font-caption font-semibold text-slate-400 uppercase tracking-wide">Frete</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {peds.map((p, i) => {
                                                                    const pct = Number(p.percentual_frete || 0.05);
                                                                    const frete = Number(p.valor_pedido || 0) * pct;
                                                                    return (
                                                                        <tr key={p.id || i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                                                                            <td className="px-4 py-2.5 font-data font-semibold" style={{ color: empConfig.color }}>
                                                                                {p.numero_pedido || '—'}
                                                                            </td>
                                                                            <td className="px-4 py-2.5 text-slate-600 hidden sm:table-cell">{p.cidade_destino || rom.destino || '—'}</td>
                                                                            <td className="px-4 py-2.5 text-slate-500 hidden md:table-cell">{p.categoria_frete || '—'}</td>
                                                                            <td className="px-4 py-2.5 text-slate-500 hidden tab:table-cell">{(pct * 100).toFixed(1)}%</td>
                                                                            <td className="px-4 py-2.5 text-right font-data font-medium text-slate-700">{fmtBRL(p.valor_pedido)}</td>
                                                                            <td className="px-4 py-2.5 text-right font-data font-semibold text-green-700">{fmtBRL(frete)}</td>
                                                                        </tr>
                                                                    );
                                                                })}
                                                            </tbody>
                                                            <tfoot>
                                                                <tr className="border-t border-slate-200" style={{ backgroundColor: empConfig.bg + '40' }}>
                                                                    <td colSpan={4} className="px-4 py-2 text-xs font-semibold font-caption text-slate-500">
                                                                        {peds.length} pedido(s) neste romaneio
                                                                    </td>
                                                                    <td className="px-4 py-2 text-right font-data font-bold text-sm" style={{ color: empConfig.color }}>
                                                                        {fmtBRL(valorRom)}
                                                                    </td>
                                                                    <td className="px-4 py-2 text-right font-data font-bold text-sm text-green-700">
                                                                        {fmtBRL(freteRom)}
                                                                    </td>
                                                                </tr>
                                                            </tfoot>
                                                        </table>
                                                    </div>
                                                </div>
                                            );
                                        })}

                                        {/* Totalizador final */}
                                        <div className="rounded-xl border-2 p-4 flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between"
                                            style={{ borderColor: empConfig.color, backgroundColor: empConfig.bg + '40' }}>
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: empConfig.color }}>
                                                    <Icon name="Building2" size={20} color="white" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold" style={{ color: empConfig.color }}>{empresaFiltro}</p>
                                                    <p className="text-xs text-slate-500 font-caption">{mesLabel} · {totalPedidos} pedidos · {romaneiosComPedidos.length} romaneios</p>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-3 sm:flex sm:gap-6 gap-3">
                                                <div className="text-center sm:text-right">
                                                    <p className="text-xs text-slate-400 font-caption">Valor Carga</p>
                                                    <p className="text-base sm:text-lg font-bold font-data" style={{ color: empConfig.color }}>{fmtBRL(valorCarga)}</p>
                                                </div>
                                                <div className="text-center sm:text-right">
                                                    <p className="text-xs text-slate-400 font-caption">Frete Total</p>
                                                    <p className="text-base sm:text-lg font-bold font-data text-green-700">{fmtBRL(freteTotal)}</p>
                                                </div>
                                                <div className="text-center sm:text-right">
                                                    <p className="text-xs text-slate-400 font-caption">Margem</p>
                                                    <p className="text-base sm:text-lg font-bold font-data" style={{ color: margemTotal >= 0 ? '#059669' : '#DC2626' }}>{fmtBRL(margemTotal)}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })()}

                </div>
            </main>
            {toast && <Toast message={toast.message} type={toast.type} />}
        </div>
    );
}
