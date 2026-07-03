import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import { supabase } from './supabaseClient';

// ═══════════════════════════════════════════════════════════════════════════
// LogiFlow — Backup e Restauração
//
// Exporta/importa os dados do Supabase (tabelas) e os arquivos anexados no
// Supabase Storage (CNH de motoristas) como um único arquivo .zip, organizado
// por pastas (módulos). Cada tabela vira dois arquivos — um .json (para a
// reimportação funcionar) e um .xlsx (para leitura/edição fácil em Excel).
// O admin escolhe, na tela, quais módulos/tabelas/anexos deseja exportar ou
// importar (total ou parcial).
//
// Estrutura do .zip gerado:
//   manifest.json                          → metadados do backup (data, versão, contagens)
//   01-usuarios/user_profiles.json
//   01-usuarios/user_profiles.xlsx
//   02-carretas/carretas_veiculos.json
//   02-carretas/carretas_veiculos.xlsx
//   ...
//   storage/cnh-documents/cnh_123.jpg       → arquivos baixados do Storage
// ═══════════════════════════════════════════════════════════════════════════

export const BACKUP_VERSION = 1;

// ── Catálogo de módulos e tabelas ─────────────────────────────────────────
// `pk`   → coluna usada como chave de conflito no upsert (padrão: 'id')
// `nice` → nome amigável exibido na tela
// ── Buckets do Supabase Storage (arquivos/anexos) ──────────────────────────
// Cada bucket é vinculado ao módulo ao qual pertence, pra aparecer junto na tela.
export const BACKUP_BUCKETS = [
    { id: 'cnh-documents', nice: 'CNH dos motoristas (documentos/fotos)', moduleId: 'usuarios' },
];

export const BUCKET_INDEX = BACKUP_BUCKETS.reduce((acc, b) => { acc[b.id] = b; return acc; }, {});

export const BACKUP_MODULES = [
    {
        id: 'usuarios',
        label: 'Usuários & Perfis',
        icon: 'Users',
        folder: '01-usuarios',
        buckets: ['cnh-documents'],
        tables: [
            { name: 'user_profiles', nice: 'Perfis de usuário', pk: 'id', aviso: 'Vinculado ao login (auth). Restaurar só recria o perfil se o usuário já existir no Supabase Auth.' },
        ],
    },
    {
        id: 'caminhoes',
        label: 'Caminhões (frota)',
        icon: 'Truck',
        folder: '02-caminhoes',
        tables: [
            { name: 'vehicles', nice: 'Veículos' },
            { name: 'vehicle_history', nice: 'Histórico de veículos' },
            { name: 'maintenance_alerts', nice: 'Alertas de manutenção' },
            { name: 'caminhoes_despesas', nice: 'Despesas de caminhões' },
            { name: 'caminhoes_fornecedores', nice: 'Fornecedores (caminhões)' },
        ],
    },
    {
        id: 'carretas',
        label: 'Carretas (frota)',
        icon: 'ShieldCheck',
        folder: '03-carretas',
        tables: [
            { name: 'carretas_veiculos', nice: 'Veículos (cavalo/implemento)' },
            { name: 'carretas_empresas', nice: 'Empresas/transportadoras' },
            { name: 'carretas_postos', nice: 'Postos de combustível' },
            { name: 'carretas_pontos_parada', nice: 'Pontos de parada' },
            { name: 'carretas_config', nice: 'Configurações da frota' },
            { name: 'carretas_checklists', nice: 'Checklists' },
            { name: 'carretas_ordens_servico', nice: 'Ordens de serviço' },
            { name: 'carretas_registros_viagem', nice: 'Registros de viagem' },
            { name: 'carretas_viagens', nice: 'Viagens' },
            { name: 'carretas_carregamentos', nice: 'Carregamentos' },
            { name: 'carretas_diarias', nice: 'Diárias' },
            { name: 'carretas_abastecimentos', nice: 'Abastecimentos' },
            { name: 'carretas_despesas_extras', nice: 'Despesas extras' },
            { name: 'carretas_bonificacoes_extras', nice: 'Bonificações extras' },
            { name: 'carretas_fretes', nice: 'Fretes' },
            { name: 'carretas_fornecedores', nice: 'Fornecedores (carretas)' },
            { name: 'carretas_notificacoes', nice: 'Notificações' },
        ],
    },
    {
        id: 'romaneios_carretas',
        label: 'Romaneios (carretas)',
        icon: 'FileText',
        folder: '04-romaneios-carretas',
        tables: [
            { name: 'carretas_romaneios', nice: 'Romaneios de carretas' },
            { name: 'carretas_romaneio_itens', nice: 'Itens dos romaneios' },
        ],
    },
    {
        id: 'romaneios',
        label: 'Romaneios (caminhões)',
        icon: 'ClipboardList',
        folder: '05-romaneios',
        tables: [
            { name: 'romaneios', nice: 'Romaneios' },
            { name: 'romaneio_itens', nice: 'Itens dos romaneios' },
            { name: 'romaneio_pedidos', nice: 'Pedidos vinculados' },
            { name: 'bonificacoes', nice: 'Bonificações' },
            { name: 'rota_corredores', nice: 'Corredores de rota' },
        ],
    },
    {
        id: 'custos_rodagem',
        label: 'Custos de Rodagem',
        icon: 'Calculator',
        folder: '06-custos-rodagem',
        tables: [
            { name: 'custos_itens', nice: 'Itens de custo (KM/dia)' },
            { name: 'custos_config', nice: 'Margem padrão', pk: 'tipo_veiculo' },
            { name: 'custos_destinos', nice: 'Estimativa por destino' },
        ],
    },
    {
        id: 'materiais',
        label: 'Materiais',
        icon: 'Package',
        folder: '07-materiais',
        tables: [
            { name: 'materials', nice: 'Materiais' },
        ],
    },
    {
        id: 'despesas_adm',
        label: 'Despesas Administrativas',
        icon: 'Receipt',
        folder: '08-despesas-adm',
        tables: [
            { name: 'transporte_despesas_adm', nice: 'Despesas adm. (transporte)' },
            { name: 'despesas_adm_fornecedores', nice: 'Fornecedores (desp. adm.)' },
            { name: 'duplicatas_verificadas', nice: 'Duplicatas verificadas' },
        ],
    },
    {
        id: 'sistema',
        label: 'Sistema & Configurações',
        icon: 'Settings',
        folder: '09-sistema',
        tables: [
            { name: 'notifications', nice: 'Notificações' },
            { name: 'ai_suggestions_dismissed', nice: 'Sugestões de IA dispensadas' },
        ],
    },
];

// Mapa rápido nome-da-tabela → definição (com módulo pai)
export const TABLE_INDEX = BACKUP_MODULES.flatMap(m =>
    m.tables.map(t => ({ ...t, moduleId: m.id, moduleLabel: m.label, folder: m.folder }))
).reduce((acc, t) => { acc[t.name] = t; return acc; }, {});

// Ordem de importação segura (tabelas "pai" antes das "filhas", conforme FKs
// identificadas nas migrations). Tabelas não listadas aqui entram no fim,
// na ordem em que aparecem no catálogo.
const IMPORT_ORDER = [
    'user_profiles',
    'materials',
    'carretas_empresas', 'carretas_postos', 'carretas_pontos_parada', 'carretas_veiculos', 'carretas_config',
    'vehicles',
    'custos_itens', 'custos_config', 'custos_destinos',
    'carretas_fornecedores', 'caminhoes_fornecedores', 'despesas_adm_fornecedores',
    'carretas_romaneios', 'carretas_romaneio_itens',
    'romaneios', 'romaneio_itens', 'romaneio_pedidos',
    'carretas_carregamentos', 'carretas_viagens', 'carretas_registros_viagem',
    'carretas_diarias', 'carretas_abastecimentos', 'carretas_despesas_extras', 'carretas_bonificacoes_extras',
    'carretas_fretes', 'carretas_checklists', 'carretas_ordens_servico',
    'bonificacoes', 'rota_corredores',
    'vehicle_history', 'maintenance_alerts', 'caminhoes_despesas',
    'transporte_despesas_adm', 'duplicatas_verificadas',
    'notifications', 'carretas_notificacoes', 'ai_suggestions_dismissed',
];

function ordenarParaImportacao(tableNames) {
    const known = IMPORT_ORDER.filter(t => tableNames.includes(t));
    const rest = tableNames.filter(t => !IMPORT_ORDER.includes(t));
    return [...known, ...rest];
}

// ── Geração de planilha .xlsx a partir das linhas de uma tabela ─────────────
// Colunas com valor objeto/array (jsonb) são convertidas para texto (JSON),
// já que célula de planilha não representa estrutura aninhada.
function linhasParaPlanilha(rows) {
    return rows.map(row => {
        const linha = {};
        for (const [chave, valor] of Object.entries(row)) {
            if (valor !== null && typeof valor === 'object') {
                linha[chave] = JSON.stringify(valor);
            } else {
                linha[chave] = valor;
            }
        }
        return linha;
    });
}

function gerarXlsxArrayBuffer(rows, nomeAba) {
    const planilha = XLSX.utils.json_to_sheet(linhasParaPlanilha(rows));
    const livro = XLSX.utils.book_new();
    // Nome da aba: máx. 31 caracteres, sem caracteres inválidos do Excel
    const aba = (nomeAba || 'Dados').replace(/[\\/*?:[\]]/g, '').slice(0, 31) || 'Dados';
    XLSX.utils.book_append_sheet(livro, planilha, aba);
    return XLSX.write(livro, { type: 'array', bookType: 'xlsx' });
}

// ── Leitura paginada (contorna o limite padrão de 1000 linhas do Supabase) ──
async function fetchAllRows(table, onProgress) {
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
async function listarArquivosBucket(bucket, prefixo = '') {
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

async function limparBucket(bucket) {
    const arquivos = await listarArquivosBucket(bucket);
    if (!arquivos.length) return;
    const CHUNK = 100;
    for (let i = 0; i < arquivos.length; i += CHUNK) {
        const { error } = await supabase.storage.from(bucket).remove(arquivos.slice(i, i + CHUNK));
        if (error) throw new Error(`Erro ao limpar bucket "${bucket}": ${error.message}`);
    }
}

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
