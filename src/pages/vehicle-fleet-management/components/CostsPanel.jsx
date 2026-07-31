import React, { useState, useEffect, useCallback, useMemo } from "react";
import Icon from "components/AppIcon";
import Toast from "components/ui/Toast";
import { useToast } from "utils/useToast";
import { fetchAbastecimentos, fetchDiarias, fetchMotoristasCaminhao } from "utils/carretasService";
import { fetchCaminhoesPlacas } from "utils/vehicleService";
import { supabase, subscribeTabela } from "utils/supabaseClient";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell,
} from "recharts";
import * as XLSX from "xlsx";

const BRL = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const FMT = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—';
const inputStyle = { borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' };
const COLORS = ['#1D4ED8', '#7C3AED', '#059669', '#D97706', '#DC2626', '#0891B2', '#DB2777', '#65A30D'];

function KpiCard({ label, value, icon, color, bg, sub }) {
    return (
        <div className="rounded-xl p-4 md:p-5 shadow-card border border-border" style={{ backgroundColor: "var(--color-card)" }}>
            <div className="flex items-center justify-between mb-3">
                <span className="text-xs md:text-sm font-caption font-medium" style={{ color: "var(--color-muted-foreground)" }}>{label}</span>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: bg }}>
                    <Icon name={icon} size={16} color={color} strokeWidth={2} />
                </div>
            </div>
            <div className="text-xl md:text-2xl font-heading font-bold mb-1" style={{ color: "var(--color-text-primary)" }}>{value}</div>
            {sub && <p className="text-xs" style={{ color: "var(--color-muted-foreground)" }}>{sub}</p>}
        </div>
    );
}

function ChartCard({ title, height = 240, children, right }) {
    return (
        <div className="rounded-xl p-4 md:p-5 shadow-card border border-border" style={{ backgroundColor: "var(--color-card)" }}>
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{title}</h3>
                {right}
            </div>
            <div style={{ height }}>{children}</div>
        </div>
    );
}

export default function CostsPanel() {
    const { toast, showToast } = useToast();
    const [loading, setLoading] = useState(true);
    const [mes, setMes] = useState(() => new Date().toISOString().slice(0, 7));
    const [periodoCustom, setPeriodoCustom] = useState({ inicio: '', fim: '' });
    const [usarPeriodo, setUsarPeriodo] = useState(false);
    const [busca, setBusca] = useState('');

    const [abast, setAbast] = useState([]);
    const [diariasAvulsas, setDiariasAvulsas] = useState([]);
    const [romaneiosDiarias, setRomaneiosDiarias] = useState([]);
    const [motoristas, setMotoristas] = useState([]);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [ano, m] = mes.split('-').map(Number);
            const dataInicio = (usarPeriodo && periodoCustom.inicio) ? periodoCustom.inicio : mes + '-01';
            const dataFim = (usarPeriodo && periodoCustom.fim) ? periodoCustom.fim
                : mes + '-' + String(new Date(ano, m, 0).getDate()).padStart(2, '0');

            const motoristasCaminhao = await fetchMotoristasCaminhao();
            const ids = motoristasCaminhao.map(mo => mo.id);

            const [a, d, romRes] = await Promise.all([
                fetchAbastecimentos({ apenasCaminhoes: true, dataInicio, dataFim }),
                ids.length ? fetchDiarias({ motoristasIds: ids, dataInicio, dataFim }) : Promise.resolve([]),
                supabase
                    .from('romaneios')
                    .select('id, numero, motorista, motorista_id, placa, destino, custo_motorista, dias_diaria, valor_diaria_dia, diaria_descricao, created_at, saida')
                    .gt('custo_motorista', 0)
                    .gte('created_at', dataInicio)
                    .lte('created_at', dataFim + 'T23:59:59'),
            ]);

            setAbast(a);
            setDiariasAvulsas(d);
            setMotoristas(motoristasCaminhao);
            setRomaneiosDiarias(romRes.data || []);
        } catch (e) { showToast('Erro ao carregar painel de custos: ' + e.message, 'error'); }
        finally { setLoading(false); }
    }, [mes, usarPeriodo, periodoCustom]); // eslint-disable-line

    useEffect(() => {
        load();
        // Realtime: reflete lançamentos feitos pelos motoristas na hora
        const unsubA = subscribeTabela('carretas_abastecimentos', load);
        const unsubD = subscribeTabela('carretas_diarias', load);
        const unsubR = subscribeTabela('romaneios', load);
        return () => { unsubA(); unsubD(); unsubR(); };
    }, [load]);

    // ── Totais gerais ───────────────────────────────────────────────────────
    const totAbast = useMemo(() => ({
        litrosDiesel: abast.reduce((s, a) => s + Number(a.litros_diesel || 0), 0),
        valorDiesel:  abast.reduce((s, a) => s + Number(a.valor_diesel || 0), 0),
        litrosArla:   abast.reduce((s, a) => s + Number(a.litros_arla || 0), 0),
        valorArla:    abast.reduce((s, a) => s + Number(a.valor_arla || 0), 0),
        total:        abast.reduce((s, a) => s + Number(a.valor_total || 0), 0),
    }), [abast]);

    const totalDiariasAvulsas   = useMemo(() => diariasAvulsas.reduce((s, d) => s + Number(d.valor_total || 0), 0), [diariasAvulsas]);
    const totalDiariasRomaneios = useMemo(() => romaneiosDiarias.reduce((s, r) => s + Number(r.custo_motorista || 0), 0), [romaneiosDiarias]);
    const totalDiarias = totalDiariasAvulsas + totalDiariasRomaneios;
    const totalGeral   = totAbast.total + totalDiarias;

    // ── Gastos por veículo (abastecimento) ──────────────────────────────────
    const porVeiculo = useMemo(() => {
        const map = new Map();
        abast.forEach(a => {
            const placa = a.veiculo_caminhao_placa || a.veiculo?.placa || 'Sem placa';
            const cur = map.get(placa) || {
                placa, motoristasSet: new Set(),
                litrosDiesel: 0, valorDiesel: 0, litrosArla: 0, valorArla: 0, total: 0, qtd: 0,
            };
            const nomeMotorista = a.motorista?.name;
            if (nomeMotorista) cur.motoristasSet.add(nomeMotorista);
            cur.litrosDiesel += Number(a.litros_diesel || 0);
            cur.valorDiesel  += Number(a.valor_diesel || 0);
            cur.litrosArla   += Number(a.litros_arla || 0);
            cur.valorArla    += Number(a.valor_arla || 0);
            cur.total        += Number(a.valor_total || 0);
            cur.qtd += 1;
            map.set(placa, cur);
        });
        return Array.from(map.values())
            .map(v => ({ ...v, motorista: Array.from(v.motoristasSet).join(', ') }))
            .sort((x, y) => y.total - x.total);
    }, [abast]);

    // ── Diárias por motorista (avulsas + romaneios) ─────────────────────────
    const porMotorista = useMemo(() => {
        const map = new Map();
        const ensure = (id, nome) => {
            const key = id || nome || '—';
            if (!map.has(key)) map.set(key, { nome: nome || 'Sem nome', avulsas: 0, avulsasQtd: 0, romaneios: 0, romaneiosQtd: 0 });
            return map.get(key);
        };
        diariasAvulsas.forEach(d => {
            const e = ensure(d.motorista_id, d.motorista?.name);
            e.avulsas += Number(d.valor_total || 0); e.avulsasQtd += 1;
        });
        romaneiosDiarias.forEach(r => {
            const nome = r.motorista || motoristas.find(m => m.id === r.motorista_id)?.name;
            const e = ensure(r.motorista_id, nome);
            e.romaneios += Number(r.custo_motorista || 0); e.romaneiosQtd += 1;
        });
        return Array.from(map.values())
            .map(e => ({ ...e, total: e.avulsas + e.romaneios, qtd: e.avulsasQtd + e.romaneiosQtd }))
            .sort((a, b) => b.total - a.total);
    }, [diariasAvulsas, romaneiosDiarias, motoristas]);

    const porVeiculoFiltrado = useMemo(() =>
        porVeiculo.filter(v => !busca || v.placa.toLowerCase().includes(busca.toLowerCase())),
    [porVeiculo, busca]);
    const porMotoristaFiltrado = useMemo(() =>
        porMotorista.filter(m => !busca || m.nome.toLowerCase().includes(busca.toLowerCase())),
    [porMotorista, busca]);

    const chartVeiculos = useMemo(() => porVeiculo.slice(0, 8).map(v => ({ name: v.placa, total: Number(v.total.toFixed(2)) })), [porVeiculo]);
    const chartComposicao = useMemo(() => ([
        { name: 'Combustível', value: Number(totAbast.total.toFixed(2)) },
        { name: 'Diárias',     value: Number(totalDiarias.toFixed(2)) },
    ].filter(d => d.value > 0)), [totAbast.total, totalDiarias]);

    const exportar = () => {
        const wb = XLSX.utils.book_new();
        if (porVeiculo.length) {
            const ws = XLSX.utils.json_to_sheet(porVeiculo.map(v => ({
                'Placa': v.placa, 'Motorista': v.motorista, 'Abastecimentos': v.qtd,
                'Diesel (L)': Number(v.litrosDiesel.toFixed(1)), 'R$ Diesel': Number(v.valorDiesel.toFixed(2)),
                'Arla (L)': Number(v.litrosArla.toFixed(1)), 'R$ Arla': Number(v.valorArla.toFixed(2)),
                'Total': Number(v.total.toFixed(2)),
            })));
            ws['!cols'] = [12, 20, 14, 12, 12, 10, 10, 12].map(w => ({ wch: w }));
            XLSX.utils.book_append_sheet(wb, ws, 'Combustível por Veículo');
        }
        if (porMotorista.length) {
            const ws = XLSX.utils.json_to_sheet(porMotorista.map(m => ({
                'Motorista': m.nome, 'Diárias Avulsas': m.avulsasQtd, 'R$ Avulsas': Number(m.avulsas.toFixed(2)),
                'Diárias em Romaneio': m.romaneiosQtd, 'R$ Romaneios': Number(m.romaneios.toFixed(2)),
                'Total': Number(m.total.toFixed(2)),
            })));
            ws['!cols'] = [24, 14, 12, 16, 14, 12].map(w => ({ wch: w }));
            XLSX.utils.book_append_sheet(wb, ws, 'Diárias por Motorista');
        }
        if (!wb.SheetNames.length) { showToast('Nenhum dado no período.', 'error'); return; }
        XLSX.writeFile(wb, `painel_custos_caminhoes_${mes}.xlsx`);
        showToast('Exportado!', 'success');
    };

    if (loading && !abast.length && !diariasAvulsas.length && !romaneiosDiarias.length) {
        return (
            <div className="flex justify-center py-16">
                <div className="animate-spin h-8 w-8 rounded-full border-4" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
            </div>
        );
    }

    return (
        <div>
            {/* Filtros de período */}
            <div className="flex flex-wrap items-center gap-2 mb-5">
                <input type="month" value={mes} onChange={e => { setMes(e.target.value); setUsarPeriodo(false); }}
                    className="px-3 py-1.5 rounded-lg border text-sm" style={inputStyle} />
                <button type="button" onClick={() => setUsarPeriodo(v => !v)}
                    className="px-2 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap"
                    style={usarPeriodo
                        ? { backgroundColor: '#EFF6FF', color: '#1D4ED8', borderColor: '#BFDBFE' }
                        : { borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                    {usarPeriodo ? '✓ Período' : 'Período'}
                </button>
                {usarPeriodo && (
                    <>
                        <input type="date" value={periodoCustom.inicio} onChange={e => setPeriodoCustom(p => ({ ...p, inicio: e.target.value }))}
                            className="px-2 py-1.5 rounded-lg border text-sm" style={inputStyle} title="Data inicial" />
                        <input type="date" value={periodoCustom.fim} onChange={e => setPeriodoCustom(p => ({ ...p, fim: e.target.value }))}
                            className="px-2 py-1.5 rounded-lg border text-sm" style={inputStyle} title="Data final" />
                    </>
                )}
                <button onClick={load} className="p-2 rounded-lg border hover:bg-gray-50" style={{ borderColor: 'var(--color-border)' }} title="Atualizar">
                    <Icon name="RefreshCw" size={14} color="var(--color-muted-foreground)" />
                </button>
                <div className="flex-1 min-w-[160px] relative">
                    <Icon name="Search" size={15} color="var(--color-muted-foreground)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                    <input value={busca} onChange={e => setBusca(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 rounded-lg border text-sm outline-none" style={inputStyle}
                        placeholder="Filtrar por placa ou motorista..." />
                </div>
                <button onClick={exportar} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium hover:bg-gray-50" style={{ borderColor: 'var(--color-border)' }}>
                    <Icon name="FileDown" size={13} /> Exportar
                </button>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 tab:grid-cols-4 gap-3 tab:gap-4 mb-6">
                <KpiCard label="Combustível (Total)" value={BRL(totAbast.total)} icon="Fuel" color="#059669" bg="#ECFDF5"
                    sub={`${totAbast.litrosDiesel.toFixed(0)} L diesel · ${totAbast.litrosArla.toFixed(0)} L arla`} />
                <KpiCard label="Diárias (Total)" value={BRL(totalDiarias)} icon="CalendarDays" color="#7C3AED" bg="#F5F3FF"
                    sub={`${diariasAvulsas.length} avulsa(s) · ${romaneiosDiarias.length} em romaneio`} />
                <KpiCard label="Motoristas com Diária" value={porMotorista.length} icon="Users" color="#1D4ED8" bg="#EFF6FF"
                    sub="veja o detalhamento por motorista abaixo" />
                <KpiCard label="Total Geral" value={BRL(totalGeral)} icon="Wallet" color="#D97706" bg="#FFFBEB"
                    sub="combustível + diárias no período" />
            </div>

            {/* Gráficos */}
            <div className="grid grid-cols-1 tab:grid-cols-2 gap-5 mb-6">
                <ChartCard title="Combustível por Veículo (top 8)">
                    {chartVeiculos.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Sem abastecimentos no período</div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartVeiculos}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `R$${v}`} />
                                <Tooltip formatter={v => BRL(v)} />
                                <Bar dataKey="total" name="Gasto" fill="#059669" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </ChartCard>
                <ChartCard title="Composição do Gasto Total">
                    {chartComposicao.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Sem lançamentos no período</div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={chartComposicao} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}
                                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                                    {chartComposicao.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                </Pie>
                                <Tooltip formatter={v => BRL(v)} />
                            </PieChart>
                        </ResponsiveContainer>
                    )}
                </ChartCard>
            </div>

            {/* Tabela: gastos por veículo */}
            <div className="rounded-xl border overflow-hidden mb-6" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-card)' }}>
                <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: 'var(--color-border)' }}>
                    <Icon name="Fuel" size={16} color="#059669" />
                    <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Combustível por Veículo</h3>
                </div>
                {porVeiculoFiltrado.length === 0 ? (
                    <p className="text-sm text-center py-8" style={{ color: 'var(--color-muted-foreground)' }}>Nenhum abastecimento de caminhão no período.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr style={{ backgroundColor: '#F8FAFC' }}>
                                    {['Placa', 'Motorista', 'Abastec.', 'Diesel (L)', 'R$ Diesel', 'Arla (L)', 'R$ Arla', 'Total'].map((h, i) => (
                                        <th key={h} className={`px-4 py-2.5 text-xs font-semibold ${i === 0 ? 'text-left' : 'text-right'}`} style={{ color: 'var(--color-muted-foreground)' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {porVeiculoFiltrado.map(v => (
                                    <tr key={v.placa} className="border-t" style={{ borderColor: 'var(--color-border)' }}>
                                        <td className="px-4 py-2.5 font-medium" style={{ color: 'var(--color-text-primary)' }}>{v.placa}</td>
                                        <td className="px-4 py-2.5 text-right" style={{ color: 'var(--color-muted-foreground)' }}>{v.motorista || '—'}</td>
                                        <td className="px-4 py-2.5 text-right" style={{ color: 'var(--color-muted-foreground)' }}>{v.qtd}</td>
                                        <td className="px-4 py-2.5 text-right" style={{ color: 'var(--color-muted-foreground)' }}>{v.litrosDiesel.toFixed(0)}</td>
                                        <td className="px-4 py-2.5 text-right" style={{ color: 'var(--color-muted-foreground)' }}>{BRL(v.valorDiesel)}</td>
                                        <td className="px-4 py-2.5 text-right" style={{ color: 'var(--color-muted-foreground)' }}>{v.litrosArla.toFixed(0)}</td>
                                        <td className="px-4 py-2.5 text-right" style={{ color: 'var(--color-muted-foreground)' }}>{BRL(v.valorArla)}</td>
                                        <td className="px-4 py-2.5 text-right font-semibold" style={{ color: '#059669' }}>{BRL(v.total)}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="border-t-2" style={{ borderColor: 'var(--color-border)', backgroundColor: '#F8FAFC' }}>
                                    <td className="px-4 py-2.5 font-bold" style={{ color: 'var(--color-text-primary)' }} colSpan={2}>Total</td>
                                    <td className="px-4 py-2.5 text-right font-bold" style={{ color: 'var(--color-text-primary)' }}>{abast.length}</td>
                                    <td className="px-4 py-2.5 text-right font-bold" style={{ color: 'var(--color-text-primary)' }}>{totAbast.litrosDiesel.toFixed(0)}</td>
                                    <td className="px-4 py-2.5 text-right font-bold" style={{ color: 'var(--color-text-primary)' }}>{BRL(totAbast.valorDiesel)}</td>
                                    <td className="px-4 py-2.5 text-right font-bold" style={{ color: 'var(--color-text-primary)' }}>{totAbast.litrosArla.toFixed(0)}</td>
                                    <td className="px-4 py-2.5 text-right font-bold" style={{ color: 'var(--color-text-primary)' }}>{BRL(totAbast.valorArla)}</td>
                                    <td className="px-4 py-2.5 text-right font-bold" style={{ color: '#059669' }}>{BRL(totAbast.total)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                )}
            </div>

            {/* Tabela: diárias por motorista */}
            <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-card)' }}>
                <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: 'var(--color-border)' }}>
                    <Icon name="CalendarDays" size={16} color="#7C3AED" />
                    <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Diárias por Motorista</h3>
                </div>
                {porMotoristaFiltrado.length === 0 ? (
                    <p className="text-sm text-center py-8" style={{ color: 'var(--color-muted-foreground)' }}>Nenhuma diária lançada no período.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr style={{ backgroundColor: '#F8FAFC' }}>
                                    {['Motorista', 'Diárias Avulsas', 'R$ Avulsas', 'Diárias em Romaneio', 'R$ Romaneios', 'Total'].map((h, i) => (
                                        <th key={h} className={`px-4 py-2.5 text-xs font-semibold ${i === 0 ? 'text-left' : 'text-right'}`} style={{ color: 'var(--color-muted-foreground)' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {porMotoristaFiltrado.map(m => (
                                    <tr key={m.nome} className="border-t" style={{ borderColor: 'var(--color-border)' }}>
                                        <td className="px-4 py-2.5 font-medium" style={{ color: 'var(--color-text-primary)' }}>{m.nome}</td>
                                        <td className="px-4 py-2.5 text-right" style={{ color: 'var(--color-muted-foreground)' }}>{m.avulsasQtd}</td>
                                        <td className="px-4 py-2.5 text-right" style={{ color: 'var(--color-muted-foreground)' }}>{BRL(m.avulsas)}</td>
                                        <td className="px-4 py-2.5 text-right" style={{ color: 'var(--color-muted-foreground)' }}>{m.romaneiosQtd}</td>
                                        <td className="px-4 py-2.5 text-right" style={{ color: 'var(--color-muted-foreground)' }}>{BRL(m.romaneios)}</td>
                                        <td className="px-4 py-2.5 text-right font-semibold" style={{ color: '#7C3AED' }}>{BRL(m.total)}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="border-t-2" style={{ borderColor: 'var(--color-border)', backgroundColor: '#F8FAFC' }}>
                                    <td className="px-4 py-2.5 font-bold" style={{ color: 'var(--color-text-primary)' }}>Total</td>
                                    <td className="px-4 py-2.5 text-right font-bold" style={{ color: 'var(--color-text-primary)' }}>{diariasAvulsas.length}</td>
                                    <td className="px-4 py-2.5 text-right font-bold" style={{ color: 'var(--color-text-primary)' }}>{BRL(totalDiariasAvulsas)}</td>
                                    <td className="px-4 py-2.5 text-right font-bold" style={{ color: 'var(--color-text-primary)' }}>{romaneiosDiarias.length}</td>
                                    <td className="px-4 py-2.5 text-right font-bold" style={{ color: 'var(--color-text-primary)' }}>{BRL(totalDiariasRomaneios)}</td>
                                    <td className="px-4 py-2.5 text-right font-bold" style={{ color: '#7C3AED' }}>{BRL(totalDiarias)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                )}
            </div>

            {/* Faixa de total geral */}
            <div className="mt-6 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                style={{ background: 'linear-gradient(135deg, #1D4ED8, #7C3AED)' }}>
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
                        <Icon name="Wallet" size={20} color="white" />
                    </div>
                    <div>
                        <p className="text-xs text-white/80">Total geral do período ({FMT(usarPeriodo && periodoCustom.inicio ? periodoCustom.inicio : mes + '-01')} a {FMT(usarPeriodo && periodoCustom.fim ? periodoCustom.fim : (() => { const [ano, m] = mes.split('-').map(Number); return mes + '-' + String(new Date(ano, m, 0).getDate()).padStart(2, '0'); })())})</p>
                        <p className="text-2xl font-heading font-bold text-white">{BRL(totalGeral)}</p>
                    </div>
                </div>
                <div className="flex gap-6 text-white">
                    <div>
                        <p className="text-xs text-white/80">Combustível</p>
                        <p className="text-base font-semibold">{BRL(totAbast.total)}</p>
                    </div>
                    <div>
                        <p className="text-xs text-white/80">Diárias</p>
                        <p className="text-base font-semibold">{BRL(totalDiarias)}</p>
                    </div>
                </div>
            </div>

            <Toast toast={toast} />
        </div>
    );
}
