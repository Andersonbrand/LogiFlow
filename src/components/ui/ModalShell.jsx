import React from 'react';
import Icon from 'components/AppIcon';

// Cada página do LogiFlow definia sua própria versão local (idêntica) de
// ModalOverlay/ModalHeader. Este arquivo centraliza uma versão para uso em
// componentes compartilhados (que não têm acesso às versões locais da página).
export function ModalOverlay({ children, onClose, wide, sm }) {
    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)' }}>
            <div className={`bg-white rounded-2xl shadow-2xl flex flex-col ${wide ? 'w-full max-w-4xl' : sm ? 'w-full max-w-md' : 'w-full max-w-2xl'}`}
                style={{ maxHeight: 'calc(100vh - 32px)' }}>
                {children}
            </div>
        </div>
    );
}

export function ModalHeader({ title, icon, onClose }) {
    return (
        <div className="flex items-center justify-between p-5 border-b flex-shrink-0" style={{ borderColor: 'var(--color-border)' }}>
            <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#EFF6FF' }}>
                    <Icon name={icon} size={18} color="#1D4ED8" />
                </div>
                <h2 className="font-heading font-bold text-lg" style={{ color: 'var(--color-text-primary)' }}>{title}</h2>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                <Icon name="X" size={18} color="var(--color-muted-foreground)" />
            </button>
        </div>
    );
}
