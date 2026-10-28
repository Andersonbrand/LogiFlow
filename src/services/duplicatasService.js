import { supabase } from './supabaseClient';

/** Assinaturas de grupos de duplicatas já marcados como verificados. */
export async function fetchDuplicatasVerificadas() {
    const { data } = await supabase.from('duplicatas_verificadas').select('assinatura');
    return data || [];
}

export function marcarDuplicataVerificada(assinatura, tipo) {
    return supabase.from('duplicatas_verificadas').upsert({ assinatura, tipo }, { onConflict: 'assinatura' });
}

export function desmarcarDuplicataVerificada(assinatura) {
    return supabase.from('duplicatas_verificadas').delete().eq('assinatura', assinatura);
}
