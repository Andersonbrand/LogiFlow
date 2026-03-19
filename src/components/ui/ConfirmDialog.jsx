import React from 'react';
import Icon from 'components/AppIcon';

/**
 * ConfirmDialog — substitui window.confirm() com um card visual no centro do app.
 *
 * Uso:
 *   const { confirm, ConfirmDialog } = useConfirm();
 *   ...
 *   await confirm({ title: 'Excluir despesa?', message: 'Esta ação não pode ser desfeita.', variant: 'danger' })
 *   ...
 *   return <> ... <ConfirmDialog /> </>
 */

import { useState, useCallback, useRef } from 'react';

export function useConfirm() {
    const [state, setState] = useState({ open: false, title: '', message: '', variant: 'danger', confirmLabel: 'Confirmar', cancelLabel: 'Cancelar' });
    const resolveRef = useRef(null);

    const confirm = useCallback((opts) => {
        return new Promise((resolve) => {
            resolveRef.current = resolve;
            setState({
                open: true,
                title:        opts.title        || 'Confirmar ação',
                message:      opts.message      || 'Tem certeza que deseja continuar?',
                variant:      opts.variant      || 'danger',   // 'danger' | 'warning' | 'info'
                confirmLabel: opts.confirmLabel || 'Confirmar',
                cancelLabel:  opts.cancelLabel  || 'Cancelar',
                icon:         opts.icon         || null,
            });
        });
    }, []);

    const handleConfirm = () => { setState(s => ({ ...s, open: false })); resolveRef.current?.(true); };
    const handleCancel  = () => { setState(s => ({ ...s, open: false })); resolveRef.current?.(false); };

    const VARIANTS = {
        danger:  { bg: '#FEF2F2', border: '#FECACA', icon: 'Trash2',        iconBg: '#FEE2E2', iconColor: '#DC2626', btnBg: '#DC2626', btnHover: '#B91C1C' },
        warning: { bg: '#FFFBEB', border: '#FDE68A', icon: 'AlertTriangle',  iconBg: '#FEF3C7', iconColor: '#D97706', btnBg: '#D97706', btnHover: '#B45309' },
        info:    { bg: '#EFF6FF', border: '#BFDBFE', icon: 'Info',           iconBg: '#DBEAFE', iconColor: '#1D4ED8', btnBg: '#1D4ED8', btnHover: '#1E40AF' },
    };

    const v = VARIANTS[state.variant] || VARIANTS.danger;
    const iconName = state.icon || v.icon;

    const ConfirmDialog = state.open ? (
        <div
            className="fixed inset-0 z-[200] flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)' }}
            onClick={handleCancel}
        >
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in"
                style={{ border: `1px solid ${v.border}` }}
                onClick={e => e.stopPropagation()}
            >
                {/* Topo colorido */}
                <div className="px-6 pt-6 pb-4 flex flex-col items-center text-center"
                    style={{ backgroundColor: v.bg }}>
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 shadow-sm"
                        style={{ backgroundColor: v.iconBg }}>
                        <Icon name={iconName} size={26} color={v.iconColor} />
                    </div>
                    <h3 className="font-heading font-bold text-lg mb-1.5"
                        style={{ color: 'var(--color-text-primary)' }}>
                        {state.title}
                    </h3>
                    {state.message && (
                        <p className="text-sm leading-relaxed" style={{ color: 'var(--color-muted-foreground)' }}>
                            {state.message}
                        </p>
                    )}
                </div>

                {/* Botões */}
                <div className="flex gap-3 p-5">
                    <button
                        onClick={handleCancel}
                        className="flex-1 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-colors hover:bg-gray-50"
                        style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}>
                        {state.cancelLabel}
                    </button>
                    <button
                        onClick={handleConfirm}
                        className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors"
                        style={{ backgroundColor: v.btnBg }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = v.btnHover}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = v.btnBg}
                    >
                        {state.confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    ) : null;

    return { confirm, ConfirmDialog };
}

export default useConfirm;
