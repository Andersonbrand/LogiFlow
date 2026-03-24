'use client';

import React, { useEffect, useRef, useState } from 'react';

interface StatItem { value: number; suffix: string; label: string; color: string; }

const stats: StatItem[] = [
  { value: 25,   suffix: '+', label: 'Anos no mercado',               color: 'text-primary' },
  { value: 5000, suffix: '+', label: 'Clientes ativos',               color: 'text-accent'  },
  { value: 800,  suffix: '+', label: 'Produtos em estoque',           color: 'text-primary' },
  { value: 90,   suffix: '%', label: 'Clientes confiam na qualidade', color: 'text-accent'  },
];

const partners = [
  { name: 'BRASILIT',      color: '#e30613' },
  { name: 'GERDAU',        color: '#f4a01c' },
  { name: 'CSN',           color: '#003087' },
  { name: 'AVB',           color: '#1a1a1a' },
  { name: 'SIMEC',         color: '#c8102e' },
  { name: 'ARCELORMITTAL', color: '#005daa' },
  { name: 'LIZ',           color: '#e2001a' },
  { name: 'AÇO CEARENSE',  color: '#1d6436' },
];

function useCountUp(target: number, duration: number, start: boolean) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!start) return;
    let startTime: number | null = null;
    const raf = requestAnimationFrame(function step(ts) {
      if (!startTime) startTime = ts;
      const p = Math.min((ts - startTime) / duration, 1);
      setCount(Math.floor((1 - Math.pow(1 - p, 3)) * target));
      if (p < 1) requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(raf);
  }, [target, duration, start]);
  return count;
}

function StatCard({ stat, animate }: { stat: StatItem; animate: boolean }) {
  const count = useCountUp(stat.value, 2000, animate);
  return (
    <div className="text-center space-y-2 px-8 py-6 border-r border-border/40 last:border-r-0">
      <p className={`text-5xl md:text-6xl font-display font-bold ${stat.color}`}>
        {count.toLocaleString('pt-BR')}{stat.suffix}
      </p>
      <p className="text-[11px] uppercase tracking-[0.25em] text-muted font-bold">{stat.label}</p>
    </div>
  );
}

export default function StatsSection() {
  const ref = useRef<HTMLDivElement>(null);
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    // Dispara imediatamente se já visível (evita o bug de "0" ao carregar)
    const check = () => {
      if (!ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      if (rect.top < window.innerHeight && rect.bottom > 0) {
        setAnimate(true);
        return true;
      }
      return false;
    };
    if (check()) return; // já visível, não precisa de observer

    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setAnimate(true); observer.disconnect(); } },
      { threshold: 0.1 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  const track = [...partners, ...partners, ...partners];

  return (
    <section className="py-20 bg-white border-y border-border/40">
      <div ref={ref} className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 border border-border/40 rounded-3xl overflow-hidden bg-white shadow-sm">
          {stats.map((stat) => <StatCard key={stat.label} stat={stat} animate={animate} />)}
        </div>
      </div>

      <div className="mt-16 overflow-hidden">
        <p className="text-center text-[10px] uppercase tracking-[0.4em] text-muted font-bold mb-10">
          Marcas que Distribuímos
        </p>
        <div className="relative">
          <div className="absolute left-0 top-0 h-full w-24 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none" />
          <div className="absolute right-0 top-0 h-full w-24 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none" />
          <div className="marquee-track flex gap-12 items-center">
            {track.map((p, i) => (
              <div key={i} className="shrink-0 flex items-center gap-2.5 px-6 py-3 rounded-2xl border border-border/60 bg-white shadow-sm hover:shadow-md transition-shadow">
                <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                <span className="text-sm font-display font-bold tracking-tight whitespace-nowrap" style={{ color: p.color }}>{p.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
