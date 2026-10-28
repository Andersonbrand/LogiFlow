import { supabase } from '../supabaseClient';

// ── Fetch ─────────────────────────────────────────────────────────────────────
// ─── Filtro de período aplicado NO SERVIDOR ─────────────────────────────────
// A data de referência do romaneio é a SAÍDA; se ainda não tem saída (ex.: Aguardando),
// vale a data de criação. Romaneios que ainda estão na estrada (Carregando / Em Trânsito)
// aparecem sempre, mesmo que tenham saído no mês anterior.
// periodo = { inicio: ISO, fim: ISO (exclusivo) } — sem periodo, traz tudo (limite 200).
export const STATUS_SEMPRE_VISIVEIS = ['Carregando', 'Em Trânsito'];

export function periodoDoMes(mes /* 'YYYY-MM' */) {
    if (!mes) return null;
    const [y, m] = mes.split('-').map(Number);
    return { inicio: new Date(y, m - 1, 1).toISOString(), fim: new Date(y, m, 1).toISOString() };
}

export function periodoDeDatas(ini /* 'YYYY-MM-DD' */, fim /* 'YYYY-MM-DD' */) {
    if (!ini && !fim) return null;
    const out = {};
    if (ini) out.inicio = new Date(`${ini}T00:00:00`).toISOString();
    if (fim) { const d = new Date(`${fim}T00:00:00`); d.setDate(d.getDate() + 1); out.fim = d.toISOString(); }
    return out;
}

function aplicarFiltroPeriodo(q, periodo) {
    if (!periodo || (!periodo.inicio && !periodo.fim)) return q;
    const porSaida = [], porCriacao = [];
    if (periodo.inicio) { porSaida.push(`saida.gte.${periodo.inicio}`); porCriacao.push(`created_at.gte.${periodo.inicio}`); }
    if (periodo.fim)    { porSaida.push(`saida.lt.${periodo.fim}`);     porCriacao.push(`created_at.lt.${periodo.fim}`); }
    const abertos = STATUS_SEMPRE_VISIVEIS.map(x => `"${x}"`).join(',');
    return q.or([
        `and(${porSaida.join(',')})`,
        `and(saida.is.null,${porCriacao.join(',')})`,
        `status.in.(${abertos})`,
    ].join(','));
}

export async function fetchRomaneios(periodo = null) {
    let q = supabase
        .from('romaneios')
        .select(`
            id, numero, motorista, motorista_id, placa, destino, status,
            aprovado, aprovado_por, aprovado_em, status_aprovacao, motivo_reprovacao,
            peso_total, saida, chegada, observacoes, vehicle_id, paradas,
            distancia_km, custo_combustivel, custo_pedagio,
            custo_motorista, dias_diaria, valor_diaria_dia, diaria_descricao, diaria_criada_em, diaria_mes_referencia,
            assinatura_diaria_logistica, assinatura_diaria_logistica_at, assinatura_diaria_transporte, assinatura_diaria_transporte_at,
            valor_frete, valor_frete_calculado,
            valor_total_carga, created_at, rota_config,
            romaneio_pedidos(id, numero_pedido, cidade_destino, valor_pedido, categoria_frete, categorias_extra, percentual_frete, frete_calculado, empresa, nome_cliente, nome_vendedor, observacao),
            romaneio_itens(id, quantidade, peso_total, material_id, pedido_id,
                is_telha_zinco, comprimento_telha, metros_totais, peso_unit,
                materials(id, nome, unidade, peso, categoria_frete, percentual_frete, is_telha_zinco, peso_base_metro))
        `)
        .eq('is_rascunho', false);
    q = aplicarFiltroPeriodo(q, periodo);
    const { data, error } = await q.order('created_at', { ascending: false }).limit(200);
    if (error) { console.error('[romaneioService] fetchRomaneios error:', error); throw error; }
    console.log('[romaneioService] fetchRomaneios retornou:', (data||[]).length, 'registros');
    return (data || []).map(addMargem);
}

// Versão sem os joins de romaneio_pedidos/romaneio_itens/materials — pra quem
// só usa os campos soltos do romaneio (dashboard, KPIs, painel de custos,
// telas administrativas). Os joins de pedidos/itens são pesados (3 tabelas
// aninhadas) e várias páginas nunca chegam a usar esse dado — buscar só o
// necessário reduz bastante o custo de cada consulta, principalmente porque
// essas páginas recarregam via Realtime toda vez que qualquer romaneio muda.
export async function fetchRomaneiosResumo(periodo = null) {
    let q = supabase
        .from('romaneios')
        .select(`
            id, numero, motorista, motorista_id, placa, destino, status,
            aprovado, aprovado_por, aprovado_em, status_aprovacao, motivo_reprovacao,
            peso_total, saida, chegada, observacoes, vehicle_id, paradas,
            distancia_km, custo_combustivel, custo_pedagio,
            custo_motorista, dias_diaria, valor_diaria_dia, diaria_descricao, diaria_criada_em, diaria_mes_referencia,
            assinatura_diaria_logistica, assinatura_diaria_logistica_at, assinatura_diaria_transporte, assinatura_diaria_transporte_at,
            valor_frete, valor_frete_calculado,
            valor_total_carga, created_at, rota_config
        `)
        .eq('is_rascunho', false);
    q = aplicarFiltroPeriodo(q, periodo);
    const { data, error } = await q.order('created_at', { ascending: false }).limit(200);
    if (error) { console.error('[romaneioService] fetchRomaneiosResumo error:', error); throw error; }
    console.log('[romaneioService] fetchRomaneiosResumo retornou:', (data||[]).length, 'registros');
    return (data || []).map(addMargem);
}

export async function fetchRomaneioById(id) {
    const { data, error } = await supabase
        .from('romaneios')
        .select(`
            id, numero, motorista, motorista_id, placa, destino, status,
            aprovado, aprovado_por, aprovado_em, status_aprovacao, motivo_reprovacao,
            peso_total, saida, chegada, observacoes, vehicle_id, paradas,
            distancia_km, custo_combustivel, custo_pedagio,
            custo_motorista, dias_diaria, valor_diaria_dia, diaria_descricao, diaria_criada_em, diaria_mes_referencia,
            assinatura_diaria_logistica, assinatura_diaria_logistica_at, assinatura_diaria_transporte, assinatura_diaria_transporte_at,
            valor_frete, valor_frete_calculado,
            valor_total_carga, created_at, rota_config,
            romaneio_pedidos(id, numero_pedido, cidade_destino, valor_pedido, categoria_frete, categorias_extra, percentual_frete, frete_calculado, empresa, nome_cliente, nome_vendedor, observacao),
            romaneio_itens(id, quantidade, peso_total, material_id, pedido_id,
                is_telha_zinco, comprimento_telha, metros_totais, peso_unit,
                materials(id, nome, unidade, peso, categoria_frete, percentual_frete, is_telha_zinco, peso_base_metro))
        `)
        .eq('id', id).single();
    if (error) throw error;
    return addMargem(data);
}

function addMargem(r) {
    if (!r) return r;
    const custo = (Number(r.custo_combustivel)||0) + (Number(r.custo_pedagio)||0) + (Number(r.custo_motorista)||0);
    const frete = Number(r.valor_frete_calculado || r.valor_frete) || 0;
    return { ...r, margem_lucro: frete - custo };
}

export async function fetchRomaneiosPorMotorista(motoristaId, nomeMotorista) {
    // Monta filtro OR: por nome (registros antigos) e por UUID (registros novos)
    const partes = [];
    if (motoristaId) partes.push(`motorista_id.eq.${motoristaId}`);
    if (nomeMotorista) partes.push(`motorista.ilike."${nomeMotorista}"`);

    // Se não tem nenhum critério, retorna vazio
    if (partes.length === 0) return [];

    const { data, error } = await supabase
        .from('romaneios')
        .select(`
            id, numero, motorista, motorista_id, placa, destino, status,
            aprovado, aprovado_em, peso_total, saida, chegada, created_at,
            valor_frete, valor_frete_calculado,
            romaneio_pedidos(id, numero_pedido, cidade_destino, valor_pedido),
            romaneio_itens(id, quantidade, peso_total, material_id,
                is_telha_zinco, comprimento_telha, metros_totais, peso_unit,
                materials(id, nome, unidade, peso, categoria_frete, is_telha_zinco, peso_base_metro))
        `)
        .or(partes.join(','))
        .order('created_at', { ascending: false });

    if (error) {
        console.error('[romaneioService] fetchRomaneiosPorMotorista erro:', error);
        throw error;
    }
    return data || [];
}

/**
 * Romaneios do motorista (por id OU nome) no período, com itens e materiais.
 * `dateStr` = início (YYYY-MM-DD); `dateFimStr` = fim opcional (YYYY-MM-DD, inclusivo).
 * Filtra pela data de saída; sem saída cadastrada, cai na data de criação.
 */
export async function fetchRomaneiosDoMotorista({ userId, nome, dateStr, dateFimStr }) {
    let romQuery = supabase.from('romaneios')
        .select(`id, numero, motorista, motorista_id, placa, destino, status,
            aprovado, aprovado_em, peso_total, saida, created_at,
            romaneio_itens(id, quantidade, peso_total, material_id,
                materials(id, nome, unidade, peso, categoria_frete))`)
        .or(`motorista_id.eq.${userId},motorista.ilike."${nome}"`);
    const iniISO = new Date(`${dateStr}T00:00:00`).toISOString();
    let fimISO = null;
    if (dateFimStr) { const d = new Date(`${dateFimStr}T00:00:00`); d.setDate(d.getDate() + 1); fimISO = d.toISOString(); }
    const porSaida = [`saida.gte.${iniISO}`], porCriacao = [`created_at.gte.${iniISO}`];
    if (fimISO) { porSaida.push(`saida.lt.${fimISO}`); porCriacao.push(`created_at.lt.${fimISO}`); }
    romQuery = romQuery.or(`and(${porSaida.join(',')}),and(saida.is.null,${porCriacao.join(',')})`);
    romQuery = romQuery.order('created_at', { ascending: false });
    const r = await romQuery;
    return r.data || [];
}
