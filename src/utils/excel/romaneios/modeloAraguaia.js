import * as XLSX from 'xlsx';
import { n, brl, today } from '../shared';
import { fmtPct, FRETE_CATEGORIAS } from 'config/freteConfig';

// ── EXPORTAR ROMANEIO INDIVIDUAL NO MODELO ARAGUAIA ──────────────────────────
/**
 * Gera um .xlsx no mesmo formato do modelo Excel da Comercial Araguaia.
 * Layout:
 *   Cabeçalho empresa + dados da viagem
 *   Tabela de materiais (Material | Unidade | Qtd | Peso unit | Peso Total)
 *   Tabela de pedidos com frete calculado
 *   Resumo financeiro
 */
export function exportRomaneioModeloAraguaia(romaneio) {
    if (!romaneio) return;

    const wb = XLSX.utils.book_new();
    const rows = [];

    // ── Cabeçalho da empresa ─────────────────────────────────────────────────
    rows.push(['Comercial Araguaia LTDA', '', '', '', '', '', '', '']);
    rows.push(['Rodovia BR-122, S/Nº KM 02, Guanambi - BA, 46430-000', '', '', '', '', '', '', '']);
    rows.push(['(77) 3451-2175', '', '', '', '', '', '', '']);
    rows.push([]);

    // ── Dados do romaneio ────────────────────────────────────────────────────
    rows.push([`ROMANEIO DE N.º ${romaneio.numero || ''}`, '', '', '', '', 'DATA:', new Date(romaneio.created_at || Date.now()).toLocaleDateString('pt-BR'), '']);
    rows.push(['MOTORISTA:', romaneio.motorista || '', '', 'PLACA:', romaneio.placa || '', 'SAÍDA:', romaneio.saida ? new Date(romaneio.saida).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '', '']);
    rows.push(['DESTINO:', romaneio.destino || '', '', '', '', 'STATUS:', romaneio.status || '', '']);
    rows.push([]);

    // ── Tabela de materiais ──────────────────────────────────────────────────
    rows.push(['Material', 'Unidade', 'Quantidade', 'Peso Unit. (kg)', 'Peso Total (kg)', '', '', '']);
    const itens = romaneio.romaneio_itens || [];
    itens.forEach(item => {
        const mat = item.materials || {};
        rows.push([
            mat.nome || `Material #${item.material_id}`,
            mat.unidade || '',
            item.quantidade || 0,
            mat.peso || 0,
            n(item.peso_total),
            '', '', ''
        ]);
    });
    rows.push([]);
    rows.push(['', '', '', 'PESO TOTAL DA CARGA:', romaneio.peso_total || itens.reduce((a,i)=>a+n(i.peso_total),0), '', '', '']);
    rows.push([]);

    // ── Tabela de pedidos ────────────────────────────────────────────────────
    const pedidos = romaneio.romaneio_pedidos || [];
    if (pedidos.length > 0) {
        rows.push(['PEDIDOS DA CARGA', '', '', '', '', '', '', '']);
        rows.push(['Nº Pedido', 'Categoria', '% Frete', 'Valor Pedido', 'Frete Calculado', '', '', '']);
        let totalCarga = 0, totalFrete = 0;
        pedidos.forEach(p => {
            const pct    = n(p.percentual_frete) || 0.05;
            const frete  = n(p.frete_calculado) || (n(p.valor_pedido) * pct);
            totalCarga  += n(p.valor_pedido);
            totalFrete  += frete;
            rows.push([
                p.numero_pedido || '',
                p.categoria_frete || '',
                fmtPct(pct),
                'R$ ' + brl(p.valor_pedido),
                'R$ ' + brl(frete),
                '', '', ''
            ]);
        });
        rows.push([]);
        rows.push(['', '', '', 'VALOR TOTAL DA CARGA:', 'R$ ' + brl(totalCarga), '', '', '']);
        rows.push(['', '', '', 'TOTAL FRETE CALCULADO:', 'R$ ' + brl(totalFrete), '', '', '']);
        rows.push([]);
    }

    // ── Resumo financeiro ────────────────────────────────────────────────────
    const custo = n(romaneio.custo_combustivel) + n(romaneio.custo_pedagio) + n(romaneio.custo_motorista);
    const frete = n(romaneio.valor_frete_calculado || romaneio.valor_frete);
    const margem = frete - custo;

    rows.push(['RESUMO FINANCEIRO', '', '', '', '', '', '', '']);
    rows.push(['Frete Calculado pelos Pedidos', '', '', '', 'R$ ' + brl(frete), '', '', '']);
    if (n(romaneio.distancia_km) > 0)
        rows.push(['Distância da Rota (ida+volta)', '', '', '', romaneio.distancia_km + ' km', '', '', '']);
    rows.push(['(-) Combustível', '', '', '', 'R$ ' + brl(romaneio.custo_combustivel), '', '', '']);
    rows.push(['(-) Pedágios', '', '', '', 'R$ ' + brl(romaneio.custo_pedagio), '', '', '']);
    rows.push(['(-) Diária Motorista', '', '', '', 'R$ ' + brl(romaneio.custo_motorista), '', '', '']);
    rows.push(['MARGEM DA VIAGEM', '', '', '', 'R$ ' + brl(margem), '', '', '']);
    if (frete > 0)
        rows.push(['% Margem sobre Frete', '', '', '', ((margem/frete)*100).toFixed(2)+'%', '', '', '']);
    rows.push([]);

    if (romaneio.observacoes) {
        rows.push(['OBSERVAÇÕES:', '', '', '', '', '', '', '']);
        rows.push([romaneio.observacoes, '', '', '', '', '', '', '']);
    }

    // ── Montar sheet ─────────────────────────────────────────────────────────
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch:40 },{ wch:14 },{ wch:14 },{ wch:22 },{ wch:22 },{ wch:16 },{ wch:22 },{ wch:16 }];

    // Largura mínima das linhas de dados
    const nomeCol = XLSX.utils.encode_col(0);
    XLSX.utils.book_append_sheet(wb, ws, 'Romaneio');

    // ── Sheet de percentuais para referência ─────────────────────────────────
    const refRows = [
        ['Tabela de Percentuais de Frete — Comercial Araguaia'],
        [],
        ['Categoria', 'Percentual', 'Cálculo'],
        ...FRETE_CATEGORIAS.filter(f => f.categoria !== 'Outros').map(f => [
            f.label, fmtPct(f.percentual), `${fmtPct(f.percentual)} × Valor do Pedido`
        ]),
    ];
    const wsRef = XLSX.utils.aoa_to_sheet(refRows);
    wsRef['!cols'] = [{ wch:28 },{ wch:14 },{ wch:32 }];
    XLSX.utils.book_append_sheet(wb, wsRef, 'Tabela de Fretes');

    const filename = `romaneio_${romaneio.numero || 'sem-numero'}_${today()}.xlsx`;
    XLSX.writeFile(wb, filename);
}
