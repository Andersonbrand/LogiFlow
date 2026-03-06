import React from "react";
import Icon from "components/AppIcon";
import Button from "components/ui/Button";

const TIPO_OPTIONS = ["Todos", "Caminhão", "Van", "Carreta"];
const STATUS_OPTIONS = ["Todos", "Disponível", "Em Trânsito", "Manutenção"];

export default function FilterBar({ filters, onChange, resultCount, onClear }) {
    const hasActive =
        filters?.tipo !== "Todos" || filters?.status !== "Todos" || filters?.search !== "";

    return (
        <div
            className="rounded-xl border border-border p-3 md:p-4 mb-4 shadow-card"
            style={{ backgroundColor: "var(--color-card)" }}
        >
            <div className="flex flex-col md:flex-row gap-3">
                {/* Search */}
                <div className="relative flex-1 min-w-0">
                    <Icon
                        name="Search"
                        size={16}
                        color="var(--color-muted-foreground)"
                        className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                    />
                    <input
                        type="text"
                        placeholder="Buscar por placa ou tipo..."
                        value={filters?.search}
                        onChange={(e) => onChange({ ...filters, search: e?.target?.value })}
                        className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-border outline-none transition-all"
                        style={{
                            backgroundColor: "var(--color-muted)",
                            color: "var(--color-text-primary)",
                            fontFamily: "Inter, sans-serif",
                        }}
                        onFocus={(e) => (e.target.style.borderColor = "var(--color-primary)")}
                        onBlur={(e) => (e.target.style.borderColor = "var(--color-border)")}
                    />
                </div>

                {/* Tipo */}
                <div className="flex items-center gap-2">
                    <label className="text-xs font-caption text-secondary-color whitespace-nowrap">Tipo:</label>
                    <select
                        value={filters?.tipo}
                        onChange={(e) => onChange({ ...filters, tipo: e?.target?.value })}
                        className="text-sm px-3 py-2 rounded-lg border border-border outline-none cursor-pointer"
                        style={{
                            backgroundColor: "var(--color-muted)",
                            color: "var(--color-text-primary)",
                            fontFamily: "Inter, sans-serif",
                        }}
                    >
                        {TIPO_OPTIONS?.map((t) => (
                            <option key={t} value={t}>{t}</option>
                        ))}
                    </select>
                </div>

                {/* Status */}
                <div className="flex items-center gap-2">
                    <label className="text-xs font-caption text-secondary-color whitespace-nowrap">Status:</label>
                    <select
                        value={filters?.status}
                        onChange={(e) => onChange({ ...filters, status: e?.target?.value })}
                        className="text-sm px-3 py-2 rounded-lg border border-border outline-none cursor-pointer"
                        style={{
                            backgroundColor: "var(--color-muted)",
                            color: "var(--color-text-primary)",
                            fontFamily: "Inter, sans-serif",
                        }}
                    >
                        {STATUS_OPTIONS?.map((s) => (
                            <option key={s} value={s}>{s}</option>
                        ))}
                    </select>
                </div>

                {hasActive && (
                    <Button variant="ghost" size="sm" iconName="X" iconPosition="left" iconSize={14} onClick={onClear}>
                        Limpar
                    </Button>
                )}
            </div>
            <div className="mt-2 text-xs font-caption" style={{ color: "var(--color-muted-foreground)" }}>
                {resultCount} veículo{resultCount !== 1 ? "s" : ""} encontrado{resultCount !== 1 ? "s" : ""}
            </div>
        </div>
    );
}