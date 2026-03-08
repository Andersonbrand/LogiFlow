export const FRETE_CATEGORIAS = [
    { categoria: 'Cimento',                percentual: 0.07,   label: 'Cimento',                cor: '#92400E', bg: '#FEF3C7' },
    { categoria: 'Ferragens',              percentual: 0.06,   label: 'Ferragens',              cor: '#1D4ED8', bg: '#DBEAFE' },
    { categoria: 'Telhas de Zinco',        percentual: 0.02,   label: 'Telhas de Zinco',        cor: '#065F46', bg: '#D1FAE5' },
    { categoria: 'Telhas de Fibrocimento', percentual: 0.06,   label: 'Telhas de Fibrocimento', cor: '#DC2626', bg: '#FEE2E2' },
    { categoria: 'Treliças',               percentual: 0.03,   label: 'Treliças',               cor: '#6B21A8', bg: '#F3E8FF' },
    { categoria: 'Colunas',                percentual: 0.04,   label: 'Colunas',                cor: '#0E7490', bg: '#CFFAFE' },
    { categoria: 'Serralheria',            percentual: 0.06,   label: 'Serralheria',            cor: '#B45309', bg: '#FEF3C7' },
    { categoria: 'Arames',                 percentual: 0.06,   label: 'Arames',                 cor: '#0F766E', bg: '#CCFBF1' },
    { categoria: 'Prego e Agro',           percentual: 0.06,   label: 'Prego e Agro',           cor: '#15803D', bg: '#DCFCE7' },
    { categoria: 'Parafusos',              percentual: 0.06,   label: 'Parafusos',              cor: '#9333EA', bg: '#F3E8FF' },
    { categoria: 'Bobinas',                percentual: 0.02,   label: 'Bobinas',                cor: '#065F46', bg: '#D1FAE5' },
    { categoria: 'Outros',                 percentual: 0.05,   label: 'Outros',                 cor: '#374151', bg: '#F3F4F6' },
];

export const FRETE_PERCENTUAL = Object.fromEntries(
    FRETE_CATEGORIAS.map(f => [f.categoria, f.percentual])
);

export const FRETE_NOME_MAP = {
    'cimento':        'Cimento',
    'vergalhao':      'Ferragens',
    'vergalhão':      'Ferragens',

    'arame':          'Arames',
    'prego':          'Prego e Agro',
    'grampo':         'Prego e Agro',
    'parafuso':       'Parafusos',
    'disco':          'Serralheria',
    'eletrodo':       'Serralheria',
    'tubo':           'Serralheria',
    'metalon':        'Serralheria',
    'cantoneira':     'Serralheria',
    'perfil':         'Serralheria',
    'chapa':          'Serralheria',
    'barra':          'Serralheria',
    'lambri':         'Serralheria',
    'selante':        'Serralheria',
    'zinco':          'Telhas de Zinco',
    'bobina':         'Bobinas',
    'bobininha':      'Bobinas',
    'fibrocimento':   'Telhas de Fibrocimento',
    'fibrotex':       'Telhas de Fibrocimento',
    'eternit':        'Telhas de Fibrocimento',
    'brasilit':       'Telhas de Fibrocimento',
    'telha':          'Telhas de Fibrocimento',
    'treli':          'Treliças',
    'coluna':         'Colunas',
    'painel':         'Colunas',
    'malha':          'Ferragens',
    'aço':            'Ferragens',
    'aco':            'Ferragens',
};

export function detectarCategoriaFrete(nomeMaterial) {
    if (!nomeMaterial) return 'Outros';
    const lower = nomeMaterial.toLowerCase();
    // Zinco tem prioridade sobre telha genérica
    if (lower.includes('zinco') || lower.includes('bobina')) return 'Telhas de Zinco';
    for (const [chave, categoria] of Object.entries(FRETE_NOME_MAP)) {
        if (lower.includes(chave)) return categoria;
    }
    return 'Outros';
}

export function calcularFretePedido(valorPedido, categoria) {
    const pct = FRETE_PERCENTUAL[categoria] ?? 0.05;
    return Number(valorPedido || 0) * pct;
}

export function getCategoriaConfig(categoria) {
    return FRETE_CATEGORIAS.find(f => f.categoria === categoria) || FRETE_CATEGORIAS[FRETE_CATEGORIAS.length - 1];
}

export function fmtPct(pct) {
    return (Number(pct || 0) * 100).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + '%';
}
