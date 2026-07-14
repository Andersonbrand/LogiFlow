import { supabase, subscribeTabela } from './supabaseClient';
import { useState, useEffect, useCallback } from 'react';

export const BONUS_CONFIG_KEY = 'bonus_carreteiro';
export const BONUS_CONFIG_DEFAULT = { bonusBaixo: 60, bonusAlto: 120 };

export const CAPTACAO_CONFIG_KEY = 'valor_captacao_frota';
export const CAPTACAO_CONFIG_DEFAULT = { valorPorSaco: 0 };

export const CUSTO_CONFIG_KEY = 'custo_produto_operacional_frota';
export const CUSTO_CONFIG_DEFAULT = { custoMedioProduto: 0, custoOperacional: 0 };

export async function fetchSetting(key, fallback = null) {
    const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', key)
        .maybeSingle();
    if (error) throw error;
    return data?.value ?? fallback;
}

export async function saveSetting(key, value, userId = null) {
    const { data, error } = await supabase
        .from('app_settings')
        .upsert({ key, value, updated_by: userId, updated_at: new Date().toISOString() }, { onConflict: 'key' })
        .select()
        .single();
    if (error) throw error;
    return data;
}

// Atalhos específicos pro bônus do carreteiro (R$ por viagem, conforme destino)
export async function fetchBonusConfig() {
    const value = await fetchSetting(BONUS_CONFIG_KEY, BONUS_CONFIG_DEFAULT);
    return {
        bonusBaixo: Number(value?.bonusBaixo ?? BONUS_CONFIG_DEFAULT.bonusBaixo),
        bonusAlto:  Number(value?.bonusAlto  ?? BONUS_CONFIG_DEFAULT.bonusAlto),
    };
}

export async function saveBonusConfig({ bonusBaixo, bonusAlto }, userId = null) {
    return saveSetting(BONUS_CONFIG_KEY, {
        bonusBaixo: Number(bonusBaixo),
        bonusAlto:  Number(bonusAlto),
    }, userId);
}

// Hook reativo: carrega o bônus configurado e atualiza automaticamente pra
// todo mundo (motorista, carreteiro, admin) quando o admin salvar um novo
// valor — sem precisar dar F5.
export function useBonusConfig() {
    const [config, setConfig] = useState(BONUS_CONFIG_DEFAULT);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        try { setConfig(await fetchBonusConfig()); }
        catch { setConfig(BONUS_CONFIG_DEFAULT); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => {
        load();
        const unsub = subscribeTabela('app_settings', load);
        return () => unsub && unsub();
    }, [load]);

    return { bonusConfig: config, loadingBonusConfig: loading, reloadBonusConfig: load };
}

// ── Valor de Captação (frota própria) ────────────────────────────────────────
// Frete usado para buscar o cimento em MOC (Montes Claros) e trazer até o
// Estoque próprio (R$ por saco). A diferença entre o frete total de cada
// cidade (tabela "Fretes da Frota") e este valor de captação é o valor de
// distribuição daquela cidade — usado na aba Fretes e no DRE de Carretas.
export async function fetchCaptacaoConfig() {
    const value = await fetchSetting(CAPTACAO_CONFIG_KEY, CAPTACAO_CONFIG_DEFAULT);
    return { valorPorSaco: Number(value?.valorPorSaco ?? CAPTACAO_CONFIG_DEFAULT.valorPorSaco) };
}

export async function saveCaptacaoConfig({ valorPorSaco }, userId = null) {
    return saveSetting(CAPTACAO_CONFIG_KEY, { valorPorSaco: Number(valorPorSaco) }, userId);
}

export function useCaptacaoConfig() {
    const [config, setConfig] = useState(CAPTACAO_CONFIG_DEFAULT);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        try { setConfig(await fetchCaptacaoConfig()); }
        catch { setConfig(CAPTACAO_CONFIG_DEFAULT); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => {
        load();
        const unsub = subscribeTabela('app_settings', load);
        return () => unsub && unsub();
    }, [load]);

    return { captacaoConfig: config, loadingCaptacaoConfig: loading, reloadCaptacaoConfig: load };
}

// ── Custo Médio do Produto + Custo Operacional (frota própria) ───────────────
// Dois valores globais, também em R$ por saco, rateados igual ao valor de
// captação. Usados para calcular a margem de venda de cada cidade na tabela
// "Fretes da Frota": Margem = Preço de Venda − (Custo do Produto + Custo Operacional).
export async function fetchCustoConfig() {
    const value = await fetchSetting(CUSTO_CONFIG_KEY, CUSTO_CONFIG_DEFAULT);
    return {
        custoMedioProduto: Number(value?.custoMedioProduto ?? CUSTO_CONFIG_DEFAULT.custoMedioProduto),
        custoOperacional:  Number(value?.custoOperacional  ?? CUSTO_CONFIG_DEFAULT.custoOperacional),
    };
}

export async function saveCustoConfig({ custoMedioProduto, custoOperacional }, userId = null) {
    return saveSetting(CUSTO_CONFIG_KEY, {
        custoMedioProduto: Number(custoMedioProduto),
        custoOperacional: Number(custoOperacional),
    }, userId);
}

export function useCustoConfig() {
    const [config, setConfig] = useState(CUSTO_CONFIG_DEFAULT);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        try { setConfig(await fetchCustoConfig()); }
        catch { setConfig(CUSTO_CONFIG_DEFAULT); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => {
        load();
        const unsub = subscribeTabela('app_settings', load);
        return () => unsub && unsub();
    }, [load]);

    return { custoConfig: config, loadingCustoConfig: loading, reloadCustoConfig: load };
}
