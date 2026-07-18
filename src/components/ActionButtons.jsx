import React from 'react';
import Icon from './AppIcon';

/**
 * Botões de ação padrão (Editar / Excluir / Visualizar) usados em toda a
 * aplicação LogiFlow. Tamanho de referência definido a partir da tela
 * "Custos de Rodagem": ícone 16px, padding 1.5, cantos arredondados.
 *
 * Sempre com flex-shrink-0 para não encolher em tabelas com colunas
 * apertadas (bug de ícones minúsculos ao espremer a coluna de ações).
 */

export const ACTION_ICON_SIZE = 16;

export function EditButton({ onClick, title = 'Editar', className = '', disabled = false }) {
    return (
        <button
            type="button"
            onClick={onClick}
            title={title}
            disabled={disabled}
            className={`p-1.5 rounded-lg hover:bg-blue-100 transition-colors flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed ${className}`}
        >
            <Icon name="Pencil" size={ACTION_ICON_SIZE} color="#2563EB" className="flex-shrink-0" />
        </button>
    );
}

export function DeleteButton({ onClick, title = 'Excluir', className = '', disabled = false }) {
    return (
        <button
            type="button"
            onClick={onClick}
            title={title}
            disabled={disabled}
            className={`p-1.5 rounded-lg hover:bg-red-100 transition-colors flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed ${className}`}
        >
            <Icon name="Trash2" size={ACTION_ICON_SIZE} color="#DC2626" className="flex-shrink-0" />
        </button>
    );
}

export function ViewButton({ onClick, title = 'Visualizar', className = '', disabled = false }) {
    return (
        <button
            type="button"
            onClick={onClick}
            title={title}
            disabled={disabled}
            className={`p-1.5 rounded-lg hover:bg-slate-100 transition-colors flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed ${className}`}
        >
            <Icon name="Eye" size={ACTION_ICON_SIZE} color="#475569" className="flex-shrink-0" />
        </button>
    );
}

/** Wrapper para agrupar os botões de ação em uma célula de tabela, sempre
 *  com flex-shrink-0 para preservar o tamanho independentemente do espaço
 *  disponível na linha. */
export function ActionButtonsGroup({ children, className = '' }) {
    return (
        <div className={`flex items-center gap-1 flex-shrink-0 whitespace-nowrap ${className}`}>
            {children}
        </div>
    );
}
