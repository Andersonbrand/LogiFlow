'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AppLogo from '@/components/ui/AppLogo';
import AppIcon from '@/components/ui/AppIcon';
import { useAuth } from '@/context/AuthContext';
import toast from 'react-hot-toast';

export default function RegisterPage() {
  const [form, setForm]                 = useState({ name: '', email: '', password: '', confirm: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]           = useState(false);
  const { signUp }                      = useAuth();
  const router                          = useRouter();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirm) { toast.error('As senhas não coincidem.'); return; }
    if (form.password.length < 6)       { toast.error('Senha mínima de 6 caracteres.'); return; }
    setLoading(true);
    const { error } = await signUp(form.email, form.password, form.name);
    setLoading(false);
    if (error) { toast.error(error); }
    else        { toast.success('Cadastro realizado! Verifique seu e-mail.'); router.push('/login'); }
  };

  return (
    <main className="min-h-screen bg-surface flex items-center justify-center relative overflow-hidden px-4 py-10">
      <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-primary/6 rounded-full blur-[140px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        <div className="glass rounded-3xl p-8 md:p-10 shadow-red-xl border border-primary/8 bg-white">
          <div className="flex flex-col items-center mb-8 space-y-3">
            <AppLogo size={56} forceCompany={null} />
            <div className="text-center">
              <p className="font-bold text-xl tracking-tight text-foreground" style={{ fontFamily: "Georgia, serif" }}>
                Grupo <span className="text-foreground">HC</span>
              </p>
              <p className="text-[9px] uppercase tracking-[0.3em] text-muted font-medium mt-0.5">
                Hugo Costa · Confiança & Responsabilidade
              </p>
            </div>
            <div className="flex gap-2">
              {[{n:'Araguaia',c:'#af1518'},{n:'Confiance',c:'#1a3a6b'},{n:'Aços',c:'#b04d00'}].map(co => (
                <span key={co.n} className="text-[9px] font-bold px-2 py-0.5 rounded-full border"
                  style={{color:co.c, borderColor:`${co.c}30`, backgroundColor:`${co.c}08`}}>{co.n}</span>
              ))}
            </div>
            <div className="pt-2 text-center">
              <h1 className="text-2xl font-bold text-foreground tracking-tight">Criar conta</h1>
              <p className="text-sm text-muted mt-1">Cadastre-se para acompanhar seus pedidos</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {[
              { label: 'Nome completo', name: 'name',  type: 'text',  icon: 'UserIcon',     placeholder: 'João da Silva' },
              { label: 'E-mail',        name: 'email', type: 'email', icon: 'EnvelopeIcon', placeholder: 'seu@email.com.br' },
            ].map((f) => (
              <div key={f.name} className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-[0.15em] font-bold text-muted">{f.label}</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted"><AppIcon name={f.icon} size={16} /></span>
                  <input type={f.type} name={f.name} value={(form as any)[f.name]} onChange={handleChange}
                    placeholder={f.placeholder} required
                    className="w-full pl-10 pr-4 py-3.5 rounded-xl border border-border bg-white text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all" />
                </div>
              </div>
            ))}

            {['password', 'confirm'].map((name) => (
              <div key={name} className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-[0.15em] font-bold text-muted">
                  {name === 'password' ? 'Senha' : 'Confirmar senha'}
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted"><AppIcon name="LockClosedIcon" size={16} /></span>
                  <input type={showPassword ? 'text' : 'password'} name={name}
                    value={(form as any)[name]} onChange={handleChange} placeholder="••••••••" required
                    className="w-full pl-10 pr-12 py-3.5 rounded-xl border border-border bg-white text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all" />
                  {name === 'password' && (
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-muted hover:text-foreground transition-colors">
                      <AppIcon name={showPassword ? 'EyeSlashIcon' : 'EyeIcon'} size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))}

            <button type="submit" disabled={loading}
              className="w-full py-3.5 rounded-xl bg-primary text-white text-[12px] font-bold uppercase tracking-widest hover:bg-primary-dark transition-all shadow-red-lg disabled:opacity-60 flex items-center justify-center gap-2">
              {loading
                ? <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>Criando conta...</>
                : 'Criar Conta'}
            </button>
          </form>

          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-border" />
            <span className="text-[11px] text-muted font-medium">ou</span>
            <div className="flex-1 h-px bg-border" />
          </div>
          <p className="text-center text-sm text-muted">
            Já tem uma conta?{' '}
            <Link href="/login" className="text-primary font-bold hover:text-primary-dark transition-colors">Entrar</Link>
          </p>
        </div>
        <div className="text-center mt-6">
          <Link href="/products" className="inline-flex items-center gap-2 text-[12px] text-muted hover:text-primary font-semibold transition-colors">
            <AppIcon name="ArrowLeftIcon" size={14} />
            Voltar para a loja
          </Link>
        </div>
      </div>
    </main>
  );
}
