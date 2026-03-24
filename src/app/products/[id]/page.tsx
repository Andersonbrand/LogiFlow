'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import AppImage from '@/components/ui/AppImage';
import AppIcon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { Product } from '@/lib/supabase';
import { usePrices } from '@/context/PriceContext';
import { useCart } from '@/context/CartContext';
import QuantityInput from '@/components/ui/QuantityInput';
import toast from 'react-hot-toast';

export default function ProductDetailPage() {
  const { id }                = useParams<{ id: string }>();
  const router                = useRouter();
  const supabase              = createClient();
  const [product, setProduct] = useState<Product | null>(null);
  const [related, setRelated] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [qty, setQty]         = useState(1);
  const { showPrices }        = usePrices();
  const { addToCart }         = useCart();

  useEffect(() => {
    if (!id) return;
    supabase.from('products').select('*').eq('id', id).single()
      .then(({ data }) => {
        setProduct(data);
        if (data) {
          supabase.from('products').select('*')
            .eq('category', data.category).neq('id', id).eq('is_active', true).limit(4)
            .then(({ data: rel }) => setRelated(rel ?? []));
        }
        setLoading(false);
      });
  }, [id]);

  const handleAdd = () => {
    if (!product) return;
    // Adiciona a quantidade correta de itens
    for (let i = 0; i < qty; i++) addToCart(product);
    toast.success(`${qty}x ${product.name} adicionado ao orçamento!`);
  };

  // Preço total calculado pela quantidade
  const unitPrice  = product?.price ?? 0;
  const totalPrice = unitPrice * qty;

  if (loading) {
    return (
      <main className="min-h-screen bg-white">
        <Header />
        <div className="pt-32 max-w-7xl mx-auto px-6 pb-20">
          <div className="grid lg:grid-cols-2 gap-12">
            <div className="aspect-square bg-surface rounded-4xl animate-pulse" />
            <div className="space-y-4 pt-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-6 bg-surface rounded-xl animate-pulse" style={{ width: `${80 - i * 10}%` }} />
              ))}
            </div>
          </div>
        </div>
        <Footer />
      </main>
    );
  }

  if (!product) {
    return (
      <main className="min-h-screen bg-white">
        <Header />
        <div className="pt-40 text-center px-6">
          <p className="text-2xl font-bold text-foreground mb-4">Produto não encontrado</p>
          <button onClick={() => router.push('/products')}
            className="px-6 py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary-dark transition-all">
            Voltar
          </button>
        </div>
        <Footer />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white">
      <Header />
      <div className="pt-28 pb-20">
        <div className="max-w-7xl mx-auto px-6">

          {/* Breadcrumb */}
          <div className="flex items-center gap-3 mb-8 text-sm text-muted">
            <button onClick={() => router.push('/products')}
              className="flex items-center gap-2 font-semibold hover:text-primary transition-colors group">
              <span className="w-8 h-8 rounded-xl border border-border flex items-center justify-center group-hover:border-primary/40 group-hover:bg-primary/5 transition-all">
                <AppIcon name="ArrowLeftIcon" size={14} />
              </span>
              Voltar aos produtos
            </button>
            <span className="text-border">›</span>
            <span className="text-primary font-medium">{product.category}</span>
            <span className="text-border">›</span>
            <span className="text-foreground font-medium truncate max-w-xs">{product.name}</span>
          </div>

          <div className="grid lg:grid-cols-2 gap-16 items-start">
            {/* Imagem com moldura */}
            <div className="relative group">
              <div className="absolute -inset-4 bg-gradient-to-br from-primary/10 to-accent/5 rounded-5xl blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
              <div className="absolute -top-3 -right-3 w-full h-full border-2 border-primary/15 rounded-4xl z-0" />
              <div className="relative aspect-square rounded-4xl overflow-hidden border-2 border-white shadow-red-lg group-hover:shadow-red-xl transition-shadow duration-500 z-10">
                <AppImage
                  src={product.image_url ?? '/assets/images/no_image.png'}
                  alt={product.name} fill
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                  priority
                />
                <div className="absolute top-4 left-4">
                  <span className="badge bg-primary text-white text-[10px] shadow-red-lg">{product.category}</span>
                </div>
              </div>
            </div>

            {/* Info */}
            <div className="space-y-6 lg:pt-4">
              <div>
                <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-primary">{product.category}</span>
                <h1 className="text-4xl font-bold text-foreground mt-2 leading-tight">{product.name}</h1>
                <p className="text-muted text-sm mt-1">Unidade: <strong>{product.unit}</strong></p>
              </div>

              {product.description && (
                <p className="text-base text-muted leading-relaxed border-l-2 border-primary/30 pl-4">
                  {product.description}
                </p>
              )}

              {/* Preço */}
              <div className="p-5 rounded-2xl bg-surface border border-border space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] uppercase tracking-widest text-muted font-bold">
                    Preço unitário / {product.unit}
                  </p>
                  {qty > 1 && showPrices && unitPrice > 0 && (
                    <span className="text-[11px] text-muted">
                      {qty}x R$ {unitPrice.toFixed(2).replace('.', ',')}
                    </span>
                  )}
                </div>

                {showPrices && unitPrice > 0 ? (
                  <div className="flex items-end gap-3">
                    {/* Preço total em destaque */}
                    <p className="text-4xl font-display font-bold text-primary">
                      R$ {totalPrice.toFixed(2).replace('.', ',')}
                    </p>
                    {qty > 1 && (
                      <p className="text-sm text-muted mb-1">total</p>
                    )}
                  </div>
                ) : (
                  <p className="text-2xl font-bold text-muted italic">Sob consulta</p>
                )}
              </div>

              {/* Seletor de quantidade + botão */}
              <div className="flex items-center gap-4">
                <QuantityInput value={qty} onChange={setQty} min={1} max={9999} size="md" />

                <button onClick={handleAdd}
                  className="flex-1 py-3.5 rounded-xl bg-primary text-white font-bold text-sm hover:bg-primary-dark transition-all shadow-red-lg hover:shadow-red-xl hover:-translate-y-0.5 flex items-center justify-center gap-2">
                  <AppIcon name="ShoppingCartIcon" size={18} />
                  Adicionar ao Orçamento
                </button>
              </div>

              {/* WhatsApp */}
              <a
                href={`https://wa.me/5577981046133?text=Olá! Tenho interesse no produto: ${encodeURIComponent(product.name)}${qty > 1 ? `, quantidade: ${qty}` : ''}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-border hover:border-primary/30 hover:bg-primary/5 transition-all text-sm font-bold text-muted hover:text-primary"
              >
                <AppIcon name="ChatBubbleLeftRightIcon" size={18} />
                Consultar via WhatsApp
              </a>

              <div className="flex flex-wrap gap-4 pt-2">
                {[
                  { icon: 'TruckIcon',       label: 'Entrega em Guanambi' },
                  { icon: 'ShieldCheckIcon', label: 'Qualidade garantida' },
                  { icon: 'CheckBadgeIcon',  label: 'Estoque disponível' },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-1.5 text-[12px] text-muted font-medium">
                    <AppIcon name={item.icon} size={14} className="text-primary" />
                    {item.label}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Produtos relacionados */}
          {related.length > 0 && (
            <div className="mt-20">
              <h2 className="text-2xl font-bold text-foreground mb-8">
                Mais em <span className="text-primary">{product.category}</span>
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                {related.map((rel) => (
                  <a key={rel.id} href={`/products/${rel.id}`}
                    className="group bg-white border border-border rounded-3xl overflow-hidden hover-lift shadow-sm block">
                    <div className="relative h-36 overflow-hidden bg-surface">
                      <AppImage src={rel.image_url ?? '/assets/images/no_image.png'} alt={rel.name} fill
                        className="object-cover transition-transform duration-500 group-hover:scale-105" />
                    </div>
                    <div className="p-4">
                      <p className="text-sm font-bold text-foreground leading-snug">{rel.name}</p>
                      {showPrices && rel.price > 0
                        ? <p className="text-primary font-bold text-sm mt-1">R$ {rel.price.toFixed(2).replace('.', ',')}</p>
                        : <p className="text-muted text-xs mt-1 italic">Sob consulta</p>}
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      <Footer />
    </main>
  );
}
