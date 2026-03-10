import { useEffect } from 'react';

/**
 * Hook que detecta quando o usuário volta para a aba após inatividade
 * e chama o callback para rebuscar dados do Supabase.
 *
 * Uso:
 *   useRecarregarAoVoltar(() => loadDados());
 */
export function useRecarregarAoVoltar(callback) {
    useEffect(() => {
        const handler = () => {
            if (typeof callback === 'function') callback();
        };
        window.addEventListener('supabase:recarregar', handler);
        return () => window.removeEventListener('supabase:recarregar', handler);
    }, [callback]);
}
