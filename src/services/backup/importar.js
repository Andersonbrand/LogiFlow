import { supabase } from '../supabaseClient';
import { TABLE_INDEX, BUCKET_INDEX } from './config';
import { ordenarParaImportacao } from './planilha';
import { limparBucket } from './buckets';

/**
 * Remove todas as linhas de uma tabela antes de reimportar (modo "substituir").
 * Usa `id IS NOT NULL` (ou a PK configurada) para apagar tudo, funcionando
 * independente do tipo da chave primária.
 */
async function limparTabela(table) {
    const pk = TABLE_INDEX[table]?.pk || 'id';
    const { error } = await supabase.from(table).delete().not(pk, 'is', null);
    if (error) throw new Error(`Erro ao limpar "${table}" antes da importação: ${error.message}`);
}

/**
 * Importa as tabelas e/ou buckets selecionados de um backup já carregado
 * (via lerArquivoBackup).
 * @param {{manifest:object, getRows:Function, getArquivosBucket:Function}} backup
 * @param {{tables?: string[], buckets?: string[]}} selecao
 * @param {'mesclar'|'substituir'} modo
 * @param {(msg:string)=>void} onProgress
 */
export async function importarBackup(backup, { tables = [], buckets = [] }, modo, onProgress) {
    const ordenadas = ordenarParaImportacao(tables);
    const resultado = { ok: [], erros: [] };

    // Em modo "substituir", limpamos as tabelas na ordem inversa (filhas primeiro)
    // para não violar chaves estrangeiras, e esvaziamos os buckets selecionados.
    if (modo === 'substituir') {
        for (const table of [...ordenadas].reverse()) {
            try {
                onProgress?.(`Limpando ${TABLE_INDEX[table]?.nice || table}…`);
                await limparTabela(table);
            } catch (e) {
                resultado.erros.push({ table, etapa: 'limpar', erro: e.message });
            }
        }
        for (const bucket of buckets) {
            try {
                onProgress?.(`Limpando arquivos de "${BUCKET_INDEX[bucket]?.nice || bucket}"…`);
                await limparBucket(bucket);
            } catch (e) {
                resultado.erros.push({ table: bucket, etapa: 'limpar', erro: e.message });
            }
        }
    }

    for (const table of ordenadas) {
        try {
            const rows = await backup.getRows(table);
            if (!rows.length) { onProgress?.(`${table}: nenhum dado no backup, pulando.`); continue; }
            const pk = TABLE_INDEX[table]?.pk || 'id';
            const CHUNK = 500;
            for (let i = 0; i < rows.length; i += CHUNK) {
                const parte = rows.slice(i, i + CHUNK);
                onProgress?.(`Importando ${TABLE_INDEX[table]?.nice || table}… (${Math.min(i + CHUNK, rows.length)}/${rows.length})`);
                const { error } = await supabase.from(table).upsert(parte, { onConflict: pk });
                if (error) throw error;
            }
            resultado.ok.push({ table, linhas: rows.length });
        } catch (e) {
            resultado.erros.push({ table, etapa: 'importar', erro: e.message });
        }
    }

    for (const bucket of buckets) {
        try {
            const arquivos = backup.getArquivosBucket(bucket);
            if (!arquivos.length) { onProgress?.(`${bucket}: nenhum arquivo no backup, pulando.`); continue; }
            for (let i = 0; i < arquivos.length; i++) {
                const { caminho, entry } = arquivos[i];
                onProgress?.(`Restaurando ${BUCKET_INDEX[bucket]?.nice || bucket}: ${caminho} (${i + 1}/${arquivos.length})`);
                const blob = await entry.async('blob');
                const { error } = await supabase.storage.from(bucket).upload(caminho, blob, { upsert: true });
                if (error) throw error;
            }
            resultado.ok.push({ table: bucket, linhas: arquivos.length });
        } catch (e) {
            resultado.erros.push({ table: bucket, etapa: 'importar', erro: e.message });
        }
    }

    return resultado;
}
