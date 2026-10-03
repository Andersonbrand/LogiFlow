// setInterval que só executa quando a aba está VISÍVEL.
// Aba em segundo plano (ou computador com a tela em outra janela) não faz
// requisição nenhuma — cada requisição vira linha de log no Supabase (Log Ingestion).
// Retorna a função de cancelamento (use no cleanup do useEffect).
export function setIntervalVisivel(fn, ms) {
    const id = setInterval(() => {
        if (typeof document !== 'undefined' && document.hidden) return;
        fn();
    }, ms);
    return () => clearInterval(id);
}
