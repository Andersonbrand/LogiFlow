import React from 'react';

export default function ModalOverlay({ children, onClose, wide, sm }) {
    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)' }}>
            <div className={`bg-white rounded-2xl shadow-2xl flex flex-col ${wide ? 'w-full max-w-4xl' : sm ? 'w-full max-w-md' : 'w-full max-w-3xl'}`}
                style={{ maxHeight: 'calc(100vh - 32px)' }}>
                {children}
            </div>
        </div>
    );
}
