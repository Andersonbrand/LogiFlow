import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from 'utils/AuthContext';
import Icon from 'components/AppIcon';

export default function Login() {
    const { signIn, signUp } = useAuth();
    const navigate = useNavigate();
    const [mode, setMode] = useState('login'); // 'login' | 'register'
    const [form, setForm] = useState({ name: '', email: '', password: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            if (mode === 'login') {
                await signIn(form.email, form.password);
            } else {
                await signUp(form.email, form.password, form.name);
            }
            navigate('/');
        } catch (err) {
            const msgs = {
                'Invalid login credentials': 'E-mail ou senha incorretos.',
                'User already registered': 'Este e-mail já está cadastrado.',
                'Password should be at least 6 characters': 'A senha deve ter pelo menos 6 caracteres.',
                'Email not confirmed': 'Confirme seu e-mail antes de entrar.',
            };
            setError(msgs[err.message] || err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: 'var(--color-background)' }}>
            <div className="w-full max-w-md">

                {/* Logo */}
                <div className="flex flex-col items-center mb-8">
                    <div className="flex items-center justify-center rounded-2xl mb-4" style={{ width: 56, height: 56, backgroundColor: 'var(--color-primary)' }}>
                        <Icon name="Truck" size={28} color="#fff" />
                    </div>
                    <h1 className="font-heading font-bold text-3xl" style={{ color: 'var(--color-primary)' }}>LogiFlow</h1>
                    <p className="text-sm mt-1 font-caption" style={{ color: 'var(--color-muted-foreground)' }}>Gestão Logística Inteligente</p>
                </div>

                {/* Card */}
                <div className="bg-white rounded-2xl shadow-elevated p-8 border" style={{ borderColor: 'var(--color-border)' }}>
                    <h2 className="font-heading font-bold text-xl mb-1" style={{ color: 'var(--color-text-primary)' }}>
                        {mode === 'login' ? 'Entrar na conta' : 'Criar conta'}
                    </h2>
                    <p className="text-sm mb-6 font-caption" style={{ color: 'var(--color-muted-foreground)' }}>
                        {mode === 'login' ? 'Acesse o painel de controle logístico' : 'Preencha os dados para começar'}
                    </p>

                    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                        {mode === 'register' && (
                            <div>
                                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-primary)' }}>Nome completo</label>
                                <input
                                    name="name"
                                    type="text"
                                    required
                                    value={form.name}
                                    onChange={handleChange}
                                    placeholder="Seu nome"
                                    className="w-full h-10 px-3 rounded-lg border text-sm focus:outline-none focus:ring-2 transition-all"
                                    style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)', color: 'var(--color-text-primary)', '--tw-ring-color': 'var(--color-ring)' }}
                                />
                            </div>
                        )}
                        <div>
                            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-primary)' }}>E-mail</label>
                            <input
                                name="email"
                                type="email"
                                required
                                value={form.email}
                                onChange={handleChange}
                                placeholder="seu@email.com"
                                className="w-full h-10 px-3 rounded-lg border text-sm focus:outline-none focus:ring-2 transition-all"
                                style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)', color: 'var(--color-text-primary)' }}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-primary)' }}>Senha</label>
                            <input
                                name="password"
                                type="password"
                                required
                                value={form.password}
                                onChange={handleChange}
                                placeholder="••••••••"
                                className="w-full h-10 px-3 rounded-lg border text-sm focus:outline-none focus:ring-2 transition-all"
                                style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)', color: 'var(--color-text-primary)' }}
                            />
                        </div>

                        {error && (
                            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm" style={{ backgroundColor: '#FEF2F2', color: 'var(--color-destructive)', border: '1px solid #FECACA' }}>
                                <Icon name="AlertCircle" size={15} color="currentColor" />
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full h-11 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-60"
                            style={{ backgroundColor: 'var(--color-primary)', color: '#fff' }}
                        >
                            {loading ? (
                                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                            ) : (
                                <Icon name={mode === 'login' ? 'LogIn' : 'UserPlus'} size={16} color="#fff" />
                            )}
                            {loading ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Criar conta'}
                        </button>
                    </form>

                    <div className="mt-5 text-center text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
                        {mode === 'login' ? (
                            <>Não tem conta?{' '}
                                <button onClick={() => { setMode('register'); setError(''); }} className="font-medium hover:underline" style={{ color: 'var(--color-primary)' }}>
                                    Criar agora
                                </button>
                            </>
                        ) : (
                            <>Já tem conta?{' '}
                                <button onClick={() => { setMode('login'); setError(''); }} className="font-medium hover:underline" style={{ color: 'var(--color-primary)' }}>
                                    Entrar
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
