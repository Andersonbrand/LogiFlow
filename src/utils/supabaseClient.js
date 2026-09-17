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

export const supabase = createClient(_url, _key, {
    auth: {
        persistSession:     true,
        autoRefreshToken:   true,
        detectSessionInUrl: true,
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
// Padrão recomendado pela própria documentação do Supabase para apps no
// navegador: https://supabase.com/docs/reference/javascript/auth-startautorefresh
// O timer de renovação automática do token (autoRefreshToken) continua rodando
// mesmo com a aba em segundo plano — mas navegadores throttlam/suspendem
// timers e WebSockets de abas ocultas (e mais ainda se o notebook dorme).
// Isso pode deixar o timer de refresh "atrasado": quando a aba volta a ficar
// visível, o token já pode estar vencido e o SDK não percebe isso na hora,
// fazendo toda query subsequente falhar silenciosamente — sintoma de tela
// "hibernada"/carregando para sempre, que só um F5 (recriando o cliente do
// zero) resolvia. Parar o timer com a aba oculta e reiniciá-lo (forçando uma
// renovação) ao voltar evita esse descompasso.
if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            supabase.auth.startAutoRefresh();
            // Realtime também suspende o WebSocket em aba oculta — reconectar
            // explicitamente evita canais "mortos" que nunca mais reportam
            // mudança nenhuma até um refresh manual da página.
            try { supabase.realtime.connect(); } catch { /* no-op */ }
        } else {
            supabase.auth.stopAutoRefresh();
        }
    });
}


// Uso: const unsub = subscribeTabela('romaneios', load)
// Retorna função para cancelar a assinatura (use no cleanup do useEffect)
export function subscribeTabela(tabela, callback) {
    const channel = supabase
        .channel(`realtime:${tabela}:${Date.now()}`)
        .on('postgres_changes',
            { event: '*', schema: 'public', table: tabela },
            (payload) => {
                console.log(`🔔 Realtime [${tabela}]:`, payload.eventType);
                callback(payload);
            }
        )
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                console.log(`✅ Realtime inscrito: ${tabela}`);
            }
            if (status === 'CHANNEL_ERROR') {
                console.warn(`⚠️ Realtime erro: ${tabela} — tentando reconectar`);
            }
        });

    return () => { supabase.removeChannel(channel); };
}
