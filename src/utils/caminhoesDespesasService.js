import { supabase } from './supabaseClient';

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORIAS
// ─────────────────────────────────────────────────────────────────────────────
export const CATEGORIAS_DESPESA_CAMINHOES = [
    'Pneus', 'Peças', 'Acessórios', 'Oficina / Mão de obra',
    'Depreciação', 'Seguro', 'IPVA / Licenciamento', 'Lavagem',
    'Pedágio', 'Multas', 'Combustível extra', 'Outros',
];

// ─────────────────────────────────────────────────────────────────────────────
// DESPESAS
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchDespesasCaminhoes(filters = {}) {
    let q = supabase
        .from('caminhoes_despesas')
        .select('*, veiculo:vehicle_id(id, placa, tipo)')
        .order('data_despesa', { ascending: false });

    if (filters.vehicleId)  q = q.eq('vehicle_id', filters.vehicleId);
    if (filters.empresa)    q = q.eq('empresa', filters.empresa);
    if (filters.categoria)  q = q.eq('categoria', filters.categoria);
    if (filters.dataInicio) q = q.gte('data_despesa', filters.dataInicio);
    if (filters.dataFim)    q = q.lte('data_despesa', filters.dataFim);
    if (filters.formaPgto)  q = q.eq('forma_pagamento', filters.formaPgto);

    const { data, error } = await q;
    if (error) throw error;
    return data || [];
}

export async function createDespesaCaminhao(despesa) {
    const { data, error } = await supabase
        .from('caminhoes_despesas')
        .insert(despesa)
        .select('*, veiculo:vehicle_id(id, placa, tipo)')
        .single();
    if (error) throw error;
    return data;
}

export async function updateDespesaCaminhao(id, updates) {
    const { data, error } = await supabase
        .from('caminhoes_despesas')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('*, veiculo:vehicle_id(id, placa, tipo)')
        .single();
    if (error) throw error;
    return data;
}

export async function deleteDespesaCaminhao(id) {
    const { error } = await supabase.from('caminhoes_despesas').delete().eq('id', id);
    if (error) throw error;
}

// Dar baixa em um boleto específico
export async function pagarBoletoCaminhao(despesaId, boletoIdx) {
    const { data: current } = await supabase
        .from('caminhoes_despesas')
        .select('boletos')
        .eq('id', despesaId)
        .single();

    const boletos = [...(current?.boletos || [])];
    if (boletos[boletoIdx]) boletos[boletoIdx] = { ...boletos[boletoIdx], pago: true, pago_em: new Date().toISOString() };

    const { data, error } = await supabase
        .from('caminhoes_despesas')
        .update({ boletos, updated_at: new Date().toISOString() })
        .eq('id', despesaId)
        .select()
        .single();
    if (error) throw error;
    return data;
}

// Dar baixa em parcela de cartão
export async function pagarParcelaCartaoCaminhao(despesaId, parcelaIdx) {
    const { data: current } = await supabase
        .from('caminhoes_despesas')
        .select('parcelas_cartao')
        .eq('id', despesaId)
        .single();

    const parcelas = [...(current?.parcelas_cartao || [])];
    if (parcelas[parcelaIdx]) parcelas[parcelaIdx] = { ...parcelas[parcelaIdx], pago: true, pago_em: new Date().toISOString() };

    const { data, error } = await supabase
        .from('caminhoes_despesas')
        .update({ parcelas_cartao: parcelas, updated_at: new Date().toISOString() })
        .eq('id', despesaId)
        .select()
        .single();
    if (error) throw error;
    return data;
}

// ─────────────────────────────────────────────────────────────────────────────
// FORNECEDORES
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchFornecedoresCaminhoes() {
    const { data, error } = await supabase
        .from('caminhoes_fornecedores')
        .select('*')
        .order('nome', { ascending: true });
    if (error) throw error;
    return data || [];
}

export async function createFornecedorCaminhao(fornecedor) {
    const { data, error } = await supabase
        .from('caminhoes_fornecedores')
        .insert(fornecedor)
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function updateFornecedorCaminhao(id, updates) {
    const { data, error } = await supabase
        .from('caminhoes_fornecedores')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function deleteFornecedorCaminhao(id) {
    const { error } = await supabase.from('caminhoes_fornecedores').delete().eq('id', id);
    if (error) throw error;
}
