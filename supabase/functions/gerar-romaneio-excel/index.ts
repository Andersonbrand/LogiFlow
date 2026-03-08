import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ─── Cores e helpers ─────────────────────────────────────────────────────────
const AZUL    = "BDD7EE";
const AZUL2   = "D9E1F2";
const AMARELO = "FFF2CC";
const CINZA   = "F2F2F2";
const PRETO   = "000000";

function num(v: unknown): number { return Number(v || 0); }

function brl(v: unknown): string {
  return num(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ─── Geração do XML do Excel (XLSX manual) ───────────────────────────────────
// Usamos a estrutura XML diretamente para ter controle total de estilos

interface CellDef {
  v: string | number;
  t?: "s" | "n";       // s=string, n=number
  bold?: boolean;
  sz?: number;
  bg?: string;
  align?: "left" | "center" | "right";
  border?: boolean;
  numFmt?: string;
}

interface RowDef {
  cells: (CellDef | null)[];
  height?: number;
}

interface MergeDef {
  r1: number; c1: number; r2: number; c2: number;
}

function escapeXml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
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

// ─── Gerador principal ───────────────────────────────────────────────────────
function gerarExcel(romaneio: Record<string, unknown>): Uint8Array {
  const pedidos = (romaneio.romaneio_pedidos as Record<string, unknown>[] || []);
  const itens   = (romaneio.romaneio_itens   as Record<string, unknown>[] || []);

  const dtSaida = romaneio.saida
    ? new Date(romaneio.saida as string).toLocaleString("pt-BR", {
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit", timeZone: "America/Bahia"
      })
    : "—";

  // ── Agrupar itens por cidade + material ───────────────────────────────────
  const pedMap: Record<string, Record<string, unknown>> = {};
  pedidos.forEach((p) => { pedMap[p.id as string] = p; });

  const grupos: Record<string, Record<string, {
    nome: string; unidade: string; pesoUnit: number;
    quant: number; pesoTotal: number; peds: string[];
  }>> = {};

  itens.forEach((item) => {
    const mat    = (item.materials as Record<string, unknown>) || {};
    const pedido = pedMap[item.pedido_id as string] || {};
    const cidade = (pedido.cidade_destino as string) || (romaneio.destino as string) || "—";
    const mid    = String(item.material_id);

    if (!grupos[cidade]) grupos[cidade] = {};
    if (!grupos[cidade][mid]) {
      grupos[cidade][mid] = {
        nome:      String(mat.nome || `Material #${mid}`),
        unidade:   String(mat.unidade || ""),
        pesoUnit:  num(mat.peso),
        quant:     0, pesoTotal: 0, peds: [],
      };
    }
    grupos[cidade][mid].quant     += num(item.quantidade);
    grupos[cidade][mid].pesoTotal += num(item.peso_total);
    const np = pedido.numero_pedido as string;
    if (np && !grupos[cidade][mid].peds.includes(np)) grupos[cidade][mid].peds.push(np);
  });

  const cidadesArr = Object.entries(grupos)
    .sort(([a], [b]) => a.localeCompare(b, "pt-BR"))
    .map(([cidade, mats]) => ({
      cidade,
      itens: Object.values(mats).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    }));

  const pesoTotal = itens.reduce((s, i) => s + num(i.peso_total), 0);

  // ── Montar linhas ─────────────────────────────────────────────────────────
  const rows: RowDef[]  = [];
  const merges: MergeDef[] = [];

  const C: CellDef = { v: "" }; // célula vazia
  const cell = (v: string | number, opts?: Partial<CellDef>): CellDef => ({ v, t: typeof v === "number" ? "n" : "s", ...opts });
  const hdr  = (v: string): CellDef => cell(v, { bold: true, sz: 10, bg: AZUL2, align: "center", border: true });
  const lbl  = (v: string): CellDef => cell(v, { bold: true, sz: 10, bg: AZUL,  align: "center", border: true });
  const val  = (v: string): CellDef => cell(v, { bold: true, sz: 11, align: "center", border: true });
  const data = (v: string | number, align: "left"|"center"|"right" = "left"): CellDef => cell(v, { sz: 10, align, border: true });

  let R = 0;

  // Linha 1: título
  rows.push({ height: 26, cells: [
    cell(`ROMANEIO DE N.º  ${romaneio.numero || ""}`, { bold: true, sz: 14, bg: AZUL, align: "center" }),
    C, C, C, C, C,
    cell(String(romaneio.destino || ""), { bold: true, sz: 11, bg: AZUL, align: "center" }),
    C,
  ]});
  merges.push({ r1: R, c1: 0, r2: R, c2: 5 });
  merges.push({ r1: R, c1: 6, r2: R, c2: 7 });
  R++;

  // Linha 2: labels
  rows.push({ height: 16, cells: [lbl("Motorista"), C, C, lbl("Placa"), lbl("Saída"), C, lbl("Peso Total"), C] });
  merges.push({ r1: R, c1: 0, r2: R, c2: 2 });
  merges.push({ r1: R, c1: 4, r2: R, c2: 5 });
  merges.push({ r1: R, c1: 6, r2: R, c2: 7 });
  R++;

  // Linha 3: valores
  rows.push({ height: 20, cells: [
    val(String(romaneio.motorista || "")), C, C,
    val(String(romaneio.placa || "")),
    val(dtSaida), C,
    val(`${brl(pesoTotal)} kg`), C,
  ]});
  merges.push({ r1: R, c1: 0, r2: R, c2: 2 });
  merges.push({ r1: R, c1: 4, r2: R, c2: 5 });
  merges.push({ r1: R, c1: 6, r2: R, c2: 7 });
  R++;

  // Linha 4: cabeçalhos tabela
  rows.push({ height: 26, cells: [
    hdr("Material"), hdr("Un."), hdr("Quant."),
    hdr("Peso Unit.(kg)"), hdr("Peso Total(kg)"),
    hdr("Pedido(s)"), hdr("Valor do Pedido"), hdr("Frete"),
  ]});
  R++;

  // Dados agrupados por cidade
  cidadesArr.forEach(({ cidade, itens: itensCidade }) => {
    rows.push({ height: 18, cells: [
      cell(`📍 ${cidade}`, { bold: true, sz: 11, bg: AMARELO, align: "left", border: true }),
      C, C, C, C, C, C, C,
    ]});
    merges.push({ r1: R, c1: 0, r2: R, c2: 7 });
    R++;

    let pesoCidade = 0;
    itensCidade.forEach((item) => {
      pesoCidade += item.pesoTotal;
      rows.push({ height: 16, cells: [
        data(item.nome, "left"),
        data(item.unidade, "center"),
        data(item.quant, "center"),
        data(item.pesoUnit > 0 ? item.pesoUnit : "", "center"),
        data(Math.round(item.pesoTotal * 100) / 100, "center"),
        data(item.peds.join(" / ") || "—", "center"),
        cell("", { sz: 10, align: "right", border: true }),
        cell("", { sz: 10, align: "right", border: true }),
      ]});
      R++;
    });

    // Subtotal cidade
    rows.push({ height: 14, cells: [
      cell("", { bg: CINZA, border: true }), cell("", { bg: CINZA, border: true }),
      cell("", { bg: CINZA, border: true }),
      cell(`Subtotal ${cidade}:`, { bold: true, sz: 10, bg: CINZA, align: "right", border: true }),
      cell(Math.round(pesoCidade * 100) / 100, { bold: true, sz: 10, bg: CINZA, align: "center", border: true, t: "n" }),
      cell("", { bg: CINZA, border: true }), cell("", { bg: CINZA, border: true }), cell("", { bg: CINZA, border: true }),
    ]});
    R++;
  });

  // Total geral
  rows.push({ height: 20, cells: [
    cell("PESO TOTAL DA CARGA", { bold: true, sz: 11, bg: AZUL, align: "center", border: true }),
    C, C, C,
    cell(Math.round(pesoTotal * 100) / 100, { bold: true, sz: 11, bg: AZUL, align: "center", border: true, t: "n" }),
    cell("", { bg: AZUL, border: true }), cell("", { bg: AZUL, border: true }), cell("", { bg: AZUL, border: true }),
  ]});
  merges.push({ r1: R, c1: 0, r2: R, c2: 3 });
  R++;

  // Assinaturas
  rows.push({ cells: [C,C,C,C,C,C,C,C] }); R++;
  rows.push({ cells: [C,C,C,C,C,C,C,C] }); R++;
  rows.push({ cells: [
    cell("________________________________"), C, C,
    cell("________________________________"), C, C,
    cell("________________________________"), C,
  ]});
  merges.push({ r1: R, c1: 0, r2: R, c2: 2 });
  merges.push({ r1: R, c1: 3, r2: R, c2: 5 });
  merges.push({ r1: R, c1: 6, r2: R, c2: 7 });
  R++;
  rows.push({ cells: [
    cell("Motorista", { align: "center" }), C, C,
    cell("Conferente", { align: "center" }), C, C,
    cell("Responsável", { align: "center" }), C,
  ]});
  merges.push({ r1: R, c1: 0, r2: R, c2: 2 });
  merges.push({ r1: R, c1: 3, r2: R, c2: 5 });
  merges.push({ r1: R, c1: 6, r2: R, c2: 7 });

  // ── Montar XML ────────────────────────────────────────────────────────────
  const sharedStrings: string[] = [];
  const ssMap: Record<string, number> = {};
  function ssi(s: string): number {
    if (ssMap[s] === undefined) { ssMap[s] = sharedStrings.length; sharedStrings.push(s); }
    return ssMap[s];
  }

  // Estilos: índice fixo por tipo
  const stylesXml = buildStylesXml();

  // SheetData
  let sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
           xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheetViews><sheetView tabSelected="1" workbookViewId="0"/></sheetViews>
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

  rows.forEach((row, ri) => {
    const ht = row.height ? ` ht="${row.height}" customHeight="1"` : "";
    sheetXml += `\n<row r="${ri + 1}"${ht}>`;
    row.cells.forEach((c, ci) => {
      if (!c) return; // célula vazia (parte de merge)
      const addr = `${colLetter(ci)}${ri + 1}`;
      const si   = getStyleIndex(c);
      if (c.t === "n" && typeof c.v === "number") {
        sheetXml += `<c r="${addr}" s="${si}" t="n"><v>${c.v}</v></c>`;
      } else {
        const sv = String(c.v);
        if (sv === "") {
          sheetXml += `<c r="${addr}" s="${si}"/>`;
        } else {
          const idx = ssi(sv);
          sheetXml += `<c r="${addr}" s="${si}" t="s"><v>${idx}</v></c>`;
        }
      }
    });
    sheetXml += `</row>`;
  });

  sheetXml += `\n</sheetData>`;

  // Merges
  if (merges.length > 0) {
    sheetXml += `\n<mergeCells count="${merges.length}">`;
    merges.forEach((m) => {
      sheetXml += `<mergeCell ref="${colLetter(m.c1)}${m.r1+1}:${colLetter(m.c2)}${m.r2+1}"/>`;
    });
    sheetXml += `</mergeCells>`;
  }

  sheetXml += `\n<pageMargins left="0.4" right="0.4" top="0.4" bottom="0.4" header="0" footer="0"/>
<pageSetup paperSize="9" orientation="portrait"/>
</worksheet>`;

  // SharedStrings
  let ssXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${sharedStrings.length}" uniqueCount="${sharedStrings.length}">`;
  sharedStrings.forEach((s) => {
    ssXml += `<si><t xml:space="preserve">${escapeXml(s)}</t></si>`;
  });
  ssXml += `</sst>`;

  // Workbook
  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
          xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="Romaneio" sheetId="1" r:id="rId1"/></sheets>
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
  <Override PartName="/xl/workbook.xml"            ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml"   ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml"              ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/xl/sharedStrings.xml"       ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
</Types>`;

  // Montar ZIP (XLSX é um ZIP)
  return buildZip({
    "[Content_Types].xml":          contentTypes,
    "_rels/.rels":                  rootRels,
    "xl/workbook.xml":              workbookXml,
    "xl/_rels/workbook.xml.rels":   workbookRels,
    "xl/worksheets/sheet1.xml":     sheetXml,
    "xl/styles.xml":                stylesXml,
    "xl/sharedStrings.xml":         ssXml,
  });
}

// ─── Índice de estilos ────────────────────────────────────────────────────────
// Definimos estilos fixos e mapeamos por combinação de props
const STYLE_MAP: Record<string, number> = {};
let styleCounter = 0;

// Estilos pré-definidos (xfId mapeados no styles.xml)
// 0=default, 1=titulo_azul_bold14, 2=lbl_azul_bold10_center, 3=val_bold11_center_border
// 4=hdr_azul2_bold10_center_border, 5=cidade_amarelo_bold11_left_border
// 6=data_left_border, 7=data_center_border, 8=subtotal_cinza_bold_right_border
// 9=total_azul_bold11_center_border, 10=assinatura_center, 11=data_right_border

function getStyleIndex(c: CellDef): number {
  // Mapeamento simplificado baseado nas props
  if (!c.border && !c.bg && !c.bold && !c.align) return 0;
  if (c.bg === AZUL  && c.bold && c.sz === 14) return 1;
  if (c.bg === AZUL  && c.bold && c.sz === 10 ) return 2;
  if (c.bg === AZUL  && c.bold && c.sz === 11 && c.border) return 3;
  if (c.bg === AZUL2 && c.bold && c.sz === 10 && c.border) return 4;
  if (c.bg === AMARELO && c.bold && c.sz === 11 && c.border) return 5;
  if (c.border && c.align === "left"   && !c.bold && !c.bg) return 6;
  if (c.border && c.align === "center" && !c.bold && !c.bg) return 7;
  if (c.border && c.align === "right"  && !c.bold && !c.bg) return 11;
  if (c.bg === CINZA && c.bold && c.border) return 8;
  if (c.bg === CINZA && c.border && !c.bold) return 12;
  if (c.bg === AZUL  && c.bold && c.sz === 11 && c.border) return 9;
  if (!c.border && c.align === "center") return 10;
  return 0;
}

function buildStylesXml(): string {
  const thinGray = `<left style="thin"><color rgb="AAAAAA"/></left><right style="thin"><color rgb="AAAAAA"/></right><top style="thin"><color rgb="AAAAAA"/></top><bottom style="thin"><color rgb="AAAAAA"/></bottom>`;
  const noBorder = `<left/><right/><top/><bottom/>`;

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="6">
  <font><sz val="10"/><color rgb="FF000000"/><name val="Calibri"/></font>
  <font><sz val="14"/><b/><color rgb="FF000000"/><name val="Calibri"/></font>
  <font><sz val="10"/><b/><color rgb="FF000000"/><name val="Calibri"/></font>
  <font><sz val="11"/><b/><color rgb="FF000000"/><name val="Calibri"/></font>
  <font><sz val="11"/><color rgb="FF000000"/><name val="Calibri"/></font>
  <font><sz val="10"/><color rgb="FF000000"/><name val="Calibri"/></font>
</fonts>
<fills count="8">
  <fill><patternFill patternType="none"/></fill>
  <fill><patternFill patternType="gray125"/></fill>
  <fill><patternFill patternType="solid"><fgColor rgb="FF${AZUL}"/></patternFill></fill>
  <fill><patternFill patternType="solid"><fgColor rgb="FF${AZUL2}"/></patternFill></fill>
  <fill><patternFill patternType="solid"><fgColor rgb="FF${AMARELO}"/></patternFill></fill>
  <fill><patternFill patternType="solid"><fgColor rgb="FF${CINZA}"/></patternFill></fill>
  <fill><patternFill patternType="solid"><fgColor rgb="FFFFFFFF"/></patternFill></fill>
  <fill><patternFill patternType="none"/></fill>
</fills>
<borders count="2">
  <border>${noBorder}<diagonal/></border>
  <border>${thinGray}<diagonal/></border>
</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="13">
  <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
  <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
  <xf numFmtId="0" fontId="2" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
  <xf numFmtId="0" fontId="3" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
  <xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
  <xf numFmtId="0" fontId="3" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left"   vertical="center"/></xf>
  <xf numFmtId="0" fontId="4" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left"   vertical="center" wrapText="1"/></xf>
  <xf numFmtId="0" fontId="4" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
  <xf numFmtId="0" fontId="2" fillId="5" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right"  vertical="center"/></xf>
  <xf numFmtId="0" fontId="3" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
  <xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
  <xf numFmtId="0" fontId="4" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right"  vertical="center"/></xf>
  <xf numFmtId="0" fontId="4" fillId="5" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
</cellXfs>
</styleSheet>`;
}

// ─── Mini ZIP builder (sem dependências externas) ────────────────────────────
function buildZip(files: Record<string, string>): Uint8Array {
  const enc = new TextEncoder();
  const entries: { name: Uint8Array; data: Uint8Array; crc: number; }[] = [];

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

  for (const [name, content] of Object.entries(files)) {
    const nameBytes = enc.encode(name);
    const dataBytes = enc.encode(content);
    entries.push({ name: nameBytes, data: dataBytes, crc: crc32(dataBytes) });
  }

  const parts: Uint8Array[] = [];
  const centralDir: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const localHeader = new Uint8Array(30 + entry.name.length);
    const dv = new DataView(localHeader.buffer);
    dv.setUint32(0,  0x04034b50, true); // signature
    dv.setUint16(4,  20, true);          // version needed
    dv.setUint16(6,  0, true);           // flags
    dv.setUint16(8,  0, true);           // compression = store
    dv.setUint16(10, 0, true);           // mod time
    dv.setUint16(12, 0, true);           // mod date
    dv.setUint32(14, entry.crc, true);
    dv.setUint32(18, entry.data.length, true);
    dv.setUint32(22, entry.data.length, true);
    dv.setUint16(26, entry.name.length, true);
    dv.setUint16(28, 0, true);
    localHeader.set(entry.name, 30);

    const cdEntry = new Uint8Array(46 + entry.name.length);
    const cdv = new DataView(cdEntry.buffer);
    cdv.setUint32(0,  0x02014b50, true);
    cdv.setUint16(4,  20, true);
    cdv.setUint16(6,  20, true);
    cdv.setUint16(8,  0, true);
    cdv.setUint16(10, 0, true);
    cdv.setUint16(12, 0, true);
    cdv.setUint16(14, 0, true);
    cdv.setUint32(16, entry.crc, true);
    cdv.setUint32(20, entry.data.length, true);
    cdv.setUint32(24, entry.data.length, true);
    cdv.setUint16(28, entry.name.length, true);
    cdv.setUint16(30, 0, true);
    cdv.setUint16(32, 0, true);
    cdv.setUint16(34, 0, true);
    cdv.setUint16(36, 0, true);
    cdv.setUint32(38, 0, true);
    cdv.setUint32(42, offset, true);
    cdEntry.set(entry.name, 46);

    parts.push(localHeader, entry.data);
    centralDir.push(cdEntry);
    offset += localHeader.length + entry.data.length;
  }

  const cdSize   = centralDir.reduce((s, e) => s + e.length, 0);
  const eocd     = new Uint8Array(22);
  const eocdv    = new DataView(eocd.buffer);
  eocdv.setUint32(0,  0x06054b50, true);
  eocdv.setUint16(4,  0, true);
  eocdv.setUint16(6,  0, true);
  eocdv.setUint16(8,  entries.length, true);
  eocdv.setUint16(10, entries.length, true);
  eocdv.setUint32(12, cdSize, true);
  eocdv.setUint32(16, offset, true);
  eocdv.setUint16(20, 0, true);

  const all = [...parts, ...centralDir, eocd];
  const total = all.reduce((s, b) => s + b.length, 0);
  const result = new Uint8Array(total);
  let pos = 0;
  for (const b of all) { result.set(b, pos); pos += b.length; }
  return result;
}

// ─── Handler HTTP ─────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  try {
    const romaneio = await req.json();
    const xlsxBytes = gerarExcel(romaneio);

    return new Response(xlsxBytes, {
      status: 200,
      headers: {
        ...CORS,
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="romaneio_${romaneio.numero || "export"}.xlsx"`,
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
