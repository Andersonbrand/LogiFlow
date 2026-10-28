import React from 'react';
import { TIPOS } from '../../utils/constants';

export default function TipoBadge({ tipo }) {
    const t = TIPOS[tipo];
    if (!t) return <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--color-muted)', color: 'var(--color-muted-foreground)' }}>—</span>;
    return (
        <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: t.bg, color: t.color, border: `1px solid ${t.border}` }}>
            {t.label}
        </span>
    );
}
