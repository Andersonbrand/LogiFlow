import { supabase } from '../supabaseClient';

// ─────────────────────────────────────────────────────────────────────────────
// RODÍZIO DE ENVIOS DE AÇO
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchEnviosAco(filters = {}) {
    let q = supabase
        .from('carretas_envios_aco')
        .select('*, motorista:motorista_id(id, name)')
        .order('data_envio', { ascending: false });
    if (filters.dataInicio) q = q.gte('data_envio', filters.dataInicio);
    if (filters.dataFim)    q = q.lte('data_envio', filters.dataFim);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
}

export async function registrarEnvioAco({ motoristaId, dataEnvio, destino, observacoes, registradoPor, placa, pedidos, assinaturaAdmin }) {
    const { data, error } = await supabase
        .from('carretas_envios_aco')
        .insert({
            motorista_id: motoristaId,
            data_envio: dataEnvio || new Date().toISOString().slice(0, 10),
            destino: destino || null,
            observacoes: observacoes || null,
            registrado_por: registradoPor || null,
            placa: placa || null,
            pedidos: pedidos || [],
            assinatura_admin: assinaturaAdmin || null,
            assinatura_admin_at: assinaturaAdmin ? new Date().toISOString() : null,
        })
        .select()
        .single();
    if (error) throw error;
    return data;
}

// Edita o envio. A data do envio (usada na fila de rodízio) NÃO muda.
// A assinatura é refeita com a de quem editou, pois o conteúdo mudou.
export async function atualizarEnvioAco(id, { motoristaId, destino, observacoes, placa, pedidos, assinaturaAdmin }) {
    const { data, error } = await supabase
        .from('carretas_envios_aco')
        .update({
            motorista_id: motoristaId,
            destino: destino || null,
            observacoes: observacoes || null,
            placa: placa || null,
            pedidos: pedidos || [],
            assinatura_admin: assinaturaAdmin || null,
            assinatura_admin_at: assinaturaAdmin ? new Date().toISOString() : null,
            updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function assinarEnvioAco(id, assinaturaTexto) {
    const { data, error } = await supabase
        .from('carretas_envios_aco')
        .update({ assinatura_admin: assinaturaTexto, assinatura_admin_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
    if (error) throw error;
    return data;
}

// Remove a assinatura digital do envio (desmarcar o checkbox no modal de visualização).
export async function desassinarEnvioAco(id) {
    const { data, error } = await supabase
        .from('carretas_envios_aco')
        .update({ assinatura_admin: null, assinatura_admin_at: null })
        .eq('id', id)
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function excluirEnvioAco(id) {
    const { error } = await supabase.from('carretas_envios_aco').delete().eq('id', id);
    if (error) throw error;
}
