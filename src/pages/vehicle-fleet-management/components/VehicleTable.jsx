import React from "react";
import Icon from "components/AppIcon";

import StatusBadge from "./StatusBadge";

export default function VehicleTable({ vehicles, onEdit, onStatusChange, onViewHistory }) {
    if (vehicles?.length === 0) {
        return (
            <div
                className="rounded-xl border border-border flex flex-col items-center justify-center py-16 shadow-card"
                style={{ backgroundColor: "var(--color-card)" }}
            >
                <Icon name="Truck" size={48} color="var(--color-muted-foreground)" strokeWidth={1.5} />
                <p className="mt-4 text-base font-medium" style={{ color: "var(--color-muted-foreground)" }}>
                    Nenhum veículo encontrado
                </p>
                <p className="text-sm mt-1" style={{ color: "var(--color-muted-foreground)" }}>
                    Ajuste os filtros ou cadastre um novo veículo
                </p>
            </div>
        );
    }

    return (
        <div
            className="rounded-xl border border-border overflow-hidden shadow-card"
            style={{ backgroundColor: "var(--color-card)" }}
        >
            <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] border-collapse">
                    <thead>
                        <tr style={{ backgroundColor: "#404040" }}>
                            {["Placa", "Tipo de Veículo", "Cap. Peso (kg)", "Cap. Volume (m³)", "Status", "Última Utilização", "Ações"]?.map(
                                (col) => (
                                    <th
                                        key={col}
                                        className="px-4 py-3 text-left text-xs font-caption font-semibold uppercase tracking-wider whitespace-nowrap"
                                        style={{ color: "#FFFFFF" }}
                                    >
                                        {col}
                                    </th>
                                )
                            )}
                        </tr>
                    </thead>
                    <tbody>
                        {vehicles?.map((v, idx) => (
                            <tr
                                key={v?.id}
                                className="border-t border-border transition-colors duration-150 hover:brightness-95"
                                style={{ backgroundColor: idx % 2 === 0 ? "var(--color-card)" : "var(--color-muted)" }}
                            >
                                <td className="px-4 py-3">
                                    <span
                                        className="font-data font-medium text-sm"
                                        style={{ color: "var(--color-primary)" }}
                                    >
                                        {v?.placa}
                                    </span>
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                        <Icon
                                            name={v?.tipo === "Van" ? "Package" : "Truck"}
                                            size={15}
                                            color="var(--color-muted-foreground)"
                                            strokeWidth={2}
                                        />
                                        <span className="text-sm" style={{ color: "var(--color-text-primary)" }}>
                                            {v?.tipo}
                                        </span>
                                    </div>
                                </td>
                                <td className="px-4 py-3">
                                    <span className="font-data text-sm" style={{ color: "var(--color-text-primary)" }}>
                                        {v?.capacidadePeso?.toLocaleString("pt-BR")}
                                    </span>
                                </td>
                                <td className="px-4 py-3">
                                    <span className="font-data text-sm" style={{ color: "var(--color-text-primary)" }}>
                                        {v?.capacidadeVolume?.toLocaleString("pt-BR", { minimumFractionDigits: 1 })}
                                    </span>
                                </td>
                                <td className="px-4 py-3">
                                    <StatusBadge status={v?.status} />
                                </td>
                                <td className="px-4 py-3">
                                    <span className="text-sm font-caption" style={{ color: "var(--color-muted-foreground)" }}>
                                        {v?.ultimaUtilizacao}
                                    </span>
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-1">
                                        <button
                                            title="Editar veículo"
                                            onClick={() => onEdit(v)}
                                            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors duration-150 hover:bg-blue-50"
                                            style={{ color: "var(--color-primary)" }}
                                        >
                                            <Icon name="Pencil" size={15} color="currentColor" strokeWidth={2} />
                                        </button>
                                        <button
                                            title="Ver histórico"
                                            onClick={() => onViewHistory(v)}
                                            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors duration-150 hover:bg-purple-50"
                                            style={{ color: "#7C3AED" }}
                                        >
                                            <Icon name="History" size={15} color="currentColor" strokeWidth={2} />
                                        </button>
                                        <button
                                            title="Atualizar status"
                                            onClick={() => onStatusChange(v)}
                                            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors duration-150 hover:bg-amber-50"
                                            style={{ color: "var(--color-accent)" }}
                                        >
                                            <Icon name="RefreshCw" size={15} color="currentColor" strokeWidth={2} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}