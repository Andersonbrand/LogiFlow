import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

const AuthContext = createContext({});

async function getOrCreateProfile(user) {
    if (!user) return null;
    try {
        // Try to fetch existing profile
        const { data, error } = await supabase
            .from('user_profiles').select('*').eq('id', user.id).single();
        if (data) return data;

        // Profile doesn't exist yet — create it
        const name = user.user_metadata?.name || user.email?.split('@')[0] || 'Usuário';
        const { data: created, error: ce } = await supabase
            .from('user_profiles')
            .upsert({ id: user.id, name, role: 'operador' }, { onConflict: 'id' })
            .select().single();
        if (ce) {
            console.warn('Could not create profile:', ce.message);
            // Return a minimal profile so app doesn't crash
            return { id: user.id, name, role: 'operador' };
        }
        return created;
    } catch (err) {
        console.warn('Profile load error:', err.message);
        return { id: user.id, name: user.email, role: 'operador' };
    }
}

export function AuthProvider({ children }) {
    const [user, setUser]       = useState(null);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        supabase.auth.getSession().then(async ({ data: { session } }) => {
            const u = session?.user ?? null;
            setUser(u);
            if (u) setProfile(await getOrCreateProfile(u));
            setLoading(false);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
            const u = session?.user ?? null;
            setUser(u);
            setProfile(u ? await getOrCreateProfile(u) : null);
        });
        return () => subscription.unsubscribe();
    }, []);

    const signIn = async (email, password) => {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        return data;
    };

    const signUp = async (email, password, name) => {
        const { data, error } = await supabase.auth.signUp({
            email, password,
            options: { data: { name } },
        });
        if (error) throw error;

        // ✅ FIX: Aguarda sessão estar ativa antes de inserir o perfil
        // O Supabase pode demorar um instante para estabelecer auth após signUp
        if (data.user) {
            const profileName = name || email.split('@')[0];

            // Tenta com a sessão atual primeiro
            if (data.session) {
                await supabase.from('user_profiles')
                    .upsert({ id: data.user.id, name: profileName, role: 'operador' }, { onConflict: 'id' });
            } else {
                // Se não tem sessão ainda (e-mail não confirmado), cria via service key não disponível
                // Perfil será criado no primeiro login via getOrCreateProfile
                console.info('Perfil será criado no primeiro login — confirmação de e-mail pendente.');
            }
        }
        return data;
    };

    const signOut = async () => {
        await supabase.auth.signOut();
        setUser(null);
        setProfile(null);
    };

    const isAdmin  = ()          => profile?.role === 'admin';
    const hasRole  = (...roles)  => roles.includes(profile?.role);

    return (
        <AuthContext.Provider value={{ user, profile, loading, signIn, signUp, signOut, isAdmin, hasRole }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
