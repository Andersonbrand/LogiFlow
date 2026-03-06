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
