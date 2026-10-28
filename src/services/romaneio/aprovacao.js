import { supabase } from '../supabaseClient';

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
