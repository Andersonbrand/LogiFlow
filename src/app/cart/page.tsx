'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import AppImage from '@/components/ui/AppImage';
import AppIcon from '@/components/ui/AppIcon';
import { useCart } from '@/context/CartContext';
import QuantityInput from '@/components/ui/QuantityInput';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { COMPANIES, CompanyId, SHARED_CATEGORIES } from '@/context/CompanyContext';
import toast from 'react-hot-toast';

function pluralUnit(unit: string, qty: number): string {
  if (qty <= 1) return unit;
  const noChange = ['kg', 'litro', 'litros', 'metro', 'metros', 'm²', 'm³'];
  if (noChange.includes(unit.toLowerCase())) return unit;
  if (unit.endsWith('ão')) return unit.replace(/ão$/, 'ões');
  if (unit.endsWith('al')) return unit.replace(/al$/, 'ais');
  if (unit.endsWith('m'))  return unit.replace(/m$/, 'ns');
  if (unit.endsWith('r') || unit.endsWith('z')) return unit + 'es';
  return unit + 's';
}

// Categorias por empresa para inferir de qual empresa é o produto
const COMPANY_CATEGORIES: Record<CompanyId, string[]> = {
  'araguaia':            ['Cimento', 'Vergalhões', 'Barras e Perfis', 'Tubos', 'Chapas', 'Parafusos', 'Arames', 'Aços Planos', 'Ferragens', 'Serralheria'],
  'acos-confiance':      ['Vergalhões', 'Barras e Perfis', 'Tubos', 'Chapas', 'Arames', 'Aços Planos', 'Serralheria'],
  'confiance-industria': ['Telhas', 'Bobinas de Zinco', 'Colunas', 'Treliças', 'Colunas e Treliças'],
};

function inferCompanies(product: any): CompanyId[] {
  // 1. Campo companies[] do banco (após migration)
  if (product.companies && Array.isArray(product.companies) && product.companies.length > 0) {
    return product.companies as CompanyId[];
  }
  // 2. Campo company singular
  if (product.company && product.company in COMPANIES) return [product.company as CompanyId];
  // 3. Fallback: categorias EXATAS por empresa (múltiplas se compartilhada)
  const matched: CompanyId[] = [];
  for (const [id, cats] of Object.entries(COMPANY_CATEGORIES)) {
    if (cats.some((cat: string) => cat.toLowerCase() === product.category?.toLowerCase())) {
      matched.push(id as CompanyId);
    }
  }
  return matched.length > 0 ? matched : ['araguaia'];
}

function inferCompany(category: string, productCompany?: string): CompanyId {
  if (productCompany && productCompany in COMPANIES) return productCompany as CompanyId;
  for (const [id, cats] of Object.entries(COMPANY_CATEGORIES)) {
    if (cats.some((c: string) => category.toLowerCase().includes(c.toLowerCase()))) return id as CompanyId;
  }
  return 'araguaia';
}

interface CheckoutForm { name: string; email: string; phone: string; observation: string; }

export default function CartPage() {
  const { items, totalItems, subtotal, removeFromCart, updateQuantity, clearCart } = useCart();
  const { user } = useAuth();
  const [done, setDone]           = useState(false);
  const [loading, setLoading]     = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [form, setForm]           = useState<CheckoutForm>({
    name: user?.user_metadata?.full_name ?? '',
    email: user?.email ?? '',
    phone: '', observation: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  // Agrupar itens por empresa
  // Agrupa por empresa: se o produto pertence a múltiplas, usa a primeira da lista
  // (a ordem em COMPANY_CATEGORIES define a prioridade: araguaia, acos-confiance, confiance)
  const groupedByCompany = items.reduce((acc, item) => {
    const companies = inferCompanies(item.product);
    const compId = companies[0]; // empresa principal (ou única)
    if (!acc[compId]) acc[compId] = [];
    acc[compId].push({ ...item, _allCompanies: companies });
    return acc;
  }, {} as Record<string, Array<typeof items[0] & { _allCompanies: CompanyId[] }>>);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!items.length) return;
    setLoading(true);
    try {
      const orderItems = items.map((i) => ({
        product_id: i.product.id,
        name: i.product.name,
        price: i.product.price,
        quantity: i.quantity,
        unit: i.product.unit,
        company: inferCompany(i.product.category, (i.product as any).company),
      }));
      const { error } = await supabase.from('orders').insert([{
        user_id: user?.id ?? null,
        items: orderItems,
        total: subtotal,
        customer_name: form.name,
        customer_email: form.email,
        customer_phone: form.phone,
        status: 'pending',
      }]);
      if (error) throw error;
      clearCart();
      setDone(true);
      toast.success('Solicitação de orçamento enviada!');
    } catch {
      toast.error('Erro ao enviar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <main className="min-h-screen bg-white">
        <Header />
        <section className="min-h-screen flex items-center justify-center pt-28 pb-16">
          <div className="text-center space-y-6 max-w-md mx-auto px-6">
            <div className="w-24 h-24 rounded-full bg-green-50 border-2 border-green-200 flex items-center justify-center mx-auto">
              <AppIcon name="CheckCircleIcon" size={48} className="text-green-500" variant="solid" />
            </div>
            <h2 className="text-3xl font-bold text-foreground">Orçamento Solicitado!</h2>
            <p className="text-muted leading-relaxed">Nossa equipe retornará em breve pelo WhatsApp ou e-mail com os valores.</p>
            <a href="https://wa.me/5577981046133" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-primary text-white text-[12px] font-bold uppercase tracking-widest hover:bg-primary-dark transition-all shadow-red-lg">
              <AppIcon name="ChatBubbleLeftRightIcon" size={16} />Falar no WhatsApp
            </a>
            <div><Link href="/products" className="text-sm text-muted hover:text-primary transition-colors font-medium">Continuar comprando</Link></div>
          </div>
        </section>
        <Footer />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white">
      <Header />
      <section className="relative pt-28 pb-20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/4 via-white to-white -z-10" />

        <div className="max-w-6xl mx-auto px-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-10 flex-wrap gap-4">
            <div>
              <span className="text-[10px] uppercase tracking-[0.4em] font-bold text-primary">Meu Orçamento</span>
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground mt-2">Produtos selecionados</h1>
              <p className="text-muted mt-2 text-base">
                {totalItems > 0
                  ? `${totalItems} produto${totalItems > 1 ? 's' : ''} — envie para receber os preços`
                  : 'Sua lista de orçamento está vazia'}
              </p>
            </div>
            {items.length > 0 && (
              <div>
                {!showClearConfirm ? (
                  <button onClick={() => setShowClearConfirm(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl border border-red-200 text-red-600 text-xs font-bold hover:bg-red-50 transition-all">
                    <AppIcon name="TrashIcon" size={14} />
                    Limpar carrinho
                  </button>
                ) : (
                  <div className="flex items-center gap-2 p-3 rounded-xl border border-red-200 bg-red-50">
                    <span className="text-xs font-bold text-red-700">Confirmar?</span>
                    <button onClick={() => { clearCart(); setShowClearConfirm(false); toast.success('Carrinho limpo!'); }}
                      className="px-3 py-1 rounded-lg bg-red-600 text-white text-xs font-bold hover:bg-red-700 transition-colors">
                      Sim, limpar
                    </button>
                    <button onClick={() => setShowClearConfirm(false)}
                      className="px-3 py-1 rounded-lg bg-white border border-red-200 text-red-600 text-xs font-bold">
                      Cancelar
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {!items.length ? (
            <div className="glass rounded-3xl p-16 text-center border border-primary/8">
              <div className="w-20 h-20 rounded-full bg-surface flex items-center justify-center mx-auto mb-6">
                <AppIcon name="ShoppingCartIcon" size={36} className="text-muted" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">Lista vazia</h3>
              <p className="text-muted mb-8">Adicione produtos para solicitar um orçamento.</p>
              <Link href="/products"
                className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-primary text-white text-[12px] font-bold uppercase tracking-widest hover:bg-primary-dark transition-all shadow-red-lg">
                <AppIcon name="ArrowLeftIcon" size={14} />Ver produtos
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Itens agrupados por empresa */}
              <div className="lg:col-span-2 space-y-6">
                {Object.entries(groupedByCompany).map(([compId, compItems]) => {
                  const co = COMPANIES[compId as CompanyId];
                  if (!co) return null;
                  return (
                    <div key={compId}>
                      {/* Header da empresa */}
                      <div className="flex items-center gap-3 mb-3 px-1">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: co.primaryColor }} />
                        <span className="text-[11px] uppercase tracking-[0.25em] font-bold" style={{ color: co.primaryColor }}>
                          {co.name}
                        </span>
                        <span className="text-xs text-muted">({compItems.length} item{compItems.length > 1 ? 's' : ''})</span>
                        <div className="flex-1 h-px" style={{ backgroundColor: `${co.primaryColor}20` }} />
                      </div>

                      <div className="space-y-3">
                        {compItems.map(({ product, quantity }) => (
                          <div key={product.id} className="rounded-2xl p-4 border flex gap-4 items-start hover-lift bg-white"
                            style={{ borderColor: `${co.primaryColor}20` }}>
                            {/* Imagem contida */}
                            <div className="w-20 h-20 rounded-xl overflow-hidden bg-surface flex-shrink-0 flex items-center justify-center border border-[#f0f0f0]">
                              <AppImage
                                src={product.image_url ?? '/assets/images/no_image.png'}
                                alt={product.name} width={80} height={80}
                                className="w-full h-full object-contain p-1"
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <span className="text-[10px] uppercase tracking-[0.15em] font-bold" style={{ color: co.primaryColor }}>
                                    {product.category}
                                  </span>
                                  <h3 className="font-bold text-foreground text-base leading-tight mt-0.5">{product.name}</h3>
                                  <p className="text-[12px] text-muted">Unidade: {product.unit}</p>
                                </div>
                                <button onClick={() => removeFromCart(product.id)}
                                  className="p-1.5 rounded-lg text-muted hover:text-red-500 hover:bg-red-50 transition-all flex-shrink-0">
                                  <AppIcon name="TrashIcon" size={15} />
                                </button>
                              </div>
                              <div className="flex items-center justify-between mt-3">
                                <QuantityInput value={quantity} onChange={(val) => updateQuantity(product.id, val)} min={1} size="sm" />
                                <span className="text-sm font-bold text-muted">{quantity} {pluralUnit(product.unit, quantity)}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}

                <Link href="/products" className="inline-flex items-center gap-2 text-[12px] text-muted hover:text-primary font-semibold transition-colors mt-2">
                  <AppIcon name="ArrowLeftIcon" size={14} />Adicionar mais produtos
                </Link>
              </div>

              {/* Formulário de solicitação */}
              <div className="lg:col-span-1">
                <div className="glass rounded-2xl p-6 border border-primary/8 shadow-red-xl sticky top-28">
                  <h2 className="text-[11px] uppercase tracking-[0.2em] font-bold text-muted mb-1">Solicitar orçamento</h2>
                  <p className="text-xs text-muted mb-5">{totalItems} produto{totalItems > 1 ? 's' : ''} · retorno em até 2h</p>

                  <form onSubmit={handleSubmit} className="space-y-3">
                    {[
                      { label: 'Nome completo', name: 'name', type: 'text', placeholder: 'João da Silva' },
                      { label: 'E-mail', name: 'email', type: 'email', placeholder: 'joao@email.com' },
                      { label: 'WhatsApp / Telefone', name: 'phone', type: 'tel', placeholder: '(77) 9 8104-6133' },
                    ].map((f) => (
                      <div key={f.name}>
                        <label className="text-[10px] text-muted font-medium block mb-1">{f.label}</label>
                        <input type={f.type} name={f.name} required
                          value={(form as any)[f.name]} onChange={handleChange}
                          placeholder={f.placeholder}
                          className="w-full px-3 py-2.5 rounded-xl border border-border bg-white/80 text-sm text-foreground placeholder:text-muted/40 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all" />
                      </div>
                    ))}
                    <div>
                      <label className="text-[10px] text-muted font-medium block mb-1">Observação (opcional)</label>
                      <textarea name="observation" rows={2} value={form.observation} onChange={handleChange}
                        placeholder="Prazo, endereço de entrega..."
                        className="w-full px-3 py-2.5 rounded-xl border border-border bg-white/80 text-sm text-foreground placeholder:text-muted/40 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all resize-none" />
                    </div>
                    <button type="submit" disabled={loading}
                      className="w-full mt-1 py-4 rounded-xl bg-primary text-white text-[12px] font-bold uppercase tracking-widest hover:bg-primary-dark transition-all shadow-red-lg disabled:opacity-60 flex items-center justify-center gap-2">
                      {loading
                        ? <><svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Enviando...</>
                        : <><AppIcon name="PaperAirplaneIcon" size={16} />Solicitar Orçamento</>}
                    </button>
                    <p className="text-[11px] text-muted text-center flex items-center justify-center gap-1 mt-1">
                      <AppIcon name="LockClosedIcon" size={11} />Sem compromisso · retorno em 2h úteis
                    </p>
                  </form>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
      <Footer />
    </main>
  );
}
