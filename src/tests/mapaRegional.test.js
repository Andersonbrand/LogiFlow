import { describe, it, expect } from 'vitest';
import { agregarMapa, chaveMunicipio, poloMaisProximo } from 'pages/carretas/components/TabMapaRegional/utils/agregar';

describe('mapa regional — agregação', () => {
    it('reconhece cidades com UF, acento e parênteses', () => {
        expect(chaveMunicipio('Candiba, BA')).toBe('candiba');
        expect(chaveMunicipio('Vitória da Conquista - BA')).toBe('vitoria da conquista');
        expect(chaveMunicipio('Urandi (por Matina)')).toBe('urandi');
        expect(chaveMunicipio('Arapiranga, Rio de Contas')).toBe('rio de contas');
        expect(chaveMunicipio('Lugar Inexistente')).toBeNull();
    });
    it('atribui polo regional', () => {
        expect(poloMaisProximo('barreiras').id).toBe('barreiras');
        expect(poloMaisProximo('caetite').id).toBe('guanambi');
    });
    it('calcula venda, margem real e marca cidades sem atendimento', () => {
        const fretes = [
            { cidade: 'Guanambi, BA', km: 100, frete_por_saco: 2, valor_venda: 40 },
            { cidade: 'Caetité, BA', km: 120, frete_por_saco: 2, valor_venda: 40 },
        ];
        const carregamentos = [
            { destino: 'Guanambi, BA', quantidade: 100, unidade_quantidade: 'saco', valor_frete_calculado: 200, data_carregamento: '2026-10-02' },
            { destino: 'Guanambi', quantidade: 50, valor_frete_calculado: 100, data_carregamento: '2026-10-09' },
            { destino: 'Estoque, BA', quantidade: 500, valor_frete_calculado: 900 },
            { empresa_origem: 'ESTOQUE', destino: 'Candiba, BA', quantidade: 300, valor_frete_calculado: 100 }, // tipo Carregamento no Estoque: fora do volume
            { destino: 'Planeta X', quantidade: 10 },
        ];
        const dadosMargem = { custoPorKm: 1, custoPorDia: 0, margemPadrao: 20, custosDestinos: [{ destino: 'Guanambi', distancia_km: 200, dias_viagem: 0 }] };
        const r = agregarMapa({ carregamentos, fretes, custoConfig: { custoMedioProduto: 30, custoOperacional: 2 }, dadosMargem });
        const g = r.cidades.find(c => c.chave === 'guanambi');
        expect(g.viagens).toBe(3); expect(g.sacos).toBe(650); expect(g.frete).toBe(1200); // inclui a viagem ao Estoque (= Guanambi)
        expect(g.venda).toBe(26000);                // 650 × 40
        expect(g.custoRodagem).toBe(600);           // 3 viagens × 200 km × R$1
        expect(g.custoProduto).toBe(20800);         // 650 × (30 + 2)
        expect(g.margemReal).toBe(26000 - 20800 - 1200); // venda − (produto + frete)
        expect(r.cidades.find(c => c.chave === 'caetite').atendida).toBe(false);
        expect(r.naoLocalizados).toEqual([{ destino: 'Planeta X', qtd: 1 }]);
        expect(r.totais.atendidas).toBe(1);
        expect(r.totais.viagens).toBe(5);
        expect(r.totais.sacos).toBe(660);   // volume do tipo Estoque não entra
        expect(r.totais.frete).toBe(1300);  // mas o frete dele entra, como na aba Volume
        expect(chaveMunicipio('Livramento, BA')).toBe('livramento de nossa senhora');
        expect(chaveMunicipio('Palmas de M. Alto, BA')).toBe('palmas de monte alto');
    });
});

import { calcCaptacaoDistribuicao } from 'pages/carretas/components/TabVolume/utils/helpers';
describe('captação x distribuição', () => {
    it('Carregamento no Estoque: sem captação, só distribuição', () => {
        const r = calcCaptacaoDistribuicao({ empresa_origem: 'ESTOQUE', destino: 'Barreiras, BA', quantidade: 800, valor_frete_calculado: 6520 }, 7.15);
        expect(r.captacao).toBe(0); expect(r.distribuicao).toBe(6520);
    });
    it('carga normal mantém a captação por saco', () => {
        const r = calcCaptacaoDistribuicao({ empresa_origem: 'FOB_BARR|CSN', destino: 'Barreiras, BA', quantidade: 800, valor_frete_calculado: 6520 }, 7.15);
        expect(r.captacao).toBeCloseTo(5720); expect(r.distribuicao).toBeCloseTo(800);
    });
});
describe('CIF não é venda', () => {
    it('CIF entra no volume mas não em venda/margem', () => {
        const fretes = [{ cidade: 'Barreiras, BA', km: 100, frete_por_saco: 2, valor_venda: 50 }];
        const r = agregarMapa({ carregamentos: [
            { empresa_origem: 'CIF_BARR|CSN', destino: 'Barreiras, BA', quantidade: 800, valor_frete_calculado: 0 },
            { empresa_origem: 'ARA_BARR_FOB|CSN', destino: 'Barreiras, BA', quantidade: 100, valor_frete_calculado: 200 },
        ], fretes, custoConfig: { custoMedioProduto: 30, custoOperacional: 1 }, dadosMargem: null });
        const b = r.cidades.find(c => c.chave === 'barreiras');
        expect(b.sacos).toBe(900); expect(b.venda).toBe(5000); expect(b.margemReal).toBe(5000 - 3100 - 200);
        expect(b.margemPorSaco).toBeCloseTo(17);
    });
});
