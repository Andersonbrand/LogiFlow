import * as XLSX from 'xlsx';
import { brl, today } from '../shared';

// ── MODELO 2: Relatório Consolidado ──────────────────────────────────────────
/**
 * Exporta relatório consolidado com múltiplas abas:
 * - Aba 1: Todos os romaneios do período
 * - Aba 2: Agrupado por motorista com bonificações
 * - Aba 3: Totais por categoria de frete
 */
export function exportRelatorioConsolidado(romaneios, periodo) {
    if (!romaneios || romaneios.length === 0) return;
    const wb = XLSX.utils.book_new();
    const n2 = v => Number(v || 0);
    const fmt = v => 'R$ ' + brl(v);
    const periodoStr = periodo || today();

    // ── ABA 1: Listagem de Romaneios ─────────────────────────────────────────
    const rowsRom = [];
    rowsRom.push([`RELATÓRIO CONSOLIDADO DE ROMANEIOS — ${periodoStr.toUpperCase()}`, '', '', '', '', '', '', '', '', '', '']);
    rowsRom.push([`Gerado em: ${new Date().toLocaleString('pt-BR')}`, '', '', '', '', '', '', '', '', '', '']);
    rowsRom.push([]);
    rowsRom.push(['Nº Romaneio', 'Motorista', 'Placa', 'Destino', 'Status', 'Aprovado', 'Data Saída', 'Peso Total (kg)', 'Valor Carga (R$)', 'Frete (R$)', 'Margem (R$)']);

    let totPeso = 0, totCarga = 0, totFrete = 0, totMargem = 0;
    romaneios.forEach(r => {
        const frete  = n2(r.valor_frete_calculado || r.valor_frete);
        const custo  = n2(r.custo_combustivel) + n2(r.custo_pedagio) + n2(r.custo_motorista);
        const margem = frete - custo;
        const peso   = n2(r.peso_total);
        const carga  = n2(r.valor_total_carga);
        totPeso   += peso;
        totCarga  += carga;
        totFrete  += frete;
        totMargem += margem;
        rowsRom.push([
            r.numero || '',
            r.motorista || '',
            r.placa || '',
            r.destino || '',
            r.status || '',
            r.aprovado ? 'Sim' : 'Não',
            r.saida ? new Date(r.saida).toLocaleDateString('pt-BR') : '',
            peso,
            brl(carga),
            brl(frete),
            brl(margem),
        ]);
    });
    rowsRom.push([]);
    rowsRom.push(['TOTAIS', '', '', '', '', `${romaneios.length} romaneios`, '', totPeso.toLocaleString('pt-BR', {maximumFractionDigits:0}) + ' kg', fmt(totCarga), fmt(totFrete), fmt(totMargem)]);

    const wsRom = XLSX.utils.aoa_to_sheet(rowsRom);
    wsRom['!cols'] = [{wch:14},{wch:22},{wch:10},{wch:22},{wch:14},{wch:10},{wch:12},{wch:16},{wch:18},{wch:16},{wch:16}];
    XLSX.utils.book_append_sheet(wb, wsRom, 'Romaneios');

    // ── ABA 2: Por Motorista + Bonificações ──────────────────────────────────
    const porMotorista = {};
    romaneios.forEach(r => {
        const key = r.motorista || 'Sem motorista';
        if (!porMotorista[key]) {
            porMotorista[key] = { romaneios: 0, peso: 0, frete: 0, margem: 0, kgFerragem: 0, temCimento: false };
        }
        const m    = porMotorista[key];
        const frete = n2(r.valor_frete_calculado || r.valor_frete);
        const custo = n2(r.custo_combustivel) + n2(r.custo_pedagio) + n2(r.custo_motorista);
        m.romaneios++;
        m.peso   += n2(r.peso_total);
        m.frete  += frete;
        m.margem += frete - custo;
        // Bonificação: calcular ferragem e cimento pelos itens
        const itens = r.romaneio_itens || [];
        itens.forEach(item => {
            const cat = item.materials?.categoria_frete || '';
            if (cat.toLowerCase().includes('cimento')) {
                m.temCimento = true;
            } else {
                m.kgFerragem += n2(item.peso_total);
            }
        });
    });

    const rowsMot = [];
    rowsMot.push([`RELATÓRIO POR MOTORISTA — ${periodoStr.toUpperCase()}`, '', '', '', '', '', '', '', '']);
    rowsMot.push([]);
    rowsMot.push(['Motorista', 'Romaneios', 'Peso Total (kg)', 'Frete Total (R$)', 'Margem Total (R$)', 'Ton. Ferragem', 'Bônus Ferragem (R$)', 'Bônus Cimento (R$)', 'Total Bônus (R$)']);

    let totBonusGeral = 0;
    Object.entries(porMotorista).sort((a,b) => b[1].frete - a[1].frete).forEach(([nome, d]) => {
        const tonsFerragem  = d.kgFerragem / 1000;
        const bonusFerragem = tonsFerragem * 9; // R$ 0,009 por kg = 0,9% = R$ 9,00 por tonelada
        const bonusCimento  = d.temCimento ? 40 : 0;
        const totalBonus    = bonusFerragem + bonusCimento;
        totBonusGeral      += totalBonus;
        rowsMot.push([
            nome,
            d.romaneios,
            d.peso.toLocaleString('pt-BR', {maximumFractionDigits:0}) + ' kg',
            brl(d.frete),
            brl(d.margem),
            tonsFerragem.toFixed(3) + ' t',
            brl(bonusFerragem),
            d.temCimento ? brl(bonusCimento) : '—',
            brl(totalBonus),
        ]);
    });
    rowsMot.push([]);
    rowsMot.push(['TOTAL BÔNUS PERÍODO', '', '', '', '', '', '', '', brl(totBonusGeral)]);

    const wsMot = XLSX.utils.aoa_to_sheet(rowsMot);
    wsMot['!cols'] = [{wch:24},{wch:12},{wch:16},{wch:18},{wch:18},{wch:16},{wch:20},{wch:18},{wch:18}];
    XLSX.utils.book_append_sheet(wb, wsMot, 'Por Motorista');

    // ── ABA 3: Por Categoria de Frete ────────────────────────────────────────
    const porCategoria = {};
    romaneios.forEach(r => {
        const pedidos = r.romaneio_pedidos || [];
        pedidos.forEach(p => {
            const cat = p.categoria_frete || 'Outros';
            if (!porCategoria[cat]) porCategoria[cat] = { pedidos: 0, valorCarga: 0, frete: 0 };
            const pct   = n2(p.percentual_frete) || 0.05;
            const frete = n2(p.frete_calculado) || (n2(p.valor_pedido) * pct);
            porCategoria[cat].pedidos++;
            porCategoria[cat].valorCarga += n2(p.valor_pedido);
            porCategoria[cat].frete      += frete;
        });
        // Fallback para romaneios sem pedidos detalhados
        if (pedidos.length === 0) {
            const cat = 'Não categorizado';
            if (!porCategoria[cat]) porCategoria[cat] = { pedidos: 0, valorCarga: 0, frete: 0 };
            porCategoria[cat].pedidos++;
            porCategoria[cat].valorCarga += n2(r.valor_total_carga);
            porCategoria[cat].frete      += n2(r.valor_frete_calculado || r.valor_frete);
        }
    });

    const rowsCat = [];
    rowsCat.push([`TOTAIS POR CATEGORIA DE FRETE — ${periodoStr.toUpperCase()}`, '', '', '', '']);
    rowsCat.push([]);
    rowsCat.push(['Categoria', 'Qtd Pedidos', 'Valor Total da Carga (R$)', 'Frete Total (R$)', '% do Frete Total']);
    const totalFreteGeral = Object.values(porCategoria).reduce((s, d) => s + d.frete, 0);
    Object.entries(porCategoria).sort((a,b) => b[1].frete - a[1].frete).forEach(([cat, d]) => {
        rowsCat.push([
            cat,
            d.pedidos,
            brl(d.valorCarga),
            brl(d.frete),
            totalFreteGeral > 0 ? ((d.frete / totalFreteGeral) * 100).toFixed(1) + '%' : '0%',
        ]);
    });
    rowsCat.push([]);
    rowsCat.push(['TOTAL GERAL', Object.values(porCategoria).reduce((s,d)=>s+d.pedidos,0), brl(Object.values(porCategoria).reduce((s,d)=>s+d.valorCarga,0)), brl(totalFreteGeral), '100%']);

    const wsCat = XLSX.utils.aoa_to_sheet(rowsCat);
    wsCat['!cols'] = [{wch:26},{wch:14},{wch:26},{wch:20},{wch:18}];
    XLSX.utils.book_append_sheet(wb, wsCat, 'Por Categoria');

    XLSX.writeFile(wb, `relatorio_consolidado_${periodoStr}.xlsx`);
}
