import React, { useState, useRef, useEffect, useLayoutEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Icon from 'components/AppIcon';

/**
 * PrettySelect — substituto do <select> nativo do navegador.
 *
 * O problema do <select> nativo é que, embora o campo fechado possa ser
 * estilizado, a LISTA que abre é renderizada pelo próprio sistema
 * operacional e não pode ser estilizada — por isso ficava com visual
 * inconsistente com o resto do sistema (ver telas de Pneus/Entregas, que já
 * usavam um componente próprio em vez do select nativo).
 *
 * Este componente aceita a MESMA API de um <select> (value, onChange,
 * <option> e <optgroup> como filhos), então pode substituir um <select> só
 * trocando a tag — sem precisar reescrever a lógica de cada formulário.
 * Quando onChange é chamado, ele recebe um objeto no formato
 * `{ target: { value, name } }`, igual ao evento nativo, para não quebrar os
 * handlers existentes (ex: `e => setForm(f => ({ ...f, campo: e.target.value }))`).
 *
 * Listas longas (mais de `searchThreshold` opções, ex: motoristas, placas,
 * produtos) ganham automaticamente uma caixa de busca — igual ao
 * comportamento do SearchableSelect já usado em Pneus/Entregas.
 *
 * A lista de opções é renderizada num portal (fora da árvore do formulário),
 * posicionada por coordenadas de tela. Isso evita dois problemas de quando
 * o select fica dentro de um modal com rolagem: (1) a lista sendo cortada
 * pelo `overflow` do modal, e (2) a lista fechando sozinha quando o usuário
 * tenta rolar o modal para vê-la — aqui ela só reposiciona, sem fechar.
 */
export default function PrettySelect({
    value, onChange, children, className = '', style = {}, disabled = false,
    placeholder, name, id, searchThreshold = 8, error, ...rest
}) {
    const [open, setOpen] = useState(false);
    const [busca, setBusca] = useState('');
    const [pos, setPos] = useState(null); // { top, left, width, openUp }
    const wrapRef = useRef();
    const listRef = useRef();
    const inputRef = useRef();

    // Extrai as opções a partir dos filhos, incluindo dentro de <optgroup>
    // (ex: "Frota Carretas" / "Caminhões (Veículos)"), preservando o rótulo
    // do grupo para exibir como cabeçalho na lista.
    const options = useMemo(() => {
        const out = [];
        const visit = (nodes, grupo) => {
            React.Children.forEach(nodes, (c) => {
                if (!c || !c.props) return;
                if (c.type === 'option') {
                    out.push({
                        value: c.props.value !== undefined ? c.props.value : c.props.children,
                        label: c.props.children,
                        disabled: !!c.props.disabled,
                        grupo,
                    });
                } else if (c.type === 'optgroup') {
                    visit(c.props.children, c.props.label || grupo);
                }
            });
        };
        visit(children, null);
        return out;
    }, [children]);

    const reposicionar = useCallback(() => {
        const el = wrapRef.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const espacoAbaixo = window.innerHeight - r.bottom;
        const abrirParaCima = espacoAbaixo < 260 && r.top > espacoAbaixo;
        setPos({
            top: abrirParaCima ? r.top : r.bottom,
            left: r.left,
            width: r.width,
            openUp: abrirParaCima,
        });
    }, []);

    useLayoutEffect(() => { if (open) reposicionar(); }, [open, reposicionar]);

    useEffect(() => {
        if (!open) return;
        // Reposiciona (não fecha) ao rolar qualquer ancestral — inclusive
        // modais internos — pra lista continuar grudada no campo.
        const onScrollOrResize = () => reposicionar();
        window.addEventListener('scroll', onScrollOrResize, true);
        window.addEventListener('resize', onScrollOrResize);
        return () => {
            window.removeEventListener('scroll', onScrollOrResize, true);
            window.removeEventListener('resize', onScrollOrResize);
        };
    }, [open, reposicionar]);

    useEffect(() => {
        if (!open) return;
        const handler = (e) => {
            if (wrapRef.current && wrapRef.current.contains(e.target)) return;
            if (listRef.current && listRef.current.contains(e.target)) return;
            setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    useEffect(() => {
        if (open) { setBusca(''); setTimeout(() => inputRef.current?.focus(), 0); }
    }, [open]);

    const selecionado = options.find(o => String(o.value) === String(value));
    const mostrarBusca = options.length > searchThreshold;
    const filtradas = mostrarBusca && busca.trim()
        ? options.filter(o => String(o.label ?? '').toLowerCase().includes(busca.toLowerCase()))
        : options;

    const emitir = (val) => {
        if (onChange) onChange({ target: { value: val, name } });
        setOpen(false);
    };

    // Agrupa as opções filtradas por `grupo` mantendo a ordem original.
    const grupos = useMemo(() => {
        const map = new Map();
        filtradas.forEach(o => {
            const chave = o.grupo || '';
            if (!map.has(chave)) map.set(chave, []);
            map.get(chave).push(o);
        });
        return Array.from(map.entries());
    }, [filtradas]);

    return (
        <div ref={wrapRef} className={`relative ${className}`} style={style} {...rest}>
            <button type="button" id={id} disabled={disabled}
                onClick={() => !disabled && setOpen(o => !o)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-sm text-left outline-none transition-all focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:opacity-60 disabled:cursor-not-allowed"
                style={{
                    borderColor: error ? '#FCA5A5' : 'var(--color-border)',
                    backgroundColor: disabled ? '#F9FAFB' : 'transparent',
                }}>
                <span className="truncate" style={{ color: selecionado ? 'var(--color-text-primary)' : 'var(--color-muted-foreground)' }}>
                    {selecionado ? selecionado.label : (placeholder || 'Selecione...')}
                </span>
                <Icon name={open ? 'ChevronUp' : 'ChevronDown'} size={14} color="var(--color-muted-foreground)" />
            </button>

            {open && pos && createPortal(
                <div ref={listRef} className="fixed z-[1000] bg-white border rounded-lg shadow-xl overflow-hidden flex flex-col"
                    style={{
                        borderColor: 'var(--color-border)',
                        top: pos.openUp ? undefined : pos.top + 4,
                        bottom: pos.openUp ? (window.innerHeight - pos.top + 4) : undefined,
                        left: pos.left,
                        width: pos.width,
                        maxHeight: 280,
                    }}>
                    {mostrarBusca && (
                        <div className="p-2 border-b flex-shrink-0" style={{ borderColor: 'var(--color-border)' }}>
                            <div className="relative">
                                <Icon name="Search" size={13} color="var(--color-muted-foreground)" style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)' }} />
                                <input ref={inputRef} value={busca} onChange={e => setBusca(e.target.value)}
                                    placeholder="Buscar..." className="w-full pl-7 pr-2 py-1.5 rounded-md border text-xs outline-none focus:ring-2 focus:ring-blue-500/20"
                                    style={{ borderColor: 'var(--color-border)' }} />
                            </div>
                        </div>
                    )}
                    <div className="overflow-y-auto">
                        {filtradas.length === 0 ? (
                            <p className="px-3 py-3 text-xs text-center" style={{ color: 'var(--color-muted-foreground)' }}>Nenhuma opção encontrada</p>
                        ) : (
                            grupos.map(([grupo, opts]) => (
                                <div key={grupo || '__sem_grupo__'}>
                                    {grupo && (
                                        <div className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-muted-foreground)' }}>
                                            {grupo}
                                        </div>
                                    )}
                                    {opts.map((o, i) => (
                                        <button key={`${o.value}-${i}`} type="button" disabled={o.disabled}
                                            onClick={() => emitir(o.value)}
                                            className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-default"
                                            style={{ backgroundColor: String(o.value) === String(value) && value !== '' ? '#EFF6FF' : 'transparent' }}>
                                            <span style={{ color: 'var(--color-text-primary)' }}>{o.label}</span>
                                        </button>
                                    ))}
                                </div>
                            ))
                        )}
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
