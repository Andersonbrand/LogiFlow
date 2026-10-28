import React from 'react';

import { AppIcon as Icon } from 'components';

export default function KpiCard({ label, value, sub, icon, color = '#1E3A5F', trend }) {
    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 sm:p-5 flex items-start gap-3 sm:gap-4">
            <div className="flex-shrink-0 w-9 h-9 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center" style={{ backgroundColor: color + '18' }}>
                <Icon name={icon} size={18} color={color} />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-xs font-caption text-slate-500 mb-0.5 leading-tight">{label}</p>
                <p className="text-lg sm:text-2xl font-bold font-data text-slate-800 leading-tight break-words">{value}</p>
                {sub && <p className="text-xs text-slate-400 mt-0.5 leading-tight">{sub}</p>}
                {trend !== undefined && (
                    <p className={`text-xs font-medium mt-1 ${trend >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {trend >= 0 ? '▲' : '▼'} {Math.abs(trend).toFixed(1)}%
                    </p>
                )}
            </div>
        </div>
    );
}
