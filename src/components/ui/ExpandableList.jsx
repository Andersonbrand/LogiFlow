import React, { useState } from 'react';
import Icon from 'components/AppIcon';

// ─── Card recolhível/expansível — mesmo padrão visual do "Resumo por Motorista" ──
// Cabeçalho clicável (título + resumo opcional + seta) que esconde/mostra o
// conteúdo inteiro, em vez de paginar. Usado nas maiores tabelas/listas do app.
//
// Uso:
//   const { open, toggle } = useCollapsible(true); // true = já vem aberto
//   <button onClick={toggle}>...título... <CollapseChevron open={open} /></button>
//   {open && (...conteúdo...)}
export function useCollapsible(defaultOpen = true) {
    const [open, setOpen] = useState(defaultOpen);
    return { open, toggle: () => setOpen(o => !o) };
}

export function CollapseChevron({ open, color = 'currentColor', size = 16 }) {
    return (
        <span className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0" title={open ? 'Recolher' : 'Expandir'}>
            <Icon name={open ? 'ChevronUp' : 'ChevronDown'} size={size} color={color} />
        </span>
    );
}
