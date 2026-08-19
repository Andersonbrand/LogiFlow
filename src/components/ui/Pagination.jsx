import React, { useState, useMemo, useEffect } from 'react';
import Icon from 'components/AppIcon';

// ─── Paginação reutilizável — mesmo padrão já usado em Materiais e Romaneios ──
// Corta uma lista já filtrada em páginas de `pageSize` itens, sem precisar
// buscar de novo no banco: os dados continuam todos carregados em memória,
// só a RENDERIZAÇÃO fica limitada, o que é o que deixa a página pesada.
//
// Uso:
//   const { pageItems, page, setPage, totalPages, totalItems } = usePagination(listaFiltrada, 10, [busca, filtro]);
//   ...renderiza pageItems no lugar de listaFiltrada...
//   <PaginationBar page={page} setPage={setPage} totalPages={totalPages} totalItems={totalItems} pageSize={10} />
//
// `resetDeps` é a lista de dependências que, ao mudar, devem voltar a página
// para 1 (normalmente os mesmos filtros/busca usados para gerar a lista).
export function usePagination(items, pageSize = 10, resetDeps = []) {
    const [page, setPage] = useState(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { setPage(1); }, resetDeps);

    const totalItems = items.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const safePage = Math.min(page, totalPages);
    const pageItems = useMemo(
        () => items.slice((safePage - 1) * pageSize, safePage * pageSize),
        [items, safePage, pageSize]
    );

    return { pageItems, page: safePage, setPage, totalPages, totalItems, pageSize };
}

// Barra de navegação — some sozinha (mostra só a contagem) quando tudo cabe
// numa página só, igual ao padrão já usado em Materiais/Romaneios.
export function PaginationBar({ page, setPage, totalPages, totalItems, pageSize, itemLabel = 'registro', itemLabelPlural, className = '' }) {
    const plural = itemLabelPlural || `${itemLabel}s`;

    if (totalItems <= pageSize) {
        return (
            <div className={`px-4 py-2.5 border-t text-xs font-caption text-right ${className}`}
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)', backgroundColor: '#F9FAFB' }}>
                {totalItems} {totalItems === 1 ? itemLabel : plural}
            </div>
        );
    }

    const btnStyle = { borderColor: 'var(--color-border)' };
    return (
        <div className={`px-4 py-3 border-t text-xs font-caption ${className}`}
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)', backgroundColor: '#F9FAFB' }}>
            <div className="flex items-center justify-between flex-wrap gap-2">
                <p>Página {page} de {totalPages} · {totalItems} {plural}</p>
                <div className="flex items-center gap-1">
                    <button onClick={() => setPage(1)} disabled={page === 1}
                        className="px-2 py-1 rounded text-xs border disabled:opacity-40 hover:bg-gray-50" style={btnStyle}>«</button>
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                        className="px-3 py-1 rounded text-xs border disabled:opacity-40 hover:bg-gray-50" style={btnStyle}>Anterior</button>
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                        const p = start + i;
                        if (p > totalPages) return null;
                        return (
                            <button key={p} onClick={() => setPage(p)}
                                className="px-3 py-1 rounded text-xs border font-medium"
                                style={p === page
                                    ? { backgroundColor: 'var(--color-primary)', color: '#fff', borderColor: 'var(--color-primary)' }
                                    : btnStyle}>
                                {p}
                            </button>
                        );
                    })}
                    <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                        className="px-3 py-1 rounded text-xs border disabled:opacity-40 hover:bg-gray-50" style={btnStyle}>Próxima</button>
                    <button onClick={() => setPage(totalPages)} disabled={page === totalPages}
                        className="px-2 py-1 rounded text-xs border disabled:opacity-40 hover:bg-gray-50" style={btnStyle}>»</button>
                </div>
            </div>
        </div>
    );
}
