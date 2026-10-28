import React, { useState, useRef, useCallback, useEffect } from 'react';

import { createPortal } from 'react-dom';

import { AppIcon as Icon } from 'components';

import { inputCls, inputStyle } from '../../utils/constants';

// ─── Dropdown pesquisável (substitui <PrettySelect>/<datalist> nativos, que exigiam
//     rolar a lista inteira pra achar um item) ────────────────────────────────
export default function SearchSelect({ value, onChange, options, placeholder = 'Selecione...', freeText = false, emptyLabel = 'Nenhum resultado', allowClear = false, clearLabel = 'Todos' }) {
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
        // Captura scroll de qualquer ancestral (inclusive o corpo do modal) para
        // manter o painel colado no campo, já que ele é renderizado via portal.
        window.addEventListener('scroll', updateCoords, true);
        window.addEventListener('resize', updateCoords);
        return () => {
            window.removeEventListener('scroll', updateCoords, true);
            window.removeEventListener('resize', updateCoords);
        };
    }, [open, updateCoords]);

    const selected = options.find(o => o.value === value);
    const displayValue = open ? q : (selected?.label || (freeText ? value : ''));
    const filtered = options.filter(o => o.label.toLowerCase().includes((open ? q : '').toLowerCase()));

    return (
        <div ref={ref} className="relative">
            <div className="relative">
                <input
                    ref={inputRef}
                    value={displayValue}
                    onChange={e => { setQ(e.target.value); setOpen(true); if (freeText) onChange(e.target.value); }}
                    onFocus={() => setOpen(true) || setQ('')}
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
                                className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition-colors font-medium"
                                style={{ color: 'var(--color-muted-foreground)' }}>
                                {clearLabel}
                            </button>
                        )}
                        {filtered.length === 0 ? (
                            <div className="px-3 py-2.5 text-xs" style={{ color: 'var(--color-muted-foreground)' }}>{emptyLabel}</div>
                        ) : filtered.map(o => (
                            <button key={o.value} type="button"
                                onClick={() => { onChange(o.value); setQ(''); setOpen(false); }}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition-colors"
                                style={{ color: 'var(--color-text-primary)' }}>
                                {o.label}
                            </button>
                        ))}
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
