import { supabase } from '../supabaseClient';

// ─────────────────────────────────────────────────────────────────────────────
// EMPRESAS
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchEmpresas() {
    const { data, error } = await supabase
        .from('carretas_empresas')
        .select('*')
        .order('nome', { ascending: true });
    if (error) throw error;
    return data || [];
}

export async function createEmpresa(empresa) {
    const { data, error } = await supabase
        .from('carretas_empresas')
        .insert(empresa)
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function deleteEmpresa(id) {
    const { error } = await supabase.from('carretas_empresas').delete().eq('id', id);
    if (error) throw error;
}
