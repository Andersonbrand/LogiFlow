import * as XLSX from 'xlsx';
import { contarItensOk, CHECKLIST_ITENS } from 'services/carretas';
import { exportDiariaModelo } from 'utils/excel';
import { FMT } from '../utils/helpers';

/** Estado e ações extraídos da tela — ver o componente que usa este hook. */
export function useExportPainelMotorista({ abast, checklists, diarias, mes, motorista, romaneiosDiarias, showToast, tab }) {
// Exportar — abastecimentos e checklists: Excel simples; diárias: modelo oficial
    const exportar = () => {
        if (tab === 'diarias') {
            // Exporta cada diária avulsa no modelo oficial (igual ao módulo de carretas)
            const avulsas = diarias;
            const romDiarias = romaneiosDiarias;
            if (!avulsas.length && !romDiarias.length) {
                showToast('Nenhuma diária no período.', 'error'); return;
            }
            // Diárias avulsas: exporta cada uma no modelo
            avulsas.forEach(d => {
                exportDiariaModelo({ ...d, motorista: { name: motorista.name } });
            });
            // Diárias via romaneio: monta objeto compatível com exportDiariaModelo
            romDiarias.forEach(r => {
                exportDiariaModelo({
                    motorista:       { name: motorista.name },
                    veiculo:         { placa: r.placa || motorista.veiculo?.placa || '' },
                    data_inicio:     r.saida ? r.saida.slice(0,10) : '',
                    data_fim:        null,
                    quantidade_dias: r.dias_diaria || 1,
                    valor_dia:       r.valor_diaria_dia || (r.custo_motorista / (r.dias_diaria || 1)),
                    valor_total:     Number(r.custo_motorista || 0),
                    descricao:       r.diaria_descricao || r.destino || '',
                    viagem:          { numero: r.numero, destino: r.destino },
                    assinatura_logistica: r.assinatura_diaria_logistica || null,
                    assinatura_logistica_at: r.assinatura_diaria_logistica_at || null,
                    assinatura_transporte: r.assinatura_diaria_transporte || null,
                    assinatura_transporte_at: r.assinatura_diaria_transporte_at || null,
                });
            });
            showToast(`${avulsas.length + romDiarias.length} diária(s) exportada(s)!`, 'success');
            return;
        }
        // Abastecimentos e Checklists — comportamento original
        const wb = XLSX.utils.book_new();
        if (abast.length) {
            const ws = XLSX.utils.json_to_sheet(abast.map(a => ({
                'Data': FMT(a.data_abastecimento), 'Placa': a.veiculo?.placa || a.veiculo_caminhao_placa || '',
                'Posto': a.posto || '', 'Diesel (L)': Number(a.litros_diesel||0),
                'R$ Diesel': Number(a.valor_diesel||0), 'Arla (L)': Number(a.litros_arla||0),
                'R$ Arla': Number(a.valor_arla||0), 'Total': Number(a.valor_total||0),
            })));
            ws['!cols'] = [12,12,18,10,12,10,12,12].map(w => ({ wch: w }));
            XLSX.utils.book_append_sheet(wb, ws, 'Abastecimentos');
        }
        if (checklists.length) {
            const ws = XLSX.utils.json_to_sheet(checklists.map(c => ({
                'Semana': FMT(c.semana_ref), 'Placa': c.veiculo?.placa || c.veiculo_caminhao_placa || '',
                'Odômetro (km)': c.odometro != null ? Number(c.odometro) : '',
                'Status': c.aprovado ? 'Aprovado' : 'Pendente',
                'Itens OK': `${contarItensOk(c.itens)}/${Object.keys(c.itens || {}).length || CHECKLIST_ITENS.length}`,
                'Problemas': c.problemas || '', 'Necessidades': c.necessidades || '',
            })));
            ws['!cols'] = [12,12,14,12,10,30,30].map(w => ({ wch: w }));
            XLSX.utils.book_append_sheet(wb, ws, 'Checklists');
        }
        if (!wb.SheetNames.length) { showToast('Nenhum dado para exportar', 'error'); return; }
        XLSX.writeFile(wb, `motorista_${motorista.name.replace(/\s+/g, '_')}_${mes}.xlsx`);
        showToast('Exportado!', 'success');
    };

// Exportar diária individual no modelo oficial
    

const exportarRomaneioComoDialia = (r) => {
        exportDiariaModelo({
            motorista:       { name: motorista.name },
            veiculo:         { placa: r.placa || motorista.veiculo?.placa || '' },
            data_inicio:     r.saida ? r.saida.slice(0,10) : '',
            data_fim:        null,
            quantidade_dias: r.dias_diaria || 1,
            valor_dia:       r.valor_diaria_dia || (r.custo_motorista / (r.dias_diaria || 1)),
            valor_total:     Number(r.custo_motorista || 0),
            descricao:       r.diaria_descricao || r.destino || '',
            viagem:          { numero: r.numero, destino: r.destino },
            assinatura_logistica: r.assinatura_diaria_logistica || null,
            assinatura_logistica_at: r.assinatura_diaria_logistica_at || null,
            assinatura_transporte: r.assinatura_diaria_transporte || null,
            assinatura_transporte_at: r.assinatura_diaria_transporte_at || null,
        });
    };

    return { exportar, exportarRomaneioComoDialia };
}
