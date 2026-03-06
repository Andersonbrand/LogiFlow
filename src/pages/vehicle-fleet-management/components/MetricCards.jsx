import React from "react";
import Icon from "components/AppIcon";

export default function MetricCards({ vehicles }) {
    const total = vehicles?.length;
    const available = vehicles?.filter((v) => v?.status === "Disponível")?.length;
    const inTransit = vehicles?.filter((v) => v?.status === "Em Trânsito")?.length;
    const avgUtil = total > 0 ? Math.round((inTransit / total) * 100) : 0;

    const cards = [
        {
            label: "Frota Total",
            value: total,
            icon: "Truck",
            color: "var(--color-primary)",
            bg: "#EFF6FF",
        },
        {
            label: "Disponíveis",
            value: available,
            icon: "CheckCircle",
            color: "var(--color-success)",
            bg: "#ECFDF5",
        },
        {
            label: "Em Trânsito",
            value: inTransit,
            icon: "Navigation",
            color: "var(--color-accent)",
            bg: "#FFFBEB",
        },
        {
            label: "Utilização Média",
            value: `${avgUtil}%`,
            icon: "BarChart2",
            color: "#7C3AED",
            bg: "#F5F3FF",
            isPercent: true,
            percent: avgUtil,
        },
    ];

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
            {cards?.map((card) => (
                <div
                    key={card?.label}
                    className="rounded-xl p-4 md:p-5 shadow-card border border-border"
                    style={{ backgroundColor: "var(--color-card)" }}
                >
                    <div className="flex items-center justify-between mb-3">
                        <span
                            className="text-xs md:text-sm font-caption font-medium"
                            style={{ color: "var(--color-muted-foreground)" }}
                        >
                            {card?.label}
                        </span>
                        <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: card?.bg }}
                        >
                            <Icon name={card?.icon} size={16} color={card?.color} strokeWidth={2} />
                        </div>
                    </div>
                    <div
                        className="text-2xl md:text-3xl font-heading font-bold mb-2"
                        style={{ color: "var(--color-text-primary)" }}
                    >
                        {card?.value}
                    </div>
                    {card?.isPercent && (
                        <div className="w-full h-1.5 rounded-full" style={{ backgroundColor: "var(--color-muted)" }}>
                            <div
                                className="h-1.5 rounded-full transition-all duration-500"
                                style={{ width: `${card?.percent}%`, backgroundColor: card?.color }}
                            />
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}