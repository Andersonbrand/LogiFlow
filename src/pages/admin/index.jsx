import React, { useState, useCallback, useEffect } from 'react';

import { useNavigate } from 'react-router-dom';

import { useAuth } from 'context/AuthContext';
import { useToast } from 'hooks/useToast';
import { fetchAllUsers, updateUserProfile, createDriverUser, deleteDriverUser } from 'services/userService';
import { fetchRomaneiosResumo, aprovarRomaneio, reprovarRomaneio } from 'services/romaneio';
import { subscribeTabela, supabase } from 'services/supabaseClient';
import { useRecarregarAoVoltar } from 'hooks/useRecarregarAoVoltar';
import { NavigationBar, BreadcrumbTrail, Button, AppIcon as Icon, Toast } from 'components';

import MotoristasManager from './components/MotoristasManager';
import CorredoresManager from './components/CorredoresManager';
import BackupPanel from './BackupPanel';
import ConfiguracoesPanel from './ConfiguracoesPanel';
import TabUsuarios from './components/TabUsuarios';
import TabAprovacoes from './components/TabAprovacoes';
import EditandoUsuario from './components/EditandoUsuario';
import CriandoUsuario from './components/CriandoUsuario';

export default function AdminPanel() {
    const { profile, isAdmin } = useAuth();
    const navigate = useNavigate();
    const { toast, showToast } = useToast();
    const [users, setUsers]         = useState([]);
    const [modalReprovar, setModalReprovar] = useState({ open: false, romaneio: null, motivo: '' });
    const [romaneios, setRomaneios] = useState([]);
    const [tab, setTab]             = useState('usuarios');
    const [loading, setLoading]     = useState(true);
    const [editandoUsuario, setEditandoUsuario] = useState(null); // usuário sendo editado (qualquer papel)
    const [editUsuarioForm, setEditUsuarioForm] = useState({ name: '', tipo_veiculo: '', cnh_numero: '', cnh_categoria: '', cnh_vencimento: '', data_nascimento: '', is_terceiro: false });
    const [savingEditUsuario, setSavingEditUsuario] = useState(false);
    const [criandoUsuario, setCriandoUsuario] = useState(false);
    const NOVO_USUARIO_VAZIO = { nome: '', email: '', senha: '', role: 'operador', tipoVeiculo: 'caminhao' };
    const [novoUsuarioForm, setNovoUsuarioForm] = useState(NOVO_USUARIO_VAZIO);
    const [savingNovoUsuario, setSavingNovoUsuario] = useState(false);
    const [confirmarExclusaoUsuario, setConfirmarExclusaoUsuario] = useState(null);
    const [excluindoUsuarioId, setExcluindoUsuarioId] = useState(null);

    // ✅ FIX: useCallback garante referência estável para o hook useRecarregarAoVoltar
    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [u, rom] = await Promise.all([
                fetchAllUsers(),
                fetchRomaneiosResumo(),
            ]);
            setUsers(u || []);
            setRomaneios((rom || []).filter(r => !r.aprovado && r.status !== 'Cancelado' && r.status_aprovacao !== 'reprovado'));
        } catch (err) {
            showToast('Erro ao carregar dados: ' + err.message, 'error');
        }
        setLoading(false);
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
        return () => { unsubRom(); unsubProfiles(); };
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

    const handleAbrirEdicaoUsuario = (u) => {
        setEditandoUsuario(u);
        setEditUsuarioForm({
            name: u.name || '', tipo_veiculo: u.tipo_veiculo || '',
            cnh_numero: u.cnh_numero || '', cnh_categoria: u.cnh_categoria || 'C',
            cnh_vencimento: u.cnh_vencimento || '', data_nascimento: u.data_nascimento || '',
            is_terceiro: !!u.is_terceiro,
        });
    };

    const handleSalvarEdicaoUsuario = async () => {
        if (!editandoUsuario) return;
        if (!editUsuarioForm.name?.trim()) { showToast('Informe o nome.', 'error'); return; }
        setSavingEditUsuario(true);
        try {
            const ehMotoristaOuMecanico = editandoUsuario.role === 'motorista' || editandoUsuario.role === 'mecanico';
            const updates = { name: editUsuarioForm.name.trim() };
            if (editandoUsuario.role === 'motorista') updates.tipo_veiculo = editUsuarioForm.tipo_veiculo || null;
            if (ehMotoristaOuMecanico) {
                updates.cnh_numero      = editUsuarioForm.cnh_numero?.trim() || null;
                updates.cnh_categoria   = editUsuarioForm.cnh_categoria || null;
                updates.cnh_vencimento  = editUsuarioForm.cnh_vencimento || null;
                updates.data_nascimento = editUsuarioForm.data_nascimento || null;
                updates.is_terceiro     = !!editUsuarioForm.is_terceiro;
            }
            await updateUserProfile(editandoUsuario.id, updates);
            setUsers(prev => prev.map(u => u.id === editandoUsuario.id ? { ...u, ...updates } : u));
            showToast('Usuário atualizado!', 'success');
            setEditandoUsuario(null);
        } catch (err) {
            showToast('Erro: ' + err.message, 'error');
        } finally {
            setSavingEditUsuario(false);
        }
    };

    const handleCriarUsuario = async () => {
        if (!novoUsuarioForm.nome.trim() || !novoUsuarioForm.email.trim() || !novoUsuarioForm.senha) {
            showToast('Preencha nome, e-mail e senha.', 'error'); return;
        }
        if (novoUsuarioForm.senha.length < 6) { showToast('A senha precisa ter ao menos 6 caracteres.', 'error'); return; }
        setSavingNovoUsuario(true);
        try {
            await createDriverUser(supabase, {
                nome: novoUsuarioForm.nome, email: novoUsuarioForm.email, senha: novoUsuarioForm.senha,
                role: novoUsuarioForm.role, tipoVeiculo: novoUsuarioForm.tipoVeiculo,
            });
            showToast('Usuário criado com sucesso!', 'success');
            setCriandoUsuario(false);
            setNovoUsuarioForm(NOVO_USUARIO_VAZIO);
            const data = await fetchAllUsers();
            setUsers(data);
        } catch (err) {
            showToast('Erro ao criar usuário: ' + err.message, 'error');
        } finally {
            setSavingNovoUsuario(false);
        }
    };

    const handleExcluirUsuario = async () => {
        if (!confirmarExclusaoUsuario) return;
        if (confirmarExclusaoUsuario.id === profile?.id) {
            showToast('Você não pode excluir seu próprio usuário.', 'error');
            setConfirmarExclusaoUsuario(null);
            return;
        }
        setExcluindoUsuarioId(confirmarExclusaoUsuario.id);
        try {
            await deleteDriverUser(confirmarExclusaoUsuario.id);
            setUsers(prev => prev.filter(u => u.id !== confirmarExclusaoUsuario.id));
            showToast('Usuário excluído.', 'success');
            setConfirmarExclusaoUsuario(null);
        } catch (err) {
            showToast('Erro ao excluir: ' + err.message, 'error');
        } finally {
            setExcluindoUsuarioId(null);
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

    const TABS = [
        { id: 'usuarios',    label: 'Usuários',    icon: 'Users' },
        { id: 'motoristas',  label: 'Motoristas',  icon: 'Truck' },
        { id: 'aprovacoes',  label: 'Aprovações',  icon: 'CheckSquare', badge: romaneios.length || null },
        { id: 'corredores',  label: 'Corredores',  icon: 'Map' },
        { id: 'backup',      label: 'Backup',      icon: 'Archive' },
        { id: 'configuracoes', label: 'Configurações', icon: 'Settings' },
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
                    <div className="max-w-[1920px] mx-auto px-4 md:px-6 py-4 flex flex-col xs:flex-row xs:items-center xs:justify-between gap-3">
                        <div>
                            <BreadcrumbTrail items={[{ label: 'Dashboard', path: '/' }, { label: 'Administração' }]} />
                            <h1 className="text-xl font-bold text-slate-800 mt-1">Painel Administrativo</h1>
                        </div>
                        <Button variant="outline" iconName="RefreshCw" iconSize={15} onClick={load} className="self-start xs:self-auto flex-shrink-0">
                            Atualizar
                        </Button>
                    </div>
                </div>

                <div className="max-w-[1920px] mx-auto px-4 md:px-6 py-6 space-y-6">
                    {/* Tabs */}
                    <div className="flex gap-1 bg-slate-100 rounded-lg p-1 overflow-x-auto">
                        {TABS.map(t => (
                            <button key={t.id} onClick={() => { setTab(t.id); }}
                                className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs sm:text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 ${tab === t.id ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>
                                <Icon name={t.icon} size={14} color="currentColor" />
                                <span className="hidden xs:inline">{t.label}</span>
                                {t.badge ? <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">{t.badge}</span> : null}
                            </button>
                        ))}
                    </div>

                    {/* ── ABA USUÁRIOS ─────────────────────────────────────── */}
                    {tab === 'usuarios' && (
                        <TabUsuarios
                    NOVO_USUARIO_VAZIO={NOVO_USUARIO_VAZIO}
                    handleAbrirEdicaoUsuario={handleAbrirEdicaoUsuario}
                    handleRoleChange={handleRoleChange}
                    setConfirmarExclusaoUsuario={setConfirmarExclusaoUsuario}
                    setCriandoUsuario={setCriandoUsuario}
                    setNovoUsuarioForm={setNovoUsuarioForm}
                    users={users}
                />
                    )}

                    {/* ── ABA MOTORISTAS ───────────────────────────────────── */}
                    {tab === 'motoristas' && (
                        <MotoristasManager showToast={showToast} />
                    )}

                    {/* ── ABA APROVAÇÕES ───────────────────────────────────── */}
                    {tab === 'aprovacoes' && (
                        <TabAprovacoes handleAprovar={handleAprovar} handleReprovar={handleReprovar} navigate={navigate} romaneios={romaneios} /> 

                        
                    )}

                    {/* ── ABA ALERTAS ──────────────────────────────────────── */}
                    {/* ── ABA CORREDORES ─────────────────────────────────── */}
                    {tab === 'corredores' && (
                        <CorredoresManager showToast={showToast} />
                    )}

                    {/* ── ABA BACKUP ───────────────────────────────────────── */}
                    {tab === 'backup' && <BackupPanel />}

                    {/* ── ABA CONFIGURAÇÕES ───────────────────────────────── */}
                    {tab === 'configuracoes' && <ConfiguracoesPanel showToast={showToast} profile={profile} />}
                </div>
            </main>
            <Toast toast={toast} />

            {/* ── MODAL DE EDIÇÃO DE USUÁRIO (qualquer papel) ─────────────── */}
            {editandoUsuario && (
                <EditandoUsuario
                    editUsuarioForm={editUsuarioForm}
                    editandoUsuario={editandoUsuario}
                    handleSalvarEdicaoUsuario={handleSalvarEdicaoUsuario}
                    savingEditUsuario={savingEditUsuario}
                    setEditUsuarioForm={setEditUsuarioForm}
                    setEditandoUsuario={setEditandoUsuario}
                />
            )}

            {/* ── MODAL DE CRIAÇÃO DE USUÁRIO (qualquer papel) ─────────────── */}
            {criandoUsuario && (
                <CriandoUsuario handleCriarUsuario={handleCriarUsuario} novoUsuarioForm={novoUsuarioForm} savingNovoUsuario={savingNovoUsuario} setCriandoUsuario={setCriandoUsuario} setNovoUsuarioForm={setNovoUsuarioForm} />
            )}

            {/* ── MODAL DE CONFIRMAÇÃO DE EXCLUSÃO DE USUÁRIO ──────────────── */}
            {confirmarExclusaoUsuario && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
                    style={{ backgroundColor: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(2px)' }}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
                        <div className="px-6 py-5">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#FEE2E2' }}>
                                    <Icon name="AlertTriangle" size={18} color="#DC2626" />
                                </div>
                                <h3 className="font-bold text-base text-slate-800">Excluir usuário?</h3>
                            </div>
                            <p className="text-sm text-slate-600">
                                Isso vai excluir permanentemente <strong>{confirmarExclusaoUsuario.name || confirmarExclusaoUsuario.email}</strong> e
                                todo o histórico vinculado a ele (viagens, abastecimentos, checklists, diárias, bonificações). Essa ação não pode ser desfeita.
                            </p>
                        </div>
                        <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50">
                            <button onClick={() => setConfirmarExclusaoUsuario(null)} disabled={excluindoUsuarioId === confirmarExclusaoUsuario.id}
                                className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-white disabled:opacity-50" style={{ borderColor: '#CBD5E1' }}>
                                Cancelar
                            </button>
                            <button onClick={handleExcluirUsuario} disabled={excluindoUsuarioId === confirmarExclusaoUsuario.id}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-60">
                                <Icon name={excluindoUsuarioId === confirmarExclusaoUsuario.id ? 'Loader' : 'Trash2'} size={14} />
                                {excluindoUsuarioId === confirmarExclusaoUsuario.id ? 'Excluindo...' : 'Excluir'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── MODAL DE REPROVAÇÃO ──────────────────────────────────────── */}
            {modalReprovar.open && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
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
