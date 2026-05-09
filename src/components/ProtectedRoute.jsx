import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from 'utils/AuthContext';

import { useState, useEffect } from 'react';

const Spinner = () => {
    const [slowLoad, setSlowLoad] = useState(false);

    useEffect(() => {
        // Após 4s sem resposta, exibe mensagem de banco acordando
        const t = setTimeout(() => setSlowLoad(true), 4000);
        return () => clearTimeout(t);
    }, []);

    return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-4"
            style={{ backgroundColor: 'var(--color-background)' }}>
            <svg className="animate-spin h-8 w-8" style={{ color: 'var(--color-primary)' }} fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            {slowLoad ? (
                <div className="text-center px-6">
                    <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                        Conectando ao banco de dados...
                    </p>
                    <p className="text-xs mt-1" style={{ color: 'var(--color-muted-foreground)' }}>
                        O servidor pode estar acordando após inatividade. Aguarde alguns segundos.
                    </p>
                </div>
            ) : (
                <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
                    Carregando...
                </p>
            )}
        </div>
    );
};

// ─── Tela de acesso bloqueado para motoristas terceirizados ───────────────────
export function TerceiroBloqueado({ signOut }) {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6"
            style={{ backgroundColor: 'var(--color-background)' }}>
            <div className="bg-white rounded-2xl shadow-lg border p-10 max-w-md w-full text-center flex flex-col items-center gap-5"
                style={{ borderColor: 'var(--color-border)' }}>
                {/* Ícone */}
                <div className="w-16 h-16 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: '#FEF3C7' }}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
                        stroke="#D97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                        <line x1="12" y1="8" x2="12" y2="12"/>
                        <line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                </div>

                {/* Textos */}
                <div className="flex flex-col gap-2">
                    <h2 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
                        Acesso não disponível
                    </h2>
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                        Este cadastro é utilizado apenas para controle interno de volume de carregamento.
                        Motoristas terceirizados não possuem acesso ao sistema.
                    </p>
                    <p className="text-xs mt-1" style={{ color: 'var(--color-muted-foreground)' }}>
                        Em caso de dúvidas, entre em contato com o administrador.
                    </p>
                </div>

                {/* Botão sair */}
                <button
                    onClick={signOut}
                    className="mt-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors"
                    style={{ backgroundColor: 'var(--color-primary)', color: '#fff' }}>
                    Sair
                </button>
            </div>
        </div>
    );
}

// Aguarda loading E profile estarem prontos antes de decidir
function useAuthReady() {
    const { user, profile, loading, signOut } = useAuth();
    // Pronto quando: não está carregando E (sem usuário OU profile já foi carregado)
    const ready = !loading && (user === null || profile !== null);
    return { user, profile, loading, ready, signOut };
}

export function AdminRoute({ children }) {
    const { user, profile, ready } = useAuthReady();
    if (!ready) return <Spinner />;
    if (!user) return <Navigate to="/login" replace />;
    if (profile?.role !== 'admin') return <Navigate to="/" replace />;
    return children;
}

export function StaffRoute({ children }) {
    const { user, profile, ready, signOut } = useAuthReady();
    if (!ready) return <Spinner />;
    if (!user) return <Navigate to="/login" replace />;
    // Terceirizados bloqueados antes de qualquer outra verificação
    if (profile?.is_terceiro) return <TerceiroBloqueado signOut={signOut} />;
    const isCarretaUser = profile?.role === 'carreteiro' || (profile?.role === 'motorista' && profile?.tipo_veiculo === 'carreta');
    if (!['admin', 'operador'].includes(profile?.role)) {
        if (isCarretaUser) return <Navigate to="/carreteiro" replace />;
        if (profile?.role === 'mecanico') return <Navigate to="/mecanico" replace />;
        return <Navigate to="/motorista" replace />;
    }
    return children;
}

export function MotoristaRoute({ children }) {
    const { user, profile, ready, signOut } = useAuthReady();
    if (!ready) return <Spinner />;
    if (!user) return <Navigate to="/login" replace />;
    // Terceirizados bloqueados — cadastro apenas para controle, sem acesso ao sistema
    if (profile?.is_terceiro) return <TerceiroBloqueado signOut={signOut} />;
    const isCarretaM = profile?.role === 'carreteiro' || (profile?.role === 'motorista' && profile?.tipo_veiculo === 'carreta');
    if (isCarretaM) return <Navigate to="/carreteiro" replace />;
    if (!['admin', 'motorista'].includes(profile?.role)) return <Navigate to="/" replace />;
    return children;
}

export function CarreteiroRoute({ children }) {
    const { user, profile, ready, signOut } = useAuthReady();
    if (!ready) return <Spinner />;
    if (!user) return <Navigate to="/login" replace />;
    // Terceirizados bloqueados — cadastro apenas para controle, sem acesso ao sistema
    if (profile?.is_terceiro) return <TerceiroBloqueado signOut={signOut} />;
    const isCarreta = profile?.role === 'carreteiro' || (profile?.role === 'motorista' && profile?.tipo_veiculo === 'carreta');
    if (!isCarreta) return <Navigate to="/" replace />;
    return children;
}

export function MecanicoRoute({ children }) {
    const { user, profile, ready } = useAuthReady();
    if (!ready) return <Spinner />;
    if (!user) return <Navigate to="/login" replace />;
    if (!['admin', 'mecanico'].includes(profile?.role)) return <Navigate to="/" replace />;
    return children;
}

export default function ProtectedRoute({ children, roles, adminOnly }) {
    const { user, profile, ready, signOut } = useAuthReady();
    if (!ready) return <Spinner />;
    if (!user) return <Navigate to="/login" replace />;
    // Terceirizados bloqueados em qualquer rota protegida
    if (profile?.is_terceiro) return <TerceiroBloqueado signOut={signOut} />;
    if (adminOnly && profile?.role !== 'admin') return <Navigate to="/" replace />;
    if (roles && !roles.includes(profile?.role)) {
        return <Navigate to={profile?.role === 'motorista' ? '/motorista' : '/'} replace />;
    }
    return children;
}
