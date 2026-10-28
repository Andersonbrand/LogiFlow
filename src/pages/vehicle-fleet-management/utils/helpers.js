export const BRL = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const FMT_DATE = d => d ? new Date(String(d).slice(0, 10) + 'T00:00:00').toLocaleDateString('pt-BR') : '—';
