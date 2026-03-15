import React, { useState, useEffect, useCallback } from 'react';
import NavigationBar from 'components/ui/NavigationBar';
import BreadcrumbTrail from 'components/ui/BreadcrumbTrail';
import Button from 'components/ui/Button';
import Icon from 'components/AppIcon';
import Toast from 'components/ui/Toast';
import { useToast } from 'utils/useToast';
import { useAuth } from 'utils/AuthContext';
import { fetchAllUsers, updateUserProfile, fetchMaintenanceAlerts, resolveMaintenanceAlert } from 'utils/userService';
import { useRecarregarAoVoltar } from 'utils/useRecarregarAoVoltar';
import { fetchRomaneios, aprovarRomaneio, reprovarRomaneio } from 'utils/romaneioService';
import { fetchBonificacoesConsolidadas } from 'utils/bonificacaoService';
import { subscribeTabela } from 'utils/supabaseClient';
import { fetchCorredores, upsertCorredor, deleteCorredor, invalidarCache } from 'utils/corredoresService';
import { useNavigate } from 'react-router-dom';

const BRL = v => Number(v||0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const ROLE_CONFIG = {
    admin:      { label: 'Admin',      color: '#7C3AED', bg: '#EDE9FE' },
    operador:   { label: 'Operador',   color: '#1D4ED8', bg: '#DBEAFE' },
    motorista:  { label: 'Motorista',  color: '#065F46', bg: '#D1FAE5' },
    motorista_carreta: { label: 'Motorista (Carreta)', color: '#B45309', bg: '#FEF3C7' },
};

export default function AdminPanel() {
    const { profile, isAdmin } = useAuth();
    const navigate = useNavigate();
    const { toast, showToast } = useToast();
    const [users, setUsers]         = useState([]);
    const [alerts, setAlerts]       = useState([]);
    const [modalReprovar, setModalReprovar] = useState({ open: false, romaneio: null, motivo: '' });
    const [romaneios, setRomaneios] = useState([]);
    const [bonifs, setBonifs]       = useState([]);
    const [tab, setTab]             = useState('usuarios');
    const [loading, setLoading]     = useState(true);

    // ✅ FIX: useCallback garante referência estável para o hook useRecarregarAoVoltar
    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [u, a, rom] = await Promise.all([
                fetchAllUsers(),
                fetchMaintenanceAlerts(),
                fetchRomaneios(),
            ]);
            setUsers(u || []);
            setAlerts(a || []);
            setRomaneios((rom || []).filter(r => !r.aprovado && r.status !== 'Cancelado' && r.status_aprovacao !== 'reprovado'));
        } catch (err) {
            showToast('Erro ao carregar dados: ' + err.message, 'error');
        }
        try {
            const bon = await fetchBonificacoesConsolidadas();
            setBonifs(bon || []);
        } catch {
            setBonifs([]);
        } finally {
            setLoading(false);
        }
    }, []); // eslint-disable-line

    // ✅ FIX: useEffect e useRecarregarAoVoltar no nível raiz do componente
    useEffect(() => {
        if (profile && !isAdmin()) { navigate('/'); return; }
        if (profile) load();
    }, [profile]); // eslint-disable-line

    // Realtime: bonificações e aprovações atualizam sem precisar de refresh
    useEffect(() => {
        const unsubRom      = subscribeTabela('romaneios', load);
        const unsubProfiles = subscribeTabela('user_profiles', load);
        const unsubBonif    = subscribeTabela('bonificacoes', load);
        return () => { unsubRom(); unsubProfiles(); unsubBonif(); };
    }, []);

    useRecarregarAoVoltar(load);

    const handleRoleChange = async (userId, role) => {
        try {
            // Se tornando carreteiro, seta tipo_veiculo=carreta; se motorista, seta caminhao
            // motorista_carreta é apenas UI — o role real é 'motorista' com tipo_veiculo='carreta'
            const realRole = role === 'motorista_carreta' ? 'motorista' : role;
            const extra = role === 'motorista_carreta' ? { tipo_veiculo: 'carreta' }
                        : role === 'motorista'           ? { tipo_veiculo: 'caminhao' }
                        : {};
            await updateUserProfile(userId, { role: realRole, ...extra });
            setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: realRole, ...extra } : u));
            showToast('Permissão atualizada!', 'success');
        } catch (err) {
            showToast('Erro: ' + err.message, 'error');
        }
    };

    const handleAprovar = async (romaneio) => {
        try {
            await aprovarRomaneio(romaneio.id, profile?.id);
            setRomaneios(prev => prev.filter(r => r.id !== romaneio.id));
            showToast(`Romaneio ${romaneio.numero} aprovado!`, 'success');
        } catch (err) {
            showToast('Erro ao aprovar: ' + err.message, 'error');
        }
    };

    const handleReprovar = (romaneio) => {
        setModalReprovar({ open: true, romaneio, motivo: '' });
    };

    const confirmarReprovacao = async () => {
        const { romaneio, motivo } = modalReprovar;
        if (!motivo.trim()) { showToast('Informe o motivo da reprovação.', 'error'); return; }
        try {
            await reprovarRomaneio(romaneio.id, profile?.id, motivo.trim());
            setRomaneios(prev => prev.filter(r => r.id !== romaneio.id));
            setModalReprovar({ open: false, romaneio: null, motivo: '' });
            showToast(`Romaneio ${romaneio.numero} reprovado.`, 'success');
        } catch (err) {
            showToast('Erro ao reprovar: ' + err.message, 'error');
        }
    };

    const handleResolveAlert = async (id) => {
        try {
            await resolveMaintenanceAlert(id);
            setAlerts(prev => prev.filter(a => a.id !== id));
            showToast('Alerta resolvido!', 'success');
        } catch (err) {
            showToast('Erro: ' + err.message, 'error');
        }
    };

    const TABS = [
        { id: 'usuarios',    label: 'Usuários',    icon: 'Users' },
        { id: 'aprovacoes',  label: 'Aprovações',  icon: 'CheckSquare', badge: romaneios.length || null },
        { id: 'alertas',     label: 'Alertas',     icon: 'AlertTriangle', badge: alerts.length || null },
        { id: 'bonificacoes',label: 'Bonificações',icon: 'Award' },
        { id: 'corredores',  label: 'Corredores',  icon: 'Map' },
    ];

    if (loading) return (
        <div className="min-h-screen" style={{ backgroundColor: 'var(--color-background)' }}>
            <NavigationBar />
            <div className="flex items-center justify-center h-64">
                <div className="flex flex-col items-center gap-3">
                    <svg className="animate-spin h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    <p className="text-sm text-slate-500">Carregando painel admin...</p>
                </div>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen" style={{ backgroundColor: 'var(--color-background)' }}>
            <NavigationBar />
            <main className="main-content">
                <div className="border-b border-slate-200 bg-white">
                    <div className="max-w-screen-xl mx-auto px-4 md:px-6 py-4 flex items-center justify-between">
                        <div>
                            <BreadcrumbTrail items={[{ label: 'Dashboard', path: '/' }, { label: 'Administração' }]} />
                            <h1 className="text-xl font-bold text-slate-800 mt-1">Painel Administrativo</h1>
                        </div>
                        <Button variant="outline" iconName="RefreshCw" iconSize={15} onClick={load}>
                            Atualizar
                        </Button>
                    </div>
                </div>

                <div className="max-w-screen-xl mx-auto px-4 md:px-6 py-6 space-y-6">
                    {/* Tabs */}
                    <div className="flex gap-1 bg-slate-100 rounded-lg p-1 overflow-x-auto">
                        {TABS.map(t => (
                            <button key={t.id} onClick={() => { setTab(t.id); if (t.id === 'bonificacoes') load(); }}
                                className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs sm:text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 ${tab === t.id ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>
                                <Icon name={t.icon} size={14} color="currentColor" />
                                <span className="hidden xs:inline">{t.label}</span>
                                {t.badge ? <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">{t.badge}</span> : null}
                            </button>
                        ))}
                    </div>

                    {/* ── ABA USUÁRIOS ─────────────────────────────────────── */}
                    {tab === 'usuarios' && (
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
                                <Icon name="Users" size={18} color="#1D4ED8" />
                                <h2 className="text-base font-semibold text-slate-800">Usuários do Sistema</h2>
                                <span className="ml-auto text-xs text-slate-400">{users.length} usuários</span>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-50">
                                        <tr>
                                            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Nome</th>
                                            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden sm:table-cell">Email</th>
                                            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Perfil</th>
                                            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Alterar</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {users.length === 0 ? (
                                            <tr><td colSpan={4} className="text-center py-8 text-slate-400">Nenhum usuário encontrado</td></tr>
                                        ) : users.map(u => (
                                            <tr key={u.id} className="hover:bg-slate-50">
                                                <td className="px-4 py-3">
                                                    <p className="font-medium text-slate-800 text-xs">{u.name || '—'}</p>
                                                    <p className="text-slate-400 text-xs sm:hidden truncate max-w-[120px]">{u.email || ''}</p>
                                                </td>
                                                <td className="px-4 py-3 text-slate-500 text-xs hidden sm:table-cell">{u.email || '—'}</td>
                                                <td className="px-4 py-3">
                                                    {(() => {
                                                        const key = (u.role === 'motorista' && u.tipo_veiculo === 'carreta') ? 'motorista_carreta' : u.role;
                                                        const cfg = ROLE_CONFIG[key];
                                                        return cfg
                                                            ? <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ color: cfg.color, backgroundColor: cfg.bg }}>{cfg.label}</span>
                                                            : <span className="text-slate-400 text-xs">{u.role}</span>;
                                                    })()}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <select
                                                        value={(u.role === 'motorista' && u.tipo_veiculo === 'carreta') ? 'motorista_carreta' : (u.role || 'operador')}
                                                        onChange={e => handleRoleChange(u.id, e.target.value)}
                                                        className="text-xs border border-slate-200 rounded px-2 py-1 bg-white text-slate-700">
                                                        <option value="admin">Admin</option>
                                                        <option value="operador">Operador</option>
                                                        <option value="motorista">Motorista (Caminhão)</option>
                                                        <option value="motorista_carreta">Motorista (Carreta)</option>
                                                    </select>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* ── ABA APROVAÇÕES ───────────────────────────────────── */}
                    {tab === 'aprovacoes' && (
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
                                <Icon name="CheckSquare" size={18} color="#1D4ED8" />
                                <h2 className="text-base font-semibold text-slate-800">Romaneios Pendentes de Aprovação</h2>
                                <span className="ml-auto text-xs text-slate-400">{romaneios.length} pendentes</span>
                            </div>
                            {romaneios.length === 0 ? (
                                <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
                                    <Icon name="CheckCircle2" size={36} color="#86EFAC" />
                                    <p className="text-sm">Nenhum romaneio pendente de aprovação</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-slate-50">
                                            <tr>
                                                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Número</th>
                                                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Motorista</th>
                                                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Destino</th>
                                                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden lg:table-cell">Peso</th>
                                                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden sm:table-cell">Status</th>
                                                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Ações</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {romaneios.map(r => (
                                                <tr key={r.id} className="hover:bg-slate-50">
                                                    <td className="px-4 py-3">
                                                        <p className="font-mono font-semibold text-slate-800 text-xs">{r.numero}</p>
                                                        <p className="text-xs text-slate-400 sm:hidden">{r.status}</p>
                                                    </td>
                                                    <td className="px-4 py-3 text-slate-700 text-xs">
                                                        <p>{r.motorista || '—'}</p>
                                                        <p className="text-slate-400 md:hidden text-xs">{r.destino || ''}</p>
                                                    </td>
                                                    <td className="px-4 py-3 text-slate-500 text-xs hidden md:table-cell">{r.destino || '—'}</td>
                                                    <td className="px-4 py-3 text-slate-500 text-xs hidden lg:table-cell">{Number(r.peso_total||0).toLocaleString('pt-BR')} kg</td>
                                                    <td className="px-4 py-3 hidden sm:table-cell">
                                                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                                                            {r.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                            <button onClick={() => handleAprovar(r)}
                                                                className="text-xs bg-green-600 text-white px-2.5 py-1 rounded-lg hover:bg-green-700 transition-colors font-semibold">
                                                                ✓ Aprovar
                                                            </button>
                                                            <button onClick={() => handleReprovar(r)}
                                                                className="text-xs bg-red-500 text-white px-2.5 py-1 rounded-lg hover:bg-red-600 transition-colors font-semibold">
                                                                ✕ Reprovar
                                                            </button>
                                                            <button onClick={() => navigate('/romaneios')}
                                                                className="text-xs text-blue-600 underline hover:text-blue-800 hidden sm:inline">
                                                                Ver
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div> 

                        
                    )}

                    {/* ── ABA ALERTAS ──────────────────────────────────────── */}
                    {tab === 'alertas' && (
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
                                <Icon name="AlertTriangle" size={18} color="#D97706" />
                                <h2 className="text-base font-semibold text-slate-800">Alertas de Manutenção</h2>
                                <span className="ml-auto text-xs text-slate-400">{alerts.length} alertas</span>
                            </div>
                            {alerts.length === 0 ? (
                                <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
                                    <Icon name="CheckCircle2" size={36} color="#86EFAC" />
                                    <p className="text-sm">Nenhum alerta ativo</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-100">
                                    {alerts.map(a => (
                                        <div key={a.id} className="flex items-start gap-4 p-4 hover:bg-slate-50">
                                            <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                                <Icon name="AlertTriangle" size={16} color="#D97706" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-slate-800">{a.vehicles?.placa} — {a.tipo}</p>
                                                <p className="text-xs text-slate-500 mt-0.5">{a.mensagem}</p>
                                            </div>
                                            <button onClick={() => handleResolveAlert(a.id)}
                                                className="flex-shrink-0 text-xs font-medium text-green-600 hover:text-green-800 underline">
                                                Resolver
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── ABA BONIFICAÇÕES ─────────────────────────────────── */}
                    {tab === 'bonificacoes' && (
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <Icon name="Award" size={18} color="#D97706" />
                                    <h2 className="text-base font-semibold text-slate-800">Bonificações dos Motoristas</h2>
                                </div>

                            </div>
                            {bonifs.length === 0 ? (
                                <div className="py-12 flex flex-col items-center justify-center gap-1.5 text-slate-400">
                                    <Icon name="Award" size={36} color="#CBD5E1" />
                                    <p className="text-sm">Nenhuma bonificação calculada ainda</p>
                                    <p className="text-xs text-slate-300">Aprove romaneios para que as bonificações apareçam aqui</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-slate-50">
                                            <tr>
                                                {['Motorista', 'Viagens', 'Peso Total', 'Bonificação'].map(h => (
                                                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {bonifs.map((b, i) => (
                                                <tr key={i} className="hover:bg-slate-50">
                                                    <td className="px-4 py-3 font-medium text-slate-800">{b.motorista}</td>
                                                    <td className="px-4 py-3 text-slate-600">{b.total_viagens}</td>
                                                    <td className="px-4 py-3 text-slate-600">{Number(b.peso_total||0).toLocaleString('pt-BR')} kg</td>
                                                    <td className="px-4 py-3 font-semibold text-green-700">{BRL(b.bonificacao_total)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── ABA CORREDORES ─────────────────────────────────── */}
                    {tab === 'corredores' && (
                        <CorredoresManager showToast={showToast} />
                    )}
                </div>
            </main>
            <Toast toast={toast} />

            {/* ── MODAL DE REPROVAÇÃO ──────────────────────────────────────── */}
            {modalReprovar.open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    style={{ backgroundColor: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(2px)' }}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
                        style={{ border: '1px solid #FEE2E2' }}>

                        {/* Header */}
                        <div className="flex items-center gap-3 px-6 py-4"
                            style={{ background: 'linear-gradient(135deg, #FEF2F2, #FFF5F5)', borderBottom: '1px solid #FEE2E2' }}>
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                                style={{ backgroundColor: '#FEE2E2' }}>
                                <Icon name="XCircle" size={22} color="#DC2626" />
                            </div>
                            <div>
                                <h3 className="font-bold text-base" style={{ color: '#1E293B' }}>
                                    Reprovar Romaneio
                                </h3>
                                <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>
                                    Romaneio <strong style={{ color: '#DC2626' }}>#{modalReprovar.romaneio?.numero}</strong> — {modalReprovar.romaneio?.motorista}
                                </p>
                            </div>
                        </div>

                        {/* Body */}
                        <div className="px-6 py-5">
                            <div className="flex gap-2 p-3 rounded-xl mb-4"
                                style={{ backgroundColor: '#FFFBEB', border: '1px solid #FDE68A' }}>
                                <Icon name="TriangleAlert" size={16} color="#D97706" />
                                <p className="text-xs leading-relaxed" style={{ color: '#78350F' }}>
                                    O operador verá o motivo da reprovação e receberá instruções para corrigir ou refazer o romaneio.
                                </p>
                            </div>

                            <label className="block text-sm font-semibold mb-2" style={{ color: '#374151' }}>
                                Motivo da reprovação <span style={{ color: '#DC2626' }}>*</span>
                            </label>
                            <textarea
                                autoFocus
                                rows={4}
                                value={modalReprovar.motivo}
                                onChange={e => setModalReprovar(prev => ({ ...prev, motivo: e.target.value }))}
                                placeholder="Descreva o motivo com clareza para que o operador possa corrigir..."
                                className="w-full rounded-xl text-sm resize-none focus:outline-none"
                                style={{
                                    padding: '12px 14px',
                                    border: '2px solid',
                                    borderColor: modalReprovar.motivo.trim() ? '#EF4444' : '#E2E8F0',
                                    backgroundColor: '#FAFAFA',
                                    color: '#1E293B',
                                    lineHeight: '1.6',
                                    fontFamily: 'inherit',
                                    transition: 'border-color 0.2s',
                                }}
                                onFocus={e => e.target.style.borderColor = '#EF4444'}
                            />
                            <p className="text-xs mt-1.5" style={{ color: '#94A3B8' }}>
                                {modalReprovar.motivo.trim().length} caracteres — seja específico para facilitar a correção
                            </p>
                        </div>

                        {/* Footer */}
                        <div className="flex justify-end gap-2 px-6 py-4"
                            style={{ borderTop: '1px solid #F1F5F9', backgroundColor: '#FAFAFA' }}>
                            <button
                                onClick={() => setModalReprovar({ open: false, romaneio: null, motivo: '' })}
                                className="px-4 py-2 rounded-xl text-sm font-semibold"
                                style={{ border: '1.5px solid #E2E8F0', color: '#64748B', backgroundColor: 'white' }}>
                                Cancelar
                            </button>
                            <button
                                onClick={confirmarReprovacao}
                                disabled={!modalReprovar.motivo.trim()}
                                className="px-5 py-2 rounded-xl text-sm font-bold text-white flex items-center gap-2"
                                style={{
                                    backgroundColor: modalReprovar.motivo.trim() ? '#DC2626' : '#FCA5A5',
                                    cursor: modalReprovar.motivo.trim() ? 'pointer' : 'not-allowed',
                                    boxShadow: modalReprovar.motivo.trim() ? '0 2px 8px rgba(220,38,38,0.3)' : 'none',
                                }}>
                                <Icon name="XCircle" size={15} color="white" />
                                Confirmar Reprovação
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ────────────────────────────────────────────────────────────────────────────
// Componente de gerenciamento de corredores
// ────────────────────────────────────────────────────────────────────────────
const ICONES_DISPONIVEIS = [
    { value: 'ArrowUp',        label: '↑ Cima'         },
    { value: 'ArrowDown',      label: '↓ Baixo'        },
    { value: 'ArrowLeft',      label: '← Esquerda'     },
    { value: 'ArrowRight',     label: '→ Direita'      },
    { value: 'ArrowUpRight',   label: '↗ Cima-Direita' },
    { value: 'ArrowUpLeft',    label: '↖ Cima-Esquerda'},
    { value: 'ArrowDownRight', label: '↘ Baixo-Dir.'   },
    { value: 'ArrowDownLeft',  label: '↙ Baixo-Esq.'   },
    { value: 'MapPin',         label: '📍 Pino'        },
];

function CorredoresManager({ showToast }) {
    const [corredores, setCorredores] = useState([]);
    const [loading, setLoading]       = useState(true);
    const [editando, setEditando]     = useState(null);
    const [criando, setCriando]       = useState(false);
    const [saving, setSaving]         = useState(false);
    const [confirmDel, setConfirmDel] = useState(null);
    const [expandidos, setExpandidos] = useState({}); // { [nome]: true/false }

    const [form, setForm] = useState({ nome: '', label: '', icone: 'ArrowRight', cidades: '' });
    const [novaCidade, setNovaCidade] = useState('');

    const load = useCallback(async () => {
        try {
            setLoading(true);
            invalidarCache();
            const data = await fetchCorredores();
            setCorredores(data);
        } catch (err) {
            showToast('Erro ao carregar corredores: ' + err.message, 'error');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, []);

    const abrirEdicao = (corredor) => {
        setEditando(corredor.nome);
        setCriando(false);
        setForm({
            nome:    corredor.nome,
            label:   corredor.label,
            icone:   corredor.icone || 'ArrowRight',
            cidades: corredor.cidades.join('\n'),
        });
        setNovaCidade('');
    };

    const abrirCriacao = () => {
        setCriando(true);
        setEditando(null);
        setForm({ nome: '', label: '', icone: 'ArrowRight', cidades: '' });
        setNovaCidade('');
    };

    const fecharForm = () => { setEditando(null); setCriando(false); setNovaCidade(''); };

    const cidadesDoForm = () =>
        form.cidades
            .split('\n')
            .map(c => c.trim().toLowerCase())
            .filter(Boolean);

    const adicionarCidade = () => {
        if (!novaCidade.trim()) return;
        const atual = cidadesDoForm();
        const nova  = novaCidade.trim().toLowerCase();
        if (atual.includes(nova)) { showToast('Cidade já existe neste corredor', 'error'); return; }
        setForm(p => ({ ...p, cidades: [...atual, nova].join('\n') }));
        setNovaCidade('');
    };

    const removerCidade = (idx) => {
        const lista = cidadesDoForm().filter((_, i) => i !== idx);
        setForm(p => ({ ...p, cidades: lista.join('\n') }));
    };

    const salvar = async () => {
        if (!form.nome.trim()) { showToast('Nome do corredor é obrigatório', 'error'); return; }
        if (!form.label.trim()) { showToast('Rótulo é obrigatório', 'error'); return; }
        const cidades = cidadesDoForm();
        if (cidades.length === 0) { showToast('Adicione ao menos uma cidade', 'error'); return; }

        setSaving(true);
        try {
            await upsertCorredor({
                nome:   form.nome.trim().toLowerCase().replace(/\s+/g, '_'),
                label:  form.label.trim(),
                icone:  form.icone,
                cidades,
            });
            showToast('Corredor salvo com sucesso!', 'success');
            fecharForm();
            await load();
        } catch (err) {
            showToast('Erro ao salvar: ' + err.message, 'error');
        } finally {
            setSaving(false);
        }
    };

    const confirmarDelete = async () => {
        if (!confirmDel) return;
        try {
            await deleteCorredor(confirmDel);
            showToast('Corredor removido.', 'success');
            setConfirmDel(null);
            await load();
        } catch (err) {
            showToast('Erro ao remover: ' + err.message, 'error');
        }
    };

    if (loading) return (
        <div className="flex justify-center py-16">
            <div className="animate-spin h-7 w-7 rounded-full border-4 border-slate-300" style={{ borderTopColor: 'var(--color-primary)' }} />
        </div>
    );

    return (
        <div className="flex flex-col gap-5">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
                        <Icon name="Map" size={18} color="var(--color-primary)" />
                        Corredores de Rota
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                        Defina as cidades de cada corredor para o sistema de consolidação de cargas.
                        Base: <strong>Guanambi, BA</strong>.
                    </p>
                </div>
                <Button variant="default" iconName="Plus" iconSize={14} onClick={abrirCriacao}>
                    Novo Corredor
                </Button>
            </div>

            {/* Formulário de criação / edição */}
            {(criando || editando) && (
                <div className="bg-slate-50 rounded-xl border-2 border-blue-200 p-5">
                    <h3 className="font-semibold text-sm text-slate-800 mb-4">
                        {criando ? '+ Novo Corredor' : `✏️ Editando: ${form.label}`}
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                        {/* Nome interno */}
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">
                                Nome interno <span className="text-slate-400">(sem espaços)</span>
                            </label>
                            <input
                                value={form.nome}
                                onChange={e => setForm(p => ({ ...p, nome: e.target.value }))}
                                placeholder="ex: norte, sul_proximo"
                                disabled={!!editando}
                                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm bg-white font-mono disabled:opacity-50 disabled:bg-slate-100"
                            />
                        </div>

                        {/* Ícone */}
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Ícone / Direção</label>
                            <select
                                value={form.icone}
                                onChange={e => setForm(p => ({ ...p, icone: e.target.value }))}
                                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm bg-white">
                                {ICONES_DISPONIVEIS.map(ic => (
                                    <option key={ic.value} value={ic.value}>{ic.label}</option>
                                ))}
                            </select>
                        </div>

                        {/* Rótulo */}
                        <div className="sm:col-span-2">
                            <label className="block text-xs font-medium text-slate-600 mb-1">Rótulo exibido</label>
                            <input
                                value={form.label}
                                onChange={e => setForm(p => ({ ...p, label: e.target.value }))}
                                placeholder="ex: ↑ Norte (BR-030 → Lapa / Ibotirama)"
                                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm bg-white"
                            />
                        </div>
                    </div>

                    {/* Cidades */}
                    <div>
                        <label className="block text-xs font-medium text-slate-600 mb-2">
                            Cidades do corredor <span className="text-slate-400">({cidadesDoForm().length} cadastradas)</span>
                        </label>

                        {/* Adicionar nova cidade */}
                        <div className="flex gap-2 mb-3">
                            <input
                                value={novaCidade}
                                onChange={e => setNovaCidade(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), adicionarCidade())}
                                placeholder="Digite o nome da cidade e pressione Enter ou clique em +"
                                className="flex-1 h-9 px-3 rounded-lg border border-blue-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
                            />
                            <button
                                onClick={adicionarCidade}
                                className="h-9 px-4 rounded-lg text-white text-sm font-medium flex items-center gap-1 transition-colors"
                                style={{ backgroundColor: 'var(--color-primary)' }}>
                                <Icon name="Plus" size={14} color="#fff" /> Adicionar
                            </button>
                        </div>

                        {/* Lista de cidades com chip + remoção */}
                        <div className="flex flex-wrap gap-2 min-h-[40px] p-3 rounded-lg border border-slate-200 bg-white">
                            {cidadesDoForm().length === 0 ? (
                                <span className="text-xs text-slate-400 italic">Nenhuma cidade adicionada ainda...</span>
                            ) : cidadesDoForm().map((cidade, idx) => (
                                <span key={idx}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
                                    {cidade}
                                    <button
                                        onClick={() => removerCidade(idx)}
                                        className="ml-0.5 hover:text-red-600 transition-colors">
                                        <Icon name="X" size={10} color="currentColor" />
                                    </button>
                                </span>
                            ))}
                        </div>
                    </div>

                    <div className="flex gap-2 mt-4 justify-end">
                        <Button variant="outline" onClick={fecharForm} disabled={saving}>Cancelar</Button>
                        <Button variant="default" iconName="Save" iconSize={14} onClick={salvar} loading={saving}>
                            Salvar Corredor
                        </Button>
                    </div>
                </div>
            )}

            {/* Modal de confirmação de exclusão */}
            {confirmDel && (
                <div className="fixed inset-0 z-[400] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40" onClick={() => setConfirmDel(null)} />
                    <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
                        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-3">
                            <Icon name="Trash2" size={22} color="#DC2626" />
                        </div>
                        <h3 className="font-bold text-slate-800 mb-1">Remover corredor?</h3>
                        <p className="text-sm text-slate-500 mb-5">
                            O corredor <strong>"{confirmDel}"</strong> será removido permanentemente. Romaneios existentes não serão afetados.
                        </p>
                        <div className="flex gap-3 justify-center">
                            <Button variant="outline" onClick={() => setConfirmDel(null)}>Cancelar</Button>
                            <Button variant="destructive" iconName="Trash2" onClick={confirmarDelete}>Remover</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Lista de corredores */}
            <div className="grid grid-cols-1 tab:grid-cols-2 gap-4">
                {corredores.map(corredor => (
                    <div key={corredor.nome}
                        className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        {/* Header do card */}
                        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100"
                            style={{ backgroundColor: 'var(--color-muted)' }}>
                            <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                                    style={{ backgroundColor: 'var(--color-primary)' }}>
                                    <Icon name={corredor.icone || 'MapPin'} size={14} color="#fff" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-slate-800">{corredor.label}</p>
                                    <p className="text-xs text-slate-400 font-mono">{corredor.nome}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
                                    {(corredor.cidades || []).length} cidades
                                </span>
                                <button
                                    onClick={() => abrirEdicao(corredor)}
                                    className="p-1.5 rounded-lg hover:bg-slate-200 transition-colors ml-1">
                                    <Icon name="Pencil" size={13} color="#475569" />
                                </button>
                                <button
                                    onClick={() => setConfirmDel(corredor.nome)}
                                    className="p-1.5 rounded-lg hover:bg-red-100 transition-colors">
                                    <Icon name="Trash2" size={13} color="#DC2626" />
                                </button>
                            </div>
                        </div>

                        {/* Cidades em chips — expansíveis */}
                        <div className="px-4 py-3">
                            <div className="flex flex-wrap gap-1.5">
                                {(corredor.cidades || [])
                                    .slice(0, expandidos[corredor.nome] ? undefined : 12)
                                    .map((cidade, i) => (
                                        <span key={i}
                                            className="inline-block px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-600 border border-slate-200 capitalize">
                                            {cidade}
                                        </span>
                                    ))
                                }
                                {(corredor.cidades || []).length === 0 && (
                                    <span className="text-xs text-slate-400 italic">Sem cidades cadastradas</span>
                                )}
                            </div>
                            {(corredor.cidades || []).length > 12 && (
                                <button
                                    onClick={() => setExpandidos(prev => ({ ...prev, [corredor.nome]: !prev[corredor.nome] }))}
                                    className="mt-2 text-xs font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors">
                                    <Icon
                                        name={expandidos[corredor.nome] ? 'ChevronUp' : 'ChevronDown'}
                                        size={13} color="currentColor" />
                                    {expandidos[corredor.nome]
                                        ? 'Mostrar menos'
                                        : `Ver todas as ${corredor.cidades.length} cidades`}
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {corredores.length === 0 && !loading && (
                <div className="text-center py-12 text-slate-400">
                    <Icon name="Map" size={36} color="#CBD5E1" />
                    <p className="mt-2 text-sm">Nenhum corredor cadastrado</p>
                    <p className="text-xs mt-1">Clique em "Novo Corredor" para começar</p>
                </div>
            )}
        </div>
    );
}
