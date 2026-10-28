import { useState, useEffect, useCallback } from 'react';

import { supabase, subscribeTabela } from './supabaseClient';
import { fetchFretesCidades } from './carretas/fretes';
import { normalizarCidade } from './carretas/bonificacao';

export const BONUS_CONFIG_KEY = 'bonus_carreteiro';
// modo 'fixo': bonusBaixo (cidades de rodízio/estoque) / bonusAlto (demais).
// modo 'km'  : valor pela distância (km da tabela "Fretes da Frota") até o destino —
//              faixasKm = [{ ateKm, valor }] em ordem crescente; acima da última faixa vale valorAcimaKm.
export const BONUS_CONFIG_DEFAULT = {
    bonusBaixo: 60, bonusAlto: 120,
    modo: 'fixo',
    faixasKm: [{ ateKm: 700, valor: 60 }, { ateKm: 900, valor: 90 }],
    valorAcimaKm: 120,
};

// Bônus dos motoristas de CAMINHÃO (calculado sobre os romaneios): R$ por kg de ferragem
// e valor fixo por romaneio com cimento. Editável na aba Bônus de Veículos > Motoristas.
export const BONUS_CAMINHAO_KEY = 'bonus_caminhao';
export const BONUS_CAMINHAO_DEFAULT = { taxaFerragemKg: 0.009, valorCimento: 40 };

export const CAPTACAO_CONFIG_KEY = 'valor_captacao_frota';
export const CAPTACAO_CONFIG_DEFAULT = { valorPorSaco: 0 };

export const CUSTO_CONFIG_KEY = 'custo_produto_operacional_frota';
export const CUSTO_CONFIG_DEFAULT = { custoMedioProduto: 0, custoOperacional: 0 };

export const HORA_EXTRA_CONFIG_KEY = 'valor_hora_extra_carreteiro';
export const HORA_EXTRA_CONFIG_DEFAULT = { valorHora: 0 };

// Cache em memória (30 s) + junção de chamadas simultâneas: várias telas/hooks que
// pedem a mesma configuração ao mesmo tempo fazem UMA só requisição ao banco.
// O cache é limpo ao salvar e quando o Realtime avisa que app_settings mudou.
const SETTINGS_TTL_MS = 30000;
const _settingsCache = new Map(); // key -> { ts, promise }

export function limparCacheSettings() { _settingsCache.clear(); }

export async function fetchSetting(key, fallback = null) {
    const hit = _settingsCache.get(key);
    if (hit && Date.now() - hit.ts < SETTINGS_TTL_MS) {
        const v = await hit.promise;
        return v ?? fallback;
    }
    const promise = (async () => {
        const { data, error } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', key)
            .maybeSingle();
        if (error) throw error;
        return data?.value ?? null;
    })();
    _settingsCache.set(key, { ts: Date.now(), promise });
    try {
        const v = await promise;
        return v ?? fallback;
    } catch (e) {
        _settingsCache.delete(key); // nunca guarda falha no cache
        throw e;
    }
}

// Ao mudar app_settings no servidor: descarta o cache e recarrega o hook
const aoMudarSettings = (load) => () => { limparCacheSettings(); load(); };

export async function saveSetting(key, value, userId = null) {
    limparCacheSettings();
    const { data, error } = await supabase
        .from('app_settings')
        .upsert({ key, value, updated_by: userId, updated_at: new Date().toISOString() }, { onConflict: 'key' })
        .select()
        .single();
    if (error) throw error;
    return data;
}

// Atalhos específicos pro bônus do carreteiro (R$ por viagem, conforme destino)
function parseFaixas(faixas) {
    const lista = (Array.isArray(faixas) ? faixas : [])
        .map(f => ({ ateKm: Number(f?.ateKm), valor: Number(f?.valor) }))
        .filter(f => Number.isFinite(f.ateKm) && f.ateKm >= 0 && Number.isFinite(f.valor) && f.valor >= 0)
        .sort((a, b) => a.ateKm - b.ateKm);
    return lista.length ? lista : BONUS_CONFIG_DEFAULT.faixasKm;
}

export async function fetchBonusConfig() {
    const value = await fetchSetting(BONUS_CONFIG_KEY, BONUS_CONFIG_DEFAULT);
    const modo = value?.modo === 'km' ? 'km' : 'fixo';
    const config = {
        bonusBaixo: Number(value?.bonusBaixo ?? BONUS_CONFIG_DEFAULT.bonusBaixo),
        bonusAlto:  Number(value?.bonusAlto  ?? BONUS_CONFIG_DEFAULT.bonusAlto),
        modo,
        faixasKm: parseFaixas(value?.faixasKm),
        valorAcimaKm: Number(value?.valorAcimaKm ?? BONUS_CONFIG_DEFAULT.valorAcimaKm),
        kmPorCidade: {},
    };
    // No modo por KM precisa da distância de cada cidade (tabela de fretes da frota própria).
    if (modo === 'km') {
        try {
            const fretes = await fetchFretesCidades('frota');
            fretes.forEach(f => { if (f.km != null && f.km !== '') config.kmPorCidade[normalizarCidade(f.cidade)] = Number(f.km); });
        } catch { /* sem a tabela de fretes, o cálculo cai nos valores fixos */ }
    }
    return config;
}

export async function saveBonusConfig({ bonusBaixo, bonusAlto, modo = 'fixo', faixasKm, valorAcimaKm }, userId = null) {
    return saveSetting(BONUS_CONFIG_KEY, {
        bonusBaixo: Number(bonusBaixo),
        bonusAlto:  Number(bonusAlto),
        modo: modo === 'km' ? 'km' : 'fixo',
        faixasKm: parseFaixas(faixasKm),
        valorAcimaKm: Number(valorAcimaKm ?? BONUS_CONFIG_DEFAULT.valorAcimaKm),
    }, userId);
}

// Hook reativo: carrega o bônus configurado e atualiza automaticamente pra
// todo mundo (motorista, carreteiro, admin) quando o admin salvar um novo
// valor — sem precisar dar F5.
export function useBonusConfig() {
    const [config, setConfig] = useState({ ...BONUS_CONFIG_DEFAULT, kmPorCidade: {} });
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        try { setConfig(await fetchBonusConfig()); }
        catch { setConfig({ ...BONUS_CONFIG_DEFAULT, kmPorCidade: {} }); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => {
        load();
        const unsub = subscribeTabela('app_settings', aoMudarSettings(load));
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
        const unsub = subscribeTabela('app_settings', aoMudarSettings(load));
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
        const unsub = subscribeTabela('app_settings', aoMudarSettings(load));
        return () => unsub && unsub();
    }, [load]);

    return { custoConfig: config, loadingCustoConfig: loading, reloadCustoConfig: load };
}

// ── Valor da Hora Extra (motoristas carreteiros) ──────────────────────────────
// Valor global em R$/hora, editável pelo admin, usado na aba "Horas Extras"
// (Pontos de Parada) para calcular o valor devido a cada motorista.
export async function fetchHoraExtraConfig() {
    const value = await fetchSetting(HORA_EXTRA_CONFIG_KEY, HORA_EXTRA_CONFIG_DEFAULT);
    return { valorHora: Number(value?.valorHora ?? HORA_EXTRA_CONFIG_DEFAULT.valorHora) };
}

export async function saveHoraExtraConfig({ valorHora }, userId = null) {
    return saveSetting(HORA_EXTRA_CONFIG_KEY, { valorHora: Number(valorHora) }, userId);
}

export function useHoraExtraConfig() {
    const [config, setConfig] = useState(HORA_EXTRA_CONFIG_DEFAULT);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        try { setConfig(await fetchHoraExtraConfig()); }
        catch { setConfig(HORA_EXTRA_CONFIG_DEFAULT); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => {
        load();
        const unsub = subscribeTabela('app_settings', aoMudarSettings(load));
        return () => unsub && unsub();
    }, [load]);

    return { horaExtraConfig: config, loadingHoraExtraConfig: loading, reloadHoraExtraConfig: load };
}

// ── Bônus dos motoristas de caminhão (valores padrão pagos por romaneio) ──────
export async function fetchBonusCaminhaoConfig() {
    const value = await fetchSetting(BONUS_CAMINHAO_KEY, BONUS_CAMINHAO_DEFAULT);
    return {
        taxaFerragemKg: Number(value?.taxaFerragemKg ?? BONUS_CAMINHAO_DEFAULT.taxaFerragemKg),
        valorCimento:   Number(value?.valorCimento   ?? BONUS_CAMINHAO_DEFAULT.valorCimento),
    };
}

export async function saveBonusCaminhaoConfig({ taxaFerragemKg, valorCimento }, userId = null) {
    return saveSetting(BONUS_CAMINHAO_KEY, {
        taxaFerragemKg: Number(taxaFerragemKg),
        valorCimento: Number(valorCimento),
    }, userId);
}

// Hook reativo — todo mundo (admin, operador, motorista) recebe o valor novo assim que o admin salvar.
export function useBonusCaminhaoConfig() {
    const [config, setConfig] = useState(BONUS_CAMINHAO_DEFAULT);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        try { setConfig(await fetchBonusCaminhaoConfig()); }
        catch { setConfig(BONUS_CAMINHAO_DEFAULT); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => {
        load();
        const unsub = subscribeTabela('app_settings', aoMudarSettings(load));
        return () => unsub && unsub();
    }, [load]);

    return { bonusCaminhaoConfig: config, loadingBonusCaminhaoConfig: loading, reloadBonusCaminhaoConfig: load };
}
