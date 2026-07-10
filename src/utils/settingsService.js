import { supabase, subscribeTabela } from './supabaseClient';
import { useState, useEffect, useCallback } from 'react';

export const BONUS_CONFIG_KEY = 'bonus_carreteiro';
export const BONUS_CONFIG_DEFAULT = { bonusBaixo: 60, bonusAlto: 120 };

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
