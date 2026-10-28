import React from 'react';

import { AppIcon as Icon } from 'components';

// ─── Campo de pesquisa padrão (usado em Registros, Terceiros e Retira de Clientes) ─
export default function SearchInput({ value, onChange, placeholder, className = '', style }) {
    return (
        <div className={`relative ${className}`}
            style={{ width: '100%', minWidth: '260px', maxWidth: '420px', flexShrink: 0, ...style }}>
            <Icon name="Search" size={14} color="var(--color-muted-foreground)"
                style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            <input
                type="text"
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder={placeholder}
                className="w-full pl-8 pr-8 py-2.5 rounded-lg border text-sm outline-none transition-all focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)', color: 'var(--color-text-primary)' }}
            />
            {value && (
                <button type="button" onClick={() => onChange('')}
                    style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted-foreground)', fontSize: '13px', lineHeight: 1 }}>✕</button>
            )}
        </div>
    );
}
