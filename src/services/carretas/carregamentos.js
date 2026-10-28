import { supabase } from '../supabaseClient';

// ─────────────────────────────────────────────────────────────────────────────
// CARREGAMENTOS / FRETES
// ─────────────────────────────────────────────────────────────────────────────
export const TIPOS_CALCULO_FRETE = [
    { value: 'por_saco',       label: 'Por saco' },
    { value: 'por_tonelada',   label: 'Por tonelada' },
    { value: 'por_carga',      label: 'Por carga (fixo)' },
    { value: 'percentual',     label: 'Percentual (%)' },
    { value: 'por_km',         label: 'Por KM (consumo do veículo)' },
];

// calcularFrete: para por_km, valorBase = preço do diesel (R$/L) e
// quantidade = distanciaKm; consumoVeiculo = km/L cadastrado no veículo
export function calcularFrete(tipoCalculo, quantidade, valorBase, consumoVeiculo) {
    if (!tipoCalculo || !valorBase) return 0;
    switch (tipoCalculo) {
        case 'percentual':   return (Number(quantidade) * Number(valorBase)) / 100;
        case 'por_saco':     return Number(quantidade) * Number(valorBase);
        case 'por_tonelada': return Number(quantidade) * Number(valorBase);
        case 'por_carga':    return Number(valorBase);
        case 'por_km': {
            // (distância / consumo) * preço diesel = custo combustível da viagem
            const consumo = Number(consumoVeiculo) || 1;
            return (Number(quantidade) / consumo) * Number(valorBase);
        }
        default: return 0;
    }
}

export async function fetchCarregamentos(filters = {}) {
    let q = supabase
        .from('carretas_carregamentos')
        .select(`
            *,
            motorista:motorista_id(id, name, is_terceiro),
            veiculo:veiculo_id(id, placa),
            empresa:empresa_id(id, nome)
        `)
        .order('data_carregamento', { ascending: false });

    if (filters.motoristaId)               q = q.eq('motorista_id', filters.motoristaId);
    if (filters.empresaId)                 q = q.eq('empresa_id', filters.empresaId);
    if (filters.dataInicio)                q = q.gte('data_carregamento', filters.dataInicio);
    if (filters.dataFim)                   q = q.lte('data_carregamento', filters.dataFim);
    if (filters.is_terceiro !== undefined) q = q.eq('is_terceiro', filters.is_terceiro);
    if (filters.is_retira !== undefined)   q = q.eq('is_retira', filters.is_retira);
    else if (filters.is_terceiro === false) q = q.eq('is_retira', false); // por padrão, frota não inclui retira

    const { data, error } = await q;
    if (error) throw error;

    // Garante exclusão de registros de motoristas terceirizados mesmo que is_terceiro
    // esteja false/null no registro (dados legados antes da flag existir)
    if (filters.is_terceiro === false) {
        return (data || []).filter(c => !c.motorista?.is_terceiro);
    }

    return data || [];
}

export function sanitizeUuids(obj) {
    // Converte strings vazias em campos UUID para null (evita erro do Postgres)
    const uuidFields = ['motorista_id', 'veiculo_id', 'empresa_id'];
    const out = { ...obj };
    uuidFields.forEach(f => { if (out[f] === '' || out[f] === undefined) out[f] = null; });
    return out;
}

// CIF: apenas volume, sem frete e sem bônus
function isCIF(empresa_origem) {
    const s = (empresa_origem || '').toUpperCase();
    return s.startsWith('CIF_') || s.includes('|CIF_');
}

// Extrai o nome da coluna de um erro de schema cache do PostgREST
// Ex: "Could not find the 'nome_cliente' column of 'carretas_carregamentos' in the schema cache"
function _missingColumnFromError(error) {
    const msg = error?.message || '';
    const m = msg.match(/Could not find the '([^']+)' column/);
    return m ? m[1] : null;
}

export async function createCarregamento(carregamento) {
    const payload = sanitizeUuids(carregamento);
    // CIF não gera frete calculado
    const valorFrete = isCIF(payload.empresa_origem) ? 0 : calcularFrete(
        payload.tipo_calculo_frete,
        payload.quantidade,
        payload.valor_base_frete,
        payload._consumoVeiculo
    );
    delete payload._consumoVeiculo;

    let insertPayload = { ...payload, valor_frete_calculado: valorFrete };
    for (let attempt = 0; attempt < 5; attempt++) {
        const { data, error } = await supabase
            .from('carretas_carregamentos')
            .insert(insertPayload)
            .select()
            .single();
        if (!error) return data;
        const missing = _missingColumnFromError(error);
        if (missing && missing in insertPayload) {
            // Coluna ainda não existe no banco (migração pendente) — remove e tenta novamente
            const { [missing]: _omit, ...rest } = insertPayload;
            insertPayload = rest;
            continue;
        }
        throw error;
    }
    throw new Error('Falha ao salvar carregamento após múltiplas tentativas.');
}

export async function updateCarregamento(id, updates) {
    const payload = sanitizeUuids(updates);
    // CIF não gera frete calculado
    const valorFrete = isCIF(payload.empresa_origem) ? 0 : calcularFrete(
        payload.tipo_calculo_frete,
        payload.quantidade,
        payload.valor_base_frete,
        payload._consumoVeiculo
    );
    delete payload._consumoVeiculo;

    let updatePayload = { ...payload, valor_frete_calculado: valorFrete, updated_at: new Date().toISOString() };
    for (let attempt = 0; attempt < 5; attempt++) {
        const { data, error } = await supabase
            .from('carretas_carregamentos')
            .update(updatePayload)
            .eq('id', id)
            .select()
            .single();
        if (!error) return data;
        const missing = _missingColumnFromError(error);
        if (missing && missing in updatePayload) {
            const { [missing]: _omit, ...rest } = updatePayload;
            updatePayload = rest;
            continue;
        }
        throw error;
    }
    throw new Error('Falha ao atualizar carregamento após múltiplas tentativas.');
}

export async function deleteCarregamento(id) {
    const { error } = await supabase.from('carretas_carregamentos').delete().eq('id', id);
    if (error) throw error;
}

// Marca/desmarca o frete de um carregamento (tipicamente terceiro) como pago.
// Usa um UPDATE dedicado (sem recalcular valor_frete_calculado) para nunca
// zerar o frete já registrado do carregamento.
export async function marcarFreteCarregamentoPago(id, pago = true) {
    const { data, error } = await supabase
        .from('carretas_carregamentos')
        .update({ frete_pago: pago, frete_pago_em: pago ? new Date().toISOString() : null })
        .eq('id', id)
        .select()
        .single();
    if (error) throw error;
    return data;
}

// Dá baixa (ou desfaz) em vários fretes de carregamentos de terceiros de uma
// vez só — usado na seleção múltipla da tela de Volume de Carregamento >
// Terceiros, pra não precisar marcar um por um e esperar a tela recarregar
// a cada clique.
export async function marcarFretesCarregamentoPagoEmMassa(ids, pago = true) {
    if (!ids || ids.length === 0) return { sucesso: 0, falha: 0 };
    const { error, count } = await supabase
        .from('carretas_carregamentos')
        .update({ frete_pago: pago, frete_pago_em: pago ? new Date().toISOString() : null }, { count: 'exact' })
        .in('id', ids);
    if (error) throw error;
    return { sucesso: count ?? ids.length, falha: 0 };
}

/** Uma página (1000 linhas) de carregamentos do período, para a verificação de duplicatas. Retorna { data, error }. */
export function fetchCarregamentosPaginaPeriodo(ini, fim, offset) {
    return supabase
        .from('carretas_carregamentos')
        .select('id, data_carregamento, numero_nota_fiscal, numero_pedido, destino, quantidade, empresa_origem, veiculo_id, motorista_id, is_terceiro, is_retira')
        .gte('data_carregamento', ini).lte('data_carregamento', fim)
        .order('data_carregamento', { ascending: true })
        .range(offset, offset + 999);
}
