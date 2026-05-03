/**
 * Testes — Lógica de categorias e cálculo de frete
 *
 * Foco: funções puras que não precisam de banco de dados.
 * São as mais fáceis de testar e as mais importantes de garantir,
 * pois afetam diretamente o valor financeiro dos romaneios.
 */

import { describe, it, expect } from 'vitest';
import {
    detectarCategoriaFrete,
    calcularFretePedido,
    getCategoriaConfig,
    fmtPct,
    FRETE_PERCENTUAL,
} from '../utils/freteConfig';

// ─── detectarCategoriaFrete ────────────────────────────────────────────────────

describe('detectarCategoriaFrete', () => {
    it('retorna "Outros" para nome vazio ou nulo', () => {
        expect(detectarCategoriaFrete('')).toBe('Outros');
        expect(detectarCategoriaFrete(null)).toBe('Outros');
        expect(detectarCategoriaFrete(undefined)).toBe('Outros');
    });

    it('detecta cimento corretamente (case-insensitive)', () => {
        expect(detectarCategoriaFrete('Cimento CP-II 50kg')).toBe('Cimento');
        expect(detectarCategoriaFrete('CIMENTO portland')).toBe('Cimento');
    });

    it('prioriza Telhas de Zinco quando nome contém "zinco"', () => {
        expect(detectarCategoriaFrete('Telha de Zinco 0.43mm')).toBe('Telhas de Zinco');
        // "telha" sem "zinco" deve cair em Telhas de Fibrocimento
        expect(detectarCategoriaFrete('Telha Brasilit')).toBe('Telhas de Fibrocimento');
    });

    it('detecta vergalhão com e sem acento', () => {
        expect(detectarCategoriaFrete('Vergalhão CA-50 10mm')).toBe('Ferragens');
        expect(detectarCategoriaFrete('vergalhao CA-60')).toBe('Ferragens');
    });

    it('detecta serralheria por múltiplas palavras-chave', () => {
        expect(detectarCategoriaFrete('Tubo quadrado 40x40')).toBe('Serralheria');
        expect(detectarCategoriaFrete('Perfil U enrijecido')).toBe('Serralheria');
        expect(detectarCategoriaFrete('Chapa lisa 2mm')).toBe('Serralheria');
    });

    it('retorna "Outros" para material desconhecido', () => {
        expect(detectarCategoriaFrete('Produto genérico XYZ')).toBe('Outros');
    });
});

// ─── calcularFretePedido ───────────────────────────────────────────────────────

describe('calcularFretePedido', () => {
    it('calcula frete de cimento: 7% do valor do pedido', () => {
        expect(calcularFretePedido(1000, 'Cimento')).toBeCloseTo(70);
    });

    it('calcula frete de ferragens: 6% do valor do pedido', () => {
        expect(calcularFretePedido(2000, 'Ferragens')).toBeCloseTo(120);
    });

    it('calcula frete de bobinas/zinco: 2% do valor do pedido', () => {
        expect(calcularFretePedido(5000, 'Telhas de Zinco')).toBeCloseTo(100);
    });

    it('usa percentual padrão de 5% para categoria desconhecida', () => {
        expect(calcularFretePedido(1000, 'CategoriaInexistente')).toBeCloseTo(50);
    });

    it('retorna 0 para valor de pedido nulo ou zero', () => {
        expect(calcularFretePedido(0, 'Cimento')).toBe(0);
        expect(calcularFretePedido(null, 'Ferragens')).toBe(0);
        expect(calcularFretePedido(undefined, 'Ferragens')).toBe(0);
    });

    it('todos os percentuais de categoria estão presentes e entre 0 e 1', () => {
        Object.entries(FRETE_PERCENTUAL).forEach(([cat, pct]) => {
            expect(pct).toBeGreaterThan(0);
            expect(pct).toBeLessThanOrEqual(1);
        });
    });
});

// ─── getCategoriaConfig ────────────────────────────────────────────────────────

describe('getCategoriaConfig', () => {
    it('retorna configuração correta para cimento', () => {
        const config = getCategoriaConfig('Cimento');
        expect(config.categoria).toBe('Cimento');
        expect(config.percentual).toBe(0.07);
        expect(config.cor).toBeDefined();
        expect(config.bg).toBeDefined();
    });

    it('retorna configuração padrão ("Outros") para categoria desconhecida', () => {
        const config = getCategoriaConfig('Categoria Inexistente');
        expect(config.categoria).toBe('Outros');
    });
});

// ─── fmtPct ───────────────────────────────────────────────────────────────────

describe('fmtPct', () => {
    it('formata 0.07 como "7%"', () => {
        expect(fmtPct(0.07)).toBe('7%');
    });

    it('formata 0.025 como "2,5%"', () => {
        // pt-BR usa vírgula como separador decimal
        expect(fmtPct(0.025)).toMatch(/2[,.]?5%/);
    });

    it('retorna "0%" para valor nulo', () => {
        expect(fmtPct(null)).toBe('0%');
        expect(fmtPct(undefined)).toBe('0%');
    });
});
