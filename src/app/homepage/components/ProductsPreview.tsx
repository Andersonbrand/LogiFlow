'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import AppImage from '@/components/ui/AppImage';
import AppIcon from '@/components/ui/AppIcon';
import { supabase, Product } from '@/lib/supabase';
import { usePrices } from '@/context/PriceContext';
import { useCart } from '@/context/CartContext';
import { useCompany, COMPANIES, CompanyId, COMPANY_ORDER, COMPANY_CATEGORIES } from '@/context/CompanyContext';
import toast from 'react-hot-toast';

// Imagens fallback por categoria (usando fotos reais de produtos quando possível)
const CATEGORY_IMAGES: Record<string, string> = {
  'Cimento':            '/assets/images/about/sacos-cimento.jpg',
  'Vergalhões':         '/assets/images/about/vergalhoes.jpg',
  'Ferragens':          '/assets/images/about/estoque.jpg',
  'Serralheria':        '/assets/images/about/estoque.jpg',
  'Barras e Perfis':    '/assets/images/about/vergalhoes.jpg',
  'Aços Planos':        '/assets/images/about/vergalhoes.jpg',
  'Arames':             '/assets/images/about/estoque.jpg',
  'Chapas':             '/assets/images/about/estoque.jpg',
  'Telhas':             'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800',
  'Bobinas de Zinco':   'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800',
  'Colunas e Treliças': '/assets/images/about/vergalhoes.jpg',
  'Colunas':            '/assets/images/about/vergalhoes.jpg',
  'Treliças':           '/assets/images/about/vergalhoes.jpg',
  'Tubos':              '/assets/images/about/vergalhoes.jpg',
  'Parafusos':          '/assets/images/about/estoque.jpg',
};
const FALLBACK_IMAGE = '/assets/images/about/estoque.jpg';

export default function ProductsPreview() {
  const [products, setProducts] = useState<Product[]>([]);
  const { showPrices }          = usePrices();
  const { addToCart }           = useCart();
  const { activeCompany, company, setActiveCompany, isGrupoView } = useCompany();

  useEffect(() => {
    supabase.from('products').select('*').eq('is_active', true).limit(40)
      .then(({ data }) => setProducts(data ?? []));
  }, []);

  const handleAdd = (product: Product) => {
    addToCart(product);
    toast.success(`${product.name} adicionado ao orçamento!`);
  };

  // Filtro por empresa
  const filteredProducts = isGrupoView ? products : products.filter(p => {
    if (!company) return true;
    // Prioriza companies[] do produto
    const pCos = (p as any).companies as string[] | undefined;
    if (pCos && pCos.length > 0) return pCos.includes(activeCompany!);
    // Fallback: filtra por categoria
    const allowedCats = COMPANY_CATEGORIES[activeCompany as CompanyId] ?? [];
    return allowedCats.some(cat => p.category.toLowerCase().includes(cat.toLowerCase()));
  });

  // Categorias com produto representativo (preferencialmente com imagem real)
  const categoryMap = new Map<string, Product>();
  filteredProducts.forEach(p => {
    if (!categoryMap.has(p.category)) {
      categoryMap.set(p.category, p);
    } else {
      // Prefere produto com imagem real
      const current = categoryMap.get(p.category)!;
      if (!current.image_url && p.image_url) categoryMap.set(p.category, p);
    }
  });
  const categories = Array.from(categoryMap.entries()).slice(0, 4);

  const getCatImage = (cat: string, product: Product) =>
    product.image_url || CATEGORY_IMAGES[cat] || FALLBACK_IMAGE;

  const featured = filteredProducts.slice(0, 4);

  return (
    <section className="py-32 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
          <div className="space-y-3">
            {company && (
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: company.primaryColor }} />
                <span className="text-[10px] uppercase tracking-[0.3em] font-bold" style={{ color: company.primaryColor }}>
                  {company.name}
                </span>
              </div>
            )}
            <span className="text-[10px] uppercase tracking-[0.4em] font-bold text-primary block">Nosso Catálogo</span>
            <h2 className="text-5xl md:text-6xl font-bold tracking-tight leading-[1.05] text-foreground">
              Categorias{' '}
              <span className="font-display italic text-gradient-red">principais.</span>
            </h2>
          </div>
          <Link href="/products" className="flex items-center gap-3 text-[11px] uppercase tracking-[0.25em] font-bold text-muted hover:text-primary transition-colors group">
            Ver todos os produtos
            <AppIcon name="ArrowRightIcon" size={16} className="group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        {/* Gateway: se nenhuma empresa selecionada, mostrar convite para selecionar */}
        {isGrupoView && (
          <div className="mb-12 rounded-4xl border-2 border-dashed border-[#dde3ed] p-10 text-center">
            <p className="text-[10px] uppercase tracking-[0.4em] font-bold text-muted mb-4">Grupo HC</p>
            <h3 className="text-2xl font-bold text-foreground mb-2">Selecione uma empresa para ver os produtos</h3>
            <p className="text-muted mb-6 text-sm">Cada empresa tem seu próprio portfólio especializado.</p>
            <div className="flex flex-wrap justify-center gap-3">
              {COMPANY_ORDER.map((id) => {
                const co = COMPANIES[id];
                return (
                  <button key={id} onClick={() => setActiveCompany(id)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 font-bold text-sm transition-all hover:-translate-y-0.5"
                    style={{ borderColor: co.primaryColor, color: co.primaryColor, backgroundColor: co.bgLight }}>
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: co.primaryColor }} />
                    {co.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Bento grid de categorias */}
        {categories.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-5">
            {categories[0] && (
              <Link href={`/products?categoria=${encodeURIComponent(categories[0][0])}`}
                className="lg:col-span-5 product-card group relative rounded-4xl overflow-hidden shadow-red-lg hover-lift cursor-pointer bg-surface block">
                <div className="relative h-[400px] overflow-hidden">
                  <AppImage src={getCatImage(categories[0][0], categories[0][1])} alt={categories[0][0]}
                    className="product-img w-full h-full object-contain p-2 transition-transform duration-700 group-hover:scale-105" fill />
                  <div className="absolute inset-0 bg-gradient-to-t from-foreground/80 via-foreground/20 to-transparent" />
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-8">
                  <span className="badge mb-3 bg-primary text-white">Mais vendido</span>
                  <h3 className="text-2xl font-bold text-white mb-1">{categories[0][0]}</h3>
                  <p className="text-sm text-white/70">
                    {filteredProducts.filter(p => p.category === categories[0][0]).length} produtos disponíveis
                  </p>
                </div>
              </Link>
            )}

            <div className="lg:col-span-3 grid grid-rows-2 gap-5">
              {[categories[1], categories[2]].filter(Boolean).map(([cat, prod]) => (
                <Link key={cat} href={`/products?categoria=${encodeURIComponent(cat)}`}
                  className="product-card group relative rounded-4xl overflow-hidden shadow-sm hover-lift cursor-pointer bg-surface block">
                  <div className="relative h-full min-h-[190px] overflow-hidden">
                    <AppImage src={getCatImage(cat, prod)} alt={cat}
                      className="product-img w-full h-full object-contain p-2 transition-transform duration-700 group-hover:scale-105" fill />
                    <div className="absolute inset-0 bg-gradient-to-t from-foreground/70 to-transparent" />
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 p-5">
                    <span className="badge mb-2 bg-surface-2 text-foreground">Destaque</span>
                    <h3 className="text-base font-bold text-white">{cat}</h3>
                  </div>
                </Link>
              ))}
            </div>

            {categories[3] && (
              <Link href={`/products?categoria=${encodeURIComponent(categories[3][0])}`}
                className="lg:col-span-4 product-card group relative rounded-4xl overflow-hidden shadow-red-lg hover-lift cursor-pointer bg-surface block">
                <div className="relative h-[400px] overflow-hidden">
                  <AppImage src={getCatImage(categories[3][0], categories[3][1])} alt={categories[3][0]}
                    className="product-img w-full h-full object-contain p-2 transition-transform duration-700 group-hover:scale-105" fill />
                  <div className="absolute inset-0 bg-gradient-to-t from-foreground/80 via-foreground/20 to-transparent" />
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-8">
                  <span className="badge mb-3 bg-surface-2 text-foreground">Destaque</span>
                  <h3 className="text-2xl font-bold text-white mb-1">{categories[3][0]}</h3>
                </div>
              </Link>
            )}
          </div>
        )}

        {/* Produtos destaque */}
        {featured.length > 0 && (
          <div className="mt-20">
            <h3 className="text-2xl font-bold text-foreground mb-8">Produtos em Destaque</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {featured.map((product) => (
                <div key={product.id} className="product-card group bg-white border border-border rounded-4xl overflow-hidden hover-lift shadow-sm">
                  <a href={`/products/${product.id}`} className="relative overflow-hidden bg-white block" style={{ height: '200px' }}>
                    <AppImage
                      src={product.image_url ?? '/assets/images/no_image.png'}
                      alt={product.name} fill
                      className="product-img transition-transform duration-700 group-hover:scale-105"
                      style={{ objectFit: 'contain', padding: '12px' }}
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <span className="bg-white/90 text-foreground text-[11px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-xl shadow">Ver detalhes</span>
                    </div>
                  </a>
                  <div className="p-5 space-y-3">
                    <span className="text-[10px] uppercase tracking-widest font-bold text-primary">{product.category}</span>
                    <h4 className="text-sm font-bold text-foreground leading-snug">{product.name}</h4>
                    <div className="flex items-center justify-between pt-1">
                      {showPrices && product.price > 0
                        ? <span className="text-base font-bold text-foreground">R$ {product.price.toFixed(2).replace('.', ',')}</span>
                        : <span className="text-sm text-muted italic">Sob consulta</span>}
                      <button onClick={() => handleAdd(product)}
                        className="px-3 py-1.5 rounded-xl bg-primary text-white text-[11px] font-bold hover:bg-primary-dark transition-all">
                        + Orçamento
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-10 text-center">
          <Link href="/products" className="inline-flex items-center gap-3 px-10 py-4 rounded-xl bg-primary text-white font-bold text-sm hover:bg-primary-dark transition-all shadow-red-lg hover:-translate-y-0.5">
            <AppIcon name="Squares2X2Icon" size={18} />
            Explorar Catálogo Completo
          </Link>
        </div>
      </div>
    </section>
  );
}
