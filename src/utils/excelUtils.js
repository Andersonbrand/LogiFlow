import * as XLSX from 'xlsx';
import { FRETE_CATEGORIAS, fmtPct } from 'utils/freteConfig';

// ── Helpers ───────────────────────────────────────────────────────────────────
function today() { return new Date().toLocaleDateString('pt-BR').replace(/\//g,'-'); }
const brl = v => Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
const n   = v => Number(v||0);

// ── Export simples (lista) ────────────────────────────────────────────────────
export function exportMaterialsToExcel(materials) {
    const rows = materials.map(m => ({
        'Nome': m.nome, 'Categoria': m.categoria, 'Unidade': m.unidade,
        'Peso (kg)': m.peso, 'Categoria Frete': m.categoria_frete || '',
        '% Frete': m.percentual_frete != null ? (m.percentual_frete*100).toFixed(2)+'%' : '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch:40 },{ wch:18 },{ wch:10 },{ wch:12 },{ wch:22 },{ wch:10 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Materiais');
    XLSX.writeFile(wb, `materiais_${today()}.xlsx`);
}

export function exportVehiclesToExcel(vehicles) {
    const rows = vehicles.map(v => ({
        'Placa': v.placa, 'Tipo': v.tipo, 'Cap. Peso (kg)': v.capacidadePeso,
        'Cap. Volume (m³)': v.capacidadeVolume, 'Status': v.status,
        'Última Utilização': v.ultimaUtilizacao || '', 'Utilização (%)': v.utilizacao||0,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch:12 },{ wch:15 },{ wch:15 },{ wch:16 },{ wch:14 },{ wch:18 },{ wch:14 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Veículos');
    XLSX.writeFile(wb, `veiculos_${today()}.xlsx`);
}

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
        rows.push(['Distância da Rota', '', '', '', romaneio.distancia_km + ' km', '', '', '']);
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

// ── MODELO 1: Romaneio Individual ────────────────────────────────────────────
/**
 * Guia 1 — Romaneio: cabeçalho empresa + dados viagem + materiais por pedido (vertical)
 * Guia 2 — Financeiro: pedidos com frete, valor da carga e resumo
 */
export function exportRomaneioModelo1(romaneio) {
    if (!romaneio) return;
    const wb   = XLSX.utils.book_new();
    const fmt  = v => 'R$ ' + brl(v);
    const pedidos = romaneio.romaneio_pedidos || [];
    const itens   = romaneio.romaneio_itens   || [];
    const dtCriado = new Date(romaneio.created_at || Date.now()).toLocaleDateString('pt-BR');
    const dtSaida  = romaneio.saida
        ? new Date(romaneio.saida).toLocaleString('pt-BR', {day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})
        : '—';

    // ════════════════════════════════════════════════════════════
    // GUIA 1 — ROMANEIO + MATERIAIS
    // ════════════════════════════════════════════════════════════
    const g1 = [];

    // Cabeçalho empresa
    g1.push(['COMERCIAL ARAGUAIA LTDA']);
    g1.push(['Rodovia BR-122, S/Nº KM 02 – Guanambi – BA – 46430-000']);
    g1.push(['Fone: (77) 3451-2175']);
    g1.push([]);

    // Dados do romaneio (vertical)
    g1.push(['ROMANEIO',      romaneio.numero || '']);
    g1.push(['Data',          dtCriado]);
    g1.push(['Motorista',     romaneio.motorista || '']);
    g1.push(['Placa',         romaneio.placa     || '']);
    g1.push(['Destino',       romaneio.destino   || '']);
    g1.push(['Saída',         dtSaida]);
    if (romaneio.distancia_km) g1.push(['Distância', romaneio.distancia_km + ' km']);
    g1.push(['Status',        romaneio.status    || '']);
    g1.push([]);

    // Materiais por pedido
    if (pedidos.length > 0) {
        pedidos.forEach((ped, idx) => {
            const itensDoPedido = itens.filter(i => i.pedido_id === ped.id);
            const pesoTotal = itensDoPedido.reduce((s, i) => s + n(i.peso_total), 0);

            // Cabeçalho do pedido
            g1.push([`PEDIDO ${idx + 1}${ped.numero_pedido ? ' – Nº ' + ped.numero_pedido : ''}`]);
            if (ped.cidade_destino) g1.push(['Cidade de Destino', ped.cidade_destino]);
            g1.push([]);

            // Tabela de materiais
            g1.push(['Material', 'Unidade', 'Quantidade', 'Peso Unit. (kg)', 'Peso Total (kg)']);
            if (itensDoPedido.length > 0) {
                itensDoPedido.forEach(item => {
                    const mat = item.materials || {};
                    g1.push([
                        mat.nome || `Material #${item.material_id}`,
                        mat.unidade  || '',
                        item.quantidade || 0,
                        mat.peso || 0,
                        n(item.peso_total),
                    ]);
                });
            } else {
                g1.push(['(sem materiais cadastrados)', '', '', '', '']);
            }
            g1.push(['', '', '', 'Peso do Pedido:', pesoTotal.toLocaleString('pt-BR', {minimumFractionDigits:2}) + ' kg']);
            g1.push([]);
        });
    } else {
        // Fallback sem pedidos estruturados
        g1.push(['MATERIAIS TRANSPORTADOS']);
        g1.push(['Material', 'Unidade', 'Quantidade', 'Peso Unit. (kg)', 'Peso Total (kg)']);
        itens.forEach(item => {
            const mat = item.materials || {};
            g1.push([mat.nome || `#${item.material_id}`, mat.unidade || '', item.quantidade || 0, mat.peso || 0, n(item.peso_total)]);
        });
        g1.push([]);
    }

    // Peso total geral
    const pesoGeral = itens.reduce((s, i) => s + n(i.peso_total), 0);
    g1.push(['PESO TOTAL DA CARGA', pesoGeral.toLocaleString('pt-BR', {minimumFractionDigits:2}) + ' kg']);
    g1.push([]);

    // Assinaturas
    g1.push([]);
    g1.push(['______________________________', '', '______________________________']);
    g1.push(['Motorista', '', 'Responsável']);

    if (romaneio.observacoes) {
        g1.push([]);
        g1.push(['OBSERVAÇÕES']);
        g1.push([romaneio.observacoes]);
    }

    const ws1 = XLSX.utils.aoa_to_sheet(g1);
    ws1['!cols'] = [{wch:38},{wch:18},{wch:14},{wch:18},{wch:18}];
    XLSX.utils.book_append_sheet(wb, ws1, 'Romaneio');

    // ════════════════════════════════════════════════════════════
    // GUIA 2 — FINANCEIRO (pedidos + frete + resumo)
    // ════════════════════════════════════════════════════════════
    const g2 = [];

    g2.push(['COMERCIAL ARAGUAIA LTDA – FINANCEIRO DO ROMANEIO']);
    g2.push([`Romaneio Nº ${romaneio.numero || ''}  |  Motorista: ${romaneio.motorista || ''}  |  Destino: ${romaneio.destino || ''}  |  Data: ${dtCriado}`]);
    g2.push([]);

    // Tabela de pedidos
    g2.push(['PEDIDOS DA CARGA', '', '', '', '', '']);
    g2.push(['Nº Pedido', 'Cidade Destino', 'Categoria de Frete', '% Frete', 'Valor do Pedido (R$)', 'Frete Calculado (R$)']);

    let totalCarga = 0, totalFrete = 0;
    if (pedidos.length > 0) {
        pedidos.forEach(p => {
            const pct   = n(p.percentual_frete) || 0.05;
            const frete = n(p.frete_calculado) || (n(p.valor_pedido) * pct);
            totalCarga += n(p.valor_pedido);
            totalFrete += frete;
            g2.push([
                p.numero_pedido  || '—',
                p.cidade_destino || romaneio.destino || '—',
                p.categoria_frete || '',
                fmtPct(pct),
                brl(p.valor_pedido),
                brl(frete),
            ]);
        });
    } else {
        g2.push(['(sem pedidos cadastrados)', '', '', '', '', '']);
    }
    g2.push([]);
    g2.push(['', '', '', '', 'TOTAL VALOR DA CARGA:', brl(totalCarga || n(romaneio.valor_total_carga))]);
    g2.push(['', '', '', '', 'TOTAL FRETE CALCULADO:', brl(totalFrete || n(romaneio.valor_frete_calculado || romaneio.valor_frete))]);
    g2.push([]);

    // Custos operacionais
    const freteTotal = totalFrete || n(romaneio.valor_frete_calculado || romaneio.valor_frete);
    const custoComb  = n(romaneio.custo_combustivel);
    const custoPed   = n(romaneio.custo_pedagio);
    const custoDia   = n(romaneio.custo_motorista);
    const custoTotal = custoComb + custoPed + custoDia;
    const margem     = freteTotal - custoTotal;

    g2.push(['CUSTOS OPERACIONAIS', '', '', '', '', '']);
    g2.push(['Combustível',      '', '', '', '', fmt(custoComb)]);
    g2.push(['Pedágios',         '', '', '', '', fmt(custoPed)]);
    g2.push(['Diária Motorista', '', '', '', '', fmt(custoDia)]);
    if (romaneio.distancia_km) g2.push(['Distância da Rota', '', '', '', '', romaneio.distancia_km + ' km']);
    g2.push([]);
    g2.push(['RESUMO FINANCEIRO', '', '', '', '', '']);
    g2.push(['Frete Total',      '', '', '', '', fmt(freteTotal)]);
    g2.push(['(-) Custo Total',  '', '', '', '', fmt(custoTotal)]);
    g2.push(['MARGEM DA VIAGEM', '', '', '', '', fmt(margem)]);
    if (freteTotal > 0) g2.push(['% Margem s/ Frete', '', '', '', '', ((margem / freteTotal) * 100).toFixed(2) + '%']);

    const ws2 = XLSX.utils.aoa_to_sheet(g2);
    ws2['!cols'] = [{wch:20},{wch:20},{wch:22},{wch:10},{wch:24},{wch:22}];
    XLSX.utils.book_append_sheet(wb, ws2, 'Financeiro');

    XLSX.writeFile(wb, `romaneio_${romaneio.numero || 'sem-numero'}_${today()}.xlsx`);
}

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

// ── Import ────────────────────────────────────────────────────────────────────
export function parseMaterialsFromFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const wb = XLSX.read(e.target.result, { type:'array' });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const rows = XLSX.utils.sheet_to_json(ws, { defval:'' });
                const materials = rows
                    .filter(r => r['Nome'] || r['nome'])
                    .map(r => ({
                        nome: String(r['Nome']||r['nome']||'').trim(),
                        categoria: String(r['Categoria']||r['categoria']||'Outros').trim(),
                        unidade: String(r['Unidade']||r['unidade']||'un').trim(),
                        peso: Number(r['Peso (kg)']||r['peso']||r['Peso']||0),
                    })).filter(m => m.nome && m.peso > 0);
                resolve(materials);
            } catch (err) { reject(new Error('Arquivo inválido. Use o modelo fornecido.')); }
        };
        reader.onerror = () => reject(new Error('Erro ao ler o arquivo.'));
        reader.readAsArrayBuffer(file);
    });
}

export function parseVehiclesFromFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const wb = XLSX.read(e.target.result, { type:'array' });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const rows = XLSX.utils.sheet_to_json(ws, { defval:'' });
                const vehicles = rows
                    .filter(r => r['Placa']||r['placa'])
                    .map(r => ({
                        placa: String(r['Placa']||r['placa']||'').trim().toUpperCase(),
                        tipo: String(r['Tipo']||r['tipo']||'Caminhão').trim(),
                        capacidadePeso: Number(r['Cap. Peso (kg)']||r['capacidadePeso']||0),
                        capacidadeVolume: Number(r['Cap. Volume (m³)']||r['capacidadeVolume']||0),
                        status: String(r['Status']||r['status']||'Disponível').trim(),
                        utilizacao: Number(r['Utilização (%)']||r['utilizacao']||0),
                    })).filter(v => v.placa && v.capacidadePeso > 0);
                resolve(vehicles);
            } catch (err) { reject(new Error('Arquivo inválido. Use o modelo fornecido.')); }
        };
        reader.onerror = () => reject(new Error('Erro ao ler o arquivo.'));
        reader.readAsArrayBuffer(file);
    });
}

// ── Templates ─────────────────────────────────────────────────────────────────
export function downloadMaterialsTemplate() {
    const rows = [
        { 'Nome':'CIMENTO MONTES CLAROS','Categoria':'Cimento','Unidade':'SC','Peso (kg)':50,'Categoria Frete':'Cimento','% Frete':'5.67%' },
        { 'Nome':'VERGALHAO 1/2 GERDAU', 'Categoria':'Ferragens','Unidade':'BR','Peso (kg)':11.55,'Categoria Frete':'Ferragens','% Frete':'6.00%' },
        { 'Nome':'TELHA RESIDENCIAL 5MM','Categoria':'Telhas','Unidade':'PC','Peso (kg)':27.1,'Categoria Frete':'Telhas de Fibrocimento','% Frete':'6.00%' },
    ];
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch:40 },{ wch:16 },{ wch:10 },{ wch:12 },{ wch:24 },{ wch:10 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Materiais');
    XLSX.writeFile(wb, 'modelo_materiais.xlsx');
}

export function downloadVehiclesTemplate() {
    const rows = [
        { 'Placa':'ABC-1234','Tipo':'Caminhão','Cap. Peso (kg)':12000,'Cap. Volume (m³)':45,'Status':'Disponível','Última Utilização':'2026-03-01','Utilização (%)':75 },
        { 'Placa':'DEF-5678','Tipo':'Van','Cap. Peso (kg)':3500,'Cap. Volume (m³)':12,'Status':'Disponível','Última Utilização':'2026-03-02','Utilização (%)':50 },
    ];
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch:12 },{ wch:12 },{ wch:15 },{ wch:15 },{ wch:14 },{ wch:18 },{ wch:14 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Veículos');
    XLSX.writeFile(wb, 'modelo_veiculos.xlsx');
}
