import { supabase } from '../supabaseClient';

// ─────────────────────────────────────────────────────────────────────────────
// ROMANEIOS DE CARRETA
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Busca um romaneio existente com mesmo motorista, destino e data_saida
 * em qualquer das duas tabelas (carretas_romaneios ou romaneios do admin).
 * Retorna o número existente, ou null se não encontrar.
 */
async function buscarNumeroExistente({ motorista_id, motoristaNome, destino, data_saida }) {
    if (!destino || !data_saida) return null;

    const destinoNorm = (destino || '').trim().toLowerCase();
    const dataStr     = (data_saida || '').substring(0, 10); // YYYY-MM-DD

    // ── Busca na tabela carretas_romaneios (motorista + admin carretas) ──
    {
        let q = supabase
            .from('carretas_romaneios')
            .select('numero, motorista_id, destino, data_saida')
            .not('numero', 'is', null);
        if (motorista_id) q = q.eq('motorista_id', motorista_id);
        const { data: rows } = await q;
        const match = (rows || []).find(r =>
            (r.destino || '').trim().toLowerCase() === destinoNorm &&
            (r.data_saida || '').substring(0, 10) === dataStr
        );
        if (match?.numero) return match.numero;
    }

    // ── Busca na tabela romaneios (admin — sistema principal) ──
    {
        let q = supabase
            .from('romaneios')
            .select('numero, motorista_id, motorista, destino, saida')
            .not('numero', 'is', null);
        if (motorista_id) q = q.eq('motorista_id', motorista_id);
        else if (motoristaNome) q = q.ilike('motorista', `%${motoristaNome.trim()}%`);
        const { data: rows } = await q;
        const match = (rows || []).find(r =>
            (r.destino || '').trim().toLowerCase() === destinoNorm &&
            (r.saida || '').substring(0, 10) === dataStr
        );
        if (match?.numero) return match.numero;
    }

    return null;
}

/**
 * Gera o próximo número sequencial considerando as duas tabelas,
 * garantindo que não haja colisão entre romaneios do admin e do motorista.
 */
export async function nextRomaneioNumero() {
    // IMPORTANTE: filtra apenas números no formato ROM-XXXXX.
    // Sem esse filtro, números de pedido (ex: 8836898) ou timestamps gravados
    // no campo `numero` por registros de motoristas seriam tratados como parte
    // da sequência, gerando números absurdamente grandes.
    // item 5: sequência independente — considera apenas os romaneios do próprio
    // módulo de carretas (carretas_romaneios), sem misturar com a tabela `romaneios`.
    const isRomNum = (str) => typeof str === 'string' && /^ROM-/i.test(str.trim());
    const parseNum = (str) => isRomNum(str) ? (parseInt(str.replace(/\D/g, ''), 10) || 0) : 0;

    const { data: todosCarretas } = await supabase.from('carretas_romaneios').select('numero');
    const nums = (todosCarretas || []).map(r => parseNum(r.numero)).filter(n => n > 0);
    const maxN = nums.length > 0 ? Math.max(...nums) : 0;
    return `ROM-${String(maxN + 1).padStart(3, '0')}`;
}

export async function fetchRomaneios(filters = {}) {
    let q = supabase
        .from('carretas_romaneios')
        .select(`
            *,
            motorista:motorista_id(id, name),
            veiculo:veiculo_id(id, placa, modelo),
            pedidos:carretas_romaneio_pedidos(
                id, numero_pedido, cidade_destino, valor_pedido, categoria_frete,
                categorias_extra, percentual_frete, frete_calculado, empresa,
                nome_cliente, nome_vendedor, observacao
            ),
            itens:carretas_romaneio_itens(
                id, material_id, quantidade, unidade, peso_total, peso_unit, descricao, observacoes,
                pedido_id, is_telha_zinco, comprimento_telha, metros_totais,
                material:material_id(id, nome, peso, unidade, percentual_frete, categoria_frete, is_telha_zinco, peso_base_metro)
            )
        `)
        .order('created_at', { ascending: false });
    // Admin vê TODOS os romaneios — base para DRE e cálculos financeiros
    if (filters.status)      q = q.eq('status', filters.status);
    if (filters.motoristaId) q = q.eq('motorista_id', filters.motoristaId);
    if (filters.dataInicio)  q = q.gte('data_saida', filters.dataInicio);
    if (filters.dataFim)     q = q.lte('data_saida', filters.dataFim);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
}

function itensPayloadCarretas(itens, romaneioId, pedidoIdMap) {
    return (itens || []).map(it => ({
        romaneio_id: romaneioId,
        material_id: it.material_id || null,
        descricao:   it.descricao   || null,
        quantidade:  Number(it.quantidade) || 1,
        unidade:     it.unidade     || 'ton',
        peso_total:  it.peso_total  ? Number(it.peso_total) : null,
        peso_unit:   it.peso_unit   != null ? Number(it.peso_unit) : null,
        observacoes: it.observacoes || null,
        pedido_id:   it.pedido_index != null ? (pedidoIdMap[it.pedido_index] || null) : (it.pedido_id || null),
        is_telha_zinco:    it.is_telha_zinco || false,
        comprimento_telha: it.comprimento_telha != null ? Number(it.comprimento_telha) : null,
        metros_totais:     it.metros_totais     != null ? Number(it.metros_totais)     : null,
    }));
}

export async function createRomaneio(romaneio) {
    const { itens = [], _pedidos = [], ...payload } = romaneio;
    // Sanitize optional UUIDs
    if (!payload.motorista_id) delete payload.motorista_id;
    if (!payload.veiculo_id)   delete payload.veiculo_id;
    payload.numero = await nextRomaneioNumero();
    payload.lancado_por_motorista = false; // criado pelo admin
    const { data, error } = await supabase
        .from('carretas_romaneios')
        .insert(payload)
        .select()
        .single();
    if (error) throw error;

    // Pedidos — salva antes dos itens para poder vincular pedido_id
    const pedidoIdMap = {};
    if (_pedidos.length > 0) {
        const { data: pedidosData, error: pe } = await supabase
            .from('carretas_romaneio_pedidos')
            .insert(_pedidos.map(p => ({ ...p, romaneio_id: data.id })))
            .select('id');
        if (pe) throw pe;
        (pedidosData || []).forEach((p, i) => { pedidoIdMap[i] = p.id; });
    }

    if (itens.length > 0) {
        const { error: eItens } = await supabase.from('carretas_romaneio_itens')
            .insert(itensPayloadCarretas(itens, data.id, pedidoIdMap));
        if (eItens) throw eItens;
    }
    return data;
}

export async function updateRomaneio(id, romaneio) {
    const { itens, _pedidos, ...payload } = romaneio;
    // Não deletar veiculo_id quando é undefined — só quando explicitamente vazio
    if (payload.motorista_id === '') delete payload.motorista_id;
    if (payload.veiculo_id === '')   delete payload.veiculo_id;
    payload.updated_at = new Date().toISOString();
    const { data, error } = await supabase
        .from('carretas_romaneios')
        .update(payload)
        .eq('id', id)
        .select()
        .maybeSingle(); // evita erro "Cannot coerce to single JSON object" quando RLS filtra
    if (error) throw error;

    // Itens ANTES dos pedidos — romaneio_itens.pedido_id tem FK para
    // carretas_romaneio_pedidos.id, mesma ordem usada no módulo de caminhões.
    if (itens !== undefined || _pedidos !== undefined) {
        const { error: delItensErr } = await supabase.from('carretas_romaneio_itens').delete().eq('romaneio_id', id);
        if (delItensErr) throw delItensErr;
    }
    let pedidoIdMap = {};
    if (_pedidos !== undefined) {
        const { error: delPedidosErr } = await supabase.from('carretas_romaneio_pedidos').delete().eq('romaneio_id', id);
        if (delPedidosErr) throw delPedidosErr;
        if (_pedidos.length > 0) {
            const { data: pd, error: pe } = await supabase
                .from('carretas_romaneio_pedidos')
                .insert(_pedidos.map(({ id: _omit, ...p }) => ({ ...p, romaneio_id: id })))
                .select('id');
            if (pe) throw pe;
            (pd || []).forEach((p, i) => { pedidoIdMap[i] = p.id; });
        }
    }
    if (itens !== undefined && itens.length > 0) {
        const { error: eItens } = await supabase.from('carretas_romaneio_itens')
            .insert(itensPayloadCarretas(itens, id, pedidoIdMap));
        if (eItens) throw eItens;
    }
    return data;
}

export async function deleteRomaneio(id) {
    const { error } = await supabase.from('carretas_romaneios').delete().eq('id', id);
    if (error) throw error;
}

export const STATUS_ROMANEIO = ['Aguardando', 'Carregando', 'Em Trânsito', 'Entrega finalizada', 'Cancelado'];

export const STATUS_ROMANEIO_COLORS = {
    'Aguardando':          { bg: '#FEF9C3', text: '#B45309' },
    'Carregando':          { bg: '#DBEAFE', text: '#1D4ED8' },
    'Em Trânsito':         { bg: '#EDE9FE', text: '#7C3AED' },
    'Entrega finalizada':  { bg: '#D1FAE5', text: '#065F46' },
    'Cancelado':           { bg: '#F3F4F6', text: '#6B7280' },
};

// ═══════════════════════════════════════════════════════════════
// ROMANEIOS DO CARRETEIRO — busca da tabela carretas_romaneios
// ═══════════════════════════════════════════════════════════════

export async function fetchRomaneiosCarreteiro(motoristaId) {
    if (!motoristaId) return [];
    const { data, error } = await supabase
        .from('carretas_romaneios')
        .select(`
            id, numero, status, tipo_carga, data_saida, data_chegada, destino,
            toneladas, empresa, valor_frete, aprovado, observacoes, numero_nf,
            lancado_por_motorista,
            veiculo:veiculo_id(id, placa, modelo),
            carretas_romaneio_itens(id, descricao, quantidade, unidade, peso_total)
        `)
        .eq('motorista_id', motoristaId)
        .order('data_saida', { ascending: false });
    if (error) throw error;
    return data || [];
}
