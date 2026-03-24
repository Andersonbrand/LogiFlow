'use client';

import React, { useState, useEffect } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import AppIcon from '@/components/ui/AppIcon';
import AppLogo from '@/components/ui/AppLogo';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { UserProfile, QuoteResponse } from '@/lib/supabase';
import toast from 'react-hot-toast';

type Tab = 'profile' | 'responses';

const BR_STATES = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA',
  'MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN',
  'RS','RO','RR','SC','SP','SE','TO'
];

export default function PerfilPage() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [tab, setTab]                  = useState<Tab>('profile');
  const [profile, setProfile]          = useState<Partial<UserProfile>>({});
  const [responses, setResponses]      = useState<QuoteResponse[]>([]);
  const [loading, setLoading]          = useState(true);
  const [saving, setSaving]            = useState(false);
  const [unread, setUnread]            = useState(0);
  const [sentReplies, setSentReplies]  = useState<any[]>([]);

  useEffect(() => {
    // Aguarda o AuthContext terminar de carregar o usuário
    if (authLoading) return;
    if (!user?.email) return;

    const supabase = createClient();

    const loadData = async () => {
      setLoading(true);

      // Perfil do usuário
      const { data: profileData } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      setProfile(profileData ?? {
        id:        user.id,
        full_name: user.user_metadata?.full_name ?? '',
      });

      if (isAdmin) {
        // Admin: carrega respostas que ELE enviou (sem filtro de email)
        const { data: sentData } = await supabase
          .from('quote_responses')
          .select('*')
          .order('created_at', { ascending: false });
        setSentReplies(sentData ?? []);
      } else {
        // Usuário normal: respostas recebidas para o email dele
        const { data: respData, error: respError } = await supabase
          .from('quote_responses')
          .select('*')
          .eq('customer_email', user.email)
          .order('created_at', { ascending: false });
        if (respError) {
          console.error('Erro ao buscar respostas:', respError.message);
        } else {
          const resp = respData ?? [];
          setResponses(resp);
          setUnread(resp.filter((r) => r.status === 'sent').length);
        }
      }

      setLoading(false);
    };

    loadData();
  }, [user, authLoading]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setProfile((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from('user_profiles').upsert(
      { ...profile, id: user.id, updated_at: new Date().toISOString() },
      { onConflict: 'id' }
    );
    setSaving(false);
    if (error) { toast.error('Erro ao salvar: ' + error.message); return; }
    toast.success('Perfil atualizado!');
  };

  const markRead = async (id: string) => {
    const supabase = createClient();
    const { error } = await supabase
      .from('quote_responses')
      .update({ status: 'read' })
      .eq('id', id);
    if (error) { console.error('Erro ao marcar lida:', error.message); return; }
    setResponses((prev) => prev.map((r) => r.id === id ? { ...r, status: 'read' as const } : r));
    setUnread((n) => Math.max(0, n - 1));
  };

  const profileFields = [
    { label: 'Nome completo',        name: 'full_name',      type: 'text', placeholder: 'João da Silva',    col: 2 },
    { label: 'Telefone / WhatsApp',  name: 'phone',          type: 'tel',  placeholder: '(77) 9 8765-4321', col: 1 },
    { label: 'Data de nascimento',   name: 'birth_date',     type: 'date', placeholder: '',                  col: 1 },
    { label: 'Rua / Avenida',        name: 'address_street', type: 'text', placeholder: 'Rua das Flores',    col: 2 },
    { label: 'Número',               name: 'address_number', type: 'text', placeholder: '123',               col: 1 },
    { label: 'Complemento',          name: 'address_comp',   type: 'text', placeholder: 'Apto 2',            col: 1 },
    { label: 'Cidade',               name: 'address_city',   type: 'text', placeholder: 'Guanambi',          col: 1 },
    { label: 'CEP',                  name: 'address_zip',    type: 'text', placeholder: '46430-000',          col: 1 },
  ];

  if (authLoading) {
    return (
      <main className="min-h-screen bg-surface">
        <Header />
        <div className="pt-40 flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-surface">
      <Header />

      <div className="pt-28 pb-20 max-w-5xl mx-auto px-6">
        {/* Header do perfil */}
        <div className="bg-white rounded-3xl p-8 border border-border shadow-sm mb-6">
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 rounded-2xl bg-primary/10 border-2 border-primary/20 flex items-center justify-center shrink-0">
              <AppIcon name="UserIcon" size={36} className="text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-foreground truncate">
                {profile.full_name || user?.user_metadata?.full_name || 'Meu Perfil'}
              </h1>
              <p className="text-muted text-sm mt-1">{user?.email}</p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className="badge bg-primary/8 text-primary border border-primary/20 text-[10px]">Cliente</span>
                {unread > 0 && (
                  <span className="badge bg-primary text-white text-[10px] animate-pulse">
                    {unread} resposta{unread > 1 ? 's' : ''} nova{unread > 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>
            <AppLogo size={40} className="hidden sm:block opacity-20" />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {[
            { id: 'profile'   as Tab, label: 'Meu Perfil',                                        icon: 'UserIcon'           },
            { id: 'responses' as Tab, label: isAdmin ? 'Respostas Enviadas' : 'Minhas Respostas', icon: 'PaperAirplaneIcon', badge: isAdmin ? undefined : unread },
          ].map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all border ${
                tab === t.id
                  ? 'bg-primary text-white border-primary shadow-red-lg'
                  : 'bg-white text-muted border-border hover:border-primary/30 hover:text-primary'
              }`}>
              <AppIcon name={t.icon} size={16} />
              {t.label}
              {t.badge ? (
                <span className={`ml-1 w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center ${tab === t.id ? 'bg-white text-primary' : 'bg-primary text-white'}`}>
                  {t.badge}
                </span>
              ) : null}
            </button>
          ))}
        </div>

        {/* ── PERFIL ── */}
        {tab === 'profile' && (
          <div className="bg-white rounded-3xl p-8 border border-border shadow-sm">
            <h2 className="text-lg font-bold text-foreground mb-6">Dados Pessoais</h2>
            {loading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-12 bg-surface rounded-xl animate-pulse" />
                ))}
              </div>
            ) : (
              <form onSubmit={handleSave} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {profileFields.map((f) => (
                    <div key={f.name} className={f.col === 2 ? 'md:col-span-2' : ''}>
                      <label className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted block mb-2">
                        {f.label}
                      </label>
                      <input
                        type={f.type}
                        name={f.name}
                        value={(profile as any)[f.name] ?? ''}
                        onChange={handleChange}
                        placeholder={f.placeholder}
                        className="w-full px-4 py-3 rounded-xl border border-border bg-white text-sm text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
                      />
                    </div>
                  ))}

                  {/* Estado */}
                  <div>
                    <label className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted block mb-2">
                      Estado
                    </label>
                    <select
                      name="address_state"
                      value={profile.address_state ?? ''}
                      onChange={handleChange}
                      className="w-full px-4 py-3 rounded-xl border border-border bg-white text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
                    >
                      <option value="">Selecione...</option>
                      {BR_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button type="submit" disabled={saving}
                    className="px-10 py-3.5 rounded-xl bg-primary text-white font-bold text-sm hover:bg-primary-dark transition-all shadow-red-lg disabled:opacity-60 flex items-center gap-2">
                    {saving
                      ? <><svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Salvando...</>
                      : <><AppIcon name="CheckIcon" size={16} />Salvar Alterações</>}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* ── RESPOSTAS ── */}
        {tab === 'responses' && (
          <div className="space-y-4">
            {isAdmin ? (
              /* Admin: vê respostas que ELE enviou */
              <>
                {loading ? (
                  <div className="bg-white rounded-3xl p-8 border border-border">
                    <div className="space-y-4">{[...Array(2)].map((_,i) => <div key={i} className="h-24 bg-surface rounded-2xl animate-pulse" />)}</div>
                  </div>
                ) : sentReplies.length === 0 ? (
                  <div className="bg-white rounded-3xl p-16 border border-border text-center">
                    <div className="w-16 h-16 rounded-2xl bg-primary/8 flex items-center justify-center mx-auto mb-4">
                      <AppIcon name="PaperAirplaneIcon" size={32} className="text-primary" />
                    </div>
                    <p className="font-bold text-foreground text-lg">Nenhuma resposta enviada ainda</p>
                    <p className="text-muted text-sm mt-2 max-w-sm mx-auto">
                      Responda solicitações pelo Painel Admin e elas aparecerão aqui.
                    </p>
                  </div>
                ) : sentReplies.map((reply: any) => (
                  <div key={reply.id} className="bg-white rounded-3xl p-6 border border-border shadow-sm">
                    <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
                      <div>
                        <p className="font-bold text-foreground">{reply.customer_name}</p>
                        <p className="text-sm text-muted">{reply.customer_email}</p>
                        <p className="text-[11px] text-muted">{new Date(reply.created_at).toLocaleString('pt-BR')}</p>
                      </div>
                      <span className={`badge text-[9px] border ${reply.status === 'read' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                        {reply.status === 'read' ? '✓ Lida pelo cliente' : '→ Enviada'}
                      </span>
                    </div>
                    {reply.message && (
                      <div className="bg-surface rounded-2xl p-4 mb-3 border border-border">
                        <p className="text-[10px] uppercase tracking-widest font-bold text-muted mb-1">Mensagem</p>
                        <p className="text-sm text-foreground leading-relaxed">{reply.message}</p>
                      </div>
                    )}
                    {reply.products_summary && reply.products_summary.length > 0 && (
                      <div className="mb-3">
                        <p className="text-[10px] uppercase tracking-widest font-bold text-muted mb-2">Produtos cotados</p>
                        <div className="flex flex-wrap gap-2">
                          {reply.products_summary.map((p: any, i: number) => (
                            <div key={i} className="flex items-center gap-1.5 bg-surface border border-border rounded-xl px-3 py-1.5 text-sm">
                              <span className="font-bold text-foreground">{p.name}</span>
                              {p.price > 0 && <span className="text-primary font-bold ml-1">R$ {Number(p.price).toFixed(2).replace('.', ',')}</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {reply.pdf_url && (
                      <a href={reply.pdf_url} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-border text-[11px] font-bold text-muted hover:text-primary hover:border-primary/30 transition-all">
                        <AppIcon name="DocumentArrowDownIcon" size={13} />
                        {reply.pdf_name ?? 'Ver PDF'}
                      </a>
                    )}
                  </div>
                ))}
              </>
            ) : (
              /* Usuário normal: respostas RECEBIDAS */
              <>
                {loading ? (
                  <div className="bg-white rounded-3xl p-8 border border-border">
                    <div className="space-y-4">
                      {[...Array(2)].map((_, i) => (
                        <div key={i} className="h-32 bg-surface rounded-2xl animate-pulse" />
                      ))}
                    </div>
                  </div>
                ) : responses.length === 0 ? (
                  <div className="bg-white rounded-3xl p-16 border border-border text-center">
                    <div className="w-16 h-16 rounded-2xl bg-primary/8 flex items-center justify-center mx-auto mb-4">
                      <AppIcon name="DocumentTextIcon" size={32} className="text-primary" />
                    </div>
                    <p className="font-bold text-foreground text-lg">Nenhuma resposta ainda</p>
                    <p className="text-muted text-sm mt-2 max-w-sm mx-auto">
                      Quando o comercial responder sua solicitação, a resposta aparecerá aqui.
                    </p>
                  </div>
                ) : responses.map((resp) => (
                  <div key={resp.id}
                    className={`bg-white rounded-3xl p-6 border transition-all ${resp.status === 'sent' ? 'border-primary/30 shadow-red-lg' : 'border-border'}`}>
                    <div className="flex items-start justify-between gap-4 mb-5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                          <AppLogo size={24} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-foreground text-sm">Grupo HC</p>
                            {resp.status === 'sent' && <span className="badge bg-primary text-white text-[9px]">Nova</span>}
                          </div>
                          <p className="text-[11px] text-muted">{new Date(resp.created_at).toLocaleString('pt-BR')}</p>
                        </div>
                      </div>
                      {resp.status === 'sent' && (
                        <button onClick={() => markRead(resp.id)}
                          className="text-[11px] text-muted hover:text-primary font-medium transition-colors shrink-0 flex items-center gap-1">
                          <AppIcon name="CheckIcon" size={12} />
                          Marcar como lida
                        </button>
                      )}
                    </div>
                    {resp.message && (
                      <div className="bg-surface rounded-2xl p-5 mb-4 border border-border">
                        <p className="text-[10px] uppercase tracking-widest font-bold text-muted mb-2">Mensagem</p>
                        <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{resp.message}</p>
                      </div>
                    )}
                    {resp.products_summary && resp.products_summary.length > 0 && resp.request_type === 'cart' && (
                      <div className="mb-4">
                        <p className="text-[10px] uppercase tracking-widest font-bold text-muted mb-3">Itens do Orçamento</p>
                        <div className="border border-border rounded-2xl overflow-hidden">
                          {resp.products_summary.map((item: any, i: number) => (
                            <div key={i} className="flex items-center justify-between px-4 py-3 border-b border-border/50 last:border-0">
                              <span className="text-sm text-foreground font-medium">
                                {item.quantity}× {item.name}
                                <span className="text-muted text-[11px] ml-1">/ {item.unit}</span>
                              </span>
                              <span className="text-sm font-bold text-primary">
                                R$ {Number(item.total ?? item.price * item.quantity).toFixed(2).replace('.', ',')}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {resp.observations && (
                      <div className="mb-4 p-4 rounded-xl bg-blue-50 border border-blue-200">
                        <p className="text-[10px] uppercase tracking-widest font-bold text-accent mb-1">Observações</p>
                        <p className="text-sm text-foreground leading-relaxed">{resp.observations}</p>
                      </div>
                    )}
                    {resp.requirements && (
                      <div className="mb-4 p-4 rounded-xl bg-amber-50 border border-amber-200">
                        <p className="text-[10px] uppercase tracking-widest font-bold text-amber-700 mb-1">Para Finalizar a Compra</p>
                        <p className="text-sm text-foreground leading-relaxed">{resp.requirements}</p>
                      </div>
                    )}
                    {resp.pdf_url && (
                      <div className="flex items-center gap-3 p-4 rounded-xl bg-surface border border-border mb-4">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                          <AppIcon name="DocumentTextIcon" size={20} className="text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-foreground truncate">{resp.pdf_name ?? 'Orçamento.pdf'}</p>
                          <p className="text-[11px] text-muted">Documento PDF anexado</p>
                        </div>
                        <div className="flex gap-2">
                          <a href={resp.pdf_url} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-border text-sm font-bold text-muted hover:text-primary hover:border-primary/30 transition-all">
                            <AppIcon name="EyeIcon" size={14} />
                            <span className="hidden sm:inline">Visualizar</span>
                          </a>
                          <a href={resp.pdf_url} download={resp.pdf_name ?? 'orcamento.pdf'}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary-dark transition-all shadow-red-lg">
                            <AppIcon name="ArrowDownTrayIcon" size={14} />
                            <span className="hidden sm:inline">Baixar</span>
                          </a>
                        </div>
                      </div>
                    )}
                    <div className="pt-4 border-t border-border/40 flex items-center justify-between">
                      <p className="text-[11px] text-muted">Dúvidas? Entre em contato com nossa equipe.</p>
                      <a href="https://wa.me/5577981046133?text=Olá! Recebi a resposta do meu orçamento e gostaria de continuar."
                        target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surface border border-border hover:border-primary/30 hover:bg-primary/5 text-sm font-bold text-muted hover:text-primary transition-all">
                        <AppIcon name="ChatBubbleLeftRightIcon" size={16} />
                        WhatsApp
                      </a>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>
      <Footer />
    </main>
  );
}
