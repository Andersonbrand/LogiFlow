import { supabase } from '../supabaseClient';

// ─────────────────────────────────────────────────────────────────────────────
// MOTORISTAS CARRETEIROS (filtro por tipo)
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchCarreteiros() {
    // Motoristas com tipo_veiculo = 'carreta' (role = 'motorista')
    const { data, error } = await supabase
        .from('user_profiles')
        .select('id, name, role, tipo_veiculo, assinatura_digital')
        .eq('role', 'motorista')
        .eq('tipo_veiculo', 'carreta')
        .order('name', { ascending: true });
    if (error) throw error;
    return data || [];
}

export async function fetchTodosMotoristas() {
    const { data, error } = await supabase
        .from('user_profiles')
        .select('id, name, role, tipo_veiculo, is_terceiro')
        .eq('role', 'motorista')
        .order('name', { ascending: true });
    if (error) throw error;
    return data || [];
}

// ─────────────────────────────────────────────────────────────────────────────
// MOTORISTAS DE CAMINHÃO (excluindo carreteiros)
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchMotoristasCaminhao() {
    const { data, error } = await supabase
        .from('user_profiles')
        .select('id, name, role, tipo_veiculo, assinatura_digital')
        .eq('role', 'motorista')
        .or('tipo_veiculo.neq.carreta,tipo_veiculo.is.null')
        .order('name', { ascending: true });
    if (error) throw error;
    return data || [];
}
