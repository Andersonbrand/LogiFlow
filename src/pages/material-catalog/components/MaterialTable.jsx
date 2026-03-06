import React from 'react';
import Icon from 'components/AppIcon';


export default function MaterialTable({ materials, sortConfig, onSort, onEdit, onDelete, loading }) {
    const getSortIcon = (col) => {
        if (sortConfig?.key !== col) return <Icon name="ChevronsUpDown" size={14} color="currentColor" />;
        return sortConfig?.dir === 'asc'
            ? <Icon name="ChevronUp" size={14} color="currentColor" />
            : <Icon name="ChevronDown" size={14} color="currentColor" />;
    };

    const cols = [
        { key: 'nome', label: 'Material' },
        { key: 'categoria', label: 'Categoria' },
        { key: 'unidade', label: 'Unidade' },
        { key: 'peso', label: 'Peso por Unidade (kg)' },
    ];

    const formatPeso = (v) =>
        Number(v)?.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });

    return (
        <div className="overflow-x-auto rounded-lg border border-border shadow-card">
            <table className="w-full min-w-[640px] border-collapse text-sm">
                <thead>
                    <tr style={{ backgroundColor: '#404040' }}>
                        {cols?.map((c) => (
                            <th
                                key={c?.key}
                                className="px-4 py-3 text-left text-white font-semibold cursor-pointer select-none whitespace-nowrap"
                                onClick={() => onSort(c?.key)}
                            >
                                <span className="flex items-center gap-1">
                                    {c?.label}
                                    {getSortIcon(c?.key)}
                                </span>
                            </th>
                        ))}
                        <th className="px-4 py-3 text-center text-white font-semibold whitespace-nowrap">Ações</th>
                    </tr>
                </thead>
                <tbody>
                    {loading ? (
                        <tr>
                            <td colSpan={5} className="text-center py-12 text-[var(--color-muted-foreground)]">
                                <div className="flex flex-col items-center gap-2">
                                    <Icon name="Loader2" size={28} className="animate-spin" />
                                    <span>Carregando materiais...</span>
                                </div>
                            </td>
                        </tr>
                    ) : materials?.length === 0 ? (
                        <tr>
                            <td colSpan={5} className="text-center py-12 text-[var(--color-muted-foreground)]">
                                <div className="flex flex-col items-center gap-2">
                                    <Icon name="PackageSearch" size={36} color="var(--color-muted-foreground)" />
                                    <span className="font-medium">Nenhum material encontrado</span>
                                    <span className="text-xs">Tente ajustar os filtros ou cadastre um novo material</span>
                                </div>
                            </td>
                        </tr>
                    ) : (
                        materials?.map((m, i) => (
                            <tr
                                key={m?.id}
                                className="border-t border-border transition-colors duration-150 hover:bg-[var(--color-muted)]"
                                style={{ backgroundColor: i % 2 === 0 ? '#FFFFFF' : '#F8FAFC' }}
                            >
                                <td className="px-4 py-3 font-medium text-[var(--color-text-primary)]">
                                    <div className="flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: getCategoryColor(m?.categoria) }} />
                                        <span className="line-clamp-1">{m?.nome}</span>
                                    </div>
                                </td>
                                <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border"
                                        style={{ borderColor: getCategoryColor(m?.categoria), color: getCategoryColor(m?.categoria), backgroundColor: getCategoryColor(m?.categoria) + '18' }}>
                                        {m?.categoria}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-[var(--color-text-secondary)] font-data">{m?.unidade}</td>
                                <td className="px-4 py-3 font-data text-[var(--color-text-primary)] whitespace-nowrap">{formatPeso(m?.peso)}</td>
                                <td className="px-4 py-3">
                                    <div className="flex items-center justify-center gap-1">
                                        <button
                                            onClick={() => onEdit(m)}
                                            className="p-1.5 rounded-md hover:bg-blue-50 text-blue-600 transition-colors"
                                            title="Editar material"
                                            aria-label={`Editar ${m?.nome}`}
                                        >
                                            <Icon name="Pencil" size={15} color="currentColor" />
                                        </button>
                                        <button
                                            onClick={() => onDelete(m)}
                                            className="p-1.5 rounded-md hover:bg-red-50 text-red-500 transition-colors"
                                            title="Excluir material"
                                            aria-label={`Excluir ${m?.nome}`}
                                        >
                                            <Icon name="Trash2" size={15} color="currentColor" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
}

function getCategoryColor(cat) {
    const map = {
        'Construção': '#1E3A5F',
        'Elétrico': '#D97706',
        'Hidráulico': '#0891B2',
        'Ferramentas': '#4A6741',
        'Químico': '#7C3AED',
        'Outros': '#6B7280',
    };
    return map?.[cat] || '#6B7280';
}