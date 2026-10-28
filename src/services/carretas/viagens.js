import { supabase } from '../supabaseClient';
import { sanitizeUuids } from './carregamentos';

// ─────────────────────────────────────────────────────────────────────────────
// GERAÇÃO DE NÚMERO DE VIAGEM  ANO-SEQUÊNCIA
// ─────────────────────────────────────────────────────────────────────────────
export async function gerarNumeroViagem() {
    const ano = new Date().getFullYear();
    const { count } = await supabase
        .from('carretas_viagens')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', `${ano}-01-01`);
    const seq = String((count || 0) + 1).padStart(4, '0');
    return `${ano}-${seq}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// VIAGENS
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchViagens(filters = {}) {
    let q = supabase
        .from('carretas_viagens')
        .select(`
            *,
            motorista:motorista_id(id, name),
            veiculo:veiculo_id(id, placa, modelo, tipo_composicao)
        `)
        .order('created_at', { ascending: false });

    if (filters.status)      q = q.eq('status', filters.status);
    if (filters.motoristaId) q = q.eq('motorista_id', filters.motoristaId);
    if (filters.veiculoId)   q = q.eq('veiculo_id', filters.veiculoId);
    if (filters.dataInicio)  q = q.gte('data_saida', filters.dataInicio);
    if (filters.dataFim)     q = q.lte('data_saida', filters.dataFim);

    const { data, error } = await q;
    if (error) throw error;
    return data || [];
}

export async function createViagem(viagem) {
    const numero = await gerarNumeroViagem();
    const payload = sanitizeUuids ? { ...viagem } : { ...viagem };
    ['motorista_id','veiculo_id'].forEach(f => { if (payload[f] === '') payload[f] = null; });
    const { data, error } = await supabase
        .from('carretas_viagens')
        .insert({ ...payload, numero, status: payload.status || 'Agendado' })
        .select(`*, motorista:motorista_id(id, name), veiculo:veiculo_id(id, placa, modelo)`)
        .single();
    if (error) throw error;
    return data;
}

export async function updateViagem(id, updates) {
    const { data, error } = await supabase
        .from('carretas_viagens')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select(`*, motorista:motorista_id(id, name), veiculo:veiculo_id(id, placa, modelo)`)
        .single();
    if (error) throw error;
    return data;
}

export async function deleteViagem(id) {
    const { error } = await supabase.from('carretas_viagens').delete().eq('id', id);
    if (error) throw error;
}
