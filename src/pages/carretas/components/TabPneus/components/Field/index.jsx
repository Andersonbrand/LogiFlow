import React from 'react';

export default function Field({ label, required, children }) {
    return (
        <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
                {label}{required && <span className="text-red-500"> *</span>}
            </label>
            {children}
        </div>
    );
}
