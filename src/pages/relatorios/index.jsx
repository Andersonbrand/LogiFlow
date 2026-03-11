import React, { useState, useEffect, useMemo } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend, LineChart, Line, AreaChart, Area
} from 'recharts';
import NavigationBar from 'components/ui/NavigationBar';
import BreadcrumbTrail from 'components/ui/BreadcrumbTrail';
import Button from 'components/ui/Button';
import Icon from 'components/AppIcon';
import Toast from 'components/ui/Toast';
import { fetchRomaneios } from 'utils/romaneioService';
import { fetchVehicles } from 'utils/vehicleService';
import { fetchMaterials } from 'utils/materialService';
import { useToast } from 'utils/useToast';
import { exportRomaneiosToExcel, exportRelatorioConsolidado, exportRelatorioBonificacoes } from 'utils/excelUtils';
import * as XLSX from 'xlsx';

const COLORS = ['#1E3A5F', '#4A6741', '#D97706', '#059669', '#DC2626', '#7C3AED', '#0891B2'];
const TABS = [
    { id: 'operacional', label: 'Operacional', icon: 'BarChart2' },
    { id: 'financeiro',  label: 'Financeiro',  icon: 'DollarSign' },
    { id: 'frota',       label: 'Frota',        icon: 'Truck' },
];

function KpiCard({ label, value, sub, icon, color = '#1E3A5F', trend }) {
    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex items-start gap-4">
            <div className="flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center" style={{ backgroundColor: color + '18' }}>
                <Icon name={icon} size={22} color={color} />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-xs font-caption text-slate-500 mb-0.5">{label}</p>
                <p className="text-2xl font-bold font-data text-slate-800 leading-none">{value}</p>
                {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
                {trend !== undefined && (
                    <p className={`text-xs font-medium mt-1 ${trend >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {trend >= 0 ? '▲' : '▼'} {Math.abs(trend).toFixed(1)}% vs período anterior
                    </p>
                )}
            </div>
        </div>
    );
}

function SectionTitle({ title, subtitle }) {
    return (
        <div className="mb-4">
            <h2 className="text-base font-semibold text-slate-800">{title}</h2>
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
    );
}

function ChartCard({ title, children, height = 220 }) {
    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <p className="text-sm font-semibold text-slate-700 mb-4">{title}</p>
            <div style={{ height }}>{children}</div>
        </div>
    );
}

function fmt(n) { return Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtBRL(n) { return 'R$ ' + fmt(n); }
function fmtKg(n) { return Number(n || 0).toLocaleString('pt-BR') + ' kg'; }

export default function Relatorios() {
    const [romaneios, setRomaneios] = useState([]);
    const [vehicles, setVehicles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [periodo, setPeriodo] = useState('30');
    const [tab, setTab] = useState('operacional');
    const { toast, showToast } = useToast();

    useEffect(() => {
        (async () => {
            try {
                setLoading(true);
                const [rom, veh] = await Promise.all([fetchRomaneios(), fetchVehicles()]);
                setRomaneios(rom); setVehicles(veh);
            } catch (err) { showToast('Erro: ' + err.message, 'error'); }
            finally { setLoading(false); }
        })();
    }, []);

    const cutoff = useMemo(() => { const d = new Date(); d.setDate(d.getDate() - Number(periodo)); return d; }, [periodo]);
    const romFiltrados = useMemo(() => romaneios.filter(r => r.saida && new Date(r.saida) >= cutoff), [romaneios, cutoff]);
    const romFinalizados = romFiltrados.filter(r => r.status === 'Finalizado');

    // ─── Operacional KPIs ──────────────────────────────────────
    const totalViagens = romFiltrados.length;
    const finalizados = romFinalizados.length;
    const pesoTotal = romFinalizados.reduce((s, r) => s + (r.peso_total || 0), 0);
    const mediaDia = (totalViagens / Math.max(Number(periodo), 1)).toFixed(1);

    // Daily romaneios chart
    const porDia = useMemo(() => {
        const map = {};
        romFiltrados.forEach(r => {
            const d = r.saida?.slice(0, 10);
            if (d) map[d] = (map[d] || 0) + 1;
        });
        return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).slice(-14)
            .map(([date, count]) => ({ date: date.slice(5), count }));
    }, [romFiltrados]);

    // Status pie
    const porStatus = useMemo(() => {
        const map = {};
        romFiltrados.forEach(r => { map[r.status] = (map[r.status] || 0) + 1; });
        return Object.entries(map).map(([name, value]) => ({ name, value }));
    }, [romFiltrados]);

    // Top destinos
    const topDestinos = useMemo(() => {
        const map = {};
        romFiltrados.forEach(r => { if (r.destino) map[r.destino] = (map[r.destino] || 0) + 1; });
        return Object.entries(map).sort(([, a], [, b]) => b - a).slice(0, 6)
            .map(([destino, count]) => ({ destino: destino.split(',')[0].trim(), count }));
    }, [romFiltrados]);

    // ─── Financeiro KPIs ──────────────────────────────────────
    const receitaTotal = romFinalizados.reduce((s, r) => s + (r.valor_frete || 0), 0);
    const custoTotal = romFinalizados.reduce((s, r) =>
        s + (r.custo_combustivel || 0) + (r.custo_pedagio || 0) + (r.custo_motorista || 0), 0);
    const margemLucro = receitaTotal > 0 ? ((receitaTotal - custoTotal) / receitaTotal * 100) : 0;
    const ticketMedio = finalizados > 0 ? receitaTotal / finalizados : 0;

    // Custo por componente
    const custosBreakdown = useMemo(() => [
        { name: 'Combustível', value: romFinalizados.reduce((s, r) => s + (r.custo_combustivel || 0), 0) },
        { name: 'Pedágio',     value: romFinalizados.reduce((s, r) => s + (r.custo_pedagio || 0), 0) },
        { name: 'Motorista',   value: romFinalizados.reduce((s, r) => s + (r.custo_motorista || 0), 0) },
    ].filter(c => c.value > 0), [romFinalizados]);

    // Receita vs Custo por mês
    const financeiroPorMes = useMemo(() => {
        const map = {};
        romFinalizados.forEach(r => {
            const m = r.saida?.slice(0, 7);
            if (!m) return;
            if (!map[m]) map[m] = { mes: m.slice(5), receita: 0, custo: 0 };
            map[m].receita += r.valor_frete || 0;
            map[m].custo += (r.custo_combustivel || 0) + (r.custo_pedagio || 0) + (r.custo_motorista || 0);
        });
        return Object.values(map).sort((a, b) => a.mes.localeCompare(b.mes));
    }, [romFinalizados]);

    // Top rotas por receita
    const topRotas = useMemo(() => {
        const map = {};
        romFinalizados.forEach(r => {
            if (!r.destino) return;
            const key = r.destino.split(',')[0].trim();
            if (!map[key]) map[key] = { destino: key, receita: 0, viagens: 0 };
            map[key].receita += r.valor_frete || 0;
            map[key].viagens += 1;
        });
        return Object.values(map).sort((a, b) => b.receita - a.receita).slice(0, 6);
    }, [romFinalizados]);

    // ─── Frota KPIs ──────────────────────────────────────────
    const frota = vehicles.length;
    const disponiveis = vehicles.filter(v => v.status === 'Disponível').length;
    const emTransito = vehicles.filter(v => v.status === 'Em Trânsito').length;
    const manutencao = vehicles.filter(v => v.status === 'Manutenção').length;
    const utilizacaoMedia = frota > 0 ? vehicles.reduce((s, v) => s + (v.utilizacao || 0), 0) / frota : 0;

    const frotaStatus = [
        { name: 'Disponível', value: disponiveis },
        { name: 'Em Trânsito', value: emTransito },
        { name: 'Manutenção', value: manutencao },
    ].filter(s => s.value > 0);

    const utilizacaoVeiculos = vehicles.map(v => ({ placa: v.placa, utilizacao: v.utilizacao || 0 }))
        .sort((a, b) => b.utilizacao - a.utilizacao);

    // ─── Export financeiro Excel ────────────────────────────
    const exportConsolidadoExcel = () => {
        try {
            exportRelatorioConsolidado(romaneios, periodo);
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
            const di = periodo?.inicio ? new Date(periodo.inicio).toLocaleDateString('pt-BR') : '';
            const df = periodo?.fim    ? new Date(periodo.fim).toLocaleDateString('pt-BR')    : '';
            exportRelatorioBonificacoes(romBonif, di, df);
            showToast('Relatório de bonificações exportado!', 'success');
        } catch(e) {
            showToast('Erro ao exportar: ' + e.message, 'error');
        }
    };

    const exportFinanceiroExcel = () => {
        if (romFinalizados.length === 0) { showToast('Nenhum romaneio finalizado no período', 'error'); return; }

        const n = v => Number(v) || 0;
        const brl = v => n(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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
                <div className="max-w-screen-2xl mx-auto px-4 md:px-6 lg:px-8 py-6">
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
                        <div className="flex flex-col gap-6">
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                <KpiCard label="Total de Viagens" value={totalViagens} icon="FileText" color="#1E3A5F" sub={`Últimos ${periodo} dias`} />
                                <KpiCard label="Finalizadas" value={finalizados} icon="CheckCircle2" color="#059669" sub={`${totalViagens > 0 ? Math.round(finalizados/totalViagens*100) : 0}% do total`} />
                                <KpiCard label="Peso Transportado" value={fmtKg(pesoTotal)} icon="Weight" color="#D97706" sub="Entregas finalizadas" />
                                <KpiCard label="Média / Dia" value={mediaDia} icon="TrendingUp" color="#7C3AED" sub="Viagens por dia" />
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                                <ChartCard title="Romaneios por Dia (últimos 14 dias)" height={220}>
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
                    )}

                    {/* ── TAB: FINANCEIRO ── */}
                    {tab === 'financeiro' && (
                        <div className="flex flex-col gap-6">
                            <div className="flex justify-end gap-2">
                                <Button variant="outline" iconName="FileSpreadsheet" iconSize={14} onClick={exportFinanceiroExcel}>
                                    Exportar Financeiro Excel
                                </Button>
                                <Button variant="outline" iconName="Award" iconSize={14} onClick={exportBonificacoesExcel}>
                                    Bonificações Motoristas
                                </Button>
                                <Button variant="default" iconName="Download" iconSize={14} onClick={exportConsolidadoExcel}>
                                    Relatório Consolidado
                                </Button>
                            </div>

                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                <KpiCard label="Receita Total" value={fmtBRL(receitaTotal)} icon="TrendingUp" color="#059669" sub="Fretes cobrados" />
                                <KpiCard label="Custo Total" value={fmtBRL(custoTotal)} icon="TrendingDown" color="#DC2626" sub="Operacional" />
                                <KpiCard label="Margem de Lucro" value={`${margemLucro.toFixed(1)}%`} icon="Percent" color={margemLucro >= 20 ? '#059669' : '#D97706'} sub={fmtBRL(receitaTotal - custoTotal) + ' líquido'} />
                                <KpiCard label="Ticket Médio" value={fmtBRL(ticketMedio)} icon="Receipt" color="#7C3AED" sub="Por viagem finalizada" />
                            </div>

                            {financeiroPorMes.length > 0 ? (
                                <ChartCard title="Receita vs Custo por Mês" height={240}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={financeiroPorMes}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                                            <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                                            <YAxis tick={{ fontSize: 11 }} tickFormatter={v => 'R$' + (v/1000).toFixed(0) + 'k'} />
                                            <Tooltip formatter={(v) => fmtBRL(v)} />
                                            <Legend />
                                            <Bar dataKey="receita" name="Receita" fill="#059669" radius={[4,4,0,0]} />
                                            <Bar dataKey="custo" name="Custo" fill="#DC2626" radius={[4,4,0,0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </ChartCard>
                            ) : (
                                <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-slate-400">
                                    <Icon name="DollarSign" size={40} color="#CBD5E1" />
                                    <p className="mt-3 text-sm font-medium">Nenhum dado financeiro no período</p>
                                    <p className="text-xs mt-1">Cadastre valores de frete e custos nos romaneios finalizados</p>
                                </div>
                            )}

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                                {custosBreakdown.length > 0 && (
                                    <ChartCard title="Composição dos Custos" height={200}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                {custosBreakdown.length > 0 && custosBreakdown.some(d => d.value > 0) && (
                                                <Pie data={custosBreakdown.filter(d => d.value > 0)} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75}
                                                    label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`}>
                                                    {custosBreakdown.filter(d => d.value > 0).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                                </Pie>
                                                )}
                                                <Tooltip formatter={v => fmtBRL(v)} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </ChartCard>
                                )}

                                {topRotas.length > 0 && (
                                    <ChartCard title="Top Rotas por Receita" height={200}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={topRotas} layout="vertical">
                                                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                                                <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => 'R$'+(v/1000).toFixed(0)+'k'} />
                                                <YAxis dataKey="destino" type="category" tick={{ fontSize: 10 }} width={100} />
                                                <Tooltip formatter={v => fmtBRL(v)} />
                                                <Bar dataKey="receita" name="Receita" fill="#1E3A5F" radius={[0,4,4,0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </ChartCard>
                                )}
                            </div>

                            {/* Tabela detalhada */}
                            {romFinalizados.length > 0 && (
                                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                    <div className="px-5 py-4 border-b border-slate-100">
                                        <p className="text-sm font-semibold text-slate-700">Detalhe por Romaneio</p>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead className="bg-slate-50">
                                                <tr>
                                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Romaneio</th>
                                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide hidden sm:table-cell">Destino</th>
                                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Frete</th>
                                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Custo</th>
                                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Margem</th>
                                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide hidden sm:table-cell">%</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {romFinalizados.slice(0, 20).map((r, i) => {
                                                    const custo = (r.custo_combustivel||0)+(r.custo_pedagio||0)+(r.custo_motorista||0);
                                                    const margem = (r.valor_frete||0) - custo;
                                                    const pct = r.valor_frete > 0 ? margem/r.valor_frete*100 : 0;
                                                    return (
                                                        <tr key={r.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                                                            <td className="px-4 py-2.5">
                                                                <p className="font-data font-medium text-blue-700 text-xs">{r.numero}</p>
                                                                <p className="text-slate-400 text-xs sm:hidden">{r.destino}</p>
                                                            </td>
                                                            <td className="px-4 py-2.5 text-slate-600 text-xs hidden sm:table-cell">{r.destino}</td>
                                                            <td className="px-4 py-2.5 font-data text-green-700 text-xs">{fmtBRL(r.valor_frete)}</td>
                                                            <td className="px-4 py-2.5 font-data text-red-600 text-xs hidden md:table-cell">{fmtBRL(custo)}</td>
                                                            <td className="px-4 py-2.5 font-data font-semibold text-xs" style={{ color: margem >= 0 ? '#059669' : '#DC2626' }}>{fmtBRL(margem)}</td>
                                                            <td className="px-4 py-2.5 hidden sm:table-cell">
                                                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${pct >= 20 ? 'bg-green-100 text-green-700' : pct >= 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                                                                    {pct.toFixed(1)}%
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── TAB: FROTA ── */}
                    {tab === 'frota' && (
                        <div className="flex flex-col gap-6">
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                <KpiCard label="Total de Veículos" value={frota} icon="Truck" color="#1E3A5F" />
                                <KpiCard label="Disponíveis" value={disponiveis} icon="CheckCircle2" color="#059669" sub={frota > 0 ? `${Math.round(disponiveis/frota*100)}% da frota` : ''} />
                                <KpiCard label="Em Trânsito" value={emTransito} icon="Navigation" color="#D97706" />
                                <KpiCard label="Utilização Média" value={`${utilizacaoMedia.toFixed(0)}%`} icon="Activity" color={utilizacaoMedia > 80 ? '#DC2626' : '#059669'} sub={manutencao > 0 ? `${manutencao} em manutenção` : undefined} />
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                                <ChartCard title="Utilização por Veículo (%)" height={Math.max(200, vehicles.length * 35)}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={utilizacaoVeiculos} layout="vertical">
                                            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                                            <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} tickFormatter={v => v + '%'} />
                                            <YAxis dataKey="placa" type="category" tick={{ fontSize: 11 }} width={80} />
                                            <Tooltip formatter={v => v + '%'} />
                                            <Bar dataKey="utilizacao" name="Utilização" radius={[0,4,4,0]}
                                                fill="#1E3A5F"
                                                label={{ position: 'right', fontSize: 10, formatter: v => v + '%' }} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </ChartCard>

                                <ChartCard title="Status da Frota" height={220}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            {frotaStatus.filter(d => d.value > 0).length > 0 && (
                                                <Pie data={frotaStatus.filter(d => d.value > 0)} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}
                                                    label={({ name, value }) => `${name}: ${value}`}>
                                                    {frotaStatus.filter(d => d.value > 0).map((_, i) => <Cell key={i} fill={['#059669','#D97706','#DC2626'][i]} />)}
                                                </Pie>
                                            )}
                                            <Tooltip />
                                            <Legend />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </ChartCard>
                            </div>

                            {/* Tabela de veículos */}
                            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                <div className="px-5 py-4 border-b border-slate-100">
                                    <p className="text-sm font-semibold text-slate-700">Detalhe da Frota</p>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-slate-50">
                                            <tr>
                                                {['Placa','Tipo','Status','Cap. Peso','Cap. Volume','Utilização'].map(h => (
                                                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {vehicles.map((v, i) => (
                                                <tr key={v.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                                                    <td className="px-4 py-2.5 font-data font-bold text-slate-800">{v.placa}</td>
                                                    <td className="px-4 py-2.5 text-slate-600">{v.tipo}</td>
                                                    <td className="px-4 py-2.5">
                                                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                                            v.status === 'Disponível' ? 'bg-green-100 text-green-700' :
                                                            v.status === 'Em Trânsito' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                                                            {v.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-2.5 font-data">{(v.capacidadePeso||0).toLocaleString('pt-BR')} kg</td>
                                                    <td className="px-4 py-2.5 font-data">{(v.capacidadeVolume||0).toLocaleString('pt-BR')} m³</td>
                                                    <td className="px-4 py-2.5">
                                                        <div className="flex items-center gap-2">
                                                            <div className="flex-1 bg-slate-100 rounded-full h-2">
                                                                <div className="h-2 rounded-full" style={{ width: `${v.utilizacao||0}%`, backgroundColor: (v.utilizacao||0) > 90 ? '#DC2626' : '#059669' }} />
                                                            </div>
                                                            <span className="text-xs font-data">{v.utilizacao||0}%</span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </main>
            {toast && <Toast message={toast.message} type={toast.type} />}
        </div>
    );
}
