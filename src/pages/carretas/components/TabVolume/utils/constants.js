export const inputCls = 'w-full px-3 py-2 rounded-lg border text-sm outline-none transition-all focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500';

export const inputStyle = { borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' };

// ─── Tipo de volume ────────────────────────────────────────────────────────────
export const TIPOS = {
    ARA_GBI_FOB:  { label: 'FOB · Guanambi',  short: 'FOB GBI',  bg: '#EFF6FF', color: '#1E3A5F', border: '#BFDBFE', bar: '#1E3A5F' },
    ARA_BARR_FOB: { label: 'FOB · Barreiras', short: 'FOB Barr', bg: '#F5F3FF', color: '#7C3AED', border: '#DDD6FE', bar: '#7C3AED' },
    CIF_GBI:      { label: 'CIF · Guanambi',  short: 'CIF GBI',  bg: '#ECFDF5', color: '#059669', border: '#A7F3D0', bar: '#059669' },
    CIF_BARR:     { label: 'CIF · Barreiras', short: 'CIF Barr', bg: '#FFFBEB', color: '#D97706', border: '#FDE68A', bar: '#D97706' },
    ESTOQUE:      { label: 'Carregamento no Estoque', short: 'Estoque', bg: '#FFF7ED', color: '#C2410C', border: '#FED7AA', bar: '#C2410C' },
};
