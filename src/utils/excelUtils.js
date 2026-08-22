import * as XLSX from 'xlsx';
import { FRETE_CATEGORIAS, fmtPct } from 'utils/freteConfig';
import { getTelhaInfo } from 'utils/telhaUtils';

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

// ── EXPORTAR LISTA DE PEDIDOS POR VENDEDOR (Romaneio > Pedidos) ──────────────
// Gera um Excel simples só com Nº do Pedido / Cliente / Vendedor, pra mandar
// pra cada vendedor confirmando que os pedidos dele já estão em rota. A aba
// "Todos" traz tudo junto; cada vendedor com pedido no romaneio ganha também
// sua própria aba, já filtrada, funcionando como o "agrupamento" por vendedor.
function sanitizeSheetName(name, used) {
    let base = (name || 'Sem vendedor').replace(/[\\/?*[\]:]/g, ' ').trim().slice(0, 28) || 'Sem vendedor';
    let out = base, i = 2;
    while (used.has(out.toLowerCase())) { out = `${base} (${i})`; i++; }
    used.add(out.toLowerCase());
    return out;
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

// ── EXPORTAR BONIFICAÇÕES DOS MOTORISTAS (Admin) ─────────────────────────────
export function exportBonificacoesAdminExcel(bonifs) {
    const rows = bonifs.map(b => ({
        'Motorista': b.motorista, 'Viagens': b.total_viagens,
        'Peso Total (kg)': Number(b.peso_total || 0), 'Bonificação (R$)': brl(b.bonificacao_total),
    }));
    rows.push({
        'Motorista': 'TOTAL',
        'Viagens': bonifs.reduce((s, b) => s + Number(b.total_viagens || 0), 0),
        'Peso Total (kg)': bonifs.reduce((s, b) => s + Number(b.peso_total || 0), 0),
        'Bonificação (R$)': brl(bonifs.reduce((s, b) => s + Number(b.bonificacao_total || 0), 0)),
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch:24 },{ wch:10 },{ wch:16 },{ wch:16 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Bonificações');
    XLSX.writeFile(wb, `bonificacoes_motoristas_${today()}.xlsx`);
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
// ── Geração de XLSX com estilos reais via XML binário ─────────────────────────
// SheetJS free não suporta estilos — usamos XML OOXML direto para ter cores,
// negrito, bordas e mesclagens exatamente como o modelo

function _xlsxCrc32(buf) {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
        let c = i;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
        t[i] = c;
    }
    let crc = 0xFFFFFFFF;
    for (const b of buf) crc = t[(crc ^ b) & 0xFF] ^ (crc >>> 8);
    return (crc ^ 0xFFFFFFFF) >>> 0;
}

function _xlsxBuildZip(files) {
    const enc = new TextEncoder();
    const entries = Object.entries(files).map(([name, content]) => {
        const nameB = enc.encode(name);
        const dataB = enc.encode(content);
        return { nameB, dataB, crc: _xlsxCrc32(dataB) };
    });

    const localParts = [];
    const cdParts    = [];
    let offset = 0;

    for (const e of entries) {
        const lh = new Uint8Array(30 + e.nameB.length);
        const dv = new DataView(lh.buffer);
        dv.setUint32(0, 0x04034b50, true);
        dv.setUint16(4, 20, true); dv.setUint16(6, 0, true); dv.setUint16(8, 0, true);
        dv.setUint16(10, 0, true); dv.setUint16(12, 0, true);
        dv.setUint32(14, e.crc, true);
        dv.setUint32(18, e.dataB.length, true); dv.setUint32(22, e.dataB.length, true);
        dv.setUint16(26, e.nameB.length, true); dv.setUint16(28, 0, true);
        lh.set(e.nameB, 30);

        const cd = new Uint8Array(46 + e.nameB.length);
        const cv = new DataView(cd.buffer);
        cv.setUint32(0, 0x02014b50, true);
        cv.setUint16(4, 20, true); cv.setUint16(6, 20, true);
        cv.setUint16(8, 0, true); cv.setUint16(10, 0, true);
        cv.setUint16(12, 0, true); cv.setUint16(14, 0, true);
        cv.setUint32(16, e.crc, true);
        cv.setUint32(20, e.dataB.length, true); cv.setUint32(24, e.dataB.length, true);
        cv.setUint16(28, e.nameB.length, true);
        for (let i = 30; i < 42; i += 2) cv.setUint16(i, 0, true);
        cv.setUint32(42, offset, true);
        cd.set(e.nameB, 46);

        localParts.push(lh, e.dataB);
        cdParts.push(cd);
        offset += lh.length + e.dataB.length;
    }

    const cdSize = cdParts.reduce((s, b) => s + b.length, 0);
    const eocd   = new Uint8Array(22);
    const ev     = new DataView(eocd.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(4, 0, true); ev.setUint16(6, 0, true);
    ev.setUint16(8, entries.length, true); ev.setUint16(10, entries.length, true);
    ev.setUint32(12, cdSize, true); ev.setUint32(16, offset, true);
    ev.setUint16(20, 0, true);

    const all   = [...localParts, ...cdParts, eocd];
    const total = all.reduce((s, b) => s + b.length, 0);
    const out   = new Uint8Array(total);
    let pos = 0;
    for (const b of all) { out.set(b, pos); pos += b.length; }
    return out;
}

function _xlsxEsc(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function _xlsxCol(n) {
    let s = ''; n++;
    while (n > 0) { const r = (n-1)%26; s = String.fromCharCode(65+r)+s; n = Math.floor((n-1)/26); }
    return s;
}

// ── Adaptador: romaneio de Carretas → mesmo formato usado por caminhões ──────
// Permite reaproveitar exportRomaneioModelo1 (cidade → empresa → material,
// com pedido/cliente/vendedor/frete por linha) também para o módulo Carretas,
// sem duplicar toda a lógica de geração do Excel — o resultado sai idêntico
// ao modelo já usado nos romaneios de caminhões.
export function toModelo1Romaneio(romaneioCarretas) {
    const r = romaneioCarretas || {};
    return {
        numero:   r.numero,
        destino:  r.destino,
        motorista: r.motorista?.name || r.motorista_nome || '',
        placa:     r.veiculo?.placa  || r.placa || '',
        saida:     r.data_saida ? `${r.data_saida}T00:00:00` : null,
        romaneio_pedidos: (r.pedidos || []).map(p => ({
            id: p.id,
            numero_pedido: p.numero_pedido,
            cidade_destino: p.cidade_destino,
            empresa: p.empresa,
            valor_pedido: p.valor_pedido,
            percentual_frete: p.percentual_frete,
            frete_calculado: p.frete_calculado,
        })),
        romaneio_itens: (r.itens || []).map(i => ({
            pedido_id: i.pedido_id,
            material_id: i.material?.id,
            quantidade: i.quantidade,
            peso_total: i.peso_total,
            peso_unit: i.peso_unit,
            is_telha_zinco: i.is_telha_zinco,
            comprimento_telha: i.comprimento_telha,
            metros_totais: i.metros_totais,
            materials: i.material ? {
                nome: i.material.nome, unidade: i.material.unidade, peso: i.material.peso,
                is_telha_zinco: i.material.is_telha_zinco, peso_base_metro: i.material.peso_base_metro,
            } : null,
        })),
    };
}

export function exportRomaneioModelo1(romaneio) {
    if (!romaneio) return;

    const pedidos = romaneio.romaneio_pedidos || [];
    const itens   = romaneio.romaneio_itens   || [];
    const dtSaida = romaneio.saida
        ? new Date(romaneio.saida).toLocaleString('pt-BR', {
            day:'2-digit', month:'2-digit', year:'numeric',
            hour:'2-digit', minute:'2-digit'
          })
        : '—';

    // ── Agrupar itens por Empresa → Cidade → Pedido → material ───────────────
    const pedMap = {};
    pedidos.forEach(p => { pedMap[p.id] = p; });

    // Mapa de valor e frete por pedido_id
    const pedValorMap = {};
    pedidos.forEach(p => {
        if (p.id) {
            pedValorMap[p.id] = {
                valor: Number(p.valor_pedido || 0),
                frete: Number(p.frete_calculado || 0),
                pct:   Number(p.percentual_frete || 0),
            };
        }
    });

    const grupos = {};
    itens.forEach(item => {
        const mat        = item.materials || {};
        const pedido     = pedMap[item.pedido_id] || {};
        const empresa    = pedido.empresa || '—';
        const cidade     = pedido.cidade_destino || romaneio.destino || '—';
        const pedidoNum  = pedido.numero_pedido || 'Sem número';
        const { isTelha, compTelha, metros: metrosItem } = getTelhaInfo(item);
        // Para telhas, cada comprimento de corte vira uma linha própria — não
        // podemos somar peças de comprimentos diferentes na mesma linha.
        const mid = String(item.material_id || mat.nome || 'x') + (isTelha ? `@${compTelha.toFixed(2)}` : '');

        if (!grupos[empresa]) grupos[empresa] = {};
        if (!grupos[empresa][cidade]) grupos[empresa][cidade] = {};
        if (!grupos[empresa][cidade][pedidoNum]) grupos[empresa][cidade][pedidoNum] = {};
        if (!grupos[empresa][cidade][pedidoNum][mid]) {
            grupos[empresa][cidade][pedidoNum][mid] = {
                nome:     mat.nome     || `#${item.material_id}`,
                unidade:  mat.unidade  || '',
                isTelha, compTelha,
                pesoUnit: Number(item.peso_unit || mat.peso || 0),
                quant: 0, pesoTotal: 0, metrosTotais: 0,
                pedidoId: item.pedido_id,
            };
        }
        grupos[empresa][cidade][pedidoNum][mid].quant        += Number(item.quantidade    || 0);
        grupos[empresa][cidade][pedidoNum][mid].pesoTotal     += Number(item.peso_total    || 0);
        grupos[empresa][cidade][pedidoNum][mid].metrosTotais  += metrosItem;
    });

    const empresasArr = Object.entries(grupos)
        .sort(([a],[b]) => a.localeCompare(b,'pt-BR'))
        .map(([empresa, cidades]) => ({
            empresa,
            cidades: Object.entries(cidades)
                .sort(([a],[b]) => a.localeCompare(b,'pt-BR'))
                .map(([cidade, pedidosMap]) => ({
                    cidade,
                    pedidos: Object.entries(pedidosMap)
                        .sort(([a],[b]) => a.localeCompare(b,'pt-BR',{numeric:true}))
                        .map(([pedidoNum, mats]) => {
                            const itensList = Object.values(mats).sort((a,b) => a.nome.localeCompare(b.nome,'pt-BR'));
                            // Todo material dentro deste grupo pertence ao mesmo pedido_id —
                            // usa o primeiro item pra buscar o valor/frete do pedido.
                            const pv = itensList[0] ? pedValorMap[itensList[0].pedidoId] : null;
                            const valorPedido = pv?.valor || 0;
                            const fretePedido = pv ? (pv.frete || (pv.valor * pv.pct)) : 0;
                            return { pedidoNum, valorPedido, fretePedido, itens: itensList };
                        }),
                })),
        }));

    const pesoTotal = itens.reduce((s,i) => s + Number(i.peso_total||0), 0);

    // ── Cores ────────────────────────────────────────────────────────────────
    const AZUL   = 'BDD7EE';
    const AZUL2  = 'D9E1F2';
    const AMAR   = 'FFF2CC';
    const CINZA  = 'F2F2F2';
    const VERDE  = 'E2EFDA'; // cabeçalho de sub-grupo por empresa

    // ── Shared strings ───────────────────────────────────────────────────────
    const ss = []; const ssIdx = {};
    const S = v => {
        const k = String(v);
        if (ssIdx[k] === undefined) { ssIdx[k] = ss.length; ss.push(k); }
        return ssIdx[k];
    };

    // ── Linhas e merges ──────────────────────────────────────────────────────
    // Cada linha: array de { si, num, styleId, isNull }
    // si = shared string idx, num = número direto
    const rowsData  = [];  // [ [ {si?, num?, s, null?}, ... ], ... ]
    const rowsHt    = [];  // altura de cada linha
    const merges    = [];  // [{r1,c1,r2,c2}]

    // Estilos fixos (índice = posição no cellXfs)
    // 0=default  1=tit_azul14b  2=dest_azul11b  3=lbl_azul10b  4=val_bold11
    // 5=hdr_azul2_10b  6=cidade_amar11b  7=dado_left  8=dado_center
    // 9=sub_cinza_b_right  10=sub_cinza_b_center  11=sub_cinza_vazio
    // 12=tot_azul11b  13=assin_center  14=dado_right

    const NULL = { null: true };
    const c = (v, s) => ({ si: S(v), s });
    const n = (v, s) => ({ num: v,   s });
    const e = (s)    => ({ si: S(''),s });

    let R = 0;

    // Linha 1
    rowsData.push([
        c(`ROMANEIO DE N.º  ${romaneio.numero||''}`, 1), NULL, NULL, NULL, NULL, NULL,
        c(String(romaneio.destino||''), 2), NULL,
    ]);
    rowsHt.push(26);
    merges.push({r1:R,c1:0,r2:R,c2:5}); merges.push({r1:R,c1:6,r2:R,c2:7}); R++;

    // Linha 2: labels
    rowsData.push([c('Motorista',3), NULL, NULL, c('Placa',3), c('Saída',3), NULL, c('Peso Total',3), NULL]);
    rowsHt.push(16);
    merges.push({r1:R,c1:0,r2:R,c2:2}); merges.push({r1:R,c1:4,r2:R,c2:5}); merges.push({r1:R,c1:6,r2:R,c2:7}); R++;

    // Linha 3: valores
    const ptFmt = pesoTotal.toLocaleString('pt-BR',{minimumFractionDigits:2})+' kg';
    rowsData.push([c(String(romaneio.motorista||''),4),NULL,NULL,c(String(romaneio.placa||''),4),c(dtSaida,4),NULL,c(ptFmt,4),NULL]);
    rowsHt.push(20);
    merges.push({r1:R,c1:0,r2:R,c2:2}); merges.push({r1:R,c1:4,r2:R,c2:5}); merges.push({r1:R,c1:6,r2:R,c2:7}); R++;

    // Linha 4: cabeçalhos
    rowsData.push(['Material','Un.','Quant.','Peso Unit.(kg)','Peso Total(kg)','Pedido','Valor Pedido','Frete']
        .map(v => c(v, 5)));
    rowsHt.push(26); R++;

    // Dados por Empresa → Cidade → Pedido → material
    empresasArr.forEach(({ empresa, cidades }) => {
        rowsData.push([c(`🏢 ${empresa}`, 6), NULL, NULL, NULL, NULL, NULL, NULL, NULL]);
        rowsHt.push(18);
        merges.push({r1:R,c1:0,r2:R,c2:7}); R++;

        let pesoEmpresaTotal = 0;
        cidades.forEach(({ cidade, pedidos: pedidosArr }) => {
            rowsData.push([c(`📍 ${cidade}`, 15), NULL, NULL, NULL, NULL, NULL, NULL, NULL]);
            rowsHt.push(16);
            merges.push({r1:R,c1:0,r2:R,c2:7}); R++;

            let pesoCidade = 0;
            pedidosArr.forEach(({ pedidoNum, valorPedido, fretePedido, itens: itensPedido }) => {
                rowsData.push([c(`📦 Pedido ${pedidoNum}`, 3), NULL, NULL, NULL, NULL, NULL, NULL, NULL]);
                rowsHt.push(15);
                merges.push({r1:R,c1:0,r2:R,c2:7}); R++;

                itensPedido.forEach(item => {
                    pesoCidade += item.pesoTotal;
                    const nomeExibido = item.isTelha && item.compTelha
                        ? `${item.nome} (peça ${item.compTelha.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}m — total ${item.metrosTotais.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}m)`
                        : item.nome;
                    const unidadeExibida = item.isTelha ? 'PC' : item.unidade;
                    rowsData.push([
                        c(nomeExibido, 7),
                        c(unidadeExibida, 8),
                        n(item.quant, 8),
                        n(item.pesoUnit > 0 ? item.pesoUnit : 0, 8),
                        n(Math.round(item.pesoTotal*100)/100, 8),
                        c(pedidoNum || '—', 8),
                        valorPedido > 0 ? n(valorPedido, 14) : e(14),
                        fretePedido > 0 ? n(fretePedido, 14) : e(14),
                    ]);
                    rowsHt.push(15); R++;
                });
            });
            pesoEmpresaTotal += pesoCidade;

            // Subtotal por cidade
            rowsData.push([
                e(11), e(11), e(11),
                c(`Subtotal ${cidade}:`, 9),
                n(Math.round(pesoCidade*100)/100, 10),
                e(11), e(11), e(11),
            ]);
            rowsHt.push(14); R++;
        });

        // Subtotal por empresa
        rowsData.push([
            e(11), e(11), e(11),
            c(`Subtotal ${empresa}:`, 9),
            n(Math.round(pesoEmpresaTotal*100)/100, 10),
            e(11), e(11), e(11),
        ]);
        rowsHt.push(14); R++;
    });

    // Total geral
    rowsData.push([c('PESO TOTAL DA CARGA',12),NULL,NULL,NULL,n(Math.round(pesoTotal*100)/100,12),e(12),e(12),e(12)]);
    rowsHt.push(20);
    merges.push({r1:R,c1:0,r2:R,c2:3}); R++;

    // Assinaturas
    rowsData.push(Array(8).fill(e(0))); rowsHt.push(14); R++;
    rowsData.push(Array(8).fill(e(0))); rowsHt.push(14); R++;
    rowsData.push([
        c('________________________________',13), NULL, NULL,
        c('________________________________',13), NULL, NULL,
        c('________________________________',13), NULL,
    ]);
    rowsHt.push(14);
    merges.push({r1:R,c1:0,r2:R,c2:2}); merges.push({r1:R,c1:3,r2:R,c2:5}); merges.push({r1:R,c1:6,r2:R,c2:7}); R++;
    rowsData.push([
        c('Motorista',13), NULL, NULL,
        c('Conferente',13), NULL, NULL,
        c('Responsável',13), NULL,
    ]);
    rowsHt.push(14);
    merges.push({r1:R,c1:0,r2:R,c2:2}); merges.push({r1:R,c1:3,r2:R,c2:5}); merges.push({r1:R,c1:6,r2:R,c2:7}); R++;

    // ── Montar sheetData XML ─────────────────────────────────────────────────
    let sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetFormatPr defaultRowHeight="15"/>
<cols>
  <col min="1" max="1" width="38" customWidth="1"/>
  <col min="2" max="2" width="7"  customWidth="1"/>
  <col min="3" max="3" width="9"  customWidth="1"/>
  <col min="4" max="4" width="16" customWidth="1"/>
  <col min="5" max="5" width="16" customWidth="1"/>
  <col min="6" max="6" width="20" customWidth="1"/>
  <col min="7" max="7" width="18" customWidth="1"/>
  <col min="8" max="8" width="14" customWidth="1"/>
</cols>
<sheetData>`;

    rowsData.forEach((row, ri) => {
        const ht = rowsHt[ri] ? ` ht="${rowsHt[ri]}" customHeight="1"` : '';
        sheetXml += `\n<row r="${ri+1}"${ht}>`;
        row.forEach((cell, ci) => {
            if (!cell || cell.null) return;
            const addr = `${_xlsxCol(ci)}${ri+1}`;
            if (cell.num !== undefined) {
                sheetXml += `<c r="${addr}" s="${cell.s}" t="n"><v>${cell.num}</v></c>`;
            } else {
                sheetXml += `<c r="${addr}" s="${cell.s}" t="s"><v>${cell.si}</v></c>`;
            }
        });
        sheetXml += `</row>`;
    });

    sheetXml += `\n</sheetData>`;

    if (merges.length) {
        sheetXml += `\n<mergeCells count="${merges.length}">`;
        merges.forEach(m => {
            sheetXml += `<mergeCell ref="${_xlsxCol(m.c1)}${m.r1+1}:${_xlsxCol(m.c2)}${m.r2+1}"/>`;
        });
        sheetXml += `</mergeCells>`;
    }

    sheetXml += `
<pageMargins left="0.4" right="0.4" top="0.4" bottom="0.4" header="0" footer="0"/>
<pageSetup paperSize="9" orientation="portrait"/>
</worksheet>`;

    // ── Shared strings XML ───────────────────────────────────────────────────
    let ssXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${ss.length}" uniqueCount="${ss.length}">`;
    ss.forEach(s => { ssXml += `<si><t xml:space="preserve">${_xlsxEsc(s)}</t></si>`; });
    ssXml += `</sst>`;

    // ── Styles XML ───────────────────────────────────────────────────────────
    const TB = `<left style="thin"><color rgb="FFAAAAAA"/></left><right style="thin"><color rgb="FFAAAAAA"/></right><top style="thin"><color rgb="FFAAAAAA"/></top><bottom style="thin"><color rgb="FFAAAAAA"/></bottom>`;
    const NB = `<left/><right/><top/><bottom/>`;
    const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="6">
  <font><sz val="10"/><name val="Calibri"/></font>
  <font><b/><sz val="14"/><name val="Calibri"/></font>
  <font><b/><sz val="11"/><name val="Calibri"/></font>
  <font><b/><sz val="10"/><name val="Calibri"/></font>
  <font><sz val="11"/><name val="Calibri"/></font>
  <font><b/><sz val="11"/><name val="Calibri"/></font>
</fonts>
<fills count="8">
  <fill><patternFill patternType="none"/></fill>
  <fill><patternFill patternType="gray125"/></fill>
  <fill><patternFill patternType="solid"><fgColor rgb="FF${AZUL}"/></patternFill></fill>
  <fill><patternFill patternType="solid"><fgColor rgb="FF${AZUL2}"/></patternFill></fill>
  <fill><patternFill patternType="solid"><fgColor rgb="FF${AMAR}"/></patternFill></fill>
  <fill><patternFill patternType="solid"><fgColor rgb="FF${CINZA}"/></patternFill></fill>
  <fill><patternFill patternType="solid"><fgColor rgb="FF${VERDE}"/></patternFill></fill>
  <fill><patternFill patternType="none"/></fill>
</fills>
<borders count="2">
  <border><left/><right/><top/><bottom/><diagonal/></border>
  <border><left style="thin"><color rgb="FFAAAAAA"/></left><right style="thin"><color rgb="FFAAAAAA"/></right><top style="thin"><color rgb="FFAAAAAA"/></top><bottom style="thin"><color rgb="FFAAAAAA"/></bottom><diagonal/></border>
</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="16">
  <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
  <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
  <xf numFmtId="0" fontId="2" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
  <xf numFmtId="0" fontId="3" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
  <xf numFmtId="0" fontId="2" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
  <xf numFmtId="0" fontId="3" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
  <xf numFmtId="0" fontId="5" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
  <xf numFmtId="0" fontId="4" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>
  <xf numFmtId="0" fontId="4" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
  <xf numFmtId="0" fontId="3" fillId="5" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
  <xf numFmtId="0" fontId="3" fillId="5" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
  <xf numFmtId="0" fontId="4" fillId="5" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
  <xf numFmtId="0" fontId="2" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
  <xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
  <xf numFmtId="0" fontId="4" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
  <xf numFmtId="0" fontId="3" fillId="6" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center" indent="1"/></xf>
</cellXfs>
</styleSheet>`;

    // ── Workbook + Rels + Content Types ──────────────────────────────────────
    const wbXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="Romaneio" sheetId="1" r:id="rId1"/></sheets></workbook>`;

    const wbRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
</Relationships>`;

    const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

    const ctXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
</Types>`;

    // ── Montar ZIP e fazer download ───────────────────────────────────────────
    const zipBytes = _xlsxBuildZip({
        '[Content_Types].xml':         ctXml,
        '_rels/.rels':                 rootRels,
        'xl/workbook.xml':             wbXml,
        'xl/_rels/workbook.xml.rels':  wbRels,
        'xl/worksheets/sheet1.xml':    sheetXml,
        'xl/styles.xml':               stylesXml,
        'xl/sharedStrings.xml':        ssXml,
    });

    const blob = new Blob([zipBytes], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `romaneio_${romaneio.numero || 'sem-numero'}_${today()}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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

                // Detecta automaticamente a linha do cabeçalho buscando pela coluna "Nome"
                // Funciona mesmo que o cabeçalho não esteja na linha 1
                const allRows = XLSX.utils.sheet_to_json(ws, { header:1, defval:'' });
                let headerRow = 0;
                for (let i = 0; i < Math.min(allRows.length, 10); i++) {
                    const row = allRows[i].map(v => String(v||'').trim().toLowerCase());
                    if (row.includes('nome') || row.includes('name')) { headerRow = i; break; }
                }

                const rows = XLSX.utils.sheet_to_json(ws, { defval:'', range: headerRow });
                const materials = rows
                    .filter(r => r['Nome'] || r['nome'] || r['NOME'])
                    .map(r => ({
                        nome:      String(r['Nome']||r['nome']||r['NOME']||'').trim(),
                        categoria: String(r['Categoria']||r['categoria']||r['CATEGORIA']||'Outros').trim(),
                        unidade:   String(r['Unidade']||r['unidade']||r['UNIDADE']||'un').trim(),
                        peso:      Number(r['Peso (kg)']||r['peso']||r['Peso']||r['PESO (KG)']||r['PESO']||0),
                    })).filter(m => m.nome && m.peso > 0);

                if (materials.length === 0) {
                    reject(new Error('Nenhum material válido encontrado. Verifique se as colunas Nome e Peso (kg) estão preenchidas corretamente.'));
                } else {
                    resolve(materials);
                }
            } catch (err) { reject(new Error('Arquivo inválido: ' + err.message)); }
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

// ─────────────────────────────────────────────────────────────────────────────
// Relatório de Bonificações por Período — exporta por motorista com detalhes
// Chame com: exportRelatorioBonificacoes(romaneios, '01/01/2026', '31/03/2026')
// ─────────────────────────────────────────────────────────────────────────────
export function exportRelatorioBonificacoes(romaneios, dataInicio, dataFim) {
    if (!romaneios || romaneios.length === 0) return;

    const TAXA_FERRAGEM = 0.009;
    const BONUS_CIMENTO = 40.00;
    const n = v => Number(v) || 0;

    const wb = XLSX.utils.book_new();

    // ── Aba 1: Resumo por motorista ────────────────────────────────────────
    const porMotorista = {};
    const detalhes = [];

    romaneios.forEach(r => {
        const itens = r.romaneio_itens || [];
        let kgFerragem = 0, temCimento = false;
        itens.forEach(it => {
            const cat = (it.materials?.categoria_frete || '').toLowerCase();
            if (cat.includes('cimento')) temCimento = true;
            else kgFerragem += n(it.peso_total);
        });
        const valorFerragem = kgFerragem * TAXA_FERRAGEM;
        const valorCimento  = temCimento ? BONUS_CIMENTO : 0;
        const valorTotal    = valorFerragem + valorCimento;
        const motorista     = r.motorista || 'Sem nome';
        const saida         = r.saida ? new Date(r.saida).toLocaleDateString('pt-BR') : '';

        if (!porMotorista[motorista]) {
            porMotorista[motorista] = { viagens: 0, kgFerragem: 0, valorFerragem: 0, viasComCimento: 0, valorCimento: 0, valorTotal: 0 };
        }
        porMotorista[motorista].viagens++;
        porMotorista[motorista].kgFerragem    += kgFerragem;
        porMotorista[motorista].valorFerragem += valorFerragem;
        if (temCimento) { porMotorista[motorista].viasComCimento++; porMotorista[motorista].valorCimento += valorCimento; }
        porMotorista[motorista].valorTotal    += valorTotal;

        detalhes.push({
            'Motorista':         motorista,
            'Romaneio / NF':     r.numero || '',
            'Destino':           r.destino || '',
            'Saída':             saida,
            'Status':            r.status || '',
            'Kg Ferragem':       kgFerragem.toFixed(0),
            'Ton. Ferragem':     (kgFerragem / 1000).toFixed(3),
            'Bônus Ferragem (R$)': valorFerragem.toFixed(2),
            'Tem Cimento':       temCimento ? 'Sim' : 'Não',
            'Bônus Cimento (R$)': valorCimento.toFixed(2),
            'Total Bônus (R$)':  valorTotal.toFixed(2),
        });
    });

    // Agrupa os detalhes por motorista (todas as viagens de cada motorista juntas,
    // ordenadas pelo maior total de bônus), inserindo uma linha de subtotal ao
    // final de cada grupo — assim cada motorista mostra suas viagens + total.
    const motoristasOrdenados = Object.entries(porMotorista).sort((a, b) => b[1].valorTotal - a[1].valorTotal).map(([nome]) => nome);
    const detalhesAgrupados = [];
    motoristasOrdenados.forEach(nome => {
        const viagensDoMotorista = detalhes.filter(d => d.Motorista === nome);
        detalhesAgrupados.push(...viagensDoMotorista);
        const d = porMotorista[nome];
        detalhesAgrupados.push({
            'Motorista':         `TOTAL — ${nome}`,
            'Romaneio / NF':     '',
            'Destino':           '',
            'Saída':             '',
            'Status':            `${d.viagens} viagem(ns)`,
            'Kg Ferragem':       d.kgFerragem.toFixed(0),
            'Ton. Ferragem':     (d.kgFerragem / 1000).toFixed(3),
            'Bônus Ferragem (R$)': d.valorFerragem.toFixed(2),
            'Tem Cimento':       '',
            'Bônus Cimento (R$)': d.valorCimento.toFixed(2),
            'Total Bônus (R$)':  d.valorTotal.toFixed(2),
        });
        detalhesAgrupados.push({}); // linha em branco separando motoristas
    });

    const rowsResumo = Object.entries(porMotorista)
        .sort((a, b) => b[1].valorTotal - a[1].valorTotal)
        .map(([nome, d]) => ({
            'Motorista':              nome,
            'Total Viagens':          d.viagens,
            'Kg Total Ferragem':      d.kgFerragem.toFixed(0),
            'Ton. Total Ferragem':    (d.kgFerragem / 1000).toFixed(3),
            'Bônus Ferragem (R$)':    d.valorFerragem.toFixed(2),
            'Viagens c/ Cimento':     d.viasComCimento,
            'Bônus Cimento (R$)':     d.valorCimento.toFixed(2),
            'TOTAL BÔNUS (R$)':       d.valorTotal.toFixed(2),
        }));

    // Linha de total
    const totViagens  = Object.values(porMotorista).reduce((s, d) => s + d.viagens, 0);
    const totFerragem = Object.values(porMotorista).reduce((s, d) => s + d.valorFerragem, 0);
    const totCimento  = Object.values(porMotorista).reduce((s, d) => s + d.valorCimento, 0);
    const totGeral    = Object.values(porMotorista).reduce((s, d) => s + d.valorTotal, 0);
    rowsResumo.push({
        'Motorista': 'TOTAL GERAL',
        'Total Viagens': totViagens,
        'Kg Total Ferragem': '',
        'Ton. Total Ferragem': '',
        'Bônus Ferragem (R$)': totFerragem.toFixed(2),
        'Viagens c/ Cimento': '',
        'Bônus Cimento (R$)': totCimento.toFixed(2),
        'TOTAL BÔNUS (R$)': totGeral.toFixed(2),
    });

    const wsResumo = XLSX.utils.json_to_sheet(rowsResumo);
    wsResumo['!cols'] = Object.keys(rowsResumo[0] || {}).map(() => ({ wch: 20 }));
    XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo por Motorista');

    // ── Aba 2: Detalhes por viagem, agrupados por motorista com subtotal ────
    const wsDetalhes = XLSX.utils.json_to_sheet(detalhesAgrupados);
    wsDetalhes['!cols'] = Object.keys(detalhes[0] || {}).map(() => ({ wch: 18 }));
    XLSX.utils.book_append_sheet(wb, wsDetalhes, 'Detalhes por Motorista');

    const periodo = dataInicio && dataFim ? `_${dataInicio.replace(/\//g,'-')}_a_${dataFim.replace(/\//g,'-')}` : '';
    XLSX.writeFile(wb, `relatorio_bonificacoes${periodo}.xlsx`);
}

// ── EXPORTAR DIÁRIA INDIVIDUAL NO MODELO ─────────────────────────────────────
/**
 * Gera .xlsx local da diária usando o mesmo método do exportRomaneioModelo1:
 * ZIP manual (OOXML) com sharedStrings + stylesXml + download via Blob.
 * Layout idêntico ao modelo diaria_modelo_preview.xlsx.
 *
 * Estilos (cellXfs):
 *  0 = default
 *  1 = Calibri 11 bold  | borda full thin | left  center wrap  → Motorista:, Veículo/Placa:, Valor Total:
 *  2 = Calibri 11 normal| borda full thin | left  center wrap  → valores (B1,B2,A5,A6,A9-A15)
 *  3 = Calibri 11 bold  | sem borda       | left  center wrap  → "Data:"
 *  4 = Calibri 11 normal| sem borda       | left  center wrap  → valor data (E1)
 *  5 = Calibri 11 bold  | borda full thin | center center wrap → "Diárias", "Descrição / Motivo"
 *  6 = Calibri 12 bold  | borda full thin | left  center wrap  → B16 valor total
 *  7 = Calibri 11 normal| borda bottom    | left  center wrap  → A20, A24, A28 (linha assin.)
 *  8 = Calibri 11 normal| sem borda       | center center wrap → labels assinatura
 */
export function exportDiariaModelo(diaria) {
    if (!diaria) return;

    const motoristaNome = diaria.motorista?.name || diaria.motorista_nome || '';
    const fmtD = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '';
    const dataI    = fmtD(diaria.data_inicio);
    const dataF    = fmtD(diaria.data_fim);
    const periodo  = dataF ? `${dataI} a ${dataF}` : dataI;
    const placa    = diaria.veiculo?.placa || diaria.placa || '';
    const diasQtd  = Number(diaria.quantidade_dias || 0);
    const valorDia = Number(diaria.valor_dia || 0);
    const vlTotal  = Number(diaria.valor_total || 0) || diasQtd * valorDia;
    const descr    = diaria.descricao || '';
    const assinaturaMotorista = diaria.motorista?.assinatura_digital || diaria.assinatura_motorista || '';
    // Diárias avulsas usam assinatura_logistica/assinatura_transporte; diárias
    // geradas por romaneio usam assinatura_diaria_logistica/assinatura_diaria_transporte.
    const assinaturaTransporte = diaria.assinatura_transporte || diaria.assinatura_diaria_transporte || '';
    const assinaturaLogistica  = diaria.assinatura_logistica  || diaria.assinatura_diaria_logistica  || '';
    const brl2 = v => 'R$ ' + Number(v||0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });

    // ── Shared strings ────────────────────────────────────────────────────────
    const ss = []; const ssIdx = {};
    const S = v => {
        const k = String(v);
        if (ssIdx[k] === undefined) { ssIdx[k] = ss.length; ss.push(k); }
        return ssIdx[k];
    };

    // helpers: célula string, célula vazia com estilo
    const cs  = (v, s) => ({ si: S(String(v)), s });
    const ce  = s      => ({ si: S(''), s });
    const NULL = { null: true };

    // ── Definição das linhas ──────────────────────────────────────────────────
    // Cada linha: [células...] — NULL = célula pulada (parte de merge anterior)
    // Formato célula: { si: idx_sharedString, s: styleIdx }
    //
    // O sheet tem 5 colunas: A B C D E
    // rowsData[i] = array com até 5 posições

    const rowsData = [];
    const rowsHt   = [];   // altura em pontos de cada linha
    // merges usam índice 0-based de linha/coluna
    // merges NÃO são necessários aqui — o modelo original não tem merges

    // Linha 1 (r=1): Motorista: | nome | vazio | Data: | período
    rowsData.push([ cs('Motorista:', 1), cs(motoristaNome, 2), NULL, cs('Data:', 3), cs(periodo, 4) ]);
    rowsHt.push(20);

    // Linha 2 (r=2): Veículo / Placa: | placa
    rowsData.push([ cs('Veículo / Placa:', 1), cs(placa, 2), NULL, NULL, NULL ]);
    rowsHt.push(20);

    // Linha 3 vazia
    rowsData.push([ NULL, NULL, NULL, NULL, NULL ]);
    rowsHt.push(20);

    // Linha 4 (r=4): "Diárias" — bold center borda full
    rowsData.push([ cs('Diárias', 5), NULL, NULL, NULL, NULL ]);
    rowsHt.push(20);

    // Linha 5 (r=5): "Quantidade de dias: N"
    rowsData.push([ cs(`Quantidade de dias: ${diasQtd}`, 2), NULL, NULL, NULL, NULL ]);
    rowsHt.push(20);

    // Linha 6 (r=6): "Valor por dia (R$): R$ X,XX"
    rowsData.push([ cs(`Valor por dia (R$): ${brl2(valorDia)}`, 2), NULL, NULL, NULL, NULL ]);
    rowsHt.push(20);

    // Linha 7 vazia
    rowsData.push([ NULL, NULL, NULL, NULL, NULL ]);
    rowsHt.push(20);

    // Linha 8 (r=8): "Descrição / Motivo" — bold center borda full
    rowsData.push([ cs('Descrição / Motivo', 5), NULL, NULL, NULL, NULL ]);
    rowsHt.push(20);

    // Linha 9 (r=9): texto da descrição — borda full
    rowsData.push([ cs(descr, 2), NULL, NULL, NULL, NULL ]);
    rowsHt.push(20);

    // Linhas 10–11: espaço extra para descrição
    for (let i = 0; i < 2; i++) {
        rowsData.push([ ce(2), NULL, NULL, NULL, NULL ]);
        rowsHt.push(20);
    }

    // Linha 12 (r=12): "Valor Total:" | "R$ X,XX"
    rowsData.push([ cs('Valor Total:', 1), cs(brl2(vlTotal), 6), NULL, NULL, NULL ]);
    rowsHt.push(20);

    // Linhas 18–20: espaço
    for (let i = 0; i < 3; i++) {
        rowsData.push([ NULL, NULL, NULL, NULL, NULL ]);
        rowsHt.push(0);
    }

    // Linha 20 (r=20): célula vazia com borda bottom (linha de assinatura do
    // setor de Transporte) — preenchida quando quem assinou foi um Admin
    rowsData.push([ assinaturaTransporte ? cs(assinaturaTransporte, 2) : ce(7), NULL, NULL, NULL, NULL ]);
    rowsHt.push(18);

    // "✓ Assinado digitalmente" — só aparece quando há assinatura registrada
    if (assinaturaTransporte) {
        rowsData.push([ cs('✓ Assinado digitalmente', 9), NULL, NULL, NULL, NULL ]);
        rowsHt.push(12);
    }

    // Linha 21 (r=21): "ASSINATURA DO SETOR DE TRANSPORTE"
    rowsData.push([ cs('ASSINATURA DO SETOR DE TRANSPORTE', 8), NULL, NULL, NULL, NULL ]);
    rowsHt.push(18);

    // Linhas 22–23: espaço
    rowsData.push([ NULL, NULL, NULL, NULL, NULL ]); rowsHt.push(0);
    rowsData.push([ NULL, NULL, NULL, NULL, NULL ]); rowsHt.push(0);

    // Linha 24 (r=24): borda bottom — preenchida com a assinatura digital do
    // Operador responsável (ex.: diária de caminhão gerada dentro de um
    // romaneio), senão em branco
    rowsData.push([ assinaturaLogistica ? cs(assinaturaLogistica, 2) : ce(7), NULL, NULL, NULL, NULL ]);
    rowsHt.push(18);

    // "✓ Assinado digitalmente" — só aparece quando há assinatura registrada
    if (assinaturaLogistica) {
        rowsData.push([ cs('✓ Assinado digitalmente', 9), NULL, NULL, NULL, NULL ]);
        rowsHt.push(12);
    }

    // Linha 25 (r=25): "ASSINATURA DO SETOR DE LOGISTICA"
    rowsData.push([ cs('ASSINATURA DO SETOR DE LOGISTICA', 8), NULL, NULL, NULL, NULL ]);
    rowsHt.push(18);

    // Linhas 26–27: espaço
    rowsData.push([ NULL, NULL, NULL, NULL, NULL ]); rowsHt.push(0);
    rowsData.push([ NULL, NULL, NULL, NULL, NULL ]); rowsHt.push(0);

    // Linha 28 (r=28): borda bottom — preenchida com a assinatura digital do
    // motorista quando cadastrada, senão fica em branco para assinatura manual
    rowsData.push([ assinaturaMotorista ? cs(assinaturaMotorista, 2) : ce(7), NULL, NULL, NULL, NULL ]);
    rowsHt.push(18);

    // "✓ Assinado digitalmente" — só aparece quando há assinatura registrada
    if (assinaturaMotorista) {
        rowsData.push([ cs('✓ Assinado digitalmente', 9), NULL, NULL, NULL, NULL ]);
        rowsHt.push(12);
    }

    // Linha 29 (r=29): "ASSINATURA MOTORISTA"
    rowsData.push([ cs('ASSINATURA MOTORISTA', 8), NULL, NULL, NULL, NULL ]);
    rowsHt.push(18);

    // ── Montar sheetXml ───────────────────────────────────────────────────────
    let sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetFormatPr baseColWidth="8" defaultRowHeight="15"/>
<cols>
  <col min="1" max="1" width="62.78" customWidth="1"/>
  <col min="2" max="2" width="18.89" customWidth="1"/>
  <col min="3" max="3" width="8.43"  customWidth="1"/>
  <col min="4" max="4" width="8.43"  customWidth="1"/>
  <col min="5" max="5" width="14"    customWidth="1"/>
</cols>
<sheetData>`;

    rowsData.forEach((row, ri) => {
        const rNum = ri + 1;
        const ht   = rowsHt[ri] > 0 ? ` ht="${rowsHt[ri]}" customHeight="1"` : '';
        // Só emite a linha se tiver pelo menos uma célula com conteúdo
        const temCelula = row.some(c => c && !c.null);
        if (!temCelula && rowsHt[ri] === 0) return; // pula linhas totalmente vazias sem altura

        sheetXml += `\n<row r="${rNum}"${ht}>`;
        row.forEach((cell, ci) => {
            if (!cell || cell.null) return;
            const addr = `${_xlsxCol(ci)}${rNum}`;
            sheetXml += `<c r="${addr}" s="${cell.s}" t="s"><v>${cell.si}</v></c>`;
        });
        sheetXml += `</row>`;
    });

    sheetXml += `\n</sheetData>
<pageMargins left="0.75" right="0.75" top="1" bottom="1" header="0.5" footer="0.5"/>
<pageSetup paperSize="9" orientation="portrait"/>
</worksheet>`;

    // ── Shared strings XML ────────────────────────────────────────────────────
    let ssXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${ss.length}" uniqueCount="${ss.length}">`;
    ss.forEach(s => { ssXml += `<si><t xml:space="preserve">${_xlsxEsc(s)}</t></si>`; });
    ssXml += `</sst>`;

    // ── Styles XML ────────────────────────────────────────────────────────────
    // Bordas:
    //   bId=0: nenhuma
    //   bId=1: full thin preto
    //   bId=2: só bottom thin preto
    const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="4">
  <font><sz val="11"/><name val="Calibri"/><family val="2"/></font>
  <font><b/><sz val="11"/><name val="Calibri"/></font>
  <font><b/><sz val="12"/><name val="Calibri"/></font>
  <font><sz val="8"/><color rgb="FF059669"/><name val="Calibri"/></font>
</fonts>
<fills count="2">
  <fill><patternFill patternType="none"/></fill>
  <fill><patternFill patternType="gray125"/></fill>
</fills>
<borders count="3">
  <border><left/><right/><top/><bottom/><diagonal/></border>
  <border><left style="thin"/><right style="thin"/><top style="thin"/><bottom style="thin"/><diagonal/></border>
  <border><left/><right/><top/><bottom style="thin"/><diagonal/></border>
</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="10">
  <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
  <xf numFmtId="0" fontId="1" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>
  <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>
  <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>
  <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>
  <xf numFmtId="0" fontId="1" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
  <xf numFmtId="0" fontId="2" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>
  <xf numFmtId="0" fontId="0" fillId="0" borderId="2" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>
  <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
  <xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

    // ── Workbook + Rels + Content Types ──────────────────────────────────────
    const wbXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="Di&#225;ria" sheetId="1" r:id="rId1"/></sheets></workbook>`;

    const wbRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
</Relationships>`;

    const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

    const ctXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
</Types>`;

    // ── Montar ZIP e fazer download ───────────────────────────────────────────
    const zipBytes = _xlsxBuildZip({
        '[Content_Types].xml':        ctXml,
        '_rels/.rels':                rootRels,
        'xl/workbook.xml':            wbXml,
        'xl/_rels/workbook.xml.rels': wbRels,
        'xl/worksheets/sheet1.xml':   sheetXml,
        'xl/styles.xml':              stylesXml,
        'xl/sharedStrings.xml':       ssXml,
    });

    const blob = new Blob([zipBytes], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `diaria_${motoristaNome.replace(/\s+/g, '_')}_${dataI.replace(/\//g, '-')}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ── EXPORTAR DIÁRIAS DOS ROMANEIOS (lote) ─────────────────────────────────────
/**
 * Exporta em lote as diárias geradas automaticamente pelos romaneios.
 * Cada romaneio vira uma linha; também gera uma aba de resumo por motorista.
 */
export function exportDiariasRomaneiosModelo(diarias) {
    if (!diarias || !diarias.length) return;

    const wb = XLSX.utils.book_new();
    const brl = v => 'R$ ' + Number(v||0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    const fmtDate = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '';

    // ── Aba 1: Detalhes ───────────────────────────────────────────────────────
    const rows = diarias.map(d => ({
        'Data':          fmtDate(d.data_inicio),
        'Motorista':     d.motorista?.name || '',
        'Placa':         d.veiculo?.placa  || '',
        'Viagem Nº':     d.viagem?.numero  || '',
        'Destino':       d.viagem?.destino || '',
        'Dias':          Number(d.quantidade_dias || 0),
        'Valor/Dia':     Number(d.valor_dia       || 0),
        'Total (R$)':    Number(d.valor_total     || 0),
        'Descrição':     d.descricao || '',
    }));

    // Linha de total
    const totalGeral = rows.reduce((s, r) => s + r['Total (R$)'], 0);
    rows.push({
        'Data': 'TOTAL', 'Motorista': '', 'Placa': '', 'Viagem Nº': '',
        'Destino': '', 'Dias': '', 'Valor/Dia': '',
        'Total (R$)': totalGeral, 'Descrição': '',
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [12, 22, 12, 12, 22, 8, 12, 14, 30].map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws, 'Diárias');

    // ── Aba 2: Resumo por motorista ────────────────────────────────────────
    const porMotorista = {};
    diarias.forEach(d => {
        const nome = d.motorista?.name || 'Sem nome';
        if (!porMotorista[nome]) porMotorista[nome] = { motorista: nome, totalDias: 0, totalValor: 0 };
        porMotorista[nome].totalDias  += Number(d.quantidade_dias || 0);
        porMotorista[nome].totalValor += Number(d.valor_total     || 0);
    });
    const rowsResumo = Object.values(porMotorista).map(r => ({
        'Motorista':      r.motorista,
        'Total de Dias':  r.totalDias,
        'Total (R$)':     r.totalValor,
    }));
    const wsResumo = XLSX.utils.json_to_sheet(rowsResumo);
    wsResumo['!cols'] = [{ wch: 24 }, { wch: 14 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo por Motorista');

    XLSX.writeFile(wb, `diarias_${today()}.xlsx`);
}

// ─── Impressão de Diária no navegador ────────────────────────────────────────
// Gera uma janela de impressão HTML seguindo o mesmo modelo do exportDiariaModelo
// (Excel): cabeçalho com motorista/data/placa, seção Diárias, Rota Programada,
// Valor Total e três linhas de assinatura.
export function printDiaria(diaria) {
    const fmt = d => {
        if (!d) return '—';
        const dt = new Date(d.length === 10 ? d + 'T00:00:00' : d);
        return dt.toLocaleDateString('pt-BR');
    };
    const brl = v => 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });

    const motoristaNome = diaria.motorista?.name || diaria.motorista_nome || '—';
    const dataI    = fmt(diaria.data_inicio);
    const dataF    = fmt(diaria.data_fim);
    const periodo  = dataF && dataF !== '—' && dataF !== dataI ? `${dataI} a ${dataF}` : dataI;
    const placa    = diaria.veiculo?.placa  || diaria.placa  || '—';
    const modelo   = diaria.veiculo?.modelo || diaria.modelo || '';
    const diasQtd  = Number(diaria.quantidade_dias || diaria.qtd_dias || 1);
    const valorDia = Number(diaria.valor_dia || 0);
    const vlTotal  = Number(diaria.valor_total || 0) || (diasQtd * valorDia);
    const descr    = diaria.descricao || '';
    const destino  = diaria.destino || diaria.viagem?.destino || '';
    const assinaturaMotorista = diaria.motorista?.assinatura_digital || diaria.assinatura_motorista || '';
    // Diárias avulsas usam assinatura_logistica/assinatura_transporte; diárias
    // geradas por romaneio usam assinatura_diaria_logistica/assinatura_diaria_transporte.
    const assinaturaTransporte = diaria.assinatura_transporte || diaria.assinatura_diaria_transporte || '';
    const assinaturaLogistica  = diaria.assinatura_logistica  || diaria.assinatura_diaria_logistica  || '';

    const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<title>Diária — ${esc(motoristaNome)}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:Arial,Helvetica,sans-serif;font-size:11pt;color:#111;background:#fff}
  .page{width:180mm;margin:10mm auto}
  table{width:100%;border-collapse:collapse;table-layout:fixed}
  td{border:1px solid #222;padding:5px 8px;vertical-align:top;word-break:break-word}
  .lbl{background:#f0f0f0;font-weight:bold;white-space:nowrap;width:38%}
  .sec{background:#e8e8e8;font-weight:bold;text-align:center;font-size:12pt;padding:7px 8px}
  .sp{height:22px}
  .ttl{font-weight:bold;background:#e8e8e8;font-size:13pt}
  .tval{font-weight:bold;font-size:14pt;text-align:right}
  .emp{text-align:center;font-size:14pt;font-weight:bold;border:2px solid #222;padding:8px;letter-spacing:2px}
  @media print{html,body{margin:0}@page{size:A4 portrait;margin:10mm 15mm}.page{margin:0;width:auto}}
</style>
</head>
<body><div class="page">

<table style="margin-bottom:8px"><tr><td class="emp" colspan="4">TRANSPORTE — DIÁRIAS</td></tr></table>

<table>
  <tr>
    <td class="lbl">Motorista:</td>
    <td>${esc(motoristaNome)}</td>
    <td class="lbl" style="width:18%">Data:</td>
    <td style="width:27%">${esc(periodo)}</td>
  </tr>
  <tr>
    <td class="lbl">Veículo / Placa:</td>
    <td colspan="3">${esc(placa)}${modelo ? ' — ' + esc(modelo) : ''}</td>
  </tr>
</table>

<table style="margin-top:8px">
  <tr><td class="sec" colspan="2">DIÁRIAS</td></tr>
  <tr><td class="lbl">Quantidade de dias:</td><td>${diasQtd}</td></tr>
  <tr><td class="lbl">Valor por dia (R$):</td><td>${brl(valorDia)}</td></tr>
</table>

<table style="margin-top:8px">
  <tr><td class="sec" colspan="2">Descrição / Motivo</td></tr>
  <tr><td colspan="2" style="height:24px">${esc(descr)}</td></tr>
  <tr><td colspan="2" class="sp"></td></tr>
  <tr><td colspan="2" class="sp"></td></tr>
</table>

<table style="margin-top:8px">
  <tr><td class="ttl" style="width:50%">Valor Total:</td><td class="tval">${brl(vlTotal)}</td></tr>
</table>

<div style="margin-top:34px;display:flex;justify-content:space-between;align-items:flex-start">
  <div style="width:31%;padding:0 12px 0 0">
    <div style="border-bottom:1px solid #222;height:40px;display:flex;align-items:flex-end;justify-content:center">${assinaturaTransporte ? `<span style="font-family:'Brush Script MT',cursive;font-size:16pt;color:#1D4ED8">${esc(assinaturaTransporte)}</span>` : ''}</div>
    ${assinaturaTransporte ? `<div style="text-align:center;font-size:8pt;color:#059669;padding-top:2px">✓ Assinado digitalmente</div>` : ''}
    <div style="text-align:center;font-size:9pt;padding-top:3px">ASSINATURA DO SETOR DE TRANSPORTE</div>
  </div>
  <div style="width:31%;padding:0 6px">
    <div style="border-bottom:1px solid #222;height:40px;display:flex;align-items:flex-end;justify-content:center">${assinaturaLogistica ? `<span style="font-family:'Brush Script MT',cursive;font-size:16pt;color:#1D4ED8">${esc(assinaturaLogistica)}</span>` : ''}</div>
    ${assinaturaLogistica ? `<div style="text-align:center;font-size:8pt;color:#059669;padding-top:2px">✓ Assinado digitalmente</div>` : ''}
    <div style="text-align:center;font-size:9pt;padding-top:3px">ASSINATURA DO SETOR DE LOGÍSTICA</div>
  </div>
  <div style="width:31%;padding:0 0 0 12px">
    <div style="border-bottom:1px solid #222;height:40px;display:flex;align-items:flex-end;justify-content:center">${assinaturaMotorista ? `<span style="font-family:'Brush Script MT',cursive;font-size:16pt;color:#1D4ED8">${esc(assinaturaMotorista)}</span>` : ''}</div>
    ${assinaturaMotorista ? `<div style="text-align:center;font-size:8pt;color:#059669;padding-top:2px">✓ Assinado digitalmente</div>` : ''}
    <div style="text-align:center;font-size:9pt;padding-top:3px">ASSINATURA MOTORISTA</div>
  </div>
</div>

</div>
<script>
  window.onload=function(){window.print();window.onfocus=function(){setTimeout(function(){window.close();},500);}};
</script>
</body></html>`;

    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) { alert('Permita popups para este site e tente novamente.'); return; }
    win.document.write(html);
    win.document.close();
}

// ─────────────────────────────────────────────────────────────────────────────
// IMPRESSÃO — Ordem de Serviço (módulo Carretas / Mecânico)
// ─────────────────────────────────────────────────────────────────────────────
export function printOrdemServico(ordem) {
    const fmt = d => {
        if (!d) return '—';
        const dt = new Date(d);
        return dt.toLocaleDateString('pt-BR') + ' ' + dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    };
    const esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

    const numeroOS   = ordem.id ? ordem.id.slice(0, 8).toUpperCase() : '—';
    const placa      = ordem.veiculo?.placa  || ordem.veiculo_caminhao_placa  || '—';
    const modelo     = ordem.veiculo?.modelo || ordem.veiculo_caminhao_modelo || '';
    const mecanico   = ordem.mecanico?.name  || 'Não atribuído';
    const prioridade = ordem.prioridade || 'Normal';
    const status     = ordem.status || 'Pendente';
    const descricao  = ordem.descricao || '';
    const observacoes = ordem.observacoes || '';
    const tipoManutencao = ordem.tipo_manutencao || '—';
    const kmAtual     = ordem.km_atual != null ? Number(ordem.km_atual).toLocaleString('pt-BR') + ' km' : '—';
    const pecas       = ordem.pecas_solicitadas || [];
    const abertura    = fmt(ordem.created_at);
    const finalizacao = ordem.finalizada_em ? fmt(ordem.finalizada_em) : null;

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<title>Ordem de Servico OS ${esc(numeroOS)}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:Arial,Helvetica,sans-serif;font-size:11pt;color:#111;background:#fff}
  .page{width:180mm;margin:10mm auto}
  table{width:100%;border-collapse:collapse;table-layout:fixed}
  td{border:1px solid #222;padding:5px 8px;vertical-align:top;word-break:break-word}
  .lbl{background:#f0f0f0;font-weight:bold;white-space:nowrap;width:28%}
  .sec{background:#e8e8e8;font-weight:bold;text-align:center;font-size:12pt;padding:7px 8px}
  .sp{height:22px}
  .emp{text-align:center;font-size:14pt;font-weight:bold;border:2px solid #222;padding:8px;letter-spacing:2px}
  .urgente{color:#B91C1C;font-weight:bold}
  @media print{html,body{margin:0}@page{size:A4 portrait;margin:10mm 15mm}.page{margin:0;width:auto}}
</style>
</head>
<body><div class="page">

<table style="margin-bottom:8px"><tr><td class="emp" colspan="4">ORDEM DE SERVICO - OFICINA</td></tr></table>

<table>
  <tr>
    <td class="lbl">No da OS:</td>
    <td>#${esc(numeroOS)}</td>
  </tr>
  <tr>
    <td class="lbl">Data de abertura:</td>
    <td>${esc(abertura)}</td>
  </tr>
  <tr>
    <td class="lbl">Veiculo / Placa:</td>
    <td>${esc(placa)}${modelo ? ' - ' + esc(modelo) : ''}</td>
  </tr>
  <tr>
    <td class="lbl">Mecanico responsavel:</td>
    <td>${esc(mecanico)}</td>
  </tr>
  <tr>
    <td class="lbl">Tipo de manutencao:</td>
    <td>${esc(tipoManutencao)}</td>
  </tr>
  <tr>
    <td class="lbl">KM atual do veiculo:</td>
    <td>${esc(kmAtual)}</td>
  </tr>
  <tr>
    <td class="lbl">Prioridade:</td>
    <td class="${prioridade === 'Urgente' ? 'urgente' : ''}">${esc(prioridade)}${prioridade === 'Urgente' ? ' !' : ''}</td>
  </tr>
  <tr>
    <td class="lbl">Status:</td>
    <td>${esc(status)}</td>
  </tr>
</table>

<table style="margin-top:8px">
  <tr><td class="sec" colspan="2">Servico Solicitado</td></tr>
  <tr><td colspan="2" style="min-height:24px">${esc(descricao)}</td></tr>
</table>

${observacoes ? `
<table style="margin-top:8px">
  <tr><td class="sec" colspan="2">Observacoes do Servico</td></tr>
  <tr><td colspan="2">${esc(observacoes)}</td></tr>
</table>` : ''}

${pecas.length ? `
<table style="margin-top:8px">
  <tr><td class="sec" colspan="3">Pecas Solicitadas</td></tr>
  <tr>
    <td class="lbl" style="width:50%">Item</td>
    <td class="lbl" style="width:20%">Qtd.</td>
    <td class="lbl" style="width:30%">Status</td>
  </tr>
  ${pecas.map(p => `<tr><td>${esc(p.item)}</td><td>${esc(p.quantidade)}</td><td>${esc(p.status || 'Pendente')}</td></tr>`).join('')}
</table>` : ''}

${ordem.problema_encontrado ? `
<table style="margin-top:8px">
  <tr><td class="sec" colspan="2">Problema Reportado pelo Mecanico</td></tr>
  <tr><td colspan="2">${esc(ordem.problema_encontrado)}</td></tr>
</table>` : ''}

${ordem.obs_finalizacao ? `
<table style="margin-top:8px">
  <tr><td class="sec" colspan="2">Observacoes de Finalizacao</td></tr>
  <tr><td colspan="2">${esc(ordem.obs_finalizacao)}</td></tr>
  <tr><td class="lbl">Finalizada em:</td><td>${esc(finalizacao || '—')}</td></tr>
</table>` : ''}

<div style="margin-top:34px;display:flex;justify-content:space-between;align-items:flex-start">
  <div style="width:48%;padding:0 12px 0 0">
    ${ordem.assinatura_mecanico ? `
    <div style="border-bottom:1px solid #222;height:40px;display:flex;align-items:flex-end;justify-content:center;padding-bottom:4px">
      <span style="font-family:'Brush Script MT',cursive;font-size:16pt;color:#1D4ED8">${esc(ordem.assinatura_mecanico)}</span>
    </div>
    <div style="text-align:center;font-size:8pt;color:#059669;padding-top:2px">✓ Assinado digitalmente</div>` : `
    <div style="border-bottom:1px solid #222;height:40px"></div>`}
    <div style="text-align:center;font-size:9pt;padding-top:3px">ASSINATURA DO MECANICO</div>
  </div>
  <div style="width:48%;padding:0 0 0 12px">
    ${ordem.assinatura_admin ? `
    <div style="border-bottom:1px solid #222;height:40px;display:flex;align-items:flex-end;justify-content:center;padding-bottom:4px">
      <span style="font-family:'Brush Script MT',cursive;font-size:16pt;color:#1D4ED8">${esc(ordem.assinatura_admin)}</span>
    </div>
    <div style="text-align:center;font-size:8pt;color:#059669;padding-top:2px">✓ Assinado digitalmente</div>` : `
    <div style="border-bottom:1px solid #222;height:40px"></div>`}
    <div style="text-align:center;font-size:9pt;padding-top:3px">ASSINATURA DO RESPONSAVEL / ADMIN</div>
  </div>
</div>

</div>
<script>
  window.onload=function(){window.print();window.onfocus=function(){setTimeout(function(){window.close();},500);}};
</script>
</body></html>`;

    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) { alert('Permita popups para este site e tente novamente.'); return; }
    win.document.write(html);
    win.document.close();
}

// ─────────────────────────────────────────────────────────────────────────────
// IMPRESSÃO — Romaneio (módulo Carretas)
// ─────────────────────────────────────────────────────────────────────────────
export function printRomaneioCarretas(romaneio) {
    const fmtData = d => d ? new Date(d.length === 10 ? d + 'T00:00:00' : d).toLocaleDateString('pt-BR') : '—';
    const fmtDataHora = d => {
        if (!d) return '—';
        const dt = new Date(d);
        return dt.toLocaleDateString('pt-BR') + ' ' + dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    };
    const brl = v => 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    const esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

    const itens = romaneio.itens || [];
    const pesoTotal = itens.reduce((s, it) => s + Number(it.peso_total || 0), 0);
    const valorCarga = Number(romaneio.valor_carga || 0);
    const valorFrete = Number(romaneio.valor_frete || 0);
    const pctFrete = valorCarga > 0 ? (valorFrete / valorCarga) * 100 : 0;
    const statusCfg = STATUS_ROMANEIO_COLORS_LOCAL[romaneio.status] || { text: '#374151' };

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<title>Romaneio ${esc(romaneio.numero)}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:Arial,Helvetica,sans-serif;font-size:11pt;color:#111;background:#fff}
  .page{width:180mm;margin:10mm auto}
  table{width:100%;border-collapse:collapse;table-layout:fixed}
  td,th{border:1px solid #222;padding:5px 8px;vertical-align:top;word-break:break-word}
  .lbl{background:#f0f0f0;font-weight:bold;white-space:nowrap;width:28%}
  .sec{background:#e8e8e8;font-weight:bold;text-align:center;font-size:12pt;padding:7px 8px}
  .emp{text-align:center;font-size:14pt;font-weight:bold;border:2px solid #222;padding:8px;letter-spacing:2px}
  .ttl{font-weight:bold;background:#e8e8e8;font-size:12pt}
  .tval{font-weight:bold;font-size:13pt;text-align:right}
  th{background:#f0f0f0;font-size:9.5pt;text-align:left}
  td.num{text-align:right;font-variant-numeric:tabular-nums}
  @media print{html,body{margin:0}@page{size:A4 portrait;margin:10mm 15mm}.page{margin:0;width:auto}}
</style>
</head>
<body><div class="page">

<table style="margin-bottom:8px"><tr><td class="emp" colspan="4">ROMANEIO DE CARGA — CARRETAS</td></tr></table>

<table>
  <tr>
    <td class="lbl">Nº Romaneio:</td>
    <td>${esc(romaneio.numero)}</td>
    <td class="lbl" style="width:22%">Status:</td>
    <td style="width:22%;font-weight:bold;color:${statusCfg.text}">${esc(romaneio.status || '—')}</td>
  </tr>
  <tr>
    <td class="lbl">Motorista:</td>
    <td>${esc(romaneio.motorista?.name || '—')}</td>
    <td class="lbl">Placa:</td>
    <td>${esc(romaneio.veiculo?.placa || '—')}${romaneio.veiculo?.modelo ? ' — ' + esc(romaneio.veiculo.modelo) : ''}</td>
  </tr>
  <tr>
    <td class="lbl">Empresa:</td>
    <td>${esc(romaneio.empresa || '—')}</td>
    <td class="lbl">Destino:</td>
    <td>${esc(romaneio.destino || '—')}</td>
  </tr>
  <tr>
    <td class="lbl">Nº NF:</td>
    <td>${esc(romaneio.numero_nf || '—')}</td>
    <td class="lbl">Nº Pedido:</td>
    <td>${esc(romaneio.numero_pedido || '—')}</td>
  </tr>
  <tr>
    <td class="lbl">Data Saída:</td>
    <td>${esc(fmtData(romaneio.data_saida))}</td>
    <td class="lbl">Data Chegada:</td>
    <td>${esc(fmtData(romaneio.data_chegada))}</td>
  </tr>
</table>

${itens.length > 0 ? `
<table style="margin-top:8px">
  <tr><td class="sec" colspan="4">Materiais Transportados</td></tr>
</table>
<table style="margin-top:0">
  <tr>
    <th style="width:46%">Material</th>
    <th style="width:18%">Qtd.</th>
    <th style="width:12%">Unid.</th>
    <th style="width:24%">Peso (kg)</th>
  </tr>
  ${itens.map(it => `<tr>
    <td>${esc(it.material?.nome || it.descricao || '—')}</td>
    <td class="num">${esc(Number(it.quantidade || 0).toLocaleString('pt-BR'))}</td>
    <td>${esc(it.unidade || '—')}</td>
    <td class="num">${it.peso_total ? esc(Number(it.peso_total).toLocaleString('pt-BR')) : '—'}</td>
  </tr>`).join('')}
  <tr>
    <td class="lbl" colspan="3">Peso Total</td>
    <td class="num" style="font-weight:bold">${pesoTotal > 0 ? esc(pesoTotal.toLocaleString('pt-BR')) + ' kg' : '—'}</td>
  </tr>
</table>` : ''}

<table style="margin-top:8px">
  <tr><td class="sec" colspan="2">Valores</td></tr>
  <tr><td class="ttl" style="width:60%">Valor da Carga:</td><td class="tval">${brl(valorCarga)}</td></tr>
  <tr><td class="ttl">Frete:</td><td class="tval">${brl(valorFrete)}</td></tr>
  <tr><td class="lbl">Frete sobre a carga:</td><td>${pctFrete.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%</td></tr>
</table>

${romaneio.observacoes ? `
<table style="margin-top:8px">
  <tr><td class="sec" colspan="2">Observações</td></tr>
  <tr><td colspan="2">${esc(romaneio.observacoes)}</td></tr>
</table>` : ''}

<div style="margin-top:34px;display:flex;justify-content:space-between;align-items:flex-start">
  <div style="width:48%;padding:0 12px 0 0">
    <div style="border-bottom:1px solid #222;height:40px"></div>
    <div style="text-align:center;font-size:9pt;padding-top:3px">ASSINATURA DO MOTORISTA</div>
  </div>
  <div style="width:48%;padding:0 0 0 12px">
    <div style="border-bottom:1px solid #222;height:40px"></div>
    <div style="text-align:center;font-size:9pt;padding-top:3px">ASSINATURA DO RESPONSÁVEL / CONFERENTE</div>
  </div>
</div>

<p style="margin-top:14px;font-size:8pt;color:#666;text-align:center">Emitido em ${esc(fmtDataHora(new Date().toISOString()))} — LogiFlow</p>

</div>
<script>
  window.onload=function(){window.print();window.onfocus=function(){setTimeout(function(){window.close();},500);}};
</script>
</body></html>`;

    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) { alert('Permita popups para este site e tente novamente.'); return; }
    win.document.write(html);
    win.document.close();
}
const STATUS_ROMANEIO_COLORS_LOCAL = {
    'Aguardando':          { text: '#B45309' },
    'Carregando':          { text: '#1D4ED8' },
    'Em Trânsito':         { text: '#7C3AED' },
    'Entrega finalizada':  { text: '#065F46' },
    'Cancelado':           { text: '#6B7280' },
};

// ─────────────────────────────────────────────────────────────────────────────
// IMPRESSÃO — Checklist de veículo (módulo Carretas — caminhões e carretas)
// ─────────────────────────────────────────────────────────────────────────────
export function printChecklist(checklist, todosItensAtivos = []) {
    const fmtData = d => {
        if (!d) return '—';
        const dt = new Date(d.length === 10 ? d + 'T00:00:00' : d);
        return dt.toLocaleDateString('pt-BR');
    };
    const esc = s => String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

    // Helpers locais (mesma lógica de utils/carretasService.js), para não criar
    // dependência circular: itens ficam gravados como { ok, obs, label } (novo
    // formato) ou apenas true/false (registros antigos).
    const itemIsOk  = v => (v && typeof v === 'object') ? !!v.ok : !!v;
    const itemObsOf = v => (v && typeof v === 'object') ? (v.obs || '') : '';
    const itemLabelOf = (v, id) => {
        if (v && typeof v === 'object' && v.label) return v.label;
        const found = todosItensAtivos.find(i => i.id === id);
        return found ? found.label : id;
    };

    const motoristaNome = checklist.motorista?.name || checklist.motorista_nome || '—';
    const placa   = checklist.veiculo?.placa || checklist.veiculo_caminhao_placa || '—';
    const modelo  = checklist.veiculo?.modelo || checklist.veiculo_caminhao_modelo || '';
    const semana  = fmtData(checklist.semana_ref);
    const odometro = checklist.odometro != null && checklist.odometro !== '' ? `${Number(checklist.odometro).toLocaleString('pt-BR')} km` : '—';
    const itens   = checklist.itens || {};
    const entradas = Object.entries(itens);
    const ok      = entradas.filter(([, v]) => itemIsOk(v)).length;
    const total   = entradas.length;
    const fotos   = (checklist.fotos_urls && checklist.fotos_urls.length) ? checklist.fotos_urls : (checklist.foto_url ? [checklist.foto_url] : []);

    // Duas colunas de itens (como no modelo de referência) — divide a lista ao meio.
    const metade = Math.ceil(entradas.length / 2);
    const colEsquerda = entradas.slice(0, metade);
    const colDireita  = entradas.slice(metade);
    const tabelaItens = (lista) => `<table><tbody>${lista.map(([id, v]) => {
        const itemOk = itemIsOk(v); const label = itemLabelOf(v, id); const obs = itemObsOf(v);
        return `<tr>
            <td style="width:70%">${esc(label)}${obs ? `<br/><span style="font-size:8pt;font-style:italic;color:#991B1B">"${esc(obs)}"</span>` : ''}</td>
            <td style="text-align:center;font-weight:bold;color:${itemOk ? '#059669' : '#DC2626'};width:30%">${itemOk ? '✓ OK' : '✗ NÃO OK'}</td>
        </tr>`;
    }).join('')}</tbody></table>`;

    const fotosHtml = fotos.length ? `
        <table style="margin-top:8px">
            <tr><td class="sec" colspan="4">FOTOS (${fotos.length})</td></tr>
        </table>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:6px">
            ${fotos.map(f => `<img src="${f}" style="width:100%;height:220px;object-fit:cover;border:1px solid #222;border-radius:4px" />`).join('')}
        </div>` : '';

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<title>Checklist — ${esc(placa)}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:Arial,Helvetica,sans-serif;font-size:10.5pt;color:#111;background:#fff}
  .page{width:190mm;margin:8mm auto}
  table{width:100%;border-collapse:collapse;table-layout:fixed}
  td{border:1px solid #222;padding:5px 8px;vertical-align:top;word-break:break-word;font-size:9.5pt}
  .lbl{background:#f0f0f0;font-weight:bold;white-space:nowrap;width:28%}
  .sec{background:#e8e8e8;font-weight:bold;text-align:center;font-size:11pt;padding:6px 8px}
  .emp{text-align:center;font-size:14pt;font-weight:bold;border:2px solid #222;padding:8px;letter-spacing:2px}
  .cols{display:flex;gap:8px;margin-top:8px}
  .cols>div{flex:1}
  @media print{html,body{margin:0}@page{size:A4 portrait;margin:8mm 12mm}.page{margin:0;width:auto}}
</style>
</head>
<body><div class="page">

<table style="margin-bottom:8px"><tr><td class="emp" colspan="4">CHECKLIST DE VEÍCULO</td></tr></table>

<table>
  <tr>
    <td class="lbl">Motorista:</td>
    <td>${esc(motoristaNome)}</td>
    <td class="lbl" style="width:20%">Semana:</td>
    <td style="width:25%">${esc(semana)}</td>
  </tr>
  <tr>
    <td class="lbl">Veículo / Placa:</td>
    <td>${esc(placa)}${modelo ? ' — ' + esc(modelo) : ''}</td>
    <td class="lbl">Odômetro:</td>
    <td>${esc(odometro)}</td>
  </tr>
  <tr>
    <td class="lbl">Status:</td>
    <td colspan="3">${checklist.aprovado ? '✓ Aprovado' : '⏳ Pendente'}${checklist.manutencao_registrada ? ' · Manutenção registrada' : ''} — ${ok}/${total} itens OK</td>
  </tr>
</table>

<table style="margin-top:8px"><tr><td class="sec" colspan="2">ITENS VERIFICADOS</td></tr></table>
<div class="cols">
  <div>${tabelaItens(colEsquerda)}</div>
  <div>${tabelaItens(colDireita)}</div>
</div>

${(checklist.problemas || checklist.necessidades || checklist.observacoes_livres) ? `
<table style="margin-top:8px">
  <tr><td class="sec" colspan="2">OBSERVAÇÕES GERAIS</td></tr>
  ${checklist.problemas ? `<tr><td class="lbl">Problemas:</td><td>${esc(checklist.problemas)}</td></tr>` : ''}
  ${checklist.necessidades ? `<tr><td class="lbl">Necessidades:</td><td>${esc(checklist.necessidades)}</td></tr>` : ''}
  ${checklist.observacoes_livres ? `<tr><td class="lbl">Obs. livres:</td><td>${esc(checklist.observacoes_livres)}</td></tr>` : ''}
</table>` : ''}

${checklist.obs_manutencao ? `
<table style="margin-top:8px">
  <tr><td class="sec" colspan="2">MANUTENÇÃO REGISTRADA</td></tr>
  <tr><td colspan="2">${esc(checklist.obs_manutencao)}</td></tr>
</table>` : ''}

${fotosHtml}

<div style="margin-top:34px;display:flex;justify-content:center">
  <div style="width:60%">
    <div style="border-bottom:1px solid #222;height:40px"></div>
    <div style="text-align:center;font-size:9pt;padding-top:3px">ASSINATURA DO MOTORISTA</div>
  </div>
</div>

</div>
<script>
  window.onload=function(){window.print();window.onfocus=function(){setTimeout(function(){window.close();},500);}};
</script>
</body></html>`;

    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) { alert('Permita popups para este site e tente novamente.'); return; }
    win.document.write(html);
    win.document.close();
}
