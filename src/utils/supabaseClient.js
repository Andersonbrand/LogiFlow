import { createClient } from '@supabase/supabase-js';

const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('⚠️  Variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY não configuradas no .env');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        persistSession:     true,   // mantém sessão no localStorage
        autoRefreshToken:   true,   // renova token automaticamente
        detectSessionInUrl: true,
    },
    global: {
        fetch: (url, options = {}) => {
            // Timeout de 15s em todas as requisições — evita travamento indefinido
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 15000);
            return fetch(url, { ...options, signal: controller.signal })
                .finally(() => clearTimeout(timer));
        },
    },
    db: {
        schema: 'public',
    },
    realtime: {
        timeout: 10000,
    },
});

// Ping silencioso ao carregar o app para "acordar" o banco se estiver pausado
// (Supabase free tier pausa após 7 dias sem uso)
supabase.from('user_profiles').select('id').limit(1).then(() => {
    console.log('✅ Conexão com Supabase estabelecida');
}).catch(() => {
    console.warn('⚠️ Supabase demorando para responder — banco pode estar acordando...');
});
