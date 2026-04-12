'use client';

import React, { useEffect, useRef } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import AppImage from '@/components/ui/AppImage';
import AppIcon from '@/components/ui/AppIcon';
import AppLogo from '@/components/ui/AppLogo';

function useReveal(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('opacity-100', 'translate-y-0');
          el.classList.remove('opacity-0', 'translate-y-10');
          observer.disconnect();
        }
      },
      { threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);
  return ref;
}

const EMPRESAS = [
  {
    id: 'araguaia',
    nome: 'Comercial Araguaia',
    fundacao: '1990',
    anos: '35+',
    cor: '#af1518',
    gradiente: 'linear-gradient(135deg, #af1518, #8a0f12)',
    bgLight: '#fdf0f0',
    segmento: 'Materiais de Construção',
    descricao: 'A pioneira do Grupo HC. Desde 1990, a Comercial Araguaia abastece Guanambi e toda a região com cimento, vergalhões, ferragens, malhas, argamassas e materiais de serralheria. Mais de três décadas construindo confiança ao lado de famílias, construtores e empreiteiros.',
    categorias: ['Cimento', 'Vergalhões', 'Ferragens', 'Malhas', 'Argamassas', 'Serralheria'],
    diferenciais: ['Entrega própria em toda região', 'Parceiros: Gerdau, CSN, LIZ, SIMEC', 'Atendimento técnico especializado'],
  },
  {
    id: 'confiance-industria',
    nome: 'Confiance Indústria',
    fundacao: '2017',
    anos: '7+',
    cor: '#1a3a6b',
    gradiente: 'linear-gradient(135deg, #1a3a6b, #0f2247)',
    bgLight: '#f0f4ff',
    segmento: 'Indústria de Aço',
    descricao: 'Criada em 2017 para fabricar com tecnologia e qualidade própria, a Confiance Indústria representa a expansão do grupo para o setor produtivo. Fabricamos telhas de zinco, bobinas, treliças, colunas e painéis, atendendo construtoras e agronegócio com preços direto da fábrica.',
    categorias: ['Telhas de Zinco', 'Bobinas de Zinco', 'Treliças', 'Colunas', 'Painéis'],
    diferenciais: ['Fabricação própria sem intermediários', 'Telhas para agronegócio e construção', 'Capacidade produtiva industrial'],
  },
  {
    id: 'acos-confiance',
    nome: 'Aços Confiance',
    fundacao: '2021',
    anos: '3+',
    cor: '#b04d00',
    gradiente: 'linear-gradient(135deg, #b04d00, #803800)',
    bgLight: '#fff7f0',
    segmento: 'Distribuição de Aço',
    descricao: 'A mais jovem do grupo, fundada em 2021, a Aços Confiance nasce para atender serralherias e construtoras com preços de atacado. Distribuidora especializada em vergalhões, barras e perfis, chapas e arames — sempre com a qualidade que o Grupo HC garante.',
    categorias: ['Vergalhões', 'Barras e Perfis', 'Chapas', 'Arames', 'Aços Planos'],
    diferenciais: ['Preços de atacado direto', 'Foco em serralherias e construtoras', 'Portfólio especializado em aço'],
  },
];

export default function SobrePage() {
  const r1 = useReveal(); const r2 = useReveal(); const r3 = useReveal();
  const r4 = useReveal(); const r5 = useReveal();

  return (
    <main className="min-h-screen bg-white">
      <Header />

      {/* ── HERO ── */}
      <section className="relative min-h-[65vh] flex items-end pb-20 pt-32 overflow-hidden">
        <div className="absolute inset-0">
          <AppImage src="/assets/images/about/estoque.jpg" alt="Grupo HC" fill
            className="object-cover object-center scale-105 transition-transform duration-[10s] hover:scale-100" priority />
          <div className="absolute inset-0 bg-gradient-to-t from-foreground/85 via-foreground/50 to-foreground/20" />
          {/* Faixa tricolor no topo */}
          <div className="absolute top-0 left-0 right-0 h-1.5 flex">
            <div className="flex-1" style={{ backgroundColor: '#af1518' }} />
            <div className="flex-1" style={{ backgroundColor: '#1a3a6b' }} />
            <div className="flex-1" style={{ backgroundColor: '#b04d00' }} />
          </div>
        </div>
        <div className="relative z-10 max-w-7xl mx-auto px-6 w-full">
          <div className="max-w-3xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/20">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                <span className="text-[10px] uppercase tracking-[0.35em] font-bold text-white/80">Grupo Hugo Costa</span>
              </div>
            </div>
            <h1 className="text-6xl md:text-7xl font-bold text-white leading-[1.02] tracking-tight mb-6">
              Três empresas,{' '}
              <span className="font-display italic" style={{ color: '#f87171' }}>uma história.</span>
            </h1>
            <p className="text-lg text-white/80 max-w-2xl leading-relaxed">
              Desde 1990, o Grupo HC constrói relações sólidas em Guanambi e toda região com
              materiais de qualidade, preços justos e atendimento que faz diferença.
            </p>
            {/* Badges das 3 empresas */}
            <div className="flex flex-wrap gap-3 mt-8">
              {EMPRESAS.map(emp => (
                <div key={emp.id} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 border border-white/15 backdrop-blur-sm">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: emp.cor }} />
                  <span className="text-xs font-bold text-white">{emp.nome}</span>
                  <span className="text-[10px] text-white/50">desde {emp.fundacao}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── SOBRE O GRUPO HC ── */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div ref={r1} className="grid lg:grid-cols-2 gap-16 items-center opacity-0 translate-y-10 transition-all duration-1000">
            <div className="space-y-7">
              <div>
                <span className="text-[10px] uppercase tracking-[0.4em] font-bold text-primary">Quem Somos</span>
                <h2 className="text-4xl md:text-5xl font-bold text-foreground mt-3 leading-tight">
                  Um grupo construído{' '}
                  <span className="font-display italic text-gradient-red">com propósito.</span>
                </h2>
              </div>
              <p className="text-lg text-muted leading-relaxed">
                O <strong className="text-foreground">Grupo Hugo Costa</strong> nasceu com a fundação da{' '}
                <strong className="text-[#af1518]">Comercial Araguaia</strong> em 1990, em Guanambi, Bahia.
                Nossa missão sempre foi democratizar o acesso a materiais de qualidade no interior da Bahia —
                com preços justos e atendimento que faz diferença.
              </p>
              <p className="text-base text-muted leading-relaxed">
                Com o crescimento e a consolidação da Araguaia no mercado regional, expandimos o grupo com a criação
                da <strong className="text-[#1a3a6b]">Confiance Indústria</strong> em 2017, passando a fabricar
                nossos próprios produtos metálicos. Em 2021, fundamos a{' '}
                <strong className="text-[#b04d00]">Aços Confiance</strong>, distribuidora especializada no atacado.
              </p>
              <div className="grid grid-cols-3 gap-4 pt-2">
                {[
                  { v: '35+', l: 'anos de mercado', c: '#af1518' },
                  { v: '3',   l: 'empresas do grupo', c: '#1a3a6b' },
                  { v: '800+', l: 'produtos no portfólio', c: '#b04d00' },
                ].map(s => (
                  <div key={s.l} className="text-center p-4 rounded-2xl border border-[#dde3ed]">
                    <p className="text-3xl font-display font-bold" style={{ color: s.c }}>{s.v}</p>
                    <p className="text-[10px] uppercase tracking-widest text-muted mt-1">{s.l}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-5">
              <div className="space-y-5">
                <div className="aspect-[3/4] rounded-4xl overflow-hidden shadow-lg">
                  <AppImage src="https://images.unsplash.com/photo-1628839835275-2b24c0596853"
                    alt="Obra de construção" className="w-full h-full object-cover" fill />
                </div>
                <div className="rounded-4xl p-6 text-white" style={{ background: 'linear-gradient(135deg, #af1518, #8a0f12)' }}>
                  <p className="text-3xl font-display font-bold">1990</p>
                  <p className="text-[10px] uppercase tracking-widest opacity-80 mt-1">Início da história</p>
                </div>
              </div>
              <div className="pt-12 space-y-5">
                <div className="rounded-4xl p-6 border border-[#dde3ed]">
                  <p className="text-3xl font-display font-bold text-foreground">Guanambi</p>
                  <p className="text-[10px] uppercase tracking-widest text-muted mt-1">Bahia · nossa origem</p>
                </div>
                <div className="aspect-[3/4] rounded-4xl overflow-hidden shadow-xl">
                  <AppImage src="/assets/images/about/vergalhoes.jpg"
                    alt="Materiais de aço" className="w-full h-full object-cover" fill />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CEO / FUNDADOR ── */}
      <section className="py-24 bg-[#f5f7fa] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[400px] h-[400px] rounded-full blur-[120px] opacity-5"
          style={{ background: 'radial-gradient(circle, #af1518, transparent)' }} />
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Foto */}
            <div className="relative">
              <div className="aspect-[4/5] rounded-4xl overflow-hidden shadow-xl max-w-sm mx-auto lg:mx-0">
                <img
                  src="/assets/images/about/ceo.jpg"
                  alt="Hugo Costa — Fundador do Grupo HC"
                  className="w-full h-full object-cover"
                />
              </div>
              {/* Badge fundação */}
              <div className="absolute -bottom-4 -right-4 lg:right-8 rounded-2xl px-6 py-4 shadow-xl border border-white/20 backdrop-blur-sm"
                style={{ background: 'linear-gradient(135deg, #0d1117, #1a2a4a)' }}>
                <p className="text-2xl font-bold text-white" style={{ fontFamily: 'Georgia, serif' }}>HC</p>
                <p className="text-[9px] uppercase tracking-[0.3em] text-white/60 mt-0.5">Fundador & CEO</p>
              </div>
            </div>

            {/* Texto */}
            <div className="space-y-7">
              <div>
                <span className="text-[10px] uppercase tracking-[0.4em] font-bold text-muted">Sobre o Fundador</span>
                <h2 className="text-4xl md:text-5xl font-bold text-foreground mt-3 leading-tight">
                  Hugo Costa,{' '}
                  <span className="font-display italic text-gradient-red">a visão</span>{' '}
                  por trás do grupo.
                </h2>
              </div>
              <p className="text-lg text-muted leading-relaxed">
                Natural de Guanambi, Bahia, <strong className="text-foreground">Hugo Costa</strong> fundou a
                Comercial Araguaia em 1990 com um único propósito: levar materiais de construção de qualidade
                ao interior da Bahia com preços justos e atendimento que faz diferença.
              </p>
              <p className="text-base text-muted leading-relaxed">
                Com uma trajetória marcada pela persistência e pelo olhar no cliente, Hugo transformou uma
                pequena distribuidora em um grupo empresarial sólido. Em 2017, liderou a criação da{' '}
                <strong className="text-[#1a3a6b]">Confiance Indústria</strong>, tornando o grupo
                autossuficiente na fabricação de telhas e estruturas metálicas. Em 2021, fundou a{' '}
                <strong className="text-[#b04d00]">Aços Confiance</strong>, fechando o ciclo do grupo no
                mercado do aço — da indústria ao atacado.
              </p>
              <blockquote className="pl-5 border-l-4 border-primary">
                <p className="text-lg italic text-muted leading-relaxed">
                  "Confiança não se declara — se conquista, entrega por entrega, produto por produto."
                </p>
                <footer className="mt-3 text-sm font-bold text-foreground">— Hugo Costa</footer>
              </blockquote>
              <div className="grid grid-cols-3 gap-4 pt-2">
                {[
                  { v: '1990', l: 'Início da jornada', c: '#af1518' },
                  { v: '3',   l: 'Empresas fundadas', c: '#1a3a6b' },
                  { v: '+35', l: 'Anos no mercado', c: '#b04d00' },
                ].map(s => (
                  <div key={s.l} className="text-center p-3 rounded-2xl border border-[#dde3ed] bg-white">
                    <p className="text-2xl font-display font-bold" style={{ color: s.c }}>{s.v}</p>
                    <p className="text-[9px] uppercase tracking-widest text-muted mt-1">{s.l}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 3 EMPRESAS ── */}
      <section className="py-24 bg-[#f5f7fa]">
        <div className="max-w-7xl mx-auto px-6">
          <div ref={r2} className="text-center mb-16 opacity-0 translate-y-10 transition-all duration-1000">
            <span className="text-[10px] uppercase tracking-[0.4em] font-bold text-muted">Nossas Empresas</span>
            <h2 className="text-4xl md:text-5xl font-bold text-foreground mt-3">
              Cada empresa, um{' '}
              <span className="font-display italic text-gradient-blue">propósito único.</span>
            </h2>
          </div>

          <div className="space-y-8">
            {EMPRESAS.map((emp, i) => (
              <div key={emp.id} ref={i === 0 ? r3 : i === 1 ? r4 : r5}
                className="bg-white rounded-4xl border border-[#dde3ed] overflow-hidden shadow-sm opacity-0 translate-y-10 transition-all duration-1000 hover:-translate-y-1 hover:shadow-lg"
                style={{ transitionDelay: `${i * 100}ms` }}>
                {/* Barra de cor */}
                <div className="h-1.5" style={{ background: emp.gradiente }} />

                <div className="p-8 md:p-10">
                  <div className="grid md:grid-cols-3 gap-8 items-start">
                    {/* Info principal */}
                    <div className="md:col-span-2 space-y-5">
                      <div className="flex items-center gap-4 flex-wrap">
                        <h3 className="text-2xl font-bold text-foreground">{emp.nome}</h3>
                        <span className="text-[9px] uppercase tracking-[0.3em] font-bold px-3 py-1.5 rounded-full"
                          style={{ backgroundColor: emp.bgLight, color: emp.cor }}>
                          Desde {emp.fundacao} · {emp.anos} anos
                        </span>
                      </div>
                      <p className="text-[11px] uppercase tracking-[0.25em] font-bold" style={{ color: emp.cor }}>
                        {emp.segmento}
                      </p>
                      <p className="text-base text-muted leading-relaxed">{emp.descricao}</p>

                      {/* Diferenciais */}
                      <div className="space-y-2">
                        {emp.diferenciais.map(d => (
                          <div key={d} className="flex items-center gap-3 text-sm text-muted">
                            <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                              style={{ backgroundColor: `${emp.cor}15` }}>
                              <AppIcon name="CheckIcon" size={11} style={{ color: emp.cor }} />
                            </div>
                            {d}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Categorias */}
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.3em] font-bold text-muted mb-3">Produtos</p>
                      <div className="flex flex-wrap gap-2">
                        {emp.categorias.map(cat => (
                          <span key={cat} className="text-[11px] font-bold px-3 py-1.5 rounded-xl"
                            style={{ backgroundColor: emp.bgLight, color: emp.cor }}>
                            {cat}
                          </span>
                        ))}
                      </div>
                      <div className="mt-6">
                        <Link href={`/products`}
                          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-[12px] font-bold hover:opacity-90 transition-all"
                          style={{ background: emp.gradiente }}>
                          <AppIcon name="Squares2X2Icon" size={14} />
                          Ver catálogo
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── VALORES ── */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="text-[10px] uppercase tracking-[0.4em] font-bold text-muted">Nossa Filosofia</span>
            <h2 className="text-4xl font-bold text-foreground mt-3">
              O que nos move
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon: 'TruckIcon',     title: 'Logística Própria',   desc: 'Frota dedicada para entregas pontuais em obras de qualquer porte em Guanambi e região.', cor: '#af1518' },
              { icon: 'ShieldCheckIcon', title: 'Qualidade Garantida', desc: 'Parceiros das maiores marcas do setor. Produtos verificados e com garantia de procedência.', cor: '#1a3a6b' },
              { icon: 'UserGroupIcon', title: 'Atendimento Humano',  desc: 'Equipe técnica presente para auxiliar na escolha certa — do projeto à entrega.', cor: '#b04d00' },
            ].map(v => (
              <div key={v.title} className="p-7 rounded-4xl border border-[#dde3ed] bg-white hover:-translate-y-1 transition-transform duration-300">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5"
                  style={{ backgroundColor: `${v.cor}12` }}>
                  <AppIcon name={v.icon as any} size={22} style={{ color: v.cor }} />
                </div>
                <h4 className="text-base font-bold text-foreground mb-2">{v.title}</h4>
                <p className="text-sm text-muted leading-relaxed">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-20 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #0d1117 0%, #1a1a2e 100%)' }}>
        <div className="absolute top-0 left-0 right-0 h-1 flex">
          <div className="flex-1" style={{ backgroundColor: '#af1518' }} />
          <div className="flex-1" style={{ backgroundColor: '#1a3a6b' }} />
          <div className="flex-1" style={{ backgroundColor: '#b04d00' }} />
        </div>
        <div className="max-w-4xl mx-auto px-6 text-center">
          <p className="text-[10px] uppercase tracking-[0.4em] font-bold text-white/40 mb-4">Grupo HC</p>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6 leading-tight">
            Pronto para começar<br />
            <span className="font-display italic text-[#f87171]">sua próxima obra?</span>
          </h2>
          <p className="text-lg text-white/60 mb-10 max-w-xl mx-auto">
            Fale com nossa equipe e receba um orçamento personalizado para seu projeto.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <a href="https://wa.me/557734512175" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 px-8 py-4 rounded-xl text-white font-bold text-sm transition-all hover:-translate-y-0.5 shadow-lg"
              style={{ backgroundColor: '#af1518' }}>
              <AppIcon name="ChatBubbleLeftRightIcon" size={18} />
              Falar no WhatsApp
            </a>
            <Link href="/products"
              className="flex items-center gap-2 px-8 py-4 rounded-xl border border-white/20 text-white font-bold text-sm hover:bg-white/10 transition-all">
              <AppIcon name="Squares2X2Icon" size={18} />
              Ver Produtos
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
