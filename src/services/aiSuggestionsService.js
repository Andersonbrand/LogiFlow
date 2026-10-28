import { supabase } from './supabaseClient';

/**
 * Busca as chaves de sugestões já verificadas/descartadas pelo admin.
 * Retorna um Set de strings (keys).
 */
export async function fetchDismissedSuggestions() {
    const { data, error } = await supabase
        .from('ai_suggestions_dismissed')
        .select('suggestion_key, is_verified');
    if (error) return {};
    // Retorna objeto { key: { is_verified } }
    const map = {};
    (data || []).forEach(d => { map[d.suggestion_key] = { is_verified: d.is_verified }; });
    return map;
}

/**
 * Persiste o descarte de uma sugestão no banco.
 * @param {string} key  - chave estável da sugestão
 * @param {boolean} isVerified - true = clicou "Verificado", false = apenas fechou
 */
export async function dismissSuggestion(key, isVerified = false) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    await supabase.from('ai_suggestions_dismissed').upsert(
        {
            suggestion_key: key,
            dismissed_by:   session.user.id,
            is_verified:    isVerified,
            dismissed_at:   new Date().toISOString(),
        },
        { onConflict: 'suggestion_key,dismissed_by' }
    );
}

/**
 * Remove o descarte de uma sugestão (re-exibe).
 */
export async function restoreSuggestion(key) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await supabase.from('ai_suggestions_dismissed')
        .delete()
        .eq('suggestion_key', key)
        .eq('dismissed_by', session.user.id);
}
