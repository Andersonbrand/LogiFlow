import * as XLSX from 'xlsx';
import { _xlsxCol, _xlsxEsc, _xlsxBuildZip, today } from './shared';

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
