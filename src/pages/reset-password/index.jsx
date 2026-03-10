import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from 'utils/supabaseClient';
import Icon from 'components/AppIcon';

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

export default function ResetPassword() {
    const navigate = useNavigate();
    const [password, setPassword]         = useState('');
    const [confirm, setConfirm]           = useState('');
    const [showPass, setShowPass]         = useState(false);
    const [showConf, setShowConf]         = useState(false);
    const [error, setError]               = useState('');
    const [loading, setLoading]           = useState(false);
    const [done, setDone]                 = useState(false);
    const [validSession, setValidSession] = useState(false);
    const [checking, setChecking]         = useState(true);

    useEffect(() => {
        // O Supabase processa o hash do link de reset e cria uma sessão temporária
        supabase.auth.onAuthStateChange((event) => {
            if (event === 'PASSWORD_RECOVERY') {
                setValidSession(true);
                setChecking(false);
            }
        });
        // Timeout: se após 3s não detectou o evento, link inválido/expirado
        const t = setTimeout(() => {
            setChecking(false);
        }, 3000);
        return () => clearTimeout(t);
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (password.length < 6)     { setError('A senha deve ter pelo menos 6 caracteres.'); return; }
        if (password !== confirm)    { setError('As senhas não coincidem.'); return; }

        setLoading(true);
        try {
            const { error: err } = await supabase.auth.updateUser({ password });
            if (err) throw err;
            setDone(true);
            setTimeout(() => navigate('/'), 3000);
        } catch (err) {
            setError(err.message || 'Erro ao redefinir a senha. Tente novamente.');
        } finally {
            setLoading(false);
        }
    };

    // Verificando sessão
    if (checking) {
        return (
            <Shell>
                <div className="flex flex-col items-center py-4">
                    <div className="animate-spin h-8 w-8 rounded-full border-4 border-slate-200 mb-4"
                        style={{ borderTopColor: '#1E3A5F' }} />
                    <p className="text-sm text-slate-500">Verificando link...</p>
                </div>
            </Shell>
        );
    }

    // Link inválido ou expirado
    if (!validSession) {
        return (
            <Shell>
                <div className="flex flex-col items-center text-center">
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                        style={{ background: 'linear-gradient(135deg, #FEF2F2, #FECACA)' }}>
                        <Icon name="LinkOff" size={30} color="#DC2626" />
                    </div>
                    <h2 className="text-xl font-black text-slate-800 mb-2">Link inválido ou expirado</h2>
                    <p className="text-slate-500 text-sm leading-relaxed mb-6 max-w-xs">
                        Este link de redefinição é inválido ou já expirou. Links são válidos por <strong>1 hora</strong>.
                    </p>
                    <button onClick={() => navigate('/login?mode=forgot')}
                        className="w-full h-11 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2"
                        style={{ backgroundColor: '#1E3A5F' }}>
                        <Icon name="RefreshCw" size={14} color="#fff" />
                        Solicitar novo link
                    </button>
                    <button onClick={() => navigate('/login')}
                        className="mt-3 text-sm text-slate-400 hover:text-slate-600 flex items-center gap-1.5 transition-colors">
                        <Icon name="ArrowLeft" size={12} color="currentColor" />
                        Voltar para o login
                    </button>
                </div>
            </Shell>
        );
    }

    // Senha redefinida com sucesso
    if (done) {
        return (
            <Shell>
                <div className="flex flex-col items-center text-center">
                    <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-5"
                        style={{ background: 'linear-gradient(135deg, #F0FDF4, #DCFCE7)' }}>
                        <Icon name="ShieldCheck" size={38} color="#16A34A" />
                    </div>
                    <h2 className="text-2xl font-black text-slate-800 mb-2">Senha redefinida!</h2>
                    <p className="text-slate-500 text-sm leading-relaxed mb-6">
                        Sua senha foi atualizada com sucesso.<br />
                        Redirecionando para o sistema...
                    </p>
                    <div className="flex gap-1 justify-center">
                        {[0, 1, 2].map(i => (
                            <div key={i} className="w-2 h-2 rounded-full bg-green-400 animate-bounce"
                                style={{ animationDelay: `${i * 0.15}s` }} />
                        ))}
                    </div>
                </div>
            </Shell>
        );
    }

    // Formulário de nova senha
    return (
        <Shell>
            <div className="flex flex-col items-center mb-6">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                    style={{ background: 'linear-gradient(135deg, #EFF6FF, #DBEAFE)' }}>
                    <Icon name="KeyRound" size={26} color="#1D4ED8" />
                </div>
                <h2 className="text-2xl font-black text-slate-800 text-center">Criar nova senha</h2>
                <p className="text-slate-500 text-sm text-center mt-1.5">
                    Escolha uma senha forte para proteger sua conta.
                </p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                {/* Nova senha */}
                <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nova senha</label>
                    <div className="relative">
                        <input
                            type={showPass ? 'text' : 'password'}
                            value={password}
                            onChange={e => { setPassword(e.target.value); setError(''); }}
                            placeholder="••••••••"
                            required
                            className="w-full h-11 pl-4 pr-10 rounded-xl text-sm bg-slate-50 text-slate-800 placeholder-slate-400 outline-none transition-all"
                            style={{ border: '2px solid #E2E8F0' }}
                            onFocus={e => { e.target.style.borderColor = '#1E3A5F'; e.target.style.backgroundColor = '#fff'; }}
                            onBlur={e => { e.target.style.borderColor = '#E2E8F0'; e.target.style.backgroundColor = '#F8FAFC'; }}
                        />
                        <button type="button" tabIndex={-1} onClick={() => setShowPass(s => !s)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                            <Icon name={showPass ? 'EyeOff' : 'Eye'} size={16} color="currentColor" />
                        </button>
                    </div>
                    <PasswordStrength password={password} />
                </div>

                {/* Confirmar senha */}
                <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Confirmar nova senha</label>
                    <div className="relative">
                        <input
                            type={showConf ? 'text' : 'password'}
                            value={confirm}
                            onChange={e => { setConfirm(e.target.value); setError(''); }}
                            placeholder="••••••••"
                            required
                            className="w-full h-11 pl-4 pr-10 rounded-xl text-sm bg-slate-50 text-slate-800 placeholder-slate-400 outline-none transition-all"
                            style={{ border: '2px solid #E2E8F0' }}
                            onFocus={e => { e.target.style.borderColor = '#1E3A5F'; e.target.style.backgroundColor = '#fff'; }}
                            onBlur={e => { e.target.style.borderColor = '#E2E8F0'; e.target.style.backgroundColor = '#F8FAFC'; }}
                        />
                        <button type="button" tabIndex={-1} onClick={() => setShowConf(s => !s)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                            <Icon name={showConf ? 'EyeOff' : 'Eye'} size={16} color="currentColor" />
                        </button>
                    </div>
                    {confirm && password !== confirm && (
                        <p className="text-xs mt-1.5 flex items-center gap-1" style={{ color: '#DC2626' }}>
                            <Icon name="X" size={11} color="#DC2626" /> As senhas não coincidem
                        </p>
                    )}
                    {confirm && password === confirm && password.length >= 6 && (
                        <p className="text-xs mt-1.5 flex items-center gap-1" style={{ color: '#16A34A' }}>
                            <Icon name="Check" size={11} color="#16A34A" /> Senhas coincidem
                        </p>
                    )}
                </div>

                {error && (
                    <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl text-sm"
                        style={{ backgroundColor: '#FEF2F2', color: '#991B1B', border: '1px solid #FECACA' }}>
                        <Icon name="AlertCircle" size={15} color="#DC2626" />
                        <span>{error}</span>
                    </div>
                )}

                <button type="submit" disabled={loading}
                    className="w-full h-12 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 transition-all disabled:opacity-60 mt-1"
                    style={{
                        background: 'linear-gradient(135deg, #1E3A5F 0%, #2D5A8E 100%)',
                        boxShadow: '0 4px 16px rgba(30,58,95,0.30)',
                    }}>
                    {loading ? (
                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                    ) : <Icon name="ShieldCheck" size={16} color="#fff" />}
                    {loading ? 'Salvando...' : 'Salvar nova senha'}
                </button>
            </form>
        </Shell>
    );
}

function Shell({ children }) {
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
                <div className="bg-white rounded-2xl p-8"
                    style={{ boxShadow: '0 8px 40px rgba(0,0,0,0.10)', border: '1px solid #F1F5F9' }}>
                    {children}
                </div>
            </div>
        </div>
    );
}
