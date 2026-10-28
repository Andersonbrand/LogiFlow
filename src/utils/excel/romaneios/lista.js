import { brl, n, today, sanitizeSheetName } from '../shared';
import * as XLSX from 'xlsx';

export function exportRomaneiosToExcel(romaneios) {
    const rows = romaneios.map(r => ({
        'Número': r.numero, 'Motorista': r.motorista||'', 'Placa': r.placa||'',
        'Destino': r.destino||'', 'Status': r.status, 'Peso Total (kg)': r.peso_total||0,
        'Saída': r.saida ? new Date(r.saida).toLocaleString('pt-BR') : '',
        'Valor Carga (R$)': brl(r.valor_total_carga), 'Frete Calc. (R$)': brl(r.valor_frete_calculado||r.valor_frete),
        'Custo Op. (R$)': brl(n(r.custo_combustivel)+n(r.custo_pedagio)+n(r.custo_motorista)),
        'Margem (R$)': brl(r.margem_lucro), 'Observações': r.observacoes||'',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch:18 },{ wch:22 },{ wch:12 },{ wch:22 },{ wch:14 },{ wch:16 },
                   { wch:20 },{ wch:18 },{ wch:16 },{ wch:16 },{ wch:14 },{ wch:30 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Romaneios');
    XLSX.writeFile(wb, `romaneios_${today()}.xlsx`);
}

export function exportListaVendedoresExcel(romaneio, pedidos) {
    const linhas = (pedidos || []).map(p => ({
        'Nº do Pedido': p.numero_pedido || '',
        'Cliente':      p.nome_cliente  || '',
        'Vendedor':     p.nome_vendedor || '',
    })).filter(l => l['Nº do Pedido'] || l['Cliente'] || l['Vendedor']);

    const wb = XLSX.utils.book_new();
    const usedNames = new Set();

    const wsTodos = XLSX.utils.json_to_sheet(linhas);
    wsTodos['!cols'] = [{ wch: 16 }, { wch: 32 }, { wch: 28 }];
    XLSX.utils.book_append_sheet(wb, wsTodos, sanitizeSheetName('Todos', usedNames));

    // Uma aba por vendedor (pedidos sem vendedor definido ficam agrupados em "Sem vendedor")
    const porVendedor = {};
    linhas.forEach(l => {
        const chave = l['Vendedor'] || 'Sem vendedor';
        (porVendedor[chave] = porVendedor[chave] || []).push(l);
    });
    Object.keys(porVendedor).sort((a, b) => a.localeCompare(b, 'pt-BR')).forEach(vendedor => {
        const ws = XLSX.utils.json_to_sheet(porVendedor[vendedor]);
        ws['!cols'] = [{ wch: 16 }, { wch: 32 }, { wch: 28 }];
        XLSX.utils.book_append_sheet(wb, ws, sanitizeSheetName(vendedor, usedNames));
    });

    const numero = (romaneio?.numero || 'romaneio').toString().replace(/[^\w-]/g, '_');
    XLSX.writeFile(wb, `pedidos_vendedores_${numero}_${today()}.xlsx`);
}
