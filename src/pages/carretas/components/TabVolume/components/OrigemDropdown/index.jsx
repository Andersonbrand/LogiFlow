import React, { useState, useRef, useEffect } from 'react';
import { AppIcon as Icon } from 'components';
import { inputCls, inputStyle } from '../../utils/constants';

// ─── Dropdown de Origem (Fornecedores) ────────────────────────────────────────
export default function OrigemDropdown({ value, onChange, fornecedores }) {
    const [open, setOpen] = useState(false);
    const [q, setQ] = useState('');
    const ref = useRef();

    useEffect(() => {
        const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const filtered = fornecedores.filter(f => f.nome.toLowerCase().includes(q.toLowerCase()));

    return (
        <div ref={ref} className="relative">
            <div className="flex">
                <input
                    value={value}
                    onChange={e => { onChange(e.target.value); setQ(e.target.value); setOpen(true); }}
                    onFocus={() => setOpen(true)}
                    className={inputCls + ' pr-9'}
                    style={inputStyle}
                    placeholder="Nome do fornecedor / origem"
                />
                <button
                    type="button"
                    onClick={() => setOpen(o => !o)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-gray-100"
                    style={{ color: 'var(--color-primary)' }}>
                    <Icon name="ChevronDown" size={14} />
                </button>
            </div>
            {open && (
                <div className="absolute z-50 w-full mt-1 bg-white rounded-xl border shadow-lg overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
                    {filtered.length === 0 ? (
                        <div className="px-3 py-2 text-xs" style={{ color: 'var(--color-muted-foreground)' }}>Nenhum fornecedor encontrado</div>
                    ) : (
                        <div className="max-h-40 overflow-y-auto">
                            {filtered.map(f => (
                                <button
                                    key={f.id}
                                    type="button"
                                    onClick={() => { onChange(f.nome); setQ(''); setOpen(false); }}
                                    className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 flex justify-between items-center">
                                    <span>{f.nome}</span>
                                    {f.cnpj && <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>{f.cnpj}</span>}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
