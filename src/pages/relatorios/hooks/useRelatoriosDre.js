import { useMemo } from 'react';
import { encontrarCustoDestino, calcularCustoDestino } from 'services/custosFrotaService';
import { expandirDespesaParcelas } from 'utils/despesasParcelasUtils';

/** Estado e ações extraídos da tela — ver o componente que usa este hook. */
export function useRelatoriosDre({ abastecimentosCaminhao, dadosMargemCaminhao, despesasCaminhoes, diariasAvulsasCaminhao, dreFimISO, dreInicioISO, romFinalizados, romFinalizadosDre }) {
// ─── DRE Mensal Caminhões ─────────────────────────────────
    const custoRodagemStats = useMemo(() => {
        if (!dadosMargemCaminhao) return { comMatch: 0, semMatch: 0 };
        let comMatch = 0, semMatch = 0;
        romFinalizados.forEach(r => {
            if (encontrarCustoDestino(r.destino, dadosMargemCaminhao.destinos)) comMatch++; else semMatch++;
        });
        return { comMatch, semMatch };
    }, [romFinalizados, dadosMargemCaminhao]);

    const dreMensal = useMemo(() => {
        // Consolida receitas dos romaneios finalizados por mês
        const map = {};

        romFinalizadosDre.forEach(r => {
            const m = r.saida?.slice(0, 7);
            if (!m) return;
            if (!map[m]) map[m] = {
                mes: m, mesLabel: m.slice(5),
                receita: 0,
                custoCombustivel: 0,
                custoPedagio: 0,
                custoMotorista: 0,
                despesasCaminhoes: 0,
                custoRodagem: 0,
                viagens: 0,
            };
            map[m].receita          += r.valor_frete          || 0;
            map[m].custoPedagio     += r.custo_pedagio         || 0;
            map[m].custoMotorista   += r.custo_motorista       || 0;
            map[m].viagens++;

            // Custo de rodagem estimado — casa o destino do romaneio com a
            // tabela de custos por destino cadastrada para caminhões.
            // Usa o Valor Estimado (preço de venda com margem), não o Custo
            // Total puro — mesmo critério usado no DRE de Carretas.
            if (dadosMargemCaminhao) {
                const destino = encontrarCustoDestino(r.destino, dadosMargemCaminhao.destinos);
                if (destino) {
                    const { valorEstimado } = calcularCustoDestino(destino, dadosMargemCaminhao.custoPorKm, dadosMargemCaminhao.custoPorDia, dadosMargemCaminhao.margemPadrao);
                    map[m].custoRodagem += valorEstimado;
                }
            }
        });

        // Soma diárias avulsas de motoristas de caminhão por mês (lançadas manualmente),
        // restritas ao período do DRE selecionado
        diariasAvulsasCaminhao.forEach(d => {
            const dia = d.data_inicio?.slice(0, 10);
            if (!dia || dia < dreInicioISO || dia > dreFimISO) return;
            const m = dia.slice(0, 7);
            if (!map[m]) map[m] = {
                mes: m, mesLabel: m.slice(5),
                receita: 0, custoCombustivel: 0, custoPedagio: 0,
                custoMotorista: 0, despesasCaminhoes: 0, custoRodagem: 0, viagens: 0,
            };
            map[m].custoMotorista += Number(d.valor_total || 0);
        });

        // Custo real de combustível (diesel + Arla) por mês, a partir dos registros
        // de abastecimento lançados por cada motorista de caminhão — restrito ao
        // período do DRE selecionado. Este é o custo efetivo; a previsão de consumo
        // lançada dentro do romaneio continua disponível apenas para análise por viagem.
        abastecimentosCaminhao.forEach(a => {
            const dia = (a.data_abastecimento || '').slice(0, 10);
            if (!dia || dia < dreInicioISO || dia > dreFimISO) return;
            const m = dia.slice(0, 7);
            if (!map[m]) map[m] = {
                mes: m, mesLabel: m.slice(5),
                receita: 0, custoCombustivel: 0, custoPedagio: 0,
                custoMotorista: 0, despesasCaminhoes: 0, custoRodagem: 0, viagens: 0,
            };
            map[m].custoCombustivel += Number(a.valor_total || 0);
        });

        // Soma despesas de caminhões (manutenção, pneus, etc.) por mês —
        // pela data de VENCIMENTO de cada boleto/parcela, não pela emissão da NF,
        // e restrita ao período do DRE selecionado (cada boleto cai no seu próprio mês)
        despesasCaminhoes.forEach(d => {
            expandirDespesaParcelas(d).forEach(item => {
                const venc = item.vencimento;
                if (!venc || venc < dreInicioISO || venc > dreFimISO) return;
                const m = venc.slice(0, 7);
                if (!map[m]) map[m] = {
                    mes: m, mesLabel: m.slice(5),
                    receita: 0,
                    custoCombustivel: 0,
                    custoPedagio: 0,
                    custoMotorista: 0,
                    despesasCaminhoes: 0,
                    custoRodagem: 0,
                    viagens: 0,
                };
                map[m].despesasCaminhoes += item.valor;
            });
        });

        return Object.values(map)
            .sort((a, b) => a.mes.localeCompare(b.mes))
            .map(m => {
                const custoOperacional = m.custoCombustivel + m.custoPedagio + m.custoMotorista;
                const totalDespesas    = custoOperacional + m.despesasCaminhoes + m.custoRodagem;
                const margemBruta      = m.receita - custoOperacional;
                const resultadoLiquido = m.receita - totalDespesas;
                const margemPct        = m.receita > 0 ? (resultadoLiquido / m.receita) * 100 : 0;
                return { ...m, custoOperacional, totalDespesas, margemBruta, resultadoLiquido, margemPct };
            });
    }, [romFinalizadosDre, despesasCaminhoes, diariasAvulsasCaminhao, abastecimentosCaminhao, dadosMargemCaminhao, dreInicioISO, dreFimISO]);

    // Totais consolidados da DRE
    const dreTotais = useMemo(() => {
        const t = dreMensal.reduce((acc, m) => ({
            receita:          acc.receita          + m.receita,
            custoCombustivel: acc.custoCombustivel + m.custoCombustivel,
            custoPedagio:     acc.custoPedagio     + m.custoPedagio,
            custoMotorista:   acc.custoMotorista   + m.custoMotorista,
            despesasCaminhoes:acc.despesasCaminhoes+ m.despesasCaminhoes,
            custoRodagem:     acc.custoRodagem      + m.custoRodagem,
            totalDespesas:    acc.totalDespesas    + m.totalDespesas,
            margemBruta:      acc.margemBruta      + m.margemBruta,
            resultadoLiquido: acc.resultadoLiquido + m.resultadoLiquido,
            viagens:          acc.viagens          + m.viagens,
        }), { receita:0, custoCombustivel:0, custoPedagio:0, custoMotorista:0, despesasCaminhoes:0, custoRodagem:0, totalDespesas:0, margemBruta:0, resultadoLiquido:0, viagens:0 });
        t.margemPct = t.receita > 0 ? (t.resultadoLiquido / t.receita) * 100 : 0;
        t.custoRodagemComMatch = custoRodagemStats.comMatch;
        t.custoRodagemSemMatch = custoRodagemStats.semMatch;
        return t;
    }, [dreMensal, custoRodagemStats]);

    return { dreMensal, dreTotais };
}
