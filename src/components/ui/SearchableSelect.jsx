import React, { useState, useRef, useEffect } from 'react';
import Icon from 'components/AppIcon';

const inputStyle = { borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' };

/**
 * SearchableSelect — combobox com busca e lista rolável.
 * Substitui <select> nativos longos (ex: placas de veículos, motoristas),
 * que ficam "grudados"/difíceis de navegar quando há muitas opções.
 *
 * options: [{ value, label, sublabel? }]
 */
export default function SearchableSelect({ value, onChange, options = [], placeholder = 'Selecione...', emptyLabel = 'Nenhuma opção encontrada', disabled = false }) {
    const [open, setOpen] = useState(false);
    const [busca, setBusca] = useState('');
    const ref = useRef();
    const inputRef = useRef();

    useEffect(() => {
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    useEffect(() => { if (open) { setBusca(''); setTimeout(() => inputRef.current?.focus(), 0); } }, [open]);

    const selecionado = options.find(o => String(o.value) === String(value));
    const filtradas = busca.trim()
        ? options.filter(o => (`${o.label} ${o.sublabel || ''}`).toLowerCase().includes(busca.toLowerCase()))
        : options;

    return (
        <div ref={ref} className="relative">
            <button type="button" disabled={disabled} onClick={() => setOpen(o => !o)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-sm text-left outline-none transition-all focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:opacity-60 disabled:cursor-not-allowed"
                style={{ ...inputStyle, backgroundColor: disabled ? '#F9FAFB' : 'transparent' }}>
                <span className={selecionado ? '' : 'truncate'} style={{ color: selecionado ? 'var(--color-text-primary)' : 'var(--color-muted-foreground)' }}>
                    {selecionado ? selecionado.label : placeholder}
                </span>
                <Icon name={open ? 'ChevronUp' : 'ChevronDown'} size={14} color="var(--color-muted-foreground)" />
            </button>

            {open && (
                <div className="absolute z-50 mt-1 w-full bg-white border rounded-lg shadow-xl overflow-hidden flex flex-col" style={{ borderColor: 'var(--color-border)', maxHeight: 280 }}>
                    <div className="p-2 border-b flex-shrink-0" style={{ borderColor: 'var(--color-border)' }}>
                        <div className="relative">
                            <Icon name="Search" size={13} color="var(--color-muted-foreground)" style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)' }} />
                            <input ref={inputRef} value={busca} onChange={e => setBusca(e.target.value)}
                                placeholder="Buscar..." className="w-full pl-7 pr-2 py-1.5 rounded-md border text-xs outline-none focus:ring-2 focus:ring-blue-500/20"
                                style={{ borderColor: 'var(--color-border)' }} />
                        </div>
                    </div>
                    <div className="overflow-y-auto">
                        <button type="button" onClick={() => { onChange(''); setOpen(false); }}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition-colors" style={{ color: 'var(--color-muted-foreground)' }}>
                            {placeholder}
                        </button>
                        {filtradas.length === 0 ? (
                            <p className="px-3 py-3 text-xs text-center" style={{ color: 'var(--color-muted-foreground)' }}>{emptyLabel}</p>
                        ) : (
                            filtradas.map(o => (
                                <button key={o.value} type="button" onClick={() => { onChange(o.value); setOpen(false); }}
                                    className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition-colors flex flex-col"
                                    style={{ backgroundColor: String(o.value) === String(value) ? '#EFF6FF' : 'transparent' }}>
                                    <span style={{ color: 'var(--color-text-primary)' }}>{o.label}</span>
                                    {o.sublabel && <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>{o.sublabel}</span>}
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
