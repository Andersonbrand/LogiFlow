import { supabase } from './supabaseClient';

// Operações de autenticação usadas pelas telas (login/senha/e-mail).
// O estado global do usuário continua em context/AuthContext.

export const getSession = () => supabase.auth.getSession();
export const updatePassword = (password) => supabase.auth.updateUser({ password });
export const exchangeCodeForSession = (code) => supabase.auth.exchangeCodeForSession(code);
export const verifyOtp = (params) => supabase.auth.verifyOtp(params);
export const onAuthStateChange = (callback) => supabase.auth.onAuthStateChange(callback);
