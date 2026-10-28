import { useState, useCallback } from 'react';
import { suavizarMensagem } from '../utils/friendlyError';

export function useToast() {
    const [toast, setToast] = useState(null);

    const showToast = useCallback((msg, type = 'success') => {
        // Erros técnicos (rede, sessão, permissão...) viram texto amigável.
        // O original continua no console (F12) para diagnóstico.
        const texto = suavizarMensagem(msg, type);
        // Mensagens longas (explicativas) ficam um pouco mais na tela.
        const duracao = texto && texto.length > 90 ? 7000 : 3500;
        setToast({ msg: texto, type, id: Date.now() });
        setTimeout(() => setToast(null), duracao);
    }, []);

    return { toast, showToast };
}
