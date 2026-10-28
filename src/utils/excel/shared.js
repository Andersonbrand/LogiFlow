

// ── Helpers ───────────────────────────────────────────────────────────────────
export function today() { return new Date().toLocaleDateString('pt-BR').replace(/\//g,'-'); }

export const brl = v => Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});

export const n   = v => Number(v||0);

// ── EXPORTAR LISTA DE PEDIDOS POR VENDEDOR (Romaneio > Pedidos) ──────────────
// Gera um Excel simples só com Nº do Pedido / Cliente / Vendedor, pra mandar
// pra cada vendedor confirmando que os pedidos dele já estão em rota. A aba
// "Todos" traz tudo junto; cada vendedor com pedido no romaneio ganha também
// sua própria aba, já filtrada, funcionando como o "agrupamento" por vendedor.
export function sanitizeSheetName(name, used) {
    let base = (name || 'Sem vendedor').replace(/[\\/?*[\]:]/g, ' ').trim().slice(0, 28) || 'Sem vendedor';
    let out = base, i = 2;
    while (used.has(out.toLowerCase())) { out = `${base} (${i})`; i++; }
    used.add(out.toLowerCase());
    return out;
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

export function _xlsxBuildZip(files) {
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

export function _xlsxEsc(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

export function _xlsxCol(n) {
    let s = ''; n++;
    while (n > 0) { const r = (n-1)%26; s = String.fromCharCode(65+r)+s; n = Math.floor((n-1)/26); }
    return s;
}
