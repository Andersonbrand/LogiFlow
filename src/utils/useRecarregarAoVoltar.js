import { useEffect, useRef } from 'react';

/**
 * Recarrega os dados da página sempre que o usuário volta para a aba
 * (equivalente ao "refetchOnWindowFocus" de libs como TanStack Query/SWR).
 *
 * Antes esse comportamento dependia de um evento global (`supabase:recarregar`)
 * disparado pelo cliente Supabase — mas só funcionava nas páginas que
 * escutavam esse evento manualmente, então a maioria das telas ficava com
 * dados congelados. Agora o hook escuta `visibilitychange` diretamente,
 * então basta chamar `useRecarregarAoVoltar(load)` em qualquer página para
 * garantir que ela sempre recarregue ao voltar de outra aba/app.
 *
 * Uso:
 *   useRecarregarAoVoltar(() => load());
 */
export function useRecarregarAoVoltar(callback) {
    const saiuEm = useRef(null);
    // Evita recarregar em trocas de aba muito rápidas (ex: alt-tab acidental)
    const LIMITE_MS = 5000;

    useEffect(() => {
        const handler = () => {
            if (document.hidden) {
                saiuEm.current = Date.now();
                return;
            }
            const ausenteMs = saiuEm.current ? Date.now() - saiuEm.current : Infinity;
            if (ausenteMs >= LIMITE_MS && typeof callback === 'function') {
                callback();
            }
            saiuEm.current = null;
        };
        document.addEventListener('visibilitychange', handler);
        return () => document.removeEventListener('visibilitychange', handler);
    }, [callback]);
}
