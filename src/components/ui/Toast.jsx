import React from 'react';
import Icon from 'components/AppIcon';

const ICONS = { success: 'CheckCircle2', error: 'XCircle', warning: 'AlertTriangle', info: 'Info' };
const COLORS = {
    success: 'var(--color-success)',
    error: 'var(--color-destructive)',
    warning: 'var(--color-warning)',
    info: 'var(--color-primary)',
};

export default function Toast({ toast }) {
    if (!toast) return null;
    return (
        <div
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[500] flex items-center gap-2.5 px-5 py-3 rounded-xl shadow-modal text-white text-sm font-medium transition-all duration-300 animate-fade-in"
            style={{ backgroundColor: COLORS[toast.type] || COLORS.success, minWidth: 240, maxWidth: 'calc(100vw - 32px)' }}
        >
            <Icon name={ICONS[toast.type] || ICONS.success} size={17} color="#fff" />
            {toast.msg}
        </div>
    );
}
