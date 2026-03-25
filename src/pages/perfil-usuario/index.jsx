import React, { useState } from 'react';
import NavigationBar from 'components/ui/NavigationBar';
import BreadcrumbTrail from 'components/ui/BreadcrumbTrail';
import Icon from 'components/AppIcon';
import Toast from 'components/ui/Toast';
import { useToast } from 'utils/useToast';
import { useAuth } from 'utils/AuthContext';
import { supabase } from 'utils/supabaseClient';
import { updateUserProfile } from 'utils/userService';

const inputCls = 'w-full px-3 py-2.5 rounded-lg border text-sm outline-none transition-all focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500';
const inputStyle = { borderColor: 'var(--color-border)', color: 'var(--color-text-primary)', backgroundColor: 'var(--color-card)' };

function SectionCard({ title, icon, children }) {
    return (
        <div className="rounded-2xl border shadow-sm overflow-hidden"
            style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-card)' }}>
            <div className="flex items-center gap-3 px-6 py-4 border-b"
                style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-muted)' }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: 'var(--color-primary)', opacity: 0.9 }}>
                    <Icon name={icon} size={15} color="#fff" />
                </div>
                <h2 className="font-heading font-semibold text-sm"
                    style={{ color: 'var(--color-text-primary)' }}>{title}</h2>
            </div>
            <div className="p-6">{children}</div>
        </div>
    );
}

function Field({ label, required, children }) {
    return (
        <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                {label}{required && <span className="text-red-500 ml-0.5">*</span>}
            </label>
            {children}
        </div>
    );
}

const ROLE_LABELS = {
    admin: 'Administrador',
    operador: 'Operador',
    motorista: 'Motorista',
    carreteiro: 'Carreteiro',
    mecanico: 'Mecânico',
};

export default function PerfilUsuario() {
    const { user, profile, isAdmin } = useAuth();
    const { toast, showToast } = useToast();

    // ── Nome ──────────────────────────────────────────────────────────────────
    const [nome, setNome] = useState(profile?.name || '');
    const [savingNome, setSavingNome] = useState(false);

    // ── E-mail ────────────────────────────────────────────────────────────────
    const [novoEmail, setNovoEmail] = useState('');
    const [senhaEmail, setSenhaEmail] = useState('');
    const [savingEmail, setSavingEmail] = useState(false);

    // ── Senha ─────────────────────────────────────────────────────────────────
    const [senhaAtual, setSenhaAtual] = useState('');
    const [novaSenha, setNovaSenha] = useState('');
    const [confirmSenha, setConfirmSenha] = useState('');
    const [savingSenha, setSavingSenha] = useState(false);
    const [showSenhas, setShowSenhas] = useState({ atual: false, nova: false, confirm: false });

    // ── Recuperação ───────────────────────────────────────────────────────────
    const [sendingReset, setSendingReset] = useState(false);
    const [resetSent, setResetSent] = useState(false);

    const handleSaveNome = async () => {
        if (!nome.trim()) { showToast('Nome não pode ser vazio', 'error'); return; }
        setSavingNome(true);
        try {
            await updateUserProfile(user.id, { name: nome.trim() });
            showToast('Nome atualizado com sucesso!', 'success');
        } catch (e) {
            showToast('Erro ao salvar nome: ' + e.message, 'error');
        } finally { setSavingNome(false); }
    };

    const handleSaveEmail = async () => {
        if (!novoEmail.trim()) { showToast('Informe o novo e-mail', 'error'); return; }
        if (!novoEmail.includes('@')) { showToast('E-mail inválido', 'error'); return; }
        setSavingEmail(true);
        try {
            const { error } = await supabase.auth.updateUser({ email: novoEmail.trim() });
            if (error) throw error;
            showToast('Verifique sua caixa de entrada para confirmar o novo e-mail.', 'success');
            setNovoEmail('');
            setSenhaEmail('');
        } catch (e) {
            showToast('Erro: ' + e.message, 'error');
        } finally { setSavingEmail(false); }
    };

    const handleSaveSenha = async () => {
        if (!novaSenha) { showToast('Informe a nova senha', 'error'); return; }
        if (novaSenha.length < 6) { showToast('Senha deve ter pelo menos 6 caracteres', 'error'); return; }
        if (novaSenha !== confirmSenha) { showToast('Senhas não coincidem', 'error'); return; }
        setSavingSenha(true);
        try {
            const { error } = await supabase.auth.updateUser({ password: novaSenha });
            if (error) throw error;
            showToast('Senha alterada com sucesso!', 'success');
            setSenhaAtual(''); setNovaSenha(''); setConfirmSenha('');
        } catch (e) {
            showToast('Erro: ' + e.message, 'error');
        } finally { setSavingSenha(false); }
    };

    const handleRecuperarSenha = async () => {
        if (!user?.email) return;
        setSendingReset(true);
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
                redirectTo: `${window.location.origin}/reset-password`,
            });
            if (error) throw error;
            setResetSent(true);
            showToast('Link de recuperação enviado para ' + user.email, 'success');
        } catch (e) {
            showToast('Erro ao enviar: ' + e.message, 'error');
        } finally { setSendingReset(false); }
    };

    const toggleSenha = (field) => setShowSenhas(s => ({ ...s, [field]: !s[field] }));

    return (
        <div className="min-h-screen" style={{ backgroundColor: 'var(--color-background)' }}>
            <NavigationBar />
            <main className="main-content">
                <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <BreadcrumbTrail className="mb-4" />

                    {/* Header */}
                    <div className="flex items-center gap-4 mb-8">
                        <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-2xl font-bold shadow-md flex-shrink-0"
                            style={{ backgroundColor: 'var(--color-primary)' }}>
                            {(profile?.name || user?.email || 'U')[0].toUpperCase()}
                        </div>
                        <div>
                            <h1 className="font-heading font-bold text-2xl"
                                style={{ color: 'var(--color-text-primary)' }}>
                                Meu Perfil
                            </h1>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
                                    {user?.email}
                                </span>
                                <span className="px-2 py-0.5 rounded-full text-xs font-medium"
                                    style={{ backgroundColor: 'var(--color-primary)', color: '#fff', opacity: 0.85 }}>
                                    {ROLE_LABELS[profile?.role] || profile?.role || 'Usuário'}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col gap-6">

                        {/* ── Informações básicas ─────────────────────────── */}
                        <SectionCard title="Informações Básicas" icon="User">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="sm:col-span-2">
                                    <Field label="Nome de exibição" required>
                                        <div className="flex gap-2">
                                            <input
                                                value={nome}
                                                onChange={e => setNome(e.target.value)}
                                                className={inputCls}
                                                style={inputStyle}
                                                placeholder="Seu nome"
                                            />
                                            <button
                                                onClick={handleSaveNome}
                                                disabled={savingNome}
                                                className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors flex-shrink-0"
                                                style={{ backgroundColor: 'var(--color-primary)' }}>
                                                {savingNome ? <Icon name="Loader" size={16} color="#fff" className="animate-spin" /> : 'Salvar'}
                                            </button>
                                        </div>
                                    </Field>
                                </div>
                                <div>
                                    <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>E-mail atual</p>
                                    <p className="text-sm px-3 py-2.5 rounded-lg border"
                                        style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)', backgroundColor: 'var(--color-muted)' }}>
                                        {user?.email}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Cargo / Função</p>
                                    <p className="text-sm px-3 py-2.5 rounded-lg border"
                                        style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)', backgroundColor: 'var(--color-muted)' }}>
                                        {ROLE_LABELS[profile?.role] || profile?.role || '—'}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Membro desde</p>
                                    <p className="text-sm px-3 py-2.5 rounded-lg border"
                                        style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)', backgroundColor: 'var(--color-muted)' }}>
                                        {user?.created_at ? new Date(user.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>ID do usuário</p>
                                    <p className="text-sm px-3 py-2.5 rounded-lg border font-mono truncate"
                                        style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)', backgroundColor: 'var(--color-muted)', fontSize: 11 }}>
                                        {user?.id}
                                    </p>
                                </div>
                            </div>
                        </SectionCard>

                        {/* ── Alterar e-mail ──────────────────────────────── */}
                        <SectionCard title="Alterar E-mail" icon="Mail">
                            <div className="flex flex-col gap-4">
                                <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                                    Um e-mail de confirmação será enviado para o novo endereço. A alteração só terá efeito após a confirmação.
                                </p>
                                <Field label="Novo e-mail" required>
                                    <input
                                        type="email"
                                        value={novoEmail}
                                        onChange={e => setNovoEmail(e.target.value)}
                                        className={inputCls}
                                        style={inputStyle}
                                        placeholder="novo@email.com"
                                    />
                                </Field>
                                <div className="flex justify-end">
                                    <button
                                        onClick={handleSaveEmail}
                                        disabled={savingEmail || !novoEmail}
                                        className="px-5 py-2.5 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50 flex items-center gap-2"
                                        style={{ backgroundColor: 'var(--color-primary)' }}>
                                        {savingEmail && <Icon name="Loader" size={14} color="#fff" />}
                                        Solicitar alteração
                                    </button>
                                </div>
                            </div>
                        </SectionCard>

                        {/* ── Alterar senha ───────────────────────────────── */}
                        <SectionCard title="Alterar Senha" icon="Lock">
                            <div className="flex flex-col gap-4">
                                <Field label="Nova senha" required>
                                    <div className="relative">
                                        <input
                                            type={showSenhas.nova ? 'text' : 'password'}
                                            value={novaSenha}
                                            onChange={e => setNovaSenha(e.target.value)}
                                            className={inputCls}
                                            style={{ ...inputStyle, paddingRight: 40 }}
                                            placeholder="Mínimo 6 caracteres"
                                        />
                                        <button type="button" onClick={() => toggleSenha('nova')}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-100 transition-opacity">
                                            <Icon name={showSenhas.nova ? 'EyeOff' : 'Eye'} size={15} color="var(--color-muted-foreground)" />
                                        </button>
                                    </div>
                                </Field>
                                <Field label="Confirmar nova senha" required>
                                    <div className="relative">
                                        <input
                                            type={showSenhas.confirm ? 'text' : 'password'}
                                            value={confirmSenha}
                                            onChange={e => setConfirmSenha(e.target.value)}
                                            className={inputCls}
                                            style={{ ...inputStyle, paddingRight: 40 }}
                                            placeholder="Repita a nova senha"
                                        />
                                        <button type="button" onClick={() => toggleSenha('confirm')}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-100 transition-opacity">
                                            <Icon name={showSenhas.confirm ? 'EyeOff' : 'Eye'} size={15} color="var(--color-muted-foreground)" />
                                        </button>
                                    </div>
                                </Field>
                                {novaSenha && confirmSenha && novaSenha !== confirmSenha && (
                                    <p className="text-xs text-red-500 flex items-center gap-1">
                                        <Icon name="AlertCircle" size={12} color="#EF4444" />
                                        As senhas não coincidem
                                    </p>
                                )}
                                {novaSenha && confirmSenha && novaSenha === confirmSenha && novaSenha.length >= 6 && (
                                    <p className="text-xs text-green-600 flex items-center gap-1">
                                        <Icon name="CheckCircle2" size={12} color="#16A34A" />
                                        Senhas coincidem
                                    </p>
                                )}
                                <div className="flex justify-end">
                                    <button
                                        onClick={handleSaveSenha}
                                        disabled={savingSenha || !novaSenha || novaSenha !== confirmSenha}
                                        className="px-5 py-2.5 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50 flex items-center gap-2"
                                        style={{ backgroundColor: 'var(--color-primary)' }}>
                                        {savingSenha && <Icon name="Loader" size={14} color="#fff" />}
                                        Alterar senha
                                    </button>
                                </div>
                            </div>
                        </SectionCard>

                        {/* ── Recuperação de senha ────────────────────────── */}
                        <SectionCard title="Recuperação de Senha" icon="KeyRound">
                            <div className="flex flex-col gap-4">
                                <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
                                    Esqueceu sua senha ou quer redefini-la por e-mail? Clique abaixo para receber um link de recuperação no endereço <strong style={{ color: 'var(--color-text-primary)' }}>{user?.email}</strong>.
                                </p>
                                {resetSent ? (
                                    <div className="flex items-center gap-3 p-4 rounded-xl"
                                        style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                                        <Icon name="CheckCircle2" size={20} color="#16A34A" />
                                        <div>
                                            <p className="text-sm font-medium text-green-700">Link enviado!</p>
                                            <p className="text-xs text-green-600">Verifique sua caixa de entrada (e spam) e clique no link para redefinir a senha.</p>
                                        </div>
                                    </div>
                                ) : (
                                    <button
                                        onClick={handleRecuperarSenha}
                                        disabled={sendingReset}
                                        className="self-start flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium border transition-colors disabled:opacity-50"
                                        style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}>
                                        {sendingReset
                                            ? <><Icon name="Loader" size={14} color="currentColor" /> Enviando...</>
                                            : <><Icon name="Mail" size={14} color="currentColor" /> Enviar link de recuperação</>
                                        }
                                    </button>
                                )}
                            </div>
                        </SectionCard>

                    </div>
                </div>
            </main>
            <Toast toast={toast} />
        </div>
    );
}
