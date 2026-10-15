import { createClient } from '@supabase/supabase-js';

const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL     || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Expõe flag global — App.jsx detecta e mostra tela de erro amigável
// em vez de tela branca quando as variáveis não estão no Vercel
if (!supabaseUrl || !supabaseAnonKey) {
    console.error('LOGIFLOW: VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY não configuradas. Configure as Environment Variables no Vercel.');
    window.__SUPABASE_MISSING__ = true;
} else {
    window.__SUPABASE_MISSING__ = false;
}

// ─── Fetch com timeout e 1 retry ───────────────────────────────────────────
// Cobre falhas de rede/latência pontuais (queda de wi-fi, requisição perdida).
// Não existe "hibernação de 10 em 10 minutos" no Supabase — o free tier só
// pausa o projeto inteiro após 7 dias sem nenhuma requisição de API. Por isso
// não há motivo para timeouts longos (25-55s) nem múltiplas tentativas: se a
// query travar por mais de ~20s é sinal de um problema real (rede, projeto
// pausado etc.) e o app deve mostrar erro/loading, não fingir que está
// "esperando o banco acordar".
//
// IMPORTANTE — bug corrigido: reenviar automaticamente uma requisição que
// FOI CANCELADA PELO NOSSO PRÓPRIO TIMEOUT é arriscado quando o método não é
// idempotente (POST/PATCH/PUT, ex.: alterar senha) — o servidor pode já ter
// recebido e processado a primeira tentativa antes do abort chegar até ele,
// e enquanto isso a segunda tentativa some dobrando o tempo total de espera.
// Foi exatamente isso que causava "senha alterada com sucesso só que a tela
// mostra erro de timeout": a operação já tinha sido concluída no servidor,
// mas o relógio da própria página (20s) estourava antes da nossa 2ª
// tentativa (que podia levar até mais 20s) terminar. Agora só reenviamos
// automaticamente quando é seguro: método GET/HEAD, ou quando a falha
// aconteceu ANTES do nosso timeout abortar (falha de rede genuína, a
// requisição nunca chegou a sair do navegador).
async function fetchComTimeout(url, options = {}, jaTentouRetry = false) {
    const TIMEOUT_MS = 20000;
    const metodo = (options.method || 'GET').toUpperCase();
    const seguroReenviar = metodo === 'GET' || metodo === 'HEAD';

    const controller = new AbortController();
    let abortadoPeloNossoTimeout = false;
    const timer = setTimeout(() => { abortadoPeloNossoTimeout = true; controller.abort(); }, TIMEOUT_MS);

    try {
        const resp = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(timer);
        return resp;
    } catch (err) {
        clearTimeout(timer);
        if (!jaTentouRetry && (seguroReenviar || !abortadoPeloNossoTimeout)) {
            return fetchComTimeout(url, options, true);
        }
        throw err;
    }
}

// Fallback seguro: se as variáveis não existirem, cria um cliente com URL
// placeholder para evitar exceção no módulo que causaria tela branca total.
// O app vai detectar window.__SUPABASE_MISSING__ e mostrar erro amigável.
const _url = supabaseUrl  || 'https://placeholder.supabase.co';
const _key = supabaseAnonKey || 'placeholder-key';

// ─── Lock de autenticação sem "roubo" ──────────────────────────────────────
// Padrão do supabase-js: navigator.locks compartilhado entre TODAS as abas.
// Se quem segura o lock demora >5s (aba em segundo plano congelada pelo
// Chrome/"Economia de memória", notebook que dormiu, PC lento, várias abas
// abertas), o SDK ROUBA o lock ("steal") e a requisição de quem o segurava
// falha com "AbortError: Lock broken by another request with the 'steal'
// option" — erro que aparecia nas telas só em alguns computadores.
// Aqui serializamos as operações de auth DENTRO da aba (fila simples, sem
// timeout e sem roubo). Entre abas o próprio servidor tolera a corrida de
// refresh (janela de reuso do refresh token), então não há perda de sessão.
let _filaAuth = Promise.resolve();
function lockPorAba(_nome, _timeout, fn) {
    const exec = _filaAuth.then(() => fn());
    // a fila segue mesmo se a operação falhar
    _filaAuth = exec.then(() => undefined, () => undefined);
    return exec;
}

export const supabase = createClient(_url, _key, {
    auth: {
        persistSession:     true,
        autoRefreshToken:   true,
        detectSessionInUrl: true,
        lock:               lockPorAba,
    },
    global: {
        fetch: fetchComTimeout,
    },
    db: {
        schema: 'public',
    },
    realtime: {
        timeout: 30000,
        params: { eventsPerSecond: 10 },
    },
});

// ─── Ciclo de vida ligado à visibilidade da aba ────────────────────────────
// O próprio supabase-js já para/reinicia o auto-refresh do token e recupera a
// sessão quando a aba volta a ficar visível (GoTrueClient._onVisibilityChanged).
// Antes este arquivo chamava startAutoRefresh()/stopAutoRefresh() por conta
// própria, duplicando esse trabalho e disputando o lock de autenticação no
// exato momento em que as telas também recarregam dados (useRecarregarAoVoltar).
// Aqui fica apenas a reconexão do Realtime, que o SDK não faz sozinho.
if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            try { supabase.realtime.connect(); } catch { /* no-op */ }
        }
    });
}


// Uso: const unsub = subscribeTabela('romaneios', load)
// Retorna função para cancelar a assinatura (use no cleanup do useEffect)
//
// Canal compartilhado: várias telas/hooks que assinam a MESMA tabela (com o mesmo
// filtro) usam UM só canal Realtime — antes cada chamada abria um canal novo
// (ex.: 4 hooks de configuração = 4 canais em "app_settings"). Cada assinante mantém
// o próprio debounce e o canal só é removido quando o último assinante sai.
//
// Debounce (padrão 2,5 s): eventos em rajada (ex: salvar vários itens em sequência)
// viram UMA recarga — só o último evento chama o callback.
//
// filtro (opcional): filtro do Realtime no servidor, ex.: `user_id=eq.${id}` —
// evita receber (e recarregar por) eventos de outros usuários.
const _canaisRealtime = new Map(); // chave -> { channel, ouvintes }

export function subscribeTabela(tabela, callback, debounceMs = 2500, filtro = null) {
    let timer = null;
    const disparar = (payload) => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => callback(payload), debounceMs);
    };

    const chave = `${tabela}|${filtro || ''}`;
    let entrada = _canaisRealtime.get(chave);
    if (!entrada) {
        const ouvintes = new Set();
        const cfg = { event: '*', schema: 'public', table: tabela, ...(filtro ? { filter: filtro } : {}) };
        const channel = supabase
            .channel(`realtime:${chave}:${Date.now()}`)
            .on('postgres_changes', cfg, (payload) => { ouvintes.forEach(fn => fn(payload)); })
            .subscribe((status) => {
                if (status === 'CHANNEL_ERROR') {
                    console.warn(`⚠️ Realtime erro: ${tabela} — tentando reconectar`);
                }
            });
        entrada = { channel, ouvintes };
        _canaisRealtime.set(chave, entrada);
    }
    entrada.ouvintes.add(disparar);

    const minhaEntrada = entrada;
    return () => {
        if (timer) clearTimeout(timer);
        minhaEntrada.ouvintes.delete(disparar);
        if (minhaEntrada.ouvintes.size === 0) {
            supabase.removeChannel(minhaEntrada.channel);
            if (_canaisRealtime.get(chave) === minhaEntrada) _canaisRealtime.delete(chave);
        }
    };
}
