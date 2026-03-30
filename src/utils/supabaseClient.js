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

// ─── Camada 1: Fetch com retry automático ─────────────────────────────────
// Supabase free tier hiberna após ~10min sem uso. A primeira requisição pode
// demorar 5-30s para acordar o banco. Fazemos retry com timeout crescente.
async function fetchComRetry(url, options = {}, tentativa = 1) {
    const MAX_TENTATIVAS = 4;
    // Timeout: 25s → 35s → 45s → 55s
    const timeoutMs = 25000 + (tentativa - 1) * 10000;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const resp = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(timer);
        return resp;
    } catch (err) {
        clearTimeout(timer);
        if (tentativa < MAX_TENTATIVAS) {
            const espera = tentativa * 1500;
            console.warn(`⟳ Supabase não respondeu — tentativa ${tentativa + 1}/${MAX_TENTATIVAS} em ${espera}ms`);
            await new Promise(r => setTimeout(r, espera));
            return fetchComRetry(url, options, tentativa + 1);
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
        fetch: fetchComRetry,
    },
    db: {
        schema: 'public',
    },
    realtime: {
        timeout: 60000,
        params: { eventsPerSecond: 10 },
    },
});

// ─── Camada 2: Keep-alive agressivo ────────────────────────────────────────
// Supabase free tier hiberna após ~10min de inatividade.
// Pingamos a cada 90s para manter o banco SEMPRE acordado enquanto app aberto.
let keepAliveTimer = null;

function iniciarKeepAlive() {
    if (keepAliveTimer) return;
    keepAliveTimer = setInterval(async () => {
        try {
            await supabase.from('user_profiles').select('id').limit(1);
        } catch {
            // silencioso — não poluir console do usuário
        }
    }, 90 * 1000); // 90 segundos — bem abaixo dos 10min de hibernação
}

function pararKeepAlive() {
    if (keepAliveTimer) {
        clearInterval(keepAliveTimer);
        keepAliveTimer = null;
    }
}

// ─── Camada 3: Reconexão ao voltar para a aba ─────────────────────────────
let ultimaVisita = Date.now();
// Qualquer ausência dispara reload — evita estado stale após hibernação ou troca de rota
const LIMITE_RECARREGAR_MS = 30 * 1000; // 30 segundos

if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            ultimaVisita = Date.now();
            pararKeepAlive();
        } else {
            const tempoFora = Date.now() - ultimaVisita;
            iniciarKeepAlive();
            // Força renovação do token JWT antes de qualquer query
            // (previne "JWT expired" silencioso após inatividade ou hibernação)
            supabase.auth.getSession().catch(() => {});
            if (tempoFora > LIMITE_RECARREGAR_MS) {
                console.log(`🔄 App ficou ${Math.round(tempoFora/1000)}s inativo — recarregando dados`);
                window.dispatchEvent(new CustomEvent('supabase:recarregar'));
            }
        }
    });
}

// ─── Camada 4: Helper para Realtime em qualquer página ──────────────────────
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

// Inicia keep-alive imediatamente
iniciarKeepAlive();

// Ping inicial para acordar o banco antes do usuário interagir
(async () => {
    try {
        await supabase.from('user_profiles').select('id').limit(1);
        console.log('✅ Supabase conectado e acordado');
    } catch {
        console.warn('⚠️ Supabase demorando para responder — retentativas em andamento...');
    }
})();
