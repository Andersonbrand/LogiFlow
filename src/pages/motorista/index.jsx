import React, { useState, useEffect, useMemo } from 'react';
import NavigationBar from 'components/ui/NavigationBar';
import BreadcrumbTrail from 'components/ui/BreadcrumbTrail';
import Icon from 'components/AppIcon';
import Toast from 'components/ui/Toast';
import { useToast } from 'utils/useToast';
import { useAuth } from 'utils/AuthContext';
import { supabase } from 'utils/supabaseClient';
import { calcularBonificacao } from 'utils/bonificacaoService';
import * as XLSX from 'xlsx';

const BRL = v => Number(v||0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const PERIOD_OPTIONS = [
    { label: '30 dias', days: 30 },
    { label: '90 dias', days: 90 },
    { label: '6 meses', days: 180 },
];
const STATUS_CFG = {
    'Aguardando':  { bg: '#FEF9C3', text: '#B45309' },
    'Carregando':  { bg: '#DBEAFE', text: '#1D4ED8' },
    'Em Trânsito': { bg: '#D1FAE5', text: '#065F46' },
    'Finalizado':  { bg: '#F3F4F6', text: '#374151' },
    'Cancelado':   { bg: '#FEE2E2', text: '#991B1B' },
};

export default function MotoristaDashboard() {
    const { user, profile } = useAuth();
    const { toast, showToast } = useToast();
    const [romaneios, setRomaneios] = useState([]);
    const [loading, setLoading] = useState(false);
    const [period, setPeriod] = useState(30);
    const [tab, setTab] = useState('viagens');

    useEffect(() => {
        if (!user?.id || !profile?.name) return;

        let cancelled = false;
        (async () => {
            try {
                setLoading(true);
                // Busca por motorista_id OU por nome (legado) — escapa o nome com aspas para suportar espaços
                const { data, error } = await supabase
                    .from('romaneios')
                    .select(`
                        id, numero, motorista, motorista_id, placa, destino, status,
                        aprovado, aprovado_em, peso_total, saida, created_at,
                        romaneio_itens(id, quantidade, peso_total, material_id,
                            materials(id, nome, unidade, peso, categoria_frete))
                    `)
                    .or(`motorista_id.eq.${user.id},motorista.ilike."${profile.name}"`)
                    .order('created_at', { ascending: false });

                if (error) throw error;
                if (!cancelled) setRomaneios(data || []);
            } catch (err) {
                if (!cancelled) showToast('Erro ao carregar dados: ' + err.message, 'error');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => { cancelled = true; };
    }, [user?.id, profile?.name]);

    const filtered = useMemo(() => {
        const cut = new Date();
        cut.setDate(cut.getDate() - period);
        return romaneios.filter(r => !r.saida || new Date(r.saida) >= cut);
    }, [romaneios, period]);

    const bonificacoes = useMemo(() =>
        filtered.map(r => ({ ...r, bonif: calcularBonificacao(r) }))
    , [filtered]);

    const totais = useMemo(() => ({
        viagens: filtered.length,
        finalizadas: filtered.filter(r => r.status === 'Finalizado').length,
        emTransito: filtered.filter(r => r.status === 'Em Trânsito').length,
        totalBonus: bonificacoes.reduce((s, r) => s + (r.bonif?.valorTotal || 0), 0),
        totalToneladas: bonificacoes.reduce((s, r) => s + (r.bonif?.toneladasFerragem || 0), 0),
    }), [filtered, bonificacoes]);

    const exportarExcel = () => {
        try {
            const rows = bonificacoes.map(r => ({
                'Romaneio': r.numero || '',
                'Destino': r.destino || '',
                'Status': r.status || '',
                'Data': r.saida ? new Date(r.saida).toLocaleDateString('pt-BR') : '',
                'Aprovado': r.aprovado ? 'Sim' : 'Não',
                'Ton. Ferragem': r.bonif?.toneladasFerragem || 0,
                'Bônus Ferragem': r.bonif?.valorFerragem || 0,
                'Cimento (fixo)': r.bonif?.valorCimento || 0,
                'Total Bônus (R$)': r.bonif?.valorTotal || 0,
            }));
            const ws = XLSX.utils.json_to_sheet(rows);
            ws['!cols'] = [12,20,12,12,10,14,14,14,14].map(w => ({ wch: w }));
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Bonificações');
            XLSX.writeFile(wb, `bonificacoes_${profile?.name || 'motorista'}_${new Date().toLocaleDateString('pt-BR').replace(/\//g,'-')}.xlsx`);
            showToast('Exportado com sucesso!', 'success');
        } catch (err) {
            showToast('Erro ao exportar: ' + err.message, 'error');
        }
    };

    return (
        <div className="min-h-screen" style={{ backgroundColor: 'var(--color-background)' }}>
            <NavigationBar />
            <main className="main-content">
                <div className="max-w-screen-xl mx-auto px-4 md:px-6 lg:px-8 py-6">
                    <BreadcrumbTrail className="mb-4" />

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                        <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-lg"
                                style={{ backgroundColor: 'var(--color-primary)' }}>
                                {(profile?.name || 'M')[0].toUpperCase()}
                            </div>
                            <div>
                                <h1 className="font-heading font-bold text-2xl" style={{ color: 'var(--color-text-primary)' }}>
                                    Olá, {profile?.name || 'Motorista'}
                                </h1>
                                <p className="text-sm font-caption" style={{ color: 'var(--color-muted-foreground)' }}>
                                    Suas viagens e bonificações
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-2 items-center flex-wrap">
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
                            <button onClick={exportarExcel}
                                className="flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-colors hover:bg-gray-50"
                                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}>
                                <Icon name="FileDown" size={14} color="currentColor" />
                                Exportar Excel
                            </button>
                        </div>
                    </div>

                    {/* KPIs */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                        {[
                            { l: 'Total de Viagens', v: totais.viagens, i: 'Truck', c: '#1D4ED8', bg: '#DBEAFE' },
                            { l: 'Finalizadas', v: totais.finalizadas, i: 'CheckCircle2', c: '#059669', bg: '#D1FAE5' },
                            { l: 'Em Trânsito', v: totais.emTransito, i: 'Navigation', c: '#D97706', bg: '#FEF9C3' },
                            { l: 'Bônus no Período', v: BRL(totais.totalBonus), i: 'DollarSign', c: '#7C3AED', bg: '#EDE9FE' },
                        ].map(k => (
                            <div key={k.l} className="bg-white rounded-xl border p-4 shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
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

                    {/* Tabs */}
                    <div className="flex border-b mb-5" style={{ borderColor: 'var(--color-border)' }}>
                        {[['viagens','Minhas Viagens','Truck'], ['bonificacoes','Bonificações','DollarSign']].map(([key, label, icon]) => (
                            <button key={key} onClick={() => setTab(key)}
                                className={`flex items-center gap-1.5 px-5 py-3 text-sm font-medium font-caption border-b-2 transition-colors ${tab === key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                                <Icon name={icon} size={15} color="currentColor" />
                                {label}
                            </button>
                        ))}
                    </div>

                    {loading ? (
                        <div className="flex justify-center py-20">
                            <div className="animate-spin h-8 w-8 rounded-full border-4" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
                        </div>
                    ) : tab === 'viagens' ? (
                        <div className="bg-white rounded-xl border shadow-sm overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
                            <table className="w-full text-sm">
                                <thead className="text-xs font-caption border-b" style={{ backgroundColor: 'var(--color-muted)', borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                                    <tr>
                                        <th className="px-4 py-3 text-left font-medium">Romaneio</th>
                                        <th className="px-4 py-3 text-left font-medium">Destino</th>
                                        <th className="px-4 py-3 text-left font-medium">Status</th>
                                        <th className="px-4 py-3 text-left font-medium">Aprovado</th>
                                        <th className="px-4 py-3 text-left font-medium hidden md:table-cell">Data</th>
                                        <th className="px-4 py-3 text-right font-medium">Peso (kg)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.length === 0 ? (
                                        <tr><td colSpan={6} className="text-center py-10 text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
                                            Nenhuma viagem no período selecionado
                                        </td></tr>
                                    ) : filtered.map((r, idx) => {
                                        const sc = STATUS_CFG[r.status] || STATUS_CFG['Finalizado'];
                                        return (
                                            <tr key={r.id} className="border-t hover:bg-gray-50" style={{ borderColor: 'var(--color-border)', backgroundColor: idx % 2 === 0 ? '#fff' : '#F8FAFC' }}>
                                                <td className="px-4 py-3 font-data font-medium text-blue-700">{r.numero}</td>
                                                <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-text-secondary)' }}>{r.destino || '—'}</td>
                                                <td className="px-4 py-3">
                                                    <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: sc.bg, color: sc.text }}>{r.status}</span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    {r.aprovado
                                                        ? <span className="flex items-center gap-1 text-xs text-green-600 font-medium"><Icon name="CheckCircle2" size={13} color="#059669" />Aprovado</span>
                                                        : <span className="flex items-center gap-1 text-xs text-amber-600"><Icon name="Clock" size={13} color="#D97706" />Pendente</span>
                                                    }
                                                </td>
                                                <td className="px-4 py-3 text-xs hidden md:table-cell" style={{ color: 'var(--color-muted-foreground)' }}>
                                                    {r.saida ? new Date(r.saida).toLocaleDateString('pt-BR') : '—'}
                                                </td>
                                                <td className="px-4 py-3 text-right font-data text-xs">{Number(r.peso_total||0).toLocaleString('pt-BR')} kg</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-4">
                            <div className="bg-white rounded-xl border p-5 shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
                                <h3 className="font-heading font-semibold text-sm mb-4" style={{ color: 'var(--color-text-primary)' }}>Resumo do Período</h3>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                    <div>
                                        <p className="text-xs font-caption" style={{ color: 'var(--color-muted-foreground)' }}>Total Bônus</p>
                                        <p className="text-2xl font-bold font-data text-purple-600">{BRL(totais.totalBonus)}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs font-caption" style={{ color: 'var(--color-muted-foreground)' }}>Ton. Ferragem</p>
                                        <p className="text-2xl font-bold font-data" style={{ color: 'var(--color-text-primary)' }}>{totais.totalToneladas.toFixed(2)} t</p>
                                    </div>
                                    <div>
                                        <p className="text-xs font-caption" style={{ color: 'var(--color-muted-foreground)' }}>Romaneios</p>
                                        <p className="text-2xl font-bold font-data" style={{ color: 'var(--color-text-primary)' }}>{totais.viagens}</p>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-white rounded-xl border shadow-sm overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
                                <div className="px-5 py-3 border-b" style={{ borderColor: 'var(--color-border)' }}>
                                    <h3 className="font-heading font-semibold text-sm" style={{ color: 'var(--color-text-primary)' }}>Detalhamento por Romaneio</h3>
                                </div>
                                <table className="w-full text-sm">
                                    <thead className="text-xs font-caption border-b" style={{ backgroundColor: 'var(--color-muted)', borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                                        <tr>
                                            <th className="px-4 py-2 text-left font-medium">Romaneio</th>
                                            <th className="px-4 py-2 text-left font-medium hidden sm:table-cell">Destino</th>
                                            <th className="px-4 py-2 text-right font-medium">Ton. Ferragem</th>
                                            <th className="px-4 py-2 text-right font-medium">Bônus Ferragem</th>
                                            <th className="px-4 py-2 text-right font-medium">Cimento</th>
                                            <th className="px-4 py-2 text-right font-medium">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {bonificacoes.length === 0 ? (
                                            <tr><td colSpan={6} className="text-center py-10 text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
                                                Nenhuma bonificação no período
                                            </td></tr>
                                        ) : bonificacoes.map((r, idx) => (
                                            <tr key={r.id} className="border-t hover:bg-gray-50" style={{ borderColor: 'var(--color-border)', backgroundColor: idx % 2 === 0 ? '#fff' : '#F8FAFC' }}>
                                                <td className="px-4 py-2.5 font-data text-xs font-medium text-blue-700">{r.numero}</td>
                                                <td className="px-4 py-2.5 text-xs hidden sm:table-cell" style={{ color: 'var(--color-text-secondary)' }}>{r.destino || '—'}</td>
                                                <td className="px-4 py-2.5 text-right text-xs font-data">{(r.bonif?.toneladasFerragem || 0).toFixed(3)} t</td>
                                                <td className="px-4 py-2.5 text-right text-xs font-data text-green-600">{BRL(r.bonif?.valorFerragem)}</td>
                                                <td className="px-4 py-2.5 text-right text-xs font-data">
                                                    {r.bonif?.temCimento ? <span className="text-blue-600">{BRL(r.bonif.valorCimento)}</span> : <span className="text-gray-300">—</span>}
                                                </td>
                                                <td className="px-4 py-2.5 text-right text-xs font-data font-semibold text-purple-600">{BRL(r.bonif?.valorTotal)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </main>
            <Toast toast={toast} />
        </div>
    );
}
