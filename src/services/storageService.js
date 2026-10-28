import { supabase } from './supabaseClient';

/**
 * Envia um arquivo para um bucket público do Supabase Storage.
 * Retorna { url, error } — `url` é a URL pública (ou null se falhar).
 */
export async function uploadArquivoPublico(bucket, nome, arquivo) {
    const { data, error } = await supabase.storage.from(bucket).upload(nome, arquivo, { upsert: true });
    if (error) return { url: null, error };
    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path);
    return { url: urlData?.publicUrl || null, error: null };
}
