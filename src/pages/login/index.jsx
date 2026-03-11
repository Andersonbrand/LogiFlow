import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from 'utils/AuthContext';
import Icon from 'components/AppIcon';

/* ─────────────────────────────────────────────
   Modos da página:
   'login'      → entrar na conta
   'register'   → criar conta
   'forgot'     → esqueci a senha
   'email-sent' → e-mail de reset enviado
   'verify'     → aguardando confirmação de e-mail
───────────────────────────────────────────── */

const MSGS_ERRO = {
    'Invalid login credentials': 'E-mail ou senha incorretos.',
    'User already registered': 'Este e-mail já está cadastrado. Faça login.',
    'Password should be at least 6 characters': 'A senha deve ter pelo menos 6 caracteres.',
    'Email not confirmed': 'Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.',
    'For security purposes, you can only request this once every 60 seconds':
        'Aguarde 60 segundos antes de solicitar outro e-mail.',
    'User not found': 'Nenhuma conta encontrada com este e-mail.',
    'Email rate limit exceeded': 'Muitas tentativas. Aguarde alguns minutos.',
};

function translateError(msg) {
    return MSGS_ERRO[msg] || msg;
}

/* ── Indicador de força de senha ───────────── */
function PasswordStrength({ password }) {
    if (!password) return null;
    const checks = [
        password.length >= 8,
        /[A-Z]/.test(password),
        /[0-9]/.test(password),
        /[^A-Za-z0-9]/.test(password),
    ];
    const score = checks.filter(Boolean).length;
    const labels = ['', 'Fraca', 'Regular', 'Boa', 'Forte'];
    const colors = ['', '#EF4444', '#F97316', '#EAB308', '#22C55E'];
    return (
        <div className="mt-2">
            <div className="flex gap-1 mb-1">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="h-1 flex-1 rounded-full transition-all duration-300"
                        style={{ backgroundColor: i <= score ? colors[score] : '#E2E8F0' }} />
                ))}
            </div>
            {score > 0 && (
                <p className="text-xs font-medium" style={{ color: colors[score] }}>
                    Senha {labels[score]}
                </p>
            )}
        </div>
    );
}

/* ── Campo de input reutilizável ────────────── */
function Field({ label, name, type = 'text', value, onChange, placeholder, required, hint, children }) {
    const [show, setShow] = useState(false);
    const isPass = type === 'password';
    return (
        <div>
            <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-semibold text-slate-700">{label}</label>
                {hint}
            </div>
            <div className="relative">
                <input
                    name={name}
                    type={isPass && show ? 'text' : type}
                    required={required}
                    value={value}
                    onChange={onChange}
                    placeholder={placeholder}
                    autoComplete={name === 'password' ? 'current-password' : name === 'email' ? 'email' : 'off'}
                    className="w-full h-11 pl-4 pr-10 rounded-xl text-sm transition-all outline-none bg-slate-50 text-slate-800 placeholder-slate-400"
                    style={{ border: '2px solid #E2E8F0' }}
                    onFocus={e => { e.target.style.borderColor = '#1E3A5F'; e.target.style.backgroundColor = '#fff'; }}
                    onBlur={e => { e.target.style.borderColor = '#E2E8F0'; e.target.style.backgroundColor = '#F8FAFC'; }}
                />
                {isPass && (
                    <button type="button" tabIndex={-1}
                        onClick={() => setShow(s => !s)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                        <Icon name={show ? 'EyeOff' : 'Eye'} size={16} color="currentColor" />
                    </button>
                )}
            </div>
            {children}
        </div>
    );
}

/* ── Painel esquerdo — branding ─────────────── */
function BrandPanel() {
    return (
        <div className="hidden lg:flex flex-col justify-between p-12 relative overflow-hidden"
            style={{ background: 'linear-gradient(145deg, #0F1E35 0%, #1E3A5F 60%, #0D2137 100%)' }}>

            {/* Grid decorativo de fundo */}
            <div className="absolute inset-0 opacity-10"
                style={{
                    backgroundImage: `
                        linear-gradient(rgba(255,255,255,0.15) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(255,255,255,0.15) 1px, transparent 1px)
                    `,
                    backgroundSize: '44px 44px',
                }} />

            {/* Brilho laranja inferior */}
            <div className="absolute -bottom-32 -right-32 w-[480px] h-[480px] rounded-full opacity-15"
                style={{ background: 'radial-gradient(circle, #F97316 0%, transparent 65%)' }} />
            <div className="absolute top-1/4 -left-20 w-72 h-72 rounded-full opacity-5"
                style={{ background: 'radial-gradient(circle, #60A5FA 0%, transparent 70%)' }} />

            {/* Logo */}
            <div className="relative z-10 flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg"
                    style={{ backgroundColor: '#F97316' }}>
                    <Icon name="Truck" size={24} color="#fff" />
                </div>
                <div>
                    <p className="font-black text-2xl text-white tracking-tight leading-none">LogiFlow</p>
                    {""}
                    <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: '#7DD3FC' }}>
                        Gestão Logística
                    </p>
                </div>
            </div>

            {/* Conteúdo central */}
            <div className="relative z-10 flex-1 flex flex-col justify-center py-16">
                <h2 className="text-4xl font-black text-white leading-snug mb-4">
                    Controle total<br />
                    <span style={{ color: '#FB923C' }}>da sua operação.</span>
                </h2>
                <p className="text-base leading-relaxed mb-10 max-w-xs" style={{ color: '#BAE6FD' }}>
                    Gerencie romaneios, frota e motoristas em tempo real — do carregamento à entrega final.
                </p>

                <div className="flex flex-col gap-3">
                    {[
                        { icon: 'FileText', text: 'Romaneios digitais com aprovação em tempo real' },
                        { icon: 'Truck', text: 'Rastreamento de frota e utilização por veículo' },
                        { icon: 'Award', text: 'Bonificações automáticas por performance' },
                        { icon: 'Map', text: 'Consolidação inteligente de cargas por corredor' },
                    ].map((f, i) => (
                        <div key={i} className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                                style={{
                                    backgroundColor: 'rgba(249,115,22,0.15)',
                                    border: '1px solid rgba(249,115,22,0.4)',
                                }}>
                                <Icon name={f.icon} size={14} color="#FB923C" />
                            </div>
                            <p className="text-sm" style={{ color: '#E0F2FE' }}>{f.text}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Rodapé */}
            <p className="relative z-10 text-xs" style={{ color: '#475569' }}>
                © {new Date().getFullYear()} LogiFlow — Todos os direitos reservados.
            </p>
        </div>
    );
}

/* ── Spinner ────────────────────────────────── */
function Spinner() {
    return (
        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
    );
}

function ErrorBox({ msg }) {
    return (
        <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl text-sm"
            style={{ backgroundColor: '#FEF2F2', color: '#991B1B', border: '1px solid #FECACA' }}>
            <Icon name="AlertCircle" size={15} color="#DC2626" />
            <span>{msg}</span>
        </div>
    );
}

function SuccessBox({ msg }) {
    return (
        <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl text-sm mb-4"
            style={{ backgroundColor: '#F0FDF4', color: '#166534', border: '1px solid #BBF7D0' }}>
            <Icon name="CheckCircle2" size={15} color="#16A34A" />
            <span>{msg}</span>
        </div>
    );
}

/* Wrapper para telas sem split layout */
function PageShell({ children }) {
    return (
        <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: '#F8FAFC' }}>
            <div className="w-full max-w-md">
                <div className="flex items-center justify-center gap-2 mb-8">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{ backgroundColor: '#F97316' }}>
                        <Icon name="Truck" size={20} color="#fff" />
                    </div>
                    <span className="font-black text-2xl text-slate-800">LogiFlow</span>
                </div>
                <div className="bg-white rounded-2xl p-8" style={{ boxShadow: '0 8px 40px rgba(0,0,0,0.10)', border: '1px solid #F1F5F9' }}>
                    {children}
                </div>
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════
   COMPONENTE PRINCIPAL
═══════════════════════════════════════════ */
export default function Login() {
    const { signIn, signUp, sendPasswordReset } = useAuth();
    const navigate = useNavigate();

    const [mode, setMode] = useState('login');
    const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);
    const [registeredEmail, setRegisteredEmail] = useState('');

    useEffect(() => {
        // Link de reset de senha vindos por e-mail têm type=recovery no hash
        if (window.location.hash.includes('type=recovery')) {
            setMode('reset-password');
        }
    }, []);

    const change = (e) => { setForm(p => ({ ...p, [e.target.name]: e.target.value })); setError(''); };
    const goTo = (m) => { setMode(m); setError(''); setSuccess(''); };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(''); setSuccess('');

        if (mode === 'register') {
            if (form.name.trim().length < 2) { setError('Informe seu nome completo.'); return; }
            if (form.password.length < 6) { setError('A senha deve ter pelo menos 6 caracteres.'); return; }
            if (form.password !== form.confirmPassword) { setError('As senhas não coincidem.'); return; }
        }

        setLoading(true);
        try {
            if (mode === 'login') {
                await signIn(form.email, form.password);
                navigate('/');

            } else if (mode === 'register') {
                const data = await signUp(form.email, form.password, form.name.trim());
                setRegisteredEmail(form.email);
                if (data?.session) {
                    navigate('/'); // confirmação desativada (dev/staging)
                } else {
                    goTo('verify'); // confirmação por e-mail ativada
                }

            } else if (mode === 'forgot') {
                await sendPasswordReset(form.email);
                goTo('email-sent');
            }

        } catch (err) {
            setError(translateError(err.message));
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        if (!registeredEmail) return;
        setLoading(true);
        try {
            await sendPasswordReset(registeredEmail);
            setSuccess('E-mail reenviado! Verifique sua caixa de entrada e também o spam.');
        } catch (err) {
            setError(translateError(err.message));
        } finally {
            setLoading(false);
        }
    };

    /* ── Tela: aguardando verificação de e-mail ── */
    if (mode === 'verify') {
        return (
            <PageShell>
                <div className="flex flex-col items-center text-center">
                    <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-5"
                        style={{ background: 'linear-gradient(135deg, #EFF6FF, #DBEAFE)' }}>
                        <Icon name="MailCheck" size={38} color="#1D4ED8" />
                    </div>
                    <h2 className="text-2xl font-black text-slate-800 mb-2">Verifique seu e-mail</h2>
                    <p className="text-slate-500 text-sm leading-relaxed mb-3">
                        Enviamos um link de ativação para:
                    </p>
                    <div className="w-full px-4 py-2.5 bg-slate-100 rounded-xl mb-5 font-bold text-slate-800 text-sm text-center">
                        {registeredEmail || form.email}
                    </div>
                    <p className="text-slate-500 text-sm leading-relaxed mb-6 max-w-xs">
                        Clique no link recebido para <strong>ativar sua conta</strong> e acessar o sistema.
                        Verifique também sua pasta de <strong>spam</strong>.
                    </p>

                    {error && <ErrorBox msg={error} />}
                    {success && <SuccessBox msg={success} />}

                    <button onClick={handleResend} disabled={loading}
                        className="w-full h-11 rounded-xl text-sm font-bold text-white mb-3 flex items-center justify-center gap-2 transition-all disabled:opacity-60"
                        style={{ backgroundColor: '#1E3A5F' }}>
                        {loading ? <Spinner /> : <Icon name="RefreshCw" size={14} color="#fff" />}
                        Reenviar e-mail de confirmação
                    </button>

                    <button onClick={() => goTo('login')}
                        className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1.5 transition-colors">
                        <Icon name="ArrowLeft" size={13} color="currentColor" />
                        Voltar para o login
                    </button>
                </div>
            </PageShell>
        );
    }

    /* ── Tela: e-mail de reset enviado ── */
    if (mode === 'email-sent') {
        return (
            <PageShell>
                <div className="flex flex-col items-center text-center">
                    <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-5"
                        style={{ background: 'linear-gradient(135deg, #F0FDF4, #DCFCE7)' }}>
                        <Icon name="CheckCircle2" size={38} color="#16A34A" />
                    </div>
                    <h2 className="text-2xl font-black text-slate-800 mb-2">E-mail enviado!</h2>
                    <p className="text-slate-500 text-sm mb-3">Enviamos as instruções para:</p>
                    <div className="w-full px-4 py-2.5 bg-slate-100 rounded-xl mb-5 font-bold text-slate-800 text-sm text-center">
                        {form.email}
                    </div>
                    <p className="text-slate-500 text-sm leading-relaxed mb-5 max-w-xs">
                        Clique no link do e-mail para criar uma nova senha. O link expira em <strong>1 hora</strong>.
                    </p>
                    <div className="w-full p-3.5 rounded-xl mb-6 flex items-start gap-2.5"
                        style={{ backgroundColor: '#FFFBEB', border: '1px solid #FDE68A' }}>
                        <Icon name="AlertTriangle" size={14} color="#92400E" />
                        <p className="text-xs" style={{ color: '#78350F' }}>
                            Não encontrou o e-mail? Verifique a pasta de <strong>spam/lixo eletrônico</strong>.
                        </p>
                    </div>
                    <button onClick={() => goTo('login')}
                        className="text-sm font-bold flex items-center gap-1.5 hover:opacity-75 transition-opacity"
                        style={{ color: '#1E3A5F' }}>
                        <Icon name="ArrowLeft" size={13} color="currentColor" />
                        Voltar para o login
                    </button>
                </div>
            </PageShell>
        );
    }

    /* ── Formulário principal (login / register / forgot) ── */
    return (
        <div className="min-h-screen grid lg:grid-cols-2" style={{ backgroundColor: '#F8FAFC' }}>
            <BrandPanel />

            {/* Painel direito */}
            <div className="flex flex-col items-center justify-center px-6 py-12 lg:px-14">

                {/* Logo — só mobile */}
                <div className="flex items-center gap-2 mb-8 lg:hidden">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{ backgroundColor: '#F97316' }}>
                        <Icon name="Truck" size={20} color="#fff" />
                    </div>
                    <span className="font-black text-2xl text-slate-800">LogiFlow</span>
                </div>

                <div className="w-full max-w-md">

                    {/* Título */}
                    <div className="mb-8">
                        <h1 className="text-[2.2rem] font-black text-slate-800 leading-tight">
                            {mode === 'login' && <>Bem-vindo<br /><span style={{ color: '#1E3A5F' }}>de volta.</span></>}
                            {mode === 'register' && <>Criar<br /><span style={{ color: '#1E3A5F' }}>nova conta.</span></>}
                            {mode === 'forgot' && <>Redefinir<br /><span style={{ color: '#1E3A5F' }}>sua senha.</span></>}
                        </h1>
                        <p className="text-slate-500 text-sm mt-2.5 leading-relaxed">
                            {mode === 'login' && 'Informe suas credenciais para acessar o painel logístico.'}
                            {mode === 'register' && 'Preencha os dados abaixo para criar sua conta de acesso.'}
                            {mode === 'forgot' && 'Informe seu e-mail e enviaremos um link de redefinição de senha.'}
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="flex flex-col gap-4">

                        {mode === 'register' && (
                            <Field label="Nome completo" name="name" value={form.name}
                                onChange={change} placeholder="Seu nome completo" required />
                        )}

                        <Field label="E-mail" name="email" type="email" value={form.email}
                            onChange={change} placeholder="seu@email.com" required />

                        {mode !== 'forgot' && (
                            <Field label="Senha" name="password" type="password" value={form.password}
                                onChange={change} placeholder="••••••••" required
                                hint={
                                    mode === 'login' ? (
                                        <button type="button" onClick={() => goTo('forgot')}
                                            className="text-xs font-semibold transition-colors hover:underline"
                                            style={{ color: '#1E3A5F' }}>
                                            Esqueci a senha
                                        </button>
                                    ) : null
                                }>
                                {mode === 'register' && <PasswordStrength password={form.password} />}
                            </Field>
                        )}

                        {mode === 'register' && (
                            <Field label="Confirmar senha" name="confirmPassword" type="password"
                                value={form.confirmPassword} onChange={change}
                                placeholder="Repita a senha" required />
                        )}

                        {error && <ErrorBox msg={error} />}

                        <button type="submit" disabled={loading}
                            className="w-full h-12 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 transition-all disabled:opacity-60 mt-1"
                            style={{
                                background: 'linear-gradient(135deg, #1E3A5F 0%, #2D5A8E 100%)',
                                boxShadow: '0 4px 16px rgba(30,58,95,0.30)',
                            }}>
                            {loading ? <Spinner /> : (
                                <>
                                    <Icon
                                        name={mode === 'login' ? 'LogIn' : mode === 'register' ? 'UserPlus' : 'Send'}
                                        size={16} color="#fff" />
                                    {mode === 'login' && 'Entrar na conta'}
                                    {mode === 'register' && 'Criar minha conta'}
                                    {mode === 'forgot' && 'Enviar link de redefinição'}
                                </>
                            )}
                        </button>

                        <div className="flex items-center gap-3">
                            <div className="flex-1 h-px bg-slate-200" />
                            <span className="text-xs text-slate-400 font-medium">ou</span>
                            <div className="flex-1 h-px bg-slate-200" />
                        </div>

                        {mode === 'login' && (
                            <p className="text-sm text-center text-slate-500">
                                Não tem conta?{' '}
                                <button type="button" onClick={() => goTo('register')}
                                    className="font-bold hover:underline transition-colors"
                                    style={{ color: '#F97316' }}>
                                    Criar agora →
                                </button>
                            </p>
                        )}

                        {mode === 'register' && (
                            <p className="text-sm text-center text-slate-500">
                                Já tem conta?{' '}
                                <button type="button" onClick={() => goTo('login')}
                                    className="font-bold hover:underline transition-colors"
                                    style={{ color: '#F97316' }}>
                                    Entrar →
                                </button>
                            </p>
                        )}

                        {mode === 'forgot' && (
                            <button type="button" onClick={() => goTo('login')}
                                className="text-sm text-slate-500 hover:text-slate-700 flex items-center justify-center gap-1.5 transition-colors">
                                <Icon name="ArrowLeft" size={13} color="currentColor" />
                                Voltar para o login
                            </button>
                        )}
                    </form>

                    {/* Aviso de role (só no cadastro) */}
                    {mode === 'register' && (
                        <div className="mt-5 p-3.5 rounded-xl flex items-start gap-2.5"
                            style={{ backgroundColor: '#FFFBEB', border: '1px solid #FDE68A' }}>
                            <Icon name="Info" size={14} color="#92400E" />
                            <p className="text-xs leading-relaxed" style={{ color: '#78350F' }}>
                                Novas contas são criadas como <strong>Operador</strong>.
                                Para acesso administrativo, solicite ao administrador do sistema.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
