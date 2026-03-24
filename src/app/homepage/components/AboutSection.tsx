'use client';

import React, { useEffect, useRef } from 'react';
import AppImage from '@/components/ui/AppImage';
import AppIcon from '@/components/ui/AppIcon';

const values = [
  { icon: 'TruckIcon',      title: 'Logística Própria',    desc: 'Frota dedicada para entregas pontuais em obras de qualquer porte em Guanambi e região.' },
  { icon: 'CubeIcon',       title: 'Estoque Garantido',    desc: 'Mais de 800 SKUs disponíveis para pronta entrega com qualidade verificada.' },
  { icon: 'UserGroupIcon',  title: 'Atendimento Técnico',  desc: 'Equipe especializada para auxiliar na escolha dos materiais certos para cada projeto.' },
];

const empresas = [
  { nome: 'Comercial Araguaia', ano: '1990', cor: '#af1518', desc: 'A origem de tudo. Distribuidora de materiais de construção civil que abriu caminho para o grupo.' },
  { nome: 'Confiance Indústria', ano: '2017', cor: '#1a3a6b', desc: 'Mais de 7 anos fabricando telhas de zinco, bobinas e estruturas metálicas com tecnologia própria.' },
  { nome: 'Aços Confiance', ano: '2021', cor: '#b04d00', desc: 'A mais nova do grupo, focada em aço no atacado para serralherias e construtoras com preços imbatíveis.' },
];

export default function AboutSection() {
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
      { threshold: 0.15 }
    );
    const items = sectionRef.current?.querySelectorAll('.animate-on-scroll');
    items?.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <section id="sobre" ref={sectionRef} className="py-32 relative overflow-hidden">
      <div className="absolute inset-0 bg-surface/40 -z-10" />
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/3 rounded-full blur-[150px] -z-10" />

      <div className="max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-20 items-center mb-24">
          {/* Left: image collage */}
          <div className="grid grid-cols-2 gap-5 animate-on-scroll opacity-0 translate-y-8 transition-all duration-1000">
            <div className="space-y-5">
              <div className="aspect-[3/4] rounded-4xl overflow-hidden shadow-blue-lg">
                <AppImage
                  src="https://images.unsplash.com/photo-1628839835275-2b24c0596853"
                  alt="Operário trabalhando com materiais de construção"
                  className="w-full h-full object-cover" fill />
              </div>
              <div className="rounded-4xl p-8 text-white" style={{ background: 'linear-gradient(135deg, #af1518, #8a0f12)' }}>
                <p className="text-4xl font-display font-bold italic">Desde</p>
                <p className="text-5xl font-display font-bold">1990</p>
                <p className="text-[11px] uppercase tracking-[0.25em] opacity-80 mt-1">Servindo Guanambi</p>
              </div>
            </div>
            <div className="pt-16 space-y-5">
              <div className="rounded-4xl p-8 border border-[#dde3ed] bg-white">
                <p className="text-4xl font-display font-bold text-foreground">3</p>
                <p className="text-[11px] uppercase tracking-[0.25em] text-muted mt-1">Empresas do grupo</p>
              </div>
              <div className="aspect-[3/4] rounded-4xl overflow-hidden shadow-xl">
                <AppImage
                  src="https://img.rocket.new/generatedImages/rocket_gen_img_156c56915-1773368820294.png"
                  alt="Estoque de materiais"
                  className="w-full h-full object-cover" fill />
              </div>
            </div>
          </div>

          {/* Right: conteúdo */}
          <div className="space-y-10 animate-on-scroll opacity-0 translate-y-8 transition-all duration-1000 delay-200">
            <div className="space-y-4">
              <span className="text-[10px] uppercase tracking-[0.4em] font-bold" style={{ color: '#b04d00' }}>
                Nossa Filosofia
              </span>
              <h2 className="text-5xl md:text-6xl font-bold tracking-tight leading-[1.05] text-foreground">
                Construindo{' '}
                <span className="font-display italic text-gradient-blue">relações</span>{' '}
                sólidas.
              </h2>
            </div>

            <p className="text-lg text-muted leading-relaxed">
              A <strong className="text-foreground">Comercial Araguaia</strong> nasceu em 1990 com a missão de democratizar o
              acesso a materiais de construção de qualidade no interior da Bahia. Ao longo dos anos, crescemos e expandimos
              nosso alcance com a criação de novas empresas dentro do{' '}
              <strong className="text-foreground">Grupo Hugo Costa</strong>.
            </p>

            <p className="text-base text-muted leading-relaxed">
              Em 2017, criamos a <strong className="text-foreground">Confiance Indústria</strong> para fabricar nossas próprias
              telhas de zinco, bobinas e estruturas metálicas — garantindo ainda mais qualidade e preços competitivos.
              Mais recentemente, em 2021, fundamos a <strong className="text-foreground">Aços Confiance</strong>, nossa
              distribuidora de aço no atacado, completando o ecossistema do grupo.
            </p>

            <div className="space-y-6">
              {values.map((item, i) => (
                <div key={item.title} className="flex gap-5 items-start group" style={{ transitionDelay: `${i * 100}ms` }}>
                  <div className="w-12 h-12 shrink-0 rounded-2xl bg-primary/8 border border-primary/15 flex items-center justify-center group-hover:bg-primary group-hover:border-primary transition-all duration-300">
                    <AppIcon name={item.icon as any} size={20} className="text-primary group-hover:text-white transition-colors" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-foreground mb-1">{item.title}</h4>
                    <p className="text-sm text-muted leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Cards das 3 empresas do grupo (resumo) */}
        <div className="animate-on-scroll opacity-0 translate-y-8 transition-all duration-1000 delay-300">
          <div className="text-center mb-10">
            <p className="text-[10px] uppercase tracking-[0.4em] font-bold text-muted mb-2">Nossas Empresas</p>
            <h3 className="text-3xl font-bold text-foreground">O Grupo HC em números</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {empresas.map((emp) => (
              <div key={emp.nome} className="rounded-4xl border border-[#dde3ed] bg-white p-7 relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300">
                <div className="absolute top-0 left-0 right-0 h-1" style={{ backgroundColor: emp.cor }} />
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-2xl font-display font-bold" style={{ color: emp.cor }}>{emp.ano}</span>
                  <span className="text-[9px] uppercase tracking-[0.3em] font-bold px-2 py-1 rounded-lg"
                    style={{ backgroundColor: `${emp.cor}12`, color: emp.cor }}>
                    Fundação
                  </span>
                </div>
                <h4 className="text-lg font-bold text-foreground mb-2">{emp.nome}</h4>
                <p className="text-sm text-muted leading-relaxed">{emp.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
