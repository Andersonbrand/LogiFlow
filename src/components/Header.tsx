'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AppLogo from '@/components/ui/AppLogo';
import AppIcon from '@/components/ui/AppIcon';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { useCompany, COMPANIES, CompanyId, Company } from '@/context/CompanyContext';

const NAV_LINKS = [
  { label: 'Início',    href: '/homepage' },
  { label: 'Produtos',  href: '/products' },
  { label: 'Sobre Nós', href: '/sobre' },
  { label: 'Orçamento', href: '/homepage#orcamento' },
];

const COMPANY_ORDER: CompanyId[] = ['araguaia', 'confiance-industria', 'acos-confiance'];

function CompanyPill({ company, isActive, onClick }: { company: Company; isActive: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all duration-300 border whitespace-nowrap"
      style={{
        backgroundColor: isActive ? company.primaryColor : 'transparent',
        color: isActive ? '#fff' : company.primaryColor,
        borderColor: isActive ? company.primaryColor : `${company.primaryColor}40`,
      }}
    >
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: isActive ? '#fff' : company.primaryColor }} />
      {company.shortName}
    </button>
  );
}

export default function Header() {
  const [scrolled, setScrolled]   = useState(false);
  const [menuOpen, setMenuOpen]   = useState(false);
  const { totalItems }            = useCart();
  const { user, isAdmin, signOut }= useAuth();
  const router                    = useRouter();
  const { activeCompany, company, setActiveCompany, isGrupoView } = useCompany();

  const displayName = user?.user_metadata?.full_name
    ? (user.user_metadata.full_name as string).split(' ')[0]
    : user?.email?.split('@')[0] ?? '';

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleSignOut = async () => { await signOut(); router.push('/homepage'); };
  const headerAccent = company?.primaryColor ?? '#af1518';

  return (
    <header className={`fixed top-0 w-full z-50 transition-all duration-500 ${scrolled ? 'py-0' : 'py-2'}`}>
      {/* Stripe tricolor do Grupo / cor da empresa */}
      <div
        className="absolute top-0 left-0 right-0 h-0.5 transition-all duration-700"
        style={{ background: isGrupoView
          ? 'linear-gradient(90deg, #af1518 0%, #af1518 33%, #1a3a6b 33%, #1a3a6b 66%, #b04d00 66%, #b04d00 100%)'
          : company?.gradient ?? '#af1518'
        }}
      />

      <div className={`mx-4 md:mx-8 lg:mx-12 transition-all duration-500 ${
        scrolled
          ? 'bg-white/95 backdrop-blur-xl border border-border/60 shadow-lg rounded-2xl mt-3 px-6 py-3'
          : 'bg-white/85 backdrop-blur-md border border-white/40 rounded-2xl mt-4 px-6 py-4'
      }`}>
        <div className="flex items-center justify-between gap-4">

          {/* Logo */}
          <Link href="/homepage" onClick={() => setActiveCompany(null)} className="flex items-center gap-3 group flex-shrink-0">
            <AppLogo size={38} />
            <div className="flex flex-col leading-none">
              {isGrupoView ? (
                <>
                  <span className="font-display font-bold text-base tracking-tight text-foreground">
                    Grupo <span className="text-foreground">HC</span>
                  </span>
                  <span className="text-[8px] uppercase tracking-[0.25em] text-muted font-medium hidden sm:block">
                    Hugo Costa · Confiança & Responsabilidade
                  </span>
                </>
              ) : (
                <>
                  <span className="font-display font-bold text-base tracking-tight transition-colors duration-300"
                    style={{ color: headerAccent }}>
                    {company?.name}
                  </span>
                  <span className="text-[8px] uppercase tracking-[0.25em] font-medium hidden sm:block transition-colors duration-300"
                    style={{ color: `${headerAccent}80` }}>
                    {company?.segment}
                  </span>
                </>
              )}
            </div>
          </Link>

          {/* Seletor de empresa — desktop */}
          <div className="hidden lg:flex items-center gap-1.5 bg-[#f5f7fa] rounded-2xl px-3 py-2 border border-[#dde3ed]">
            <span className="text-[9px] uppercase tracking-[0.3em] font-bold text-muted mr-1">Grupo HC</span>
            <div className="w-px h-4 bg-[#dde3ed]" />
            {COMPANY_ORDER.map((id) => (
              <CompanyPill
                key={id}
                company={COMPANIES[id]}
                isActive={activeCompany === id}
                onClick={() => setActiveCompany(activeCompany === id ? null : id)}
              />
            ))}
            {!isGrupoView && (
              <button
                onClick={() => setActiveCompany(null)}
                className="ml-1 w-6 h-6 flex items-center justify-center rounded-lg bg-[#dde3ed] hover:bg-[#c8cdd8] transition-colors text-muted"
                title="Ver grupo completo"
              >
                <AppIcon name="XMarkIcon" size={12} />
              </button>
            )}
          </div>

          {/* Nav desktop */}
          <nav className="hidden xl:flex items-center gap-6">
            {NAV_LINKS.map((link) => (
              <Link key={link.href} href={link.href}
                className="text-[11px] uppercase tracking-[0.18em] font-bold text-muted hover:text-foreground transition-colors duration-300">
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Direita */}
          <div className="hidden lg:flex items-center gap-3 flex-shrink-0">
            {isAdmin && (
              <Link href="/admin-dashboard" className="text-[11px] uppercase tracking-widest font-bold transition-colors"
                style={{ color: headerAccent }}>Admin</Link>
            )}
            {user ? (
              <div className="flex items-center gap-2">
                <Link href="/perfil" className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface border border-border hover:border-primary/30 transition-all">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: `${headerAccent}15`, border: `1px solid ${headerAccent}30` }}>
                    <AppIcon name="UserIcon" size={14} style={{ color: headerAccent }} />
                  </div>
                  <span className="text-[12px] font-bold text-foreground max-w-[80px] truncate">{displayName}</span>
                </Link>
                <button onClick={handleSignOut} className="text-[11px] uppercase tracking-widest font-bold text-muted hover:text-foreground transition-colors flex items-center gap-1">
                  <AppIcon name="ArrowLeftEndOnRectangleIcon" size={13} />Sair
                </button>
              </div>
            ) : (
              <Link href="/login" className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border hover:bg-surface transition-all text-[11px] font-bold text-muted uppercase tracking-widest">
                <AppIcon name="UserIcon" size={14} />Entrar
              </Link>
            )}
            <Link href="/cart" className="relative p-2.5 rounded-xl border transition-all"
              style={{ borderColor: `${headerAccent}30` }} aria-label="Orçamento">
              <AppIcon name="ShoppingCartIcon" size={18} className="text-foreground" />
              {totalItems > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-white text-[9px] font-bold flex items-center justify-center"
                  style={{ backgroundColor: headerAccent }}>
                  {totalItems > 9 ? '9+' : totalItems}
                </span>
              )}
            </Link>
          </div>

          {/* Mobile */}
          <div className="lg:hidden flex items-center gap-2">
            <Link href="/cart" className="relative p-2 rounded-xl border border-border">
              <AppIcon name="ShoppingCartIcon" size={18} className="text-foreground" />
              {totalItems > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-white text-[9px] font-bold flex items-center justify-center"
                  style={{ backgroundColor: headerAccent }}>{totalItems}</span>
              )}
            </Link>
            <button onClick={() => setMenuOpen(!menuOpen)} className="flex flex-col gap-1.5 p-2">
              <span className={`block h-[2px] transition-all duration-300 ${menuOpen ? 'w-6 rotate-45 translate-y-[7px]' : 'w-6'}`} style={{ backgroundColor: menuOpen ? headerAccent : '#0d1117' }} />
              <span className={`block h-[2px] transition-all duration-300 ${menuOpen ? 'opacity-0 w-0' : 'w-4'}`} style={{ backgroundColor: '#0d1117' }} />
              <span className={`block h-[2px] transition-all duration-300 ${menuOpen ? 'w-6 -rotate-45 -translate-y-[7px]' : 'w-6'}`} style={{ backgroundColor: menuOpen ? headerAccent : '#0d1117' }} />
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="lg:hidden mt-4 pt-4 border-t border-border/40 space-y-2 pb-2">
            <div className="mb-4">
              <p className="text-[9px] uppercase tracking-[0.3em] font-bold text-muted mb-2">Selecionar empresa</p>
              <div className="flex flex-wrap gap-2">
                {COMPANY_ORDER.map((id) => (
                  <CompanyPill key={id} company={COMPANIES[id]} isActive={activeCompany === id}
                    onClick={() => { setActiveCompany(activeCompany === id ? null : id); setMenuOpen(false); }} />
                ))}
              </div>
            </div>
            <div className="h-px bg-border/40" />
            {NAV_LINKS.map((link) => (
              <Link key={link.href} href={link.href} onClick={() => setMenuOpen(false)}
                className="block text-[12px] uppercase tracking-[0.18em] font-bold text-muted hover:text-foreground py-2">
                {link.label}
              </Link>
            ))}
            {isAdmin && (
              <Link href="/admin-dashboard" onClick={() => setMenuOpen(false)}
                className="block text-[12px] uppercase tracking-[0.18em] font-bold py-2" style={{ color: headerAccent }}>
                Painel Admin
              </Link>
            )}
            {user ? (
              <div className="flex items-center justify-between py-2">
                <span className="text-[12px] font-bold text-foreground">{displayName}</span>
                <button onClick={() => { handleSignOut(); setMenuOpen(false); }} className="text-[12px] font-bold text-muted">Sair</button>
              </div>
            ) : (
              <Link href="/login" onClick={() => setMenuOpen(false)} className="block text-[12px] uppercase tracking-[0.18em] font-bold text-muted py-2">Entrar</Link>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
