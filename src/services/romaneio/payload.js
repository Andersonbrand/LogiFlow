import { supabase } from '../supabaseClient';

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

export function buildPayload(r, diariaCriadaEmOverride) {
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
        // Configuração da rota/combustível (posto, diesel, pedágio, resultado do cálculo).
        // Só entra no payload quando informada — não apaga o que já está salvo em outros fluxos.
        ...(r.rota_config !== undefined ? { rota_config: r.rota_config } : {}),
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
export async function ensurePlaca(payload) {
    if (payload.placa || !payload.vehicle_id) return payload;
    const { data } = await supabase.from('vehicles').select('placa').eq('id', payload.vehicle_id).maybeSingle();
    return data?.placa ? { ...payload, placa: data.placa } : payload;
}

// ─── Helpers de numeração compartilhada ───────────────────────────────────────

/** Tenta reusar número já existente (mesmo motorista + destino + data). */
export async function buscarNumeroExistente({ motorista_id, motoristaNome, destino, saida }) {
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
export async function nextNumeroGlobal() {
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
