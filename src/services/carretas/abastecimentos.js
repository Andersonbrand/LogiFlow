import { supabase } from '../supabaseClient';

// ─────────────────────────────────────────────────────────────────────────────
// POSTOS DE COMBUSTÍVEL
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchPostos() {
    const { data, error } = await supabase
        .from('carretas_postos')
        .select('*')
        .order('nome', { ascending: true });
    if (error) throw error;
    return data || [];
}

export async function createPosto(posto) {
    const { data, error } = await supabase
        .from('carretas_postos')
        .insert(posto)
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function updatePosto(id, updates) {
    const { data, error } = await supabase
        .from('carretas_postos')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function deletePosto(id) {
    const { error } = await supabase.from('carretas_postos').delete().eq('id', id);
    if (error) throw error;
}

// ─────────────────────────────────────────────────────────────────────────────
// ABASTECIMENTOS
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchAbastecimentos(filters = {}) {
    let q = supabase
        .from('carretas_abastecimentos')
        .select(`
            *,
            motorista:motorista_id(id, name),
            veiculo:veiculo_id(id, placa)
        `)
        .order('data_abastecimento', { ascending: false });

    if (filters.motoristaId) q = q.eq('motorista_id', filters.motoristaId);
    if (filters.veiculoId)   q = q.eq('veiculo_id', filters.veiculoId);
    if (filters.dataInicio)  q = q.gte('data_abastecimento', filters.dataInicio);
    if (filters.dataFim)     q = q.lte('data_abastecimento', filters.dataFim);
    // Módulo Carretas: abastecimentos de caminhões (lançados pela tela do motorista
    // de caminhão, com veiculo_caminhao_id preenchido) já são contabilizados na DRE
    // de Caminhões — nunca devem entrar nas listagens/relatórios de Carretas.
    if (filters.apenasCarretas) q = q.is('veiculo_caminhao_id', null);
    // Painel de Custos de Veículos (caminhões): mostra apenas abastecimentos
    // lançados pelos motoristas de caminhão (veiculo_caminhao_id preenchido),
    // nunca os de carretas — que usam veiculo_id em vez disso.
    if (filters.apenasCaminhoes) q = q.not('veiculo_caminhao_id', 'is', null);

    const { data, error } = await q;
    if (error) throw error;
    return data || [];
}

export async function createAbastecimento(abast) {
    const { data, error } = await supabase
        .from('carretas_abastecimentos')
        .insert(abast)
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function deleteAbastecimento(id) {
    const { error } = await supabase.from('carretas_abastecimentos').delete().eq('id', id);
    if (error) throw error;
}

export async function updateAbastecimento(id, abast) {
    const { data, error } = await supabase
        .from('carretas_abastecimentos')
        .update(abast)
        .eq('id', id)
        .select()
        .single();
    if (error) throw error;
    return data;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURAÇÃO DE PREÇOS DE ABASTECIMENTO (definido pelo admin)
// ─────────────────────────────────────────────────────────────────────────────
export const CONFIG_ABAST_KEY = 'carretas_config_abastecimento';

export async function fetchConfigAbastecimento() {
    const { data } = await supabase
        .from('carretas_config')
        .select('*')
        .eq('chave', CONFIG_ABAST_KEY)
        .single();
    return data ? JSON.parse(data.valor) : { preco_diesel: 0, preco_arla: 0 };
}

export async function saveConfigAbastecimento(config) {
    const { error } = await supabase
        .from('carretas_config')
        .upsert({ chave: CONFIG_ABAST_KEY, valor: JSON.stringify(config) }, { onConflict: 'chave' });
    if (error) throw error;
}
