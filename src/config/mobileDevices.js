// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURAÇÃO GLOBAL — APARELHOS MÓVEIS
// Fonte única dos tamanhos de tela que o LogiFlow precisa suportar.
// Os mesmos limites estão em src/styles/mobile.css (media queries) e no
// tailwind.config.js (breakpoint "xxs"). Se mudar aqui, mude lá também.
// Larguras em pixels CSS (o que o navegador enxerga, não a resolução física).
// ═══════════════════════════════════════════════════════════════════════════

// Limite SUPERIOR (inclusive) de cada faixa
export const MOBILE_BREAKPOINTS = {
    xxs: 339,   // compacto: Galaxy Fold fechado (~280), iPhone SE 1ª ger. (320)
    xs:  374,   // pequeno: Androids de 360 (Galaxy A/S, Moto G)
    sm:  413,   // padrão: iPhone 375/390/393, Pixel/Galaxy 412
    md:  479,   // grande: iPhone Plus/Pro Max 428–430
    lg:  767,   // celular em paisagem / tablet pequeno / Fold aberto
    // acima de 767 = 'tablet' (iPad e telas maiores)
};

// Catálogo de referência — use como roteiro de teste (DevTools → Dimensions)
export const DEVICE_PROFILES = [
    { nome: 'Galaxy Fold (fechado)',        largura: 280, altura: 653,  faixa: 'xxs' },
    { nome: 'iPhone SE (1ª geração)',       largura: 320, altura: 568,  faixa: 'xxs' },
    { nome: 'Galaxy A / S (padrão Android)',largura: 360, altura: 800,  faixa: 'xs'  },
    { nome: 'Moto G / Redmi',               largura: 360, altura: 780,  faixa: 'xs'  },
    { nome: 'iPhone SE (2ª/3ª) / mini',     largura: 375, altura: 667,  faixa: 'sm'  },
    { nome: 'iPhone 12 / 13 / 14',          largura: 390, altura: 844,  faixa: 'sm'  },
    { nome: 'iPhone 15 / 16',               largura: 393, altura: 852,  faixa: 'sm'  },
    { nome: 'Pixel 7 / 8 · Galaxy S Ultra', largura: 412, altura: 915,  faixa: 'sm'  },
    { nome: 'iPhone Pro Max',               largura: 430, altura: 932,  faixa: 'md'  },
    { nome: 'Celular em paisagem',          largura: 844, altura: 390,  faixa: 'tablet' },
    { nome: 'Galaxy Fold (aberto)',         largura: 673, altura: 841,  faixa: 'lg'  },
    { nome: 'iPad mini',                    largura: 744, altura: 1133, faixa: 'lg'  },
    { nome: 'iPad / iPad Air',              largura: 820, altura: 1180, faixa: 'tablet' },
];

/** Devolve a faixa ('xxs' | 'xs' | 'sm' | 'md' | 'lg' | 'tablet') para uma largura em px. */
export function getTier(largura) {
    if (largura <= MOBILE_BREAKPOINTS.xxs) return 'xxs';
    if (largura <= MOBILE_BREAKPOINTS.xs)  return 'xs';
    if (largura <= MOBILE_BREAKPOINTS.sm)  return 'sm';
    if (largura <= MOBILE_BREAKPOINTS.md)  return 'md';
    if (largura <= MOBILE_BREAKPOINTS.lg)  return 'lg';
    return 'tablet';
}
