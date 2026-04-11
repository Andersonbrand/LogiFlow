import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
    fetchRegistrosViagem, createRegistroViagem,
    fetchConfigAbastecimento,
    fetchPostos,
    fetchNotificacoesCarreteiro, marcarNotificacaoLida,
    calcularBonusCarreteiro, BONUS_BAIXO, BONUS_ALTO, CIDADES_BONUS_BAIXO,
    CHECKLIST_ITENS,
    fetchCarregamentos, fetchBonificacoesExtras,
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
    const [carregamentos, setCarregamentos] = useState([]);
    const [bonusExtras, setBonusExtras]     = useState([]);
    const [abast, setAbast]       = useState([]);
    const [checklists, setChecklists] = useState([]);
    const [veiculos, setVeiculos] = useState([]);
    const [postos, setPostos]     = useState([]);
    const [loading, setLoading]   = useState(true);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [configAbast, setConfigAbast] = useState({ preco_diesel: 0, preco_arla: 0 });
    const [registros, setRegistros] = useState([]);
    const [notificacoes, setNotificacoes] = useState([]);
    const [modalRegistro, setModalRegistro] = useState(false);
    const [formRegistro, setFormRegistro] = useState({ data_carregamento: new Date().toISOString().split('T')[0], numero_nota_fiscal: '', veiculo_id: '', destino: '', data_descarga: '', observacoes: '' });
    const [modalAbast, setModalAbast]   = useState(false);
    const [modalCheck, setModalCheck]   = useState(false);
    const [formAbast, setFormAbast]     = useState({ veiculo_id: '', data_abastecimento: new Date().toISOString().split('T')[0], horario: '', posto_id: '', posto: '', litros_diesel: '', valor_diesel: '', litros_arla: '', valor_arla: '', observacoes: '' });
    const [formCheck, setFormCheck]     = useState({ veiculo_id: '', itens: {}, problemas: '', necessidades: '', observacoes_livres: '', foto_url: '' });
    const [fotoPreview, setFotoPreview] = useState(null);
    const fotoRef = useRef(null);

    const handleFotoCheck = (e) => {
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

    const load = useCallback(async () => {
        if (!user?.id) return;
        setLoading(true);
        try {
            const cut = new Date();
            cut.setDate(cut.getDate() - period);
            const dateStr = cut.toISOString().split('T')[0];
            const [v, a, c, ve, cfg, p] = await Promise.all([
                fetchViagens({ motoristaId: user.id, dataInicio: dateStr }),
                fetchAbastecimentos({ motoristaId: user.id, dataInicio: dateStr }),
                fetchChecklists({ motoristaId: user.id }),
                fetchCarretasVeiculos(),
                fetchConfigAbastecimento(),
                fetchPostos().catch(() => []),
            ]);
            setViagens(v); setAbast(a); setChecklists(c); setVeiculos(ve);
            setPostos(p);
            setConfigAbast(cfg || { preco_diesel: 0, preco_arla: 0 });

            // Carregamentos do motorista (nova fonte de dados para viagens e bônus)
            try {
                const [carreg, extras] = await Promise.all([
                    fetchCarregamentos({ motoristaId: user.id, dataInicio: dateStr }),
                    fetchBonificacoesExtras({ motorista_id: user.id, dataInicio: dateStr }),
                ]);
                setCarregamentos(carreg || []);
                setBonusExtras(extras || []);
            } catch { setCarregamentos([]); setBonusExtras([]); }

            // Carrega registros de viagem do motorista
            try {
                const regs = await fetchRegistrosViagem(user.id);
                setRegistros(regs || []);
            } catch { setRegistros([]); }
            // Carrega notificações do carreteiro
            try {
                const notifs = await fetchNotificacoesCarreteiro(user.id);
                setNotificacoes(notifs || []);
            } catch { setNotificacoes([]); }
        } catch (e) { showToast('Erro ao carregar: ' + e.message, 'error'); }
        finally { setLoading(false); }
    }, [user?.id, period]); // eslint-disable-line

    useEffect(() => { load(); }, [load]);

    // Bônus por carregamentos (nova fonte)
    const carregamentosComBonus = useMemo(() =>
        carregamentos.map(c => ({ ...c, bonus: calcularBonusCarreteiro(c.destino) }))
    , [carregamentos]);

    // Manter compatibilidade com viagens para checklist e registros
    const viagensComBonus = useMemo(() =>
        viagens.map(v => ({
            ...v,
            bonus: v.status === 'Entrega finalizada' ? calcularBonusCarreteiro(v.destino) : 0,
        }))
    , [viagens]);

    const totalBonusViagens = useMemo(() =>
        carregamentosComBonus.reduce((s, c) => s + c.bonus, 0)
    , [carregamentosComBonus]);

    const totalBonusExtras = useMemo(() =>
        bonusExtras.reduce((s, e) => s + Number(e.valor || 0), 0)
    , [bonusExtras]);

    const totais = useMemo(() => ({
        viagens:     carregamentos.length,
        finalizadas: carregamentos.length, // todos os carregamentos são considerados finalizados
        emTransito:  viagens.filter(v => v.status === 'Em trânsito').length,
        totalBonus:  totalBonusViagens + totalBonusExtras,
        totalBonusViagens,
        totalBonusExtras,
        litrosDiesel: abast.reduce((s, a) => s + Number(a.litros_diesel || 0), 0),
        gastoTotal:   abast.reduce((s, a) => s + Number(a.valor_total || 0), 0),
    }), [carregamentos, viagens, totalBonusViagens, totalBonusExtras, abast]);

    // ── Preços: posto tem prioridade sobre config global ───────────────────────
    const getPrecoCarreteiro = useCallback((postoId, tipo) => {
        const posto = postos.find(p => p.id === postoId);
        if (tipo === 'diesel') return Number(posto?.preco_diesel || configAbast?.preco_diesel || 0);
        if (tipo === 'arla')   return Number(posto?.preco_arla   || configAbast?.preco_arla   || 0);
        return 0;
    }, [postos, configAbast]);

    const handlePostoChangeCarreteiro = (postoId) => {
        const posto = postos.find(p => p.id === postoId);
        const precoDiesel = getPrecoCarreteiro(postoId, 'diesel');
        const precoArla   = getPrecoCarreteiro(postoId, 'arla');
        setFormAbast(f => ({
            ...f,
            posto_id: postoId,
            posto: posto?.nome || '',
            valor_diesel: precoDiesel && f.litros_diesel
                ? (Number(f.litros_diesel) * precoDiesel).toFixed(2) : f.valor_diesel,
            valor_arla: precoArla && f.litros_arla
                ? (Number(f.litros_arla) * precoArla).toFixed(2) : f.valor_arla,
        }));
    };

    const handleLitrosCarreteiro = (campo, valor) => {
        setFormAbast(f => {
            const precoDiesel = getPrecoCarreteiro(f.posto_id, 'diesel');
            const precoArla   = getPrecoCarreteiro(f.posto_id, 'arla');
            const n = { ...f, [campo]: valor };
            if (campo === 'litros_diesel' && precoDiesel)
                n.valor_diesel = valor ? (Number(valor) * precoDiesel).toFixed(2) : '';
            if (campo === 'litros_arla' && precoArla)
                n.valor_arla = valor ? (Number(valor) * precoArla).toFixed(2) : '';
            return n;
        });
    };

    const handleAbast = async () => {
        if (!formAbast.veiculo_id || !formAbast.data_abastecimento) { showToast('Veículo e data são obrigatórios', 'error'); return; }
        const precoDiesel = getPrecoCarreteiro(formAbast.posto_id, 'diesel');
        const precoArla   = getPrecoCarreteiro(formAbast.posto_id, 'arla');
        const valorDiesel = formAbast.valor_diesel
            ? Number(formAbast.valor_diesel)
            : Number(formAbast.litros_diesel || 0) * precoDiesel;
        const valorArla = formAbast.valor_arla
            ? Number(formAbast.valor_arla)
            : Number(formAbast.litros_arla || 0) * precoArla;
        const payload = {
            ...formAbast,
            motorista_id: user.id,
            valor_diesel: valorDiesel.toFixed(2),
            valor_arla:   valorArla.toFixed(2),
        };
        if (!payload.posto_id) delete payload.posto_id;
        try {
            await createAbastecimento(payload);
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
            setFotoPreview(null);
            setFormCheck({ veiculo_id: '', itens: {}, problemas: '', necessidades: '', observacoes_livres: '', foto_url: '' });
            load();
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };

    const exportar = () => {
        if (!viagensComBonus.length) { showToast('Nenhum dado para exportar no período selecionado.', 'error'); return; }
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
        { id: 'viagens',       label: 'Minhas Viagens',   icon: 'Navigation' },
        { id: 'bonificacoes',  label: 'Bonificações',     icon: 'DollarSign' },
        { id: 'registros',     label: 'Registrar Viagem', icon: 'FilePlus' },
        { id: 'abastecimentos',label: 'Abastecimentos',   icon: 'Fuel' },
        { id: 'checklist',     label: 'Checklist',        icon: 'ClipboardCheck' },
    ];

    const tabAtual = TABS.find(t => t.id === tab);

    return (
        <div className="min-h-screen" style={{ backgroundColor: 'var(--color-background)' }}>
            <NavigationBar />
            <main className="main-content">
                <div className="max-w-screen-xl mx-auto">
                    <div className="flex">

                        {/* ── Sidebar desktop (lg+) ──────────────────────── */}
                        <aside className="hidden lg:flex flex-col flex-shrink-0 sticky top-[60px] h-[calc(100vh-60px)] overflow-y-auto border-r"
                            style={{ width: 210, borderColor: 'var(--color-border)', backgroundColor: 'var(--color-card)' }}>
                            <nav className="flex flex-col gap-1 p-3">
                                {/* Perfil */}
                                <div className="px-3 py-3 mb-2 border-b" style={{ borderColor: 'var(--color-border)' }}>
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-base flex-shrink-0"
                                            style={{ background: 'linear-gradient(135deg, #1D4ED8, #7C3AED)' }}>
                                            {(profile?.name || 'C')[0].toUpperCase()}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-semibold text-sm truncate" style={{ color: 'var(--color-text-primary)' }}>{profile?.name || 'Carreteiro'}</p>
                                            <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>Motorista</p>
                                        </div>
                                    </div>
                                </div>
                                {TABS.map(t => {
                                    const ativo = tab === t.id;
                                    return (
                                        <button key={t.id} onClick={() => setTab(t.id)}
                                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left"
                                            style={{
                                                backgroundColor: ativo ? 'var(--color-primary)' : 'transparent',
                                                color: ativo ? '#fff' : 'var(--color-muted-foreground)',
                                            }}>
                                            <Icon name={t.icon} size={16} color={ativo ? '#fff' : 'currentColor'} />
                                            <span>{t.label}</span>
                                        </button>
                                    );
                                })}
                                {/* Período no sidebar */}
                                <div className="mt-4 pt-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
                                    <p className="px-3 mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-muted-foreground)', fontSize: 10 }}>Período</p>
                                    <div className="flex flex-col gap-1 px-3">
                                        {PERIOD_OPTIONS.map(p => (
                                            <button key={p.days} onClick={() => setPeriod(p.days)}
                                                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors text-left"
                                                style={period === p.days
                                                    ? { backgroundColor: 'var(--color-primary)', color: '#fff' }
                                                    : { color: 'var(--color-muted-foreground)', backgroundColor: 'transparent' }}>
                                                {p.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </nav>
                        </aside>

                        {/* ── Conteúdo principal ─────────────────────────── */}
                        <div className="flex-1 min-w-0 px-3 sm:px-4 lg:px-6 py-4 sm:py-6">
                            <BreadcrumbTrail className="mb-4" />

                            {/* Header mobile */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-base lg:hidden"
                                        style={{ background: 'linear-gradient(135deg, #1D4ED8, #7C3AED)' }}>
                                        {(profile?.name || 'C')[0].toUpperCase()}
                                    </div>
                                    <div>
                                        <h1 className="font-heading font-bold text-lg sm:text-xl" style={{ color: 'var(--color-text-primary)' }}>
                                            Olá, {profile?.name || 'Carreteiro'}
                                        </h1>
                                        <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                                            {tabAtual?.label}
                                        </p>
                                    </div>
                                </div>
                                {/* Controles direita — mobile: hamburger + período; desktop: exportar */}
                                <div className="flex items-center gap-2 flex-wrap">
                                    {/* Período — apenas mobile/tablet (no desktop fica na sidebar) */}
                                    <div className="lg:hidden flex rounded-lg border overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
                                        {PERIOD_OPTIONS.map(p => (
                                            <button key={p.days} onClick={() => setPeriod(p.days)}
                                                className="px-2 sm:px-3 py-2 text-xs font-medium transition-colors"
                                                style={period === p.days ? { backgroundColor: 'var(--color-primary)', color: '#fff' } : { backgroundColor: 'white', color: 'var(--color-muted-foreground)' }}>
                                                {p.label}
                                            </button>
                                        ))}
                                    </div>
                                    <button onClick={exportar}
                                        className="flex items-center gap-1.5 px-2 sm:px-3 py-2 rounded-lg border text-xs font-medium hover:bg-gray-50"
                                        style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}>
                                        <Icon name="FileDown" size={14} color="currentColor" />
                                        <span className="hidden sm:inline">Exportar</span>
                                    </button>
                                    {/* Botão hamburger — apenas mobile/tablet */}
                                    <button onClick={() => setDrawerOpen(true)}
                                        className="lg:hidden flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium hover:bg-gray-50"
                                        style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}>
                                        <Icon name="Menu" size={16} color="currentColor" />
                                        <span className="hidden sm:inline">{tabAtual?.label}</span>
                                    </button>
                                </div>
                            </div>

                            {/* Notificações pendentes */}
                            {notificacoes.filter(n => !n.lida).length > 0 && (
                                <div className="flex flex-col gap-2 mb-4">
                                    {notificacoes.filter(n => !n.lida).map(n => (
                                        <div key={n.id} className="flex items-start gap-3 p-3 rounded-xl border shadow-sm"
                                            style={{ backgroundColor: n.tipo === 'checklist_aprovado' ? '#F0FDF4' : '#FEF2F2', borderColor: n.tipo === 'checklist_aprovado' ? '#BBF7D0' : '#FECACA' }}>
                                            <div className="flex-shrink-0 mt-0.5">
                                                <Icon name={n.tipo === 'checklist_aprovado' ? 'CheckCircle2' : 'AlertTriangle'} size={18} color={n.tipo === 'checklist_aprovado' ? '#059669' : '#DC2626'} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-semibold text-sm" style={{ color: n.tipo === 'checklist_aprovado' ? '#065F46' : '#991B1B' }}>{n.titulo}</p>
                                                <p className="text-xs mt-0.5" style={{ color: n.tipo === 'checklist_aprovado' ? '#059669' : '#DC2626' }}>{n.mensagem}</p>
                                            </div>
                                            <button onClick={async () => { await marcarNotificacaoLida(n.id); setNotificacoes(prev => prev.map(x => x.id === n.id ? { ...x, lida: true } : x)); }}
                                                className="flex-shrink-0 p-1 rounded hover:bg-black/10 transition-colors">
                                                <Icon name="X" size={14} color={n.tipo === 'checklist_aprovado' ? '#059669' : '#DC2626'} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* KPIs */}
                            <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-5">
                                {[
                                    { l: 'Carregamentos',    v: totais.viagens,            i: 'Package',      c: '#1D4ED8', bg: '#EFF6FF' },
                                    { l: 'Em Trânsito',      v: totais.emTransito,          i: 'Truck',        c: '#D97706', bg: '#FEF9C3' },
                                    { l: 'Bônus Viagens',    v: BRL(totais.totalBonusViagens), i: 'Award',     c: '#7C3AED', bg: '#EDE9FE' },
                                    { l: 'Bônus Extras',     v: BRL(totais.totalBonusExtras),  i: 'PlusCircle',c: '#D97706', bg: '#FFFBEB' },
                                    { l: 'Total a Receber',  v: BRL(totais.totalBonus),    i: 'DollarSign',   c: '#059669', bg: '#D1FAE5' },
                                ].map(k => (
                                    <div key={k.l} className="bg-white rounded-xl border p-3 sm:p-4 shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs font-caption" style={{ color: 'var(--color-muted-foreground)' }}>{k.l}</span>
                                            <div className="rounded-lg flex items-center justify-center" style={{ width: 28, height: 28, backgroundColor: k.bg }}>
                                                <Icon name={k.i} size={14} color={k.c} />
                                            </div>
                                        </div>
                                        <p className="text-lg sm:text-xl font-bold font-data" style={{ color: k.c }}>{k.v}</p>
                                    </div>
                                ))}
                            </div>

                            {/* Ações rápidas */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
                                <button onClick={() => { setFormAbast({ veiculo_id: '', data_abastecimento: new Date().toISOString().split('T')[0], horario: '', posto_id: '', posto: '', litros_diesel: '', valor_diesel: '', litros_arla: '', valor_arla: '', observacoes: '' }); setModalAbast(true); }}
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
                                <button onClick={() => { setFormCheck({ veiculo_id: '', itens: {}, problemas: '', necessidades: '', observacoes_livres: '' }); setModalCheck(true); }}
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
                                    {tab === 'viagens' && (
                                        <div className="flex flex-col gap-2">
                                            {carregamentosComBonus.length === 0
                                                ? <div className="bg-white rounded-xl border p-8 text-center text-sm" style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>Nenhum carregamento no período</div>
                                                : carregamentosComBonus.map(c => (
                                                    <div key={c.id} className="bg-white rounded-xl border p-4 shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
                                                        <div className="flex items-start justify-between mb-2">
                                                            <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{c.destino || '—'}</p>
                                                            <span className="font-data font-bold text-purple-600 text-sm">{BRL(c.bonus)}</span>
                                                        </div>
                                                        <div className="flex items-center justify-between text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                                                            <div className="flex items-center gap-3">
                                                                {c.data_carregamento && <span>{new Date(c.data_carregamento + 'T00:00:00').toLocaleDateString('pt-BR')}</span>}
                                                                {c.veiculo?.placa && <span className="font-data">{c.veiculo.placa}</span>}
                                                                {c.empresa?.nome && <span className="px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium">{c.empresa.nome}</span>}
                                                            </div>
                                                            <span className="font-data font-medium" style={{ color: 'var(--color-primary)' }}>
                                                                {(Number(c.quantidade) || 0).toLocaleString('pt-BR')} sacos
                                                            </span>
                                                        </div>
                                                        {c.numero_nota_fiscal && (
                                                            <p className="text-xs mt-1" style={{ color: 'var(--color-muted-foreground)' }}>NF: {c.numero_nota_fiscal}</p>
                                                        )}
                                                    </div>
                                                ))
                                            }
                                        </div>
                                    )}

                                    {tab === 'bonificacoes' && (
                                        <div className="flex flex-col gap-4">
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
                                                        ? <div className="bg-white rounded-xl border p-6 text-center text-sm" style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>Nenhum carregamento no período</div>
                                                        : carregamentosComBonus.map(c => (
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
                                            </div>

                                            {/* Bonificações extras */}
                                            <div>
                                                <p className="text-sm font-semibold px-1 mb-2" style={{ color: 'var(--color-text-secondary)' }}>Bonificações extras</p>
                                                <div className="flex flex-col gap-2">
                                                    {bonusExtras.length === 0
                                                        ? <div className="bg-white rounded-xl border p-6 text-center text-sm" style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>Nenhuma bonificação extra no período</div>
                                                        : bonusExtras.map(e => (
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
                                            </div>
                                        </div>
                                    )}

                                    {tab === 'registros' && (
                                        <div>
                                            <div className="flex justify-end mb-4">
                                                <Button onClick={() => { setFormRegistro({ data_carregamento: new Date().toISOString().split('T')[0], numero_nota_fiscal: '', veiculo_id: '', destino: '', data_descarga: '', observacoes: '' }); setModalRegistro(true); }} iconName="Plus" size="sm">
                                                    Nova Entrada
                                                </Button>
                                            </div>
                                            <div className="flex flex-col gap-2">
                                                {registros.length === 0
                                                    ? <div className="bg-white rounded-xl border p-8 text-center text-sm" style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>Nenhuma viagem registrada</div>
                                                    : registros.map(r => (
                                                        <div key={r.id} className="bg-white rounded-xl border p-4 shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
                                                            <div className="flex items-start justify-between mb-2">
                                                                <div>
                                                                    <p className="font-semibold text-sm" style={{ color: 'var(--color-text-primary)' }}>{r.destino || '—'}</p>
                                                                    <p className="text-xs font-data" style={{ color: 'var(--color-muted-foreground)' }}>{r.veiculo?.placa || '—'}</p>
                                                                </div>
                                                                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
                                                                    {r.data_carregamento ? new Date(r.data_carregamento + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}
                                                                </span>
                                                            </div>
                                                            <div className="flex flex-wrap gap-3 text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                                                                {r.numero_nota_fiscal && <span>NF: <strong>{r.numero_nota_fiscal}</strong></span>}
                                                                {r.data_descarga && <span>Descarga: <strong>{new Date(r.data_descarga + 'T00:00:00').toLocaleDateString('pt-BR')}</strong></span>}
                                                            </div>
                                                            {r.observacoes && <p className="text-xs mt-2 text-gray-500">{r.observacoes}</p>}
                                                        </div>
                                                    ))
                                                }
                                            </div>
                                        </div>
                                    )}

                                    {tab === 'abastecimentos' && (
                                        <div>
                                            <div className="grid grid-cols-2 gap-3 mb-4">
                                                <div className="bg-white rounded-xl border p-3 shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
                                                    <p className="text-xs mb-1" style={{ color: 'var(--color-muted-foreground)' }}>Diesel Total</p>
                                                    <p className="text-lg font-bold font-data text-blue-600">{totais.litrosDiesel.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} L</p>
                                                </div>
                                                <div className="bg-white rounded-xl border p-3 shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
                                                    <p className="text-xs mb-1" style={{ color: 'var(--color-muted-foreground)' }}>Gasto Total</p>
                                                    <p className="text-lg font-bold font-data text-purple-600">{BRL(totais.gastoTotal)}</p>
                                                </div>
                                            </div>
                                            <div className="flex flex-col gap-2">
                                                {abast.length === 0
                                                    ? <div className="bg-white rounded-xl border p-6 text-center text-sm" style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>Nenhum abastecimento no período</div>
                                                    : abast.map(a => (
                                                        <div key={a.id} className="bg-white rounded-xl border p-3 shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
                                                            <div className="flex items-center justify-between mb-1">
                                                                <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{FMT_DATE(a.data_abastecimento)}</span>
                                                                <span className="font-data font-bold text-purple-600">{BRL(a.valor_total)}</span>
                                                            </div>
                                                            <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                                                                <span className="font-data">{a.veiculo?.placa || '—'}</span>
                                                                {a.posto && <span>{a.posto}</span>}
                                                                <span className="text-blue-600">{Number(a.litros_diesel || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} L diesel</span>
                                                                {Number(a.litros_arla) > 0 && <span className="text-emerald-600">{Number(a.litros_arla).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} L arla</span>}
                                                            </div>
                                                        </div>
                                                    ))
                                                }
                                            </div>
                                        </div>
                                    )}

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
                    </div>
                </div>
            </main>

            {/* ── Drawer mobile/tablet (< lg) ──────────────────────────── */}
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
                                    {(profile?.name || 'C')[0].toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                    <p className="font-semibold text-sm truncate" style={{ color: 'var(--color-text-primary)' }}>{profile?.name || 'Carreteiro'}</p>
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
                                        style={{
                                            backgroundColor: ativo ? 'var(--color-primary)' : 'transparent',
                                            color: ativo ? '#fff' : 'var(--color-muted-foreground)',
                                        }}>
                                        <Icon name={t.icon} size={18} color={ativo ? '#fff' : 'currentColor'} />
                                        <span>{t.label}</span>
                                    </button>
                                );
                            })}
                        </nav>
                    </div>
                </>
            )}

            {/* Modais */}
            {modalAbast && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
                    style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
                    onClick={e => e.target === e.currentTarget && setModalAbast(false)}>
                    <div className="bg-white w-full sm:rounded-2xl sm:max-w-xl sm:mx-4 rounded-t-2xl shadow-2xl flex flex-col" style={{ maxHeight: '92dvh' }}>
                        <div className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0"><div className="w-10 h-1 rounded-full bg-gray-300" /></div>
                        <div className="flex items-center justify-between p-5 border-b flex-shrink-0" style={{ borderColor: 'var(--color-border)' }}>
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#EFF6FF' }}>
                                    <Icon name="Fuel" size={18} color="#1D4ED8" />
                                </div>
                                <h2 className="font-heading font-bold text-lg" style={{ color: 'var(--color-text-primary)' }}>Registrar Abastecimento</h2>
                            </div>
                            <button onClick={() => setModalAbast(false)} className="p-1.5 rounded-lg hover:bg-gray-100"><Icon name="X" size={18} color="var(--color-muted-foreground)" /></button>
                        </div>
                        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 overflow-y-auto flex-1">
                            <Field label="Veículo" required>
                                <select value={formAbast.veiculo_id} onChange={e => setFormAbast(f => ({ ...f, veiculo_id: e.target.value }))} className={inputCls} style={inputStyle}>
                                    <option value="">Selecione...</option>
                                    {veiculos.map(v => <option key={v.id} value={v.id}>{v.placa} — {v.modelo}</option>)}
                                </select>
                            </Field>
                            <Field label="Data" required><input type="date" value={formAbast.data_abastecimento} onChange={e => setFormAbast(f => ({ ...f, data_abastecimento: e.target.value }))} className={inputCls} style={inputStyle} /></Field>
                            <Field label="Horário"><input type="time" value={formAbast.horario} onChange={e => setFormAbast(f => ({ ...f, horario: e.target.value }))} className={inputCls} style={inputStyle} /></Field>
                            <Field label="Posto">
                                <select value={formAbast.posto_id} onChange={e => handlePostoChangeCarreteiro(e.target.value)} className={inputCls} style={inputStyle}>
                                    <option value="">Selecione o posto...</option>
                                    {postos.map(p => (
                                        <option key={p.id} value={p.id}>{p.nome}{p.cidade ? ` — ${p.cidade}` : ''}</option>
                                    ))}
                                </select>
                                {/* Preços efetivos do posto selecionado (ou padrão) */}
                                {(getPrecoCarreteiro(formAbast.posto_id, 'diesel') > 0 || getPrecoCarreteiro(formAbast.posto_id, 'arla') > 0) && (
                                    <div className="flex gap-3 mt-1 text-xs">
                                        {getPrecoCarreteiro(formAbast.posto_id, 'diesel') > 0 && (
                                            <span className="text-blue-600 font-medium">🛢️ R${getPrecoCarreteiro(formAbast.posto_id, 'diesel').toFixed(3)}/L</span>
                                        )}
                                        {getPrecoCarreteiro(formAbast.posto_id, 'arla') > 0 && (
                                            <span className="text-emerald-600 font-medium">💧 R${getPrecoCarreteiro(formAbast.posto_id, 'arla').toFixed(3)}/L</span>
                                        )}
                                    </div>
                                )}
                            </Field>
                            <div className="sm:col-span-2 p-3 rounded-xl border" style={{ borderColor: '#BFDBFE', backgroundColor: '#EFF6FF' }}>
                                <div className="flex items-center justify-between mb-2">
                                    <p className="text-xs font-semibold text-blue-700">🛢️ Diesel</p>
                                    {getPrecoCarreteiro(formAbast.posto_id, 'diesel') > 0 && (
                                        <span className="text-xs text-blue-600">R$ {getPrecoCarreteiro(formAbast.posto_id, 'diesel').toFixed(3)}/L</span>
                                    )}
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <Field label="Litros"><input type="number" step="0.01" value={formAbast.litros_diesel} onChange={e => handleLitrosCarreteiro('litros_diesel', e.target.value)} className={inputCls} style={inputStyle} placeholder="0,00" /></Field>
                                    <Field label="Valor calculado">
                                        <div className="px-3 py-2 rounded-lg border text-sm font-semibold" style={{ borderColor: 'var(--color-border)', backgroundColor: '#F0F9FF', color: '#1D4ED8' }}>
                                            {formAbast.valor_diesel
                                                ? Number(formAbast.valor_diesel).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                                                : 'R$ 0,00'}
                                        </div>
                                    </Field>
                                </div>
                            </div>
                            <div className="sm:col-span-2 p-3 rounded-xl border" style={{ borderColor: '#A7F3D0', backgroundColor: '#ECFDF5' }}>
                                <div className="flex items-center justify-between mb-2">
                                    <p className="text-xs font-semibold text-emerald-700">💧 ARLA 32</p>
                                    {getPrecoCarreteiro(formAbast.posto_id, 'arla') > 0 && (
                                        <span className="text-xs text-emerald-600">R$ {getPrecoCarreteiro(formAbast.posto_id, 'arla').toFixed(3)}/L</span>
                                    )}
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <Field label="Litros"><input type="number" step="0.01" value={formAbast.litros_arla} onChange={e => handleLitrosCarreteiro('litros_arla', e.target.value)} className={inputCls} style={inputStyle} placeholder="0,00" /></Field>
                                    <Field label="Valor calculado">
                                        <div className="px-3 py-2 rounded-lg border text-sm font-semibold" style={{ borderColor: 'var(--color-border)', backgroundColor: '#F0FDF4', color: '#059669' }}>
                                            {formAbast.valor_arla
                                                ? Number(formAbast.valor_arla).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                                                : 'R$ 0,00'}
                                        </div>
                                    </Field>
                                </div>
                            </div>
                            <div className="sm:col-span-2 p-2 rounded-lg text-sm font-bold flex items-center justify-between" style={{ backgroundColor: '#7C3AED', color: 'white' }}>
                                <span>Total do abastecimento:</span>
                                <span>{(Number(formAbast.valor_diesel || 0) + Number(formAbast.valor_arla || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                            </div>
                        </div>
                        <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 p-5 border-t flex-shrink-0 sm:justify-end" style={{ borderColor: 'var(--color-border)' }}>
                            <button onClick={() => setModalAbast(false)} className="w-full sm:w-auto px-4 py-2.5 rounded-lg border text-sm font-medium hover:bg-gray-50 text-center" style={{ borderColor: 'var(--color-border)' }}>Cancelar</button>
                            <Button onClick={handleAbast} size="sm" iconName="Check">Registrar</Button>
                        </div>
                    </div>
                </div>
            )}

            {modalCheck && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
                    style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
                    onClick={e => e.target === e.currentTarget && setModalCheck(false)}>
                    <div className="bg-white w-full sm:rounded-2xl sm:max-w-lg sm:mx-4 rounded-t-2xl shadow-2xl flex flex-col" style={{ maxHeight: '95dvh' }}>
                        <div className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0"><div className="w-10 h-1 rounded-full bg-gray-300" /></div>
                        <div className="flex items-center justify-between p-5 border-b flex-shrink-0" style={{ borderColor: 'var(--color-border)' }}>
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#EFF6FF' }}>
                                    <Icon name="ClipboardCheck" size={18} color="#1D4ED8" />
                                </div>
                                <h2 className="font-heading font-bold text-lg" style={{ color: 'var(--color-text-primary)' }}>Checklist Semanal</h2>
                            </div>
                            <button onClick={() => { setModalCheck(false); setFotoPreview(null); }} className="p-1.5 rounded-lg hover:bg-gray-100"><Icon name="X" size={18} color="var(--color-muted-foreground)" /></button>
                        </div>
                        <div className="p-5 space-y-4 overflow-y-auto flex-1">
                            <Field label="Veículo" required>
                                <select value={formCheck.veiculo_id} onChange={e => setFormCheck(f => ({ ...f, veiculo_id: e.target.value }))} className={inputCls} style={inputStyle}>
                                    <option value="">Selecione...</option>
                                    {veiculos.map(v => <option key={v.id} value={v.id}>{v.placa} — {v.modelo}</option>)}
                                </select>
                            </Field>

                            {/* Foto — topo do form, destaque visual */}
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
                                <input ref={fotoRef} type="file" accept="image/*" capture="environment" onChange={handleFotoCheck} className="hidden" />
                            </div>

                            <div>
                                <p className="text-xs font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>Itens verificados</p>
                                <div className="grid grid-cols-1 gap-2">
                                    {CHECKLIST_ITENS.map(item => (
                                        <label key={item.id} className="flex items-center gap-2 cursor-pointer p-2.5 rounded-lg border hover:bg-gray-50" style={{ borderColor: 'var(--color-border)' }}>
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
                        <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 p-5 border-t flex-shrink-0 sm:justify-end" style={{ borderColor: 'var(--color-border)' }}>
                            <button onClick={() => { setModalCheck(false); setFotoPreview(null); }} className="w-full sm:w-auto px-4 py-2.5 rounded-lg border text-sm font-medium hover:bg-gray-50 text-center" style={{ borderColor: 'var(--color-border)' }}>Cancelar</button>
                            <Button onClick={handleCheck} size="sm" iconName="Send">Enviar</Button>
                        </div>
                    </div>
                </div>
            )}

            {modalRegistro && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
                    style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
                    onClick={e => e.target === e.currentTarget && setModalRegistro(false)}>
                    <div className="bg-white w-full sm:rounded-2xl sm:max-w-lg sm:mx-4 rounded-t-2xl shadow-2xl flex flex-col" style={{ maxHeight: '92dvh' }}>
                        <div className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0"><div className="w-10 h-1 rounded-full bg-gray-300" /></div>
                        <div className="flex items-center justify-between p-5 border-b flex-shrink-0" style={{ borderColor: 'var(--color-border)' }}>
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#EFF6FF' }}>
                                    <Icon name="FilePlus" size={18} color="#1D4ED8" />
                                </div>
                                <h2 className="font-heading font-bold text-lg" style={{ color: 'var(--color-text-primary)' }}>Registrar Viagem</h2>
                            </div>
                            <button onClick={() => setModalRegistro(false)} className="p-1.5 rounded-lg hover:bg-gray-100"><Icon name="X" size={18} color="var(--color-muted-foreground)" /></button>
                        </div>
                        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 overflow-y-auto flex-1">
                            <div>
                                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Data de carregamento <span className="text-red-500">*</span></label>
                                <input type="date" value={formRegistro.data_carregamento} onChange={e => setFormRegistro(f => ({ ...f, data_carregamento: e.target.value }))} className={inputCls} style={inputStyle} />
                            </div>
                            <div>
                                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Nº da Nota Fiscal</label>
                                <input value={formRegistro.numero_nota_fiscal} onChange={e => setFormRegistro(f => ({ ...f, numero_nota_fiscal: e.target.value }))} className={inputCls} style={inputStyle} placeholder="Ex: 381469" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Placa do veículo <span className="text-red-500">*</span></label>
                                <select value={formRegistro.veiculo_id} onChange={e => setFormRegistro(f => ({ ...f, veiculo_id: e.target.value }))} className={inputCls} style={inputStyle}>
                                    <option value="">Selecione...</option>
                                    {veiculos.map(v => <option key={v.id} value={v.id}>{v.placa} — {v.modelo}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Destino da carga <span className="text-red-500">*</span></label>
                                <input value={formRegistro.destino} onChange={e => setFormRegistro(f => ({ ...f, destino: e.target.value }))} className={inputCls} style={inputStyle} placeholder="Estoque ou cidade" />
                            </div>
                            <div className="sm:col-span-2">
                                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Data de descarga</label>
                                <input type="date" value={formRegistro.data_descarga} onChange={e => setFormRegistro(f => ({ ...f, data_descarga: e.target.value }))} className={inputCls} style={inputStyle} />
                            </div>
                            <div className="sm:col-span-2">
                                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Observações</label>
                                <textarea value={formRegistro.observacoes} onChange={e => setFormRegistro(f => ({ ...f, observacoes: e.target.value }))} className={inputCls} style={inputStyle} rows={2} />
                            </div>
                        </div>
                        <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 p-5 border-t flex-shrink-0 sm:justify-end" style={{ borderColor: 'var(--color-border)' }}>
                            <button onClick={() => setModalRegistro(false)} className="w-full sm:w-auto px-4 py-2.5 rounded-lg border text-sm font-medium hover:bg-gray-50 text-center" style={{ borderColor: 'var(--color-border)' }}>Cancelar</button>
                            <Button onClick={async () => {
                                if (!formRegistro.data_carregamento || !formRegistro.destino) { showToast('Data e destino são obrigatórios', 'error'); return; }
                                try {
                                    await createRegistroViagem({ ...formRegistro, motorista_id: user.id });
                                    showToast('Viagem registrada!', 'success');
                                    setModalRegistro(false); load();
                                } catch (e) { showToast('Erro: ' + e.message, 'error'); }
                            }} size="sm" iconName="Check">Salvar</Button>
                        </div>
                    </div>
                </div>
            )}

            <Toast toast={toast} />
        </div>
    );
}