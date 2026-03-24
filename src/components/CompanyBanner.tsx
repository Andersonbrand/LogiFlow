'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useCompany } from '@/context/CompanyContext';
import AppIcon from '@/components/ui/AppIcon';

export default function CompanyBanner() {
  const { company, setActiveCompany, isGrupoView } = useCompany();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isGrupoView) {
      // Small delay for smooth entrance
      setTimeout(() => setVisible(true), 50);
    } else {
      setVisible(false);
    }
  }, [isGrupoView]);

  if (isGrupoView || !company) return null;

  return (
    <div
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 transition-all duration-500 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      }`}
    >
      <div
        className="flex items-center gap-4 px-5 py-3 rounded-2xl shadow-2xl border border-white/20 backdrop-blur-xl"
        style={{
          background: `linear-gradient(135deg, ${company.primaryColor}f0, ${company.primaryDark}f0)`,
          boxShadow: `0 20px 60px ${company.primaryColor}50`,
        }}
      >
        {/* Identidade */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
            <AppIcon name="BuildingStorefrontIcon" size={16} className="text-white" />
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-[0.3em] font-bold text-white/60">Visualizando</p>
            <p className="text-sm font-bold text-white leading-none">{company.name}</p>
          </div>
        </div>

        <div className="w-px h-8 bg-white/20" />

        {/* Tags de categoria */}
        <div className="hidden sm:flex items-center gap-1.5">
          {company.categories.slice(0, 3).map((cat) => (
            <span key={cat} className="text-[10px] font-bold px-2 py-1 rounded-lg bg-white/15 text-white">
              {cat}
            </span>
          ))}
        </div>

        <div className="w-px h-8 bg-white/20 hidden sm:block" />

        {/* Ações */}
        <div className="flex items-center gap-2">
          <Link
            href={`/products?empresa=${company.id}`}
            className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-white bg-white/20 hover:bg-white/30 transition-colors px-3 py-2 rounded-xl"
          >
            <AppIcon name="Squares2X2Icon" size={13} />
            Ver Produtos
          </Link>
          <button
            onClick={() => setActiveCompany(null)}
            className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 transition-colors text-white"
            title="Voltar ao Grupo"
          >
            <AppIcon name="XMarkIcon" size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
