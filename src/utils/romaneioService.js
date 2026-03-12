import { supabase } from './supabaseClient';

// Mapa de status do romaneio → status do veículo
const STATUS_VEICULO = {
    'Em Trânsito': 'Em Trânsito',
    'Carregando':  'Em Trânsito',
    'Aguardando':  'Disponível',
    'Finalizado':  'Disponível',
    'Cancelado':   'Disponível',
};

// ── Fetch ─────────────────────────────────────────────────────────────────────
export async function fetchRomaneios() {
    const { data, error } = await supabase
        .from('romaneios')
        .select(`
            id, numero, motorista, motorista_id, placa, destino, status,
            aprovado, aprovado_por, aprovado_em, status_aprovacao, motivo_reprovacao,
            peso_total, saida, observacoes, vehicle_id,
            distancia_km, custo_combustivel, custo_pedagio,
            custo_motorista, valor_frete, valor_frete_calculado,
            valor_total_carga, created_at,
            romaneio_pedidos(id, numero_pedido, cidade_destino, valor_pedido, categoria_frete, percentual_frete, frete_calculado),
            romaneio_itens(id, quantidade, peso_total, material_id, pedido_id,
                materials(id, nome, unidade, peso, categoria_frete, percentual_frete))
        `)
        .order('created_at', { ascending: false })
        .limit(200);
    if (error) throw error;
    return (data || []).map(addMargem);
}

export async function fetchRomaneioById(id) {
    const { data, error } = await supabase
        .from('romaneios')
        .select(`
            id, numero, motorista, placa, destino, status,
            peso_total, saida, observacoes, vehicle_id,
            distancia_km, custo_combustivel, custo_pedagio,
            custo_motorista, valor_frete, valor_frete_calculado,
            valor_total_carga, created_at,
            romaneio_pedidos(id, numero_pedido, cidade_destino, valor_pedido, categoria_frete, percentual_frete, frete_calculado),
            romaneio_itens(id, quantidade, peso_total, material_id, pedido_id,
                materials(id, nome, unidade, peso, categoria_frete, percentual_frete))
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

// ── Autocomplete ──────────────────────────────────────────────────────────────
export async function fetchMotoristas() {
    const { data } = await supabase.from('romaneios').select('motorista').not('motorista','is',null);
    return [...new Set((data||[]).map(r=>r.motorista).filter(Boolean))].sort();
}
export async function fetchDestinos() {
    const { data } = await supabase.from('romaneios').select('destino').not('destino','is',null);
    return [...new Set((data||[]).map(r=>r.destino).filter(Boolean))].sort();
}

// ── Build payload ─────────────────────────────────────────────────────────────
// Converte datetime-local (ex: "2026-03-09T02:00") para ISO UTC
// O input datetime-local retorna horário local do browser sem timezone
// Supabase armazena em UTC — sem conversão fica 3h adiantado (fuso Brasília UTC-3)
function localDatetimeToUTC(str) {
    if (!str) return null;
    // Se já tem timezone (ex: 'Z' ou '+00:00'), usa direto
    if (str.includes('Z') || str.includes('+') || (str.length > 19 && str[19] === '-')) {
        return new Date(str).toISOString();
    }
    // Trata como horário local de Brasília (UTC-3) e converte para UTC
    const local = new Date(str);
    if (isNaN(local.getTime())) return null;
    return local.toISOString();
}

function buildPayload(r) {
    return {
        motorista:              r.motorista              || null,
        placa:                  r.placa                  || null,
        destino:                r.destino                || null,
        status:                 r.status                 || 'Aguardando',
        peso_total:             r.peso_total             || 0,
        saida:                  localDatetimeToUTC(r.saida),
        observacoes:            r.observacoes            || null,
        distancia_km:           r.distancia_km           || 0,
        custo_combustivel:      r.custo_combustivel      || 0,
        custo_pedagio:          r.custo_pedagio          || 0,
        custo_motorista:        r.custo_motorista        || 0,
        valor_frete:            r.valor_frete            || 0,
        valor_frete_calculado:  r.valor_frete_calculado  || 0,
        valor_total_carga:      r.valor_total_carga      || 0,
        ...(r.vehicle_id ? { vehicle_id: r.vehicle_id } : {}),
    };
}

// ── Create ────────────────────────────────────────────────────────────────────
export async function createRomaneio(romaneio, itens = []) {
    const year  = new Date().getFullYear();
    const { count } = await supabase.from('romaneios').select('*', { count:'exact', head:true });
    const numero = `ROM-${year}-${String((count||0)+1).padStart(4,'0')}`;

    const { data: romData, error } = await supabase.from('romaneios')
        .insert({ ...buildPayload(romaneio), numero }).select('id').single();
    if (error) throw error;
    const romId = romData.id;

    // Save pedidos and get back their IDs
    const pedidoIdMap = {}; // pedido_index -> real DB id
    const pedidosMeta = romaneio._pedidos || [];
    if (pedidosMeta.length > 0) {
        const { data: pedidosData, error: pe } = await supabase
            .from('romaneio_pedidos')
            .insert(pedidosMeta.map(p => ({ ...p, romaneio_id: romId })))
            .select('id');
        if (pe) throw pe;
        (pedidosData || []).forEach((p, i) => { pedidoIdMap[i] = p.id; });
    }

    // Save itens, linking to pedido when available
    if (itens.length > 0) {
        const { error: ie } = await supabase.from('romaneio_itens').insert(
            itens.map(i => ({
                romaneio_id: romId,
                material_id: i.material_id,
                quantidade:  i.quantidade,
                peso_total:  i.peso_total,
                pedido_id:   pedidoIdMap[i.pedido_index] || null,
            }))
        );
        if (ie) throw ie;
    }
    return fetchRomaneioById(romId);
}

// ── Duplicate ─────────────────────────────────────────────────────────────────
export async function duplicateRomaneio(romaneio) {
    const itens = (romaneio.romaneio_itens || []).map(i => ({
        material_id: i.material_id, quantidade: i.quantidade, peso_total: i.peso_total,
    }));
    const pedidos = (romaneio.romaneio_pedidos || []).map(p => ({
        numero_pedido: p.numero_pedido, valor_pedido: p.valor_pedido,
        categoria_frete: p.categoria_frete, percentual_frete: p.percentual_frete,
    }));
    return createRomaneio({
        ...buildPayload(romaneio), status:'Aguardando', saida:null,
        _pedidos: pedidos,
    }, itens);
}

// ── Update ────────────────────────────────────────────────────────────────────
export async function updateRomaneio(id, romaneio, itens) {
    const { error } = await supabase.from('romaneios').update(buildPayload(romaneio)).eq('id', id);
    if (error) throw error;

    // Replace pedidos
    await supabase.from('romaneio_pedidos').delete().eq('romaneio_id', id);
    const pedidoIdMap = {};
    const pedidosMeta = romaneio._pedidos || [];
    if (pedidosMeta.length > 0) {
        const { data: pd, error: pe } = await supabase.from('romaneio_pedidos')
            .insert(pedidosMeta.map(p => ({ ...p, romaneio_id: id }))).select('id');
        if (pe) throw pe;
        (pd||[]).forEach((p, i) => { pedidoIdMap[i] = p.id; });
    }

    if (itens !== undefined) {
        await supabase.from('romaneio_itens').delete().eq('romaneio_id', id);
        if (itens.length > 0) {
            const { error: ie } = await supabase.from('romaneio_itens').insert(
                itens.map(i => ({
                    romaneio_id: id,
                    material_id: i.material_id,
                    quantidade:  i.quantidade,
                    peso_total:  i.peso_total,
                    pedido_id:   pedidoIdMap[i.pedido_index] || null,
                }))
            );
            if (ie) throw ie;
        }
    }
    return fetchRomaneioById(id);
}

// ── Status update ─────────────────────────────────────────────────────────────
export async function updateRomaneioStatus(id, status) {
    const { data, error } = await supabase.from('romaneios')
        .update({ status }).eq('id', id).select('id, status, vehicle_id, placa').single();
    if (error) throw error;

    // Sincronizar status do veículo automaticamente
    const novoStatusVeiculo = STATUS_VEICULO[status];
    if (novoStatusVeiculo) {
        try {
            if (data.vehicle_id) {
                await supabase.from('vehicles')
                    .update({ status: novoStatusVeiculo })
                    .eq('id', data.vehicle_id);
            } else if (data.placa) {
                await supabase.from('vehicles')
                    .update({ status: novoStatusVeiculo })
                    .eq('placa', data.placa);
            }
        } catch (_) {}
    }

    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) await supabase.from('notifications').insert({
            user_id: user.id, tipo:'status_change',
            titulo:'Status atualizado',
            mensagem:`Romaneio atualizado para "${status}"`,
            romaneio_id: id,
        });
    } catch (_) {}
    return data;
}

// ── Delete ────────────────────────────────────────────────────────────────────
export async function deleteRomaneio(id) {
    await supabase.from('romaneio_itens').delete().eq('romaneio_id', id);
    await supabase.from('romaneio_pedidos').delete().eq('romaneio_id', id);
    const { error } = await supabase.from('romaneios').delete().eq('id', id);
    if (error) throw error;
}

// ── Aprovação de romaneios ────────────────────────────────────────────────────
export async function aprovarRomaneio(id, adminId) {
    const { data, error } = await supabase
        .from('romaneios')
        .update({
            aprovado: true,
            status_aprovacao: 'aprovado',
            aprovado_por: adminId,
            aprovado_em: new Date().toISOString(),
        })
        .eq('id', id)
        .select().single();
    if (error) throw error;
    return data;
}

export async function reprovarRomaneio(id, adminId, motivo = '') {
    const { data, error } = await supabase
        .from('romaneios')
        .update({
            aprovado: false,
            status_aprovacao: 'reprovado',
            aprovado_por: adminId,
            aprovado_em: new Date().toISOString(),
            motivo_reprovacao: motivo,
        })
        .eq('id', id)
        .select().single();
    if (error) throw error;
    return data;
}

export async function fetchRomaneiosPorMotorista(motoristaId) {
    const { data, error } = await supabase
        .from('romaneios')
        .select(`
            id, numero, motorista, motorista_id, placa, destino, status,
            aprovado, aprovado_em, peso_total, saida, created_at,
            romaneio_itens(id, quantidade, peso_total, material_id,
                materials(id, nome, unidade, peso, categoria_frete))
        `)
        .eq('motorista_id', motoristaId)
        .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
}
