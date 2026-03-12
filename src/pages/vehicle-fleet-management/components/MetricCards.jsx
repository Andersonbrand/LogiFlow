import React from "react";
import Icon from "components/AppIcon";

export default function MetricCards({ vehicles, romaneios = [] }) {
    const total = vehicles?.length || 0;
    const available = vehicles?.filter((v) => v?.status === "Disponível")?.length || 0;
    const manutencao = vehicles?.filter((v) => v?.status === "Manutenção")?.length || 0;

    // Em Trânsito real: veículos com romaneio ativo
    const statusAtivo = ["Aguardando", "Carregando", "Em Trânsito"];
    const placasAtivas = new Set(
        romaneios
            .filter(r => statusAtivo.includes(r.status))
            .map(r => r.placa)
            .filter(Boolean)
    );
    // Contar por status do veículo OU por ter romaneio ativo
    const inTransit = vehicles?.filter(
        v => v?.status === "Em Trânsito" || placasAtivas.has(v?.placa)
    )?.length || 0;

    // Utilização média real: % de veículos em uso
    const emUso = vehicles?.filter(
        v => v?.status !== "Disponível" && v?.status !== "Manutenção"
    )?.length || 0;
    const avgUtil = total > 0 ? Math.round(((inTransit) / total) * 100) : 0;

    const cards = [
        {
            label: "Frota Total",
            value: total,
            icon: "Truck",
            color: "var(--color-primary)",
            bg: "#EFF6FF",
            sub: `${manutencao > 0 ? manutencao + " em manutenção" : "todos operacionais"}`,
        },
        {
            label: "Disponíveis",
            value: available,
            icon: "CheckCircle",
            color: "var(--color-success)",
            bg: "#ECFDF5",
            sub: "prontos para uso",
        },
        {
            label: "Em Trânsito",
            value: inTransit,
            icon: "Navigation",
            color: "var(--color-accent)",
            bg: "#FFFBEB",
            sub: inTransit > 0 ? `${placasAtivas.size} com romaneio ativo` : "nenhum ativo",
        },
        {
            label: "Utilização Média",
            value: `${avgUtil}%`,
            icon: "BarChart2",
            color: "#7C3AED",
            bg: "#F5F3FF",
            sub: `${inTransit} de ${total} veículos`,
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
                        className="text-2xl md:text-3xl font-heading font-bold mb-1"
                        style={{ color: "var(--color-text-primary)" }}
                    >
                        {card?.value}
                    </div>
                    {card?.sub && (
                        <p className="text-xs mb-2" style={{ color: "var(--color-muted-foreground)" }}>
                            {card.sub}
                        </p>
                    )}
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
