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
import { fetchDespesasCaminhoes } from 'utils/caminhoesDespesasService';
import { fetchVehicles } from 'utils/vehicleService';
import { fetchMaterials } from 'utils/materialService';
import { useToast } from 'utils/useToast';
import { exportRomaneiosToExcel, exportRelatorioConsolidado, exportRelatorioBonificacoes } from 'utils/excelUtils';
import { EMPRESAS } from 'pages/romaneios/components/RomaneioFormModal';
import * as XLSX from 'xlsx';

const COLORS = ['#1E3A5F', '#4A6741', '#D97706', '#059669', '#DC2626', '#7C3AED', '#0891B2'];
const TABS = [
    { id: 'operacional', label: 'Operacional', icon: 'BarChart2' },
    { id: 'financeiro',  label: 'Financeiro',  icon: 'DollarSign' },
    { id: 'frota',       label: 'Frota',        icon: 'Truck' },
    { id: 'empresas',    label: 'Por Empresa',  icon: 'Building2' },
];

function KpiCard({ label, value, sub, icon, color = '#1E3A5F', trend }) {
    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 sm:p-5 flex items-start gap-3 sm:gap-4">
            <div className="flex-shrink-0 w-9 h-9 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center" style={{ backgroundColor: color + '18' }}>
                <Icon name={icon} size={18} color={color} />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-xs font-caption text-slate-500 mb-0.5 leading-tight">{label}</p>
                <p className="text-lg sm:text-2xl font-bold font-data text-slate-800 leading-tight break-words">{value}</p>
                {sub && <p className="text-xs text-slate-400 mt-0.5 leading-tight">{sub}</p>}
                {trend !== undefined && (
                    <p className={`text-xs font-medium mt-1 ${trend >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {trend >= 0 ? '▲' : '▼'} {Math.abs(trend).toFixed(1)}%
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
    const [despesasCaminhoes, setDespesasCaminhoes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [periodo, setPeriodo] = useState('30');
    const [tab, setTab] = useState('operacional');
    const [empresaFiltro, setEmpresaFiltro] = useState('Comercial Araguaia');
    const [mesFiltro, setMesFiltro] = useState(() => new Date().toISOString().slice(0, 7)); // YYYY-MM
    const { toast, showToast } = useToast();

    useEffect(() => {
        (async () => {
            try {
                setLoading(true);
                const [rom, veh, desp] = await Promise.all([fetchRomaneios(), fetchVehicles(), fetchDespesasCaminhoes()]);
                setRomaneios(rom); setVehicles(veh); setDespesasCaminhoes(desp);
            } catch (err) { showToast('Erro: ' + err.message, 'error'); }
            finally { setLoading(false); }
        })();
    }, []);

    // Recarrega romaneios ao trocar empresa ou mês na aba Por Empresa
    useEffect(() => {
        if (tab !== 'empresas') return;
        fetchRomaneios()
            .then(setRomaneios)
            .catch(err => showToast('Erro ao atualizar: ' + err.message, 'error'));
    }, [tab, empresaFiltro, mesFiltro]); // eslint-disable-line

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

    // ─── Despesas Caminhões KPIs ─────────────────────────────
    const despesasFiltradas = useMemo(() => {
        const cutoffDesp = new Date(); cutoffDesp.setDate(cutoffDesp.getDate() - Number(periodo));
        return despesasCaminhoes.filter(d => d.data_despesa && new Date(d.data_despesa) >= cutoffDesp);
    }, [despesasCaminhoes, periodo]);

    const totalDespesasCaminhoes = despesasFiltradas.reduce((s, d) => s + (d.valor_total || 0), 0);

    const despesasPorCategoria = useMemo(() => {
        const map = {};
        despesasFiltradas.forEach(d => {
            const cat = d.categoria || 'Outros';
            map[cat] = (map[cat] || 0) + (d.valor_total || 0);
        });
        return Object.entries(map).sort(([,a],[,b]) => b - a).map(([name, value]) => ({ name, value }));
    }, [despesasFiltradas]);

    const despesasPorMes = useMemo(() => {
        const map = {};
        despesasFiltradas.forEach(d => {
            const m = d.data_despesa?.slice(0, 7);
            if (!m) return;
            if (!map[m]) map[m] = { mes: m.slice(5), total: 0 };
            map[m].total += d.valor_total || 0;
        });
        return Object.values(map).sort((a, b) => a.mes.localeCompare(b.mes));
    }, [despesasFiltradas]);

    // ─── DRE Mensal Caminhões ─────────────────────────────────
    const dreMensal = useMemo(() => {
        // Consolida receitas dos romaneios finalizados por mês
        const map = {};

        romFinalizados.forEach(r => {
            const m = r.saida?.slice(0, 7);
            if (!m) return;
            if (!map[m]) map[m] = {
                mes: m, mesLabel: m.slice(5),
                receita: 0,
                custoCombustivel: 0,
                custoPedagio: 0,
                custoMotorista: 0,
                despesasCaminhoes: 0,
                viagens: 0,
            };
            map[m].receita          += r.valor_frete          || 0;
            map[m].custoCombustivel += r.custo_combustivel     || 0;
            map[m].custoPedagio     += r.custo_pedagio         || 0;
            map[m].custoMotorista   += r.custo_motorista       || 0;
            map[m].viagens++;
        });

        // Soma despesas de caminhões (manutenção, pneus, etc.) por mês
        despesasCaminhoes.forEach(d => {
            const m = d.data_despesa?.slice(0, 7);
            if (!m) return;
            if (!map[m]) map[m] = {
                mes: m, mesLabel: m.slice(5),
                receita: 0,
                custoCombustivel: 0,
                custoPedagio: 0,
                custoMotorista: 0,
                despesasCaminhoes: 0,
                viagens: 0,
            };
            map[m].despesasCaminhoes += d.valor_total || 0;
        });

        return Object.values(map)
            .sort((a, b) => a.mes.localeCompare(b.mes))
            .map(m => {
                const custoOperacional = m.custoCombustivel + m.custoPedagio + m.custoMotorista;
                const totalDespesas    = custoOperacional + m.despesasCaminhoes;
                const margemBruta      = m.receita - m.custoCombustivel;
                const resultadoLiquido = m.receita - totalDespesas;
                const margemPct        = m.receita > 0 ? (resultadoLiquido / m.receita) * 100 : 0;
                return { ...m, custoOperacional, totalDespesas, margemBruta, resultadoLiquido, margemPct };
            });
    }, [romFinalizados, despesasCaminhoes]);

    // Totais consolidados da DRE
    const dreTotais = useMemo(() => {
        const t = dreMensal.reduce((acc, m) => ({
            receita:          acc.receita          + m.receita,
            custoCombustivel: acc.custoCombustivel + m.custoCombustivel,
            custoPedagio:     acc.custoPedagio     + m.custoPedagio,
            custoMotorista:   acc.custoMotorista   + m.custoMotorista,
            despesasCaminhoes:acc.despesasCaminhoes+ m.despesasCaminhoes,
            totalDespesas:    acc.totalDespesas    + m.totalDespesas,
            margemBruta:      acc.margemBruta      + m.margemBruta,
            resultadoLiquido: acc.resultadoLiquido + m.resultadoLiquido,
            viagens:          acc.viagens          + m.viagens,
        }), { receita:0, custoCombustivel:0, custoPedagio:0, custoMotorista:0, despesasCaminhoes:0, totalDespesas:0, margemBruta:0, resultadoLiquido:0, viagens:0 });
        t.margemPct = t.receita > 0 ? (t.resultadoLiquido / t.receita) * 100 : 0;
        return t;
    }, [dreMensal]);

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
                <div className="max-w-screen-2xl mx-auto px-4 tab:px-6 lg:px-8 py-6">
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
                            <div className="grid grid-cols-2 tab:grid-cols-4 gap-4">
                                <KpiCard label="Total de Viagens" value={totalViagens} icon="FileText" color="#1E3A5F" sub={`Últimos ${periodo} dias`} />
                                <KpiCard label="Finalizadas" value={finalizados} icon="CheckCircle2" color="#059669" sub={`${totalViagens > 0 ? Math.round(finalizados/totalViagens*100) : 0}% do total`} />
                                <KpiCard label="Peso Transportado" value={fmtKg(pesoTotal)} icon="Weight" color="#D97706" sub="Entregas finalizadas" />
                                <KpiCard label="Média / Dia" value={mediaDia} icon="TrendingUp" color="#7C3AED" sub="Viagens por dia" />
                            </div>

                            <div className="grid grid-cols-1 tab:grid-cols-2 gap-5">
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
                            <div className="flex flex-wrap gap-2 justify-end">
                                <button onClick={exportFinanceiroExcel}
                                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-colors hover:bg-slate-50 whitespace-nowrap"
                                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>
                                    <Icon name="FileSpreadsheet" size={13} color="currentColor" />
                                    <span className="hidden xs:inline sm:inline">Financeiro Excel</span>
                                    <span className="xs:hidden sm:hidden">Fin.</span>
                                </button>
                                <button onClick={exportBonificacoesExcel}
                                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-colors hover:bg-slate-50 whitespace-nowrap"
                                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>
                                    <Icon name="Award" size={13} color="currentColor" />
                                    <span className="hidden sm:inline">Bonificações</span>
                                    <span className="sm:hidden">Bonif.</span>
                                </button>
                                <button onClick={exportConsolidadoExcel}
                                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap"
                                    style={{ backgroundColor: 'var(--color-primary)', color: 'white' }}>
                                    <Icon name="Download" size={13} color="white" />
                                    <span className="hidden sm:inline">Rel. Consolidado</span>
                                    <span className="sm:hidden">Consolidado</span>
                                </button>
                            </div>

                            <div className="grid grid-cols-2 tab:grid-cols-4 gap-4">
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
                                <div className="bg-white rounded-xl border border-slate-200 p-10 flex flex-col items-center justify-center gap-2">
                                    <Icon name="DollarSign" size={40} color="#CBD5E1" />
                                    <p className="text-sm font-medium text-slate-400">Nenhum dado financeiro no período</p>
                                    <p className="text-xs text-center text-slate-400">Cadastre valores de frete e custos nos romaneios finalizados</p>
                                </div>
                            )}

                            <div className="grid grid-cols-1 tab:grid-cols-2 gap-5">
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
                                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide hidden tab:table-cell">Destino</th>
                                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Frete</th>
                                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Custo</th>
                                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Margem</th>
                                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide hidden tab:table-cell">%</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {romFinalizados.slice(0, 20).map((r, i) => {
                                                    const custo = (r.custo_combustivel||0)+(r.custo_pedagio||0)+(r.custo_motorista||0);
                                                    const margem = (r.valor_frete||0) - custo;
                                                    const pct = r.valor_frete > 0 ? margem/r.valor_frete*100 : 0;
                                                    return (
                                                        <tr key={r.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                                                            <td className="px-3 py-2.5">
                                                                <p className="font-data font-medium text-blue-700 text-xs whitespace-nowrap">{r.numero}</p>
                                                                <p className="text-slate-400 text-xs sm:hidden">{r.destino}</p>
                                                            </td>
                                                            <td className="px-4 py-2.5 text-slate-600 text-xs hidden tab:table-cell">{r.destino}</td>
                                                            <td className="px-4 py-2.5 font-data text-green-700 text-xs">{fmtBRL(r.valor_frete)}</td>
                                                            <td className="px-4 py-2.5 font-data text-red-600 text-xs hidden md:table-cell">{fmtBRL(custo)}</td>
                                                            <td className="px-4 py-2.5 font-data font-semibold text-xs" style={{ color: margem >= 0 ? '#059669' : '#DC2626' }}>{fmtBRL(margem)}</td>
                                                            <td className="px-4 py-2.5 hidden tab:table-cell">
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

                    {/* ── TAB: DESPESAS CAMINHÕES (dentro de Financeiro) ── */}
                    {tab === 'financeiro' && (
                        <div className="flex flex-col gap-6 mt-2">
                            <div className="flex items-center gap-2 pb-1 border-b border-slate-200">
                                <Icon name="Truck" size={16} color="#1E3A5F" />
                                <p className="text-sm font-semibold text-slate-700">Despesas de Caminhões</p>
                                <span className="ml-auto text-xs text-slate-400">{despesasFiltradas.length} registros no período</span>
                            </div>

                            <div className="grid grid-cols-2 tab:grid-cols-3 gap-4">
                                <KpiCard label="Total de Despesas" value={fmtBRL(totalDespesasCaminhoes)} icon="Receipt" color="#DC2626" sub="Caminhões no período" />
                                <KpiCard label="Categorias" value={despesasPorCategoria.length} icon="Tag" color="#7C3AED" sub="Tipos de despesa" />
                                <KpiCard label="Média por Despesa" value={despesasFiltradas.length > 0 ? fmtBRL(totalDespesasCaminhoes / despesasFiltradas.length) : 'R$ 0,00'} icon="Calculator" color="#D97706" sub="Custo médio por registro" />
                            </div>

                            {despesasPorMes.length > 0 && (
                                <ChartCard title="Despesas por Mês" height={220}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={despesasPorMes}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                                            <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                                            <YAxis tick={{ fontSize: 11 }} tickFormatter={v => 'R$' + (v/1000).toFixed(0) + 'k'} />
                                            <Tooltip formatter={(v) => fmtBRL(v)} />
                                            <Bar dataKey="total" name="Despesas" fill="#DC2626" radius={[4,4,0,0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </ChartCard>
                            )}

                            {despesasPorCategoria.length > 0 && (
                                <div className="grid grid-cols-1 tab:grid-cols-2 gap-5">
                                    <ChartCard title="Despesas por Categoria" height={200}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie data={despesasPorCategoria.filter(d => d.value > 0)} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75}
                                                    label={({ name, percent }) => `${name.length > 10 ? name.slice(0,10)+'…' : name} ${(percent*100).toFixed(0)}%`}>
                                                    {despesasPorCategoria.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                                </Pie>
                                                <Tooltip formatter={v => fmtBRL(v)} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </ChartCard>

                                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                        <div className="px-4 py-3 border-b border-slate-100">
                                            <p className="text-sm font-semibold text-slate-700">Top Categorias</p>
                                        </div>
                                        <div className="divide-y divide-slate-50">
                                            {despesasPorCategoria.slice(0, 6).map((c, i) => (
                                                <div key={i} className="px-4 py-2.5 flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                                                        <span className="text-xs text-slate-700">{c.name}</span>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-xs font-semibold text-slate-800">{fmtBRL(c.value)}</p>
                                                        <p className="text-xs text-slate-400">{totalDespesasCaminhoes > 0 ? ((c.value/totalDespesasCaminhoes)*100).toFixed(1) : 0}%</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {despesasFiltradas.length === 0 && (
                                <div className="bg-white rounded-xl border border-slate-200 p-10 flex flex-col items-center justify-center gap-2">
                                    <Icon name="Truck" size={40} color="#CBD5E1" />
                                    <p className="text-sm font-medium text-slate-400">Nenhuma despesa de caminhão no período</p>
                                    <p className="text-xs text-center text-slate-400">Cadastre despesas no módulo de Despesas Caminhões</p>
                                </div>
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
                            <div className="grid grid-cols-2 tab:grid-cols-4 gap-4">
                                <KpiCard label="Receita Total" value={fmtBRL(dreTotais.receita)} icon="TrendingUp" color="#059669" sub={`${dreTotais.viagens} viagens finalizadas`} />
                                <KpiCard label="Custo Operacional" value={fmtBRL(dreTotais.totalDespesas - dreTotais.despesasCaminhoes)} icon="Fuel" color="#D97706" sub="Combustível + Pedágio + Motoristas" />
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
                        <div className="flex flex-col gap-6">
                            <div className="grid grid-cols-2 tab:grid-cols-4 gap-4">
                                <KpiCard label="Total de Veículos" value={frota} icon="Truck" color="#1E3A5F" />
                                <KpiCard label="Disponíveis" value={disponiveis} icon="CheckCircle2" color="#059669" sub={frota > 0 ? `${Math.round(disponiveis/frota*100)}% da frota` : ''} />
                                <KpiCard label="Em Trânsito" value={emTransito} icon="Navigation" color="#D97706" />
                                <KpiCard label="Utilização Média" value={`${utilizacaoMedia.toFixed(0)}%`} icon="Activity" color={utilizacaoMedia > 80 ? '#DC2626' : '#059669'} sub={manutencao > 0 ? `${manutencao} em manutenção` : undefined} />
                            </div>

                            <div className="grid grid-cols-1 tab:grid-cols-2 gap-5">
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
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Placa</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide hidden tab:table-cell">Tipo</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Cap. Peso</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide hidden lg:table-cell">Cap. Volume</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide hidden tab:table-cell">Utilização</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {vehicles.map((v, i) => (
                                                <tr key={v.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                                                    <td className="px-4 py-2.5">
                                                        <p className="font-data font-bold text-slate-800 text-xs">{v.placa}</p>
                                                        <p className="text-xs text-slate-400 sm:hidden">{v.tipo}</p>
                                                    </td>
                                                    <td className="px-4 py-2.5 text-slate-600 text-xs hidden tab:table-cell">{v.tipo}</td>
                                                    <td className="px-4 py-2.5">
                                                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${
                                                            v.status === 'Disponível' ? 'bg-green-100 text-green-700' :
                                                            v.status === 'Em Trânsito' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                                                            {v.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-2.5 font-data text-xs hidden md:table-cell">{(v.capacidadePeso||0).toLocaleString('pt-BR')} kg</td>
                                                    <td className="px-4 py-2.5 font-data text-xs hidden lg:table-cell">{(v.capacidadeVolume||0).toLocaleString('pt-BR')} m³</td>
                                                    <td className="px-4 py-2.5 hidden tab:table-cell">
                                                        <div className="flex items-center gap-2">
                                                            <div className="flex-1 bg-slate-100 rounded-full h-1.5">
                                                                <div className="h-1.5 rounded-full" style={{ width: `${v.utilizacao||0}%`, backgroundColor: (v.utilizacao||0) > 90 ? '#DC2626' : '#059669' }} />
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
                            const ws = XLSX.utils.json_to_sheet(rows);
                            ws['!cols'] = Object.keys(rows[0] || {}).map(() => ({ wch: 20 }));
                            XLSX.utils.book_append_sheet(wb, ws, empresaFiltro.slice(0, 31));
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
