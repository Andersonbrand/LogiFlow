import React from 'react';

import { AppIcon as Icon } from 'components';

export default function InfoCard({ icon, label, value, color }) {
    return (
        <div className="rounded-lg p-3 border" style={{ backgroundColor:'var(--color-muted)', borderColor:'var(--color-border)' }}>
            <div className="flex items-center gap-1.5 mb-1">
                <Icon name={icon} size={12} color="var(--color-muted-foreground)" />
                <span className="text-xs font-caption" style={{ color:'var(--color-muted-foreground)' }}>{label}</span>
            </div>
            <p className="text-sm font-medium font-data" style={{ color: color || 'var(--color-text-primary)' }}>{value}</p>
        </div>
    );
}
