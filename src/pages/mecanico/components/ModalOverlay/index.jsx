import React from 'react';

export default function ModalOverlay({ children, onClose }) {
    return (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4 sm:pt-16"
            style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)' }}>
            <div className="bg-white w-full sm:rounded-2xl sm:max-w-lg sm:mx-4 rounded-t-2xl shadow-2xl max-h-[85vh] sm:max-h-[80vh] overflow-y-auto">
                {children}
            </div>
        </div>
    );
}
