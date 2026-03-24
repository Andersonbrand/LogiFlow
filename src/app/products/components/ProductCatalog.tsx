'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AppImage from '@/components/ui/AppImage';
import AppIcon from '@/components/ui/AppIcon';
import { supabase, Product } from '@/lib/supabase';
import { usePrices } from '@/context/PriceContext';
import { useCart } from '@/context/CartContext';
import { useCompany, COMPANIES, COMPANY_ORDER, COMPANY_CATEGORIES, CompanyId } from '@/context/CompanyContext';
import toast from 'react-hot-toast';

const PAGE_SIZE = 16;

// Gateway: obriga usuário a selecionar empresa antes de ver produtos
function CompanyGateway() {
  const { setActiveCompany } = useCompany();
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] py-20 px-6">
      <div className="text-center mb-12 max-w-xl">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-surface border border-border mb-6">
          <span className="w-2 h-2 rounded-full bg-[#af1518] animate-pulse" />
          <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-muted">Grupo HC</span>
        </div>
        <h2 className="text-4xl font-bold text-foreground mb-4">
          De qual empresa você deseja ver os produtos?
        </h2>
        <p className="text-muted text-base leading-relaxed">
          Cada empresa do Grupo HC possui seu próprio portfólio especializado. Selecione uma para explorar o catálogo.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl">
        {COMPANY_ORDER.map((id) => {
          const co = COMPANIES[id];
          return (
            <button key={id} onClick={() => setActiveCompany(id)}
              className="text-left p-8 rounded-4xl border-2 hover:-translate-y-1 transition-all duration-300 group bg-white"
              style={{ borderColor: `${co.primaryColor}30` }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = co.primaryColor; e.currentTarget.style.boxShadow = `0 20px 60px ${co.primaryColor}20`; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = `${co.primaryColor}30`; e.currentTarget.style.boxShadow = ''; }}>
              <div className="w-12 h-12 rounded-2xl mb-5 flex items-center justify-center text-white font-black text-lg"
                style={{ background: co.gradient }}>
                {co.shortName[0]}
              </div>
              <h3 className="text-lg font-bold text-foreground mb-1">{co.name}</h3>
              <p className="text-[11px] uppercase tracking-widest font-bold mb-3" style={{ color: co.primaryColor }}>{co.segment} · Desde {co.founded}</p>
              <p className="text-sm text-muted leading-relaxed mb-4">
                {co.categories.slice(0, 4).join(', ')}{co.categories.length > 4 ? '...' : ''}
              </p>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest transition-colors"
                style={{ color: co.primaryColor }}>
                Ver produtos <AppIcon name="ArrowRightIcon" size={12} />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function ProductCatalog() {
  const searchParams                        = useSearchParams();
  const router                              = useRouter();
  const [products, setProducts]             = useState<Product[]>([]);
  const [loading, setLoading]               = useState(true);
  const [activeCategory, setActiveCategory] = useState(searchParams.get('categoria') ?? 'Todos');
  const [search, setSearch]                 = useState(searchParams.get('busca') ?? '');
  const [page, setPage]                     = useState(1);
  const { showPrices }                      = usePrices();
  const { addToCart }                       = useCart();
  const { activeCompany, company, setActiveCompany, isGrupoView } = useCompany();

  useEffect(() => {
    setLoading(true);
    supabase.from('products').select('*').eq('is_active', true).order('category')
      .then(({ data }) => { setProducts(data ?? []); setLoading(false); });
  }, []);

  useEffect(() => {
    const cat   = searchParams.get('categoria');
    const busca = searchParams.get('busca');
    if (cat)   setActiveCategory(cat);
    if (busca) setSearch(busca);
  }, [searchParams]);

  // Produtos filtrados por empresa: usa companies[] do produto se disponível,
  // caso contrário usa o mapeamento de categorias como fallback
  const companyFilteredProducts = useMemo(() => {
    if (!activeCompany) return products;
    return products.filter((p) => {
      // 1. Prioridade: campo companies[] do banco (após migration)
      const companies = (p as any).companies as string[] | undefined;
      if (companies && companies.length > 0) {
        return companies.includes(activeCompany);
      }
      // 2. Prioridade: campo company singular do banco
      const company = (p as any).company as string | undefined;
      if (company) return company === activeCompany;
      // 3. Fallback: comparação EXATA por categoria (sem substring)
      const allowedCats = COMPANY_CATEGORIES[activeCompany as CompanyId] ?? [];
      return allowedCats.some(cat => cat.toLowerCase() === p.category.toLowerCase());
    });
  }, [products, activeCompany]);

  const categories = useMemo(
    () => ['Todos', ...Array.from(new Set(companyFilteredProducts.map((p) => p.category))).sort()],
    [companyFilteredProducts]
  );

  const filtered = useMemo(() =>
    companyFilteredProducts.filter((p) => {
      const matchCat    = activeCategory === 'Todos' || p.category === activeCategory;
      const q           = search.toLowerCase();
      const matchSearch = !q || p.name.toLowerCase().includes(q) ||
                          (p.description ?? '').toLowerCase().includes(q) ||
                          p.category.toLowerCase().includes(q);
      return matchCat && matchSearch;
    }), [companyFilteredProducts, activeCategory, search]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleAdd = (product: Product) => {
    addToCart(product);
    toast.success(`${product.name} adicionado ao orçamento!`);
  };

  const handleCategoryChange = (cat: string) => {
    setActiveCategory(cat); setPage(1);
    const params = new URLSearchParams(searchParams.toString());
    if (cat === 'Todos') params.delete('categoria'); else params.set('categoria', cat);
    router.replace(`/products${params.toString() ? '?' + params.toString() : ''}`, { scroll: false });
  };

  const handleSearch = (value: string) => {
    setSearch(value); setPage(1);
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set('busca', value); else params.delete('busca');
    router.replace(`/products${params.toString() ? '?' + params.toString() : ''}`, { scroll: false });
  };

  const accentColor = company?.primaryColor ?? '#af1518';

  // Exibe gateway se nenhuma empresa selecionada
  if (isGrupoView) {
    return (
      <>
        <div className="pt-28 pb-6 bg-gradient-to-b from-surface to-white relative overflow-hidden">
          <div className="max-w-7xl mx-auto px-6 relative z-10">
            <span className="text-[10px] uppercase tracking-[0.4em] font-bold text-primary">Catálogo</span>
            <h1 className="text-5xl font-bold tracking-tight text-foreground mt-3">
              Nossos <span className="font-display italic text-gradient-red">Produtos</span>
            </h1>
          </div>
        </div>
        <CompanyGateway />
      </>
    );
  }

  return (
    <>
      {/* Cabeçalho com identidade da empresa */}
      <div className="pt-32 pb-10 relative overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${accentColor}08, white)` }}>
        <div className="absolute top-0 left-0 right-0 h-1"
          style={{ background: company?.gradient }} />
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="flex items-center gap-4 mb-4">
            <span className="text-[10px] uppercase tracking-[0.4em] font-bold" style={{ color: accentColor }}>
              {company?.name}
            </span>
            <button onClick={() => setActiveCompany(null)}
              className="flex items-center gap-1 text-[10px] font-bold text-muted hover:text-foreground transition-colors border border-border rounded-lg px-2.5 py-1">
              <AppIcon name="ArrowLeftIcon" size={11} />
              Trocar empresa
            </button>
          </div>
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight leading-[1.05] text-foreground mt-3 mb-4">
            Nossos{' '}
            <span
              className="font-display italic"
              style={{ color: accentColor }}
            >Produtos</span>
          </h1>
          <p className="text-lg text-muted max-w-2xl">
            Qualidade certificada · Entrega em Guanambi e região ·{' '}
            <span className="font-semibold text-foreground">{companyFilteredProducts.length} produtos</span>
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 pb-20">
        <div className="flex gap-8">
          {/* Sidebar */}
          <aside className="hidden md:flex flex-col gap-2 w-56 shrink-0 pt-6">
            <div className="relative mb-2">
              <AppIcon name="MagnifyingGlassIcon" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input type="text" placeholder="Buscar produto..." value={search}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full pl-9 pr-8 py-2.5 rounded-xl border border-border bg-white text-sm focus:outline-none focus:border-primary transition-colors" />
              {search && (
                <button onClick={() => handleSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground transition-colors">
                  <AppIcon name="XMarkIcon" size={14} />
                </button>
              )}
            </div>
            <div className="flex items-center justify-between px-1 mb-1">
              <p className="text-[10px] uppercase tracking-[0.25em] font-bold text-muted">Categorias</p>
              <span className="text-[10px] text-muted">{categories.length - 1}</span>
            </div>
            <div className="space-y-1 max-h-[calc(100vh-300px)] overflow-y-auto pr-1">
              {categories.map((cat) => (
                <button key={cat} onClick={() => handleCategoryChange(cat)}
                  className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-bold transition-all border ${
                    activeCategory === cat ? 'text-white border-transparent shadow-lg' : 'bg-white text-muted border-border hover:border-primary/30 hover:text-primary'
                  }`}
                  style={activeCategory === cat ? { background: company?.gradient, borderColor: 'transparent' } : {}}>
                  <span className="truncate block">{cat}</span>
                  {cat !== 'Todos' && (
                    <span className={`text-[11px] font-normal ${activeCategory === cat ? 'text-white/70' : 'text-muted/60'}`}>
                      {companyFilteredProducts.filter((p) => p.category === cat).length} produtos
                    </span>
                  )}
                </button>
              ))}
            </div>
          </aside>

          {/* Grid */}
          <div className="flex-1 min-w-0 pt-6">
            <div className="md:hidden space-y-3 mb-5">
              <div className="relative">
                <AppIcon name="MagnifyingGlassIcon" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input type="text" placeholder="Buscar produto..." value={search}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-border bg-surface text-sm focus:outline-none focus:border-primary transition-colors" />
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {categories.map((cat) => (
                  <button key={cat} onClick={() => handleCategoryChange(cat)}
                    className={`shrink-0 px-4 py-2 rounded-xl text-[11px] font-bold uppercase tracking-widest border transition-all ${
                      activeCategory === cat ? 'text-white border-transparent' : 'border-border text-muted bg-white'
                    }`}
                    style={activeCategory === cat ? { background: company?.gradient } : {}}>
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between mb-6">
              <p className="text-[12px] uppercase tracking-widest text-muted font-bold">
                {loading ? 'Carregando...' : `${filtered.length} produto${filtered.length !== 1 ? 's' : ''}`}
                {activeCategory !== 'Todos' && <span style={{ color: accentColor }}> em {activeCategory}</span>}
                {search && <span> para "{search}"</span>}
              </p>
              {(activeCategory !== 'Todos' || search) && (
                <button onClick={() => { handleCategoryChange('Todos'); handleSearch(''); }}
                  className="text-[11px] text-muted hover:text-primary transition-colors flex items-center gap-1 font-medium">
                  <AppIcon name="XMarkIcon" size={12} />
                  Limpar filtros
                </button>
              )}
            </div>

            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-5">
                {Array.from({ length: 16 }).map((_, i) => <div key={i} className="bg-surface rounded-4xl h-72 animate-pulse" />)}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-24">
                <AppIcon name="FaceFrownIcon" size={48} className="text-muted mx-auto mb-4" />
                <p className="text-xl font-bold text-foreground">Nenhum produto encontrado</p>
                <p className="text-muted mt-2">Tente outra busca ou categoria.</p>
                <button onClick={() => { handleCategoryChange('Todos'); handleSearch(''); }}
                  className="mt-6 px-6 py-2.5 rounded-xl text-white text-sm font-bold hover:opacity-90 transition-all"
                  style={{ backgroundColor: accentColor }}>
                  Ver todos os produtos
                </button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-5">
                  {paginated.map((product) => (
                    <div key={product.id} className="product-card group bg-white border border-border rounded-3xl overflow-hidden hover-lift shadow-sm flex flex-col">
                      <a href={`/products/${product.id}`} className="relative bg-white block flex-shrink-0 overflow-hidden" style={{ height: '180px' }}>
                        <AppImage src={product.image_url ?? '/assets/images/no_image.png'} alt={product.name} fill
                          className="product-img transition-transform duration-700 group-hover:scale-105"
                          style={{ objectFit: 'contain', padding: '12px' }} />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                          <span className="bg-white/90 text-foreground text-[11px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-xl shadow">Ver detalhes</span>
                        </div>
                      </a>
                      <div className="p-4 space-y-2 flex flex-col flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] uppercase tracking-widest font-bold" style={{ color: accentColor }}>
                            {product.category}
                          </span>
                          {(() => {
                            const cos = (product as any).companies as string[] | undefined;
                            if (cos && cos.length > 1) {
                              return <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 whitespace-nowrap">2 empresas</span>;
                            }
                            return null;
                          })()}
                        </div>
                        <h4 className="text-sm font-bold text-foreground leading-snug flex-1">{product.name}</h4>
                        <p className="text-[11px] text-muted">{product.unit}</p>
                        <div className="flex items-center justify-between pt-1">
                          {showPrices && product.price > 0
                            ? <span className="text-base font-bold text-foreground">R$ {product.price.toFixed(2).replace('.', ',')}</span>
                            : <span className="text-sm text-muted italic">Sob consulta</span>}
                          <button onClick={() => handleAdd(product)}
                            className="px-3 py-1.5 rounded-xl text-white text-[11px] font-bold hover:opacity-90 transition-all"
                            style={{ backgroundColor: accentColor }}>
                            + Orçamento
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Paginação */}
                {totalPages > 1 && (
                  <div className="flex justify-center gap-2 mt-12">
                    <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                      className="px-4 py-2.5 rounded-xl border border-border text-sm font-bold text-muted hover:border-primary hover:text-primary transition-all disabled:opacity-40">
                      ← Anterior
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter((n) => n === 1 || n === totalPages || Math.abs(n - page) <= 1)
                      .map((n, idx, arr) => (
                        <React.Fragment key={n}>
                          {idx > 0 && arr[idx - 1] !== n - 1 && <span className="px-2 py-2.5 text-muted">…</span>}
                          <button onClick={() => setPage(n)}
                            className={`w-10 h-10 rounded-xl text-sm font-bold transition-all ${page === n ? 'text-white shadow-lg' : 'border border-border text-muted hover:border-primary hover:text-primary'}`}
                            style={page === n ? { background: company?.gradient } : {}}>
                            {n}
                          </button>
                        </React.Fragment>
                      ))}
                    <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                      className="px-4 py-2.5 rounded-xl border border-border text-sm font-bold text-muted hover:border-primary hover:text-primary transition-all disabled:opacity-40">
                      Próxima →
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
