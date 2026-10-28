import * as XLSX from 'xlsx';
import { n, today, brl } from './shared';

// ── EXPORTAR PONTOS DE PARADA (Carretas > Pontos de Parada > Registros) ──────
// Uma linha por trecho: o ponto principal + cada "horário extra" (parada
// extra no mesmo dia) do registro, na ordem em que aconteceram.
export function exportPontosParadaExcel(pontos, motoristas = []) {
    const nomeMotorista = id => motoristas.find(m => m.id === id)?.name || '';
    const rows = [];
    pontos.forEach(p => {
        const nome = nomeMotorista(p.motorista_id);
        const trechos = [
            { local: p.local, tipo: p.tipo_local, local_chegada: p.local_chegada, tipo_chegada: p.tipo_local_chegada,
              data_saida: p.data_saida, horario_saida: p.horario_saida, km_saida: p.km_saida,
              data_chegada: p.data_chegada, horario_chegada: p.horario_chegada, km_chegada: p.km_chegada,
              observacoes: p.observacoes },
            ...(p.horarios_extras || []).map(ex => ({
                local: ex.local, tipo: ex.tipo_local, local_chegada: ex.local_chegada, tipo_chegada: ex.tipo_local_chegada,
                data_saida: ex.data_saida, horario_saida: ex.horario_saida, km_saida: ex.km_saida,
                data_chegada: ex.data_chegada, horario_chegada: ex.horario_chegada, km_chegada: ex.km_chegada,
                observacoes: ex.observacoes,
            })),
        ];
        trechos.forEach(t => {
            const km = (n(t.km_chegada) && n(t.km_saida)) ? (n(t.km_chegada) - n(t.km_saida)) : '';
            rows.push({
                'Motorista': nome, 'Placa': p.veiculo?.placa || '',
                'Local Saída': t.local || '', 'Tipo Local': t.tipo || '',
                'Data Saída': t.data_saida ? new Date(t.data_saida+'T00:00:00').toLocaleDateString('pt-BR') : '',
                'Horário Saída': t.horario_saida || '', 'KM Saída': t.km_saida ?? '',
                'Local Chegada': t.local_chegada || '', 'Tipo Local Chegada': t.tipo_chegada || '',
                'Data Chegada': t.data_chegada ? new Date(t.data_chegada+'T00:00:00').toLocaleDateString('pt-BR') : '',
                'Horário Chegada': t.horario_chegada || '', 'KM Chegada': t.km_chegada ?? '',
                'KM Rodado': km, 'Observações': t.observacoes || '',
            });
        });
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch:22 },{ wch:12 },{ wch:20 },{ wch:14 },{ wch:12 },{ wch:12 },{ wch:10 },
                   { wch:20 },{ wch:16 },{ wch:12 },{ wch:12 },{ wch:10 },{ wch:12 },{ wch:30 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Pontos de Parada');
    XLSX.writeFile(wb, `pontos_parada_${today()}.xlsx`);
}

// ── EXPORTAR DESEMPENHO DE MOTORISTAS (Carretas > Pontos de Parada > Desempenho) ──
export function exportDesempenhoMotoristasExcel(dados) {
    const rows = dados.map(d => ({
        'Motorista': d.nome, 'KM Rodado': Math.round(n(d.kmTotal)),
        'Horas Trabalhadas': Number(n(d.horasTotal).toFixed(1)), 'Paradas': d.paradasTotal,
        'Litros Diesel': Number(n(d.litrosDiesel).toFixed(1)), 'Gasto Combustível (R$)': brl(d.gastoTotal),
        'Consumo (km/L)': d.consumoMedio ? Number(d.consumoMedio.toFixed(2)) : '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch:24 },{ wch:12 },{ wch:16 },{ wch:10 },{ wch:14 },{ wch:18 },{ wch:14 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Desempenho');
    XLSX.writeFile(wb, `desempenho_motoristas_${today()}.xlsx`);
}

// ── EXPORTAR HORAS EXTRAS (Carretas > Pontos de Parada > Horas Extras) ───────
export function exportHorasExtrasExcel(dados, valorHora = 0) {
    const wb = XLSX.utils.book_new();

    const rowsResumo = dados.porMotorista.map(m => ({
        'Motorista': m.nome, 'Dias com Hora Extra': m.diasComExtra,
        'Total Horas Extras': m.horasExtrasTotal, 'Valor a Pagar (R$)': brl(m.horasExtrasTotal * valorHora),
    }));
    const wsResumo = XLSX.utils.json_to_sheet(rowsResumo);
    wsResumo['!cols'] = [{ wch:24 },{ wch:18 },{ wch:16 },{ wch:16 }];
    XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo por Motorista');

    const rowsDias = dados.dias.map(d => ({
        'Motorista': d.nome, 'Data': new Date(d.data+'T00:00:00').toLocaleDateString('pt-BR'),
        'Horas Brutas': d.horasBrutas, 'Após Desconto Almoço': d.horasLiquidas, 'Hora Extra': d.horasExtras,
        'Valor (R$)': brl(d.horasExtras * valorHora),
    }));
    const wsDias = XLSX.utils.json_to_sheet(rowsDias);
    wsDias['!cols'] = [{ wch:24 },{ wch:12 },{ wch:14 },{ wch:18 },{ wch:12 },{ wch:14 }];
    XLSX.utils.book_append_sheet(wb, wsDias, 'Detalhe por Dia');

    XLSX.writeFile(wb, `horas_extras_${today()}.xlsx`);
}
