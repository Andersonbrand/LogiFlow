import { supabase } from './supabaseClient';

// Cadastro de fornecedores ÚNICO e global para toda a aplicação LogiFlow.
// Usado pelas telas de despesas de carretas, caminhões e administrativas —
// um fornecedor cadastrado em qualquer uma delas aparece nas outras.

export async function fetchFornecedores() {
    const { data, error } = await supabase
        .from('fornecedores')
        .select('*')
        .order('nome', { ascending: true });
    if (error) throw error;
    return data || [];
}

export async function createFornecedor(fornecedor) {
    const { data, error } = await supabase
        .from('fornecedores')
        .insert(fornecedor)
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function updateFornecedor(id, updates) {
    const { data, error } = await supabase
        .from('fornecedores')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function deleteFornecedor(id) {
    const { error } = await supabase.from('fornecedores').delete().eq('id', id);
    if (error) throw error;
}
