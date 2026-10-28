import { supabase } from '../supabaseClient';

// ── Leitura paginada (contorna o limite padrão de 1000 linhas do Supabase) ──
export async function fetchAllRows(table, onProgress) {
    const PAGE = 1000;
    let from = 0;
    let all = [];
    while (true) {
        const { data, error } = await supabase.from(table).select('*').range(from, from + PAGE - 1);
        if (error) throw new Error(`Erro ao ler "${table}": ${error.message}`);
        all = all.concat(data || []);
        onProgress?.(`Lendo ${table}… (${all.length} linhas)`);
        if (!data || data.length < PAGE) break;
        from += PAGE;
    }
    return all;
}

// ── Storage: listagem recursiva de arquivos de um bucket ────────────────────
// Itens de pasta vêm com id === null na resposta do Supabase Storage.
export async function listarArquivosBucket(bucket, prefixo = '') {
    const { data, error } = await supabase.storage.from(bucket).list(prefixo, {
        limit: 1000, sortBy: { column: 'name', order: 'asc' },
    });
    if (error) throw new Error(`Erro ao listar bucket "${bucket}": ${error.message}`);
    let arquivos = [];
    for (const item of data || []) {
        const caminho = prefixo ? `${prefixo}/${item.name}` : item.name;
        if (item.id === null) {
            const sub = await listarArquivosBucket(bucket, caminho);
            arquivos = arquivos.concat(sub);
        } else {
            arquivos.push(caminho);
        }
    }
    return arquivos;
}

export async function limparBucket(bucket) {
    const arquivos = await listarArquivosBucket(bucket);
    if (!arquivos.length) return;
    const CHUNK = 100;
    for (let i = 0; i < arquivos.length; i += CHUNK) {
        const { error } = await supabase.storage.from(bucket).remove(arquivos.slice(i, i + CHUNK));
        if (error) throw new Error(`Erro ao limpar bucket "${bucket}": ${error.message}`);
    }
}
