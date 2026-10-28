import * as XLSX from 'xlsx';

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

export function ordenarParaImportacao(tableNames) {
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

export function gerarXlsxArrayBuffer(rows, nomeAba) {
    const planilha = XLSX.utils.json_to_sheet(linhasParaPlanilha(rows));
    const livro = XLSX.utils.book_new();
    // Nome da aba: máx. 31 caracteres, sem caracteres inválidos do Excel
    const aba = (nomeAba || 'Dados').replace(/[\\/*?:[\]]/g, '').slice(0, 31) || 'Dados';
    XLSX.utils.book_append_sheet(livro, planilha, aba);
    return XLSX.write(livro, { type: 'array', bookType: 'xlsx' });
}
