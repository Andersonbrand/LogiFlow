import { useEffect } from 'react';

/**
 * Re-executa `refetch` sempre que o usuario retorna para a aba
 * (evento visibilitychange -> document.visibilityState === 'visible').
 *
 * Evita o problema de dados desatualizados apos o usuario sair e
 * voltar para a aplicacao sem dar refresh manual.
 */
export function useVisibilityRefetch(refetch: () => void) {
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        refetch();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [refetch]);
}
