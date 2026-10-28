import React from 'react';

export default function ChartCard({ title, children, height = 220 }) {
    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <p className="text-sm font-semibold text-slate-700 mb-4">{title}</p>
            <div style={{ height }}>{children}</div>
        </div>
    );
}
