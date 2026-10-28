import { useMemo } from 'react';
import { despesaTemVencimentoNoPeriodo, somarDespesasPorVencimento, agruparDespesasPorCategoriaVencimento, expandirDespesaParcelas } from 'utils/despesasParcelasUtils';

/** Estado e ações extraídos da tela — ver o componente que usa este hook. */
export function useRelatoriosDespesas({ despesasCaminhoes, periodoFim, periodoIni }) {
// ─── Despesas Caminhões KPIs ─────────────────────────────
    // Abate pela data de VENCIMENTO de cada boleto/parcela, não pela data de
    // emissão da NF — uma despesa a prazo pode ter parcelas vencendo em meses
    // diferentes do lançamento original.
    const despesasCutoffISO = periodoIni;
    const despesasFimISO = periodoFim || '9999-12-31';

    const despesasFiltradas = useMemo(() => {
        return despesasCaminhoes.filter(d => despesaTemVencimentoNoPeriodo(d, despesasCutoffISO, despesasFimISO));
    }, [despesasCaminhoes, despesasCutoffISO, despesasFimISO]);

    const totalDespesasCaminhoes = useMemo(() => somarDespesasPorVencimento(despesasCaminhoes, despesasCutoffISO, despesasFimISO), [despesasCaminhoes, despesasCutoffISO, despesasFimISO]);

    const despesasPorCategoria = useMemo(() => {
        const map = agruparDespesasPorCategoriaVencimento(despesasCaminhoes, despesasCutoffISO, despesasFimISO);
        return Object.entries(map).sort(([,a],[,b]) => b - a).map(([name, value]) => ({ name, value }));
    }, [despesasCaminhoes, despesasCutoffISO, despesasFimISO]);

    const despesasPorMes = useMemo(() => {
        const map = {};
        despesasCaminhoes.forEach(d => {
            expandirDespesaParcelas(d).forEach(item => {
                if (!item.vencimento || item.vencimento < despesasCutoffISO || item.vencimento > despesasFimISO) return;
                const m = item.vencimento.slice(0, 7);
                if (!map[m]) map[m] = { mes: m.slice(5), total: 0 };
                map[m].total += item.valor;
            });
        });
        return Object.values(map).sort((a, b) => a.mes.localeCompare(b.mes));
    }, [despesasCaminhoes, despesasCutoffISO, despesasFimISO]);

    return { despesasFiltradas, totalDespesasCaminhoes, despesasPorCategoria, despesasPorMes };
}
