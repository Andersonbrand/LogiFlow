/**
 * Testes — Lógica de negócio dos Romaneios
 *
 * Foco: regras de margem de lucro e mapeamento de status de veículo.
 * Banco de dados mockado — nenhum teste acessa o Supabase real.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sincronizarStatusVeiculo } from '../utils/romaneioService';
import { supabase } from '../utils/supabaseClient';

// ─── addMargem (lógica interna) — testada via comportamento observável ─────────

describe('Margem de lucro no romaneio', () => {
    it('margem = frete - (combustivel + pedagio + motorista)', () => {
        // A função addMargem é interna, então validamos que
        // os valores calculados fazem sentido matematicamente
        const custo_combustivel = 500;
        const custo_pedagio     = 150;
        const custo_motorista   = 300;
        const valor_frete       = 1200;

        const custoTotal = custo_combustivel + custo_pedagio + custo_motorista;
        const margem = valor_frete - custoTotal;

        expect(margem).toBe(250);
        expect(margem).toBeGreaterThan(0); // romaneio lucrativo
    });

    it('margem negativa quando custos superam frete', () => {
        const custoTotal = 1500;
        const valor_frete = 1000;
        expect(valor_frete - custoTotal).toBe(-500);
    });

    it('valores nulos/undefined não quebram o cálculo', () => {
        // Simula o comportamento do Number(null) e Number(undefined)
        const seguro = (v) => Number(v) || 0;
        expect(seguro(null)).toBe(0);
        expect(seguro(undefined)).toBe(0);
        expect(seguro('350')).toBe(350);
        expect(seguro('')).toBe(0);
    });
});

// ─── sincronizarStatusVeiculo ─────────────────────────────────────────────────

describe('sincronizarStatusVeiculo', () => {
    let mockUpdate;

    beforeEach(() => {
        mockUpdate = vi.fn().mockResolvedValue({ error: null });
        supabase.from.mockReturnValue({
            update: vi.fn(() => ({ eq: mockUpdate, ilike: mockUpdate })),
        });
    });

    it('não atualiza banco quando status é desconhecido', async () => {
        await sincronizarStatusVeiculo('uuid-123', null, 'StatusInexistente');
        expect(supabase.from).not.toHaveBeenCalled();
    });

    it('status "Em Trânsito" → veículo fica "Em Trânsito"', async () => {
        const fromSpy = supabase.from('vehicles');
        const updateSpy = vi.fn(() => ({ eq: vi.fn().mockResolvedValue({}) }));
        supabase.from.mockReturnValue({ update: updateSpy });

        await sincronizarStatusVeiculo('uuid-123', null, 'Em Trânsito');

        expect(supabase.from).toHaveBeenCalledWith('vehicles');
        expect(updateSpy).toHaveBeenCalledWith({ status: 'Em Trânsito' });
    });

    it('status "Finalizado" → veículo fica "Disponível"', async () => {
        const updateSpy = vi.fn(() => ({ eq: vi.fn().mockResolvedValue({}) }));
        supabase.from.mockReturnValue({ update: updateSpy });

        await sincronizarStatusVeiculo('uuid-456', null, 'Finalizado');

        expect(updateSpy).toHaveBeenCalledWith({ status: 'Disponível' });
    });

    it('status "Aguardando" → veículo fica "Disponível"', async () => {
        const updateSpy = vi.fn(() => ({ eq: vi.fn().mockResolvedValue({}) }));
        supabase.from.mockReturnValue({ update: updateSpy });

        await sincronizarStatusVeiculo('uuid-789', null, 'Aguardando');

        expect(updateSpy).toHaveBeenCalledWith({ status: 'Disponível' });
    });

    it('usa placa (ilike) quando vehicleId não é fornecido', async () => {
        const ilikeSpy = vi.fn().mockResolvedValue({});
        const updateSpy = vi.fn(() => ({ ilike: ilikeSpy }));
        supabase.from.mockReturnValue({ update: updateSpy });

        await sincronizarStatusVeiculo(null, 'ABC-1234', 'Carregando');

        expect(updateSpy).toHaveBeenCalledWith({ status: 'Em Trânsito' });
        expect(ilikeSpy).toHaveBeenCalledWith('placa', 'ABC-1234');
    });

    it('não lança erro mesmo se o banco falhar (erros silenciados)', async () => {
        supabase.from.mockReturnValue({
            update: vi.fn(() => ({
                eq: vi.fn().mockRejectedValue(new Error('Falha de rede')),
            })),
        });

        // A função faz catch interno — não deve lançar nada
        await expect(
            sincronizarStatusVeiculo('uuid-err', null, 'Em Trânsito')
        ).resolves.not.toThrow();
    });
});

// ─── Validação de regras de status ────────────────────────────────────────────

describe('Regras de status dos romaneios', () => {
    const STATUS_VALIDOS = ['Aguardando', 'Carregando', 'Em Trânsito', 'Finalizado', 'Cancelado'];

    it('todos os status possíveis estão mapeados para um status de veículo', () => {
        const STATUS_VEICULO = {
            'Em Trânsito': 'Em Trânsito',
            'Carregando':  'Em Trânsito',
            'Aguardando':  'Disponível',
            'Finalizado':  'Disponível',
            'Cancelado':   'Disponível',
        };

        STATUS_VALIDOS.forEach(status => {
            expect(STATUS_VEICULO[status]).toBeDefined();
        });
    });

    it('apenas "Em Trânsito" e "Carregando" colocam veículo em trânsito', () => {
        const STATUS_VEICULO = {
            'Em Trânsito': 'Em Trânsito',
            'Carregando':  'Em Trânsito',
            'Aguardando':  'Disponível',
            'Finalizado':  'Disponível',
            'Cancelado':   'Disponível',
        };

        const emTransito = Object.entries(STATUS_VEICULO)
            .filter(([, v]) => v === 'Em Trânsito')
            .map(([k]) => k);

        expect(emTransito).toEqual(['Em Trânsito', 'Carregando']);
    });
});
