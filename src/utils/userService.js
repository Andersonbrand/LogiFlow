import { supabase } from './supabaseClient';
import { createClient } from '@supabase/supabase-js';

// Sprint 2 — User profiles & roles
export async function fetchUserProfile(userId) {
    const { data, error } = await supabase
        .from('user_profiles').select('*').eq('id', userId).single();
    if (error) return null;
    return data;
}

export async function fetchAllUsers() {
    const { data, error } = await supabase
        .from('user_profiles').select('*').order('name');
    if (error) throw error;
    return data;
}

export async function updateUserProfile(userId, updates) {
    const { data, error } = await supabase
        .from('user_profiles').update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', userId).select().single();
    if (error) throw error;
    return data;
}

export async function upsertUserProfile(userId, profile) {
    const { data, error } = await supabase
        .from('user_profiles').upsert({ id: userId, ...profile }).select().single();
    if (error) throw error;
    return data;
}

// Sprint 4 — Notifications
export async function fetchNotifications(userId) {
    const { data, error } = await supabase
        .from('notifications').select('*, romaneios(numero)')
        .eq('user_id', userId).order('created_at', { ascending: false }).limit(50);
    if (error) return [];
    return data;
}

export async function markNotificationRead(id) {
    await supabase.from('notifications').update({ lida: true }).eq('id', id);
}

export async function markAllNotificationsRead(userId) {
    await supabase.from('notifications').update({ lida: true })
        .eq('user_id', userId).eq('lida', false);
}

// Sprint 2 — Maintenance alerts
export async function fetchMaintenanceAlerts() {
    const { data, error } = await supabase
        .from('maintenance_alerts').select('*, vehicles(placa, tipo)')
        .eq('resolvido', false).order('created_at', { ascending: false });
    if (error) return [];
    return data;
}

export async function createMaintenanceAlert(vehicleId, tipo, mensagem) {
    const { error } = await supabase.from('maintenance_alerts')
        .insert({ vehicle_id: vehicleId, tipo, mensagem });
    if (error) throw error;
}

export async function resolveMaintenanceAlert(id) {
    await supabase.from('maintenance_alerts').update({ resolvido: true }).eq('id', id);
}

// ────────────────────────────────────────────────────────────────────────────
// Motoristas — cadastro pelo admin
// Requer as colunas extras em user_profiles. Execute no SQL Editor do Supabase:
//   ALTER TABLE user_profiles
//     ADD COLUMN IF NOT EXISTS cnh_numero       TEXT,
//     ADD COLUMN IF NOT EXISTS cnh_categoria    TEXT,
//     ADD COLUMN IF NOT EXISTS cnh_vencimento   DATE,
//     ADD COLUMN IF NOT EXISTS data_nascimento  DATE,
//     ADD COLUMN IF NOT EXISTS cnh_foto_url     TEXT;
// ────────────────────────────────────────────────────────────────────────────

/**
 * Cria um novo usuário (motorista) via signUp e salva o perfil completo.
 * Usa cliente temporário isolado (persistSession: false) para não afetar
 * a sessão do admin nem disparar redirecionamentos no app.
 */
export async function createDriverUser(supabaseClient, { nome, email, senha, role, tipoVeiculo, cnhNumero, cnhCategoria, cnhVencimento, dataNascimento, cnhFotoUrl }) {
    // Cliente temporário isolado — não compartilha sessão com o app
    const tempClient = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_ANON_KEY,
        { auth: { persistSession: false, autoRefreshToken: false } }
    );

    const realRoleForMeta = role === 'motorista_carreta' ? 'motorista' : role;

    const { data: signUpData, error: signUpError } = await tempClient.auth.signUp({
        email: email.trim(),
        password: senha,
        options: { data: { name: nome.trim(), role: realRoleForMeta } },
    });
    if (signUpError) throw signUpError;

    const newUserId = signUpData.user?.id;
    if (!newUserId) throw new Error('Usuário não foi criado. Verifique se o e-mail já está em uso.');

    const realRole = role === 'motorista_carreta' ? 'motorista' : role;
    const extra = role === 'motorista_carreta' ? { tipo_veiculo: 'carreta' }
        : role === 'motorista' ? { tipo_veiculo: tipoVeiculo || 'caminhao' }
            : {};

    // Usa update (mais confiável quando o trigger já criou o perfil).
    // Se o perfil ainda não existir, cai no insert via upsert com onConflict explícito.
    const profilePayload = {
        name: nome.trim(),
        email: email.trim(),
        role: realRole,
        ...extra,
        cnh_numero: cnhNumero || null,
        cnh_categoria: cnhCategoria || null,
        cnh_vencimento: cnhVencimento || null,
        data_nascimento: dataNascimento || null,
        cnh_foto_url: cnhFotoUrl || null,
        updated_at: new Date().toISOString(),
    };

    const { error: updateErr } = await supabaseClient
        .from('user_profiles')
        .update(profilePayload)
        .eq('id', newUserId);

    if (updateErr) {
        // Perfil ainda não existe (trigger não rodou): faz insert
        const { error: insertErr } = await supabaseClient
            .from('user_profiles')
            .insert({ id: newUserId, ...profilePayload });
        if (insertErr) throw insertErr;
    }

    return newUserId;
}

/**
 * Busca todos os perfis com role motorista ou mecanico.
 */
export async function fetchDriverProfiles() {
    const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .in('role', ['motorista', 'mecanico'])
        .order('name');
    if (error) throw error;
    return data || [];
}

/**
 * Remove um motorista/mecânico e todo o seu histórico via função SQL (SECURITY DEFINER).
 * Execute o script supabase/migrations/fn_delete_driver_user.sql no Supabase SQL Editor.
 */
export async function deleteDriverUser(userId) {
    const { error } = await supabase.rpc('delete_driver_user', { target_user_id: userId });
    if (error) throw new Error(error.message);
}