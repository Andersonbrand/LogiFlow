import React from 'react';

import { AppIcon as Icon } from 'components';

export default function SearchInput({ value, onChange, placeholder = 'Buscar...', width = '240px' }) {
    return (
        <div className="relative flex-shrink-0" style={{ minWidth: width }}>
            <Icon name="Search" size={13} color="var(--color-muted-foreground)"
                style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            <input
                type="text"
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder={placeholder}
                className="w-full pl-7 pr-7 py-2 rounded-lg border text-xs outline-none transition-all focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)', color: 'var(--color-text-primary)' }}
            />
            {value && (
                <button onClick={() => onChange('')}
                    style={{ position: 'absolute', right: '7px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted-foreground)', fontSize: '13px', lineHeight: 1 }}>✕</button>
            )}
        </div>
    );
}
