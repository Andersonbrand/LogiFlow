import React, { useState, useRef, useEffect } from 'react';
import { AppIcon as Icon } from 'components';
import { inputCls, inputStyle } from '../../utils/constants';

export default function DestinoSelect({ value, onChange, onFreteAutoFill, fretes, placeholder = 'Cidade ou estoque' }) {
    const [open, setOpen] = useState(false);
    const [q, setQ] = useState('');
    const ref = useRef();

    useEffect(() => {
        const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const filtered = fretes.filter(f => f.cidade.toLowerCase().includes(q.toLowerCase()));

    const select = (frete) => {
        onChange(frete.cidade);
        if (onFreteAutoFill) onFreteAutoFill(frete.frete_por_saco);
        setQ('');
        setOpen(false);
    };

    return (
        <div ref={ref} className="relative">
            <div className="flex">
                <input
                    value={value}
                    onChange={e => { onChange(e.target.value); setQ(e.target.value); setOpen(true); }}
                    onFocus={() => setOpen(true)}
                    className={inputCls + ' pr-9'}
                    style={inputStyle}
                    placeholder={placeholder}
                />
                <button type="button" onClick={() => setOpen(o => !o)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-gray-100"
                    style={{ color: 'var(--color-primary)' }}>
                    <Icon name="ChevronDown" size={14} />
                </button>
            </div>
            {open && (
                <div className="absolute z-50 w-full mt-1 bg-white rounded-xl border shadow-lg overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
                    <div className="max-h-52 overflow-y-auto">
                        {filtered.length === 0 ? (
                            <div className="px-3 py-2 text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                                {fretes.length === 0 ? 'Cadastre cidades na aba Fretes' : 'Nenhuma cidade encontrada'}
                            </div>
                        ) : filtered.map(f => (
                            <button key={f.id} type="button" onClick={() => select(f)}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 flex items-center justify-between gap-2">
                                <span className="font-medium" style={{ color: 'var(--color-text-primary)' }}>{f.cidade}</span>
                                <span className="text-xs font-mono font-semibold flex-shrink-0" style={{ color: '#059669' }}>
                                    {Number(f.frete_por_saco).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/saco
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
