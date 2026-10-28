import { supabase } from './supabaseClient';

import { BONUS_CAMINHAO_DEFAULT, fetchBonusCaminhaoConfig } from './settingsService';

// Valores padrão (R$ 0,009 por kg = R$ 9,00 por tonelada de ferragem; R$ 40 por romaneio com cimento).
// Quem chama passa a config salva pelo admin (useBonusCaminhaoConfig); sem ela vale o padrão.

// Calcula bonificação de um romaneio com base nos itens
export function calcularBonificacao(romaneio, config = BONUS_CAMINHAO_DEFAULT) {
    const TAXA_FERRAGEM = Number(config?.taxaFerragemKg ?? BONUS_CAMINHAO_DEFAULT.taxaFerragemKg);
    const BONUS_CIMENTO = Number(config?.valorCimento ?? BONUS_CAMINHAO_DEFAULT.valorCimento);
    if (!romaneio) return { toneladasFerragem: 0, valorFerragem: 0, temCimento: false, valorCimento: 0, valorTotal: 0 };
    const itens = romaneio.romaneio_itens || [];

    let kgFerragem = 0;
    let temCimento = false;

    for (const item of itens) {
        if (!item) continue;
        const categoria = item.materials?.categoria_frete || '';
        const pesoItem = Number(item.peso_total) || 0;

        if (categoria.toLowerCase().includes('cimento')) {
            temCimento = true;
        } else {
            kgFerragem += pesoItem;
        }
    }

    const toneladasFerragem = kgFerragem / 1000;
    const valorFerragem = kgFerragem * TAXA_FERRAGEM; // R$ 0,009 × kg
    const valorCimento = temCimento ? BONUS_CIMENTO : 0;
    const valorTotal = valorFerragem + valorCimento;

    return {
        toneladasFerragem: Number(toneladasFerragem.toFixed(3)),
        valorFerragem: Number(valorFerragem.toFixed(2)),
        temCimento,
        valorCimento,
        valorTotal: Number(valorTotal.toFixed(2)),
    };
}

// Salva bonificação no banco
export async function salvarBonificacao(motoristaId, romaneioId, romaneio) {
    const calc = calcularBonificacao(romaneio, await fetchBonusCaminhaoConfig().catch(() => BONUS_CAMINHAO_DEFAULT));
    const { data, error } = await supabase
        .from('bonificacoes')
        .upsert({
            motorista_id: motoristaId,
            romaneio_id: romaneioId,
            toneladas_ferragem: calc.toneladasFerragem,
            valor_ferragem: calc.valorFerragem,
            tem_cimento: calc.temCimento,
            valor_cimento: calc.valorCimento,
            valor_total: calc.valorTotal,
        }, { onConflict: 'romaneio_id' })
        .select().single();
    if (error) throw error;
    return data;
}

// Busca bonificações de um motorista
export async function fetchBonificacoes(motoristaId, periodo) {
    let query = supabase
        .from('bonificacoes')
        .select('*, romaneios(numero, destino, saida, status)')
        .order('created_at', { ascending: false });

    if (motoristaId) query = query.eq('motorista_id', motoristaId);

    if (periodo) {
        const cut = new Date();
        cut.setDate(cut.getDate() - periodo);
        query = query.gte('created_at', cut.toISOString());
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
}

// Busca bonificações consolidadas — calcula diretamente dos romaneios aprovados
// (não depende da tabela bonificacoes estar preenchida)
export async function fetchBonificacoesConsolidadas(filters = {}) {
    const config = await fetchBonusCaminhaoConfig().catch(() => BONUS_CAMINHAO_DEFAULT);
    // Busca romaneios que foram aprovados OU finalizados (compatível com registros antigos)
    // Alguns têm aprovado=true, outros têm status_aprovacao='aprovado', outros apenas status='Finalizado'
    let q = supabase
        .from('romaneios')
        .select(`
            id, numero, motorista, motorista_id, destino, saida, status, aprovado, status_aprovacao,
            romaneio_itens(id, quantidade, peso_total, material_id,
                materials(id, nome, categoria_frete))
        `)
        .or('aprovado.eq.true,status_aprovacao.eq.aprovado,status.eq.Finalizado')
        .order('created_at', { ascending: false });
    if (filters.dataInicio) q = q.gte('saida', filters.dataInicio);
    if (filters.dataFim)    q = q.lte('saida', `${filters.dataFim}T23:59:59`);
    const { data: romaneios, error } = await q;

    if (error) throw error;
    const extras = await fetchBonificacoesExtrasCaminhao(filters).catch(() => []);
    if ((!romaneios || romaneios.length === 0) && extras.length === 0) return [];

    // Busca nomes dos motoristas cadastrados (role = motorista)
    const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, name')
        .eq('role', 'motorista');
    const nomesMap = {};
    for (const p of (profiles || [])) nomesMap[p.id] = p.name;

    // Agrupa por motorista (pelo nome do campo texto, pois motorista_id pode ser null)
    const porMotorista = {};
    for (const rom of (romaneios || [])) {
        const bonif = calcularBonificacao(rom, config);
        // Chave: motorista_id se existir, senão nome do motorista
        const chave = rom.motorista_id || rom.motorista || 'desconhecido';
        const nome = (rom.motorista_id && nomesMap[rom.motorista_id]) || rom.motorista || 'Sem nome';
        const pesoRom = (rom.romaneio_itens || []).reduce((s, it) => s + (Number(it.peso_total) || 0), 0);
        if (!porMotorista[chave]) {
            porMotorista[chave] = {
                motoristaId: rom.motorista_id,
                // campos que o admin/motorista renderizam:
                motorista: nome,
                nome,
                total_viagens: 0,
                romaneios: 0,
                peso_total: 0,
                toneladasTotal: 0,
                bonificacao_romaneios: 0,
                bonificacao_extras: 0,
                bonificacao_total: 0,
                valorTotal: 0,
            };
        }
        porMotorista[chave].total_viagens++;
        porMotorista[chave].romaneios++;
        porMotorista[chave].peso_total      += pesoRom;
        porMotorista[chave].toneladasTotal  += bonif.toneladasFerragem;
        porMotorista[chave].bonificacao_romaneios += bonif.valorTotal;
        porMotorista[chave].bonificacao_total += bonif.valorTotal;
        porMotorista[chave].valorTotal      += bonif.valorTotal;
    }

    // Bônus extras lançados pelo gestor entram no total do motorista
    for (const ex of extras) {
        const chave = ex.motorista_id;
        if (!porMotorista[chave]) {
            porMotorista[chave] = {
                motoristaId: ex.motorista_id, motorista: ex.motorista?.name || nomesMap[ex.motorista_id] || 'Sem nome', nome: ex.motorista?.name || nomesMap[ex.motorista_id] || 'Sem nome',
                total_viagens: 0, romaneios: 0, peso_total: 0, toneladasTotal: 0,
                bonificacao_romaneios: 0, bonificacao_extras: 0, bonificacao_total: 0, valorTotal: 0,
            };
        }
        const v = Number(ex.valor || 0);
        porMotorista[chave].bonificacao_extras += v;
        porMotorista[chave].bonificacao_total  += v;
        porMotorista[chave].valorTotal         += v;
    }

    return Object.values(porMotorista).sort((a, b) => b.bonificacao_total - a.bonificacao_total);
}

// ─── BÔNUS EXTRAS DOS MOTORISTAS DE CAMINHÃO ─────────────────────────────────
// Lançamentos avulsos do gestor (mesmo modelo dos extras de carretas).
export async function fetchBonificacoesExtrasCaminhao(filters = {}) {
    let q = supabase
        .from('caminhoes_bonificacoes_extras')
        .select('*, motorista:motorista_id(id, name), criador:criado_por(id, name)')
        .order('data', { ascending: false });
    if (filters.motorista_id) q = q.eq('motorista_id', filters.motorista_id);
    if (filters.dataInicio)   q = q.gte('data', filters.dataInicio);
    if (filters.dataFim)      q = q.lte('data', filters.dataFim.slice(0, 10));
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
}

export async function createBonificacaoExtraCaminhao(extra) {
    const { data, error } = await supabase.from('caminhoes_bonificacoes_extras').insert(extra).select().single();
    if (error) throw error;
    return data;
}

export async function updateBonificacaoExtraCaminhao(id, updates) {
    const { data, error } = await supabase.from('caminhoes_bonificacoes_extras').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
}

export async function deleteBonificacaoExtraCaminhao(id) {
    const { error } = await supabase.from('caminhoes_bonificacoes_extras').delete().eq('id', id);
    if (error) throw error;
}
