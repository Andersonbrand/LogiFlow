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
