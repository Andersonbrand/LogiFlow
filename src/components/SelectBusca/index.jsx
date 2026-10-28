import React, { useState, useRef, useEffect } from 'react';
import Icon from 'components/AppIcon';

/**
 * SelectBusca — dropdown de seleção com campo de busca, mas SEM texto livre:
 * só é possível escolher um valor que já existe na lista de `options`. Ao
 * contrário do Autocomplete (que aceita qualquer texto digitado), aqui o
 * valor final sempre corresponde a um item cadastrado.
 *
 * `options`: [{ value, label, sublabel? }]
 * `value`: o `value` selecionado atualmente
 * `onSelect(option)`: chamado com o objeto inteiro da opção escolhida
 * `allowCustom`: se true, mostra uma opção extra no fim ("+ outro / digitar")
 *   que libera um campo de texto livre — usado só onde faz sentido permitir
 *   um valor novo que ainda não está cadastrado (ex: cidade nova).
 * `onCustomSubmit(texto)`: chamado quando o usuário digita um valor customizado
 */
export default function SelectBusca({
    options = [], value, onSelect, placeholder = 'Selecione...', label, required, error,
    allowCustom = false, customValue = '', onCustomSubmit, customPlaceholder = 'Digite...',
}) {
    const [open, setOpen] = useState(false);
    const [busca, setBusca] = useState('');
    const [modoCustom, setModoCustom] = useState(false);
    const ref = useRef();

    useEffect(() => {
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const selecionado = options.find(o => o.value === value);
    const filtradas = options.filter(o =>
        (o.label || '').toLowerCase().includes(busca.toLowerCase()) ||
        (o.sublabel || '').toLowerCase().includes(busca.toLowerCase())
    ).slice(0, 30);

    const escolher = (opt) => {
        onSelect(opt);
        setBusca('');
        setOpen(false);
        setModoCustom(false);
    };

    if (modoCustom) {
        return (
            <div ref={ref}>
                {label && (
                    <label className="block text-xs font-medium font-caption mb-1.5" style={{ color: 'var(--color-text-primary)' }}>
                        {label}{required && ' *'}
                    </label>
                )}
                <div className="flex gap-1.5">
                    <input
                        value={customValue}
                        onChange={e => onCustomSubmit?.(e.target.value)}
                        placeholder={customPlaceholder}
                        autoFocus
                        className={`w-full h-10 px-3 rounded-lg border text-sm focus:outline-none focus:ring-2 bg-white transition-all ${error ? 'border-red-400 focus:ring-red-200' : 'border-gray-200 focus:ring-blue-100'}`}
                    />
                    <button type="button" onClick={() => setModoCustom(false)}
                        className="px-2.5 rounded-lg border text-xs font-medium hover:bg-gray-50 flex-shrink-0" style={{ borderColor: 'var(--color-border)' }}
                        title="Voltar pra lista cadastrada">
                        <Icon name="List" size={14} />
                    </button>
                </div>
                {error && <p className="text-xs mt-1" style={{ color: 'var(--color-destructive)' }}>{error}</p>}
            </div>
        );
    }

    return (
        <div ref={ref} className="relative">
            {label && (
                <label className="block text-xs font-medium font-caption mb-1.5" style={{ color: 'var(--color-text-primary)' }}>
                    {label}{required && ' *'}
                </label>
            )}
            <button type="button" onClick={() => setOpen(o => !o)}
                className={`w-full h-10 px-3 pr-8 rounded-lg border text-sm text-left bg-white focus:outline-none focus:ring-2 transition-all relative ${error ? 'border-red-400 focus:ring-red-200' : 'border-gray-200 focus:ring-blue-100'}`}>
                <span className={selecionado ? '' : 'text-gray-400'}>
                    {selecionado ? selecionado.label : placeholder}
                </span>
                <Icon name="ChevronDown" size={14} color="var(--color-muted-foreground)" className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </button>
            {error && <p className="text-xs mt-1" style={{ color: 'var(--color-destructive)' }}>{error}</p>}
            {open && (
                <div className="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-lg overflow-hidden flex flex-col" style={{ borderColor: 'var(--color-border)' }}>
                    <div className="p-1.5 border-b" style={{ borderColor: 'var(--color-border)' }}>
                        <input autoFocus value={busca} onChange={e => setBusca(e.target.value)}
                            placeholder="Buscar..." onMouseDown={e => e.stopPropagation()}
                            className="w-full h-8 px-2 rounded border text-sm focus:outline-none" style={{ borderColor: 'var(--color-border)' }} />
                    </div>
                    <ul className="max-h-56 overflow-y-auto">
                        {filtradas.length === 0 && (
                            <li className="px-3 py-2.5 text-xs text-center" style={{ color: 'var(--color-muted-foreground)' }}>Nada encontrado.</li>
                        )}
                        {filtradas.map(o => (
                            <li key={o.value}>
                                <button type="button" onMouseDown={() => escolher(o)}
                                    className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition-colors flex flex-col">
                                    <span>{o.label}</span>
                                    {o.sublabel && <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>{o.sublabel}</span>}
                                </button>
                            </li>
                        ))}
                    </ul>
                    {allowCustom && (
                        <button type="button" onMouseDown={() => { setModoCustom(true); setOpen(false); }}
                            className="w-full text-left px-3 py-2 text-sm border-t hover:bg-gray-50 flex items-center gap-1.5 flex-shrink-0"
                            style={{ borderColor: 'var(--color-border)', color: 'var(--color-primary)' }}>
                            <Icon name="Plus" size={13} /> Digitar outra cidade
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
