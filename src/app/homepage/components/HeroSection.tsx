'use client';

import React, { useEffect, useRef } from 'react';
import Link from 'next/link';
import AppImage from '@/components/ui/AppImage';
import AppIcon from '@/components/ui/AppIcon';

export default function HeroSection() {
  const heroRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!heroRef.current) return;
      const x = (e.clientX / window.innerWidth - 0.5) * 20;
      const y = (e.clientY / window.innerHeight - 0.5) * 20;
      heroRef.current.querySelectorAll<HTMLElement>('.parallax-blob').forEach((blob, i) => {
        const f = (i + 1) * 0.4;
        blob.style.transform = `translate(${x * f}px, ${y * f}px)`;
      });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <section ref={heroRef} className="relative min-h-screen flex items-center pt-28 pb-20 overflow-hidden bg-white noise-overlay">
      <div className="parallax-blob absolute top-[10%] right-[5%] w-[500px] h-[500px] bg-primary/5 rounded-full blur-[100px] transition-transform duration-700 ease-out pointer-events-none" />
      <div className="parallax-blob absolute bottom-[10%] left-[0%] w-[400px] h-[400px] bg-accent/4 rounded-full blur-[120px] transition-transform duration-700 ease-out pointer-events-none" />
      <div className="parallax-blob absolute top-[40%] left-[30%] w-[300px] h-[300px] bg-primary/3 rounded-full blur-[80px] transition-transform duration-700 ease-out pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-12 gap-12 items-center relative z-10">
        {/* Esquerda */}
        <div className="lg:col-span-6 space-y-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/8 border border-primary/15 text-primary">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-[10px] uppercase tracking-[0.3em] font-bold">Guanambi e Região · Bahia</span>
          </div>

          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold leading-[1.05] tracking-tight text-foreground">
            Tudo que sua{' '}
            <span className="font-display italic text-gradient-red">obra precisa,</span>
            <br />
            com os melhores{' '}
            <span className="font-display italic text-gradient-blue">preços.</span>
          </h1>

          <p className="text-lg text-muted max-w-lg leading-relaxed">
            Cimento, vergalhões, ferragens e materiais de serralheiro com qualidade garantida.
            A <strong className="text-foreground">Comercial Araguaia</strong> é sua parceira em
            Guanambi para todas as etapas da construção.
          </p>

          <div className="flex flex-wrap gap-4">
            <a href="https://wa.me/5577981046133" target="_blank" rel="noopener noreferrer"
              className="px-8 py-4 rounded-xl bg-primary text-white font-bold text-sm hover:bg-primary-dark transition-all shadow-red-lg hover:shadow-red-xl hover:-translate-y-0.5 flex items-center gap-2">
              <AppIcon name="ChatBubbleLeftRightIcon" size={18} />
              Falar no WhatsApp
            </a>
            <Link href="/products"
              className="px-8 py-4 rounded-xl border border-border bg-white text-foreground font-bold text-sm hover:bg-surface transition-all hover:border-primary/30">
              Ver Catálogo
            </Link>
          </div>

          <div className="flex flex-wrap gap-6 pt-2">
            {[
              { icon: 'CheckBadgeIcon',  label: 'Desde 1990 no mercado' },
              { icon: 'TruckIcon',       label: 'Entrega em Guanambi e região' },
              { icon: 'ShieldCheckIcon', label: 'Qualidade garantida' },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2 text-[12px] font-medium text-muted">
                <AppIcon name={item.icon} size={16} className="text-primary" />
                {item.label}
              </div>
            ))}
          </div>
        </div>

        {/* Direita — collage sem card de estoque */}
        <div className="lg:col-span-6 relative h-[580px] hidden lg:block">
          <div className="absolute top-0 right-0 w-[58%] aspect-[4/5] rounded-4xl overflow-hidden shadow-2xl border border-border/40 z-10 animate-float">
            <AppImage src="https://images.unsplash.com/photo-1675352306826-389b0718edb6" alt="Obra de construção civil" className="product-img w-full h-full object-cover" fill />
          </div>
          <div className="absolute top-[22%] left-0 w-[48%] aspect-square rounded-4xl overflow-hidden shadow-2xl border border-border/40 z-20 animate-float-delay">
            <AppImage src="https://images.unsplash.com/photo-1628839835275-2b24c0596853" alt="Materiais de construção" className="product-img w-full h-full object-cover" fill />
          </div>
          <div className="absolute bottom-[-2%] left-[22%] w-[42%] aspect-[3/4] rounded-4xl overflow-hidden shadow-2xl border border-border/40 z-30 animate-float-slow">
            <AppImage src="https://images.unsplash.com/photo-1561910733-0512c2b2e28a" alt="Sacos de cimento" className="product-img w-full h-full object-cover" fill />
          </div>

          {/* Único floating card — Desde 1990 */}
          <div className="absolute top-[8%] left-[8%] z-40 glass rounded-2xl px-5 py-4 shadow-red-lg animate-float-delay">
            <p className="text-2xl font-display font-bold text-primary">Desde 1990</p>
            <p className="text-[10px] uppercase tracking-widest text-muted font-bold">Servindo Guanambi</p>
          </div>
        </div>

        {/* Mobile hero */}
        <div className="lg:hidden w-full aspect-video rounded-4xl overflow-hidden shadow-2xl">
          <AppImage src="https://images.unsplash.com/photo-1504307651254-35680f356dfd" alt="Comercial Araguaia" className="w-full h-full object-cover" fill priority />
        </div>
      </div>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 animate-bounce">
        <span className="text-[9px] uppercase tracking-[0.3em] text-muted font-bold">Rolar</span>
        <AppIcon name="ChevronDownIcon" size={16} className="text-muted" />
      </div>
    </section>
  );
}
