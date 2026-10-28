import { useMemo } from 'react';

/** Estado e ações extraídos da tela — ver o componente que usa este hook. */
export function useRelatoriosFrota({ romFiltrados, vehicles }) {
// ─── Frota KPIs ──────────────────────────────────────────
    const frota = vehicles.length;
    const disponiveis = vehicles.filter(v => v.status === 'Disponível').length;
    const emTransito = vehicles.filter(v => v.status === 'Em Trânsito').length;
    const manutencao = vehicles.filter(v => v.status === 'Manutenção').length;
    // Utilização no período selecionado: média da carga (peso do romaneio ÷ capacidade do veículo)
    // nas viagens do período, por veículo. Sem viagens no período = 0%.
    const utilizacaoPorVeiculo = useMemo(() => vehicles.map(v => {
        const cap = Number(v.capacidade_peso || v.capacidadePeso || 0);
        const viagens = romFiltrados.filter(r => (r.vehicle_id && r.vehicle_id === v.id) || (r.placa && r.placa === v.placa));
        let utilizacao = 0;
        if (viagens.length > 0 && cap > 0) {
            utilizacao = Math.round(viagens.reduce((s, r) => s + Math.min(100, (Number(r.peso_total || 0) / cap) * 100), 0) / viagens.length);
        }
        return { placa: v.placa, utilizacao, viagens: viagens.length };
    }), [vehicles, romFiltrados]);
    const utilizacaoMedia = frota > 0 ? utilizacaoPorVeiculo.reduce((s, v) => s + v.utilizacao, 0) / frota : 0;

    const frotaStatus = [
        { name: 'Disponível', value: disponiveis },
        { name: 'Em Trânsito', value: emTransito },
        { name: 'Manutenção', value: manutencao },
    ].filter(s => s.value > 0);

    const utilizacaoVeiculos = utilizacaoPorVeiculo.map(v => ({ placa: v.placa, utilizacao: v.utilizacao }))
        .sort((a, b) => b.utilizacao - a.utilizacao);

    return { frota, disponiveis, emTransito, manutencao, utilizacaoMedia, frotaStatus, utilizacaoVeiculos };
}
