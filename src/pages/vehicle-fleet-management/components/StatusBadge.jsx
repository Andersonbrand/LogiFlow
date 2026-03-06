import React from "react";

const STATUS_CONFIG = {
    "Disponível": { bg: "#ECFDF5", color: "#059669", dot: "#059669" },
    "Em Trânsito": { bg: "#FFFBEB", color: "#D97706", dot: "#D97706" },
    "Manutenção": { bg: "#FEF2F2", color: "#DC2626", dot: "#DC2626" },
};

export default function StatusBadge({ status }) {
    const cfg = STATUS_CONFIG?.[status] || { bg: "#F1F5F9", color: "#6B7280", dot: "#6B7280" };
    return (
        <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-caption font-medium whitespace-nowrap"
            style={{ backgroundColor: cfg?.bg, color: cfg?.color }}
        >
            <span
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: cfg?.dot }}
            />
            {status}
        </span>
    );
}