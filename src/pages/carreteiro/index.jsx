import React, { useState, useEffect, useMemo, useCallback } from 'react';
import NavigationBar from 'components/ui/NavigationBar';
import BreadcrumbTrail from 'components/ui/BreadcrumbTrail';
import Button from 'components/ui/Button';
import Icon from 'components/AppIcon';
import Toast from 'components/ui/Toast';
import { useToast } from 'utils/useToast';
import { useAuth } from 'utils/AuthContext';
import {
    fetchViagens, fetchCarretasVeiculos,
    fetchAbastecimentos, createAbastecimento,
    fetchChecklists, createChecklist,
    fetchCarregamentos,
    calcularBonusCarreteiro, BONUS_BAIXO, BONUS_ALTO, CIDADES_BONUS_BAIXO,
    CHECKLIST_ITENS,
} from 'utils/carretasService';
import * as XLSX from 'xlsx';

const BRL = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const FMT_DATE = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—';

const STATUS_COLORS = {
    'Agendado':            { bg: '#EFF6FF', text: '#1D4ED8' },
    'Em processamento':    { bg: '#FEF9C3', text: '#B45309' },
    'Aguardando no pátio': { bg: '#FEE2E2', text: '#B91C1C' },
    'Em trânsito':         { bg: '#D1FAE5', text: '#065F46' },
    'Entrega finalizada':  { bg: '#F0FDF4', text: '#15803D' },
    'Cancelado':           { bg: '#F3F4F6', text: '#6B7280' },
};

const inputCls = "w-full px-3 py-2 rounded-lg border text-sm outline-none transition-all focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500";
const inputStyle = { borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' };

function Field({ label, children, required }) {
    return (
        <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                {label}{required && <span className="text-red-500 ml-0.5">*</span>}
            </label>
            {children}
        </div>
    );
}

function ModalOverlay({ children, onClose }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
            onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
                {children}
            </div>
        </div>
    );
}

function ModalHeader({ title, icon, onClose }) {
    return (
        <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: 'var(--color-border)' }}>
            <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#EFF6FF' }}>
                    <Icon name={icon} size={18} color="#1D4ED8" />
                </div>
                <h2 className="font-heading font-bold text-lg" style={{ color: 'var(--color-text-primary)' }}>{title}</h2>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                <Icon name="X" size={18} color="var(--color-muted-foreground)" />
            </button>
        </div>
    );
}

const PERIOD_OPTIONS = [
    { label: '30 dias', days: 30 },
    { label: '90 dias', days: 90 },
    { label: '6 meses', days: 180 },
];

export default function CarreteiroDashboard() {
    const { user, profile } = useAuth();
    const { toast, showToast } = useToast();
    const [tab, setTab]           = useState('viagens');
    const [period, setPeriod]     = useState(30);
    const [viagens, setViagens]   = useState([]);
    const [abast, setAbast]       = useState([]);
    const [checklists, setChecklists] = useState([]);
    const [veiculos, setVeiculos] = useState([]);
    const [loading, setLoading]   = useState(true);
    const [modalAbast, setModalAbast]   = useState(false);
    const [modalCheck, setModalCheck]   = useState(false);
    const [formAbast, setFormAbast]     = useState({ veiculo_id: '', data_abastecimento: new Date().toISOString().split('T')[0], horario: '', posto: '', litros_diesel: '', valor_diesel: '', litros_arla: '', valor_arla: '', observacoes: '' });
    const [formCheck, setFormCheck]     = useState({ veiculo_id: '', itens: {}, problemas: '', necessidades: '', observacoes_livres: '' });

    const load = useCallback(async () => {
        if (!user?.id) return;
        setLoading(true);
        try {
            const cut = new Date();
            cut.setDate(cut.getDate() - period);
            const dateStr = cut.toISOString().split('T')[0];
            const [v, a, c, ve] = await Promise.all([
                fetchViagens({ motoristaId: user.id, dataInicio: dateStr }),
                fetchAbastecimentos({ motoristaId: user.id, dataInicio: dateStr }),
                fetchChecklists({ motoristaId: user.id }),
                fetchCarretasVeiculos(),
            ]);
            setViagens(v); setAbast(a); setChecklists(c); setVeiculos(ve);
        } catch (e) { showToast('Erro ao carregar: ' + e.message, 'error'); }
        finally { setLoading(false); }
    }, [user?.id, period]); // eslint-disable-line

    useEffect(() => { load(); }, [load]);

    // Calcula bônus por viagem (destino)
    const viagensComBonus = useMemo(() =>
        viagens.map(v => ({
            ...v,
            bonus: v.status === 'Entrega finalizada' ? calcularBonusCarreteiro(v.destino) : 0,
        }))
    , [viagens]);

    const totais = useMemo(() => ({
        viagens: viagens.length,
        finalizadas: viagens.filter(v => v.status === 'Entrega finalizada').length,
        emTransito: viagens.filter(v => v.status === 'Em trânsito').length,
        totalBonus: viagensComBonus.filter(v => v.status === 'Entrega finalizada').reduce((s, v) => s + v.bonus, 0),
        litrosDiesel: abast.reduce((s, a) => s + Number(a.litros_diesel || 0), 0),
        gastoTotal: abast.reduce((s, a) => s + Number(a.valor_total || 0), 0),
    }), [viagens, viagensComBonus, abast]);

    const handleAbast = async () => {
        if (!formAbast.veiculo_id || !formAbast.data_abastecimento) { showToast('Veículo e data são obrigatórios', 'error'); return; }
        try {
            await createAbastecimento({ ...formAbast, motorista_id: user.id });
            showToast('Abastecimento registrado!', 'success');
            setModalAbast(false);
            load();
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };

    const handleCheck = async () => {
        if (!formCheck.veiculo_id) { showToast('Selecione o veículo', 'error'); return; }
        const semana = new Date(); semana.setDate(semana.getDate() - semana.getDay() + 1);
        try {
            await createChecklist({ ...formCheck, motorista_id: user.id, semana_ref: semana.toISOString().split('T')[0] });
            showToast('Checklist enviado para análise!', 'success');
            setModalCheck(false);
            load();
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };

    const exportar = () => {
        const rows = viagensComBonus.map(v => ({
            'Nº Viagem': v.numero, 'Status': v.status, 'Destino': v.destino || '',
            'Data Saída': FMT_DATE(v.data_saida), 'Placa': v.veiculo?.placa || '',
            'Bônus': v.bonus,
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Minhas Viagens');
        XLSX.writeFile(wb, `viagens_${profile?.name || 'carreteiro'}_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.xlsx`);
        showToast('Exportado!', 'success');
    };

    const TABS = [
        { id: 'viagens',       label: 'Minhas Viagens',    icon: 'Navigation' },
        { id: 'bonificacoes',  label: 'Bonificações',      icon: 'DollarSign' },
        { id: 'abastecimentos',label: 'Abastecimentos',    icon: 'Fuel' },
        { id: 'checklist',     label: 'Checklist',         icon: 'ClipboardCheck' },
    ];

    return (
        <div className="min-h-screen" style={{ backgroundColor: 'var(--color-background)' }}>
            <NavigationBar />
            <main className="main-content">
                <div className="max-w-screen-xl mx-auto px-4 tab:px-6 lg:px-8 py-6">
                    <BreadcrumbTrail className="mb-4" />

                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                        <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-md"
                                style={{ background: 'linear-gradient(135deg, #1D4ED8, #7C3AED)' }}>
                                {(profile?.name || 'C')[0].toUpperCase()}
                            </div>
                            <div>
                                <h1 className="font-heading font-bold text-2xl" style={{ color: 'var(--color-text-primary)' }}>
                                    Olá, {profile?.name || 'Carreteiro'}
                                </h1>
                                <p className="text-sm font-caption" style={{ color: 'var(--color-muted-foreground)' }}>
                                    Suas viagens e registros
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-2 items-center flex-wrap">
                            <div className="flex rounded-lg border overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
                                {PERIOD_OPTIONS.map(p => (
                                    <button key={p.days} onClick={() => setPeriod(p.days)}
                                        className="px-3 py-2 text-xs font-caption font-medium transition-colors"
                                        style={period === p.days ? { backgroundColor: 'var(--color-primary)', color: '#fff' } : { backgroundColor: 'white', color: 'var(--color-muted-foreground)' }}>
                                        {p.label}
                                    </button>
                                ))}
                            </div>
                            <button onClick={exportar} className="flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-colors hover:bg-gray-50" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}>
                                <Icon name="FileDown" size={14} color="currentColor" />
                                Exportar
                            </button>
                        </div>
                    </div>

                    {/* KPIs */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                        {[
                            { l: 'Total de Viagens',  v: totais.viagens,     i: 'Navigation', c: '#1D4ED8', bg: '#EFF6FF' },
                            { l: 'Finalizadas',       v: totais.finalizadas, i: 'CheckCircle2', c: '#059669', bg: '#D1FAE5' },
                            { l: 'Em Trânsito',       v: totais.emTransito,  i: 'Truck', c: '#D97706', bg: '#FEF9C3' },
                            { l: 'Bônus no Período',  v: BRL(totais.totalBonus), i: 'DollarSign', c: '#7C3AED', bg: '#EDE9FE' },
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

                    {/* Ações rápidas */}
                    <div className="grid grid-cols-2 gap-3 mb-6">
                        <button onClick={() => { setFormAbast({ veiculo_id: '', data_abastecimento: new Date().toISOString().split('T')[0], horario: '', posto: '', litros_diesel: '', valor_diesel: '', litros_arla: '', valor_arla: '', observacoes: '' }); setModalAbast(true); }}
                            className="flex items-center gap-3 p-4 rounded-xl border bg-white shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5"
                            style={{ borderColor: 'var(--color-border)' }}>
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#D1FAE5' }}>
                                <Icon name="Fuel" size={20} color="#059669" />
                            </div>
                            <div className="text-left">
                                <p className="font-semibold text-sm" style={{ color: 'var(--color-text-primary)' }}>Registrar Abastecimento</p>
                                <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>Diesel + Arla</p>
                            </div>
                        </button>
                        <button onClick={() => { setFormCheck({ veiculo_id: '', itens: {}, problemas: '', necessidades: '', observacoes_livres: '' }); setModalCheck(true); }}
                            className="flex items-center gap-3 p-4 rounded-xl border bg-white shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5"
                            style={{ borderColor: 'var(--color-border)' }}>
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#EFF6FF' }}>
                                <Icon name="ClipboardCheck" size={20} color="#1D4ED8" />
                            </div>
                            <div className="text-left">
                                <p className="font-semibold text-sm" style={{ color: 'var(--color-text-primary)' }}>Checklist Semanal</p>
                                <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>Verificação do veículo</p>
                            </div>
                        </button>
                    </div>

                    {/* Tabs */}
                    <div className="flex border-b mb-5 overflow-x-auto" style={{ borderColor: 'var(--color-border)' }}>
                        {TABS.map(t => (
                            <button key={t.id} onClick={() => setTab(t.id)}
                                className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium font-caption border-b-2 whitespace-nowrap transition-colors ${tab === t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                                <Icon name={t.icon} size={15} color="currentColor" />
                                {t.label}
                            </button>
                        ))}
                    </div>

                    {loading ? (
                        <div className="flex justify-center py-20">
                            <div className="animate-spin h-8 w-8 rounded-full border-4" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
                        </div>
                    ) : (
                        <>
                            {/* Tab Viagens */}
                            {tab === 'viagens' && (
                                <div className="bg-white rounded-xl border shadow-sm overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
                                    <table className="w-full text-sm">
                                        <thead className="text-xs font-caption border-b" style={{ backgroundColor: 'var(--color-muted)', borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                                            <tr>
                                                <th className="px-4 py-3 text-left font-medium">Nº Viagem</th>
                                                <th className="px-4 py-3 text-left font-medium">Status</th>
                                                <th className="px-4 py-3 text-left font-medium">Destino</th>
                                                <th className="px-4 py-3 text-left font-medium hidden md:table-cell">Data</th>
                                                <th className="px-4 py-3 text-left font-medium hidden md:table-cell">Placa</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {viagensComBonus.length === 0 ? (
                                                <tr><td colSpan={5} className="text-center py-10 text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Nenhuma viagem no período</td></tr>
                                            ) : viagensComBonus.map((v, i) => {
                                                const sc = STATUS_COLORS[v.status] || STATUS_COLORS['Agendado'];
                                                return (
                                                    <tr key={v.id} className="border-t hover:bg-gray-50" style={{ borderColor: 'var(--color-border)', backgroundColor: i % 2 === 0 ? '#fff' : '#F8FAFC' }}>
                                                        <td className="px-4 py-3 font-medium text-blue-700 font-data">{v.numero}</td>
                                                        <td className="px-4 py-3"><span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: sc.bg, color: sc.text }}>{v.status}</span></td>
                                                        <td className="px-4 py-3">{v.destino || '—'}</td>
                                                        <td className="px-4 py-3 text-xs hidden md:table-cell" style={{ color: 'var(--color-muted-foreground)' }}>{FMT_DATE(v.data_saida)}</td>
                                                        <td className="px-4 py-3 font-data text-xs hidden md:table-cell">{v.veiculo?.placa || '—'}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* Tab Bonificações */}
                            {tab === 'bonificacoes' && (
                                <div className="flex flex-col gap-4">
                                    <div className="bg-white rounded-xl border p-5 shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
                                        <h3 className="font-heading font-semibold text-sm mb-4" style={{ color: 'var(--color-text-primary)' }}>Resumo do Período</h3>
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                                            <div>
                                                <p className="text-xs font-caption" style={{ color: 'var(--color-muted-foreground)' }}>Total Bônus</p>
                                                <p className="text-2xl font-bold font-data text-purple-600">{BRL(totais.totalBonus)}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs font-caption" style={{ color: 'var(--color-muted-foreground)' }}>Viagens Finalizadas</p>
                                                <p className="text-2xl font-bold font-data" style={{ color: 'var(--color-text-primary)' }}>{totais.finalizadas}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs font-caption" style={{ color: 'var(--color-muted-foreground)' }}>Total Viagens</p>
                                                <p className="text-2xl font-bold font-data" style={{ color: 'var(--color-text-primary)' }}>{totais.viagens}</p>
                                            </div>
                                        </div>
                                        <div className="p-3 rounded-xl text-xs" style={{ backgroundColor: '#F8FAFC' }}>
                                            <p className="font-semibold mb-2" style={{ color: 'var(--color-text-secondary)' }}>Tabela de bônus por descarga:</p>
                                            <div className="grid grid-cols-2 gap-2">
                                                <div className="p-2 rounded-lg bg-amber-50 border border-amber-200">
                                                    <p className="font-semibold text-amber-700">{BRL(BONUS_BAIXO)} por viagem</p>
                                                    <p className="text-amber-600 mt-0.5">Urandi, Pindaí, Candiba, Pilões, Guanambi (estoque)</p>
                                                </div>
                                                <div className="p-2 rounded-lg bg-green-50 border border-green-200">
                                                    <p className="font-semibold text-green-700">{BRL(BONUS_ALTO)} por viagem</p>
                                                    <p className="text-green-600 mt-0.5">Demais cidades da rota</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="bg-white rounded-xl border shadow-sm overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
                                        <div className="px-5 py-3 border-b" style={{ borderColor: 'var(--color-border)' }}>
                                            <h3 className="font-heading font-semibold text-sm" style={{ color: 'var(--color-text-primary)' }}>Detalhamento por Viagem</h3>
                                        </div>
                                        <table className="w-full text-sm">
                                            <thead className="text-xs font-caption border-b" style={{ backgroundColor: 'var(--color-muted)', borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                                                <tr>
                                                    <th className="px-4 py-2 text-left font-medium">Nº Viagem</th>
                                                    <th className="px-4 py-2 text-left font-medium">Destino</th>
                                                    <th className="px-4 py-2 text-left font-medium hidden sm:table-cell">Data</th>
                                                    <th className="px-4 py-2 text-right font-medium">Bônus</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {viagensComBonus.filter(v => v.status === 'Entrega finalizada').length === 0 ? (
                                                    <tr><td colSpan={4} className="text-center py-8 text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Nenhuma viagem finalizada no período</td></tr>
                                                ) : viagensComBonus.filter(v => v.status === 'Entrega finalizada').map((v, i) => (
                                                    <tr key={v.id} className="border-t hover:bg-gray-50" style={{ borderColor: 'var(--color-border)', backgroundColor: i % 2 === 0 ? '#fff' : '#F8FAFC' }}>
                                                        <td className="px-4 py-2.5 font-data text-xs font-medium text-blue-700">{v.numero}</td>
                                                        <td className="px-4 py-2.5 text-xs">{v.destino || '—'}</td>
                                                        <td className="px-4 py-2.5 text-xs hidden sm:table-cell" style={{ color: 'var(--color-muted-foreground)' }}>{FMT_DATE(v.data_saida)}</td>
                                                        <td className="px-4 py-2.5 text-right font-data font-semibold text-purple-600">{BRL(v.bonus)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* Tab Abastecimentos */}
                            {tab === 'abastecimentos' && (
                                <div>
                                    <div className="grid grid-cols-2 gap-4 mb-5">
                                        <div className="bg-white rounded-xl border p-4 shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
                                            <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>Diesel Total</p>
                                            <p className="text-xl font-bold font-data text-blue-600">{totais.litrosDiesel.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} L</p>
                                        </div>
                                        <div className="bg-white rounded-xl border p-4 shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
                                            <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>Gasto Total</p>
                                            <p className="text-xl font-bold font-data text-purple-600">{BRL(totais.gastoTotal)}</p>
                                        </div>
                                    </div>
                                    <div className="bg-white rounded-xl border shadow-sm overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
                                        <table className="w-full text-sm">
                                            <thead className="text-xs border-b" style={{ backgroundColor: 'var(--color-muted)', borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                                                <tr>
                                                    <th className="px-4 py-3 text-left font-medium">Data</th>
                                                    <th className="px-4 py-3 text-left font-medium">Placa</th>
                                                    <th className="px-4 py-3 text-left font-medium hidden md:table-cell">Posto</th>
                                                    <th className="px-4 py-3 text-right font-medium">Diesel (L)</th>
                                                    <th className="px-4 py-3 text-right font-medium">Total R$</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {abast.length === 0 ? <tr><td colSpan={5} className="text-center py-10 text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Nenhum abastecimento no período</td></tr>
                                                : abast.map((a, i) => (
                                                    <tr key={a.id} className="border-t hover:bg-gray-50" style={{ borderColor: 'var(--color-border)', backgroundColor: i % 2 === 0 ? '#fff' : '#F8FAFC' }}>
                                                        <td className="px-4 py-3">{FMT_DATE(a.data_abastecimento)}</td>
                                                        <td className="px-4 py-3 font-data">{a.veiculo?.placa || '—'}</td>
                                                        <td className="px-4 py-3 text-xs hidden md:table-cell">{a.posto || '—'}</td>
                                                        <td className="px-4 py-3 text-right font-data">{Number(a.litros_diesel || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</td>
                                                        <td className="px-4 py-3 text-right font-data font-semibold text-purple-600">{BRL(a.valor_total)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* Tab Checklist */}
                            {tab === 'checklist' && (
                                <div className="flex flex-col gap-4">
                                    {checklists.length === 0 && <div className="text-center py-12 text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Nenhum checklist enviado ainda</div>}
                                    {checklists.map(c => {
                                        const itens = c.itens || {};
                                        const ok = Object.values(itens).filter(Boolean).length;
                                        return (
                                            <div key={c.id} className="bg-white rounded-xl border p-4 shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
                                                <div className="flex items-center justify-between mb-2">
                                                    <div>
                                                        <p className="font-medium text-sm" style={{ color: 'var(--color-text-primary)' }}>{c.veiculo?.placa || '—'}</p>
                                                        <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>Semana de {c.semana_ref ? new Date(c.semana_ref + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}</p>
                                                    </div>
                                                    {c.aprovado
                                                        ? <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700"><Icon name="CheckCircle2" size={11} />Aprovado</span>
                                                        : <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700"><Icon name="Clock" size={11} />Pendente</span>
                                                    }
                                                </div>
                                                <div className="flex items-center justify-between text-xs mb-1">
                                                    <span style={{ color: 'var(--color-muted-foreground)' }}>Itens OK</span>
                                                    <span className="font-medium">{ok}/{CHECKLIST_ITENS.length}</span>
                                                </div>
                                                <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden">
                                                    <div className="h-full rounded-full" style={{ width: `${(ok / CHECKLIST_ITENS.length) * 100}%`, backgroundColor: ok === CHECKLIST_ITENS.length ? '#059669' : '#D97706' }} />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </main>

            {/* Modal Abastecimento */}
            {modalAbast && (
                <ModalOverlay onClose={() => setModalAbast(false)}>
                    <ModalHeader title="Registrar Abastecimento" icon="Fuel" onClose={() => setModalAbast(false)} />
                    <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="Veículo" required>
                            <select value={formAbast.veiculo_id} onChange={e => setFormAbast(f => ({ ...f, veiculo_id: e.target.value }))} className={inputCls} style={inputStyle}>
                                <option value="">Selecione...</option>
                                {veiculos.map(v => <option key={v.id} value={v.id}>{v.placa} — {v.modelo}</option>)}
                            </select>
                        </Field>
                        <Field label="Data" required><input type="date" value={formAbast.data_abastecimento} onChange={e => setFormAbast(f => ({ ...f, data_abastecimento: e.target.value }))} className={inputCls} style={inputStyle} /></Field>
                        <Field label="Horário"><input type="time" value={formAbast.horario} onChange={e => setFormAbast(f => ({ ...f, horario: e.target.value }))} className={inputCls} style={inputStyle} /></Field>
                        <Field label="Posto"><input value={formAbast.posto} onChange={e => setFormAbast(f => ({ ...f, posto: e.target.value }))} className={inputCls} style={inputStyle} placeholder="Nome do posto" /></Field>
                        <div className="sm:col-span-2 p-3 rounded-xl border" style={{ borderColor: '#BFDBFE', backgroundColor: '#EFF6FF' }}>
                            <p className="text-xs font-semibold text-blue-700 mb-2">🛢️ Diesel</p>
                            <div className="grid grid-cols-2 gap-3">
                                <Field label="Litros"><input type="number" step="0.01" value={formAbast.litros_diesel} onChange={e => setFormAbast(f => ({ ...f, litros_diesel: e.target.value }))} className={inputCls} style={inputStyle} placeholder="0,00" /></Field>
                                <Field label="Valor R$"><input type="number" step="0.01" value={formAbast.valor_diesel} onChange={e => setFormAbast(f => ({ ...f, valor_diesel: e.target.value }))} className={inputCls} style={inputStyle} placeholder="0,00" /></Field>
                            </div>
                        </div>
                        <div className="sm:col-span-2 p-3 rounded-xl border" style={{ borderColor: '#A7F3D0', backgroundColor: '#ECFDF5' }}>
                            <p className="text-xs font-semibold text-emerald-700 mb-2">💧 ARLA 32</p>
                            <div className="grid grid-cols-2 gap-3">
                                <Field label="Litros"><input type="number" step="0.01" value={formAbast.litros_arla} onChange={e => setFormAbast(f => ({ ...f, litros_arla: e.target.value }))} className={inputCls} style={inputStyle} placeholder="0,00" /></Field>
                                <Field label="Valor R$"><input type="number" step="0.01" value={formAbast.valor_arla} onChange={e => setFormAbast(f => ({ ...f, valor_arla: e.target.value }))} className={inputCls} style={inputStyle} placeholder="0,00" /></Field>
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-3 p-5 pt-0 justify-end">
                        <button onClick={() => setModalAbast(false)} className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50" style={{ borderColor: 'var(--color-border)' }}>Cancelar</button>
                        <Button onClick={handleAbast} size="sm" iconName="Check">Registrar</Button>
                    </div>
                </ModalOverlay>
            )}

            {/* Modal Checklist */}
            {modalCheck && (
                <ModalOverlay onClose={() => setModalCheck(false)}>
                    <ModalHeader title="Checklist Semanal" icon="ClipboardCheck" onClose={() => setModalCheck(false)} />
                    <div className="p-5 space-y-4">
                        <Field label="Veículo" required>
                            <select value={formCheck.veiculo_id} onChange={e => setFormCheck(f => ({ ...f, veiculo_id: e.target.value }))} className={inputCls} style={inputStyle}>
                                <option value="">Selecione...</option>
                                {veiculos.map(v => <option key={v.id} value={v.id}>{v.placa} — {v.modelo}</option>)}
                            </select>
                        </Field>
                        <div>
                            <p className="text-xs font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>Itens verificados</p>
                            <div className="grid grid-cols-1 gap-2">
                                {CHECKLIST_ITENS.map(item => (
                                    <label key={item.id} className="flex items-center gap-2 cursor-pointer p-2.5 rounded-lg border hover:bg-gray-50 transition-colors" style={{ borderColor: 'var(--color-border)' }}>
                                        <input type="checkbox" checked={!!formCheck.itens[item.id]} onChange={e => setFormCheck(f => ({ ...f, itens: { ...f.itens, [item.id]: e.target.checked } }))} className="accent-blue-600 w-4 h-4" />
                                        <span className="text-sm" style={{ color: 'var(--color-text-primary)' }}>{item.label}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                        <Field label="Problemas identificados"><textarea value={formCheck.problemas} onChange={e => setFormCheck(f => ({ ...f, problemas: e.target.value }))} className={inputCls} style={inputStyle} rows={2} placeholder="Descreva problemas..." /></Field>
                        <Field label="Necessidades"><textarea value={formCheck.necessidades} onChange={e => setFormCheck(f => ({ ...f, necessidades: e.target.value }))} className={inputCls} style={inputStyle} rows={2} placeholder="Pneus, cintas, peças..." /></Field>
                        <Field label="Observações livres"><textarea value={formCheck.observacoes_livres} onChange={e => setFormCheck(f => ({ ...f, observacoes_livres: e.target.value }))} className={inputCls} style={inputStyle} rows={2} /></Field>
                    </div>
                    <div className="flex gap-3 p-5 pt-0 justify-end">
                        <button onClick={() => setModalCheck(false)} className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50" style={{ borderColor: 'var(--color-border)' }}>Cancelar</button>
                        <Button onClick={handleCheck} size="sm" iconName="Send">Enviar</Button>
                    </div>
                </ModalOverlay>
            )}

            <Toast toast={toast} />
        </div>
    );
}
