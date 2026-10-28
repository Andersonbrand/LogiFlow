import { supabase } from '../supabaseClient';
import { nextRomaneioNumero } from './romaneios';

// ═══════════════════════════════════════════════════════════════
// ROMANEIO DE FERRAGENS — registrado pelo próprio motorista
// ═══════════════════════════════════════════════════════════════

export async function createRomaneioFerragem(payload) {
    const {
        numero_romaneio, // número ROM informado pelo motorista (opcional)
        ...rest
    } = payload;

    // ── Caso 1: motorista informou um número de romaneio existente ────────────
    if (numero_romaneio?.trim()) {
        const numeroNorm = numero_romaneio.trim().toUpperCase();
        const { data: rowsExist } = await supabase
            .from('carretas_romaneios')
            .select('id, numero, tipo_carga, motorista_id')
            .eq('numero', numeroNorm)
            .limit(1);
        const existente = rowsExist?.[0] ?? null;

        if (existente) {
            // Romaneio já existe → vincula os dados do motorista a ele
            const { data, error } = await supabase
                .from('carretas_romaneios')
                .update({
                    numero_nf:   rest.numero_nf,
                    data_saida:  rest.data_saida,
                    veiculo_id:  rest.veiculo_id,
                    destino:     rest.destino     || existente.destino,
                    toneladas:   rest.toneladas   ?? null,
                    empresa:     rest.empresa     ?? null,
                    observacoes: rest.observacoes ?? null,
                    motorista_id: rest.motorista_id || existente.motorista_id,
                    tipo_carga:  'ferragem',
                    lancado_por_motorista: true,
                    ...(rest.paradas ? { paradas: rest.paradas } : {}),
                })
                .eq('id', existente.id)
                .select()
                .single();
            if (error) throw error;
            return data;
        }

        // Número informado mas não existe → cria com esse número
        const { data, error } = await supabase
            .from('carretas_romaneios')
            .insert({
                ...rest,
                numero: numeroNorm,
                tipo_carga: 'ferragem',
                status: 'Aguardando',
                lancado_por_motorista: true,
            })
            .select()
            .maybeSingle();
        if (error) throw error;
        if (!data) throw new Error('Registro bloqueado por política de acesso. Execute a migration fix_rls_motorista_ferragem.sql no Supabase.');
        return data;
    }

    // ── Caso 2: motorista não informou número → gera sequencial ──────────────
    let numero = await nextRomaneioNumero();
    // Garante unicidade contra race condition
    for (let t = 0; t < 5; t++) {
        const { data: existe } = await supabase
            .from('carretas_romaneios')
            .select('id')
            .eq('numero', numero)
            .limit(1)
            .maybeSingle();
        if (!existe) break;
        await new Promise(r => setTimeout(r, 120));
        numero = await nextRomaneioNumero();
    }

    const { data, error } = await supabase
        .from('carretas_romaneios')
        .insert({
            ...rest,
            numero,
            tipo_carga: 'ferragem',
            status: 'Aguardando',
            lancado_por_motorista: true,
        })
        .select()
        .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('Registro bloqueado por política de acesso. Execute a migration fix_rls_motorista_ferragem.sql no Supabase.');
    return data;
}

export async function fetchRomaneiosFerragem(filters = {}) {
    // Filtra romaneios de tipo 'ferragem' ou lançados pelo motorista.
    // Problema de data: registros podem ter data_saida preenchida (motorista
    // escolheu a data) ou nula (não preenchida — cai no created_at).
    // Solução: quando há filtro de período, aplicamos o filtro na data_saida
    // apenas para registros que a possuem, e usamos created_at para os demais
    // via dois fetches paralelos, depois deduplicamos por id.
    const baseSelect = `
        *,
        motorista:motorista_id(id, name),
        veiculo:veiculo_id(id, placa, modelo),
        itens:carretas_romaneio_itens(
            id, quantidade, unidade, peso_total, descricao, observacoes,
            material:material_id(id, nome, peso, unidade, percentual_frete, categoria_frete)
        )
    `;
    const baseOr = 'tipo_carga.eq.ferragem,lancado_por_motorista.eq.true';

    if (!filters.dataInicio && !filters.dataFim) {
        // Sem filtro de data: busca tudo normalmente
        let q = supabase.from('carretas_romaneios').select(baseSelect)
            .or(baseOr).order('data_saida', { ascending: false, nullsFirst: false });
        if (filters.motoristaId) q = q.eq('motorista_id', filters.motoristaId);
        if (filters.status)      q = q.eq('status', filters.status);
        const { data, error } = await q;
        if (error) throw error;
        return data || [];
    }

    // Com filtro de data: busca por data_saida E por created_at separadamente,
    // então funde e deduplica — assim registros sem data_saida não "vazam" entre
    // meses e registros com data_saida são filtrados corretamente.
    const buildQ = (dateField) => {
        let q = supabase.from('carretas_romaneios').select(baseSelect).or(baseOr)
            .order('data_saida', { ascending: false, nullsFirst: false });
        if (filters.motoristaId) q = q.eq('motorista_id', filters.motoristaId);
        if (filters.status)      q = q.eq('status', filters.status);
        if (filters.dataInicio)  q = q.gte(dateField, filters.dataInicio);
        if (filters.dataFim)     q = q.lte(dateField, dateField === 'data_saida' ? filters.dataFim : filters.dataFim + 'T23:59:59.999Z');
        return q;
    };

    const [r1, r2] = await Promise.all([buildQ('data_saida'), buildQ('created_at')]);
    if (r1.error) throw r1.error;
    if (r2.error) throw r2.error;

    // Deduplica: prioriza o registro de r1 (filtrado por data_saida) sobre r2
    const seen = new Set();
    const merged = [];
    for (const row of [...(r1.data || []), ...(r2.data || [])]) {
        if (!seen.has(row.id)) { seen.add(row.id); merged.push(row); }
    }
    merged.sort((a, b) => {
        const da = a.data_saida || a.created_at || '';
        const db = b.data_saida || b.created_at || '';
        return db.localeCompare(da);
    });
    return merged;
}
