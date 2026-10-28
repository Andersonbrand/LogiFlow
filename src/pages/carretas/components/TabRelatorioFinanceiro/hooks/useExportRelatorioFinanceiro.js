import * as XLSX from 'xlsx';
import { calcularBonusCarreteiro } from 'services/carretas';
import { FMT_DATE } from '../../../utils/helpers';

/** Estado e ações extraídos da tela — ver o componente que usa este hook. */
export function useExportRelatorioFinanceiro({ bonusConfig, dados, dadosPorPlaca, filtroPlaca, showToast }) {
// eslint-disable-line

    const exportarExcel = () => {
        if (!dados) { showToast('Gere o relatório antes de exportar', 'error'); return; }

        const wb = XLSX.utils.book_new();

        // Aba 1 — Resumo Financeiro (item 6: diesel e arla separados)
        const resumo = [
            ['RELATÓRIO FINANCEIRO — TRANSPORTE CARRETAS', '', ''],
            ['Período:', dados.periodo, ''],
            ['', '', ''],
            ['RECEITAS', '', ''],
            ['Receita Total de Fretes', dados.receitaTotal, ''],
            ['  → Carregamentos', dados.receitaCarregamentos || 0, ''],
            ['  → Romaneios de Carga', dados.receitaRomaneios || 0, ''],
            ...Object.entries(dados.receitaPorEmpresa).map(([nome, val]) => [`  → Por empresa: ${nome}`, val, '']),
            ['', '', ''],
            ['DESPESAS', '', ''],
            ['Combustível — Diesel', dados.valorDiesel, ''],
            [`  → Litros Diesel`, dados.litrosDiesel.toFixed(1) + ' L', ''],
            ['Combustível — Arla 32', dados.valorArla, ''],
            [`  → Litros Arla`, dados.litrosArla.toFixed(1) + ' L', ''],
            ['Total Combustível', dados.despesaCombustivel, ''],
            ['Bônus Motoristas', dados.bonusTotal, ''],
            ['Diárias de Motoristas', dados.totalDiariasLancadas, ''],
            ['Despesas Extras (veículos)', dados.totalDespesasExtras, ''],
            ...Object.entries(dados.despesasPorCategoria).map(([cat, val]) => [`  → ${cat}`, val, '']),
            ['Custo de Rodagem (estimado por destino)', dados.custoRodagemEstimado || 0, ''],
            ...(dados.custoRodagemSemMatch > 0 ? [[`  → ${dados.custoRodagemSemMatch} de ${dados.custoRodagemTotalFretes} fretes sem destino cadastrado`, '', '']] : []),
            ['Total Despesas', dados.despesaTotal, ''],
            ['', '', ''],
            ['MARGENS', '', ''],
            ['Margem Bruta (Receita − Custos Operacionais)', dados.margemBruta, ''],
            ['Margem Líquida (Receita − Todas Despesas)', dados.margemLiquida, ''],
            ['Margem Líquida %', `${dados.margemPct.toFixed(2)}%`, ''],
            ['', '', ''],
            ['OPERACIONAL', '', ''],
            ['Total de Viagens', dados.totalViagens, ''],
            ['Viagens Finalizadas', dados.viagensFinalizadas, ''],
            ['Carregamentos', dados.totalCarregamentos, ''],
        ];
        const ws1 = XLSX.utils.aoa_to_sheet(resumo);
        ws1['!cols'] = [{ wch: 45 }, { wch: 18 }, { wch: 10 }];
        XLSX.utils.book_append_sheet(wb, ws1, 'Resumo Financeiro');

        // Aba 2 — Por Motorista
        const rowsM = [
            ['Motorista', 'Carregamentos', 'Receita Frete (R$)', 'Viagens Finalizadas', 'Bônus (R$)', 'Total Motorista (R$)'],
            ...dados.consolidadoMotoristas.map(m => [
                m.nome, m.carregamentos, m.frete, m.viagens, m.bonus, m.frete + m.bonus,
            ]),
            ['TOTAL', dados.totalCarregamentos, dados.receitaTotal, dados.viagensFinalizadas, dados.bonusTotal, dados.receitaTotal + dados.bonusTotal],
        ];
        const ws2 = XLSX.utils.aoa_to_sheet(rowsM);
        ws2['!cols'] = [{ wch: 22 },{ wch: 15 },{ wch: 20 },{ wch: 20 },{ wch: 14 },{ wch: 20 }];
        XLSX.utils.book_append_sheet(wb, ws2, 'Por Motorista');

        // Aba 3 — Abastecimentos (diesel e arla separados)
        const rowsAbst = [
            ['Data', 'Motorista', 'Placa', 'Posto', 'Diesel (L)', 'R$ Diesel', 'Arla (L)', 'R$ Arla', 'Total R$'],
            ...(dados._abastecimentos || []).map(a => [
                FMT_DATE(a.data_abastecimento), a.motorista?.name || '', a.veiculo?.placa || '',
                a.posto || '', Number(a.litros_diesel || 0), Number(a.valor_diesel || 0),
                Number(a.litros_arla || 0), Number(a.valor_arla || 0), Number(a.valor_total || 0),
            ]),
            ['TOTAL', '', '', '', dados.litrosDiesel, dados.valorDiesel, dados.litrosArla, dados.valorArla, dados.despesaCombustivel],
        ];
        const ws3 = XLSX.utils.aoa_to_sheet(rowsAbst);
        ws3['!cols'] = [12,20,12,18,10,14,10,14,14].map(w => ({ wch: w }));
        XLSX.utils.book_append_sheet(wb, ws3, 'Abastecimentos');

        const nome = `relatorio_financeiro_carretas_${dados.periodo.replace(/\s/g,'_')}.xlsx`;
        XLSX.writeFile(wb, nome);
        showToast('Relatório exportado com sucesso!', 'success');
    };

const exportarPorPlaca = () => {
        if (!dadosPorPlaca) { showToast('Selecione uma placa e gere o relatório primeiro', 'error'); return; }
        const { veic, carrg, roms, absts, viags, desps, receita, receitaCarrg, receitaRoms, combustivel, vDiesel, vArla, lDiesel, lArla, bonus, despExtra, diarias, custoRodagem, totalDesp, margem } = dadosPorPlaca;
        const wb = XLSX.utils.book_new();

        // Aba Resumo
        const resumo = [
            [`RELATÓRIO POR VEÍCULO — ${veic?.placa || filtroPlaca}`, ''],
            [`Modelo: ${veic?.modelo || ''}`, ''],
            ['Período:', dados.periodo],
            ['', ''],
            ['RECEITAS', ''],
            ['Receita Total', receita],
            ['  → Carregamentos', receitaCarrg],
            ['  → Romaneios de Carga', receitaRoms],
            ['', ''],
            ['DESPESAS', ''],
            ['Diesel', vDiesel], [`  → ${lDiesel.toFixed(1)} L`, ''],
            ['Arla 32', vArla], [`  → ${lArla.toFixed(1)} L`, ''],
            ['Total Combustível', combustivel],
            ['Bônus Motoristas', bonus],
            ['Diárias', diarias],
            ['Despesas Extras', despExtra],
            ['Custo de Rodagem (estimado)', custoRodagem],
            ['Total Despesas', totalDesp],
            ['', ''],
            ['MARGEM LÍQUIDA', margem],
            ['Margem %', receita > 0 ? `${((margem / receita) * 100).toFixed(2)}%` : '0%'],
        ];
        const ws1 = XLSX.utils.aoa_to_sheet(resumo);
        ws1['!cols'] = [{ wch: 40 }, { wch: 18 }];
        XLSX.utils.book_append_sheet(wb, ws1, 'Resumo');

        // Aba Viagens
        if (viags.length) {
            const rowsV = [
                ['Nº Viagem', 'Status', 'Motorista', 'Data Saída', 'Destino', 'Toneladas', 'Bônus (R$)'],
                ...viags.map(v => [v.numero, v.status, v.motorista?.name || '', FMT_DATE(v.data_saida), v.destino || '', v.toneladas || 0, calcularBonusCarreteiro(v.destino, bonusConfig)]),
                ['TOTAL', '', '', '', '', '', bonus],
            ];
            const wsV = XLSX.utils.aoa_to_sheet(rowsV);
            wsV['!cols'] = [12,18,20,12,20,10,12].map(w => ({ wch: w }));
            XLSX.utils.book_append_sheet(wb, wsV, 'Viagens');
        }

        // Aba Romaneios de Carga
        if (roms && roms.length) {
            const rowsR = [
                ['Nº Romaneio', 'Status', 'Motorista', 'Empresa', 'Destino', 'Data Saída', 'Peso (t)', 'Valor Carga (R$)', 'Frete (R$)'],
                ...roms.map(r => [
                    r.numero, r.status, r.motorista?.name || '', r.empresa || '',
                    r.destino || '', FMT_DATE(r.data_saida),
                    Number(r.toneladas || 0), Number(r.valor_carga || 0), Number(r.valor_frete || 0),
                ]),
                ['TOTAL', '', '', '', '', '', '', '', receitaRoms],
            ];
            const wsR = XLSX.utils.aoa_to_sheet(rowsR);
            wsR['!cols'] = [14,16,20,18,20,12,10,16,14].map(w => ({ wch: w }));
            XLSX.utils.book_append_sheet(wb, wsR, 'Romaneios');
        }

        // Aba Fretes
        if (carrg.length) {
            const rowsC = [
                ['Data', 'Pedido', 'NF', 'Empresa', 'Destino', 'Motorista', 'Qtd', 'Unidade', 'Frete (R$)'],
                ...carrg.map(c => [FMT_DATE(c.data_carregamento), c.numero_pedido || '', c.numero_nota_fiscal || '', c.empresa?.nome || '', c.destino || '', c.motorista?.name || '', c.quantidade || 0, c.unidade_quantidade || '', Number(c.valor_frete_calculado || 0)]),
                ['TOTAL', '', '', '', '', '', '', '', receitaCarrg],
            ];
            const wsC = XLSX.utils.aoa_to_sheet(rowsC);
            wsC['!cols'] = [12,12,10,18,20,20,8,8,14].map(w => ({ wch: w }));
            XLSX.utils.book_append_sheet(wb, wsC, 'Fretes');
        }

        // Aba Abastecimentos
        if (absts.length) {
            const rowsA = [
                ['Data', 'Motorista', 'Posto', 'Diesel (L)', 'R$ Diesel', 'Arla (L)', 'R$ Arla', 'Total R$'],
                ...absts.map(a => [FMT_DATE(a.data_abastecimento), a.motorista?.name || '', a.posto || '', Number(a.litros_diesel || 0), Number(a.valor_diesel || 0), Number(a.litros_arla || 0), Number(a.valor_arla || 0), Number(a.valor_total || 0)]),
                ['TOTAL', '', '', lDiesel, vDiesel, lArla, vArla, combustivel],
            ];
            const wsA = XLSX.utils.aoa_to_sheet(rowsA);
            wsA['!cols'] = [12,20,18,10,14,10,14,14].map(w => ({ wch: w }));
            XLSX.utils.book_append_sheet(wb, wsA, 'Abastecimentos');
        }

        // Aba Despesas Extras
        if (desps.length) {
            const rowsD = [
                ['Data', 'Categoria', 'Descrição', 'NF', 'Forma Pgto', 'Valor (R$)'],
                ...desps.map(d => [FMT_DATE(d.data_despesa), d.categoria, d.descricao || '', d.nota_fiscal || '', d.forma_pagamento === 'a_prazo' ? `A Prazo (${d.tipo_pagamento || ''})` : `À Vista (${d.tipo_pagamento || ''})`, Number(d.valor || 0)]),
                ['TOTAL', '', '', '', '', despExtra],
            ];
            const wsD = XLSX.utils.aoa_to_sheet(rowsD);
            wsD['!cols'] = [12,22,30,12,18,14].map(w => ({ wch: w }));
            XLSX.utils.book_append_sheet(wb, wsD, 'Despesas Extras');
        }

        XLSX.writeFile(wb, `relatorio_placa_${veic?.placa || filtroPlaca}_${dados.periodo.replace(/\s/g,'_')}.xlsx`);
        showToast('Relatório por placa exportado!', 'success');
    };

    return { exportarExcel, exportarPorPlaca };
}
