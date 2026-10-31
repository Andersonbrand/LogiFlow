import { supabase } from './supabaseClient';

// ─── Materiais ────────────────────────────────────────────────────────────────

export async function fetchMaterials() {
  const { data, error } = await supabase
    .from('materials')
    .select('*')
    .order('nome', { ascending: true });
  if (error) throw error;
  return data;
}

export async function createMaterial(material) {
  const { id, ...payload } = material;
  const { data, error } = await supabase
    .from('materials')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateMaterial(id, material) {
  const { data, error } = await supabase
    .from('materials')
    .update(material)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteMaterial(id) {
  const { error } = await supabase.from('materials').delete().eq('id', id);
  if (error) throw error;
}

// ─── Categorias de Produto ───────────────────────────────────────────────────

export async function fetchMaterialCategories() {
  const { data, error } = await supabase
    .from('material_categories')
    .select('*')
    .order('nome', { ascending: true });
  if (error) throw error;
  return data;
}

export async function createMaterialCategory(nome) {
  const { data, error } = await supabase
    .from('material_categories')
    .insert({ nome: nome.trim() })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Renomeia a categoria e propaga o novo nome para os materiais que a usam
// (materials.categoria guarda o nome em texto, então precisa acompanhar).
export async function updateMaterialCategory(id, nomeAntigo, nomeNovo) {
  const nome = nomeNovo.trim();
  const { data, error } = await supabase
    .from('material_categories')
    .update({ nome })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  if (nomeAntigo && nomeAntigo !== nome) {
    const { error: e2 } = await supabase.from('materials').update({ categoria: nome }).eq('categoria', nomeAntigo);
    if (e2) throw e2;
  }
  return data;
}

export async function deleteMaterialCategory(id) {
  const { error } = await supabase.from('material_categories').delete().eq('id', id);
  if (error) throw error;
}

// Inserção em lote (usada na importação de planilha). Retorna { data, error } do Supabase.
export function insertMaterialsLote(lote) {
    return supabase.from('materials').insert(lote).select();
}
