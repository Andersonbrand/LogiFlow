import React, { useState, useRef, useEffect } from 'react';
import Icon from 'components/AppIcon';

// Sprint 1 — reusable autocomplete input
export default function Autocomplete({ value, onChange, suggestions = [], placeholder, name, required, error, label }) {
    const [open, setOpen]     = useState(false);
    const [query, setQuery]   = useState(value || '');
    const ref                 = useRef();

    useEffect(() => { setQuery(value || ''); }, [value]);

    useEffect(() => {
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const filtered = suggestions.filter(s =>
        s.toLowerCase().includes(query.toLowerCase()) && s.toLowerCase() !== query.toLowerCase()
    ).slice(0, 8);

    const handleInput = (e) => {
        setQuery(e.target.value);
        onChange(e.target.value);
        setOpen(true);
    };

    const select = (val) => {
        setQuery(val);
        onChange(val);
        setOpen(false);
    };

    return (
        <div ref={ref} className="relative">
            {label && (
                <label className="block text-xs font-medium font-caption mb-1.5" style={{ color: 'var(--color-text-primary)' }}>
                    {label}{required && ' *'}
                </label>
            )}
            <div className="relative">
                <input
                    name={name}
                    value={query}
                    onChange={handleInput}
                    onFocus={() => setOpen(true)}
                    placeholder={placeholder}
                    autoComplete="off"
                    className={`w-full h-10 px-3 pr-8 rounded-lg border text-sm focus:outline-none focus:ring-2 bg-white transition-all ${error ? 'border-red-400 focus:ring-red-200' : 'border-gray-200 focus:ring-blue-100'}`}
                />
                {query && (
                    <button type="button" onClick={() => { setQuery(''); onChange(''); }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-gray-100">
                        <Icon name="X" size={12} color="var(--color-muted-foreground)" />
                    </button>
                )}
            </div>
            {error && <p className="text-xs mt-1" style={{ color: 'var(--color-destructive)' }}>{error}</p>}
            {open && filtered.length > 0 && (
                <ul className="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-lg overflow-hidden"
                    style={{ borderColor: 'var(--color-border)' }}>
                    {filtered.map(s => (
                        <li key={s}>
                            <button type="button" onMouseDown={() => select(s)}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition-colors flex items-center gap-2">
                                <Icon name="Clock" size={12} color="var(--color-muted-foreground)" />
                                {s}
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
