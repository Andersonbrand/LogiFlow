import { supabase } from '../supabaseClient';

// ─────────────────────────────────────────────────────────────────────────────
// REGISTROS DE VIAGEM (preenchido pelo carreteiro)
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchRegistrosViagem(motoristaId) {
    let q = supabase
        .from('carretas_registros_viagem')
        .select('*, veiculo:veiculo_id(id, placa, modelo)')
        .order('data_carregamento', { ascending: false });
    if (motoristaId) q = q.eq('motorista_id', motoristaId);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
}

export async function createRegistroViagem(registro) {
    const { data, error } = await supabase
        .from('carretas_registros_viagem')
        .insert(registro)
        .select('*, veiculo:veiculo_id(id, placa, modelo)')
        .single();
    if (error) throw error;
    return data;
}

export async function updateRegistroViagem(id, registro) {
    const { data, error } = await supabase
        .from('carretas_registros_viagem')
        .update(registro)
        .eq('id', id)
        .select('*, veiculo:veiculo_id(id, placa, modelo)')
        .single();
    if (error) throw error;
    return data;
}

export async function deleteRegistroViagem(id) {
    const { error } = await supabase.from('carretas_registros_viagem').delete().eq('id', id);
    if (error) throw error;
}

export async function fetchAllRegistrosViagem(filters = {}) {
    let q = supabase
        .from('carretas_registros_viagem')
        .select('*, motorista:motorista_id(id, name), veiculo:veiculo_id(id, placa, modelo)')
        .order('data_carregamento', { ascending: false });
    if (filters.motoristaId) q = q.eq('motorista_id', filters.motoristaId);
    if (filters.dataInicio)  q = q.gte('data_carregamento', filters.dataInicio);
    if (filters.dataFim)     q = q.lte('data_carregamento', filters.dataFim);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
}
