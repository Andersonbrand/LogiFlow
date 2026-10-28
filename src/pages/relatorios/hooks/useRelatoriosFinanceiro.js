import { useMemo } from 'react';

/** Estado e ações extraídos da tela — ver o componente que usa este hook. */
export function useRelatoriosFinanceiro({ custoCombustivelRealPorMes, finalizados, periodoFim, periodoIni, romFinalizados, somaCustoCombustivelReal }) {
// ─── Financeiro KPIs ──────────────────────────────────────
    const custoCombustivelRealPeriodo = useMemo(
        () => somaCustoCombustivelReal(periodoIni, periodoFim),
        [custoCombustivelRealPorMes, periodoIni, periodoFim] // eslint-disable-line
    );
    const receitaTotal = romFinalizados.reduce((s, r) => s + (r.valor_frete || 0), 0);
    const custoTotal = custoCombustivelRealPeriodo + romFinalizados.reduce((s, r) =>
        s + (r.custo_pedagio || 0) + (r.custo_motorista || 0), 0);
    const margemLucro = receitaTotal > 0 ? ((receitaTotal - custoTotal) / receitaTotal * 100) : 0;
    const ticketMedio = finalizados > 0 ? receitaTotal / finalizados : 0;

    // Custo por componente — combustível vem dos abastecimentos reais, não da
    // previsão lançada dentro do romaneio.
    const custosBreakdown = useMemo(() => [
        { name: 'Combustível', value: custoCombustivelRealPeriodo },
        { name: 'Pedágio',     value: romFinalizados.reduce((s, r) => s + (r.custo_pedagio || 0), 0) },
        { name: 'Motorista',   value: romFinalizados.reduce((s, r) => s + (r.custo_motorista || 0), 0) },
    ].filter(c => c.value > 0), [romFinalizados, custoCombustivelRealPeriodo]);

    // Receita vs Custo por mês
    const financeiroPorMes = useMemo(() => {
        const map = {};
        romFinalizados.forEach(r => {
            const m = r.saida?.slice(0, 7);
            if (!m) return;
            if (!map[m]) map[m] = { mes: m.slice(5), receita: 0, custo: 0 };
            map[m].receita += r.valor_frete || 0;
            map[m].custo += (r.custo_pedagio || 0) + (r.custo_motorista || 0);
        });
        // Soma o custo real de combustível de cada mês (dos abastecimentos)
        Object.keys(map).forEach(m => { map[m].custo += (custoCombustivelRealPorMes[m] || 0); });
        return Object.values(map).sort((a, b) => a.mes.localeCompare(b.mes));
    }, [romFinalizados, custoCombustivelRealPorMes]);

    // Top rotas por receita
    const topRotas = useMemo(() => {
        const map = {};
        romFinalizados.forEach(r => {
            if (!r.destino) return;
            const key = r.destino.split(',')[0].trim();
            if (!map[key]) map[key] = { destino: key, receita: 0, viagens: 0 };
            map[key].receita += r.valor_frete || 0;
            map[key].viagens += 1;
        });
        return Object.values(map).sort((a, b) => b.receita - a.receita).slice(0, 6);
    }, [romFinalizados]);

    return { receitaTotal, custoTotal, margemLucro, ticketMedio, custosBreakdown, financeiroPorMes, topRotas };
}
