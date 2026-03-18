import React from "react";
import Icon from "components/AppIcon";
import StatusBadge from "./StatusBadge";

export default function VehicleCards({ vehicles, onEdit, onStatusChange, onViewHistory, onViewData }) {
    if (vehicles?.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16">
                <Icon name="Truck" size={48} color="var(--color-muted-foreground)" strokeWidth={1.5} />
                <p className="mt-4 text-base font-medium" style={{ color: "var(--color-muted-foreground)" }}>
                    Nenhum veículo encontrado
                </p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 gap-3">
            {vehicles?.map((v) => (
                <div
                    key={v?.id}
                    className="rounded-xl border border-border p-4 shadow-card"
                    style={{ backgroundColor: "var(--color-card)" }}
                >
                    <div className="flex items-start justify-between mb-3">
                        <div>
                            <span
                                className="font-data font-bold text-base"
                                style={{ color: "var(--color-primary)" }}
                            >
                                {v?.placa}
                            </span>
                            <div className="flex items-center gap-1.5 mt-0.5">
                                <Icon name={v?.tipo === "Van" ? "Package" : "Truck"} size={13} color="var(--color-muted-foreground)" strokeWidth={2} />
                                <span className="text-sm" style={{ color: "var(--color-muted-foreground)" }}>{v?.tipo}</span>
                            </div>
                        </div>
                        <StatusBadge status={v?.status} />
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-3">
                        <div className="rounded-lg p-2.5" style={{ backgroundColor: "var(--color-muted)" }}>
                            <p className="text-xs font-caption" style={{ color: "var(--color-muted-foreground)" }}>Cap. Peso</p>
                            <p className="font-data font-semibold text-sm mt-0.5" style={{ color: "var(--color-text-primary)" }}>
                                {v?.capacidadePeso?.toLocaleString("pt-BR")} kg
                            </p>
                        </div>
                        <div className="rounded-lg p-2.5" style={{ backgroundColor: "var(--color-muted)" }}>
                            <p className="text-xs font-caption" style={{ color: "var(--color-muted-foreground)" }}>Cap. Volume</p>
                            <p className="font-data font-semibold text-sm mt-0.5" style={{ color: "var(--color-text-primary)" }}>
                                {v?.capacidadeVolume?.toLocaleString("pt-BR", { minimumFractionDigits: 1 })} m³
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center justify-between">
                        <span className="text-xs font-caption" style={{ color: "var(--color-muted-foreground)" }}>
                            Última utilização: {v?.ultimaUtilizacao}
                        </span>
                        <div className="flex items-center gap-1">
                            <button
                                title="Combustível · Checklist · Diárias"
                                onClick={() => onViewData?.(v)}
                                className="w-8 h-8 rounded-lg flex items-center justify-center"
                                style={{ color: "#059669", backgroundColor: "#ECFDF5" }}
                            >
                                <Icon name="BarChart2" size={14} color="currentColor" strokeWidth={2} />
                            </button>
                            <button
                                title="Editar"
                                onClick={() => onEdit(v)}
                                className="w-8 h-8 rounded-lg flex items-center justify-center"
                                style={{ color: "var(--color-primary)", backgroundColor: "#EFF6FF" }}
                            >
                                <Icon name="Pencil" size={14} color="currentColor" strokeWidth={2} />
                            </button>
                            <button
                                title="Histórico"
                                onClick={() => onViewHistory(v)}
                                className="w-8 h-8 rounded-lg flex items-center justify-center"
                                style={{ color: "#7C3AED", backgroundColor: "#F5F3FF" }}
                            >
                                <Icon name="History" size={14} color="currentColor" strokeWidth={2} />
                            </button>
                            <button
                                title="Status"
                                onClick={() => onStatusChange(v)}
                                className="w-8 h-8 rounded-lg flex items-center justify-center"
                                style={{ color: "var(--color-accent)", backgroundColor: "#FFFBEB" }}
                            >
                                <Icon name="RefreshCw" size={14} color="currentColor" strokeWidth={2} />
                            </button>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}