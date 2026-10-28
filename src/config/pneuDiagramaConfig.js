/**
 * pneuDiagramaConfig.js
 * Definição das configurações de pneus por tipo de veículo, usada no
 * diagrama visual (tela do mecânico) para marcar em qual posição do
 * veículo um pneu foi instalado.
 *
 * Segue o mesmo padrão do diagrama de referência (esboço lateral + esquema
 * de eixos vista superior): cada eixo é classificado como
 *  D = Direcional (dianteiro)
 *  T = Tração (traseiro fixo/motriz)
 *  A = Auxiliar/apoio (suspensível, não motriz)
 *
 * Cada posição de pneu tem:
 *  - id: identificador salvo em `pneus.posicao_diagrama`
 *  - label: texto legível (ex.: "1º Eixo — Dianteiro Esquerdo")
 *  - eixo: número do eixo (1 = dianteiro, 2, 3, 4...)
 *  - lado: 'esquerdo' | 'direito'
 *  - rodagem: 'simples' | 'interna' | 'externa' (dupla = interna+externa)
 *  - x, y: coordenadas (%) para posicionar o pneu no SVG, veículo desenhado
 *    "de cima", com a frente do veículo voltada para cima (y menor = frente)
 */

// ─────────────────────────────────────────────────────────────────────────
// Helper: gera as posições de um eixo com rodagem simples (1 pneu de cada lado)
// ─────────────────────────────────────────────────────────────────────────
function eixoSimples(eixo, y, label, tipoEixo = 'D') {
    return [
        { id: `e${eixo}_esq`, label: `${label} — Esquerdo`, eixo, tipoEixo, lado: 'esquerdo', rodagem: 'simples', x: 18, y },
        { id: `e${eixo}_dir`, label: `${label} — Direito`, eixo, tipoEixo, lado: 'direito', rodagem: 'simples', x: 82, y },
    ];
}

// Eixo com rodagem dupla (2 pneus de cada lado: interno/externo)
function eixoDuplo(eixo, y, label, tipoEixo = 'T') {
    return [
        { id: `e${eixo}_esq_ext`, label: `${label} — Esquerdo Externo`, eixo, tipoEixo, lado: 'esquerdo', rodagem: 'externa', x: 10, y },
        { id: `e${eixo}_esq_int`, label: `${label} — Esquerdo Interno`, eixo, tipoEixo, lado: 'esquerdo', rodagem: 'interna', x: 24, y },
        { id: `e${eixo}_dir_int`, label: `${label} — Direito Interno`, eixo, tipoEixo, lado: 'direito', rodagem: 'interna', x: 76, y },
        { id: `e${eixo}_dir_ext`, label: `${label} — Direito Externo`, eixo, tipoEixo, lado: 'direito', rodagem: 'externa', x: 90, y },
    ];
}

// ─────────────────────────────────────────────────────────────────────────
// Configurações
// ─────────────────────────────────────────────────────────────────────────
export const CONFIGURACOES_PNEUS = {
    mb710_2_eixos: {
        label: 'MB 710 (2 Eixos)',
        silhueta: 'caminhao_leve',
        eixoConfig: '4x2',
        totalPneus: 4,
        grupos: [{ nome: 'Cavalo/Chassi único', eixoIni: 1, eixoFim: 2 }],
        posicoes: [
            ...eixoSimples(1, 12, '1º Eixo (Dianteiro)', 'D'),
            ...eixoSimples(2, 42, '2º Eixo (Traseiro)', 'T'),
        ],
    },
    toco_2_eixos: {
        label: 'Toco (2 Eixos)',
        silhueta: 'caminhao_leve',
        eixoConfig: '4x2',
        totalPneus: 6,
        grupos: [{ nome: 'Cavalo/Chassi único', eixoIni: 1, eixoFim: 2 }],
        posicoes: [
            ...eixoSimples(1, 12, '1º Eixo (Dianteiro)', 'D'),
            ...eixoDuplo(2, 42, '2º Eixo (Traseiro)', 'T'),
        ],
    },
    truck_3_eixos: {
        label: 'Truck (3 Eixos)',
        silhueta: 'truck',
        eixoConfig: '6x2 / 6x4',
        totalPneus: 10,
        grupos: [{ nome: 'Cavalo/Chassi único', eixoIni: 1, eixoFim: 3 }],
        posicoes: [
            ...eixoSimples(1, 10, '1º Eixo (Dianteiro)', 'D'),
            ...eixoDuplo(2, 38, '2º Eixo (Truque Fixo)', 'T'),
            ...eixoDuplo(3, 58, '3º Eixo (Truque Suspensível)', 'A'),
        ],
    },
    bitruck_4_eixos: {
        label: 'Bitruck (4 Eixos)',
        silhueta: 'bitruck',
        eixoConfig: '8x2 / 8x4',
        totalPneus: 12,
        grupos: [{ nome: 'Cavalo/Chassi único', eixoIni: 1, eixoFim: 4 }],
        posicoes: [
            ...eixoSimples(1, 8, '1º Eixo (Dianteiro)', 'D'),
            ...eixoSimples(2, 26, '2º Eixo (Auxiliar Susp.)', 'A'),
            ...eixoDuplo(3, 50, '3º Eixo (Truque Fixo)', 'T'),
            ...eixoDuplo(4, 70, '4º Eixo (Truque Susp.)', 'A'),
        ],
    },
    carreta_9_eixos: {
        label: 'Carreta 9 Eixos (Bitrem/Rodotrem)',
        silhueta: 'rodotrem',
        eixoConfig: '9x4',
        totalPneus: 34,
        // Cavalo mecânico (eixos 1-3) + dois semirreboques de 3 eixos cada (24 pneus nos reboques)
        grupos: [
            { nome: 'Cavalo (6x4)', eixoIni: 1, eixoFim: 3 },
            { nome: '1º Reboque', eixoIni: 4, eixoFim: 6 },
            { nome: '2º Reboque', eixoIni: 7, eixoFim: 9 },
        ],
        posicoes: [
            ...eixoSimples(1, 6, 'Cavalo — 1º Eixo (Dianteiro)', 'D'),
            ...eixoDuplo(2, 20, 'Cavalo — 2º Eixo (Tração)', 'T'),
            ...eixoDuplo(3, 34, 'Cavalo — 3º Eixo (Tração)', 'T'),
            ...eixoDuplo(4, 52, '1º Reboque — 1º Eixo', 'A'),
            ...eixoDuplo(5, 62, '1º Reboque — 2º Eixo', 'A'),
            ...eixoDuplo(6, 72, '1º Reboque — 3º Eixo', 'A'),
            ...eixoDuplo(7, 84, '2º Reboque — 1º Eixo', 'A'),
            ...eixoDuplo(8, 94, '2º Reboque — 2º Eixo', 'A'),
            ...eixoDuplo(9, 104, '2º Reboque — 3º Eixo', 'A'),
        ],
    },
};

export const CONFIGURACOES_OPTIONS = Object.entries(CONFIGURACOES_PNEUS)
    .map(([value, cfg]) => ({ value, label: `${cfg.label} — ${cfg.totalPneus} pneus` }));

// Cores por tipo de eixo — mesmo código do diagrama de referência (D azul / T verde / A laranja)
export const COR_TIPO_EIXO = { D: '#2563EB', T: '#7C3AED', A: '#EA580C' };
export const LABEL_TIPO_EIXO = { D: 'Direcional', T: 'Tração', A: 'Auxiliar' };

export function getConfiguracao(key) {
    return CONFIGURACOES_PNEUS[key] || null;
}

export function getLabelPosicao(configKey, posicaoId) {
    const cfg = getConfiguracao(configKey);
    if (!cfg) return posicaoId || '—';
    return cfg.posicoes.find(p => p.id === posicaoId)?.label || posicaoId || '—';
}
