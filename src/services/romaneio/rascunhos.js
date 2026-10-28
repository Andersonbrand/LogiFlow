import { supabase } from '../supabaseClient';
import { ensurePlaca, buildPayload, nextNumeroGlobal } from './payload';
import { fetchRomaneioById } from './consulta';
import { sincronizarStatusVeiculo } from './veiculo';

// ─────────────────────────────────────────────────────────────────────────────
// RASCUNHOS DE ROMANEIO
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchRascunhos() {
    const { data, error } = await supabase
        .from('romaneios')
        .select(`
            id, numero, motorista, motorista_id, placa, destino, status,
            peso_total, saida, chegada, observacoes, vehicle_id,
            valor_frete, valor_frete_calculado, valor_total_carga,
            is_rascunho, sugestao_veiculo, created_at,
            romaneio_pedidos(id, numero_pedido, cidade_destino, valor_pedido, categoria_frete, categorias_extra, percentual_frete, frete_calculado, empresa, nome_cliente, nome_vendedor, observacao),
            romaneio_itens(id, quantidade, peso_total, material_id, pedido_id,
                is_telha_zinco, comprimento_telha, metros_totais, peso_unit,
                materials(id, nome, unidade, peso, categoria_frete, percentual_frete, is_telha_zinco, peso_base_metro))
        `)
        .eq('is_rascunho', true)
        .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
}

export async function createRascunho(romaneio, itens = []) {
    const numero = 'RASC-' + Date.now();
    // Mesma lógica do createRomaneio: se o rascunho já nasce com diária
    // preenchida, esse é o momento do lançamento. Sem isso, diaria_criada_em
    // ficava sempre NULL para rascunhos — e ao promover para romaneio oficial
    // (promoverRascunho não mexe nessa coluna) a diária caía no mês do
    // created_at do rascunho em vez do mês em que foi realmente lançada.
    const diariaCriadaEm = Number(romaneio.custo_motorista) > 0 ? new Date().toISOString() : null;
    const payload = await ensurePlaca({
        ...buildPayload(romaneio, diariaCriadaEm),
        numero,
        status:      'Rascunho',
        is_rascunho: true,
        sugestao_veiculo: romaneio.sugestao_veiculo || null,
    });
    const { data: romData, error } = await supabase
        .from('romaneios').insert(payload).select('id').single();
    if (error) throw error;
    const romId = romData.id;

    const pedidosMeta = romaneio._pedidos || [];
    const pedidoIdMap = {};
    if (pedidosMeta.length > 0) {
        const { data: pd, error: pe } = await supabase
            .from('romaneio_pedidos')
            .insert(pedidosMeta.map(p => ({ ...p, romaneio_id: romId })))
            .select('id');
        if (pe) throw pe;
        (pd || []).forEach((p, i) => { pedidoIdMap[i] = p.id; });
    }
    if (itens.length > 0) {
        const { error: ie } = await supabase.from('romaneio_itens').insert(
            itens.map(i => ({
                romaneio_id: romId,
                material_id: i.material_id || null,
                quantidade:  Number(i.quantidade) || 1,
                peso_total:  i.peso_total != null ? Number(i.peso_total) : null,
                pedido_id:   pedidoIdMap[i.pedido_index] ?? null,
                is_telha_zinco:    i.is_telha_zinco || false,
                comprimento_telha: i.comprimento_telha != null ? Number(i.comprimento_telha) : null,
                metros_totais:     i.metros_totais != null ? Number(i.metros_totais) : null,
                peso_unit:         i.peso_unit != null ? Number(i.peso_unit) : null,
            }))
        );
        if (ie) throw ie;
    }
    return fetchRomaneioById(romId);
}

export async function updateRascunho(id, romaneio, itens) {
    // Guarda a diária anterior do rascunho — mesma lógica de transição usada
    // em updateRomaneio — para saber se diaria_criada_em precisa ser
    // (re)gravada nesta edição.
    const { data: romAntes } = await supabase.from('romaneios')
        .select('custo_motorista, diaria_criada_em').eq('id', id).single();

    // Mesma ordem de updateRomaneio: itens (filhos) antes de pedidos (pais),
    // pois romaneio_itens.pedido_id referencia romaneio_pedidos.id.
    const { error: delItensErr } = await supabase.from('romaneio_itens').delete().eq('romaneio_id', id);
    if (delItensErr) throw new Error('Falha ao remover itens antigos do rascunho: ' + delItensErr.message);

    const { error: delPedidosErr } = await supabase.from('romaneio_pedidos').delete().eq('romaneio_id', id);
    if (delPedidosErr) throw new Error('Falha ao remover pedidos antigos do rascunho: ' + delPedidosErr.message);

    const pedidoIdMap = {};
    const pedidosMeta = romaneio._pedidos || [];
    if (pedidosMeta.length > 0) {
        // Remove o campo `id` para evitar conflito com registros antigos após o DELETE
        const { data: pd, error: pe } = await supabase
            .from('romaneio_pedidos')
            .insert(pedidosMeta.map(({ id: _omit, ...p }) => ({ ...p, romaneio_id: id })))
            .select('id');
        if (pe) throw pe;
        (pd || []).forEach((p, i) => { pedidoIdMap[i] = p.id; });
    }
    if (itens !== undefined && itens.length > 0) {
        const { error: ie } = await supabase.from('romaneio_itens').insert(
            itens.map(i => ({
                romaneio_id: id,
                material_id: i.material_id || null,
                quantidade:  Number(i.quantidade) || 1,
                peso_total:  i.peso_total != null ? Number(i.peso_total) : null,
                pedido_id:   pedidoIdMap[i.pedido_index] ?? null,
                is_telha_zinco:    i.is_telha_zinco || false,
                comprimento_telha: i.comprimento_telha != null ? Number(i.comprimento_telha) : null,
                metros_totais:     i.metros_totais != null ? Number(i.metros_totais) : null,
                peso_unit:         i.peso_unit != null ? Number(i.peso_unit) : null,
            }))
        );
        if (ie) throw ie;
    }
    const custoAntes = Number(romAntes?.custo_motorista || 0);
    const custoDepois = Number(romaneio.custo_motorista || 0);
    let diariaCriadaEm;
    if (custoDepois <= 0) {
        diariaCriadaEm = null; // diária zerada — limpa para recalcular no próximo lançamento
    } else if (custoAntes <= 0) {
        diariaCriadaEm = new Date().toISOString(); // acabou de ser lançada agora
    } else {
        diariaCriadaEm = romAntes?.diaria_criada_em || new Date().toISOString(); // mantém a data já gravada
    }

    const { error } = await supabase.from('romaneios').update(await ensurePlaca({
        ...buildPayload(romaneio, diariaCriadaEm),
        sugestao_veiculo: romaneio.sugestao_veiculo || null,
    })).eq('id', id);
    if (error) throw error;
    return fetchRomaneioById(id);
}

export async function deleteRascunho(id) {
    // Apaga dependentes na ordem correta (filho antes do pai) para não
    // violar as foreign key constraints:
    //   romaneio_itens.pedido_id  → romaneio_pedidos.id  (CASCADE adicionado em 20260619)
    //   romaneio_pedidos.romaneio_id → romaneios.id      (constraint original)
    const { error: itensErr } = await supabase.from('romaneio_itens').delete().eq('romaneio_id', id);
    if (itensErr) throw new Error('Falha ao remover itens do rascunho: ' + itensErr.message);
    const { error: pedidosErr } = await supabase.from('romaneio_pedidos').delete().eq('romaneio_id', id);
    if (pedidosErr) throw new Error('Falha ao remover pedidos do rascunho: ' + pedidosErr.message);
    const { error } = await supabase.from('romaneios').delete().eq('id', id);
    if (error) throw error;
}

export async function promoverRascunho(id) {
    const numero = await nextNumeroGlobal();

    // Rede de segurança: se o rascunho já tem diária lançada (custo_motorista
    // > 0) mas diaria_criada_em ainda está NULL — caso de rascunhos criados
    // antes desta correção, ou qualquer outro caminho que tenha deixado a
    // coluna vazia — grava agora, na promoção, em vez de deixar a exibição
    // cair no fallback (saida/created_at) e classificar a diária no mês
    // errado. Se diaria_criada_em já estiver preenchida, não mexe nela.
    const { data: romAtual } = await supabase.from('romaneios')
        .select('custo_motorista, diaria_criada_em, vehicle_id, placa').eq('id', id).single();
    const precisaDiariaCriadaEm = Number(romAtual?.custo_motorista || 0) > 0 && !romAtual?.diaria_criada_em;
    // Mesma lacuna do placa: um rascunho pode ter recebido vehicle_id (ex.:
    // sugestão de veículo aceita) sem nunca preencher o texto `placa` usado
    // nas telas de listagem/detalhe.
    const placaFaltando = !romAtual?.placa && romAtual?.vehicle_id
        ? (await ensurePlaca({ vehicle_id: romAtual.vehicle_id })).placa
        : null;

    const { data, error } = await supabase
        .from('romaneios')
        .update({
            numero, is_rascunho: false, status: 'Aguardando',
            ...(precisaDiariaCriadaEm ? { diaria_criada_em: new Date().toISOString() } : {}),
            ...(placaFaltando ? { placa: placaFaltando } : {}),
        })
        .eq('id', id)
        .select('id, vehicle_id, placa')
        .single();
    if (error) throw error;

    // Placa confirmada ao promover o rascunho para romaneio oficial → sincroniza veículo
    await sincronizarStatusVeiculo(data?.vehicle_id, data?.placa, 'Aguardando');

    return fetchRomaneioById(id);
}
