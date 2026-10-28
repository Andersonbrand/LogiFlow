import { supabase } from '../supabaseClient';

// ═══════════════════════════════════════════════════════════════
// PONTOS DE PARADA — registros de chegada/saída em locais
// ═══════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
// CATÁLOGO DE LOCAIS DE PARADA (tipos "Fábrica" e "Outro" — editável pelo admin)
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// CATÁLOGO DE PEÇAS (usado no select de "Solicitar Peça" nas OS)
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchPecasCatalogo(categoria) {
    let q = supabase.from('carretas_pecas_catalogo').select('*').eq('ativo', true).order('nome', { ascending: true });
    if (categoria) q = q.in('categoria', [categoria, 'Ambos']);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
}
