import { supabase } from './supabaseClient';

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
 * Retorna o userId criado.
 */
export async function createDriverUser(supabaseClient, { nome, email, senha, role, tipoVeiculo, cnhNumero, cnhCategoria, cnhVencimento, dataNascimento, cnhFotoUrl }) {
    // Preserva sessão atual do admin
    const { data: { session: adminSession } } = await supabaseClient.auth.getSession();

    const { data: signUpData, error: signUpError } = await supabaseClient.auth.signUp({
        email: email.trim(),
        password: senha,
        options: { data: { name: nome.trim() } },
    });
    if (signUpError) throw signUpError;

    const newUserId = signUpData.user?.id;
    if (!newUserId) throw new Error('Usuário não foi criado. Verifique se o e-mail já está em uso.');

    // Restaura sessão do admin se o signUp a substituiu
    if (adminSession) {
        const { data: { session: current } } = await supabaseClient.auth.getSession();
        if (!current || current.user?.id !== adminSession.user?.id) {
            await supabaseClient.auth.setSession({
                access_token: adminSession.access_token,
                refresh_token: adminSession.refresh_token,
            });
        }
    }

    const realRole = role === 'motorista_carreta' ? 'motorista' : role;
    const extra = role === 'motorista_carreta' ? { tipo_veiculo: 'carreta' }
                : role === 'motorista'          ? { tipo_veiculo: tipoVeiculo || 'caminhao' }
                : {};

    await supabaseClient.from('user_profiles').upsert({
        id: newUserId,
        name: nome.trim(),
        email: email.trim(),
        role: realRole,
        ...extra,
        cnh_numero:      cnhNumero      || null,
        cnh_categoria:   cnhCategoria   || null,
        cnh_vencimento:  cnhVencimento  || null,
        data_nascimento: dataNascimento || null,
        cnh_foto_url:    cnhFotoUrl     || null,
        updated_at: new Date().toISOString(),
    });

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
 * Remove um motorista/mecânico e todo o seu histórico via Edge Function.
 * A Edge Function usa service_role para bypassa RLS e remove também de auth.users.
 */
export async function deleteDriverUser(userId) {
    const { data, error } = await supabase.functions.invoke('delete-user', {
        body: { userId },
    });
    // Extrai mensagem de erro do body (status 2xx com { error }) ou do erro HTTP
    const bodyError = data?.error;
    if (bodyError || error) {
        // Tenta extrair detalhes do response body quando é FunctionsHttpError
        if (error?.context) {
            try {
                const body = await error.context.json();
                throw new Error(body?.error || error.message);
            } catch (parseErr) {
                if (parseErr instanceof Error && parseErr.message !== error.message) throw parseErr;
            }
        }
        throw new Error(bodyError || error?.message || 'Erro ao excluir motorista');
    }
}
