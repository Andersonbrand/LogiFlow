import { useEffect, useMemo } from 'react';
import { dataLocalISO } from '../utils/helpers';

/** Estado e ações extraídos da tela — ver o componente que usa este hook. */
export function useRelatoriosPeriodo({ abastecimentosCaminhao, mesRef, periodo, romaneios, setDreMesFim, setDreMesInicio }) {
// eslint-disable-line

    // ─── Período do cabeçalho (vale para Operacional, Financeiro e Frota) ───
    // mês: do dia 1 ao último dia do mês escolhido | atalhos: últimos N dias até hoje
    const { periodoIni, periodoFim, diasPeriodo, periodoLabel } = useMemo(() => {
        if (periodo === 'mes') {
            const [ano, mes] = mesRef.split('-').map(Number);
            const ultimoDia = new Date(ano, mes, 0).getDate();
            const hoje = new Date();
            const eMesAtual = hoje.getFullYear() === ano && hoje.getMonth() + 1 === mes;
            const eFuturo = new Date(ano, mes - 1, 1) > hoje;
            return {
                periodoIni: `${mesRef}-01`,
                periodoFim: `${mesRef}-${String(ultimoDia).padStart(2, '0')}`,
                diasPeriodo: eFuturo ? 1 : (eMesAtual ? hoje.getDate() : ultimoDia),
                periodoLabel: new Date(ano, mes - 1, 15).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
            };
        }
        const d = new Date(); d.setDate(d.getDate() - Number(periodo));
        return { periodoIni: dataLocalISO(d), periodoFim: null, diasPeriodo: Number(periodo), periodoLabel: `Últimos ${periodo} dias` };
    }, [periodo, mesRef]);

    // Mantém o DRE alinhado ao mês escolhido no cabeçalho (ele ainda pode ser ajustado à parte)
    useEffect(() => {
        if (periodo === 'mes') { setDreMesInicio(mesRef); setDreMesFim(mesRef); }
    }, [periodo, mesRef]);

    const romFiltrados = useMemo(() => romaneios.filter(r => {
        const dia = r.saida?.slice(0, 10);
        return dia && dia >= periodoIni && (!periodoFim || dia <= periodoFim);
    }), [romaneios, periodoIni, periodoFim]);
    const romFinalizados = romFiltrados.filter(r => r.status === 'Finalizado');

    // Custo real de combustível (diesel + Arla) por mês, a partir dos registros
    // de abastecimento lançados por cada motorista de caminhão — esse é o custo
    // efetivo, diferente da previsão de consumo lançada dentro do romaneio.
    const custoCombustivelRealPorMes = useMemo(() => {
        const map = {};
        abastecimentosCaminhao.forEach(a => {
            const dia = (a.data_abastecimento || '').slice(0, 10);
            if (!dia) return;
            const m = dia.slice(0, 7);
            map[m] = (map[m] || 0) + Number(a.valor_total || 0);
        });
        return map;
    }, [abastecimentosCaminhao]);
    const somaCustoCombustivelReal = (dataInicioISO, dataFimISO) => Object.entries(custoCombustivelRealPorMes)
        .reduce((s, [m, v]) => {
            const dia = `${m}-01`;
            if (dataInicioISO && dia.slice(0, 7) < dataInicioISO.slice(0, 7)) return s;
            if (dataFimISO && dia.slice(0, 7) > dataFimISO.slice(0, 7)) return s;
            return s + v;
        }, 0);

    return { periodoIni, periodoFim, diasPeriodo, periodoLabel, romFiltrados, romFinalizados, custoCombustivelRealPorMes, somaCustoCombustivelReal };
}
