import { supabase } from '../supabaseClient';

// ─────────────────────────────────────────────────────────────────────────────
// VEÍCULOS (CARRETAS)
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchCarretasVeiculos() {
    const { data, error } = await supabase
        .from('carretas_veiculos')
        .select('*')
        .order('placa', { ascending: true });
    if (error) throw error;
    return data || [];
}

export async function createCarretaVeiculo(veiculo) {
    const { data, error } = await supabase
        .from('carretas_veiculos')
        .insert(veiculo)
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function updateCarretaVeiculo(id, updates) {
    const { data, error } = await supabase
        .from('carretas_veiculos')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function deleteCarretaVeiculo(id) {
    // Apaga todos os registros dependentes antes (respeita foreign key constraints)
    await supabase.from('carretas_registros_viagem').delete().eq('veiculo_id', id);
    await supabase.from('carretas_checklists').delete().eq('veiculo_id', id);
    await supabase.from('carretas_abastecimentos').delete().eq('veiculo_id', id);
    await supabase.from('carretas_carregamentos').delete().eq('veiculo_id', id);
    const { error } = await supabase.from('carretas_veiculos').delete().eq('id', id);
    if (error) throw error;
}

export async function deleteChecklist(id) {
    const { error } = await supabase.from('carretas_checklists').delete().eq('id', id);
    if (error) throw error;
}

export async function deleteOrdemServico(id) {
    const { error } = await supabase.from('carretas_ordens_servico').delete().eq('id', id);
    if (error) throw error;
}

/** Placas de carretas pelos ids informados. */
export async function fetchCarretasPlacasPorIds(ids) {
    const { data } = await supabase.from('carretas_veiculos').select('id, placa').in('id', ids);
    return data || [];
}
