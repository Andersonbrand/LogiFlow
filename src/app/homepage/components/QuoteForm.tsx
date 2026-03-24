'use client';

import React, { useState } from 'react';
import AppIcon from '@/components/ui/AppIcon';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';

const CATEGORIES = ['Cimento & Argamassa', 'Vergalhões & Aço', 'Ferragens', 'Serralheria', 'Múltiplas categorias'];

interface FormData {
    name: string; company: string; email: string;
    phone: string; category: string; message: string;
}
const EMPTY: FormData = { name: '', company: '', email: '', phone: '', category: '', message: '' };

export default function QuoteForm() {
    const [form, setForm]           = useState<FormData>(EMPTY);
    const [submitted, setSubmitted] = useState(false);
    const [loading, setLoading]     = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const { error } = await supabase.from('quotes').insert([{
                name: form.name, company: form.company || null,
                email: form.email, phone: form.phone,
                category: form.category, message: form.message,
            }]);
            if (error) throw error;
            setSubmitted(true);
            toast.success('Orçamento enviado com sucesso!');
        } catch {
            toast.error('Erro ao enviar. Tente novamente.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <section id="orcamento" className="py-32 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-white to-accent/3 -z-10" />
            <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] -z-10" />

            <div className="max-w-6xl mx-auto px-6">
                <div className="text-center mb-16 space-y-4">
                    <span className="text-[10px] uppercase tracking-[0.4em] font-bold text-primary">Orçamento Grátis</span>
                    <h2 className="text-5xl md:text-6xl font-bold tracking-tight text-foreground">
                        Solicite seu{' '}
                        <span className="font-display italic text-gradient-red">orçamento</span>
                        <br />sem compromisso.
                    </h2>
                    <p className="text-lg text-muted max-w-xl mx-auto">
                        Preencha o formulário e nossa equipe retornará em até 2 horas úteis com os melhores preços.
                    </p>
                </div>

                <div className="glass rounded-3xl p-8 md:p-14 shadow-red-xl border border-primary/8">
                    {submitted ? (
                        <div className="text-center py-16 space-y-6">
                            <div className="w-20 h-20 rounded-full bg-green-50 border border-green-200 flex items-center justify-center mx-auto">
                                <AppIcon name="CheckCircleIcon" size={40} className="text-green-500" variant="solid" />
                            </div>
                            <h3 className="text-3xl font-bold text-foreground">Solicitação Enviada!</h3>
                            <p className="text-muted max-w-md mx-auto">
                                Nossa equipe entrará em contato em breve pelo WhatsApp ou e-mail informado.
                            </p>
                            <button onClick={() => { setSubmitted(false); setForm(EMPTY); }}
                                className="px-8 py-3 rounded-xl bg-primary text-white font-bold text-sm hover:bg-primary-dark transition-all">
                                Nova Solicitação
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-10">
                            <div className="grid md:grid-cols-2 gap-x-12 gap-y-8">
                                {[
                                    { label: 'Nome Completo *',        name: 'name',    type: 'text',  required: true,  placeholder: 'João da Silva' },
                                    { label: 'Empresa / Obra',         name: 'company', type: 'text',  required: false, placeholder: 'Construtora Exemplo Ltda' },
                                    { label: 'E-mail *',               name: 'email',   type: 'email', required: true,  placeholder: 'joao@empresa.com.br' },
                                    { label: 'Telefone / WhatsApp *',  name: 'phone',   type: 'tel',   required: true,  placeholder: '(77) 9 8104-6133' },
                                ].map((field) => (
                                    <div key={field.name}>
                                        <label className="text-[10px] uppercase tracking-[0.25em] font-bold text-muted block mb-3">{field.label}</label>
                                        <input type={field.type} name={field.name} required={field.required}
                                            value={(form as any)[field.name]} onChange={handleChange}
                                            placeholder={field.placeholder} className="form-input" />
                                    </div>
                                ))}
                                <div className="md:col-span-2">
                                    <label className="text-[10px] uppercase tracking-[0.25em] font-bold text-muted block mb-3">Categoria de Materiais *</label>
                                    <select name="category" required value={form.category} onChange={handleChange} className="form-input bg-transparent cursor-pointer">
                                        <option value="" disabled>Selecione uma categoria...</option>
                                        {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                                <div className="md:col-span-2">
                                    <label className="text-[10px] uppercase tracking-[0.25em] font-bold text-muted block mb-3">Descreva sua Necessidade *</label>
                                    <textarea name="message" required rows={4} value={form.message} onChange={handleChange}
                                        placeholder="Descreva os materiais, quantidades e prazo desejado..."
                                        className="form-input resize-none" />
                                </div>
                            </div>

                            <div className="flex flex-col sm:flex-row items-center gap-6">
                                <button type="submit" disabled={loading}
                                    className="w-full sm:w-auto px-12 py-4 rounded-xl bg-primary text-white font-bold text-sm uppercase tracking-widest hover:bg-primary-dark transition-all shadow-red-lg disabled:opacity-60 flex items-center justify-center gap-3">
                                    {loading
                                        ? <><svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Enviando...</>
                                        : <><AppIcon name="PaperAirplaneIcon" size={16} />Solicitar Orçamento</>}
                                </button>
                                <p className="text-[11px] text-muted text-center sm:text-left">
                                    Retorno em até <strong className="text-foreground">2 horas úteis</strong>. Sem compromisso.
                                </p>
                            </div>
                        </form>
                    )}
                </div>

                {/* Contact cards */}
                <div className="mt-12 grid sm:grid-cols-3 gap-6">
                    {[
                        { icon: 'ChatBubbleLeftRightIcon', label: 'WhatsApp', value: '(77) 9 8104-6133',                   sub: 'Resposta imediata', href: 'https://wa.me/5577981046133' },
                        { icon: 'EnvelopeIcon',            label: 'E-mail',   value: 'comercialaraguaia2018@outlook.com',  sub: 'Resposta em 24h',    href: 'mailto:comercialaraguaia2018@outlook.com' },
                        { icon: 'MapPinIcon',              label: 'Endereço', value: 'Guanambi / Bahia',                  sub: 'Seg–Sex 8h–18h · Sáb 8h–12h', href: '#' },
                    ].map((item) => (
                        <a key={item.label} href={item.href} target={item.href.startsWith('http') ? '_blank' : undefined}
                            rel="noopener noreferrer"
                            className="flex items-center gap-4 p-6 rounded-2xl bg-white border border-border hover:border-primary/30 hover:shadow-red-lg transition-all group">
                            <div className="w-12 h-12 rounded-xl bg-primary/8 flex items-center justify-center group-hover:bg-primary transition-colors shrink-0">
                                <AppIcon name={item.icon} size={20} className="text-primary group-hover:text-white transition-colors" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[10px] uppercase tracking-widest font-bold text-muted">{item.label}</p>
                                <p className="text-sm font-bold text-foreground truncate">{item.value}</p>
                                <p className="text-[11px] text-muted">{item.sub}</p>
                            </div>
                        </a>
                    ))}
                </div>
            </div>
        </section>
    );
}
