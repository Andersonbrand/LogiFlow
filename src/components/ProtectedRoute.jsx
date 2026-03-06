import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from 'utils/AuthContext';

// ✅ FIX: loading state já existia, mas isAdmin agora tem fallback seguro
export default function ProtectedRoute({ children, adminOnly = false }) {
    const { user, loading, isAdmin } = useAuth();

    // Aguarda auth resolver antes de redirecionar (evita logout em refresh)
    if (loading) return (
        <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-background)' }}>
            <div className="flex flex-col items-center gap-3">
                <svg className="animate-spin h-8 w-8" style={{ color: 'var(--color-primary)' }} fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span className="text-sm font-caption" style={{ color: 'var(--color-muted-foreground)' }}>Carregando...</span>
            </div>
        </div>
    );

    if (!user) return <Navigate to="/login" replace />;

    // ✅ FIX: isAdmin chamado de forma consistente, com fallback se undefined
    if (adminOnly) {
        const userIsAdmin = typeof isAdmin === 'function' ? isAdmin() : false;
        if (!userIsAdmin) return <Navigate to="/" replace />;
    }

    return children;
}
