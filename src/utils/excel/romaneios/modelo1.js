import { getTelhaInfo } from 'utils/telhaUtils';
import { _xlsxCol, _xlsxEsc, _xlsxBuildZip, today } from '../shared';

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
            id:         i.id,
            pedido_id:  i.pedido_id,
            material_id: i.material?.id,
            descricao:  i.descricao,
            unidade:    i.unidade,
            quantidade: i.quantidade,
            peso_total: i.peso_total,
            peso_unit:  i.peso_unit,
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
        // Nome do item: material do catálogo → texto livre (descricao, quando o
        // item foi lançado sem vínculo com o catálogo de materiais) → fallback.
        const nomeItem = mat.nome || item.descricao || (item.material_id ? `Material #${item.material_id}` : 'Item sem descrição');
        // Para telhas, cada comprimento de corte vira uma linha própria — não
        // podemos somar peças de comprimentos diferentes na mesma linha.
        // A chave de agrupamento usa material_id → descricao/nome → id do próprio
        // item como último recurso, pra nunca misturar itens diferentes numa
        // linha só (o que fazia materiais sem material_id virarem "#undefined").
        const mid = String(item.material_id || item.descricao || mat.nome || item.id || Math.random()) + (isTelha ? `@${compTelha.toFixed(2)}` : '');

        if (!grupos[empresa]) grupos[empresa] = {};
        if (!grupos[empresa][cidade]) grupos[empresa][cidade] = {};
        if (!grupos[empresa][cidade][pedidoNum]) grupos[empresa][cidade][pedidoNum] = {};
        if (!grupos[empresa][cidade][pedidoNum][mid]) {
            grupos[empresa][cidade][pedidoNum][mid] = {
                nome:     nomeItem,
                unidade:  mat.unidade  || item.unidade || '',
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
