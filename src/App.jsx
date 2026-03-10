import React from "react";
import Routes from "./Routes";
import ErrorBoundary from "components/ErrorBoundary";

// Tela de erro quando as variáveis de ambiente não estão configuradas no Vercel
function MissingEnvScreen() {
    return (
        <div style={{
            minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: '#F8FAFC', fontFamily: 'system-ui, sans-serif', padding: '24px'
        }}>
            <div style={{ maxWidth: 480, textAlign: 'center' }}>
                <div style={{
                    width: 56, height: 56, borderRadius: 14, backgroundColor: '#FEF2F2',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 20px', fontSize: 26
                }}>⚙️</div>
                <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1E293B', marginBottom: 8 }}>
                    Configuração incompleta
                </h1>
                <p style={{ fontSize: 14, color: '#64748B', lineHeight: 1.7, marginBottom: 20 }}>
                    As variáveis de ambiente do Supabase não foram encontradas.<br />
                    Configure <strong>VITE_SUPABASE_URL</strong> e <strong>VITE_SUPABASE_ANON_KEY</strong> nas
                    Environment Variables do Vercel e faça um novo deploy.
                </p>
                <div style={{
                    background: '#0F172A', borderRadius: 10, padding: '12px 16px',
                    textAlign: 'left', fontFamily: 'monospace', fontSize: 12, color: '#94A3B8'
                }}>
                    <div style={{ color: '#7DD3FC' }}>VITE_SUPABASE_URL</div>
                    <div style={{ color: '#86EFAC', marginBottom: 8 }}>https://lrsnqkxarkjcemcxzana.supabase.co</div>
                    <div style={{ color: '#7DD3FC' }}>VITE_SUPABASE_ANON_KEY</div>
                    <div style={{ color: '#86EFAC' }}>eyJhbGci... (sua chave anon)</div>
                </div>
            </div>
        </div>
    );
}

// ✅ FIX: ErrorBoundary agora envolve toda a aplicação
// Erros de renderização inesperados mostram tela amigável em vez de tela branca
function App() {
    // Se as variáveis de ambiente não estiverem configuradas, mostra tela de erro
    // em vez de tela branca (problema comum no primeiro deploy no Vercel)
    if (window.__SUPABASE_MISSING__) {
        return <MissingEnvScreen />;
    }
    return (
        <ErrorBoundary>
            <Routes />
        </ErrorBoundary>
    );
}

export default App;
