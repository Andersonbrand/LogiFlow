const nf = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
export const fNum = v => nf.format(Math.round(Number(v) || 0));
export const fBRL = v => (v == null ? '—' : brl.format(Number(v) || 0));
const brl2 = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const fBRL2 = v => (v == null ? '—' : brl2.format(Number(v) || 0));
export const fPct = v => (v == null ? '—' : `${Number(v).toFixed(1).replace('.', ',')}%`);
export const fCompacto = v => {
    const n = Number(v) || 0, a = Math.abs(n);
    if (a >= 1e6) return `${(n / 1e6).toFixed(1).replace('.', ',')} mi`;
    if (a >= 1e3) return `${(n / 1e3).toFixed(a >= 1e4 ? 0 : 1).replace('.', ',')} mil`;
    return fNum(n);
};
export const fMetrica = (fmt, v) => (v == null ? '—' : fmt === 'brl' ? fBRL(v) : fNum(v));
export const fData = d => (d ? d.split('-').reverse().join('/') : '—');
