import { supabase } from '../supabaseClient';
import { buscarNumeroExistente, nextNumeroGlobal, ensurePlaca, buildPayload } from './payload';
import { sincronizarStatusVeiculo } from './veiculo';
import { fetchRomaneioById } from './consulta';

// ── Create ────────────────────────────────────────────────────────────────────
export async function createRomaneio(romaneio, itens = []) {
    // Tenta reaproveitar número existente com mesmo motorista + destino + data
    const numeroExistente = await buscarNumeroExistente({
        motorista_id:  romaneio.motorista_id || null,
        motoristaNome: romaneio.motorista    || null,
        destino:       romaneio.destino,
        saida:         romaneio.saida,
    });
    const numero = numeroExistente || await nextNumeroGlobal();

    // A diária (custo_motorista) é classificada pelo mês em que foi
    // efetivamente lançada, não pela data de saída da viagem (que pode nem
    // estar preenchida ainda) nem pela criação do romaneio em si — se o
    // romaneio já nasce com diária preenchida, esse é o momento do "lançamento".
    const diariaCriadaEm = Number(romaneio.custo_motorista) > 0 ? new Date().toISOString() : null;

    const { data: romData, error } = await supabase.from('romaneios')
        .insert({ ...await ensurePlaca(buildPayload(romaneio, diariaCriadaEm)), numero }).select('id').single();
    if (error) throw error;
    const romId = romData.id;

    // Placa/veículo confirmado neste romaneio → sincroniza o status do veículo automaticamente
    await sincronizarStatusVeiculo(romaneio.vehicle_id, romaneio.placa, romaneio.status || 'Aguardando');

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

// ── Duplicate ─────────────────────────────────────────────────────────────────
export async function duplicateRomaneio(romaneio) {
    const itens = (romaneio.romaneio_itens || []).map(i => ({
        material_id: i.material_id, quantidade: i.quantidade, peso_total: i.peso_total,
        is_telha_zinco: i.is_telha_zinco, comprimento_telha: i.comprimento_telha,
        metros_totais: i.metros_totais, peso_unit: i.peso_unit,
    }));
    const pedidos = (romaneio.romaneio_pedidos || []).map(p => ({
        numero_pedido:    p.numero_pedido,
        cidade_destino:   p.cidade_destino   || '',
        valor_pedido:     p.valor_pedido,
        categoria_frete:  p.categoria_frete,
        percentual_frete: p.percentual_frete,
        empresa:          p.empresa          || 'Comercial Araguaia',
        nome_cliente:     p.nome_cliente     || '',
        nome_vendedor:    p.nome_vendedor    || '',
    }));
    return createRomaneio({
        ...buildPayload(romaneio), status:'Aguardando', saida:null,
        _pedidos: pedidos,
    }, itens);
}

// ── Update ────────────────────────────────────────────────────────────────────
export async function updateRomaneio(id, romaneio, itens) {
    // Guarda o veículo/placa anterior para, se a placa for trocada na edição,
    // liberar o veículo antigo (volta para "Disponível") automaticamente.
    // Também guarda a diária anterior — usada logo abaixo para decidir se
    // `diaria_criada_em` precisa ser (re)gravada nesta edição.
    const { data: romAntes } = await supabase.from('romaneios')
        .select('vehicle_id, placa, custo_motorista, diaria_criada_em, status_aprovacao').eq('id', id).single();

    // ── 0. TRAVA DE SEGURANÇA — nunca apagar pedidos/itens que já existem no
    // banco por causa de um formulário que chegou vazio por engano ──────────
    // Bug real (ago/2026): editar só o campo "motorista" de um romaneio
    // apagou TODOS os pedidos dele, porque em algum momento o formulário
    // chegou aqui com `romaneio._pedidos` vazio mesmo o romaneio já tendo
    // pedidos cadastrados (o form deletava tudo do banco ANTES de reinserir,
    // sem checar se o que ia reinserir fazia sentido). Se isso acontecer de
    // novo — não importa a causa — a gente recusa a operação em vez de
    // apagar dados de verdade. Pra realmente esvaziar os pedidos de um
    // romaneio, é preciso confirmar explicitamente via `permitirEsvaziarPedidos`.
    const pedidosMetaCheck = romaneio._pedidos || [];
    if (pedidosMetaCheck.length === 0 && !romaneio._permitirEsvaziarPedidos) {
        const { count: pedidosAtuais } = await supabase
            .from('romaneio_pedidos')
            .select('id', { count: 'exact', head: true })
            .eq('romaneio_id', id);
        if ((pedidosAtuais || 0) > 0) {
            throw new Error(
                `Este romaneio tem ${pedidosAtuais} pedido(s) cadastrado(s), mas a edição foi enviada sem nenhum pedido. ` +
                `Para proteger os dados, a atualização foi cancelada e nada foi apagado. Feche e reabra o romaneio ` +
                `pra edição (isso costuma resolver quando os pedidos não carregaram corretamente na tela).`
            );
        }
    }

    // ── 1. Pedidos e itens ANTES de atualizar o romaneio ─────────────────────
    // Assim quando o Realtime disparar (após o UPDATE abaixo), o fetch
    // já encontra os dados de pedidos/itens consistentes e não duplica.
    //
    // ORDEM IMPORTA: romaneio_itens.pedido_id tem foreign key para
    // romaneio_pedidos.id. Por isso os ITENS precisam ser apagados ANTES dos
    // PEDIDOS — apagar o pedido enquanto ainda existe um item apontando para
    // ele viola a constraint "romaneio_itens_pedido_id_fkey". Esse erro só
    // passou a aparecer depois que a política de DELETE foi habilitada via
    // RLS; antes disso o DELETE de pedidos era bloqueado silenciosamente e
    // nunca chegava a tentar violar a foreign key.
    //
    // O erro é checado explicitamente em cada etapa. Sem isso, uma falha de
    // RLS/FK seria engolida silenciosamente e os dados "excluídos" continuariam
    // no banco mesmo após salvar.

    // Apaga itens antigos primeiro — os pedidos serão recriados com novos
    // IDs de qualquer forma, então os itens antigos perderiam a referência.
    const { error: delItensErr } = await supabase.from('romaneio_itens').delete().eq('romaneio_id', id);
    if (delItensErr) throw new Error('Falha ao remover itens antigos do romaneio: ' + delItensErr.message);

    // Agora sim, com os itens já removidos, pode apagar os pedidos com segurança
    const { error: delPedidosErr } = await supabase.from('romaneio_pedidos').delete().eq('romaneio_id', id);
    if (delPedidosErr) throw new Error('Falha ao remover pedidos antigos do romaneio: ' + delPedidosErr.message);

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

    // Reinsere itens, vinculando ao novo pedido_id quando aplicável
    if (itens !== undefined && itens.length > 0) {
        const { error: ie } = await supabase.from('romaneio_itens').insert(
            itens.map(i => ({
                romaneio_id: id,
                material_id: i.material_id,
                quantidade:  i.quantidade,
                peso_total:  i.peso_total,
                pedido_id:   pedidoIdMap[i.pedido_index] || null,
                is_telha_zinco:    i.is_telha_zinco || false,
                comprimento_telha: i.comprimento_telha != null ? Number(i.comprimento_telha) : null,
                metros_totais:     i.metros_totais != null ? Number(i.metros_totais) : null,
                peso_unit:         i.peso_unit != null ? Number(i.peso_unit) : null,
            }))
        );
        if (ie) throw ie;
    }

    // ── 2. Atualiza o romaneio por último — Realtime só dispara aqui ──────────
    // `diaria_criada_em` só é gravada na transição de vazio/zero → >0 (ou seja,
    // no exato momento em que a diária é lançada) e nunca mais tocada depois
    // disso — a não ser que a diária seja zerada, aí sim é recalculada da
    // próxima vez que for preenchida novamente.
    const custoAntes = Number(romAntes?.custo_motorista || 0);
    const custoDepois = Number(romaneio.custo_motorista || 0);
    let diariaCriadaEm;
    if (custoDepois <= 0) {
        diariaCriadaEm = null; // diária zerada — limpa para recalcular no próximo lançamento
    } else if (custoAntes <= 0) {
        // Diária estava zerada e agora foi preenchida — isso É o lançamento,
        // mesmo que reste uma diaria_criada_em antiga (de uma diária anterior
        // já zerada) no registro; sempre sobrescreve nesse caso.
        diariaCriadaEm = new Date().toISOString(); // acabou de ser lançada agora
    } else {
        diariaCriadaEm = romAntes?.diaria_criada_em || new Date().toISOString(); // mantém a data já gravada
    }

    // Romaneio reprovado que foi editado ("Editar e reenviar"): volta para a fila de
    // aprovação do admin. Sem isso ele continuava 'reprovado' e nunca aparecia como pendente.
    const reenviar = romAntes?.status_aprovacao === 'reprovado'
        ? { aprovado: false, status_aprovacao: 'pendente', aprovado_por: null, aprovado_em: null, motivo_reprovacao: null }
        : {};
    const { error } = await supabase.from('romaneios').update({ ...(await ensurePlaca(buildPayload(romaneio, diariaCriadaEm))), ...reenviar }).eq('id', id);
    if (error) throw error;

    // Placa/veículo confirmado (ou trocado) neste romaneio → sincroniza status automaticamente
    await sincronizarStatusVeiculo(romaneio.vehicle_id, romaneio.placa, romaneio.status || 'Aguardando');

    // Se a placa/veículo foi trocada na edição, libera o veículo anterior
    const placaAntes  = (romAntes?.placa || '').trim().toLowerCase();
    const placaDepois = (romaneio.placa  || '').trim().toLowerCase();
    const vehicleIdMudou = romAntes?.vehicle_id && romaneio.vehicle_id && romAntes.vehicle_id !== romaneio.vehicle_id;
    const placaMudou     = placaAntes && placaDepois && placaAntes !== placaDepois;
    if (vehicleIdMudou || placaMudou) {
        try {
            if (romAntes.vehicle_id) {
                await supabase.from('vehicles').update({ status: 'Disponível' }).eq('id', romAntes.vehicle_id);
            } else if (romAntes.placa) {
                await supabase.from('vehicles').update({ status: 'Disponível' }).ilike('placa', romAntes.placa.trim());
            }
        } catch (_) {}
    }

    return fetchRomaneioById(id);
}

// ── Delete ────────────────────────────────────────────────────────────────────
export async function deleteRomaneio(id) {
    // Guarda veículo/placa para liberar (voltar a "Disponível") após excluir
    const { data: romAntes } = await supabase.from('romaneios')
        .select('vehicle_id, placa').eq('id', id).single();

    // Apaga registros dependentes antes (respeita foreign key constraints)
    await supabase.from('notifications').delete().eq('romaneio_id', id);
    const { error: itensErr } = await supabase.from('romaneio_itens').delete().eq('romaneio_id', id);
    if (itensErr) throw new Error('Falha ao remover itens do romaneio: ' + itensErr.message);
    const { error: pedidosErr } = await supabase.from('romaneio_pedidos').delete().eq('romaneio_id', id);
    if (pedidosErr) throw new Error('Falha ao remover pedidos do romaneio: ' + pedidosErr.message);
    const { error } = await supabase.from('romaneios').delete().eq('id', id);
    if (error) throw error;

    if (romAntes?.vehicle_id) {
        await supabase.from('vehicles').update({ status: 'Disponível' }).eq('id', romAntes.vehicle_id);
    } else if (romAntes?.placa) {
        await supabase.from('vehicles').update({ status: 'Disponível' }).ilike('placa', romAntes.placa.trim());
    }
}
