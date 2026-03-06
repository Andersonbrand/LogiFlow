/**
 * freteConfig.js
 * Configuração central dos percentuais de frete por categoria.
 * Fonte: regras de negócio da Comercial Araguaia.
 */

// Percentuais de frete: aplicados sobre o VALOR DO PEDIDO
export const FRETE_CATEGORIAS = [
    { categoria: 'Cimento',               percentual: 0.0567, label: 'Cimento',               cor: '#92400E', bg: '#FEF3C7' },
    { categoria: 'Ferragens',             percentual: 0.06,   label: 'Ferragens',             cor: '#1D4ED8', bg: '#DBEAFE' },
    { categoria: 'Telhas de Zinco',       percentual: 0.02,   label: 'Telhas de Zinco',       cor: '#065F46', bg: '#D1FAE5' },
    { categoria: 'Treliças',              percentual: 0.03,   label: 'Treliças',              cor: '#6B21A8', bg: '#F3E8FF' },
    { categoria: 'Colunas',               percentual: 0.04,   label: 'Colunas',               cor: '#0E7490', bg: '#CFFAFE' },
    { categoria: 'Telhas de Fibrocimento',percentual: 0.06,   label: 'Telhas de Fibrocimento',cor: '#DC2626', bg: '#FEE2E2' },
    { categoria: 'Outros',                percentual: 0.05,   label: 'Outros',                cor: '#374151', bg: '#F3F4F6' },
];

// Mapa rápido: categoria -> percentual
export const FRETE_PERCENTUAL = Object.fromEntries(
    FRETE_CATEGORIAS.map(f => [f.categoria, f.percentual])
);

// Mapa para lookup por nome do material (fallback via nome)
export const FRETE_NOME_MAP = {
    'cimento':    'Cimento',
    'vergalhao':  'Ferragens',
    'vergalhão':  'Ferragens',
    'barra':      'Ferragens',
    'metalon':    'Ferragens',
    'tubo':       'Ferragens',
    'cantoneira': 'Ferragens',
    'perfil':     'Ferragens',
    'chapa':      'Ferragens',
    'arame':      'Ferragens',
    'prego':      'Ferragens',
    'parafuso':   'Ferragens',
    'grampo':     'Ferragens',
    'disco':      'Ferragens',
    'eletrodo':   'Ferragens',
    'telha':      'Telhas de Fibrocimento', // default telha = fibrocimento
    'fibrotex':   'Telhas de Fibrocimento',
    'fibrocimento':'Telhas de Fibrocimento',
    'zinco':      'Telhas de Zinco',
    'bobina':     'Telhas de Zinco',
    'bobininha':  'Telhas de Zinco',
    'treli':      'Treliças',              // treliça
    'coluna':     'Colunas',
    'painel':     'Colunas',
    'malha':      'Ferragens',
    'aço':        'Ferragens',
    'aco':        'Ferragens',
};

/**
 * Detecta a categoria de frete a partir do nome de um material.
 * Retorna a categoria ou 'Outros' como fallback.
 */
export function detectarCategoriaFrete(nomeMaterial) {
    if (!nomeMaterial) return 'Outros';
    const lower = nomeMaterial.toLowerCase();
    for (const [chave, categoria] of Object.entries(FRETE_NOME_MAP)) {
        if (lower.includes(chave)) return categoria;
    }
    return 'Outros';
}

/**
 * Calcula o frete de um pedido com base na categoria e valor.
 */
export function calcularFretePedido(valorPedido, categoria) {
    const pct = FRETE_PERCENTUAL[categoria] ?? 0.05;
    return Number(valorPedido || 0) * pct;
}

/**
 * Retorna o objeto de configuração de uma categoria.
 */
export function getCategoriaConfig(categoria) {
    return FRETE_CATEGORIAS.find(f => f.categoria === categoria) || FRETE_CATEGORIAS[FRETE_CATEGORIAS.length - 1];
}

/**
 * Formata o percentual para exibição: ex. 0.0567 → "5,67%"
 */
export function fmtPct(pct) {
    return (Number(pct || 0) * 100).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + '%';
}
