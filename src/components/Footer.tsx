'use client';

import React from 'react';
import Link from 'next/link';
import AppLogo from '@/components/ui/AppLogo';
import { COMPANIES, COMPANY_ORDER } from '@/context/CompanyContext';

export default function Footer() {
    return (
        <footer className="border-t border-border bg-white">
            {/* Faixa tricolor do grupo */}
            <div className="h-1 bg-gradient-to-r from-[#af1518] via-[#1a3a6b] to-[#b04d00]" />

            <div className="max-w-7xl mx-auto px-6 py-16">
                {/* Grupo HC header */}
                <div className="flex items-center gap-4 mb-10 pb-10 border-b border-border">
                    <AppLogo size={44} forceCompany={null} />
                    <div>
                        <p className="font-display font-bold text-lg text-foreground">Grupo HC</p>
                        <p className="text-[9px] uppercase tracking-[0.3em] text-muted font-medium">Hugo Costa · Confiança & Responsabilidade</p>
                    </div>
                    <div className="ml-auto hidden md:flex items-center gap-3">
                        {COMPANY_ORDER.map((id) => {
                            const co = COMPANIES[id];
                            return (
                                <span key={id} className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-xl border"
                                    style={{ color: co.primaryColor, borderColor: `${co.primaryColor}30`, backgroundColor: co.bgLight }}>
                                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: co.primaryColor }} />
                                    {co.shortName}
                                </span>
                            );
                        })}
                    </div>
                </div>

                <div className="grid md:grid-cols-4 gap-10 mb-12">
                    {/* 3 empresas */}
                    {COMPANY_ORDER.map((id) => {
                        const co = COMPANIES[id];
                        return (
                            <div key={id} className="space-y-3">
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="w-2 h-8 rounded-full" style={{ backgroundColor: co.primaryColor }} />
                                    <div>
                                        <p className="text-sm font-bold text-foreground leading-tight">{co.name}</p>
                                        <p className="text-[9px] uppercase tracking-widest" style={{ color: co.primaryColor }}>{co.segment}</p>
                                    </div>
                                </div>
                                <p className="text-xs text-muted leading-relaxed">
                                    {id === 'araguaia' && 'Materiais de construção civil desde 1990. Cimento, vergalhões, ferragens e serralheria em Guanambi, BA.'}
                                    {id === 'confiance-industria' && 'Indústria de aço há mais de 7 anos. Telhas de zinco, bobinas, treliças e colunas fabricados com qualidade.'}
                                    {id === 'acos-confiance' && 'Distribuidora de aço no atacado há 3 anos. Vergalhões, barras, chapas e perfis para obras e serralherias.'}
                                </p>
                                <p className="text-[11px]" style={{ color: co.primaryColor }}>
                                    <span className="font-bold">Desde {co.founded}</span>
                                </p>
                            </div>
                        );
                    })}

                    {/* Contato + nav */}
                    <div className="space-y-6">
                        <div>
                            <p className="text-[10px] uppercase tracking-[0.3em] font-bold text-foreground mb-3">Navegação</p>
                            <nav className="flex flex-col gap-2">
                                {[
                                    { label: 'Início',    href: '/homepage' },
                                    { label: 'Produtos',  href: '/products' },
                                    { label: 'Sobre Nós', href: '/sobre' },
                                    { label: 'Orçamento', href: '/homepage#orcamento' },
                                ].map((l) => (
                                    <Link key={l.href} href={l.href}
                                        className="text-sm font-medium text-muted hover:text-foreground transition-colors">
                                        {l.label}
                                    </Link>
                                ))}
                            </nav>
                        </div>

                        <div>
                            <p className="text-[10px] uppercase tracking-[0.3em] font-bold text-foreground mb-3">Contato</p>
                            <div className="space-y-2 text-xs text-muted">
                                <a href="https://wa.me/5577981046133" target="_blank" rel="noopener noreferrer"
                                    className="flex items-center gap-1.5 hover:text-[#af1518] transition-colors">
                                    <span className="font-bold text-[#af1518]">WhatsApp:</span>(77) 9 8104-6133
                                </a>
                                <a href="mailto:comercialaraguaia2018@outlook.com"
                                    className="flex items-center gap-1.5 hover:text-[#af1518] transition-colors break-all">
                                    <span className="font-bold text-[#af1518]">E-mail:</span>comercialaraguaia2018@outlook.com
                                </a>
                                <p><span className="font-bold text-[#af1518]">Endereço:</span> Guanambi / Bahia</p>
                                <p>Seg–Sex, 8h–18h · Sáb, 8h–12h</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="border-t border-border pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <span className="text-[12px] text-muted">
                        © {new Date().getFullYear()} Grupo HC — Comercial Araguaia · Confiance Indústria · Aços Confiance · Guanambi, Bahia
                    </span>
                    <div className="flex items-center gap-6 text-[12px] text-muted">
                        <Link href="#" className="hover:text-foreground transition-colors">Privacidade</Link>
                        <span className="text-border">·</span>
                        <Link href="#" className="hover:text-foreground transition-colors">Termos</Link>
                    </div>
                </div>
            </div>
        </footer>
    );
}
