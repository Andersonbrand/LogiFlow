'use client';

import React, { useEffect, useRef } from 'react';
import { useCompany, COMPANIES, CompanyId } from '@/context/CompanyContext';
import AppIcon from '@/components/ui/AppIcon';

const COMPANY_ORDER: CompanyId[] = ['araguaia', 'confiance-industria', 'acos-confiance'];

export default function GrupoHCSection() {
  const { setActiveCompany, activeCompany } = useCompany();
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('opacity-100', 'translate-y-0');
            entry.target.classList.remove('opacity-0', 'translate-y-8');
          }
        });
      },
      { threshold: 0.12 }
    );
    const items = sectionRef.current?.querySelectorAll('.reveal');
    items?.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={sectionRef} id="grupo-hc" className="py-32 relative overflow-hidden bg-white">
      {/* Decoração de fundo sutil */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#af1518] via-[#1a3a6b] to-[#b04d00]" />
        <div className="absolute top-1/3 right-[-200px] w-[500px] h-[500px] rounded-full blur-[120px] opacity-[0.04]"
          style={{ background: 'radial-gradient(circle, #1a3a6b, transparent)' }} />
        <div className="absolute bottom-1/4 left-[-100px] w-[350px] h-[350px] rounded-full blur-[100px] opacity-[0.04]"
          style={{ background: 'radial-gradient(circle, #af1518, transparent)' }} />
      </div>

      <div className="max-w-7xl mx-auto px-6">

        {/* Cabeçalho do grupo */}
        <div className="reveal opacity-0 translate-y-8 transition-all duration-1000 text-center mb-20">
          {/* Logo/identidade do Grupo HC */}
          <div className="inline-flex items-center justify-center gap-4 mb-8">
            <div className="flex items-center gap-3 px-6 py-3 rounded-2xl border border-[#0d1117]/10 bg-[#f5f7fa]">
              {/* Logotipo estilizado do Grupo HC */}
              <div className="flex items-center gap-0.5">
                <span className="text-3xl font-black tracking-tighter" style={{ color: '#0d1117', fontFamily: 'Georgia, serif', letterSpacing: '-0.05em' }}>H</span>
                <span className="text-3xl font-black tracking-tighter" style={{ color: '#0d1117', fontFamily: 'Georgia, serif', letterSpacing: '-0.05em' }}>C</span>
              </div>
              <div className="w-px h-8 bg-[#dde3ed]" />
              <div className="flex flex-col leading-none text-left">
                <span className="text-[10px] uppercase tracking-[0.35em] font-bold text-[#5a6272]">Grupo</span>
                <span className="text-sm font-bold text-[#0d1117]">Hugo Costa</span>
              </div>
            </div>
          </div>

          <p className="text-[10px] uppercase tracking-[0.5em] font-bold mb-4" style={{ color: '#5a6272' }}>
            Confiança & Responsabilidade
          </p>
          <h2 className="text-5xl md:text-6xl font-bold tracking-tight leading-[1.05] text-[#0d1117] mb-6">
            Três empresas,{' '}
            <span className="font-display italic" style={{
              background: 'linear-gradient(135deg, #af1518 0%, #1a3a6b 50%, #b04d00 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>
              um grupo.
            </span>
          </h2>
          <p className="text-lg text-[#5a6272] max-w-2xl mx-auto leading-relaxed">
            O Grupo HC nasceu da Comercial Araguaia e cresceu com a criação da Confiance Indústria e da Aços Confiance —
            todas com o propósito de oferecer os <strong className="text-[#0d1117]">melhores preços</strong> e{' '}
            <strong className="text-[#0d1117]">produtos de qualidade</strong> para o nosso cliente.
          </p>
        </div>

        {/* Cards das 3 empresas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          {COMPANY_ORDER.map((id, i) => {
            const co = COMPANIES[id];
            const isActive = activeCompany === id;
            return (
              <button
                key={id}
                onClick={() => setActiveCompany(isActive ? null : id)}
                className="reveal opacity-0 translate-y-8 transition-all duration-700 text-left group relative overflow-hidden rounded-4xl border-2 focus:outline-none"
                style={{
                  transitionDelay: `${i * 120}ms`,
                  borderColor: isActive ? co.primaryColor : '#dde3ed',
                  backgroundColor: isActive ? co.bgLight : '#fff',
                  boxShadow: isActive ? `0 20px 60px ${co.primaryColor}20` : '0 4px 20px rgba(0,0,0,0.04)',
                  transform: isActive ? 'translateY(-4px)' : undefined,
                }}
              >
                {/* Barra de cor no topo */}
                <div className="absolute top-0 left-0 right-0 h-1.5 transition-all duration-300"
                  style={{ background: isActive ? co.gradient : `linear-gradient(90deg, ${co.primaryColor}40, transparent)` }} />

                <div className="p-8">
                  {/* Badge fundação */}
                  <div className="flex items-center justify-between mb-6">
                    <span className="text-[10px] uppercase tracking-[0.3em] font-bold px-3 py-1.5 rounded-full"
                      style={{ backgroundColor: `${co.primaryColor}12`, color: co.primaryColor }}>
                      Desde {co.founded}
                    </span>
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-300"
                      style={{ backgroundColor: isActive ? co.primaryColor : `${co.primaryColor}10` }}>
                      <AppIcon name="ArrowRightIcon" size={14}
                        style={{ color: isActive ? '#fff' : co.primaryColor }}
                        className={`transition-transform duration-300 ${isActive ? 'rotate-45' : 'group-hover:translate-x-0.5'}`} />
                    </div>
                  </div>

                  {/* Nome */}
                  <h3 className="text-xl font-bold mb-1 leading-tight" style={{ color: '#0d1117' }}>
                    {co.name}
                  </h3>
                  <p className="text-[11px] uppercase tracking-[0.2em] font-bold mb-4" style={{ color: co.primaryColor }}>
                    {co.segment}
                  </p>

                  {/* Descrição curta */}
                  <p className="text-sm leading-relaxed mb-6" style={{ color: '#5a6272' }}>
                    {co.description}
                  </p>

                  {/* Tags de categorias */}
                  <div className="flex flex-wrap gap-2">
                    {co.categories.slice(0, 4).map((cat) => (
                      <span key={cat} className="text-[10px] font-bold px-2.5 py-1 rounded-lg"
                        style={{
                          backgroundColor: isActive ? `${co.primaryColor}15` : '#f5f7fa',
                          color: isActive ? co.primaryColor : '#5a6272',
                        }}>
                        {cat}
                      </span>
                    ))}
                    {co.categories.length > 4 && (
                      <span className="text-[10px] font-bold px-2.5 py-1 rounded-lg"
                        style={{ backgroundColor: '#f5f7fa', color: '#5a6272' }}>
                        +{co.categories.length - 4}
                      </span>
                    )}
                  </div>
                </div>

                {/* Footer do card com CTA */}
                <div className="px-8 pb-6 pt-2 flex items-center gap-2 transition-all duration-300"
                  style={{ borderTop: `1px solid ${isActive ? co.primaryColor + '20' : '#f0f0f0'}` }}>
                  <span className="text-[11px] font-bold uppercase tracking-widest transition-colors duration-300"
                    style={{ color: isActive ? co.primaryColor : '#9aa0ad' }}>
                    {isActive ? 'Ver produtos desta empresa' : 'Selecionar empresa'}
                  </span>
                  <AppIcon name="ArrowRightIcon" size={12}
                    style={{ color: isActive ? co.primaryColor : '#9aa0ad' }}
                    className={`transition-all duration-300 ${isActive ? 'translate-x-0.5' : ''}`} />
                </div>
              </button>
            );
          })}
        </div>

        {/* Banner linha do tempo do grupo */}
        <div className="reveal opacity-0 translate-y-8 transition-all duration-1000 delay-300">
          <div className="relative rounded-4xl overflow-hidden border border-[#dde3ed] bg-[#f5f7fa] p-8 md:p-12">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#af1518] via-[#1a3a6b] to-[#b04d00]" />

            <div className="text-center mb-10">
              <p className="text-[10px] uppercase tracking-[0.4em] font-bold text-[#5a6272] mb-2">Linha do Tempo</p>
              <h3 className="text-2xl font-bold text-[#0d1117]">Uma história de crescimento contínuo</h3>
            </div>

            <div className="relative">
              {/* Linha conectora */}
              <div className="absolute top-8 left-0 right-0 h-px bg-gradient-to-r from-[#af1518] via-[#1a3a6b] to-[#b04d00] hidden md:block" />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10">
                {[
                  { year: '1990', company: 'Comercial Araguaia', event: 'Fundação da primeira empresa do grupo em Guanambi, BA. Início como distribuidora de materiais de construção civil.', color: '#af1518' },
                  { year: '2017', company: 'Confiance Indústria', event: 'Criação da indústria própria para fabricação de telhas de zinco, bobinas e estruturas metálicas. Mais de 7 anos no mercado.', color: '#1a3a6b' },
                  { year: '2021', company: 'Aços Confiance', event: 'Expansão com a distribuidora de aço no atacado, atendendo serralherias e construtoras com os melhores preços.', color: '#b04d00' },
                ].map((item, i) => (
                  <div key={item.year} className="flex flex-col items-center text-center gap-4">
                    {/* Nó da timeline */}
                    <div className="w-16 h-16 rounded-full flex items-center justify-center font-display font-bold text-xl text-white shadow-lg"
                      style={{ background: `linear-gradient(135deg, ${item.color}, ${item.color}cc)` }}>
                      {item.year.slice(2)}
                    </div>
                    <div>
                      <p className="text-base font-bold text-[#0d1117] mb-1">{item.year} · {item.company}</p>
                      <p className="text-sm text-[#5a6272] leading-relaxed max-w-xs mx-auto">{item.event}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
