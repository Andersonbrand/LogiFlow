'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface PriceContextType {
  showPrices: boolean;
  loading: boolean;
  toggle: () => Promise<void>;
}

const PriceContext = createContext<PriceContextType>({
  showPrices: true, loading: true, toggle: async () => {},
});

export function PriceProvider({ children }: { children: React.ReactNode }) {
  const [showPrices, setShowPrices] = useState(true);
  const [loading, setLoading]       = useState(true);

  // Busca valor do banco ao montar
  useEffect(() => {
    const supabase = createClient();

    supabase.from('settings').select('value').eq('key', 'show_prices').single()
      .then(({ data }) => {
        setShowPrices(data?.value !== 'false');
        setLoading(false);
      })
      .catch(() => setLoading(false));

    // Realtime: propaga mudanças instantaneamente para todas as páginas
    const channel = supabase
      .channel('price-toggle')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'settings', filter: 'key=eq.show_prices' },
        (payload: any) => {
          setShowPrices(payload.new?.value !== 'false');
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const toggle = async () => {
    const supabase = createClient();
    const next = !showPrices;
    setShowPrices(next); // otimista
    const { error } = await supabase
      .from('settings')
      .upsert({ key: 'show_prices', value: String(next) }, { onConflict: 'key' });
    if (error) {
      setShowPrices(!next); // reverte se falhar
      console.error('Erro ao salvar configuração de preços:', error.message);
    }
  };

  return (
    <PriceContext.Provider value={{ showPrices, loading, toggle }}>
      {children}
    </PriceContext.Provider>
  );
}

export const usePrices = () => useContext(PriceContext);
