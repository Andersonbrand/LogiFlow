import React, { useState } from 'react';
import Icon from 'components/AppIcon';

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

export default function MaterialCardMobile({ material, onEdit, onDelete }) {
    const [expanded, setExpanded] = useState(false);
    const formatPeso = (v) =>
        Number(v)?.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });

    return (
        <div className="bg-[var(--color-card)] border border-border rounded-lg shadow-card overflow-hidden">
            <div
                className="flex items-center justify-between px-4 py-3 cursor-pointer"
                onClick={() => setExpanded(!expanded)}
            >
                <div className="flex items-center gap-3 min-w-0">
                    <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: getCategoryColor(material?.categoria) }} />
                    <div className="min-w-0">
                        <p className="font-semibold text-[var(--color-text-primary)] text-sm line-clamp-1">{material?.nome}</p>
                        <p className="text-xs text-[var(--color-text-secondary)]">{material?.categoria}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="font-data text-sm font-medium text-[var(--color-text-primary)] whitespace-nowrap">
                        {formatPeso(material?.peso)} kg
                    </span>
                    <Icon name={expanded ? 'ChevronUp' : 'ChevronDown'} size={16} color="var(--color-muted-foreground)" />
                </div>
            </div>
            {expanded && (
                <div className="px-4 pb-3 border-t border-border bg-[var(--color-muted)] space-y-2">
                    <div className="flex justify-between text-sm pt-2">
                        <span className="text-[var(--color-text-secondary)]">Unidade:</span>
                        <span className="font-data font-medium text-[var(--color-text-primary)]">{material?.unidade}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-[var(--color-text-secondary)]">Peso por unidade:</span>
                        <span className="font-data font-medium text-[var(--color-text-primary)]">{formatPeso(material?.peso)} kg</span>
                    </div>
                    <div className="flex gap-2 pt-1">
                        <button
                            onClick={() => onEdit(material)}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md border border-blue-200 text-blue-600 bg-blue-50 text-sm font-medium"
                        >
                            <Icon name="Pencil" size={14} color="currentColor" />
                            Editar
                        </button>
                        <button
                            onClick={() => onDelete(material)}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md border border-red-200 text-red-500 bg-red-50 text-sm font-medium"
                        >
                            <Icon name="Trash2" size={14} color="currentColor" />
                            Excluir
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}