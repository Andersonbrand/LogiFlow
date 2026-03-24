'use client';

import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import AdminPanel from './components/AdminPanel';
import AppLogo from '@/components/ui/AppLogo';

export default function AdminDashboardPage() {
    const { user, isAdmin, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading && (!user || !isAdmin)) {
            router.push('/login');
        }
    }, [user, isAdmin, loading, router]);

    if (loading) {
        return (
            <div className="min-h-screen bg-surface flex items-center justify-center">
                <div className="text-center space-y-4">
                    <AppLogo size={48} className="mx-auto" />
                    <p className="text-muted text-sm font-medium animate-pulse">Carregando painel...</p>
                </div>
            </div>
        );
    }

    if (!user || !isAdmin) return null;

    return <AdminPanel />;
}
