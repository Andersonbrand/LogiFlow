import React, { useState, useEffect, useMemo } from 'react';
import NavigationBar from 'components/ui/NavigationBar';
import BreadcrumbTrail from 'components/ui/BreadcrumbTrail';
import Button from 'components/ui/Button';
import Icon from 'components/AppIcon';
import Toast from 'components/ui/Toast';
import { useToast } from 'utils/useToast';
import { fetchRomaneios } from 'utils/romaneioService';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import * as XLSX from 'xlsx';

const PERIOD_OPTIONS = [
    { label: '30 dias', days: 30 }, { label: '90 dias', days: 90 },
    { label: '6 meses', days: 180 }, { label: '1 ano',   days: 365 },
];
const BRL = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const COLORS = ['#1D4ED8', '#DC2626', '#D97706', '#059669', '#7C3AED'];

export default function Financeiro() {
    const [romaneios, setRomaneios] = useState([]);
    const [loading, setLoading]     = useState(true);
    const [period, setPeriod]       = useState(30);
    // ✅ MELHORIA: Filtros avançados de exportação
    const [filterMotorista, setFilterMotorista] = useState('');
    const [filterDestino, setFilterDestino]     = useState('');
    const [showFilters, setShowFilters]         = useState(false);
    const { toast, showToast }                  = useToast();

    useEffect(() => {
        (async () => {
            try { setLoading(true); setRomaneios(await fetchRomaneios()); }
            catch (err) { showToast('Erro: ' + err.message, 'error'); }
            finally { setLoading(false); }
        })();
    }, []);

    const safeRomaneios = useMemo(() =>
        romaneios.map(r => ({
            ...r,
            valor_frete:       Number(r.valor_frete)       || 0,
            custo_combustivel: Number(r.custo_combustivel) || 0,
            custo_pedagio:     Number(r.custo_pedagio)     || 0,
            custo_motorista:   Number(r.custo_motorista)   || 0,
            distancia_km:      Number(r.distancia_km)      || 0,
        })), [romaneios]);

    const filtered = useMemo(() => {
        const cut = new Date(); cut.setDate(cut.getDate() - period);
        return safeRomaneios.filter(r => {
            if (r.status !== 'Finalizado' || !r.saida) return false;
            if (new Date(r.saida) < cut) return false;
            // ✅ Filtros avançados aplicados
            if (filterMotorista && !r.motorista?.toLowerCase().includes(filterMotorista.toLowerCase())) return false;
            if (filterDestino && !r.destino?.toLowerCase().includes(filterDestino.toLowerCase())) return false;
            return true;
        });
    }, [safeRomaneios, period, filterMotorista, filterDestino]);

    const kpis = useMemo(() => {
        const frete  = filtered.reduce((a, r) => a + r.valor_frete, 0);
        const comb   = filtered.reduce((a, r) => a + r.custo_combustivel, 0);
        const ped    = filtered.reduce((a, r) => a + r.custo_pedagio, 0);
        const mot    = filtered.reduce((a, r) => a + r.custo_motorista, 0);
        const custo  = comb + ped + mot;
        const km     = filtered.reduce((a, r) => a + r.distancia_km, 0);
        return { frete, custo, margem: frete - custo, comb, ped, mot, km, count: filtered.length };
    }, [filtered]);

    const byRota = useMemo(() => {
        const m = {};
        filtered.forEach(r => {
            const k = r.destino || 'Sem destino';
            if (!m[k]) m[k] = { destino: k, frete: 0, custo: 0, count: 0 };
            m[k].frete  += r.valor_frete;
            m[k].custo  += r.custo_combustivel + r.custo_pedagio + r.custo_motorista;
            m[k].count++;
        });
        return Object.values(m).sort((a, b) => b.frete - a.frete).slice(0, 8).map(r => ({ ...r, margem: r.frete - r.custo }));
    }, [filtered]);

    const costsPie = [
        { name: 'Combustível', value: kpis.comb },
        { name: 'Pedágios',    value: kpis.ped },
        { name: 'Motoristas',  value: kpis.mot },
    ].filter(c => c.value > 0);

    // ✅ MELHORIA: Exportação com filtros aplicados + sumário automático
    const exportExcel = () => {
        const rows = filtered.map(r => {
            const custo = r.custo_combustivel + r.custo_pedagio + r.custo_motorista;
            const margem = r.valor_frete - custo;
            return {
                'Nº Romaneio':   r.numero,
                'Motorista':     r.motorista || '',
                'Destino':       r.destino   || '',
                'Data Saída':    r.saida ? new Date(r.saida).toLocaleDateString('pt-BR') : '',
                'KM Rodados':    r.distancia_km || 0,
                'Frete (R$)':    r.valor_frete,
                'Combustível (R$)': r.custo_combustivel,
                'Pedágios (R$)': r.custo_pedagio,
                'Motorista (R$)':r.custo_motorista,
                'Total Custos (R$)': custo,
                'Margem (R$)':   margem,
                'Margem (%)':    r.valor_frete > 0 ? `${((margem / r.valor_frete) * 100).toFixed(1)}%` : '0%',
            };
        });

        // Linha de totais
        rows.push({
            'Nº Romaneio':   'TOTAL',
            'Motorista':     `${filtered.length} viagens`,
            'Destino':       '',
            'Data Saída':    '',
            'KM Rodados':    kpis.km,
            'Frete (R$)':    kpis.frete,
            'Combustível (R$)': kpis.comb,
            'Pedágios (R$)': kpis.ped,
            'Motorista (R$)':kpis.mot,
            'Total Custos (R$)': kpis.custo,
            'Margem (R$)':   kpis.margem,
            'Margem (%)':    kpis.frete > 0 ? `${((kpis.margem / kpis.frete) * 100).toFixed(1)}%` : '0%',
        });

        const ws = XLSX.utils.json_to_sheet(rows);
        ws['!cols'] = [12,18,22,12,10,12,14,12,13,14,12,10].map(w => ({ wch: w }));

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Financeiro');

        const periodLabel = PERIOD_OPTIONS.find(p => p.days === period)?.label || period + 'd';
        const filename = `financeiro_${periodLabel}_${new Date().toLocaleDateString('pt-BR').replace(/\//g,'-')}.xlsx`;
        XLSX.writeFile(wb, filename);
        showToast(`Exportado: ${filtered.length} viagens → ${filename}`, 'success');
    };

    const hasActiveFilters = filterMotorista || filterDestino;

    return (
        <div className="min-h-screen" style={{ backgroundColor: 'var(--color-background)' }}>
            <NavigationBar />
            <main className="main-content">
                <div className="max-w-screen-2xl mx-auto px-4 tab:px-6 lg:px-8 py-6">
                    <BreadcrumbTrail className="mb-4" />

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                        <div>
                            <h1 className="font-heading font-bold text-2xl md:text-3xl flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
                                <Icon name="DollarSign" size={28} color="#059669" /> Financeiro
                            </h1>
                            <p className="text-sm mt-0.5 font-caption" style={{ color: 'var(--color-text-secondary)' }}>
                                Custos, fretes e margem por viagem finalizada
                            </p>
                        </div>
                        <div className="flex gap-2 flex-wrap items-center">
                            {/* Seletor de período */}
                            <div className="flex rounded-lg border overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
                                {PERIOD_OPTIONS.map(p => (
                                    <button key={p.days} onClick={() => setPeriod(p.days)}
                                        className="px-3 py-2 text-xs font-caption font-medium transition-colors"
                                        style={period === p.days
                                            ? { backgroundColor: 'var(--color-primary)', color: '#fff' }
                                            : { backgroundColor: 'white', color: 'var(--color-muted-foreground)' }}>
                                        {p.label}
                                    </button>
                                ))}
                            </div>
                            {/* ✅ MELHORIA: Botão de filtros avançados */}
                            <Button
                                variant={showFilters ? 'default' : 'outline'}
                                iconName="Filter"
                                iconSize={14}
                                onClick={() => setShowFilters(f => !f)}
                            >
                                Filtros{hasActiveFilters ? ' ●' : ''}
                            </Button>
                            <Button variant="outline" iconName="FileDown" iconSize={14} onClick={exportExcel}>
                                Exportar Excel
                            </Button>
                        </div>
                    </div>

                    {/* ✅ MELHORIA: Painel de filtros avançados */}
                    {showFilters && (
                        <div className="bg-white rounded-xl border p-4 mb-5 flex flex-wrap gap-4 items-end shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
                            <div className="flex flex-col gap-1 min-w-[180px]">
                                <label className="text-xs font-caption font-medium" style={{ color: 'var(--color-muted-foreground)' }}>Motorista</label>
                                <input
                                    type="text"
                                    value={filterMotorista}
                                    onChange={e => setFilterMotorista(e.target.value)}
                                    placeholder="Filtrar por motorista..."
                                    className="h-9 px-3 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-400"
                                    style={{ borderColor: 'var(--color-border)' }}
                                />
                            </div>
                            <div className="flex flex-col gap-1 min-w-[180px]">
                                <label className="text-xs font-caption font-medium" style={{ color: 'var(--color-muted-foreground)' }}>Destino</label>
                                <input
                                    type="text"
                                    value={filterDestino}
                                    onChange={e => setFilterDestino(e.target.value)}
                                    placeholder="Filtrar por destino..."
                                    className="h-9 px-3 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-400"
                                    style={{ borderColor: 'var(--color-border)' }}
                                />
                            </div>
                            {hasActiveFilters && (
                                <Button variant="ghost" size="sm" iconName="X" iconSize={13}
                                    onClick={() => { setFilterMotorista(''); setFilterDestino(''); }}>
                                    Limpar filtros
                                </Button>
                            )}
                            <span className="text-xs font-caption self-center" style={{ color: 'var(--color-muted-foreground)' }}>
                                {filtered.length} viagem{filtered.length !== 1 ? 'ns' : ''} encontrada{filtered.length !== 1 ? 's' : ''}
                            </span>
                        </div>
                    )}

                    {loading ? (
                        <div className="flex justify-center py-20">
                            <div className="animate-spin h-8 w-8 rounded-full border-4" style={{ borderColor: '#059669', borderTopColor: 'transparent' }} />
                        </div>
                    ) : (
                        <div className="flex flex-col gap-6">
                            {/* KPIs */}
                            <div className="grid grid-cols-2 tab:grid-cols-4 gap-4">
                                {[
                                    { l: 'Receita',   v: BRL(kpis.frete),  i: 'TrendingUp',   c: '#059669', bg: '#D1FAE5' },
                                    { l: 'Custos',    v: BRL(kpis.custo),  i: 'TrendingDown', c: '#DC2626', bg: '#FEE2E2' },
                                    { l: 'Margem',    v: BRL(kpis.margem), i: 'DollarSign',   c: kpis.margem >= 0 ? '#059669' : '#DC2626', bg: kpis.margem >= 0 ? '#D1FAE5' : '#FEE2E2' },
                                    { l: 'Viagens',   v: kpis.count,       i: 'CheckCircle2', c: '#1D4ED8', bg: '#DBEAFE' },
                                ].map(k => (
                                    <div key={k.l} className="bg-white rounded-xl border p-4 shadow-card" style={{ borderColor: 'var(--color-border)' }}>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs font-caption" style={{ color: 'var(--color-muted-foreground)' }}>{k.l}</span>
                                            <div className="rounded-lg flex items-center justify-center" style={{ width: 32, height: 32, backgroundColor: k.bg }}>
                                                <Icon name={k.i} size={15} color={k.c} />
                                            </div>
                                        </div>
                                        <p className="text-xl font-bold font-data" style={{ color: k.c }}>{k.v}</p>
                                    </div>
                                ))}
                            </div>

                            {/* Extra KPIs */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                {[
                                    { l: 'km Rodados', v: `${kpis.km.toLocaleString('pt-BR')} km`, i: 'Route' },
                                    { l: 'Custo/km',   v: kpis.km > 0 ? BRL(kpis.custo / kpis.km) : '—', i: 'Fuel' },
                                    { l: 'Margem %',   v: kpis.frete > 0 ? `${((kpis.margem / kpis.frete) * 100).toFixed(1)}%` : '—', i: 'Percent' },
                                ].map(k => (
                                    <div key={k.l} className="bg-white rounded-xl border p-3 shadow-card flex items-center gap-3" style={{ borderColor: 'var(--color-border)' }}>
                                        <Icon name={k.i} size={18} color="var(--color-primary)" />
                                        <div>
                                            <p className="text-xs font-caption" style={{ color: 'var(--color-muted-foreground)' }}>{k.l}</p>
                                            <p className="font-bold font-data text-sm" style={{ color: 'var(--color-text-primary)' }}>{k.v}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Charts */}
                            <div className="grid grid-cols-1 tab:grid-cols-3 gap-6">
                                <div className="tab:col-span-2 bg-white rounded-xl border shadow-card p-5" style={{ borderColor: 'var(--color-border)' }}>
                                    <h3 className="font-heading font-semibold text-sm mb-4" style={{ color: 'var(--color-text-primary)' }}>Receita vs Custo por Rota</h3>
                                    {byRota.length === 0 ? (
                                        <div className="flex items-center justify-center h-48 text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Nenhuma viagem finalizada no período com dados financeiros</div>
                                    ) : (
                                        <ResponsiveContainer width="100%" height={230}>
                                            <BarChart data={byRota} margin={{ left: 10, right: 10, top: 5, bottom: 45 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                                                <XAxis dataKey="destino" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" interval={0} />
                                                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                                                <Tooltip formatter={v => BRL(v)} />
                                                <Bar dataKey="frete"  name="Receita" fill="#059669" radius={[3,3,0,0]} />
                                                <Bar dataKey="custo"  name="Custo"   fill="#DC2626" radius={[3,3,0,0]} />
                                                <Bar dataKey="margem" name="Margem"  fill="#1D4ED8" radius={[3,3,0,0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    )}
                                </div>
                                <div className="bg-white rounded-xl border shadow-card p-5" style={{ borderColor: 'var(--color-border)' }}>
                                    <h3 className="font-heading font-semibold text-sm mb-4" style={{ color: 'var(--color-text-primary)' }}>Composição de Custos</h3>
                                    {costsPie.length === 0 ? (
                                        <div className="flex items-center justify-center h-48 text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Sem custos registrados</div>
                                    ) : (
                                        <ResponsiveContainer width="100%" height={230}>
                                            <PieChart>
                                                <Pie data={costsPie.filter(d => d.value > 0 && isFinite(d.value))} dataKey="value" nameKey="name" cx="50%" cy="45%" innerRadius={55} outerRadius={85}>
                                                    {costsPie.filter(d => d.value > 0 && isFinite(d.value)).map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                                                </Pie>
                                                <Tooltip formatter={v => BRL(v)} />
                                                <Legend iconSize={10} iconType="circle" />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    )}
                                </div>
                            </div>

                            {/* Detail Table */}
                            <div className="bg-white rounded-xl border shadow-card overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
                                <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--color-border)' }}>
                                    <h3 className="font-heading font-semibold text-sm" style={{ color: 'var(--color-text-primary)' }}>Detalhamento por Viagem</h3>
                                    <span className="text-xs font-caption" style={{ color: 'var(--color-muted-foreground)' }}>{filtered.length} viagens</span>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="text-xs font-caption border-b" style={{ backgroundColor: 'var(--color-muted)', borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                                            <tr>
                                                <th className="px-4 py-2 text-left font-medium">Romaneio</th>
                                                <th className="px-4 py-2 text-left font-medium">Destino</th>
                                                <th className="px-4 py-2 text-left font-medium hidden sm:table-cell">Motorista</th>
                                                <th className="px-4 py-2 text-right font-medium">Frete</th>
                                                <th className="px-4 py-2 text-right font-medium hidden md:table-cell">Custos</th>
                                                <th className="px-4 py-2 text-right font-medium">Margem</th>
                                                <th className="px-4 py-2 text-right font-medium hidden lg:table-cell">km</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filtered.length === 0 ? (
                                                <tr><td colSpan={7} className="text-center py-10 text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
                                                    Nenhuma viagem encontrada com os filtros selecionados
                                                </td></tr>
                                            ) : filtered.map(r => {
                                                const custo = r.custo_combustivel + r.custo_pedagio + r.custo_motorista;
                                                const margem = r.valor_frete - custo;
                                                return (
                                                    <tr key={r.id} className="border-t hover:bg-gray-50" style={{ borderColor: 'var(--color-border)' }}>
                                                        <td className="px-4 py-2.5 font-data text-xs font-medium" style={{ color: 'var(--color-primary)' }}>{r.numero}</td>
                                                        <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--color-text-secondary)' }}>{r.destino || '—'}</td>
                                                        <td className="px-4 py-2.5 text-xs hidden sm:table-cell" style={{ color: 'var(--color-text-secondary)' }}>{r.motorista || '—'}</td>
                                                        <td className="px-4 py-2.5 text-right text-xs font-data font-medium text-green-600">{BRL(r.valor_frete)}</td>
                                                        <td className="px-4 py-2.5 text-right text-xs font-data text-red-500 hidden md:table-cell">{BRL(custo)}</td>
                                                        <td className="px-4 py-2.5 text-right text-xs font-data font-semibold" style={{ color: margem >= 0 ? '#059669' : '#DC2626' }}>
                                                            {margem >= 0 ? '+' : ''}{BRL(margem)}
                                                        </td>
                                                        <td className="px-4 py-2.5 text-right text-xs font-data hidden lg:table-cell" style={{ color: 'var(--color-muted-foreground)' }}>
                                                            {r.distancia_km ? `${r.distancia_km} km` : '—'}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </main>
            <Toast toast={toast} />
        </div>
    );
}
