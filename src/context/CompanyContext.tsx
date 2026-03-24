'use client';

import React, { createContext, useContext, useState } from 'react';

export type CompanyId = 'araguaia' | 'confiance-industria' | 'acos-confiance';

export interface Company {
  id: CompanyId;
  name: string;
  shortName: string;
  tagline: string;
  description: string;
  segment: string;
  founded: string;
  primaryColor: string;
  primaryDark: string;
  accentColor: string;
  bgLight: string;
  gradient: string;
  gradientText: string;
  categories: string[];
  whatsapp: string;
}

// Categorias de cada empresa — usado como filtro de fallback quando o produto
// ainda não tem o campo companies[] no banco (antes da migration ser aplicada)
export const COMPANY_CATEGORIES: Record<CompanyId, string[]> = {
  'araguaia':            ['Cimento', 'Vergalhões', 'Barras e Perfis', 'Tubos', 'Chapas', 'Parafusos', 'Arames', 'Aços Planos', 'Ferragens', 'Argamassas', 'Serralheria'],
  'confiance-industria': ['Telhas', 'Telhas de Zinco', 'Bobinas de Zinco', 'Colunas', 'Treliças', 'Colunas e Treliças'],
  'acos-confiance':      ['Vergalhões', 'Barras e Perfis', 'Tubos', 'Chapas', 'Arames', 'Aços Planos', 'Serralheria'],
};

// Categorias compartilhadas entre Araguaia e Aços Confiance
export const SHARED_CATEGORIES = ['Vergalhões', 'Barras e Perfis', 'Tubos', 'Chapas', 'Arames', 'Aços Planos'];

export const COMPANIES: Record<CompanyId, Company> = {
  'araguaia': {
    id: 'araguaia',
    name: 'Comercial Araguaia',
    shortName: 'Araguaia',
    tagline: 'Tudo para sua obra, com os melhores preços.',
    description: 'A pioneira do grupo. Desde 1990 abastecendo Guanambi e toda a região com materiais de construção civil de qualidade, preços justos e atendimento técnico especializado.',
    segment: 'Materiais de Construção',
    founded: '1990',
    primaryColor: '#af1518',
    primaryDark: '#8a0f12',
    accentColor: '#0056a6',
    bgLight: '#fdf0f0',
    gradient: 'linear-gradient(135deg, #af1518 0%, #c41a1d 50%, #8a0f12 100%)',
    gradientText: 'linear-gradient(135deg, #af1518 0%, #e03235 60%, #8a0f12 100%)',
    categories: COMPANY_CATEGORIES['araguaia'],
    whatsapp: '5577981046133',
  },
  'confiance-industria': {
    id: 'confiance-industria',
    name: 'Confiance Indústria',
    shortName: 'Confiance',
    tagline: 'Inovação em ferro e aço direto da fábrica.',
    description: 'A indústria do grupo, com mais de 7 anos fabricando telhas de zinco, bobinas, treliças, colunas e painéis com tecnologia própria e qualidade superior.',
    segment: 'Indústria de Aço',
    founded: '2017',
    primaryColor: '#1a3a6b',
    primaryDark: '#0f2247',
    accentColor: '#4a7fd4',
    bgLight: '#f0f4ff',
    gradient: 'linear-gradient(135deg, #1a3a6b 0%, #2552a0 50%, #0f2247 100%)',
    gradientText: 'linear-gradient(135deg, #1a3a6b 0%, #3366cc 60%, #0f2247 100%)',
    categories: COMPANY_CATEGORIES['confiance-industria'],
    whatsapp: '5577981046133',
  },
  'acos-confiance': {
    id: 'acos-confiance',
    name: 'Aços Confiance',
    shortName: 'Aços',
    tagline: 'Aço e serralheria com expertise do atacado.',
    description: 'A distribuidora mais recente do grupo, com 3 anos focando em serralheria profissional, vergalhões e malhas para construtoras com preços de atacado.',
    segment: 'Distribuição de Aço',
    founded: '2021',
    primaryColor: '#b04d00',
    primaryDark: '#803800',
    accentColor: '#e67e22',
    bgLight: '#fff7f0',
    gradient: 'linear-gradient(135deg, #b04d00 0%, #d45f00 50%, #803800 100%)',
    gradientText: 'linear-gradient(135deg, #b04d00 0%, #e06500 60%, #803800 100%)',
    categories: COMPANY_CATEGORIES['acos-confiance'],
    whatsapp: '5577981046133',
  },
};

export const COMPANY_ORDER: CompanyId[] = ['araguaia', 'confiance-industria', 'acos-confiance'];

interface CompanyContextType {
  activeCompany: CompanyId | null;
  company: Company | null;
  setActiveCompany: (id: CompanyId | null) => void;
  isGrupoView: boolean;
}

const CompanyContext = createContext<CompanyContextType>({
  activeCompany: null,
  company: null,
  setActiveCompany: () => {},
  isGrupoView: true,
});

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const [activeCompany, setActiveCompany] = useState<CompanyId | null>(null);
  const company = activeCompany ? COMPANIES[activeCompany] : null;

  return (
    <CompanyContext.Provider value={{
      activeCompany,
      company,
      setActiveCompany,
      isGrupoView: activeCompany === null,
    }}>
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  return useContext(CompanyContext);
}
