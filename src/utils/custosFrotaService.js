import { supabase } from './supabaseClient';

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOS DE RODAGEM — caminhões e carretas
// Reproduz a lógica da planilha "Informações para análise de frete":
//   • Itens por KM (pneus, óleo...) → Custo por KM Rodado
//   • Itens por dia (salário, IPVA, seguro, manutenção, depreciação...) → Custo por Dia
//   • Por destino: Custo Total = distancia_km * custoKm + dias * custoDia
//     Valor Estimado = Custo Total / (1 - margem/100)
// ─────────────────────────────────────────────────────────────────────────────

// ── Itens de custo ────────────────────────────────────────────────────────────
const isMissingTable = (e) =>
    e && (e.code === 'PGRST106' || e.message?.includes('schema cache') || e.message?.includes('does not exist'));

export async function fetchCustosItens(tipoVeiculo) {
    const { data, error } = await supabase
        .from('custos_itens')
        .select('*')
        .eq('tipo_veiculo', tipoVeiculo)
        .order('categoria', { ascending: true })
        .order('ordem', { ascending: true });
    if (error) {
        if (isMissingTable(error)) return [];
        throw error;
    }
    return data || [];
}

export async function createCustoItem(item) {
    const { data, error } = await supabase.from('custos_itens').insert(item).select().single();
    if (error) throw error;
    return data;
}

export async function updateCustoItem(id, updates) {
    const { data, error } = await supabase
        .from('custos_itens')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id).select().single();
    if (error) throw error;
    return data;
}

export async function deleteCustoItem(id) {
    const { error } = await supabase.from('custos_itens').delete().eq('id', id);
    if (error) throw error;
}

// ── Margem de lucro padrão por tipo de veículo ────────────────────────────────
export async function fetchCustosConfig(tipoVeiculo) {
    const { data, error } = await supabase
        .from('custos_config')
        .select('*')
        .eq('tipo_veiculo', tipoVeiculo)
        .maybeSingle();
    // Se a tabela ainda não existe no banco, retorna padrão sem lançar erro
    if (error) {
        if (error.code === 'PGRST106' || error.message?.includes('schema cache') || error.message?.includes('does not exist')) {
            return { tipo_veiculo: tipoVeiculo, margem_lucro_pct: 20 };
        }
        throw error;
    }
    return data || { tipo_veiculo: tipoVeiculo, margem_lucro_pct: 20 };
}

export async function updateCustosConfig(tipoVeiculo, margemLucroPct) {
    const { data, error } = await supabase
        .from('custos_config')
        .upsert({ tipo_veiculo: tipoVeiculo, margem_lucro_pct: margemLucroPct, updated_at: new Date().toISOString() })
        .select().single();
    if (error) throw error;
    return data;
}

// ── Custos por destino ────────────────────────────────────────────────────────
export async function fetchCustosDestinos(tipoVeiculo) {
    const { data, error } = await supabase
        .from('custos_destinos')
        .select('*')
        .eq('tipo_veiculo', tipoVeiculo)
        .order('destino', { ascending: true });
    if (error) {
        if (isMissingTable(error)) return [];
        throw error;
    }
    return data || [];
}

export async function createCustoDestino(destino) {
    const { data, error } = await supabase.from('custos_destinos').insert(destino).select().single();
    if (error) throw error;
    return data;
}

export async function updateCustoDestino(id, updates) {
    const { data, error } = await supabase
        .from('custos_destinos')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id).select().single();
    if (error) throw error;
    return data;
}

export async function deleteCustoDestino(id) {
    const { error } = await supabase.from('custos_destinos').delete().eq('id', id);
    if (error) throw error;
}

// ─────────────────────────────────────────────────────────────────────────────
// CÁLCULOS
// ─────────────────────────────────────────────────────────────────────────────

/** Custo por KM rodado de um item: (preço da unidade * unidades por veículo) / km de vida útil */
export function calcularCustoKmItem(item) {
    const preco    = Number(item.preco_unidade || 0);
    const kmVida   = Number(item.km_vida_util || 0);
    const unidades = Number(item.unidades_por_veiculo || 1);
    if (!kmVida) return 0;
    return (preco / kmVida) * unidades;
}

/** Custo médio diário de um item recorrente: valor mensal/30 ou valor anual/365 */
export function calcularCustoDiaItem(item) {
    if (item.valor_mensal) return Number(item.valor_mensal) / 30;
    if (item.valor_anual)  return Number(item.valor_anual) / 365;
    return 0;
}

/** Soma o custo/km e custo/dia de uma lista de itens (categoria 'km' e 'dia' misturadas) */
export function calcularCustosTotais(itens) {
    const itensKm  = itens.filter(i => i.categoria === 'km');
    const itensDia = itens.filter(i => i.categoria === 'dia');
    const custoPorKm  = itensKm.reduce((s, i) => s + calcularCustoKmItem(i), 0);
    const custoPorDia = itensDia.reduce((s, i) => s + calcularCustoDiaItem(i), 0);
    return { custoPorKm, custoPorDia };
}

/**
 * Calcula o custo total e valor estimado de frete para um destino.
 * custoTotal = distancia_km * custoPorKm + dias_viagem * custoPorDia
 * valorEstimado = custoTotal / (1 - margem/100)
 */
export function calcularCustoDestino(destino, custoPorKm, custoPorDia, margemPadrao = 20) {
    const distancia = Number(destino.distancia_km || 0);
    const dias      = Number(destino.dias_viagem || 0);
    const margem    = Number(destino.margem_lucro_pct ?? margemPadrao);
    const custoTotal = distancia * custoPorKm + dias * custoPorDia;
    const divisor = 1 - (margem / 100);
    const valorEstimado = divisor > 0 ? custoTotal / divisor : custoTotal;
    const valorPraticado = destino.valor_praticado != null ? Number(destino.valor_praticado) : null;
    const diferenca = valorPraticado != null ? valorPraticado - valorEstimado : null;
    return { custoTotal, valorEstimado, valorPraticado, diferenca, margem };
}
