import { supabase } from '../supabaseClient';

// ─── Tabela de Fretes por Cidade ─────────────────────────────────────────────
export async function fetchFretesCidades(tipo = 'frota') {
    const { data, error } = await supabase
        .from('carretas_fretes')
        .select('id, cidade, km, frete_por_saco')
        .eq('tipo', tipo)
        .order('cidade', { ascending: true });
    if (error) throw error;
    return data || [];
}

// ─── Helpers de frota separada ────────────────────────────────────────────────

// Veículos APENAS da frota própria (is_terceiro = false ou null)
// Veículos da frota própria (is_terceiro != true)
export async function fetchVeiculosProprios() {
    const { data, error } = await supabase
        .from('carretas_veiculos')
        .select('*')
        .neq('is_terceiro', true)
        .order('placa', { ascending: true });
    if (error) throw error;
    return data || [];
}

// Veículos terceirizados (is_terceiro = true)
export async function fetchVeiculosTerceiros() {
    const { data, error } = await supabase
        .from('carretas_veiculos')
        .select('*')
        .eq('is_terceiro', true)
        .order('placa', { ascending: true });
    if (error) throw error;
    return data || [];
}

// Motoristas da frota própria (is_terceiro != true)
export async function fetchMotoristasProprios() {
    const { data, error } = await supabase
        .from('user_profiles')
        .select('id, name, role, tipo_veiculo, is_terceiro')
        .in('role', ['motorista', 'carreteiro'])
        .neq('is_terceiro', true)
        .order('name', { ascending: true });
    if (error) throw error;
    return data || [];
}

// Apenas carreteiros da frota própria (tipo_veiculo = 'carreta' e não terceirizado)
export async function fetchCarreteirosPropriosOnly() {
    const { data, error } = await supabase
        .from('user_profiles')
        .select('id, name, role, tipo_veiculo, is_terceiro')
        .eq('role', 'motorista')
        .eq('tipo_veiculo', 'carreta')
        .neq('is_terceiro', true)
        .order('name', { ascending: true });
    if (error) throw error;
    return data || [];
}

// Motoristas terceirizados (is_terceiro = true)
export async function fetchMotoristasTerceiros() {
    const { data, error } = await supabase
        .from('user_profiles')
        .select('id, name, role, tipo_veiculo, is_terceiro')
        .eq('role', 'motorista')
        .eq('is_terceiro', true)
        .order('name', { ascending: true });
    if (error) throw error;
    return data || [];
}

// ─── CRUD da tabela de fretes por cidade ─────────────────────────────────────
/** Retorna { data, error } com o registro criado. */
export function createFrete(payload) {
    return supabase.from('carretas_fretes').insert(payload).select().single();
}
export function updateFrete(id, payload) {
    return supabase.from('carretas_fretes').update(payload).eq('id', id);
}
export function deleteFrete(id) {
    return supabase.from('carretas_fretes').delete().eq('id', id);
}
/** Fretes de um tipo ('frota' | 'terceiros' | 'liz'), por cidade. Retorna { data, error }. */
export function fetchFretesPorTipo(tipo) {
    return supabase.from('carretas_fretes').select('*').eq('tipo', tipo).order('cidade', { ascending: true });
}
/** Insere vários fretes de uma vez (semente inicial). Retorna { data, error }. */
export function insertFretes(linhas) {
    return supabase.from('carretas_fretes').insert(linhas).select();
}
