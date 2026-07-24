import { supabase } from 'utils/supabaseClient';

// ─── Catálogo de itens (admin gerencia em Entregas de Acessórios) ───────────
export async function fetchItensAcessorios({ apenasAtivos = true } = {}) {
    let q = supabase.from('acessorios_itens').select('*').order('nome', { ascending: true });
    if (apenasAtivos) q = q.eq('ativo', true);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
}

export async function createItemAcessorio(item) {
    const { data, error } = await supabase
        .from('acessorios_itens')
        .insert(item)
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function updateItemAcessorio(id, updates) {
    const { data, error } = await supabase
        .from('acessorios_itens')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function deleteItemAcessorio(id) {
    const { error } = await supabase
        .from('acessorios_itens')
        .delete()
        .eq('id', id);
    if (error) throw error;
}

// ─── CRUD de entregas ────────────────────────────────────────────────────────
export async function fetchEntregasAcessorios(filters = {}) {
    let q = supabase
        .from('entregas_acessorios')
        .select(`
            *,
            motorista:motorista_id(id, name),
            criador:criado_por(id, name)
        `)
        .order('data_entrega', { ascending: false })
        .order('created_at', { ascending: false });

    if (filters.motorista_id) q = q.eq('motorista_id', filters.motorista_id);
    if (filters.dataInicio)   q = q.gte('data_entrega', filters.dataInicio);
    if (filters.dataFim)      q = q.lte('data_entrega', filters.dataFim);

    const { data, error } = await q;
    if (error) throw error;
    return data || [];
}

export async function createEntregaAcessorio(entrega) {
    const { data, error } = await supabase
        .from('entregas_acessorios')
        .insert(entrega)
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function updateEntregaAcessorio(id, updates) {
    const { data, error } = await supabase
        .from('entregas_acessorios')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function deleteEntregaAcessorio(id) {
    const { error } = await supabase
        .from('entregas_acessorios')
        .delete()
        .eq('id', id);
    if (error) throw error;
}
