import JSZip from 'jszip';
import { supabase } from '../supabaseClient';
import { BACKUP_VERSION, TABLE_INDEX, BUCKET_INDEX } from './config';
import { fetchAllRows, listarArquivosBucket } from './buckets';
import { gerarXlsxArrayBuffer } from './planilha';

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTAÇÃO
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Gera o .zip de backup para as tabelas e/ou buckets selecionados.
 * @param {{tables?: string[], buckets?: string[]}} selecao
 * @param {(msg:string)=>void} onProgress - callback de progresso (texto)
 * @returns {Promise<{blob: Blob, manifest: object}>}
 */
export async function exportBackup({ tables = [], buckets = [] }, onProgress) {
    const zip = new JSZip();
    const manifest = {
        app: 'LogiFlow',
        tipo: 'backup',
        versao: BACKUP_VERSION,
        gerado_em: new Date().toISOString(),
        tabelas: {},
        buckets: {},
    };
    const puladas = []; // { item, motivo } — tabelas/buckets que falharam e foram ignorados

    for (const table of tables) {
        const def = TABLE_INDEX[table];
        const folder = def?.folder || 'outros';
        try {
            onProgress?.(`Exportando ${def?.nice || table}…`);
            const rows = await fetchAllRows(table, onProgress);
            zip.file(`${folder}/${table}.json`, JSON.stringify(rows, null, 2));
            if (rows.length > 0) {
                onProgress?.(`Gerando planilha de ${def?.nice || table}…`);
                zip.file(`${folder}/${table}.xlsx`, gerarXlsxArrayBuffer(rows, def?.nice || table));
            }
            manifest.tabelas[table] = {
                modulo: def?.moduleId || 'outros',
                pasta: folder,
                linhas: rows.length,
            };
        } catch (e) {
            const motivo = /schema cache|does not exist|not find the table/i.test(e.message)
                ? 'Tabela não existe neste banco de dados.'
                : e.message;
            onProgress?.(`⚠ Pulando ${def?.nice || table}: ${motivo}`);
            puladas.push({ item: def?.nice || table, motivo });
        }
    }

    for (const bucket of buckets) {
        const def = BUCKET_INDEX[bucket];
        try {
            onProgress?.(`Listando arquivos de "${def?.nice || bucket}"…`);
            const arquivos = await listarArquivosBucket(bucket);
            let bytes = 0;
            for (let i = 0; i < arquivos.length; i++) {
                const caminho = arquivos[i];
                onProgress?.(`Baixando ${def?.nice || bucket}: ${caminho} (${i + 1}/${arquivos.length})`);
                const { data, error } = await supabase.storage.from(bucket).download(caminho);
                if (error) throw new Error(error.message);
                zip.file(`storage/${bucket}/${caminho}`, data);
                bytes += data.size || 0;
            }
            manifest.buckets[bucket] = { arquivos: arquivos.length, bytes };
        } catch (e) {
            const motivo = /not found|bucket.*not exist/i.test(e.message)
                ? 'Bucket não existe neste projeto Supabase.'
                : e.message;
            onProgress?.(`⚠ Pulando ${def?.nice || bucket}: ${motivo}`);
            puladas.push({ item: def?.nice || bucket, motivo });
        }
    }

    manifest.puladas = puladas;
    zip.file('manifest.json', JSON.stringify(manifest, null, 2));
    onProgress?.('Compactando arquivo .zip…');
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
    return { blob, manifest, puladas };
}

export function nomeArquivoBackup() {
    const d = new Date();
    const pad = n => String(n).padStart(2, '0');
    return `logiflow-backup-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.zip`;
}

export function baixarBlob(blob, nomeArquivo) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nomeArquivo;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// ═══════════════════════════════════════════════════════════════════════════
// IMPORTAÇÃO
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Lê um arquivo .zip de backup e retorna o manifesto + funções para extrair
 * as linhas de cada tabela e os arquivos de cada bucket sob demanda.
 */
export async function lerArquivoBackup(file) {
    const zip = await JSZip.loadAsync(file);
    const manifestEntry = zip.file('manifest.json');
    if (!manifestEntry) throw new Error('Arquivo inválido: manifest.json não encontrado no .zip.');
    const manifest = JSON.parse(await manifestEntry.async('string'));
    manifest.buckets = manifest.buckets || {};
    manifest.tabelas = manifest.tabelas || {};

    const getRows = async (table) => {
        const info = manifest.tabelas[table];
        if (!info) return [];
        const entry = zip.file(`${info.pasta}/${table}.json`);
        if (!entry) return [];
        return JSON.parse(await entry.async('string'));
    };

    const getArquivosBucket = (bucket) => {
        const prefixo = `storage/${bucket}/`;
        return zip.file(new RegExp(`^${prefixo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`))
            .map(entry => ({ caminho: entry.name.slice(prefixo.length), entry }));
    };

    return {
        manifest,
        getRows,
        getArquivosBucket,
        tabelasDisponiveis: Object.keys(manifest.tabelas),
        bucketsDisponiveis: Object.keys(manifest.buckets),
    };
}
