import { supabase } from '../supabaseClient';

// ─────────────────────────────────────────────────────────────────────────────
// DIÁRIAS DE MOTORISTAS
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchDiarias(filters = {}) {
    let q = supabase
        .from('carretas_diarias')
        .select('*, motorista:motorista_id(id, name, tipo_veiculo, assinatura_digital), viagem:viagem_id(id, numero, destino), veiculo:veiculo_id(id, placa, modelo)')
        .order('data_inicio', { ascending: false });
    if (filters.motoristaId)  q = q.eq('motorista_id', filters.motoristaId);
    if (filters.dataInicio)   q = q.gte('data_inicio', filters.dataInicio);
    if (filters.dataFim)      q = q.lte('data_inicio', filters.dataFim);
    // Filtro por lista de IDs de motoristas — separa carretas de caminhões
    if (Array.isArray(filters.motoristasIds) && filters.motoristasIds.length > 0)
        q = q.in('motorista_id', filters.motoristasIds);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
}

function sanitizeDiaria(obj) {
    // Campos UUID não podem ser string vazia — converte para null
    const uuidFields = ['motorista_id', 'viagem_id', 'veiculo_id'];
    const out = { ...obj };
    uuidFields.forEach(f => { if (out[f] === '' || out[f] === undefined) out[f] = null; });
    return out;
}

export async function createDiaria(diaria) {
    const payload = sanitizeDiaria(diaria);
    const valorTotal = Number(payload.quantidade_dias || 1) * Number(payload.valor_dia || 0);
    const { data, error } = await supabase
        .from('carretas_diarias')
        .insert({ ...payload, valor_total: valorTotal })
        .select('*, motorista:motorista_id(id, name)')
        .single();
    if (error) throw error;
    return data;
}

export async function updateDiaria(id, updates) {
    const payload = sanitizeDiaria(updates);
    const valorTotal = Number(payload.quantidade_dias || 1) * Number(payload.valor_dia || 0);
    const { data, error } = await supabase
        .from('carretas_diarias')
        .update({ ...payload, valor_total: valorTotal, updated_at: new Date().toISOString() })
        .eq('id', id).select().single();
    if (error) throw error;
    return data;
}

export async function deleteDiaria(id) {
    const { error } = await supabase.from('carretas_diarias').delete().eq('id', id);
    if (error) throw error;
}

// Assina digitalmente a diária no setor correspondente — 'logistica' (operador)
// ou 'transporte' (admin). Cada setor assina de forma independente, sem
// sobrescrever a assinatura do outro (igual às OS: mecânico + admin).
export async function assinarDiaria(id, campo, assinaturaTexto, assinanteId = null) {
    if (!['logistica', 'transporte'].includes(campo)) throw new Error('Campo de assinatura inválido');
    const { data, error } = await supabase
        .from('carretas_diarias')
        .update({
            [`assinatura_${campo}`]: assinaturaTexto,
            [`assinatura_${campo}_at`]: new Date().toISOString(),
            [`assinatura_${campo}_por`]: assinanteId,
            updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select('*, motorista:motorista_id(id, name, tipo_veiculo, assinatura_digital), viagem:viagem_id(id, numero, destino), veiculo:veiculo_id(id, placa, modelo)')
        .single();
    if (error) throw error;
    return data;
}

// Remove a assinatura digital de um dos setores (ação reservada a administradores na UI).
export async function desassinarDiaria(id, campo) {
    if (!['logistica', 'transporte'].includes(campo)) throw new Error('Campo de assinatura inválido');
    const { data, error } = await supabase
        .from('carretas_diarias')
        .update({
            [`assinatura_${campo}`]: null,
            [`assinatura_${campo}_at`]: null,
            [`assinatura_${campo}_por`]: null,
            updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select('*, motorista:motorista_id(id, name, tipo_veiculo, assinatura_digital), viagem:viagem_id(id, numero, destino), veiculo:veiculo_id(id, placa, modelo)')
        .single();
    if (error) throw error;
    return data;
}
