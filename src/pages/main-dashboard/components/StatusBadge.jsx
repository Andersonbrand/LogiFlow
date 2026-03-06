import React from "react";

const STATUS_CONFIG = {
    "Em Trânsito": { bg: "#DBEAFE", text: "#1D4ED8", dot: "#2563EB" },
    "Carregando": { bg: "#FEF9C3", text: "#92400E", dot: "#D97706" },
    "Finalizado": { bg: "#D1FAE5", text: "#065F46", dot: "#059669" },
    "Aguardando": { bg: "#F1F5F9", text: "#475569", dot: "#94A3B8" },
};

const StatusBadge = ({ status }) => {
    const config = STATUS_CONFIG?.[status] || STATUS_CONFIG?.["Aguardando"];
    return (
        <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-caption font-medium whitespace-nowrap"
            style={{ backgroundColor: config?.bg, color: config?.text }}
        >
            <span
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: config?.dot }}
            />
            {status}
        </span>
    );
};

export default StatusBadge;