import * as XLSX from 'xlsx';

/** Estado e ações extraídos da tela — ver o componente que usa este hook. */
export function useExportMotorista({ bonificacoes, profile, showToast }) {
const exportar = () => {
        if (!bonificacoes.length) { showToast('Nenhum dado para exportar', 'error'); return; }
        const rows = bonificacoes.map(r => ({
            'Romaneio': r.numero || '', 'Destino': r.destino || '', 'Status': r.status || '',
            'Data': r.saida ? new Date(r.saida).toLocaleDateString('pt-BR') : '',
            'Aprovado': r.aprovado ? 'Sim' : 'Não',
            'Ton. Ferragem': r.bonif?.toneladasFerragem || 0,
            'Bônus (R$)': r.bonif?.valorTotal || 0,
        }));

        // Linha de somatório ao final da própria listagem
        const totTon    = bonificacoes.reduce((s, r) => s + Number(r.bonif?.toneladasFerragem || 0), 0);
        const totBonus  = bonificacoes.reduce((s, r) => s + Number(r.bonif?.valorTotal || 0), 0);
        rows.push({
            'Romaneio': 'TOTAL', 'Destino': '', 'Status': '', 'Data': '',
            'Aprovado': `${bonificacoes.length} romaneio(ns)`,
            'Ton. Ferragem': totTon.toFixed(3),
            'Bônus (R$)': totBonus.toFixed(2),
        });

        const ws = XLSX.utils.json_to_sheet(rows);
        ws['!cols'] = [12,20,12,12,10,14,14].map(w => ({ wch: w }));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Romaneios');

        // Aba adicional só com o resumo/soma dos bônus
        const aprovados   = bonificacoes.filter(r => r.aprovado);
        const totBonusApr = aprovados.reduce((s, r) => s + Number(r.bonif?.valorTotal || 0), 0);
        const wsResumo = XLSX.utils.json_to_sheet([
            { 'Indicador': 'Motorista',                       'Valor': profile?.name || '' },
            { 'Indicador': 'Data da exportação',               'Valor': new Date().toLocaleDateString('pt-BR') },
            { 'Indicador': 'Total de romaneios',                'Valor': bonificacoes.length },
            { 'Indicador': 'Romaneios aprovados',               'Valor': aprovados.length },
            { 'Indicador': 'Total de toneladas (ferragem)',     'Valor': totTon.toFixed(3) },
            { 'Indicador': 'SOMA TOTAL DE BÔNUS (R$)',          'Valor': totBonus.toFixed(2) },
            { 'Indicador': 'Soma de bônus já aprovados (R$)',   'Valor': totBonusApr.toFixed(2) },
        ]);
        wsResumo['!cols'] = [{ wch: 34 }, { wch: 20 }];
        XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo (Soma)');

        XLSX.writeFile(wb, `romaneios_${profile?.name||'motorista'}_${new Date().toLocaleDateString('pt-BR').replace(/\//g,'-')}.xlsx`);
        showToast('Exportado!', 'success');
    };

    return { exportar };
}
