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
    fetchAbastecimentos, createAbastecimento, updateAbastecimento,
    fetchChecklists, createChecklist, updateChecklist, deleteChecklist,
    fetchRegistrosViagem, createRegistroViagem, updateRegistroViagem, deleteRegistroViagem,
    fetchConfigAbastecimento,
    fetchPostos,
    fetchNotificacoesCarreteiro, marcarNotificacaoLida,
    calcularBonusCarreteiro, BONUS_BAIXO, BONUS_ALTO, CIDADES_BONUS_BAIXO,
    CHECKLIST_ITENS,
    fetchCarregamentos, fetchBonificacoesExtras,
    fetchPontosParada, createPontoParada, updatePontoParada, deletePontoParada,
    fetchRomaneiosCarreteiro,
    createRomaneioFerragem,
    fetchEmpresas,
} from 'utils/carretasService';
import { useConfirm } from 'components/ui/ConfirmDialog';
import { supabase, subscribeTabela } from 'utils/supabaseClient';
import { fetchRomaneiosPorMotorista } from 'utils/romaneioService';
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
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)' }}
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
    const { confirm, ConfirmDialog } = useConfirm();
    const [tab, setTab]           = useState('viagens');
    const [period, setPeriod]     = useState(30);
    const [viagens, setViagens]   = useState([]);
    const [carregamentos, setCarregamentos] = useState([]);
    const [romaneiosPrincipais, setRomaneiosPrincipais] = useState([]);
    const [bonusExtras, setBonusExtras]     = useState([]);
    const [abast, setAbast]       = useState([]);
    const [checklists, setChecklists] = useState([]);
    const [veiculos, setVeiculos] = useState([]);
    const [postos, setPostos]     = useState([]);
    const [empresas, setEmpresas] = useState([]);
    const [loading, setLoading]   = useState(true);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [configAbast, setConfigAbast] = useState({ preco_diesel: 0, preco_arla: 0 });
    const [registros, setRegistros] = useState([]);
    const [notificacoes, setNotificacoes] = useState([]);
    const [pontosParada, setPontosParada] = useState([]);
    const [romaneiosCarreteiro, setRomaneiosCarreteiro] = useState([]);
    const [modalRegistro, setModalRegistro] = useState(false);
    const [editandoRegistroId, setEditandoRegistroId] = useState(null);
    const [formRegistro, setFormRegistro] = useState({ data_carregamento: new Date().toISOString().split('T')[0], numero_nota_fiscal: '', veiculo_id: '', destino: '', data_descarga: '', observacoes: '' });
    const [modalPonto, setModalPonto] = useState(false);
    const [editandoPontoId, setEditandoPontoId] = useState(null);
    const [formPonto, setFormPonto] = useState({
        local: '', tipo_local: 'Outro', veiculo_id: '',
        data_saida: new Date().toISOString().split('T')[0], horario_saida: '', km_saida: '',
        data_chegada: '', horario_chegada: '', km_chegada: '',
        cupom_fiscal: '', observacoes: '',
        horarios_extras: [],
    });
    // Modal romaneio de ferragens (registrado pelo motorista)
    const [modalFerragem, setModalFerragem] = useState(false);
    const [formFerragem, setFormFerragem] = useState({
        numero_nf: '', veiculo_id: '',
        data_saida: new Date().toISOString().split('T')[0],
        destino: '', toneladas: '', empresa: '', observacoes: '',
    });
    const [salvandoFerragem, setSalvandoFerragem] = useState(false);
    const [modalAbast, setModalAbast]   = useState(false);
    const [modalCheck, setModalCheck]   = useState(false);
    const [editandoAbastId, setEditandoAbastId] = useState(null);
    const [editandoCheckId, setEditandoCheckId] = useState(null);
    const [formAbast, setFormAbast]     = useState({ veiculo_id: '', data_abastecimento: new Date().toISOString().split('T')[0], horario: '', posto_id: '', posto: '', litros_diesel: '', valor_diesel: '', litros_arla: '', valor_arla: '', cupom_fiscal: '', observacoes: '' });
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
            const [v, a, c, ve, cfg, p, emps] = await Promise.all([
                fetchViagens({ motoristaId: user.id, dataInicio: dateStr }),
                fetchAbastecimentos({ motoristaId: user.id, dataInicio: dateStr }),
                fetchChecklists({ motoristaId: user.id }),
                fetchCarretasVeiculos(),
                fetchConfigAbastecimento(),
                fetchPostos().catch(() => []),
                fetchEmpresas().catch(() => []),
            ]);
            setViagens(v); setAbast(a); setChecklists(c); setVeiculos(ve);
            setPostos(p);
            setEmpresas(emps || []);
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

            // Romaneios do sistema principal atribuídos a este motorista
            try {
                // Tenta pelo serviço primeiro
                const roms = await fetchRomaneiosPorMotorista(user.id, profile?.name);
                setRomaneiosPrincipais(roms || []);
            } catch (eRom) {
                console.warn('[Carreteiro] fetchRomaneiosPorMotorista falhou, tentando query direta:', eRom?.message);
                // Fallback: query direta ao supabase
                try {
                    // Monta filtro: por nome E por UUID
                    const partes = [];
                    if (user?.id) partes.push('motorista_id.eq.' + user.id);
                    if (profile?.name) partes.push('motorista.ilike."' + profile.name + '"');
                    if (partes.length === 0) { setRomaneiosPrincipais([]); }
                    else {
                        const { data: romsDir, error: errDir } = await supabase
                            .from('romaneios')
                            .select('id, numero, motorista, motorista_id, placa, destino, status, saida, valor_frete, valor_frete_calculado, romaneio_pedidos(id, numero_pedido)')
                            .or(partes.join(','))
                            .order('created_at', { ascending: false });
                        if (errDir) { console.error('[Carreteiro] Query direta erro:', errDir); setRomaneiosPrincipais([]); }
                        else { console.log('[Carreteiro] Romaneios OK:', romsDir?.length); setRomaneiosPrincipais(romsDir || []); }
                    }
                } catch (e2) { console.error('[Carreteiro] Fallback falhou:', e2); setRomaneiosPrincipais([]); }
            }

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
            // Carrega pontos de parada
            try {
                const pontos = await fetchPontosParada(user.id);
                setPontosParada(pontos || []);
            } catch { setPontosParada([]); }
            // Carrega romaneios do admin vinculados a este motorista
            try {
                const roms = await fetchRomaneiosCarreteiro(user.id);
                setRomaneiosCarreteiro(roms || []);
            } catch { setRomaneiosCarreteiro([]); }
        } catch (e) { showToast('Erro ao carregar: ' + e.message, 'error'); }
        finally { setLoading(false); }
    }, [user?.id, period, profile?.name]); // eslint-disable-line

    useEffect(() => {
        load();
        // Realtime: atualiza automaticamente quando admin excluir viagem ou checklist
        const unsubViagens   = subscribeTabela('carretas_registros_viagem', load);
        const unsubChk       = subscribeTabela('carretas_checklists', load);
        const unsubCarreg    = subscribeTabela('carretas_carregamentos', load);
        const unsubRomaneios = subscribeTabela('romaneios', load);
        const unsubPontos    = subscribeTabela('carretas_pontos_parada', load);
        const unsubRomCar    = subscribeTabela('carretas_romaneios', load);
        return () => { unsubViagens(); unsubChk(); unsubCarreg(); unsubRomaneios(); unsubPontos(); unsubRomCar(); };
    }, [load]);

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
        if (!formAbast.cupom_fiscal?.trim()) { showToast('Informe o N° do cupom fiscal', 'error'); return; }
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
            if (editandoAbastId) {
                await updateAbastecimento(editandoAbastId, payload);
                showToast('Abastecimento atualizado!', 'success');
            } else {
                await createAbastecimento(payload);
                showToast('Abastecimento registrado!', 'success');
            }
            setModalAbast(false);
            setEditandoAbastId(null);
            load();
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };

    const handleEditAbast = (a) => {
        setEditandoAbastId(a.id);
        setFormAbast({
            veiculo_id: a.veiculo_id || '',
            data_abastecimento: a.data_abastecimento || new Date().toISOString().split('T')[0],
            horario: a.horario || '',
            posto_id: a.posto_id || '',
            posto: a.posto || '',
            litros_diesel: a.litros_diesel ?? '',
            valor_diesel: a.valor_diesel ?? '',
            litros_arla: a.litros_arla ?? '',
            valor_arla: a.valor_arla ?? '',
            observacoes: a.observacoes || '',
        });
        setModalAbast(true);
    };

    const handleCheck = async () => {
        if (!formCheck.veiculo_id) { showToast('Selecione o veículo', 'error'); return; }
        const semana = new Date(); semana.setDate(semana.getDate() - semana.getDay() + 1);
        try {
            if (editandoCheckId) {
                await updateChecklist(editandoCheckId, { ...formCheck });
                showToast('Checklist atualizado!', 'success');
                setEditandoCheckId(null);
            } else {
                await createChecklist({ ...formCheck, motorista_id: user.id, semana_ref: semana.toISOString().split('T')[0] });
                showToast('Checklist enviado para análise!', 'success');
            }
            setModalCheck(false);
            setFotoPreview(null);
            setFormCheck({ veiculo_id: '', itens: {}, problemas: '', necessidades: '', observacoes_livres: '', foto_url: '' });
            load();
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };

    const handleEditCheck = (c) => {
        setEditandoCheckId(c.id);
        setFormCheck({
            veiculo_id: c.veiculo_id || '',
            itens: c.itens || {},
            problemas: c.problemas || '',
            necessidades: c.necessidades || '',
            observacoes_livres: c.observacoes_livres || '',
            foto_url: c.foto_url || '',
        });
        setFotoPreview(c.foto_url || null);
        setModalCheck(true);
    };

    const handleDeleteChecklist = async (id) => {
        const ok = await confirm({ title: 'Excluir checklist?', message: 'Esta ação não pode ser desfeita.', confirmLabel: 'Excluir', variant: 'danger' });
        if (!ok) return;
        try { await deleteChecklist(id); showToast('Checklist excluído.', 'success'); load(); }
        catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };

    const handleDeleteRegistro = async (id) => {
        const ok = await confirm({ title: 'Excluir registro de viagem?', message: 'Esta ação não pode ser desfeita.', confirmLabel: 'Excluir', variant: 'danger' });
        if (!ok) return;
        try { await deleteRegistroViagem(id); showToast('Registro excluído.', 'success'); load(); }
        catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };

    const handleEditRegistro = (r) => {
        setEditandoRegistroId(r.id);
        setFormRegistro({
            data_carregamento: r.data_carregamento || new Date().toISOString().split('T')[0],
            numero_nota_fiscal: r.numero_nota_fiscal || '',
            veiculo_id: r.veiculo_id || '',
            destino: r.destino || '',
            data_descarga: r.data_descarga || '',
            observacoes: r.observacoes || '',
        });
        setModalRegistro(true);
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
        { id: 'romaneios',     label: 'Romaneios',         icon: 'FileText' },
        { id: 'pontos',        label: 'Pontos de Parada',  icon: 'MapPin' },
        { id: 'bonificacoes',  label: 'Bonificações',      icon: 'DollarSign' },
        { id: 'registros',     label: 'Registrar Viagem',  icon: 'FilePlus' },
        { id: 'abastecimentos',label: 'Abastecimentos',    icon: 'Fuel' },
        { id: 'checklist',     label: 'Checklist',         icon: 'ClipboardCheck' },
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
                                <button onClick={() => { setEditandoAbastId(null); setFormAbast({ veiculo_id: '', data_abastecimento: new Date().toISOString().split('T')[0], horario: '', posto_id: '', posto: '', litros_diesel: '', valor_diesel: '', litros_arla: '', valor_arla: '', cupom_fiscal: '', observacoes: '' }); setModalAbast(true); }}
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
                                <button onClick={() => { setEditandoCheckId(null); setFormCheck({ veiculo_id: '', itens: {}, problemas: '', necessidades: '', observacoes_livres: '' }); setModalCheck(true); }}
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
                                        <div className="flex flex-col gap-4">
                                            {/* ── Romaneios do Sistema Principal ─── */}
                                        {romaneiosPrincipais.length > 0 && (
                                                <div>
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#EFF6FF' }}>
                                                            <Icon name="FileText" size={14} color="#1D4ED8" />
                                                        </div>
                                                        <h3 className="font-heading font-semibold text-sm" style={{ color: 'var(--color-text-primary)' }}>
                                                            Romaneios Lançados pelo Admin
                                                        </h3>
                                                        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: '#EFF6FF', color: '#1D4ED8' }}>
                                                            {romaneiosPrincipais.length}
                                                        </span>
                                                    </div>
                                                    <div className="flex flex-col gap-2">
                                                        {romaneiosPrincipais.map(r => {
                                                            const nf = r.romaneio_pedidos?.[0]?.numero_pedido || '—';
                                                            const statusColors = {
                                                                'Aprovado': { bg: '#D1FAE5', text: '#065F46' },
                                                                'Pendente': { bg: '#FEF9C3', text: '#B45309' },
                                                                'Cancelado': { bg: '#FEE2E2', text: '#B91C1C' },
                                                            };
                                                            const sc = statusColors[r.status] || { bg: '#F3F4F6', text: '#6B7280' };
                                                            const frete = Number(r.valor_frete_calculado || r.valor_frete) || 0;
                                                            return (
                                                                <div key={r.id} className="bg-white rounded-xl border shadow-sm overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
                                                                    {/* Header do card */}
                                                                    <div className="flex items-center justify-between px-4 py-2.5 border-b" style={{ backgroundColor: '#F8FAFF', borderColor: '#DBEAFE' }}>
                                                                        <div className="flex items-center gap-2">
                                                                            <Icon name="FileText" size={14} color="#1D4ED8" />
                                                                            <span className="text-xs font-semibold font-data" style={{ color: '#1D4ED8' }}>
                                                                                Romaneio #{r.numero || r.id?.slice(0, 8)}
                                                                            </span>
                                                                        </div>
                                                                        <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: sc.bg, color: sc.text }}>
                                                                            {r.status || 'Pendente'}
                                                                        </span>
                                                                    </div>
                                                                    {/* Corpo do card — grid 2 colunas */}
                                                                    <div className="p-4 grid grid-cols-2 gap-x-4 gap-y-3">
                                                                        <div>
                                                                            <p className="text-xs mb-0.5" style={{ color: 'var(--color-muted-foreground)' }}>Nota Fiscal</p>
                                                                            <p className="text-sm font-semibold font-data" style={{ color: 'var(--color-text-primary)' }}>{nf}</p>
                                                                        </div>
                                                                        <div>
                                                                            <p className="text-xs mb-0.5" style={{ color: 'var(--color-muted-foreground)' }}>Valor do Frete</p>
                                                                            <p className="text-sm font-bold font-data text-purple-600">{frete > 0 ? BRL(frete) : '—'}</p>
                                                                        </div>
                                                                        <div>
                                                                            <p className="text-xs mb-0.5" style={{ color: 'var(--color-muted-foreground)' }}>Motorista</p>
                                                                            <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{r.motorista || '—'}</p>
                                                                        </div>
                                                                        <div>
                                                                            <p className="text-xs mb-0.5" style={{ color: 'var(--color-muted-foreground)' }}>Placa</p>
                                                                            <p className="text-sm font-semibold font-data" style={{ color: 'var(--color-text-primary)' }}>{r.placa || '—'}</p>
                                                                        </div>
                                                                        <div className="col-span-2">
                                                                            <p className="text-xs mb-0.5" style={{ color: 'var(--color-muted-foreground)' }}>Destino</p>
                                                                            <div className="flex items-center gap-1.5">
                                                                                <Icon name="MapPin" size={13} color="#1D4ED8" />
                                                                                <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{r.destino || '—'}</p>
                                                                            </div>
                                                                        </div>
                                                                        {r.saida && (
                                                                            <div className="col-span-2 pt-2 border-t flex items-center gap-1.5" style={{ borderColor: 'var(--color-border)' }}>
                                                                                <Icon name="Calendar" size={13} color="var(--color-muted-foreground)" />
                                                                                <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                                                                                    Saída: {FMT_DATE(r.saida)}
                                                                                </p>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}

                                            {/* ── Carregamentos (sistema de carretas) ─── */}
                                            <div>
                                                {(carregamentosComBonus.length > 0 || romaneiosPrincipais.length > 0) && (
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#D1FAE5' }}>
                                                            <Icon name="Package" size={14} color="#059669" />
                                                        </div>
                                                        <h3 className="font-heading font-semibold text-sm" style={{ color: 'var(--color-text-primary)' }}>Carregamentos</h3>
                                                        {carregamentosComBonus.length > 0 && (
                                                            <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: '#D1FAE5', color: '#065F46' }}>
                                                                {carregamentosComBonus.length}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                                {carregamentosComBonus.length === 0
                                                    ? (romaneiosPrincipais.length === 0
                                                        ? <div className="bg-white rounded-xl border p-8 flex flex-col items-center justify-center gap-2" style={{ borderColor: 'var(--color-border)' }}><Icon name="Package" size={28} color="var(--color-muted-foreground)" /><span className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Nenhuma viagem no período</span></div>
                                                        : null)
                                                    : carregamentosComBonus.map(c => (
                                                        <div key={c.id} className="bg-white rounded-xl border p-4 shadow-sm mb-2" style={{ borderColor: 'var(--color-border)' }}>
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
                                        </div>
                                    )}

                                    {tab === 'romaneios' && (
                                        <div className="flex flex-col gap-3">
                                            {/* Header informativo */}
                                            <div className="flex items-center gap-2 p-3 rounded-xl border"
                                                style={{ backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }}>
                                                <Icon name="Info" size={15} color="#1D4ED8" />
                                                <p className="text-xs" style={{ color: '#1D4ED8' }}>
                                                    Romaneios lançados pelo administrador e vinculados ao seu perfil.
                                                </p>
                                            </div>

                                            {romaneiosCarreteiro.length === 0 ? (
                                                <div className="bg-white rounded-xl border p-10 flex flex-col items-center justify-center gap-3"
                                                    style={{ borderColor: 'var(--color-border)' }}>
                                                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#EFF6FF' }}>
                                                        <Icon name="FileText" size={28} color="#1D4ED8" />
                                                    </div>
                                                    <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>Nenhum romaneio encontrado</p>
                                                    <p className="text-xs text-center" style={{ color: 'var(--color-muted-foreground)' }}>
                                                        Quando o admin lançar um romaneio para você, ele aparecerá aqui.
                                                    </p>
                                                </div>
                                            ) : romaneiosCarreteiro.map(r => {
                                                const STATUS_ROM = {
                                                    'Aguardando':        { bg: '#FEF9C3', text: '#B45309', icon: 'Clock' },
                                                    'Carregando':        { bg: '#FEF3C7', text: '#D97706', icon: 'Package' },
                                                    'Em Trânsito':       { bg: '#D1FAE5', text: '#065F46', icon: 'Truck' },
                                                    'Entrega finalizada':{ bg: '#DCFCE7', text: '#15803D', icon: 'CheckCircle2' },
                                                    'Cancelado':         { bg: '#FEE2E2', text: '#B91C1C', icon: 'XCircle' },
                                                };
                                                const sc = STATUS_ROM[r.status] || { bg: '#F3F4F6', text: '#6B7280', icon: 'FileText' };
                                                const itens = r.carretas_romaneio_itens || [];
                                                const pesoTotal = itens.reduce((s, i) => s + Number(i.peso_total || i.quantidade || 0), 0);
                                                const nfs = r.numero_nf || itens.map(i => i.descricao).filter(Boolean).join(', ');
                                                return (
                                                    <div key={r.id} className="bg-white rounded-xl border shadow-sm overflow-hidden"
                                                        style={{ borderColor: 'var(--color-border)' }}>
                                                        {/* Header */}
                                                        <div className="flex items-center justify-between px-4 py-3 border-b"
                                                            style={{ backgroundColor: '#F8FAFF', borderColor: '#DBEAFE' }}>
                                                            <div className="flex items-center gap-2">
                                                                <Icon name="FileText" size={15} color="#1D4ED8" />
                                                                <span className="font-semibold text-sm font-data" style={{ color: '#1D4ED8' }}>
                                                                    Romaneio #{r.numero}
                                                                </span>
                                                                {r.aprovado && (
                                                                    <span className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full font-medium"
                                                                        style={{ backgroundColor: '#D1FAE5', color: '#065F46' }}>
                                                                        <Icon name="CheckCircle2" size={10} />Aprovado
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium"
                                                                style={{ backgroundColor: sc.bg, color: sc.text }}>
                                                                <Icon name={sc.icon} size={11} />{r.status}
                                                            </span>
                                                        </div>

                                                        {/* Grid de informações */}
                                                        <div className="p-4 grid grid-cols-2 gap-x-4 gap-y-3">
                                                            {/* NF / Descrição */}
                                                            <div className="col-span-2">
                                                                <p className="text-xs mb-0.5" style={{ color: 'var(--color-muted-foreground)' }}>Nota(s) Fiscal / Carga</p>
                                                                <p className="text-sm font-semibold font-data" style={{ color: 'var(--color-text-primary)' }}>
                                                                    {nfs || '—'}
                                                                </p>
                                                            </div>

                                                            {/* Data saída */}
                                                            <div>
                                                                <p className="text-xs mb-0.5" style={{ color: 'var(--color-muted-foreground)' }}>Data Saída</p>
                                                                <div className="flex items-center gap-1">
                                                                    <Icon name="Calendar" size={13} color="#1D4ED8" />
                                                                    <p className="text-sm font-medium font-data" style={{ color: 'var(--color-text-primary)' }}>
                                                                        {r.data_saida ? FMT_DATE(r.data_saida) : '—'}
                                                                    </p>
                                                                </div>
                                                            </div>

                                                            {/* Peso total */}
                                                            <div>
                                                                <p className="text-xs mb-0.5" style={{ color: 'var(--color-muted-foreground)' }}>Peso / Toneladas</p>
                                                                <div className="flex items-center gap-1">
                                                                    <Icon name="Weight" size={13} color="#7C3AED" />
                                                                    <p className="text-sm font-semibold font-data" style={{ color: '#7C3AED' }}>
                                                                        {(pesoTotal || Number(r.toneladas) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} ton
                                                                    </p>
                                                                </div>
                                                            </div>

                                                            {/* Placa */}
                                                            <div>
                                                                <p className="text-xs mb-0.5" style={{ color: 'var(--color-muted-foreground)' }}>Placa</p>
                                                                <p className="text-sm font-semibold font-data" style={{ color: 'var(--color-text-primary)' }}>
                                                                    {r.veiculo?.placa || '—'}
                                                                </p>
                                                            </div>

                                                            {/* Empresa */}
                                                            {r.empresa && (
                                                                <div>
                                                                    <p className="text-xs mb-0.5" style={{ color: 'var(--color-muted-foreground)' }}>Empresa</p>
                                                                    <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{r.empresa}</p>
                                                                </div>
                                                            )}

                                                            {/* Destino */}
                                                            <div className="col-span-2">
                                                                <p className="text-xs mb-0.5" style={{ color: 'var(--color-muted-foreground)' }}>Destino</p>
                                                                <div className="flex items-center gap-1.5">
                                                                    <Icon name="MapPin" size={13} color="#1D4ED8" />
                                                                    <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{r.destino || '—'}</p>
                                                                </div>
                                                            </div>

                                                            {/* Frete */}
                                                            {Number(r.valor_frete) > 0 && (
                                                                <div className="col-span-2 pt-2 border-t flex items-center justify-between"
                                                                    style={{ borderColor: 'var(--color-border)' }}>
                                                                    <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>Valor do Frete</span>
                                                                    <span className="font-data font-bold text-emerald-600">{BRL(r.valor_frete)}</span>
                                                                </div>
                                                            )}

                                                            {/* Observações */}
                                                            {r.observacoes && (
                                                                <div className="col-span-2 pt-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
                                                                    <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>{r.observacoes}</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {tab === 'pontos' && (
                                        <div>
                                            <div className="flex justify-end mb-4">
                                                <Button onClick={() => {
                                                    setEditandoPontoId(null);
                                                    setFormPonto({
                                                        local: '', tipo_local: 'Outro', veiculo_id: '',
                                                        data_saida: new Date().toISOString().split('T')[0],
                                                        horario_saida: '', km_saida: '',
                                                        data_chegada: '', horario_chegada: '', km_chegada: '',
                                                        cupom_fiscal: '', observacoes: '',
                                                        horarios_extras: [],
                                                    });
                                                    setModalPonto(true);
                                                }} iconName="Plus" size="sm">
                                                    Novo Registro
                                                </Button>
                                            </div>

                                            {pontosParada.length === 0 ? (
                                                <div className="bg-white rounded-xl border p-10 flex flex-col items-center justify-center gap-3"
                                                    style={{ borderColor: 'var(--color-border)' }}>
                                                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#EFF6FF' }}>
                                                        <Icon name="MapPin" size={28} color="#1D4ED8" />
                                                    </div>
                                                    <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>Nenhum ponto de parada registrado</p>
                                                    <p className="text-xs text-center" style={{ color: 'var(--color-muted-foreground)' }}>
                                                        Registre os horários de saída e chegada em fábricas, estoques e entregas.
                                                    </p>
                                                </div>
                                            ) : (
                                                /* Tabela estilo planilha — horizontal scroll em mobile */
                                                <div className="rounded-xl border overflow-hidden shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
                                                    <div className="overflow-x-auto">
                                                        <table className="w-full text-xs" style={{ minWidth: 700 }}>
                                                            <thead>
                                                                <tr style={{ backgroundColor: '#1D4ED8' }}>
                                                                    {['KM/Destino','Data Saída','Hor. Saída','KM Saída','Data Chegada','Hor. Chegada','KM Chegada','Obs.',''].map(h => (
                                                                        <th key={h} className="px-3 py-2.5 text-left font-semibold text-white whitespace-nowrap">{h}</th>
                                                                    ))}
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {pontosParada.map((p, idx) => {
                                                                    const TIPO_COLOR = {
                                                                        'Fábrica': '#EFF6FF', 'Estoque': '#FEF9C3',
                                                                        'Entrega': '#D1FAE5', 'Posto': '#EDE9FE',
                                                                        'Oficina': '#FEE2E2', 'Outro': '#F3F4F6',
                                                                    };
                                                                    const TIPO_TEXT = {
                                                                        'Fábrica': '#1D4ED8', 'Estoque': '#B45309',
                                                                        'Entrega': '#065F46', 'Posto': '#7C3AED',
                                                                        'Oficina': '#B91C1C', 'Outro': '#6B7280',
                                                                    };
                                                                    return (
                                                                        <>
                                                                        <tr key={p.id}
                                                                            className="border-t transition-colors hover:bg-blue-50/30"
                                                                            style={{ borderColor: 'var(--color-border)', backgroundColor: idx % 2 === 0 ? 'white' : '#F9FAFB' }}>
                                                                            <td className="px-3 py-2.5">
                                                                                <div>
                                                                                    <p className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>{p.local}</p>
                                                                                    <span className="inline-block px-1.5 py-0.5 rounded text-xs font-medium mt-0.5"
                                                                                        style={{ backgroundColor: TIPO_COLOR[p.tipo_local] || '#F3F4F6', color: TIPO_TEXT[p.tipo_local] || '#6B7280' }}>
                                                                                        {p.tipo_local}
                                                                                    </span>
                                                                                    {p.veiculo?.placa && (
                                                                                        <p className="font-data text-xs mt-0.5" style={{ color: 'var(--color-muted-foreground)' }}>{p.veiculo.placa}</p>
                                                                                    )}
                                                                                </div>
                                                                            </td>
                                                                            <td className="px-3 py-2.5 font-data whitespace-nowrap" style={{ color: 'var(--color-text-primary)' }}>
                                                                                {p.data_saida ? FMT_DATE(p.data_saida) : '—'}
                                                                            </td>
                                                                            <td className="px-3 py-2.5 font-data whitespace-nowrap" style={{ color: 'var(--color-text-primary)' }}>
                                                                                {p.horario_saida || '—'}
                                                                            </td>
                                                                            <td className="px-3 py-2.5 font-data text-right" style={{ color: '#1D4ED8' }}>
                                                                                {p.km_saida != null ? Number(p.km_saida).toLocaleString('pt-BR') : '—'}
                                                                            </td>
                                                                            <td className="px-3 py-2.5 font-data whitespace-nowrap" style={{ color: 'var(--color-text-primary)' }}>
                                                                                {p.data_chegada ? FMT_DATE(p.data_chegada) : '—'}
                                                                            </td>
                                                                            <td className="px-3 py-2.5 font-data whitespace-nowrap" style={{ color: 'var(--color-text-primary)' }}>
                                                                                {p.horario_chegada || '—'}
                                                                            </td>
                                                                            <td className="px-3 py-2.5 font-data text-right" style={{ color: '#059669' }}>
                                                                                {p.km_chegada != null ? Number(p.km_chegada).toLocaleString('pt-BR') : '—'}
                                                                            </td>
                                                                            <td className="px-3 py-2.5 max-w-[120px] truncate" style={{ color: 'var(--color-muted-foreground)' }}
                                                                                title={p.observacoes}>
                                                                                {p.observacoes || ''}
                                                                            </td>
                                                                            <td className="px-2 py-2.5">
                                                                                <div className="flex items-center gap-1">
                                                                                    <button onClick={() => {
                                                                                        setEditandoPontoId(p.id);
                                                                                        setFormPonto({
                                                                                            local: p.local || '', tipo_local: p.tipo_local || 'Outro',
                                                                                            veiculo_id: p.veiculo_id || '',
                                                                                            data_saida: p.data_saida || '',
                                                                                            horario_saida: p.horario_saida || '', km_saida: p.km_saida ?? '',
                                                                                            data_chegada: p.data_chegada || '',
                                                                                            horario_chegada: p.horario_chegada || '', km_chegada: p.km_chegada ?? '',
                                                                                            cupom_fiscal: p.cupom_fiscal || '', observacoes: p.observacoes || '',
                                                                                            horarios_extras: p.horarios_extras || [],
                                                                                        });
                                                                                        setModalPonto(true);
                                                                                    }} className="p-1.5 rounded hover:bg-blue-50 transition-colors" title="Editar">
                                                                                        <Icon name="Pencil" size={13} color="#1D4ED8" />
                                                                                    </button>
                                                                                    <button onClick={async () => {
                                                                                        const ok = await confirm({ title: 'Excluir registro?', message: 'Esta ação não pode ser desfeita.', confirmLabel: 'Excluir', variant: 'danger' });
                                                                                        if (!ok) return;
                                                                                        try { await deletePontoParada(p.id); showToast('Registro excluído.', 'success'); load(); }
                                                                                        catch (e) { showToast('Erro: ' + e.message, 'error'); }
                                                                                    }} className="p-1.5 rounded hover:bg-red-50 transition-colors" title="Excluir">
                                                                                        <Icon name="Trash2" size={13} color="#DC2626" />
                                                                                    </button>
                                                                                </div>
                                                                            </td>
                                                                        </tr>
                                                                        {p.horarios_extras && p.horarios_extras.length > 0 && p.horarios_extras.map((ex, exIdx) => (
                                                                            <tr key={`${p.id}-extra-${exIdx}`} className="border-t" style={{ borderColor: '#E9D5FF', backgroundColor: '#FAF5FF' }}>
                                                                                <td className="px-3 py-1.5">
                                                                                    <span className="text-xs font-medium px-1.5 py-0.5 rounded" style={{ backgroundColor: '#E9D5FF', color: '#6D28D9' }}>Extra #{exIdx + 1}</span>
                                                                                </td>
                                                                                <td className="px-3 py-1.5 font-data text-xs whitespace-nowrap" style={{ color: '#6D28D9' }}>{ex.data_saida ? FMT_DATE(ex.data_saida) : '—'}</td>
                                                                                <td className="px-3 py-1.5 font-data text-xs" style={{ color: '#6D28D9' }}>{ex.horario_saida || '—'}</td>
                                                                                <td className="px-3 py-1.5 font-data text-xs text-right" style={{ color: '#1D4ED8' }}>{ex.km_saida != null ? Number(ex.km_saida).toLocaleString('pt-BR') : '—'}</td>
                                                                                <td className="px-3 py-1.5 font-data text-xs whitespace-nowrap" style={{ color: '#6D28D9' }}>{ex.data_chegada ? FMT_DATE(ex.data_chegada) : '—'}</td>
                                                                                <td className="px-3 py-1.5 font-data text-xs" style={{ color: '#6D28D9' }}>{ex.horario_chegada || '—'}</td>
                                                                                <td className="px-3 py-1.5 font-data text-xs text-right" style={{ color: '#059669' }}>{ex.km_chegada != null ? Number(ex.km_chegada).toLocaleString('pt-BR') : '—'}</td>
                                                                                <td colSpan={3} />
                                                                            </tr>
                                                                        ))}
                                                                    </>
                                                                    );
                                                                })}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                    <div className="px-4 py-2 border-t text-xs" style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)', backgroundColor: '#F9FAFB' }}>
                                                        {pontosParada.length} registro{pontosParada.length !== 1 ? 's' : ''}
                                                    </div>
                                                </div>
                                            )}
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
                                                        ? <div className="bg-white rounded-xl border p-6 flex flex-col items-center justify-center gap-2" style={{ borderColor: 'var(--color-border)' }}><Icon name="Package" size={24} color="var(--color-muted-foreground)" /><span className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Nenhum carregamento no período</span></div>
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
                                                        ? <div className="bg-white rounded-xl border p-6 flex flex-col items-center justify-center gap-2" style={{ borderColor: 'var(--color-border)' }}><Icon name="Award" size={24} color="var(--color-muted-foreground)" /><span className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Nenhuma bonificação extra no período</span></div>
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
                                            {/* Dois botões de ação separados */}
                                            <div className="grid grid-cols-1 gap-3 mb-5">
                                                <button onClick={() => { setEditandoRegistroId(null); setFormRegistro({ data_carregamento: new Date().toISOString().split('T')[0], numero_nota_fiscal: '', veiculo_id: '', destino: '', data_descarga: '', observacoes: '' }); setModalRegistro(true); }}
                                                    className="flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all hover:shadow-md active:scale-[0.99]"
                                                    style={{ borderColor: '#BFDBFE', backgroundColor: '#EFF6FF' }}>
                                                    <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#1D4ED8' }}>
                                                        <Icon name="Package" size={22} color="white" />
                                                    </div>
                                                    <div className="flex-1">
                                                        <p className="font-bold text-sm" style={{ color: '#1D4ED8' }}>Registrar Viagem de Cimento</p>
                                                        <p className="text-xs mt-0.5" style={{ color: '#3B82F6' }}>Nota fiscal, placa, destino e data de descarga</p>
                                                    </div>
                                                    <Icon name="ChevronRight" size={18} color="#1D4ED8" />
                                                </button>
                                                <button onClick={() => { setFormFerragem({ numero_nf: '', veiculo_id: '', data_saida: new Date().toISOString().split('T')[0], destino: '', toneladas: '', empresa: '', observacoes: '' }); setModalFerragem(true); }}
                                                    className="flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all hover:shadow-md active:scale-[0.99]"
                                                    style={{ borderColor: '#D1FAE5', backgroundColor: '#ECFDF5' }}>
                                                    <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#059669' }}>
                                                        <Icon name="FileText" size={22} color="white" />
                                                    </div>
                                                    <div className="flex-1">
                                                        <p className="font-bold text-sm" style={{ color: '#065F46' }}>Registrar Romaneio de Ferragens</p>
                                                        <p className="text-xs mt-0.5" style={{ color: '#059669' }}>NF, placa, destino, peso e empresa</p>
                                                    </div>
                                                    <Icon name="ChevronRight" size={18} color="#059669" />
                                                </button>
                                            </div>

                                            {registros.length > 0 && (
                                                <div>
                                                    <p className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: 'var(--color-muted-foreground)' }}>Viagens de Cimento</p>
                                                    <div className="flex flex-col gap-2">
                                                        {registros.map(r => (
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
                                                                <div className="flex justify-end gap-2 mt-3 pt-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
                                                                    <button onClick={() => handleDeleteRegistro(r.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-red-200 text-red-600 hover:bg-red-50">
                                                                        <Icon name="Trash2" size={13} />Excluir
                                                                    </button>
                                                                    <button onClick={() => handleEditRegistro(r)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-blue-200 text-blue-600 hover:bg-blue-50">
                                                                        <Icon name="Pencil" size={13} />Editar
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            {registros.length === 0 && (
                                                <div className="bg-white rounded-xl border p-8 flex flex-col items-center justify-center gap-2" style={{ borderColor: 'var(--color-border)' }}>
                                                    <Icon name="Navigation" size={28} color="var(--color-muted-foreground)" />
                                                    <span className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Nenhuma viagem registrada</span>
                                                </div>
                                            )}
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
                                                    ? <div className="bg-white rounded-xl border p-6 flex flex-col items-center justify-center gap-2" style={{ borderColor: 'var(--color-border)' }}><Icon name="Fuel" size={24} color="var(--color-muted-foreground)" /><span className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Nenhum abastecimento no período</span></div>
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
                                                            <div className="flex justify-end mt-2 pt-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
                                                                <button onClick={() => handleEditAbast(a)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-blue-200 text-blue-600 hover:bg-blue-50">
                                                                    <Icon name="Pencil" size={13} />Editar
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))
                                                }
                                            </div>
                                        </div>
                                    )}

                                    {tab === 'checklist' && (
                                        <div className="flex flex-col gap-4">
                                            {checklists.length === 0 && (
                                                <div className="flex flex-col items-center justify-center py-12 gap-2" style={{ color: 'var(--color-muted-foreground)' }}>
                                                    <Icon name="ClipboardCheck" size={32} color="var(--color-muted-foreground)" />
                                                    <span className="text-sm">Nenhum checklist enviado ainda</span>
                                                </div>
                                            )}
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
                                                        <div className="flex justify-end mt-3 pt-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
                                                            <button onClick={() => handleEditCheck(c)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-blue-200 text-blue-600 hover:bg-blue-50">
                                                                <Icon name="Pencil" size={13} />Editar
                                                            </button>
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
                <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center"
                    style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)' }}
                    onClick={e => e.target === e.currentTarget && setModalAbast(false)}>
                    <div className="bg-white w-full sm:rounded-2xl sm:max-w-xl sm:mx-4 rounded-t-2xl shadow-2xl flex flex-col" style={{ maxHeight: '92dvh' }}>
                        <div className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0"><div className="w-10 h-1 rounded-full bg-gray-300" /></div>
                        <div className="flex items-center justify-between p-5 border-b flex-shrink-0" style={{ borderColor: 'var(--color-border)' }}>
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#EFF6FF' }}>
                                    <Icon name="Fuel" size={18} color="#1D4ED8" />
                                </div>
                                <h2 className="font-heading font-bold text-lg" style={{ color: 'var(--color-text-primary)' }}>{editandoAbastId ? 'Editar Abastecimento' : 'Registrar Abastecimento'}</h2>
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
                            <Field label="N° do Cupom Fiscal" required>
                                <input
                                    type="text"
                                    value={formAbast.cupom_fiscal}
                                    onChange={e => setFormAbast(f => ({ ...f, cupom_fiscal: e.target.value }))}
                                    className={inputCls}
                                    style={inputStyle}
                                    placeholder="Ex: 000123456"
                                    maxLength={50}
                                />
                            </Field>
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
                            <button onClick={() => { setModalAbast(false); setEditandoAbastId(null); }} className="w-full sm:w-auto px-4 py-2.5 rounded-lg border text-sm font-medium hover:bg-gray-50 text-center" style={{ borderColor: 'var(--color-border)' }}>Cancelar</button>
                            <Button onClick={handleAbast} size="sm" iconName="Check">{editandoAbastId ? 'Salvar' : 'Registrar'}</Button>
                        </div>
                    </div>
                </div>
            )}

            {modalCheck && (
                <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center"
                    style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)' }}
                    onClick={e => e.target === e.currentTarget && setModalCheck(false)}>
                    <div className="bg-white w-full sm:rounded-2xl sm:max-w-lg sm:mx-4 rounded-t-2xl shadow-2xl flex flex-col" style={{ maxHeight: '95dvh' }}>
                        <div className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0"><div className="w-10 h-1 rounded-full bg-gray-300" /></div>
                        <div className="flex items-center justify-between p-5 border-b flex-shrink-0" style={{ borderColor: 'var(--color-border)' }}>
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#EFF6FF' }}>
                                    <Icon name="ClipboardCheck" size={18} color="#1D4ED8" />
                                </div>
                                <h2 className="font-heading font-bold text-lg" style={{ color: 'var(--color-text-primary)' }}>{editandoCheckId ? 'Editar Checklist' : 'Checklist Semanal'}</h2>
                            </div>
                            <button onClick={() => { setModalCheck(false); setFotoPreview(null); setEditandoCheckId(null); }} className="p-1.5 rounded-lg hover:bg-gray-100"><Icon name="X" size={18} color="var(--color-muted-foreground)" /></button>
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
                            <button onClick={() => { setModalCheck(false); setFotoPreview(null); setEditandoCheckId(null); }} className="w-full sm:w-auto px-4 py-2.5 rounded-lg border text-sm font-medium hover:bg-gray-50 text-center" style={{ borderColor: 'var(--color-border)' }}>Cancelar</button>
                            <Button onClick={handleCheck} size="sm" iconName={editandoCheckId ? 'Check' : 'Send'}>{editandoCheckId ? 'Salvar' : 'Enviar'}</Button>
                        </div>
                    </div>
                </div>
            )}

            {modalRegistro && (
                <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center"
                    style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)' }}
                    onClick={e => e.target === e.currentTarget && setModalRegistro(false)}>
                    <div className="bg-white w-full sm:rounded-2xl sm:max-w-lg sm:mx-4 rounded-t-2xl shadow-2xl flex flex-col" style={{ maxHeight: '92dvh' }}>
                        <div className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0"><div className="w-10 h-1 rounded-full bg-gray-300" /></div>
                        <div className="flex items-center justify-between p-5 border-b flex-shrink-0" style={{ borderColor: 'var(--color-border)' }}>
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#EFF6FF' }}>
                                    <Icon name="FilePlus" size={18} color="#1D4ED8" />
                                </div>
                                <h2 className="font-heading font-bold text-lg" style={{ color: 'var(--color-text-primary)' }}>{editandoRegistroId ? 'Editar Viagem' : 'Registrar Viagem'}</h2>
                            </div>
                            <button onClick={() => { setModalRegistro(false); setEditandoRegistroId(null); }} className="p-1.5 rounded-lg hover:bg-gray-100"><Icon name="X" size={18} color="var(--color-muted-foreground)" /></button>
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
                            <button onClick={() => { setModalRegistro(false); setEditandoRegistroId(null); }} className="w-full sm:w-auto px-4 py-2.5 rounded-lg border text-sm font-medium hover:bg-gray-50 text-center" style={{ borderColor: 'var(--color-border)' }}>Cancelar</button>
                            <Button onClick={async () => {
                                if (!formRegistro.data_carregamento || !formRegistro.destino) { showToast('Data e destino são obrigatórios', 'error'); return; }
                                try {
                                    if (editandoRegistroId) {
                                        await updateRegistroViagem(editandoRegistroId, { ...formRegistro });
                                        showToast('Viagem atualizada!', 'success');
                                    } else {
                                        await createRegistroViagem({ ...formRegistro, motorista_id: user.id });
                                        showToast('Viagem registrada!', 'success');
                                    }
                                    setEditandoRegistroId(null);
                                    setModalRegistro(false); load();
                                } catch (e) { showToast('Erro: ' + e.message, 'error'); }
                            }} size="sm" iconName="Check">{editandoRegistroId ? 'Salvar' : 'Registrar'}</Button>
                        </div>
                    </div>
                </div>
            )}

            {modalFerragem && (
                <ModalOverlay onClose={() => setModalFerragem(false)}>
                    <ModalHeader title="Romaneio de Ferragens" icon="FileText" onClose={() => setModalFerragem(false)} />
                    <div className="p-5 space-y-4 overflow-y-auto">
                        <div className="flex items-center gap-2 p-3 rounded-xl border" style={{ backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }}>
                            <Icon name="Info" size={14} color="#065F46" />
                            <p className="text-xs" style={{ color: '#065F46' }}>Este romaneio ficará visível para conferência do administrador.</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <Field label="Nº da Nota Fiscal" required>
                                <input value={formFerragem.numero_nf} onChange={e => setFormFerragem(f => ({ ...f, numero_nf: e.target.value }))}
                                    className={inputCls} style={inputStyle} placeholder="Ex: 395240" />
                            </Field>
                            <Field label="Data de Saída" required>
                                <input type="date" value={formFerragem.data_saida} onChange={e => setFormFerragem(f => ({ ...f, data_saida: e.target.value }))}
                                    className={inputCls} style={inputStyle} />
                            </Field>
                        </div>
                        <Field label="Veículo / Placa" required>
                            <select value={formFerragem.veiculo_id} onChange={e => setFormFerragem(f => ({ ...f, veiculo_id: e.target.value }))}
                                className={inputCls} style={inputStyle}>
                                <option value="">Selecione...</option>
                                {veiculos.map(v => <option key={v.id} value={v.id}>{v.placa} — {v.modelo}</option>)}
                            </select>
                        </Field>
                        <div className="grid grid-cols-2 gap-4">
                            <Field label="Destino" required>
                                <input value={formFerragem.destino} onChange={e => setFormFerragem(f => ({ ...f, destino: e.target.value }))}
                                    className={inputCls} style={inputStyle} placeholder="Cidade ou estoque" />
                            </Field>
                            <Field label="Peso (ton)">
                                <input type="number" step="0.001" value={formFerragem.toneladas} onChange={e => setFormFerragem(f => ({ ...f, toneladas: e.target.value }))}
                                    className={inputCls} style={inputStyle} placeholder="Ex: 5.920" />
                            </Field>
                        </div>
                        <Field label="Empresa / Fornecedor">
                            <select value={formFerragem.empresa} onChange={e => setFormFerragem(f => ({ ...f, empresa: e.target.value }))}
                                className={inputCls} style={inputStyle}>
                                <option value="">Selecione...</option>
                                {empresas.map(e => <option key={e.id} value={e.nome}>{e.nome}</option>)}
                            </select>
                        </Field>
                        <Field label="Observações">
                            <textarea value={formFerragem.observacoes} onChange={e => setFormFerragem(f => ({ ...f, observacoes: e.target.value }))}
                                className={inputCls} style={{ ...inputStyle, resize: 'vertical' }} rows={2} placeholder="Informações adicionais..." />
                        </Field>
                    </div>
                    <div className="flex gap-3 p-5 border-t justify-end" style={{ borderColor: 'var(--color-border)' }}>
                        <button onClick={() => setModalFerragem(false)} className="px-4 py-2.5 rounded-lg border text-sm font-medium hover:bg-gray-50" style={{ borderColor: 'var(--color-border)' }}>Cancelar</button>
                        <Button disabled={salvandoFerragem} onClick={async () => {
                            if (!formFerragem.numero_nf?.trim() || !formFerragem.data_saida || !formFerragem.destino?.trim() || !formFerragem.veiculo_id) {
                                showToast('NF, data, veículo e destino são obrigatórios', 'error'); return;
                            }
                            setSalvandoFerragem(true);
                            try {
                                await createRomaneioFerragem({
                                    numero_nf:    formFerragem.numero_nf,
                                    data_saida:   formFerragem.data_saida,
                                    veiculo_id:   formFerragem.veiculo_id,
                                    destino:      formFerragem.destino,
                                    toneladas:    formFerragem.toneladas ? Number(formFerragem.toneladas) : null,
                                    empresa:      formFerragem.empresa || null,
                                    observacoes:  formFerragem.observacoes || null,
                                    motorista_id: user.id,
                                });
                                showToast('Romaneio de ferragens registrado!', 'success');
                                setModalFerragem(false);
                            } catch (e) { showToast('Erro: ' + e.message, 'error'); }
                            finally { setSalvandoFerragem(false); }
                        }} size="sm" iconName="Check">
                            {salvandoFerragem ? 'Salvando...' : 'Registrar'}
                        </Button>
                    </div>
                </ModalOverlay>
            )}

            {modalPonto && (
                <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center"
                    style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)' }}
                    onClick={e => e.target === e.currentTarget && setModalPonto(false)}>
                    <div className="bg-white w-full sm:rounded-2xl sm:max-w-2xl sm:mx-4 rounded-t-2xl shadow-2xl flex flex-col" style={{ maxHeight: '94dvh' }}>
                        <div className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0"><div className="w-10 h-1 rounded-full bg-gray-300" /></div>
                        <div className="flex items-center justify-between p-5 border-b flex-shrink-0" style={{ borderColor: 'var(--color-border)' }}>
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#EFF6FF' }}>
                                    <Icon name="MapPin" size={18} color="#1D4ED8" />
                                </div>
                                <div>
                                    <h2 className="font-heading font-bold text-lg" style={{ color: 'var(--color-text-primary)' }}>
                                        {editandoPontoId ? 'Editar Ponto de Parada' : 'Novo Ponto de Parada'}
                                    </h2>
                                    <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>Registre saída e chegada no local</p>
                                </div>
                            </div>
                            <button onClick={() => { setModalPonto(false); setEditandoPontoId(null); }} className="p-1.5 rounded-lg hover:bg-gray-100">
                                <Icon name="X" size={18} color="var(--color-muted-foreground)" />
                            </button>
                        </div>

                        <div className="p-5 space-y-4 overflow-y-auto flex-1">
                            {/* Local e tipo */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <Field label="Local / Destino" required>
                                    <input
                                        value={formPonto.local}
                                        onChange={e => setFormPonto(f => ({ ...f, local: e.target.value }))}
                                        className={inputCls} style={inputStyle}
                                        placeholder="Ex: Fábrica Cachoeirinha, Estoque BA..."
                                    />
                                </Field>
                                <Field label="Tipo de Local">
                                    <select value={formPonto.tipo_local}
                                        onChange={e => setFormPonto(f => ({ ...f, tipo_local: e.target.value }))}
                                        className={inputCls} style={inputStyle}>
                                        {['Fábrica','Estoque','Entrega','Posto','Oficina','Outro'].map(t => (
                                            <option key={t} value={t}>{t}</option>
                                        ))}
                                    </select>
                                </Field>
                            </div>

                            <Field label="Veículo">
                                <select value={formPonto.veiculo_id}
                                    onChange={e => setFormPonto(f => ({ ...f, veiculo_id: e.target.value }))}
                                    className={inputCls} style={inputStyle}>
                                    <option value="">Selecione (opcional)...</option>
                                    {veiculos.map(v => <option key={v.id} value={v.id}>{v.placa} — {v.modelo}</option>)}
                                </select>
                            </Field>

                            {/* Bloco SAÍDA */}
                            <div className="p-4 rounded-xl border space-y-3"
                                style={{ borderColor: '#BFDBFE', backgroundColor: '#EFF6FF' }}>
                                <p className="text-xs font-bold flex items-center gap-1.5" style={{ color: '#1D4ED8' }}>
                                    <Icon name="LogOut" size={14} color="#1D4ED8" />SAÍDA
                                </p>
                                <div className="grid grid-cols-3 gap-3">
                                    <Field label="Data" required>
                                        <input type="date" value={formPonto.data_saida}
                                            onChange={e => setFormPonto(f => ({ ...f, data_saida: e.target.value }))}
                                            className={inputCls} style={inputStyle} />
                                    </Field>
                                    <Field label="Horário">
                                        <input type="time" value={formPonto.horario_saida}
                                            onChange={e => setFormPonto(f => ({ ...f, horario_saida: e.target.value }))}
                                            className={inputCls} style={inputStyle} />
                                    </Field>
                                    <Field label="KM Saída">
                                        <input type="number" value={formPonto.km_saida}
                                            onChange={e => setFormPonto(f => ({ ...f, km_saida: e.target.value }))}
                                            className={inputCls} style={inputStyle} placeholder="Ex: 641300" />
                                    </Field>
                                </div>
                            </div>

                            {/* Bloco CHEGADA */}
                            <div className="p-4 rounded-xl border space-y-3"
                                style={{ borderColor: '#A7F3D0', backgroundColor: '#ECFDF5' }}>
                                <p className="text-xs font-bold flex items-center gap-1.5" style={{ color: '#065F46' }}>
                                    <Icon name="LogIn" size={14} color="#065F46" />CHEGADA
                                </p>
                                <div className="grid grid-cols-3 gap-3">
                                    <Field label="Data">
                                        <input type="date" value={formPonto.data_chegada}
                                            onChange={e => setFormPonto(f => ({ ...f, data_chegada: e.target.value }))}
                                            className={inputCls} style={inputStyle} />
                                    </Field>
                                    <Field label="Horário">
                                        <input type="time" value={formPonto.horario_chegada}
                                            onChange={e => setFormPonto(f => ({ ...f, horario_chegada: e.target.value }))}
                                            className={inputCls} style={inputStyle} />
                                    </Field>
                                    <Field label="KM Chegada">
                                        <input type="number" value={formPonto.km_chegada}
                                            onChange={e => setFormPonto(f => ({ ...f, km_chegada: e.target.value }))}
                                            className={inputCls} style={inputStyle} placeholder="Ex: 642600" />
                                    </Field>
                                </div>
                            </div>

                            {/* Horários extras (saídas/chegadas adicionais no mesmo dia) */}
                            {formPonto.horarios_extras && formPonto.horarios_extras.length > 0 && formPonto.horarios_extras.map((extra, idx) => (
                                <div key={idx} className="rounded-xl border space-y-3" style={{ borderColor: '#E9D5FF', backgroundColor: '#FAF5FF' }}>
                                    <div className="flex items-center justify-between px-4 pt-3">
                                        <p className="text-xs font-bold" style={{ color: '#6D28D9' }}>PONTO EXTRA #{idx + 1}</p>
                                        <button type="button" onClick={() => setFormPonto(f => ({ ...f, horarios_extras: f.horarios_extras.filter((_, i) => i !== idx) }))}
                                            className="p-1 rounded hover:bg-red-50" title="Remover">
                                            <Icon name="X" size={14} color="#DC2626" />
                                        </button>
                                    </div>
                                    <div className="px-4 pb-3 space-y-3">
                                        {/* Local e Tipo */}
                                        <div className="grid grid-cols-2 gap-3">
                                            <Field label="Local / Destino" required>
                                                <input value={extra.local || ''} onChange={e => setFormPonto(f => { const h = [...f.horarios_extras]; h[idx] = { ...h[idx], local: e.target.value }; return { ...f, horarios_extras: h }; })}
                                                    className={inputCls} style={inputStyle} placeholder="Ex: Estoque Ibotirama..." />
                                            </Field>
                                            <Field label="Tipo de Local">
                                                <select value={extra.tipo_local || 'Outro'} onChange={e => setFormPonto(f => { const h = [...f.horarios_extras]; h[idx] = { ...h[idx], tipo_local: e.target.value }; return { ...f, horarios_extras: h }; })}
                                                    className={inputCls} style={inputStyle}>
                                                    {['Fábrica','Estoque','Entrega','Posto','Oficina','Outro'].map(t => (
                                                        <option key={t} value={t}>{t}</option>
                                                    ))}
                                                </select>
                                            </Field>
                                        </div>
                                        <div className="p-3 rounded-lg border space-y-2" style={{ borderColor: '#BFDBFE', backgroundColor: '#EFF6FF' }}>
                                            <p className="text-xs font-bold flex items-center gap-1" style={{ color: '#1D4ED8' }}><Icon name="LogOut" size={12} color="#1D4ED8" />SAÍDA</p>
                                            <div className="grid grid-cols-3 gap-2">
                                                <Field label="Data" required>
                                                    <input type="date" value={extra.data_saida || ''} onChange={e => setFormPonto(f => { const h = [...f.horarios_extras]; h[idx] = { ...h[idx], data_saida: e.target.value }; return { ...f, horarios_extras: h }; })} className={inputCls} style={inputStyle} />
                                                </Field>
                                                <Field label="Horário">
                                                    <input type="time" value={extra.horario_saida || ''} onChange={e => setFormPonto(f => { const h = [...f.horarios_extras]; h[idx] = { ...h[idx], horario_saida: e.target.value }; return { ...f, horarios_extras: h }; })} className={inputCls} style={inputStyle} />
                                                </Field>
                                                <Field label="KM Saída">
                                                    <input type="number" value={extra.km_saida || ''} onChange={e => setFormPonto(f => { const h = [...f.horarios_extras]; h[idx] = { ...h[idx], km_saida: e.target.value }; return { ...f, horarios_extras: h }; })} className={inputCls} style={inputStyle} placeholder="Ex: 641300" />
                                                </Field>
                                            </div>
                                        </div>
                                        <div className="p-3 rounded-lg border space-y-2" style={{ borderColor: '#A7F3D0', backgroundColor: '#ECFDF5' }}>
                                            <p className="text-xs font-bold flex items-center gap-1" style={{ color: '#065F46' }}><Icon name="LogIn" size={12} color="#065F46" />CHEGADA</p>
                                            <div className="grid grid-cols-3 gap-2">
                                                <Field label="Data">
                                                    <input type="date" value={extra.data_chegada || ''} onChange={e => setFormPonto(f => { const h = [...f.horarios_extras]; h[idx] = { ...h[idx], data_chegada: e.target.value }; return { ...f, horarios_extras: h }; })} className={inputCls} style={inputStyle} />
                                                </Field>
                                                <Field label="Horário">
                                                    <input type="time" value={extra.horario_chegada || ''} onChange={e => setFormPonto(f => { const h = [...f.horarios_extras]; h[idx] = { ...h[idx], horario_chegada: e.target.value }; return { ...f, horarios_extras: h }; })} className={inputCls} style={inputStyle} />
                                                </Field>
                                                <Field label="KM Chegada">
                                                    <input type="number" value={extra.km_chegada || ''} onChange={e => setFormPonto(f => { const h = [...f.horarios_extras]; h[idx] = { ...h[idx], km_chegada: e.target.value }; return { ...f, horarios_extras: h }; })} className={inputCls} style={inputStyle} placeholder="Ex: 642600" />
                                                </Field>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            <button type="button" onClick={() => setFormPonto(f => ({ ...f, horarios_extras: [...(f.horarios_extras || []), { local: '', tipo_local: 'Outro', data_saida: formPonto.data_saida || new Date().toISOString().split('T')[0], horario_saida: '', km_saida: '', data_chegada: '', horario_chegada: '', km_chegada: '' }] }))}
                                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed text-xs font-medium w-full justify-center hover:bg-purple-50 transition-colors"
                                style={{ borderColor: '#C4B5FD', color: '#6D28D9' }}>
                                <Icon name="Plus" size={14} color="#6D28D9" />
                                Adicionar mais um registro de saída e chegada
                            </button>

                            {/* Observações */}
                            <div>
                                <Field label="Observações">
                                    <input value={formPonto.observacoes}
                                        onChange={e => setFormPonto(f => ({ ...f, observacoes: e.target.value }))}
                                        className={inputCls} style={inputStyle} placeholder="Irregularidades, barulhos..." />
                                </Field>
                            </div>
                        </div>

                        <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 p-5 border-t flex-shrink-0 sm:justify-end"
                            style={{ borderColor: 'var(--color-border)' }}>
                            <button onClick={() => { setModalPonto(false); setEditandoPontoId(null); }}
                                className="w-full sm:w-auto px-4 py-2.5 rounded-lg border text-sm font-medium hover:bg-gray-50 text-center"
                                style={{ borderColor: 'var(--color-border)' }}>Cancelar</button>
                            <Button onClick={async () => {
                                if (!formPonto.local?.trim() || !formPonto.data_saida) {
                                    showToast('Local e data de saída são obrigatórios', 'error'); return;
                                }
                                const payload = {
                                    ...formPonto,
                                    motorista_id: user.id,
                                    km_saida: formPonto.km_saida !== '' ? Number(formPonto.km_saida) : null,
                                    km_chegada: formPonto.km_chegada !== '' ? Number(formPonto.km_chegada) : null,
                                    veiculo_id: formPonto.veiculo_id || null,
                                    data_chegada: formPonto.data_chegada || null,
                                    horario_saida: formPonto.horario_saida || null,
                                    horario_chegada: formPonto.horario_chegada || null,
                                    horarios_extras: (formPonto.horarios_extras || []).map(e => ({
                                        ...e,
                                        km_saida: e.km_saida !== '' && e.km_saida != null ? Number(e.km_saida) : null,
                                        km_chegada: e.km_chegada !== '' && e.km_chegada != null ? Number(e.km_chegada) : null,
                                        data_chegada: e.data_chegada || null,
                                        horario_saida: e.horario_saida || null,
                                        horario_chegada: e.horario_chegada || null,
                                    })),
                                };
                                try {
                                    if (editandoPontoId) {
                                        await updatePontoParada(editandoPontoId, payload);
                                        showToast('Registro atualizado!', 'success');
                                    } else {
                                        await createPontoParada(payload);
                                        showToast('Ponto de parada registrado!', 'success');
                                    }
                                    setModalPonto(false); setEditandoPontoId(null); load();
                                } catch (e) { showToast('Erro: ' + e.message, 'error'); }
                            }} size="sm" iconName="Check">
                                {editandoPontoId ? 'Salvar' : 'Registrar'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            <Toast toast={toast} />
            {ConfirmDialog}
        </div>
    );
}