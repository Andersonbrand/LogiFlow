import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from './supabaseClient';

const AuthContext = createContext({});

async function getOrCreateProfile(user) {
    if (!user) return null;
    try {
        const { data } = await supabase
            .from('user_profiles').select('*').eq('id', user.id).single();
        if (data) return data;
        const name = user.user_metadata?.name || user.email?.split('@')[0] || 'Usuário';
        const { data: created } = await supabase
            .from('user_profiles')
            .upsert({ id: user.id, name, role: 'operador' }, { onConflict: 'id' })
            .select().single();
        return created || { id: user.id, name, role: 'operador' };
    } catch {
        return { id: user.id, name: user.email, role: 'operador' };
    }
}

export function AuthProvider({ children }) {
    const [user, setUser]       = useState(null);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const initialized = useRef(false);

    useEffect(() => {
        // Inicialização — roda apenas uma vez
        supabase.auth.getSession().then(async ({ data: { session } }) => {
            const u = session?.user ?? null;
            setUser(u);
            if (u) {
                const p = await getOrCreateProfile(u);
                setProfile(p);
            }
            setLoading(false);
            initialized.current = true;
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            // Ignora eventos antes da inicialização terminar
            if (!initialized.current) return;

            const u = session?.user ?? null;

            if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED' && !u) {
                setUser(null);
                setProfile(null);
                return;
            }

            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                setUser(u);
                if (u) {
                    const p = await getOrCreateProfile(u);
                    setProfile(p);
                }
                return;
            }

            // Outros eventos — atualiza se mudou
            if (u?.id !== user?.id) {
                setUser(u);
                setProfile(u ? await getOrCreateProfile(u) : null);
            }
        });

        return () => subscription.unsubscribe();
    }, []); // eslint-disable-line

    const signIn = async (email, password) => {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        return data;
    };

    const signUp = async (email, password, name) => {
        const { data, error } = await supabase.auth.signUp({
            email, password,
            options: {
                data: { name },
                emailRedirectTo: `${window.location.origin}/`,
            }
        });
        if (error) throw error;
        if (data.user && data.session) {
            await supabase.from('user_profiles')
                .upsert({ id: data.user.id, name: name || email.split('@')[0], role: 'operador' }, { onConflict: 'id' });
        }
        return data;
    };

    const sendPasswordReset = async (email) => {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
    };

    const signOut = async () => {
        await supabase.auth.signOut();
        setUser(null);
        setProfile(null);
    };

    const isAdmin     = () => profile?.role === 'admin';
    const isOperador  = () => profile?.role === 'operador';
    const isMotorista = () => profile?.role === 'motorista';
    const hasRole     = (...roles) => roles.includes(profile?.role);

    const can = {
        aprovarRomaneio:   () => isAdmin(),
        excluirRomaneio:   () => isAdmin(),
        exportarRomaneio:  (r) => isAdmin() || r?.aprovado === true,
        editarRomaneio:    () => isAdmin() || isOperador(),
        criarRomaneio:     () => isAdmin() || isOperador(),
        verTodosRomaneios: () => isAdmin() || isOperador(),
        verMeusRomaneios:  () => isMotorista(),
        gerenciarUsuarios: () => isAdmin(),
        gerenciarVeiculos: () => isAdmin(),
        gerenciarMateriais:() => isAdmin(),
        verFinanceiro:     () => isAdmin(),
        verBonificacoes:   () => isAdmin() || isMotorista(),
    };

    return (
        <AuthContext.Provider value={{
            user, profile, loading,
            signIn, signUp, signOut, sendPasswordReset,
            isAdmin, isOperador, isMotorista, hasRole, can,
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
