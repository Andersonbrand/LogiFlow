import { supabase } from './supabaseClient';
import { normalizarCidadeBA } from './cidadeUtils';

// Mapa de status do romaneio → status do veículo
const STATUS_VEICULO = {
    'Em Trânsito': 'Em Trânsito',
    'Carregando':  'Em Trânsito',
    'Aguardando':  'Disponível',
    'Finalizado':  'Disponível',
    'Cancelado':   'Disponível',
};

// Helper: sincroniza status do veículo no banco
export async function sincronizarStatusVeiculo(vehicleId, placa, statusRomaneio) {
    const novoStatus = STATUS_VEICULO[statusRomaneio];
    if (!novoStatus) return;
    try {
        if (vehicleId) {
            await supabase.from('vehicles').update({ status: novoStatus }).eq('id', vehicleId);
        } else if (placa) {
            await supabase.from('vehicles').update({ status: novoStatus })
                .ilike('placa', placa.trim()); // ilike = case-insensitive
        }
    } catch (_) {}
}

// ── Fetch ─────────────────────────────────────────────────────────────────────
export async function fetchRomaneios() {
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
            valor_total_carga, created_at,
            romaneio_pedidos(id, numero_pedido, cidade_destino, valor_pedido, categoria_frete, categorias_extra, percentual_frete, frete_calculado, empresa, nome_cliente, nome_vendedor, observacao),
            romaneio_itens(id, quantidade, peso_total, material_id, pedido_id,
                is_telha_zinco, comprimento_telha, metros_totais, peso_unit,
                materials(id, nome, unidade, peso, categoria_frete, percentual_frete, is_telha_zinco, peso_base_metro))
        `)
        .eq('is_rascunho', false)
        .order('created_at', { ascending: false })
        .limit(200);
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
export async function fetchRomaneiosResumo() {
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
            valor_total_carga, created_at
        `)
        .eq('is_rascunho', false)
        .order('created_at', { ascending: false })
        .limit(200);
    if (error) { console.error('[romaneioService] fetchRomaneiosResumo error:', error); throw error; }
    console.log('[romaneioService] fetchRomaneiosResumo retornou:', (data||[]).length, 'registros');
    return (data || []).map(addMargem);
}

export async function fetchRomaneioById(id) {
    const { data, error } = await supabase
        .from('romaneios')
        .select(`
            id, numero, motorista, placa, destino, status,
            peso_total, saida, chegada, observacoes, vehicle_id,
            distancia_km, custo_combustivel, custo_pedagio,
            custo_motorista, dias_diaria, valor_diaria_dia, diaria_descricao, diaria_criada_em, diaria_mes_referencia,
            assinatura_diaria_logistica, assinatura_diaria_logistica_at, assinatura_diaria_transporte, assinatura_diaria_transporte_at,
            valor_frete, valor_frete_calculado,
            valor_total_carga, created_at,
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

// ── Autocomplete ──────────────────────────────────────────────────────────────
export async function fetchMotoristas() {
    // Retorna lista de nomes únicos dos romaneios existentes (autocomplete)
    const { data } = await supabase.from('romaneios').select('motorista').not('motorista','is',null);
    return [...new Set((data||[]).map(r=>r.motorista).filter(Boolean))].sort();
}

// Retorna motoristas com UUID — usado para vincular motorista_id ao criar romaneio
export async function fetchMotoristasComId() {
    const { data } = await supabase
        .from('user_profiles')
        .select('id, name, tipo_veiculo')
        .eq('role', 'motorista')          // apenas motoristas de caminhão
        .neq('tipo_veiculo', 'carreta')   // exclui motoristas de carreta
        .order('name');
    return data || [];
}
// Cidades cadastradas oficialmente no LogiFlow (cadastro de Fretes por Cidade
// do módulo de Carretas — `carretas_fretes`), não mais um histórico de textos
// já digitados em romaneios anteriores. Mantém isso uniforme com o resto do
// sistema. Como o cadastro guarda só o nome da cidade (sem UF), adiciona
// ", BA" — todas essas cidades são da região de atuação (Bahia) — pra manter
// o mesmo formato "Cidade, UF" que o cálculo de rota por IA já usava e
// precisa pra geocodificar com precisão.
export async function fetchDestinos() {
    const { data, error } = await supabase
        .from('carretas_fretes')
        .select('cidade')
        .not('cidade', 'is', null);
    if (error) throw error;
    const nomes = [...new Set((data || []).map(r => (r.cidade || '').trim()).filter(Boolean))];
    // Padroniza todas: sem parênteses e sempre terminando em ", BA" — nunca some
    // exceção, senão o cálculo de rota da IA integrada fica impreciso.
    return [...new Set(nomes.map(c => normalizarCidadeBA(c)))]
        .sort((a, b) => a.localeCompare(b, 'pt-BR'));
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

function buildPayload(r, diariaCriadaEmOverride) {
    return {
        motorista:              r.motorista              || null,
        motorista_id:           r.motorista_id           || null,
        placa:                  r.placa                  || null,
        destino:                r.destino                || null,
        status:                 r.status                 || 'Aguardando',
        peso_total:             r.peso_total             || 0,
        saida:                  localDatetimeToUTC(r.saida),
        chegada:                localDatetimeToUTC(r.chegada),
        observacoes:            r.observacoes            || null,
        paradas:                r.paradas                ?? null,
        distancia_km:           r.distancia_km           || 0,
        custo_combustivel:      r.custo_combustivel      || 0,
        custo_pedagio:          r.custo_pedagio          || 0,
        custo_motorista:        r.custo_motorista        || 0,
        dias_diaria:            r.dias_diaria            || null,
        valor_diaria_dia:       r.valor_diaria_dia        || null,
        diaria_descricao:       r.diaria_descricao        || null,
        diaria_mes_referencia:  r.diaria_mes_referencia    || null,
        valor_frete:            r.valor_frete            || 0,
        valor_frete_calculado:  r.valor_frete_calculado  || 0,
        valor_total_carga:      r.valor_total_carga      || 0,
        ...(r.vehicle_id ? { vehicle_id: r.vehicle_id } : {}),
        ...(diariaCriadaEmOverride !== undefined ? { diaria_criada_em: diariaCriadaEmOverride } : {}),
    };
}

/**
 * Garante que `placa` esteja preenchida sempre que `vehicle_id` estiver.
 * Vários fluxos (rascunho sem veículo definido na hora, sugestão automática
 * de veículo aceita depois, veículo trocado numa edição rápida, etc.) só
 * gravam `vehicle_id` — e o texto `placa` (usado direto pelas telas de
 * listagem/detalhe) ficava desatualizado ou vazio. Busca a placa do veículo
 * quando falta, sem sobrescrever uma placa já preenchida manualmente.
 */
async function ensurePlaca(payload) {
    if (payload.placa || !payload.vehicle_id) return payload;
    const { data } = await supabase.from('vehicles').select('placa').eq('id', payload.vehicle_id).maybeSingle();
    return data?.placa ? { ...payload, placa: data.placa } : payload;
}

// ─── Helpers de numeração compartilhada ───────────────────────────────────────

/** Tenta reusar número já existente (mesmo motorista + destino + data). */
async function buscarNumeroExistente({ motorista_id, motoristaNome, destino, saida }) {
    if (!destino || !saida) return null;
    const destinoNorm = (destino || '').trim().toLowerCase();
    const dataStr     = (saida || '').substring(0, 10);

    // Busca na tabela romaneios (admin)
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

    // Busca na tabela carretas_romaneios (motorista carreteiro)
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

    return null;
}

/** Gera próximo número sequencial, considerando apenas a tabela própria (`romaneios`).
 *  Exclui rascunhos (is_rascunho=true) e números RASC-* para não poluir a sequência.
 *  item 5: sequência independente da usada pelo módulo de carretas. */
async function nextNumeroGlobal() {
    // Filtra apenas números no formato ROM-XXX para não poluir a sequência
    // com números de pedido ou timestamps gravados por registros de motoristas.
    const isRomNum = (str) => typeof str === 'string' && /^ROM-/i.test(str.trim());
    const parseNum = (str) => isRomNum(str) ? (parseInt(str.replace(/\D/g, ''), 10) || 0) : 0;

    const { data: rowsAdmin } = await supabase
        .from('romaneios').select('numero').eq('is_rascunho', false).not('numero', 'is', null);
    const nums = (rowsAdmin || []).map(r => parseNum(r.numero)).filter(n => n > 0);
    const maxN = nums.length > 0 ? Math.max(...nums) : 0;
    return `ROM-${String(maxN + 1).padStart(3, '0')}`;
}

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
        .select('vehicle_id, placa, custo_motorista, diaria_criada_em').eq('id', id).single();

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

    const { error } = await supabase.from('romaneios').update(await ensurePlaca(buildPayload(romaneio, diariaCriadaEm))).eq('id', id);
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
                    .ilike('placa', data.placa.trim()); // ilike = case-insensitive
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

// Assina digitalmente a diária gerada automaticamente pelo romaneio (caminhões)
// como responsável (admin ou operador).
// `assinanteRole` (role do usuário no momento da assinatura: 'admin' | 'operador')
// define em qual campo da ficha impressa o nome aparece — Transporte (admin) ou
// Logística (operador). É guardado à parte do id porque o cargo do usuário pode
// mudar depois, e isso não deve alterar retroativamente uma diária já assinada.
export async function assinarDiariaRomaneio(id, campo, assinaturaTexto, assinanteId = null) {
    if (!['logistica', 'transporte'].includes(campo)) throw new Error('Campo de assinatura inválido');
    const { data, error } = await supabase
        .from('romaneios')
        .update({
            [`assinatura_diaria_${campo}`]: assinaturaTexto,
            [`assinatura_diaria_${campo}_at`]: new Date().toISOString(),
            [`assinatura_diaria_${campo}_por`]: assinanteId,
        })
        .eq('id', id)
        .select('id, numero, assinatura_diaria_logistica, assinatura_diaria_logistica_at, assinatura_diaria_transporte, assinatura_diaria_transporte_at')
        .single();
    if (error) throw error;
    return data;
}

// Remove a assinatura digital da diária gerada pelo romaneio, voltando ao
// estado "sem assinatura" (ação reservada a administradores na UI).
export async function desassinarDiariaRomaneio(id, campo) {
    if (!['logistica', 'transporte'].includes(campo)) throw new Error('Campo de assinatura inválido');
    const { data, error } = await supabase
        .from('romaneios')
        .update({
            [`assinatura_diaria_${campo}`]: null,
            [`assinatura_diaria_${campo}_at`]: null,
            [`assinatura_diaria_${campo}_por`]: null,
        })
        .eq('id', id)
        .select('id, numero, assinatura_diaria_logistica, assinatura_diaria_logistica_at, assinatura_diaria_transporte, assinatura_diaria_transporte_at')
        .single();
    if (error) throw error;
    return data;
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
