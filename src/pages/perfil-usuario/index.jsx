import React, { useState } from 'react';
import NavigationBar from 'components/ui/NavigationBar';
import BreadcrumbTrail from 'components/ui/BreadcrumbTrail';
import Icon from 'components/AppIcon';
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
                    style={{ backgroundColor: 'var(--color-primary)' }}>
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

// Banner de feedback inline dentro do card
function FeedbackBanner({ status, message }) {
    if (!status || !message) return null;
    const cfg = {
        success: { bg: '#F0FDF4', border: '#BBF7D0', text: '#15803D', icon: 'CheckCircle2', iconColor: '#16A34A' },
        error:   { bg: '#FEF2F2', border: '#FECACA', text: '#B91C1C', icon: 'AlertCircle',  iconColor: '#DC2626' },
        info:    { bg: '#EFF6FF', border: '#BFDBFE', text: '#1D4ED8', icon: 'Info',          iconColor: '#2563EB' },
    }[status] || {};
    return (
        <div className="flex items-start gap-3 p-3.5 rounded-xl text-sm"
            style={{ backgroundColor: cfg.bg, border: `1px solid ${cfg.border}` }}>
            <Icon name={cfg.icon} size={17} color={cfg.iconColor} style={{ flexShrink: 0, marginTop: 1 }} />
            <p style={{ color: cfg.text }}>{message}</p>
        </div>
    );
}

const ROLE_LABELS = {
    admin: 'Administrador', operador: 'Operador', motorista: 'Motorista',
    carreteiro: 'Carreteiro', mecanico: 'Mecânico',
};

export default function PerfilUsuario() {
    const { user, profile } = useAuth();

    // ── Nome ──────────────────────────────────────────────────────────────────
    const [nome, setNome]           = useState(profile?.name || '');
    const [savingNome, setSavingNome] = useState(false);
    const [feedbackNome, setFeedbackNome] = useState(null); // { status, message }

    // ── E-mail ────────────────────────────────────────────────────────────────
    const [novoEmail, setNovoEmail]   = useState('');
    const [savingEmail, setSavingEmail] = useState(false);
    const [feedbackEmail, setFeedbackEmail] = useState(null);

    // ── Senha ─────────────────────────────────────────────────────────────────
    const [novaSenha, setNovaSenha]       = useState('');
    const [confirmSenha, setConfirmSenha] = useState('');
    const [savingSenha, setSavingSenha]   = useState(false);
    const [feedbackSenha, setFeedbackSenha] = useState(null);
    const [showSenhas, setShowSenhas] = useState({ nova: false, confirm: false });

    // ── Recuperação ───────────────────────────────────────────────────────────
    const [sendingReset, setSendingReset] = useState(false);
    const [feedbackReset, setFeedbackReset] = useState(null);

    const toggleSenha = (field) => setShowSenhas(s => ({ ...s, [field]: !s[field] }));

    // ── Handlers ──────────────────────────────────────────────────────────────
    const handleSaveNome = async () => {
        if (!nome.trim()) { setFeedbackNome({ status: 'error', message: 'Nome não pode ser vazio.' }); return; }
        setSavingNome(true);
        setFeedbackNome(null);
        try {
            await updateUserProfile(user.id, { name: nome.trim() });
            setFeedbackNome({ status: 'success', message: 'Nome atualizado com sucesso!' });
        } catch (e) {
            setFeedbackNome({ status: 'error', message: 'Erro ao salvar nome: ' + e.message });
        } finally { setSavingNome(false); }
    };

    const handleSaveEmail = async () => {
        if (!novoEmail.trim()) { setFeedbackEmail({ status: 'error', message: 'Informe o novo e-mail.' }); return; }
        if (!novoEmail.includes('@')) { setFeedbackEmail({ status: 'error', message: 'Formato de e-mail inválido.' }); return; }
        if (novoEmail.trim() === user?.email) { setFeedbackEmail({ status: 'error', message: 'O novo e-mail é igual ao atual.' }); return; }
        setSavingEmail(true);
        setFeedbackEmail({ status: 'info', message: 'Enviando solicitação...' });
        try {
            const { error } = await supabase.auth.updateUser({ email: novoEmail.trim() });
            if (error) throw error;
            setFeedbackEmail({
                status: 'success',
                message: `Link de confirmação enviado para "${novoEmail.trim()}". Verifique sua caixa de entrada e clique no link para confirmar a alteração.`,
            });
            setNovoEmail('');
        } catch (e) {
            setFeedbackEmail({ status: 'error', message: 'Erro: ' + e.message });
        } finally { setSavingEmail(false); }
    };

    const handleSaveSenha = async () => {
        if (!novaSenha) { setFeedbackSenha({ status: 'error', message: 'Informe a nova senha.' }); return; }
        if (novaSenha.length < 6) { setFeedbackSenha({ status: 'error', message: 'A senha deve ter pelo menos 6 caracteres.' }); return; }
        if (novaSenha !== confirmSenha) { setFeedbackSenha({ status: 'error', message: 'As senhas não coincidem.' }); return; }
        setSavingSenha(true);
        setFeedbackSenha({ status: 'info', message: 'Alterando senha...' });
        try {
            const { error } = await supabase.auth.updateUser({ password: novaSenha });
            if (error) throw error;
            setFeedbackSenha({ status: 'success', message: 'Senha alterada com sucesso! Use a nova senha no próximo login.' });
            setNovaSenha(''); setConfirmSenha('');
        } catch (e) {
            setFeedbackSenha({ status: 'error', message: 'Erro: ' + e.message });
        } finally { setSavingSenha(false); }
    };

    const handleRecuperarSenha = async () => {
        if (!user?.email) return;
        setSendingReset(true);
        setFeedbackReset({ status: 'info', message: 'Enviando link de recuperação...' });
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
                redirectTo: `${window.location.origin}/reset-password`,
            });
            if (error) throw error;
            setFeedbackReset({
                status: 'success',
                message: `Link enviado para "${user.email}". Verifique sua caixa de entrada (e pasta de spam) e clique no link para redefinir a senha.`,
            });
        } catch (e) {
            setFeedbackReset({ status: 'error', message: 'Erro ao enviar: ' + e.message });
        } finally { setSendingReset(false); }
    };

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
                            <h1 className="font-heading font-bold text-2xl" style={{ color: 'var(--color-text-primary)' }}>
                                Meu Perfil
                            </h1>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                                <span className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
                                    {user?.email}
                                </span>
                                <span className="px-2 py-0.5 rounded-full text-xs font-medium"
                                    style={{ backgroundColor: 'var(--color-primary)', color: '#fff' }}>
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
                                                onChange={e => { setNome(e.target.value); setFeedbackNome(null); }}
                                                className={inputCls}
                                                style={inputStyle}
                                                placeholder="Seu nome"
                                                onKeyDown={e => e.key === 'Enter' && handleSaveNome()}
                                            />
                                            <button
                                                onClick={handleSaveNome}
                                                disabled={savingNome}
                                                className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors flex-shrink-0 flex items-center gap-1.5 disabled:opacity-70"
                                                style={{ backgroundColor: 'var(--color-primary)' }}>
                                                {savingNome
                                                    ? <><Icon name="Loader" size={14} color="#fff" />Salvando</>
                                                    : 'Salvar'}
                                            </button>
                                        </div>
                                    </Field>
                                    {feedbackNome && <div className="mt-3"><FeedbackBanner {...feedbackNome} /></div>}
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
                                    Um link de confirmação será enviado para o novo endereço. A alteração só terá efeito após clicar no link recebido.
                                </p>
                                <Field label="Novo e-mail" required>
                                    <input
                                        type="email"
                                        value={novoEmail}
                                        onChange={e => { setNovoEmail(e.target.value); setFeedbackEmail(null); }}
                                        className={inputCls}
                                        style={inputStyle}
                                        placeholder="novo@email.com"
                                        onKeyDown={e => e.key === 'Enter' && handleSaveEmail()}
                                        disabled={savingEmail}
                                    />
                                </Field>
                                {feedbackEmail && <FeedbackBanner {...feedbackEmail} />}
                                <div className="flex justify-end">
                                    <button
                                        onClick={handleSaveEmail}
                                        disabled={savingEmail || !novoEmail}
                                        className="px-5 py-2.5 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50 flex items-center gap-2"
                                        style={{ backgroundColor: 'var(--color-primary)' }}>
                                        {savingEmail
                                            ? <><Icon name="Loader" size={14} color="#fff" />Enviando...</>
                                            : 'Solicitar alteração'}
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
                                            onChange={e => { setNovaSenha(e.target.value); setFeedbackSenha(null); }}
                                            className={inputCls}
                                            style={{ ...inputStyle, paddingRight: 40 }}
                                            placeholder="Mínimo 6 caracteres"
                                            disabled={savingSenha}
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
                                            onChange={e => { setConfirmSenha(e.target.value); setFeedbackSenha(null); }}
                                            className={inputCls}
                                            style={{ ...inputStyle, paddingRight: 40 }}
                                            placeholder="Repita a nova senha"
                                            disabled={savingSenha}
                                        />
                                        <button type="button" onClick={() => toggleSenha('confirm')}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-100 transition-opacity">
                                            <Icon name={showSenhas.confirm ? 'EyeOff' : 'Eye'} size={15} color="var(--color-muted-foreground)" />
                                        </button>
                                    </div>
                                </Field>
                                {/* Indicador inline de força/match */}
                                {novaSenha && confirmSenha && !feedbackSenha && (
                                    novaSenha !== confirmSenha
                                        ? <p className="text-xs text-red-500 flex items-center gap-1">
                                            <Icon name="AlertCircle" size={12} color="#EF4444" />As senhas não coincidem
                                          </p>
                                        : novaSenha.length >= 6
                                            ? <p className="text-xs text-green-600 flex items-center gap-1">
                                                <Icon name="CheckCircle2" size={12} color="#16A34A" />Senhas coincidem ✓
                                              </p>
                                            : null
                                )}
                                {feedbackSenha && <FeedbackBanner {...feedbackSenha} />}
                                <div className="flex justify-end">
                                    <button
                                        onClick={handleSaveSenha}
                                        disabled={savingSenha || !novaSenha || novaSenha !== confirmSenha || novaSenha.length < 6}
                                        className="px-5 py-2.5 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50 flex items-center gap-2"
                                        style={{ backgroundColor: 'var(--color-primary)' }}>
                                        {savingSenha
                                            ? <><Icon name="Loader" size={14} color="#fff" />Alterando...</>
                                            : 'Alterar senha'}
                                    </button>
                                </div>
                            </div>
                        </SectionCard>

                        {/* ── Recuperação de senha ────────────────────────── */}
                        <SectionCard title="Recuperação de Senha" icon="KeyRound">
                            <div className="flex flex-col gap-4">
                                <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
                                    Clique abaixo para receber um link de redefinição de senha no endereço{' '}
                                    <strong style={{ color: 'var(--color-text-primary)' }}>{user?.email}</strong>.
                                </p>
                                {feedbackReset && <FeedbackBanner {...feedbackReset} />}
                                {!feedbackReset?.status === 'success' && (
                                    <button
                                        onClick={handleRecuperarSenha}
                                        disabled={sendingReset}
                                        className="self-start flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium border transition-colors disabled:opacity-50"
                                        style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}>
                                        {sendingReset
                                            ? <><Icon name="Loader" size={14} color="currentColor" />Enviando...</>
                                            : <><Icon name="Mail" size={14} color="currentColor" />Enviar link de recuperação</>
                                        }
                                    </button>
                                )}
                            </div>
                        </SectionCard>

                    </div>
                </div>
            </main>
        </div>
    );
}
