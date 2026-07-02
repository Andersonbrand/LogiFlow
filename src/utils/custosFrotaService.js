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

// ─────────────────────────────────────────────────────────────────────────────
// VÍNCULO COM RECEITA — casar o destino de um romaneio/carregamento com a
// tabela de custos por destino, para abater o custo estimado da receita de
// frete de cada veículo (caminhão/carreta), separadamente, no DRE.
// ─────────────────────────────────────────────────────────────────────────────

/** Remove acentos, parênteses, pontuação e normaliza espaços/caixa para comparação de texto livre. */
function normalizarDestino(txt) {
    if (!txt) return '';
    return txt
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove acentos
        .toLowerCase()
        .replace(/\([^)]*\)/g, ' ')  // remove "(frete c/ antecedência)", "(Por Matina)" etc.
        .replace(/[^a-z0-9,\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Encontra o registro de custos_destinos que melhor corresponde a um texto de
 * destino livre (ex: vindo de romaneios.destino ou carretas_romaneios.destino).
 * Retorna null se não achar. Estratégia: match exato → match por segmento
 * (destinos com vírgula, ex. "Arapiranga, Rio de Contas") → substring.
 */
export function encontrarCustoDestino(destinoTexto, custosDestinos) {
    const alvo = normalizarDestino(destinoTexto);
    if (!alvo || !custosDestinos?.length) return null;

    let achado = custosDestinos.find(d => normalizarDestino(d.destino) === alvo);
    if (achado) return achado;

    for (const d of custosDestinos) {
        const segmentosCadastro = normalizarDestino(d.destino).split(',').map(s => s.trim()).filter(Boolean);
        const segmentosAlvo     = alvo.split(',').map(s => s.trim()).filter(Boolean);
        if (segmentosCadastro.some(s => segmentosAlvo.includes(s))) return d;
    }

    achado = custosDestinos.find(d => {
        const nome = normalizarDestino(d.destino);
        return nome && (alvo.includes(nome) || nome.includes(alvo));
    });
    return achado || null;
}

/**
 * Calcula a margem real de um frete já lançado (romaneio/carregamento),
 * cruzando o destino informado com a tabela de custos cadastrada.
 * Retorna null se não houver destino correspondente cadastrado.
 */
export function calcularMargemFrete({ destinoTexto, valorFrete, custosDestinos, custoPorKm, custoPorDia, margemPadrao }) {
    const destino = encontrarCustoDestino(destinoTexto, custosDestinos);
    if (!destino) return null;
    const calc = calcularCustoDestino(destino, custoPorKm, custoPorDia, margemPadrao);
    const receita = Number(valorFrete || 0);
    const lucroReal = receita - calc.custoTotal;
    const margemRealPct = receita > 0 ? (lucroReal / receita) * 100 : null;
    return {
        destinoEncontrado: destino.destino,
        distanciaKm: Number(destino.distancia_km || 0),
        diasViagem: Number(destino.dias_viagem || 0),
        custoTotal: calc.custoTotal,
        valorEstimado: calc.valorEstimado,
        receita,
        lucroReal,
        margemRealPct,
    };
}

/** Carrega tudo que é necessário (itens + config + destinos) para calcular margens de um tipo de veículo. */
export async function fetchDadosMargemFrete(tipoVeiculo) {
    const [itens, config, destinos] = await Promise.all([
        fetchCustosItens(tipoVeiculo),
        fetchCustosConfig(tipoVeiculo),
        fetchCustosDestinos(tipoVeiculo),
    ]);
    const { custoPorKm, custoPorDia } = calcularCustosTotais(itens);
    return { custoPorKm, custoPorDia, margemPadrao: config.margem_lucro_pct, destinos };
}

/**
 * Calcula o custo total estimado (abatimento) de uma LISTA de fretes (romaneios
 * ou carregamentos), agrupando por veículo/placa e casando cada um pelo destino.
 * Usado no DRE para abater a receita de frete pelo custo de rodagem real de cada
 * veículo, separado por tipo (caminhão/carreta).
 *
 * fretes: [{ destino, valor_frete, placa }]
 * Retorna { custoTotalEstimado, porVeiculo: { [placa]: { custo, receita, fretesComMatch, fretesSemMatch } } }
 */
export function calcularAbatimentoCustosFrota(fretes, dadosMargem) {
    const { custoPorKm, custoPorDia, margemPadrao, destinos } = dadosMargem;
    let custoTotalEstimado = 0;
    let receitaTotal = 0;
    const porVeiculo = {};
    let semMatch = 0;

    for (const f of (fretes || [])) {
        const placa = f.placa || '—';
        if (!porVeiculo[placa]) porVeiculo[placa] = { custo: 0, receita: 0, fretesComMatch: 0, fretesSemMatch: 0 };
        receitaTotal += Number(f.valor_frete || 0);
        porVeiculo[placa].receita += Number(f.valor_frete || 0);

        const destino = encontrarCustoDestino(f.destino, destinos);
        if (destino) {
            const { custoTotal } = calcularCustoDestino(destino, custoPorKm, custoPorDia, margemPadrao);
            custoTotalEstimado += custoTotal;
            porVeiculo[placa].custo += custoTotal;
            porVeiculo[placa].fretesComMatch += 1;
        } else {
            semMatch += 1;
            porVeiculo[placa].fretesSemMatch += 1;
        }
    }

    return { custoTotalEstimado, receitaTotal, porVeiculo, semMatch, totalFretes: (fretes || []).length };
}
