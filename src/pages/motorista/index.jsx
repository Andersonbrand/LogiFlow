import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import NavigationBar from 'components/ui/NavigationBar';
import BreadcrumbTrail from 'components/ui/BreadcrumbTrail';
import Icon from 'components/AppIcon';
import Toast from 'components/ui/Toast';
import { useToast } from 'utils/useToast';
import { useAuth } from 'utils/AuthContext';
import { supabase } from 'utils/supabaseClient';
import { calcularBonificacao } from 'utils/bonificacaoService';
import {
    fetchAbastecimentos, createAbastecimento,
    fetchChecklists, createChecklist,
    fetchCarretasVeiculos,
    fetchPostos,
    fetchConfigAbastecimento,
    CHECKLIST_ITENS,
} from 'utils/carretasService';
import * as XLSX from 'xlsx';

const BRL = v => Number(v||0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const FMT = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—';
const inputCls = 'w-full px-3 py-2 rounded-lg border text-sm outline-none transition-all focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500';
const inputStyle = { borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' };

const PERIOD_OPTIONS = [
    { label: '30 dias', days: 30 },
    { label: '90 dias', days: 90 },
    { label: '6 meses', days: 180 },
];
const STATUS_ROM = {
    'Aguardando':  { bg: '#FEF9C3', text: '#B45309' },
    'Carregando':  { bg: '#DBEAFE', text: '#1D4ED8' },
    'Em Trânsito': { bg: '#D1FAE5', text: '#065F46' },
    'Finalizado':  { bg: '#F3F4F6', text: '#374151' },
    'Cancelado':   { bg: '#FEE2E2', text: '#991B1B' },
};

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

export default function MotoristaDashboard() {
    const { user, profile } = useAuth();
    const { toast, showToast } = useToast();
    const fotoRef = useRef(null);

    const [tab, setTab]               = useState('viagens');
    const [period, setPeriod]         = useState(30);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [loading, setLoading]       = useState(true);

    const [romaneios, setRomaneios]   = useState([]);
    const [abast, setAbast]           = useState([]);
    const [checklists, setChecklists] = useState([]);
    const [veiculos, setVeiculos]     = useState([]);
    const [postos, setPostos]         = useState([]);
    const [configAbast, setConfigAbast] = useState({ preco_diesel: 0, preco_arla: 0 });

    const [modalAbast, setModalAbast] = useState(false);
    const [modalCheck, setModalCheck] = useState(false);
    const [fotoPreview, setFotoPreview] = useState(null);
    const [submittingCheck, setSubmittingCheck] = useState(false);

    const emptyAbast = () => ({
        veiculo_id: '', posto_id: '',
        data_abastecimento: new Date().toISOString().split('T')[0],
        horario: '', litros_diesel: '', valor_diesel: '',
        litros_arla: '', valor_arla: '', observacoes: '',
    });
    const emptyCheck = () => ({
        veiculo_id: '', itens: {}, problemas: '', necessidades: '',
        observacoes_livres: '', foto_url: '',
    });
    const [formAbast, setFormAbast] = useState(emptyAbast());
    const [formCheck, setFormCheck] = useState(emptyCheck());

    // ── Load ─────────────────────────────────────────────────────────────────
    const load = useCallback(async () => {
        if (!user?.id || !profile?.name) return;
        setLoading(true);
        try {
            const cut = new Date(); cut.setDate(cut.getDate() - period);
            const dateStr = cut.toISOString().split('T')[0];

            const [roms, a, c, ve, p, cfg] = await Promise.all([
                supabase.from('romaneios')
                    .select(`id, numero, motorista, motorista_id, placa, destino, status,
                        aprovado, aprovado_em, peso_total, saida, created_at,
                        romaneio_itens(id, quantidade, peso_total, material_id,
                            materials(id, nome, unidade, peso, categoria_frete))`)
                    .or(`motorista_id.eq.${user.id},motorista.ilike."${profile.name}"`)
                    .gte('created_at', dateStr)
                    .order('created_at', { ascending: false })
                    .then(r => r.data || []),
                fetchAbastecimentos({ motoristaId: user.id, dataInicio: dateStr }),
                fetchChecklists({ motoristaId: user.id }),
                fetchCarretasVeiculos(),
                fetchPostos().catch(() => []),
                fetchConfigAbastecimento().catch(() => ({ preco_diesel: 0, preco_arla: 0 })),
            ]);

            setRomaneios(roms);
            setAbast(a); setChecklists(c);
            setVeiculos(ve); setPostos(p);
            setConfigAbast(cfg || { preco_diesel: 0, preco_arla: 0 });
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
        finally { setLoading(false); }
    }, [user?.id, profile?.name, period]); // eslint-disable-line

    useEffect(() => { load(); }, [load]);

    // ── Computed ─────────────────────────────────────────────────────────────
    const bonificacoes = useMemo(() =>
        romaneios.map(r => ({ ...r, bonif: calcularBonificacao(r) }))
    , [romaneios]);

    const totais = useMemo(() => ({
        viagens:      romaneios.length,
        finalizadas:  romaneios.filter(r => r.status === 'Finalizado').length,
        emTransito:   romaneios.filter(r => r.status === 'Em Trânsito').length,
        totalBonus:   bonificacoes.reduce((s, r) => s + (r.bonif?.valorTotal || 0), 0),
        litrosDiesel: abast.reduce((s, a) => s + Number(a.litros_diesel || 0), 0),
        gastoTotal:   abast.reduce((s, a) => s + Number(a.valor_total || 0), 0),
    }), [romaneios, bonificacoes, abast]);

    // ── Preços: posto tem prioridade, senão usa config global do admin ────────
    const getPreco = useCallback((postoId, tipo) => {
        const posto = postos.find(p => p.id === postoId);
        if (tipo === 'diesel') return Number(posto?.preco_diesel || configAbast?.preco_diesel || 0);
        if (tipo === 'arla')   return Number(posto?.preco_arla   || configAbast?.preco_arla   || 0);
        return 0;
    }, [postos, configAbast]);

    const handlePostoChange = (postoId) => {
        const precoDiesel = getPreco(postoId, 'diesel');
        const precoArla   = getPreco(postoId, 'arla');
        setFormAbast(f => ({
            ...f, posto_id: postoId,
            valor_diesel: precoDiesel && f.litros_diesel
                ? (Number(f.litros_diesel) * precoDiesel).toFixed(2) : f.valor_diesel,
            valor_arla: precoArla && f.litros_arla
                ? (Number(f.litros_arla) * precoArla).toFixed(2) : f.valor_arla,
        }));
    };

    const handleLitros = (campo, valor) => {
        const precoDiesel = getPreco(formAbast.posto_id, 'diesel');
        const precoArla   = getPreco(formAbast.posto_id, 'arla');
        setFormAbast(f => {
            const n = { ...f, [campo]: valor };
            if (campo === 'litros_diesel' && precoDiesel)
                n.valor_diesel = valor ? (Number(valor) * precoDiesel).toFixed(2) : '';
            if (campo === 'litros_arla' && precoArla)
                n.valor_arla = valor ? (Number(valor) * precoArla).toFixed(2) : '';
            return n;
        });
    };

    // ── Handlers ─────────────────────────────────────────────────────────────
    const handleAbast = async () => {
        if (!formAbast.veiculo_id || !formAbast.data_abastecimento) {
            showToast('Veículo e data são obrigatórios', 'error'); return;
        }
        try {
            const payload = { ...formAbast, motorista_id: user.id };
            if (!payload.posto_id) delete payload.posto_id;
            const posto = postos.find(p => p.id === formAbast.posto_id);
            if (posto) payload.posto = posto.nome;
            await createAbastecimento(payload);
            showToast('Abastecimento registrado!', 'success');
            setModalAbast(false); setFormAbast(emptyAbast()); load();
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };

    const handleFoto = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) { showToast('Foto muito grande (máx 5MB)', 'error'); return; }
        const reader = new FileReader();
        reader.onload = ev => {
            setFotoPreview(ev.target.result);
            setFormCheck(f => ({ ...f, foto_url: ev.target.result }));
        };
        reader.readAsDataURL(file);
    };

    const handleCheck = async () => {
        if (submittingCheck) return; // previne duplo envio
        if (!formCheck.veiculo_id) { showToast('Selecione o veículo', 'error'); return; }
        const semana = new Date(); semana.setDate(semana.getDate() - semana.getDay() + 1);
        setSubmittingCheck(true);
        try {
            await createChecklist({ ...formCheck, motorista_id: user.id, semana_ref: semana.toISOString().split('T')[0] });
            showToast('Checklist enviado!', 'success');
            setModalCheck(false); setFotoPreview(null); setFormCheck(emptyCheck()); load();
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
        finally { setSubmittingCheck(false); }
    };

    const exportar = () => {
        if (!bonificacoes.length) { showToast('Nenhum dado para exportar', 'error'); return; }
        const rows = bonificacoes.map(r => ({
            'Romaneio': r.numero || '', 'Destino': r.destino || '', 'Status': r.status || '',
            'Data': r.saida ? new Date(r.saida).toLocaleDateString('pt-BR') : '',
            'Aprovado': r.aprovado ? 'Sim' : 'Não',
            'Ton. Ferragem': r.bonif?.toneladasFerragem || 0,
            'Bônus (R$)': r.bonif?.valorTotal || 0,
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        ws['!cols'] = [12,20,12,12,10,14,14].map(w => ({ wch: w }));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Romaneios');
        XLSX.writeFile(wb, `romaneios_${profile?.name||'motorista'}_${new Date().toLocaleDateString('pt-BR').replace(/\//g,'-')}.xlsx`);
        showToast('Exportado!', 'success');
    };

    // ── Tabs ─────────────────────────────────────────────────────────────────
    const TABS = [
        { id: 'viagens',        label: 'Meus Romaneios', icon: 'FileText' },
        { id: 'abastecimentos', label: 'Abastecimentos', icon: 'Fuel' },
        { id: 'checklist',      label: 'Checklist',      icon: 'ClipboardCheck' },
        { id: 'bonificacoes',   label: 'Bonificações',   icon: 'DollarSign' },
    ];
    const tabAtual = TABS.find(t => t.id === tab);

    // Helper: preço efetivo para exibir no modal
    const precoDieselEfetivo = getPreco(formAbast.posto_id, 'diesel');
    const precoArlaEfetivo   = getPreco(formAbast.posto_id, 'arla');

    return (
        <div className="min-h-screen" style={{ backgroundColor: 'var(--color-background)' }}>
            <NavigationBar />
            <main className="main-content">
                <div className="max-w-screen-xl mx-auto">
                    <div className="flex">

                        {/* ── Sidebar desktop ── */}
                        <aside className="hidden lg:flex flex-col flex-shrink-0 sticky top-[60px] h-[calc(100vh-60px)] overflow-y-auto border-r"
                            style={{ width: 210, borderColor: 'var(--color-border)', backgroundColor: 'var(--color-card)' }}>
                            <nav className="flex flex-col gap-1 p-3">
                                <div className="px-3 py-3 mb-2 border-b" style={{ borderColor: 'var(--color-border)' }}>
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-base flex-shrink-0"
                                            style={{ background: 'linear-gradient(135deg, #1D4ED8, #7C3AED)' }}>
                                            {(profile?.name || 'M')[0].toUpperCase()}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-semibold text-sm truncate" style={{ color: 'var(--color-text-primary)' }}>{profile?.name || 'Motorista'}</p>
                                            <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>Motorista</p>
                                        </div>
                                    </div>
                                </div>
                                {TABS.map(t => {
                                    const ativo = tab === t.id;
                                    return (
                                        <button key={t.id} onClick={() => setTab(t.id)}
                                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left"
                                            style={{ backgroundColor: ativo ? 'var(--color-primary)' : 'transparent', color: ativo ? '#fff' : 'var(--color-muted-foreground)' }}>
                                            <Icon name={t.icon} size={16} color={ativo ? '#fff' : 'currentColor'} />
                                            <span>{t.label}</span>
                                        </button>
                                    );
                                })}
                                <div className="mt-4 pt-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
                                    <p className="px-3 mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-muted-foreground)', fontSize: 10 }}>Período</p>
                                    <div className="flex flex-col gap-1 px-3">
                                        {PERIOD_OPTIONS.map(p => (
                                            <button key={p.days} onClick={() => setPeriod(p.days)}
                                                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors text-left"
                                                style={period === p.days ? { backgroundColor: 'var(--color-primary)', color: '#fff' } : { color: 'var(--color-muted-foreground)' }}>
                                                {p.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </nav>
                        </aside>

                        {/* ── Conteúdo ── */}
                        <div className="flex-1 min-w-0 px-3 sm:px-4 lg:px-6 py-4 sm:py-6">
                            <BreadcrumbTrail className="mb-4" />

                            {/* Header */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-base lg:hidden"
                                        style={{ background: 'linear-gradient(135deg, #1D4ED8, #7C3AED)' }}>
                                        {(profile?.name || 'M')[0].toUpperCase()}
                                    </div>
                                    <div>
                                        <h1 className="font-heading font-bold text-lg sm:text-xl" style={{ color: 'var(--color-text-primary)' }}>
                                            Olá, {profile?.name || 'Motorista'}
                                        </h1>
                                        <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>{tabAtual?.label}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <div className="lg:hidden flex rounded-lg border overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
                                        {PERIOD_OPTIONS.map(p => (
                                            <button key={p.days} onClick={() => setPeriod(p.days)}
                                                className="px-2 sm:px-3 py-2 text-xs font-medium transition-colors"
                                                style={period === p.days ? { backgroundColor: 'var(--color-primary)', color: '#fff' } : { backgroundColor: 'white', color: 'var(--color-muted-foreground)' }}>
                                                {p.label}
                                            </button>
                                        ))}
                                    </div>
                                    <button onClick={load} className="flex items-center gap-1.5 px-2 sm:px-3 py-2 rounded-lg border text-xs font-medium hover:bg-gray-50" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}>
                                        <Icon name="RefreshCw" size={14} color="currentColor" />
                                        <span className="hidden sm:inline">Atualizar</span>
                                    </button>
                                    <button onClick={exportar} className="flex items-center gap-1.5 px-2 sm:px-3 py-2 rounded-lg border text-xs font-medium hover:bg-gray-50" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}>
                                        <Icon name="FileDown" size={14} color="currentColor" />
                                        <span className="hidden sm:inline">Exportar</span>
                                    </button>
                                    <button onClick={() => setDrawerOpen(true)}
                                        className="lg:hidden flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium hover:bg-gray-50"
                                        style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}>
                                        <Icon name="Menu" size={16} color="currentColor" />
                                    </button>
                                </div>
                            </div>

                            {/* KPIs */}
                            <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-5">
                                {[
                                    { l: 'Total Romaneios', v: totais.viagens,     i: 'FileText',     c: '#1D4ED8', bg: '#EFF6FF' },
                                    { l: 'Finalizados',     v: totais.finalizadas, i: 'CheckCircle2', c: '#059669', bg: '#D1FAE5' },
                                    { l: 'Em Trânsito',     v: totais.emTransito,  i: 'Navigation',   c: '#D97706', bg: '#FEF9C3' },
                                    { l: 'Bônus no Período',v: BRL(totais.totalBonus), i: 'DollarSign', c: '#7C3AED', bg: '#EDE9FE' },
                                ].map(k => (
                                    <div key={k.l} className="bg-white rounded-xl border p-3 sm:p-4 shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>{k.l}</span>
                                            <div className="rounded-lg flex items-center justify-center" style={{ width: 28, height: 28, backgroundColor: k.bg }}>
                                                <Icon name={k.i} size={14} color={k.c} />
                                            </div>
                                        </div>
                                        <p className="text-lg sm:text-xl font-bold font-data" style={{ color: k.c }}>{k.v}</p>
                                    </div>
                                ))}
                            </div>

                            {/* Quick actions */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
                                <button onClick={() => { setFormAbast(emptyAbast()); setModalAbast(true); }}
                                    className="flex items-center gap-3 p-4 rounded-xl border bg-white shadow-sm hover:shadow-md transition-all"
                                    style={{ borderColor: 'var(--color-border)' }}>
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#D1FAE5' }}>
                                        <Icon name="Fuel" size={20} color="#059669" />
                                    </div>
                                    <div className="text-left">
                                        <p className="font-semibold text-sm" style={{ color: 'var(--color-text-primary)' }}>Abastecimento</p>
                                        <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>Diesel + Arla</p>
                                    </div>
                                </button>
                                <button onClick={() => { setFormCheck(emptyCheck()); setFotoPreview(null); setModalCheck(true); }}
                                    className="flex items-center gap-3 p-4 rounded-xl border bg-white shadow-sm hover:shadow-md transition-all"
                                    style={{ borderColor: 'var(--color-border)' }}>
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#EFF6FF' }}>
                                        <Icon name="ClipboardCheck" size={20} color="#1D4ED8" />
                                    </div>
                                    <div className="text-left">
                                        <p className="font-semibold text-sm" style={{ color: 'var(--color-text-primary)' }}>Checklist Semanal</p>
                                        <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>Verificação do veículo</p>
                                    </div>
                                </button>
                            </div>

                            {/* Conteúdo das abas */}
                            {loading ? (
                                <div className="flex justify-center py-16">
                                    <div className="animate-spin h-8 w-8 rounded-full border-4" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
                                </div>
                            ) : (
                                <>
                                    {/* Meus Romaneios */}
                                    {tab === 'viagens' && (
                                        <div className="flex flex-col gap-2">
                                            {romaneios.length === 0
                                                ? <div className="bg-white rounded-xl border p-8 text-center text-sm" style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>Nenhuma viagem no período</div>
                                                : romaneios.map(r => {
                                                    const sc = STATUS_ROM[r.status] || STATUS_ROM['Finalizado'];
                                                    return (
                                                        <div key={r.id} className="bg-white rounded-xl border p-4 shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
                                                            <div className="flex items-start justify-between mb-2">
                                                                <span className="font-data font-bold text-blue-700">{r.numero}</span>
                                                                <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: sc.bg, color: sc.text }}>{r.status}</span>
                                                            </div>
                                                            <p className="text-sm mb-2" style={{ color: 'var(--color-text-primary)' }}>{r.destino || '—'}</p>
                                                            <div className="flex items-center justify-between text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                                                                <div className="flex items-center gap-3">
                                                                    {r.saida && <span>{new Date(r.saida).toLocaleDateString('pt-BR')}</span>}
                                                                    <span className="font-data">{Number(r.peso_total||0).toLocaleString('pt-BR')} kg</span>
                                                                </div>
                                                                {r.aprovado
                                                                    ? <span className="flex items-center gap-1 text-green-600 font-medium"><Icon name="CheckCircle2" size={12} color="#059669" />Aprovado</span>
                                                                    : <span className="flex items-center gap-1 text-amber-600"><Icon name="Clock" size={12} color="#D97706" />Pendente</span>
                                                                }
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            }
                                        </div>
                                    )}

                                    {/* Abastecimentos */}
                                    {tab === 'abastecimentos' && (
                                        <div className="flex flex-col gap-3">
                                            <div className="grid grid-cols-2 gap-3 mb-2">
                                                {[
                                                    { l: 'Diesel (L)', v: totais.litrosDiesel.toLocaleString('pt-BR', { maximumFractionDigits: 1 }), c: '#1D4ED8', bg: '#EFF6FF', i: 'Fuel' },
                                                    { l: 'Total Gasto', v: BRL(totais.gastoTotal), c: '#7C3AED', bg: '#EDE9FE', i: 'Receipt' },
                                                ].map(k => (
                                                    <div key={k.l} className="bg-white rounded-xl border p-3 shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <div className="rounded-lg flex items-center justify-center" style={{ width: 26, height: 26, backgroundColor: k.bg }}><Icon name={k.i} size={13} color={k.c} /></div>
                                                            <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>{k.l}</span>
                                                        </div>
                                                        <p className="text-base font-bold font-data" style={{ color: k.c }}>{k.v}</p>
                                                    </div>
                                                ))}
                                            </div>
                                            {abast.length === 0
                                                ? <div className="bg-white rounded-xl border p-8 text-center text-sm" style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>Nenhum abastecimento no período</div>
                                                : abast.map(a => (
                                                    <div key={a.id} className="bg-white rounded-xl border p-4 shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
                                                        <div className="flex items-start justify-between mb-2 gap-2">
                                                            <div>
                                                                <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{a.posto || postos.find(p => p.id === a.posto_id)?.nome || '—'}</p>
                                                                <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted-foreground)' }}>{FMT(a.data_abastecimento)}{a.horario ? ` · ${a.horario}` : ''} · {a.veiculo?.placa || '—'}</p>
                                                            </div>
                                                            <p className="text-base font-bold font-data text-purple-600 flex-shrink-0">{BRL(a.valor_total)}</p>
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-2 text-xs">
                                                            {Number(a.litros_diesel||0) > 0 && (
                                                                <div className="flex items-center gap-1.5 p-2 rounded-lg bg-blue-50">
                                                                    <span className="text-blue-700">🛢️ {Number(a.litros_diesel).toLocaleString('pt-BR',{maximumFractionDigits:1})}L · {BRL(a.valor_diesel)}</span>
                                                                </div>
                                                            )}
                                                            {Number(a.litros_arla||0) > 0 && (
                                                                <div className="flex items-center gap-1.5 p-2 rounded-lg bg-emerald-50">
                                                                    <span className="text-emerald-700">💧 {Number(a.litros_arla).toLocaleString('pt-BR',{maximumFractionDigits:1})}L · {BRL(a.valor_arla)}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))
                                            }
                                        </div>
                                    )}

                                    {/* Checklist */}
                                    {tab === 'checklist' && (
                                        <div className="flex flex-col gap-4">
                                            {checklists.length === 0
                                                ? <div className="bg-white rounded-xl border p-8 text-center text-sm" style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>Nenhum checklist enviado</div>
                                                : checklists.map(c => {
                                                    const itens = c.itens || {};
                                                    const ok = Object.values(itens).filter(Boolean).length;
                                                    return (
                                                        <div key={c.id} className="bg-white rounded-xl border p-4 shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
                                                            <div className="flex items-center justify-between mb-2">
                                                                <div>
                                                                    <p className="font-medium text-sm" style={{ color: 'var(--color-text-primary)' }}>{c.veiculo?.placa || '—'}</p>
                                                                    <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>Semana de {c.semana_ref ? FMT(c.semana_ref) : '—'}</p>
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
                                                                <div className="h-full rounded-full" style={{ width: `${(ok/CHECKLIST_ITENS.length)*100}%`, backgroundColor: ok===CHECKLIST_ITENS.length ? '#059669' : '#D97706' }} />
                                                            </div>
                                                            {c.obs_manutencao && (
                                                                <p className="text-xs mt-2 p-2 rounded-lg bg-orange-50 text-orange-700 border border-orange-100">🔧 {c.obs_manutencao}</p>
                                                            )}
                                                        </div>
                                                    );
                                                })
                                            }
                                        </div>
                                    )}

                                    {/* Bonificações */}
                                    {tab === 'bonificacoes' && (
                                        <div className="flex flex-col gap-4">
                                            <div className="bg-white rounded-xl border p-4 shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
                                                <h3 className="font-heading font-semibold text-sm mb-3" style={{ color: 'var(--color-text-primary)' }}>Resumo do Período</h3>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>Total Bônus</p>
                                                        <p className="text-2xl font-bold font-data text-purple-600">{BRL(totais.totalBonus)}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>Finalizados</p>
                                                        <p className="text-2xl font-bold font-data" style={{ color: 'var(--color-text-primary)' }}>{totais.finalizadas}</p>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex flex-col gap-2">
                                                {bonificacoes.filter(r => r.bonif?.valorTotal > 0).length === 0
                                                    ? <div className="bg-white rounded-xl border p-6 text-center text-sm" style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>Nenhuma bonificação no período</div>
                                                    : bonificacoes.filter(r => r.bonif?.valorTotal > 0).map(r => (
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
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </main>

            {/* Drawer mobile */}
            {drawerOpen && (
                <>
                    <div className="fixed inset-0 z-40 lg:hidden" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }} onClick={() => setDrawerOpen(false)} />
                    <div className="fixed top-0 left-0 bottom-0 z-50 lg:hidden flex flex-col overflow-y-auto shadow-2xl"
                        style={{ width: 240, backgroundColor: 'var(--color-card)' }}>
                        <div className="flex items-center justify-between px-4 py-4 border-b flex-shrink-0"
                            style={{ borderColor: 'var(--color-border)', paddingTop: 'max(env(safe-area-inset-top), 16px)' }}>
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold flex-shrink-0"
                                    style={{ background: 'linear-gradient(135deg, #1D4ED8, #7C3AED)' }}>
                                    {(profile?.name || 'M')[0].toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                    <p className="font-semibold text-sm truncate" style={{ color: 'var(--color-text-primary)' }}>{profile?.name || 'Motorista'}</p>
                                    <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>Motorista</p>
                                </div>
                            </div>
                            <button onClick={() => setDrawerOpen(false)} className="p-2 rounded-lg hover:bg-gray-100 flex-shrink-0">
                                <Icon name="X" size={20} color="var(--color-muted-foreground)" />
                            </button>
                        </div>
                        <nav className="flex flex-col gap-1 p-3 flex-1">
                            {TABS.map(t => {
                                const ativo = tab === t.id;
                                return (
                                    <button key={t.id} onClick={() => { setTab(t.id); setDrawerOpen(false); }}
                                        className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-all text-left"
                                        style={{ backgroundColor: ativo ? 'var(--color-primary)' : 'transparent', color: ativo ? '#fff' : 'var(--color-muted-foreground)' }}>
                                        <Icon name={t.icon} size={18} color={ativo ? '#fff' : 'currentColor'} />
                                        <span>{t.label}</span>
                                    </button>
                                );
                            })}
                        </nav>
                    </div>
                </>
            )}

            {/* Modal Abastecimento */}
            {modalAbast && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
                    style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
                    onClick={e => e.target === e.currentTarget && setModalAbast(false)}>
                    <div className="bg-white w-full sm:rounded-2xl sm:max-w-xl sm:mx-4 rounded-t-2xl shadow-2xl max-h-[92vh] overflow-y-auto">
                        <div className="flex justify-center pt-3 pb-1 sm:hidden"><div className="w-10 h-1 rounded-full bg-gray-300" /></div>
                        <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: 'var(--color-border)' }}>
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-emerald-50">
                                    <Icon name="Fuel" size={18} color="#059669" />
                                </div>
                                <h2 className="font-bold text-lg" style={{ color: 'var(--color-text-primary)' }}>Registrar Abastecimento</h2>
                            </div>
                            <button onClick={() => setModalAbast(false)} className="p-1.5 rounded-lg hover:bg-gray-100">
                                <Icon name="X" size={18} color="var(--color-muted-foreground)" />
                            </button>
                        </div>
                        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Field label="Veículo" required>
                                <select value={formAbast.veiculo_id} onChange={e => setFormAbast(f => ({ ...f, veiculo_id: e.target.value }))} className={inputCls} style={inputStyle}>
                                    <option value="">Selecione...</option>
                                    {veiculos.map(v => <option key={v.id} value={v.id}>{v.placa} — {v.modelo}</option>)}
                                </select>
                            </Field>
                            <Field label="Data" required>
                                <input type="date" value={formAbast.data_abastecimento} onChange={e => setFormAbast(f => ({ ...f, data_abastecimento: e.target.value }))} className={inputCls} style={inputStyle} />
                            </Field>
                            <Field label="Horário">
                                <input type="time" value={formAbast.horario} onChange={e => setFormAbast(f => ({ ...f, horario: e.target.value }))} className={inputCls} style={inputStyle} />
                            </Field>
                            <Field label="Posto">
                                <select value={formAbast.posto_id} onChange={e => handlePostoChange(e.target.value)} className={inputCls} style={inputStyle}>
                                    <option value="">Selecione o posto...</option>
                                    {postos.map(p => (
                                        <option key={p.id} value={p.id}>
                                            {p.nome}{p.cidade ? ` — ${p.cidade}` : ''}
                                        </option>
                                    ))}
                                </select>
                                {/* Mostra preço efetivo (posto ou config global) */}
                                <div className="flex gap-3 mt-1 text-xs">
                                    {precoDieselEfetivo > 0 && (
                                        <span className="text-blue-600 font-medium">
                                            🛢️ R${precoDieselEfetivo.toFixed(3)}/L
                                            {!postos.find(p => p.id === formAbast.posto_id)?.preco_diesel && configAbast?.preco_diesel > 0 && (
                                                <span className="text-gray-400 ml-1">(padrão)</span>
                                            )}
                                        </span>
                                    )}
                                    {precoArlaEfetivo > 0 && (
                                        <span className="text-emerald-600 font-medium">
                                            💧 R${precoArlaEfetivo.toFixed(3)}/L
                                            {!postos.find(p => p.id === formAbast.posto_id)?.preco_arla && configAbast?.preco_arla > 0 && (
                                                <span className="text-gray-400 ml-1">(padrão)</span>
                                            )}
                                        </span>
                                    )}
                                </div>
                            </Field>
                            <div className="sm:col-span-2 p-3 rounded-xl border" style={{ borderColor: '#BFDBFE', backgroundColor: '#EFF6FF' }}>
                                <p className="text-xs font-semibold text-blue-700 mb-2">🛢️ Diesel</p>
                                <div className="grid grid-cols-2 gap-3">
                                    <Field label="Litros">
                                        <input type="number" step="0.01" value={formAbast.litros_diesel} onChange={e => handleLitros('litros_diesel', e.target.value)} className={inputCls} style={inputStyle} placeholder="0,00" />
                                    </Field>
                                    <Field label="Valor R$">
                                        <input type="number" step="0.01" value={formAbast.valor_diesel} onChange={e => setFormAbast(f => ({ ...f, valor_diesel: e.target.value }))} className={inputCls} style={inputStyle} placeholder="0,00" />
                                    </Field>
                                </div>
                            </div>
                            <div className="sm:col-span-2 p-3 rounded-xl border" style={{ borderColor: '#A7F3D0', backgroundColor: '#ECFDF5' }}>
                                <p className="text-xs font-semibold text-emerald-700 mb-2">💧 ARLA 32</p>
                                <div className="grid grid-cols-2 gap-3">
                                    <Field label="Litros">
                                        <input type="number" step="0.01" value={formAbast.litros_arla} onChange={e => handleLitros('litros_arla', e.target.value)} className={inputCls} style={inputStyle} placeholder="0,00" />
                                    </Field>
                                    <Field label="Valor R$">
                                        <input type="number" step="0.01" value={formAbast.valor_arla} onChange={e => setFormAbast(f => ({ ...f, valor_arla: e.target.value }))} className={inputCls} style={inputStyle} placeholder="0,00" />
                                    </Field>
                                </div>
                            </div>
                            <div className="sm:col-span-2">
                                <Field label="Observações">
                                    <textarea value={formAbast.observacoes} onChange={e => setFormAbast(f => ({ ...f, observacoes: e.target.value }))} className={inputCls} style={inputStyle} rows={2} />
                                </Field>
                            </div>
                        </div>
                        <div className="flex gap-3 p-5 pt-0 justify-end">
                            <button onClick={() => setModalAbast(false)} className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50" style={{ borderColor: 'var(--color-border)' }}>Cancelar</button>
                            <button onClick={handleAbast} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ backgroundColor: 'var(--color-primary)' }}>
                                <Icon name="Check" size={15} color="white" /> Salvar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Checklist */}
            {modalCheck && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
                    style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
                    onClick={e => e.target === e.currentTarget && setModalCheck(false)}>
                    <div className="bg-white w-full sm:rounded-2xl sm:max-w-xl sm:mx-4 rounded-t-2xl shadow-2xl"
                        style={{ maxHeight: '95dvh', overflowY: 'auto' }}>
                        <div className="flex justify-center pt-3 pb-1 sm:hidden"><div className="w-10 h-1 rounded-full bg-gray-300" /></div>
                        {/* Header fixo no topo */}
                        <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-white z-10" style={{ borderColor: 'var(--color-border)' }}>
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-blue-50">
                                    <Icon name="ClipboardCheck" size={18} color="#1D4ED8" />
                                </div>
                                <h2 className="font-bold text-lg" style={{ color: 'var(--color-text-primary)' }}>Checklist Semanal</h2>
                            </div>
                            <button onClick={() => setModalCheck(false)} className="p-1.5 rounded-lg hover:bg-gray-100">
                                <Icon name="X" size={18} color="var(--color-muted-foreground)" />
                            </button>
                        </div>
                        <div className="p-5 space-y-4">
                            <Field label="Veículo" required>
                                <select value={formCheck.veiculo_id} onChange={e => setFormCheck(f => ({ ...f, veiculo_id: e.target.value }))} className={inputCls} style={inputStyle}>
                                    <option value="">Selecione...</option>
                                    {veiculos.map(v => <option key={v.id} value={v.id}>{v.placa} — {v.modelo}</option>)}
                                </select>
                            </Field>

                            {/* Foto — logo no topo, destaque visual, antes dos campos de texto */}
                            <div className="rounded-xl border-2 border-dashed p-4"
                                style={{ borderColor: fotoPreview ? '#059669' : '#93C5FD', backgroundColor: fotoPreview ? '#F0FDF4' : '#EFF6FF' }}>
                                <p className="text-xs font-semibold mb-3 flex items-center gap-1.5"
                                    style={{ color: fotoPreview ? '#065F46' : '#1D4ED8' }}>
                                    <Icon name="Camera" size={14} color={fotoPreview ? '#059669' : '#1D4ED8'} />
                                    {fotoPreview ? '✅ Foto anexada' : '📷 Foto do problema (opcional)'}
                                </p>
                                {fotoPreview ? (
                                    <div className="flex flex-col gap-2">
                                        <img src={fotoPreview} alt="Preview" className="rounded-xl border w-full max-h-48 object-cover" style={{ borderColor: '#BBF7D0' }} />
                                        <div className="flex gap-2">
                                            <button type="button" onClick={() => fotoRef.current?.click()}
                                                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-white border flex-1 justify-center"
                                                style={{ borderColor: '#BBF7D0', color: '#065F46' }}>
                                                <Icon name="RefreshCw" size={13} /> Trocar foto
                                            </button>
                                            <button type="button" onClick={() => { setFotoPreview(null); setFormCheck(f => ({ ...f, foto_url: '' })); }}
                                                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-red-600 bg-white border border-red-200">
                                                <Icon name="Trash2" size={13} /> Remover
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <button type="button" onClick={() => fotoRef.current?.click()}
                                        className="w-full flex flex-col items-center gap-2 py-5 rounded-xl text-sm font-medium transition-colors"
                                        style={{ backgroundColor: 'white', border: '1px solid #BFDBFE', color: '#1D4ED8' }}>
                                        <Icon name="Camera" size={28} color="#1D4ED8" />
                                        <span>Tirar foto ou escolher da galeria</span>
                                        <span className="text-xs font-normal" style={{ color: '#93C5FD' }}>Toque para abrir a câmera</span>
                                    </button>
                                )}
                                <input ref={fotoRef} type="file" accept="image/*" capture="environment" onChange={handleFoto} className="hidden" />
                            </div>

                            <div>
                                <p className="text-xs font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>Itens verificados</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {CHECKLIST_ITENS.map(item => (
                                        <label key={item.id} className="flex items-center gap-2 cursor-pointer p-2 rounded-lg border hover:bg-gray-50" style={{ borderColor: 'var(--color-border)' }}>
                                            <input type="checkbox" checked={!!formCheck.itens[item.id]} onChange={e => setFormCheck(f => ({ ...f, itens: { ...f.itens, [item.id]: e.target.checked } }))} className="accent-blue-600" />
                                            <span className="text-sm" style={{ color: 'var(--color-text-primary)' }}>{item.label}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <Field label="Problemas identificados">
                                <textarea value={formCheck.problemas} onChange={e => setFormCheck(f => ({ ...f, problemas: e.target.value }))} className={inputCls} style={inputStyle} rows={2} placeholder="Descreva problemas..." />
                            </Field>
                            <Field label="Necessidades / peças">
                                <textarea value={formCheck.necessidades} onChange={e => setFormCheck(f => ({ ...f, necessidades: e.target.value }))} className={inputCls} style={inputStyle} rows={2} placeholder="Pneus, peças, etc..." />
                            </Field>
                            <Field label="Observações livres">
                                <textarea value={formCheck.observacoes_livres} onChange={e => setFormCheck(f => ({ ...f, observacoes_livres: e.target.value }))} className={inputCls} style={inputStyle} rows={2} />
                            </Field>
                        </div>
                        <div className="flex gap-3 p-5 pt-0 justify-end">
                            <button onClick={() => setModalCheck(false)} className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50" style={{ borderColor: 'var(--color-border)' }}>Cancelar</button>
                            <button onClick={handleCheck} disabled={submittingCheck}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-opacity"
                                style={{ backgroundColor: 'var(--color-primary)', opacity: submittingCheck ? 0.7 : 1, cursor: submittingCheck ? 'not-allowed' : 'pointer' }}>
                                {submittingCheck ? (
                                    <>
                                        <div className="w-4 h-4 rounded-full border-2 border-white animate-spin" style={{ borderTopColor: 'transparent' }} />
                                        Enviando...
                                    </>
                                ) : (
                                    <>
                                        <Icon name="Send" size={15} color="white" /> Enviar
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <Toast toast={toast} />
        </div>
    );
}
