import { supabase } from './supabaseClient';

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORIAS
// ─────────────────────────────────────────────────────────────────────────────
export const CATEGORIAS_DESPESA_ADM = [
    'Pneus em Estoque',
    'Materiais de Escritório',
    'Equipamentos e Ferramentas',
    'Uniformes / EPIs',
    'Limpeza e Higiene',
    'Informática / Tecnologia',
    'Comunicação / Telefonia',
    'Manutenção Predial',
    'Energia Elétrica',
    'Água e Saneamento',
    'Aluguel / Locação',
    'Seguros Administrativos',
    'Taxas e Impostos',
    'Serviços Terceirizados',
    'Alimentação / Refeições',
    'Treinamento / Capacitação',
    'Marketing / Publicidade',
    'Viagens Administrativas',
    'Outros',
];

// ─────────────────────────────────────────────────────────────────────────────
// DESPESAS ADM
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchDespesasAdmTransporte(filters = {}) {
    let q = supabase
        .from('transporte_despesas_adm')
        .select('*')
        .order('data_despesa', { ascending: false });

    if (filters.categoria)  q = q.eq('categoria', filters.categoria);
    if (filters.dataInicio) q = q.gte('data_despesa', filters.dataInicio);
    if (filters.dataFim)    q = q.lte('data_despesa', filters.dataFim);
    if (filters.formaPgto)  q = q.eq('forma_pagamento', filters.formaPgto);

    const { data, error } = await q;
    if (error) throw error;
    return data || [];
}

export async function createDespesaAdmTransporte(despesa) {
    const { data, error } = await supabase
        .from('transporte_despesas_adm')
        .insert(despesa)
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function updateDespesaAdmTransporte(id, updates) {
    const { data, error } = await supabase
        .from('transporte_despesas_adm')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function deleteDespesaAdmTransporte(id) {
    const { error } = await supabase.from('transporte_despesas_adm').delete().eq('id', id);
    if (error) throw error;
}

// ─── Dar baixa em boleto ──────────────────────────────────────────────────────
export async function pagarBoletoAdmTransporte(despesaId, boletoIdx) {
    const { data: current } = await supabase
        .from('transporte_despesas_adm')
        .select('boletos')
        .eq('id', despesaId)
        .single();
    const boletos = [...(current?.boletos || [])];
    if (boletos[boletoIdx]) boletos[boletoIdx] = { ...boletos[boletoIdx], pago: true, pago_em: new Date().toISOString() };
    const { data, error } = await supabase
        .from('transporte_despesas_adm')
        .update({ boletos, updated_at: new Date().toISOString() })
        .eq('id', despesaId).select().single();
    if (error) throw error;
    return data;
}

// ─── Revogar baixa de boleto ──────────────────────────────────────────────────
export async function revogarBoletoAdmTransporte(despesaId, boletoIdx) {
    const { data: current } = await supabase
        .from('transporte_despesas_adm')
        .select('boletos')
        .eq('id', despesaId)
        .single();
    const boletos = [...(current?.boletos || [])];
    if (boletos[boletoIdx]) {
        const { pago_em, ...rest } = boletos[boletoIdx];
        boletos[boletoIdx] = { ...rest, pago: false };
    }
    const { data, error } = await supabase
        .from('transporte_despesas_adm')
        .update({ boletos, updated_at: new Date().toISOString() })
        .eq('id', despesaId).select().single();
    if (error) throw error;
    return data;
}

// ─── Dar baixa em parcela de cartão ──────────────────────────────────────────
export async function pagarParcelaCartaoAdmTransporte(despesaId, parcelaIdx) {
    const { data: current } = await supabase
        .from('transporte_despesas_adm')
        .select('parcelas_cartao')
        .eq('id', despesaId)
        .single();
    const parcelas = [...(current?.parcelas_cartao || [])];
    if (parcelas[parcelaIdx]) parcelas[parcelaIdx] = { ...parcelas[parcelaIdx], pago: true, pago_em: new Date().toISOString() };
    const { data, error } = await supabase
        .from('transporte_despesas_adm')
        .update({ parcelas_cartao: parcelas, updated_at: new Date().toISOString() })
        .eq('id', despesaId).select().single();
    if (error) throw error;
    return data;
}

// ─── Revogar baixa de parcela de cartão ──────────────────────────────────────
export async function revogarParcelaCartaoAdmTransporte(despesaId, parcelaIdx) {
    const { data: current } = await supabase
        .from('transporte_despesas_adm')
        .select('parcelas_cartao')
        .eq('id', despesaId)
        .single();
    const parcelas = [...(current?.parcelas_cartao || [])];
    if (parcelas[parcelaIdx]) {
        const { pago_em, ...rest } = parcelas[parcelaIdx];
        parcelas[parcelaIdx] = { ...rest, pago: false };
    }
    const { data, error } = await supabase
        .from('transporte_despesas_adm')
        .update({ parcelas_cartao: parcelas, updated_at: new Date().toISOString() })
        .eq('id', despesaId).select().single();
    if (error) throw error;
    return data;
}
