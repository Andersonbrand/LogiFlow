import React from 'react';

// ─── Componentes locais reutilizáveis (mesmo padrão das outras páginas) ───────
export default function ModalOverlay({ children, onClose, sm }) {
    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)' }}>
            <div className={`bg-white rounded-2xl shadow-2xl flex flex-col ${sm ? 'w-full max-w-md' : 'w-full max-w-lg'}`}
                style={{ maxHeight: 'calc(100vh - 32px)' }}>
                {children}
            </div>
        </div>
    );
}
