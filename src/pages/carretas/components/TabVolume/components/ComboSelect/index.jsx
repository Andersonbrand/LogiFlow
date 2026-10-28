import React, { useState, useRef, useCallback, useEffect } from 'react';

import { createPortal } from 'react-dom';

import { AppIcon as Icon } from 'components';

import { inputCls, inputStyle } from '../../utils/constants';

// ─── Select de valor único (id) com busca por digitação — usado nos campos de
// Motorista/Veículo Terceirizado, renderiza o painel via portal para não ser
// cortado pelo scroll do modal, mesmo padrão já usado na aba de Pneus/Acessórios ──
export default function ComboSelect({ value, onChange, options, placeholder = 'Selecione...', emptyLabel = 'Nenhum resultado', allowClear = true, clearLabel }) {
    const [open, setOpen] = useState(false);
    const [q, setQ] = useState('');
    const [coords, setCoords] = useState(null);
    const ref = useRef();
    const inputRef = useRef();
    const panelRef = useRef();

    const updateCoords = useCallback(() => {
        if (!inputRef.current) return;
        const r = inputRef.current.getBoundingClientRect();
        setCoords({ top: r.bottom + 4, left: r.left, width: r.width });
    }, []);

    useEffect(() => {
        const handler = e => {
            if (ref.current && ref.current.contains(e.target)) return;
            if (panelRef.current && panelRef.current.contains(e.target)) return;
            setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    useEffect(() => {
        if (!open) return;
        updateCoords();
        window.addEventListener('scroll', updateCoords, true);
        window.addEventListener('resize', updateCoords);
        return () => {
            window.removeEventListener('scroll', updateCoords, true);
            window.removeEventListener('resize', updateCoords);
        };
    }, [open, updateCoords]);

    const selected = options.find(o => String(o.value) === String(value));
    const displayValue = open ? q : (selected?.label || '');
    const filtered = options.filter(o => o.label.toLowerCase().includes((open ? q : '').toLowerCase()));

    return (
        <div ref={ref} className="relative">
            <div className="relative">
                <input
                    ref={inputRef}
                    value={displayValue}
                    onChange={e => { setQ(e.target.value); setOpen(true); }}
                    onFocus={() => { setOpen(true); setQ(''); }}
                    placeholder={placeholder}
                    className={inputCls + ' pr-8 cursor-pointer'}
                    style={inputStyle}
                />
                <Icon name="ChevronDown" size={14} color="var(--color-muted-foreground)"
                    style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            </div>
            {open && coords && createPortal(
                <div ref={panelRef} className="fixed z-[300] bg-white rounded-xl border shadow-lg overflow-hidden"
                    style={{ borderColor: 'var(--color-border)', top: coords.top, left: coords.left, width: coords.width }}>
                    <div className="max-h-52 overflow-y-auto">
                        {allowClear && (
                            <button type="button" onClick={() => { onChange(''); setQ(''); setOpen(false); }}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors font-medium"
                                style={{ color: 'var(--color-muted-foreground)' }}>
                                {clearLabel || placeholder}
                            </button>
                        )}
                        {filtered.length === 0 ? (
                            <div className="px-3 py-2.5 text-xs" style={{ color: 'var(--color-muted-foreground)' }}>{emptyLabel}</div>
                        ) : filtered.map(o => (
                            <button key={o.value} type="button"
                                onClick={() => { onChange(o.value); setQ(''); setOpen(false); }}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition-colors flex justify-between items-center">
                                <span>{o.label}</span>
                                {o.sub && <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>{o.sub}</span>}
                            </button>
                        ))}
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
