import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function num(v: unknown): number { return Number(v || 0); }

function brlFmt(v: unknown): string {
  return "R$ " + num(v).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return "";
  const [year, month, day] = d.split("T")[0].split("-");
  return `${day}/${month}/${year}`;
}

function esc(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Célula inlineStr — igual ao openpyxl
function cStr(ref: string, val: string, s: number): string {
  if (!val) return `<c r="${ref}" s="${s}" t="inlineStr"><is><t/></is></c>`;
  return `<c r="${ref}" s="${s}" t="inlineStr"><is><t>${esc(val)}</t></is></c>`;
}
function cEmpty(ref: string, s: number): string {
  return `<c r="${ref}" s="${s}" t="inlineStr"/>`;
}

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

function gerarDiariaExcel(d: DiariaDados): Uint8Array {
  const motoristaNome = d.motorista?.name || d.motorista_nome || "";
  const dataInicio    = fmtDate(d.data_inicio);
  const dataFim       = fmtDate(d.data_fim);
  const placa         = d.veiculo?.placa || d.placa || "";
  const diasQtd       = num(d.quantidade_dias);
  const valorDia      = num(d.valor_dia);
  const valorTotal    = num(d.valor_total) || diasQtd * valorDia;
  const descricao     = d.descricao || "";
  const periodo       = dataFim ? `${dataInicio} a ${dataFim}` : dataInicio;

  // Índices de estilo (ver styles.xml):
  // 1 = bold sz11 borda_full  left wrap
  // 2 = normal sz11 borda_full left wrap
  // 3 = bold sz11 sem_borda   left wrap   (Data:)
  // 4 = normal sz11 sem_borda left wrap   (valor data)
  // 5 = bold sz11 borda_full  center wrap (Diárias, Descrição/Motivo)
  // 6 = bold sz12 borda_full  left wrap   (valor total)
  // 7 = normal sz11 borda_bottom left wrap (linha assinatura)
  // 8 = normal sz11 sem_borda center wrap  (label assinatura)

  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetPr><outlinePr summaryBelow="1" summaryRight="1"/><pageSetUpPr/></sheetPr><dimension ref="A1:E29"/><sheetViews><sheetView workbookViewId="0"><selection activeCell="A1" sqref="A1"/></sheetView></sheetViews><sheetFormatPr baseColWidth="8" defaultRowHeight="15"/><cols><col width="62.78" customWidth="1" min="1" max="1"/><col width="18.89" customWidth="1" min="2" max="2"/><col width="8.43" customWidth="1" min="3" max="3"/><col width="8.43" customWidth="1" min="4" max="4"/><col width="14" customWidth="1" min="5" max="5"/><col width="8.66" customWidth="1" min="6" max="6"/><col width="9.22" customWidth="1" min="7" max="7"/></cols>
<sheetData>
<row r="1" ht="20" customHeight="1">${cStr("A1","Motorista:",1)}${cStr("B1",motoristaNome,2)}${cStr("D1","Data:",3)}${cStr("E1",periodo,4)}</row>
<row r="2" ht="20" customHeight="1">${cStr("A2","Ve\u00edculo / Placa:",1)}${cStr("B2",placa,2)}</row>
<row r="4" ht="20" customHeight="1">${cStr("A4","Di\u00e1rias",5)}</row>
<row r="5" ht="20" customHeight="1">${cStr("A5","Quantidade de dias: "+diasQtd,2)}</row>
<row r="6" ht="20" customHeight="1">${cStr("A6","Valor por dia (R$): "+brlFmt(valorDia),2)}</row>
<row r="7" ht="20" customHeight="1"></row>
<row r="8" ht="20" customHeight="1">${cStr("A8","Descri\u00e7\u00e3o / Motivo",5)}</row>
<row r="9"  ht="20" customHeight="1">${cStr("A9",descricao,2)}</row>
<row r="10" ht="20" customHeight="1">${cEmpty("A10",2)}</row>
<row r="11" ht="20" customHeight="1">${cEmpty("A11",2)}</row>
<row r="12" ht="20" customHeight="1">${cEmpty("A12",2)}</row>
<row r="13">${cEmpty("A13",2)}</row>
<row r="14">${cEmpty("A14",2)}</row>
<row r="15">${cEmpty("A15",2)}</row>
<row r="16" ht="20" customHeight="1">${cStr("A16","Valor Total:",1)}${cStr("B16",brlFmt(valorTotal),6)}</row>
<row r="20" ht="18" customHeight="1">${cEmpty("A20",7)}</row>
<row r="21" ht="18" customHeight="1">${cStr("A21","ASSINATURA DO SETOR DE TRANSPORTE",8)}</row>
<row r="24" ht="18" customHeight="1">${cEmpty("A24",7)}</row>
<row r="25" ht="18" customHeight="1">${cStr("A25","ASSINATURA DO SETOR DE LOGISTICA",8)}</row>
<row r="28" ht="18" customHeight="1">${cEmpty("A28",7)}</row>
<row r="29" ht="18" customHeight="1">${cStr("A29","ASSINATURA MOTORISTA",8)}</row>
</sheetData>
<pageMargins left="0.75" right="0.75" top="1" bottom="1" header="0.5" footer="0.5"/>
</worksheet>`;

  // styles.xml extraído fielmente do openpyxl com o mesmo layout
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="0"/>
<fonts count="4">
  <font><name val="Calibri"/><family val="2"/><sz val="11"/></font>
  <font><name val="Calibri"/><b val="1"/><sz val="11"/></font>
  <font><name val="Calibri"/><sz val="11"/></font>
  <font><name val="Calibri"/><b val="1"/><sz val="12"/></font>
</fonts>
<fills count="2">
  <fill><patternFill/></fill>
  <fill><patternFill patternType="gray125"/></fill>
</fills>
<borders count="4">
  <border><left/><right/><top/><bottom/><diagonal/></border>
  <border><left style="thin"/><right style="thin"/><top style="thin"/><bottom style="thin"/><diagonal/></border>
  <border><left/><right/><top/><bottom/><diagonal/></border>
  <border><left/><right/><top/><bottom style="thin"/><diagonal/></border>
</borders>
<cellStyleXfs count="1">
  <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
</cellStyleXfs>
<cellXfs count="9">
  <xf numFmtId="0" fontId="0" fillId="0" borderId="0" pivotButton="0" quotePrefix="0" xfId="0"/>
  <xf numFmtId="0" fontId="1" fillId="0" borderId="1" applyAlignment="1" pivotButton="0" quotePrefix="0" xfId="0"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>
  <xf numFmtId="0" fontId="2" fillId="0" borderId="1" applyAlignment="1" pivotButton="0" quotePrefix="0" xfId="0"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>
  <xf numFmtId="0" fontId="1" fillId="0" borderId="2" applyAlignment="1" pivotButton="0" quotePrefix="0" xfId="0"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>
  <xf numFmtId="0" fontId="2" fillId="0" borderId="2" applyAlignment="1" pivotButton="0" quotePrefix="0" xfId="0"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>
  <xf numFmtId="0" fontId="1" fillId="0" borderId="1" applyAlignment="1" pivotButton="0" quotePrefix="0" xfId="0"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
  <xf numFmtId="0" fontId="3" fillId="0" borderId="1" applyAlignment="1" pivotButton="0" quotePrefix="0" xfId="0"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>
  <xf numFmtId="0" fontId="2" fillId="0" borderId="3" applyAlignment="1" pivotButton="0" quotePrefix="0" xfId="0"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>
  <xf numFmtId="0" fontId="2" fillId="0" borderId="2" applyAlignment="1" pivotButton="0" quotePrefix="0" xfId="0"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
</cellXfs>
<cellStyles count="1">
  <cellStyle name="Normal" xfId="0" builtinId="0" hidden="0"/>
</cellStyles>
<tableStyles count="0" defaultTableStyle="TableStyleMedium9" defaultPivotStyle="PivotStyleLight16"/>
</styleSheet>`;

  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<bookViews><workbookView activeTab="0"/></bookViews>
<sheets><sheet name="Di\u00e1ria" sheetId="1" r:id="rId1"/></sheets>
</workbook>`;

  const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;

  return buildZip({
    "[Content_Types].xml":        contentTypes,
    "_rels/.rels":                rootRels,
    "xl/workbook.xml":            workbook,
    "xl/_rels/workbook.xml.rels": workbookRels,
    "xl/worksheets/sheet1.xml":   sheet,
    "xl/styles.xml":              styles,
  });
}

// ─── ZIP builder ─────────────────────────────────────────────────────────────
function buildZip(files: Record<string, string>): Uint8Array {
  const enc = new TextEncoder();

  function crc32(buf: Uint8Array): number {
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

  const entries: { name: Uint8Array; data: Uint8Array; crc: number }[] = [];
  for (const [name, content] of Object.entries(files)) {
    const nameB = enc.encode(name);
    const dataB = enc.encode(content);
    entries.push({ name: nameB, data: dataB, crc: crc32(dataB) });
  }

  const parts: Uint8Array[] = [];
  const cd: Uint8Array[] = [];
  let offset = 0;

  for (const e of entries) {
    const lh = new Uint8Array(30 + e.name.length);
    const dv = new DataView(lh.buffer);
    dv.setUint32(0, 0x04034b50, true); dv.setUint16(4, 20, true);
    dv.setUint16(6, 0, true); dv.setUint16(8, 0, true);
    dv.setUint16(10, 0, true); dv.setUint16(12, 0, true);
    dv.setUint32(14, e.crc, true);
    dv.setUint32(18, e.data.length, true); dv.setUint32(22, e.data.length, true);
    dv.setUint16(26, e.name.length, true); dv.setUint16(28, 0, true);
    lh.set(e.name, 30);

    const ce = new Uint8Array(46 + e.name.length);
    const cv = new DataView(ce.buffer);
    cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true);
    cv.setUint16(8, 0, true); cv.setUint16(10, 0, true); cv.setUint16(12, 0, true); cv.setUint16(14, 0, true);
    cv.setUint32(16, e.crc, true);
    cv.setUint32(20, e.data.length, true); cv.setUint32(24, e.data.length, true);
    cv.setUint16(28, e.name.length, true);
    cv.setUint16(30, 0, true); cv.setUint16(32, 0, true); cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true); cv.setUint32(38, 0, true); cv.setUint32(42, offset, true);
    ce.set(e.name, 46);

    parts.push(lh, e.data);
    cd.push(ce);
    offset += lh.length + e.data.length;
  }

  const cdSize = cd.reduce((s, b) => s + b.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true); ev.setUint16(4, 0, true); ev.setUint16(6, 0, true);
  ev.setUint16(8, entries.length, true); ev.setUint16(10, entries.length, true);
  ev.setUint32(12, cdSize, true); ev.setUint32(16, offset, true); ev.setUint16(20, 0, true);

  const all = [...parts, ...cd, eocd];
  const total = all.reduce((s, b) => s + b.length, 0);
  const out = new Uint8Array(total);
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

    const motoristaNome = (diaria.motorista?.name || diaria.motorista_nome || "motorista")
      .replace(/\s+/g, "_");
    const dataInicio = diaria.data_inicio
      ? fmtDate(diaria.data_inicio).replace(/\//g, "-")
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
