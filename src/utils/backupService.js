import JSZip from 'jszip';
import { supabase } from './supabaseClient';

// ═══════════════════════════════════════════════════════════════════════════
// LogiFlow — Backup e Restauração
//
// Exporta/importa os dados do Supabase como um arquivo .zip organizado por
// pastas (módulos) e arquivos .json (um por tabela). O admin escolhe, na tela,
// quais módulos/tabelas deseja exportar ou importar (total ou parcial).
//
// Estrutura do .zip gerado:
//   manifest.json                 → metadados do backup (data, versão, contagens)
//   01-usuarios/user_profiles.json
//   02-carretas/carretas_veiculos.json
//   02-carretas/carretas_romaneios.json
//   ...
// ═══════════════════════════════════════════════════════════════════════════

export const BACKUP_VERSION = 1;

// ── Catálogo de módulos e tabelas ─────────────────────────────────────────
// `pk`   → coluna usada como chave de conflito no upsert (padrão: 'id')
// `nice` → nome amigável exibido na tela
export const BACKUP_MODULES = [
    {
        id: 'usuarios',
        label: 'Usuários & Perfis',
        icon: 'Users',
        folder: '01-usuarios',
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
        label: 'Materiais & Catálogo',
        icon: 'Package',
        folder: '07-materiais',
        tables: [
            { name: 'materials', nice: 'Materiais' },
            { name: 'products', nice: 'Produtos (catálogo)' },
            { name: 'quotes', nice: 'Orçamentos/cotações' },
            { name: 'quote_responses', nice: 'Respostas de cotação' },
            { name: 'orders', nice: 'Pedidos (loja)' },
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
            { name: 'settings', nice: 'Configurações gerais', pk: 'key' },
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
    'settings',
    'materials', 'products',
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
    'quotes', 'quote_responses', 'orders',
    'notifications', 'carretas_notificacoes', 'ai_suggestions_dismissed',
];

function ordenarParaImportacao(tableNames) {
    const known = IMPORT_ORDER.filter(t => tableNames.includes(t));
    const rest = tableNames.filter(t => !IMPORT_ORDER.includes(t));
    return [...known, ...rest];
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

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTAÇÃO
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Gera o .zip de backup para as tabelas selecionadas.
 * @param {string[]} tableNames - nomes das tabelas a exportar
 * @param {(msg:string)=>void} onProgress - callback de progresso (texto)
 * @returns {Promise<Blob>}
 */
export async function exportBackup(tableNames, onProgress) {
    const zip = new JSZip();
    const manifest = {
        app: 'LogiFlow',
        tipo: 'backup',
        versao: BACKUP_VERSION,
        gerado_em: new Date().toISOString(),
        tabelas: {},
    };

    for (const table of tableNames) {
        const def = TABLE_INDEX[table];
        const folder = def?.folder || 'outros';
        onProgress?.(`Exportando ${def?.nice || table}…`);
        const rows = await fetchAllRows(table, onProgress);
        zip.file(`${folder}/${table}.json`, JSON.stringify(rows, null, 2));
        manifest.tabelas[table] = {
            modulo: def?.moduleId || 'outros',
            pasta: folder,
            linhas: rows.length,
        };
    }

    zip.file('manifest.json', JSON.stringify(manifest, null, 2));
    onProgress?.('Compactando arquivo .zip…');
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
    return { blob, manifest };
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
 * Lê um arquivo .zip de backup e retorna o manifesto + função para extrair
 * as linhas de cada tabela sob demanda.
 */
export async function lerArquivoBackup(file) {
    const zip = await JSZip.loadAsync(file);
    const manifestEntry = zip.file('manifest.json');
    if (!manifestEntry) throw new Error('Arquivo inválido: manifest.json não encontrado no .zip.');
    const manifest = JSON.parse(await manifestEntry.async('string'));

    const getRows = async (table) => {
        const info = manifest.tabelas[table];
        if (!info) return [];
        const entry = zip.file(`${info.pasta}/${table}.json`);
        if (!entry) return [];
        return JSON.parse(await entry.async('string'));
    };

    return { manifest, getRows, tabelasDisponiveis: Object.keys(manifest.tabelas) };
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
 * Importa as tabelas selecionadas de um backup já carregado (via lerArquivoBackup).
 * @param {{manifest:object, getRows:Function}} backup
 * @param {string[]} tableNames
 * @param {'mesclar'|'substituir'} modo
 * @param {(msg:string)=>void} onProgress
 */
export async function importarBackup(backup, tableNames, modo, onProgress) {
    const ordenadas = ordenarParaImportacao(tableNames);
    const resultado = { ok: [], erros: [] };

    // Em modo "substituir", limpamos as tabelas na ordem inversa (filhas primeiro)
    // para não violar chaves estrangeiras.
    if (modo === 'substituir') {
        for (const table of [...ordenadas].reverse()) {
            try {
                onProgress?.(`Limpando ${TABLE_INDEX[table]?.nice || table}…`);
                await limparTabela(table);
            } catch (e) {
                resultado.erros.push({ table, etapa: 'limpar', erro: e.message });
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

    return resultado;
}
