import { supabase } from '../supabaseClient';

// ─────────────────────────────────────────────────────────────────────────────
// BONIFICAÇÃO: Estoque, Urandi, Pindaí, Candiba e Pilões = R$60
//              Qualquer outro destino = R$120
// ─────────────────────────────────────────────────────────────────────────────
export const CIDADES_BONUS_BAIXO = [
    'estoque', 'urandi', 'pindai', 'pindaí', 'candiba', 'pilões', 'piloes',
];

export const BONUS_BAIXO  = 60;

export const BONUS_ALTO   = 120;

// Normaliza o nome da cidade para comparar destino x tabela de fretes (sem acento/caixa/UF).
export function normalizarCidade(txt) {
    return String(txt || '')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toLowerCase().replace(/\s*[-/,|(].*$/, '').replace(/\s+/g, ' ').trim();
}

// Distância (km) até o destino, buscando na tabela de fretes da frota { cidadeNormalizada: km }.
// Aceita nome exato ou destino que contenha o nome da cidade. null = não encontrada.
export function kmDoDestino(destino, kmPorCidade) {
    if (!destino || !kmPorCidade) return null;
    const d = normalizarCidade(destino);
    if (d in kmPorCidade) return kmPorCidade[d];
    const bruto = String(destino).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const chave = Object.keys(kmPorCidade).filter(Boolean).sort((a, b) => b.length - a.length).find(c => bruto.includes(c));
    return chave ? kmPorCidade[chave] : null;
}

// Bônus pela faixa de km: primeira faixa cujo limite comporta o km; acima da última, valorAcimaKm.
export function calcularBonusPorKm(km, cfg) {
    const faixas = [...(cfg?.faixasKm || [])].sort((a, b) => a.ateKm - b.ateKm);
    const faixa = faixas.find(f => km <= Number(f.ateKm));
    return Number(faixa ? faixa.valor : (cfg?.valorAcimaKm ?? 0));
}

// `overrides` é o bonusConfig (useBonusConfig): modo 'fixo' (padrão) ou 'km'.
// No modo 'km', destino sem distância cadastrada usa a regra fixa como reserva.
export function calcularBonusCarreteiro(destino, overrides = null) {
    if (!destino) return 0;
    if (overrides?.modo === 'km') {
        const km = kmDoDestino(destino, overrides.kmPorCidade);
        if (km != null) return calcularBonusPorKm(km, overrides);
    }
    const d = destino.toLowerCase().trim();
    const isBaixo = CIDADES_BONUS_BAIXO.some(c => d.includes(c));
    const bonusBaixo = Number(overrides?.bonusBaixo ?? BONUS_BAIXO);
    const bonusAlto  = Number(overrides?.bonusAlto  ?? BONUS_ALTO);
    return isBaixo ? bonusBaixo : bonusAlto;
}

// ─── BONIFICAÇÕES EXTRAS ──────────────────────────────────────────────────────
export async function fetchBonificacoesExtras(filters = {}) {
    let q = supabase
        .from('carretas_bonificacoes_extras')
        .select(`
            *,
            motorista:motorista_id(id, name),
            criador:criado_por(id, name)
        `)
        .order('data', { ascending: false });

    if (filters.motorista_id) q = q.eq('motorista_id', filters.motorista_id);
    if (filters.dataInicio)   q = q.gte('data', filters.dataInicio);
    if (filters.dataFim)      q = q.lte('data', filters.dataFim);

    const { data, error } = await q;
    if (error) throw error;
    return data || [];
}

export async function createBonificacaoExtra(extra) {
    const { data, error } = await supabase
        .from('carretas_bonificacoes_extras')
        .insert(extra)
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function updateBonificacaoExtra(id, updates) {
    const { data, error } = await supabase
        .from('carretas_bonificacoes_extras')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function deleteBonificacaoExtra(id) {
    const { error } = await supabase
        .from('carretas_bonificacoes_extras')
        .delete()
        .eq('id', id);
    if (error) throw error;
}
