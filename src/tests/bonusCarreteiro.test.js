import { describe, it, expect } from 'vitest';
import { calcularBonusCarreteiro, kmDoDestino, normalizarCidade } from 'services/carretas/bonificacao';
import { calcularBonificacao } from 'services/bonificacaoService';

const km = { urandi: 90, guanambi: 400, 'bom jesus da lapa': 700, salvador: 850, 'belo horizonte': 950 };
const cfgKm = {
    modo: 'km', bonusBaixo: 60, bonusAlto: 120, kmPorCidade: km,
    faixasKm: [{ ateKm: 700, valor: 60 }, { ateKm: 900, valor: 90 }], valorAcimaKm: 150,
};

describe('bônus carreteiro — modo fixo', () => {
    it('cidade de rodízio paga o valor baixo, demais o alto', () => {
        expect(calcularBonusCarreteiro('Urandi', { bonusBaixo: 60, bonusAlto: 120 })).toBe(60);
        expect(calcularBonusCarreteiro('Salvador', { bonusBaixo: 60, bonusAlto: 120 })).toBe(120);
    });
});

describe('bônus carreteiro — modo por KM', () => {
    it('usa a faixa do km da tabela de fretes', () => {
        expect(calcularBonusCarreteiro('Guanambi', cfgKm)).toBe(60);
        expect(calcularBonusCarreteiro('Bom Jesus da Lapa', cfgKm)).toBe(60); // limite da faixa inclui 700
        expect(calcularBonusCarreteiro('Salvador', cfgKm)).toBe(90);
        expect(calcularBonusCarreteiro('Belo Horizonte', cfgKm)).toBe(150);
    });
    it('aceita destino com UF/acentos e ignora caixa', () => {
        expect(calcularBonusCarreteiro('SALVADOR - BA', cfgKm)).toBe(90);
        expect(normalizarCidade('Pilões - BA')).toBe('piloes');
    });
    it('destino sem km cadastrado cai na regra fixa', () => {
        expect(calcularBonusCarreteiro('Cidade Desconhecida', cfgKm)).toBe(120);
        expect(kmDoDestino('Cidade Desconhecida', km)).toBeNull();
    });
});

describe('bônus caminhão — valores padrão editáveis', () => {
    const rom = { romaneio_itens: [
        { peso_total: 10000, materials: { categoria_frete: 'Ferragem' } },
        { peso_total: 500, materials: { categoria_frete: 'Cimento' } },
    ] };
    it('usa o padrão sem config', () => {
        expect(calcularBonificacao(rom).valorTotal).toBe(130); // 10t*9 + 40
    });
    it('usa os valores salvos pelo admin', () => {
        expect(calcularBonificacao(rom, { taxaFerragemKg: 0.012, valorCimento: 50 }).valorTotal).toBe(170);
    });
});
