import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function num(v: unknown): number { return Number(v || 0); }

function brl(v: unknown): string {
  return "R$ " + num(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return "";
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString("pt-BR");
}

function escapeXml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function colLetter(n: number): string {
  let s = "";
  n++;
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface DiariaDados {
  motorista_nome?: string;
  motorista?: { name?: string } | null;
  data_inicio?: string | null;
  data_fim?: string | null;
  veiculo?: { placa?: string } | null;
  placa?: string;
  quantidade_dias?: number;
  valor_dia?: number;
  valor_total?: number;
  descricao?: string;
  viagem?: { numero?: string; destino?: string } | null;
}

// ─── Gerador de XLSX ──────────────────────────────────────────────────────────
function gerarDiariaExcel(d: DiariaDados): Uint8Array {
  const motoristaNome = d.motorista?.name || d.motorista_nome || "";
  const dataInicio    = fmtDate(d.data_inicio);
  const dataFim       = fmtDate(d.data_fim);
  const placa         = d.veiculo?.placa || d.placa || "";
  const diasQtd       = num(d.quantidade_dias);
  const valorDia      = num(d.valor_dia);
  const valorTotal    = num(d.valor_total) || diasQtd * valorDia;
  const descricao     = d.descricao || "";
  const viagem        = d.viagem?.numero ? `Viagem ${d.viagem.numero}` : "";
  const destino       = d.viagem?.destino || "";
  const periodo       = dataFim ? `${dataInicio} a ${dataFim}` : dataInicio;

  // ── Shared strings ─────────────────────────────────────────────────────────
  const ss: string[] = [];
  const ssMap: Record<string, number> = {};
  function S(v: string): number {
    if (ssMap[v] === undefined) { ssMap[v] = ss.length; ss.push(v); }
    return ssMap[v];
  }

  // ── Estilos (índices fixos) ────────────────────────────────────────────────
  // 0=default  1=lbl_bold  2=val_normal  3=cabec_bold_center
  // 4=valor_total_bold  5=assin_center  6=secao_bold_center_border
  // 7=lbl_bold_border  8=val_border  9=bold_border

  // ── Células e merges ───────────────────────────────────────────────────────
  type CellXml = string; // XML de célula pronto
  interface Row { ht?: number; cells: (CellXml | null)[]; }
  const rows: Row[] = [];
  const merges: { r1: number; c1: number; r2: number; c2: number }[] = [];

  // Helpers para células (5 colunas: A-E)
  const txt = (v: string, s: number) => `t="s"><v>${S(v)}</v>`;
  const emp = (s: number) => `s="${s}"/>`;

  // Monta XML de uma célula completa
  const cell = (ci: number, ri: number, v: string | number | null, s: number, isNum = false): CellXml => {
    const addr = `${colLetter(ci)}${ri + 1}`;
    if (v === null || v === "") return `<c r="${addr}" s="${s}"/>`;
    if (isNum) return `<c r="${addr}" s="${s}" t="n"><v>${v}</v></c>`;
    return `<c r="${addr}" s="${s}" t="s"><v>${S(String(v))}</v></c>`;
  };

  let R = 0;

  // Linha 1: Motorista | Data
  rows.push({ ht: 20, cells: [
    cell(0, R, "Motorista:", 1),     // A: bold
    cell(1, R, motoristaNome, 2),    // B: normal
    null,                             // C: vazio
    cell(3, R, "Data:", 1),          // D: bold
    cell(4, R, periodo, 2),          // E: normal
  ]});
  R++;

  // Linha 2: Veículo / Placa
  rows.push({ ht: 20, cells: [
    cell(0, R, "Veículo / Placa:", 1),
    cell(1, R, placa, 2),
    null,
    viagem ? cell(3, R, "Viagem:", 1) : cell(3, R, null, 0),
    viagem ? cell(4, R, viagem, 2)   : cell(4, R, null, 0),
  ]});
  R++;

  // Linha 3: vazia
  rows.push({ ht: 10, cells: [null, null, null, null, null] });
  R++;

  // Linha 4: "Diárias" — seção
  rows.push({ ht: 20, cells: [
    cell(0, R, "Diárias", 3),
    null, null, null, null,
  ]});
  merges.push({ r1: R, c1: 0, r2: R, c2: 4 });
  R++;

  // Linha 5: Quantidade de dias
  rows.push({ ht: 20, cells: [
    cell(0, R, `Quantidade de dias: ${diasQtd}`, 2),
    null, null, null, null,
  ]});
  merges.push({ r1: R, c1: 0, r2: R, c2: 4 });
  R++;

  // Linha 6: Valor por dia
  rows.push({ ht: 20, cells: [
    cell(0, R, `Valor por dia (R$): ${brl(valorDia)}`, 2),
    null, null, null, null,
  ]});
  merges.push({ r1: R, c1: 0, r2: R, c2: 4 });
  R++;

  // Linha 7: vazia
  rows.push({ ht: 20, cells: [null, null, null, null, null] });
  R++;

  // Linha 8: Descrição / Motivo — cabeçalho
  rows.push({ ht: 20, cells: [
    cell(0, R, "Descrição / Motivo", 3),
    null, null, null, null,
  ]});
  merges.push({ r1: R, c1: 0, r2: R, c2: 4 });
  R++;

  // Linhas 9–15: texto da descrição (linha 9 = descrição, resto vazio)
  for (let i = 0; i < 7; i++) {
    const val = i === 0 ? descricao : "";
    rows.push({ ht: 20, cells: [
      cell(0, R, val, 2),
      null, null, null, null,
    ]});
    merges.push({ r1: R, c1: 0, r2: R, c2: 4 });
    R++;
  }

  // Linhas 16: Valor Total
  rows.push({ ht: 20, cells: [
    cell(0, R, "Valor Total:", 1),
    cell(1, R, brl(valorTotal), 4),
    null, null, null,
  ]});
  R++;

  // Linhas 17–19: espaço
  for (let i = 0; i < 3; i++) {
    rows.push({ ht: 20, cells: [null, null, null, null, null] });
    R++;
  }

  // Linha 20: linha de assinatura Transporte (borda embaixo)
  rows.push({ ht: 18, cells: [
    cell(0, R, "", 6),  // s=6 tem border-bottom
    null, null, null, null,
  ]});
  merges.push({ r1: R, c1: 0, r2: R, c2: 4 });
  R++;

  // Linha 21: label Transporte
  rows.push({ ht: 18, cells: [
    cell(0, R, "ASSINATURA DO SETOR DE TRANSPORTE", 5),
    null, null, null, null,
  ]});
  merges.push({ r1: R, c1: 0, r2: R, c2: 4 });
  R++;

  // Linhas 22–23: espaço
  for (let i = 0; i < 2; i++) {
    rows.push({ ht: 18, cells: [null, null, null, null, null] });
    R++;
  }

  // Linha 24: linha de assinatura Logística
  rows.push({ ht: 18, cells: [
    cell(0, R, "", 6),
    null, null, null, null,
  ]});
  merges.push({ r1: R, c1: 0, r2: R, c2: 4 });
  R++;

  // Linha 25: label Logística
  rows.push({ ht: 18, cells: [
    cell(0, R, "ASSINATURA DO SETOR DE LOGISTICA", 5),
    null, null, null, null,
  ]});
  merges.push({ r1: R, c1: 0, r2: R, c2: 4 });
  R++;

  // Linhas 26–27: espaço
  for (let i = 0; i < 2; i++) {
    rows.push({ ht: 18, cells: [null, null, null, null, null] });
    R++;
  }

  // Linha 28: linha de assinatura Motorista
  rows.push({ ht: 18, cells: [
    cell(0, R, "", 6),
    null, null, null, null,
  ]});
  merges.push({ r1: R, c1: 0, r2: R, c2: 4 });
  R++;

  // Linha 29: label Motorista
  rows.push({ ht: 18, cells: [
    cell(0, R, "ASSINATURA MOTORISTA", 5),
    null, null, null, null,
  ]});
  merges.push({ r1: R, c1: 0, r2: R, c2: 4 });
  R++;

  // ── Montar sheetXml ────────────────────────────────────────────────────────
  let sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
           xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheetViews><sheetView tabSelected="1" workbookViewId="0"/></sheetViews>
<sheetFormatPr defaultRowHeight="20"/>
<cols>
  <col min="1" max="1" width="63" customWidth="1"/>
  <col min="2" max="2" width="19" customWidth="1"/>
  <col min="3" max="3" width="8"  customWidth="1"/>
  <col min="4" max="4" width="8"  customWidth="1"/>
  <col min="5" max="5" width="14" customWidth="1"/>
</cols>
<sheetData>`;

  rows.forEach((row, ri) => {
    const ht = row.ht ? ` ht="${row.ht}" customHeight="1"` : "";
    sheetXml += `\n<row r="${ri + 1}"${ht}>`;
    row.cells.forEach((c) => {
      if (c !== null) sheetXml += c;
    });
    sheetXml += `</row>`;
  });

  sheetXml += `\n</sheetData>`;

  if (merges.length > 0) {
    sheetXml += `\n<mergeCells count="${merges.length}">`;
    merges.forEach((m) => {
      sheetXml += `<mergeCell ref="${colLetter(m.c1)}${m.r1 + 1}:${colLetter(m.c2)}${m.r2 + 1}"/>`;
    });
    sheetXml += `</mergeCells>`;
  }

  sheetXml += `
<pageMargins left="0.4" right="0.4" top="0.6" bottom="0.6" header="0" footer="0"/>
<pageSetup paperSize="9" orientation="portrait"/>
</worksheet>`;

  // ── Shared strings XML ────────────────────────────────────────────────────
  let ssXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${ss.length}" uniqueCount="${ss.length}">`;
  ss.forEach((s) => {
    ssXml += `<si><t xml:space="preserve">${escapeXml(s)}</t></si>`;
  });
  ssXml += `</sst>`;

  // ── Styles XML ────────────────────────────────────────────────────────────
  // Índices dos estilos usados:
  // 0=default
  // 1=label bold, left (Motorista:, Veículo/Placa:, Valor Total:)
  // 2=valor normal, left
  // 3=seção bold center (Diárias, Descrição/Motivo)
  // 4=valor_total bold
  // 5=assinatura center
  // 6=linha assinatura (border-bottom)
  const thin = `<left/><right/><top/><bottom style="thin"><color rgb="FF000000"/></bottom>`;
  const none = `<left/><right/><top/><bottom/>`;

  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="3">
  <font><sz val="10"/><name val="Arial"/></font>
  <font><b/><sz val="10"/><name val="Arial"/></font>
  <font><b/><sz val="11"/><name val="Arial"/></font>
</fonts>
<fills count="2">
  <fill><patternFill patternType="none"/></fill>
  <fill><patternFill patternType="gray125"/></fill>
</fills>
<borders count="3">
  <border>${none}<diagonal/></border>
  <border><left style="thin"><color rgb="FF000000"/></left><right style="thin"><color rgb="FF000000"/></right><top style="thin"><color rgb="FF000000"/></top><bottom style="thin"><color rgb="FF000000"/></bottom><diagonal/></border>
  <border>${thin}<diagonal/></border>
</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="7">
  <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
  <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
  <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
  <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
  <xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
  <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
  <xf numFmtId="0" fontId="0" fillId="0" borderId="2" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
</cellXfs>
</styleSheet>`;

  // ── Workbook e rels ───────────────────────────────────────────────────────
  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
          xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="Diária" sheetId="1" r:id="rId1"/></sheets>
</workbook>`;

  const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles"    Target="styles.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
</Relationships>`;

  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml"  ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml"          ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml"            ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/xl/sharedStrings.xml"     ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
</Types>`;

  return buildZip({
    "[Content_Types].xml":         contentTypes,
    "_rels/.rels":                 rootRels,
    "xl/workbook.xml":             workbookXml,
    "xl/_rels/workbook.xml.rels":  workbookRels,
    "xl/worksheets/sheet1.xml":    sheetXml,
    "xl/styles.xml":               stylesXml,
    "xl/sharedStrings.xml":        ssXml,
  });
}

// ─── ZIP builder ─────────────────────────────────────────────────────────────
function buildZip(files: Record<string, string>): Uint8Array {
  const enc = new TextEncoder();

  function crc32(buf: Uint8Array): number {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      table[i] = c;
    }
    let crc = 0xFFFFFFFF;
    for (const byte of buf) crc = table[(crc ^ byte) & 0xFF] ^ (crc >>> 8);
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  const entries: { name: Uint8Array; data: Uint8Array; crc: number }[] = [];
  for (const [name, content] of Object.entries(files)) {
    const nameBytes = enc.encode(name);
    const dataBytes = enc.encode(content);
    entries.push({ name: nameBytes, data: dataBytes, crc: crc32(dataBytes) });
  }

  const parts: Uint8Array[] = [];
  const centralDir: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const lh = new Uint8Array(30 + entry.name.length);
    const dv = new DataView(lh.buffer);
    dv.setUint32(0,  0x04034b50, true);
    dv.setUint16(4,  20, true);
    dv.setUint16(6,  0, true);
    dv.setUint16(8,  0, true);
    dv.setUint16(10, 0, true);
    dv.setUint16(12, 0, true);
    dv.setUint32(14, entry.crc, true);
    dv.setUint32(18, entry.data.length, true);
    dv.setUint32(22, entry.data.length, true);
    dv.setUint16(26, entry.name.length, true);
    dv.setUint16(28, 0, true);
    lh.set(entry.name, 30);

    const cd = new Uint8Array(46 + entry.name.length);
    const cv = new DataView(cd.buffer);
    cv.setUint32(0,  0x02014b50, true);
    cv.setUint16(4,  20, true); cv.setUint16(6, 20, true);
    cv.setUint16(8,  0, true);  cv.setUint16(10, 0, true);
    cv.setUint16(12, 0, true);  cv.setUint16(14, 0, true);
    cv.setUint32(16, entry.crc, true);
    cv.setUint32(20, entry.data.length, true);
    cv.setUint32(24, entry.data.length, true);
    cv.setUint16(28, entry.name.length, true);
    cv.setUint16(30, 0, true); cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true); cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    cd.set(entry.name, 46);

    parts.push(lh, entry.data);
    centralDir.push(cd);
    offset += lh.length + entry.data.length;
  }

  const cdSize = centralDir.reduce((s, e) => s + e.length, 0);
  const eocd   = new Uint8Array(22);
  const ev     = new DataView(eocd.buffer);
  ev.setUint32(0,  0x06054b50, true);
  ev.setUint16(4,  0, true); ev.setUint16(6, 0, true);
  ev.setUint16(8,  entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, cdSize, true);
  ev.setUint32(16, offset, true);
  ev.setUint16(20, 0, true);

  const all   = [...parts, ...centralDir, eocd];
  const total = all.reduce((s, b) => s + b.length, 0);
  const out   = new Uint8Array(total);
  let pos = 0;
  for (const b of all) { out.set(b, pos); pos += b.length; }
  return out;
}

// ─── Handler HTTP ─────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  try {
    const diaria: DiariaDados = await req.json();
    const xlsxBytes = gerarDiariaExcel(diaria);

    const motoristaNome = (diaria.motorista?.name || diaria.motorista_nome || "motorista").replace(/\s+/g, "_");
    const dataInicio    = diaria.data_inicio
      ? new Date(diaria.data_inicio + "T00:00:00").toLocaleDateString("pt-BR").replace(/\//g, "-")
      : "sem-data";

    return new Response(xlsxBytes, {
      status: 200,
      headers: {
        ...CORS,
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="diaria_${motoristaNome}_${dataInicio}.xlsx"`,
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
