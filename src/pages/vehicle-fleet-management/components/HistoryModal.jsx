import React, { useState, useEffect } from "react";
import Icon from "components/AppIcon";
import Button from "components/ui/Button";
import StatusBadge from "./StatusBadge";
import { fetchVehicleHistory } from "utils/vehicleService";

export default function HistoryModal({ isOpen, vehicle, onClose }) {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!isOpen || !vehicle) return;
        (async () => {
            setLoading(true);
            try {
                const data = await fetchVehicleHistory(vehicle.id);
                setHistory(data);
            } catch {
                setHistory([]);
            } finally {
                setLoading(false);
            }
        })();
    }, [isOpen, vehicle]);

    if (!isOpen || !vehicle) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div
                className="absolute inset-0"
                style={{ backgroundColor: "rgba(15,23,42,0.5)" }}
                onClick={onClose}
            />
            <div
                className="relative w-full max-w-lg rounded-2xl shadow-modal overflow-hidden"
                style={{ backgroundColor: "var(--color-card)" }}
            >
                <div
                    className="flex items-center justify-between px-5 py-4 border-b border-border"
                    style={{ backgroundColor: "#404040" }}
                >
                    <div className="flex items-center gap-2">
                        <Icon name="History" size={18} color="#FFFFFF" strokeWidth={2} />
                        <h3 className="text-sm font-heading font-semibold text-white">
                            Histórico — {vehicle?.placa}
                        </h3>
                    </div>
                    <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/20">
                        <Icon name="X" size={16} color="#FFFFFF" strokeWidth={2} />
                    </button>
                </div>

                <div className="p-5 max-h-[70vh] overflow-y-auto">
                    <div className="flex items-center gap-4 mb-5 p-3 rounded-xl" style={{ backgroundColor: "var(--color-muted)" }}>
                        <div>
                            <p className="text-xs font-caption" style={{ color: "var(--color-muted-foreground)" }}>Tipo</p>
                            <p className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>{vehicle?.tipo}</p>
                        </div>
                        <div>
                            <p className="text-xs font-caption" style={{ color: "var(--color-muted-foreground)" }}>Cap. Peso</p>
                            <p className="text-sm font-data font-medium" style={{ color: "var(--color-text-primary)" }}>
                                {vehicle?.capacidadePeso?.toLocaleString("pt-BR")} kg
                            </p>
                        </div>
                        <div>
                            <p className="text-xs font-caption" style={{ color: "var(--color-muted-foreground)" }}>Status Atual</p>
                            <StatusBadge status={vehicle?.status} />
                        </div>
                    </div>

                    <h4 className="text-sm font-caption font-semibold mb-3" style={{ color: "var(--color-text-primary)" }}>
                        Romaneios Recentes
                    </h4>

                    <div className="space-y-2">
                        {loading ? (<p className="text-sm text-center py-4" style={{color:"var(--color-muted-foreground)"}}>Carregando...</p>) : history.length === 0 ? (<p className="text-sm text-center py-4" style={{color:"var(--color-muted-foreground)"}}>Nenhum histórico encontrado.</p>) : history.map((h, i) => (
                            <div
                                key={i}
                                className="flex items-center justify-between p-3 rounded-xl border border-border"
                                style={{ backgroundColor: i % 2 === 0 ? "var(--color-card)" : "var(--color-muted)" }}
                            >
                                <div>
                                    <p className="text-sm font-data font-medium" style={{ color: "var(--color-primary)" }}>
                                        {h?.romaneio}
                                    </p>
                                    <p className="text-xs font-caption mt-0.5" style={{ color: "var(--color-muted-foreground)" }}>
                                        {h?.motorista} · {h?.rota}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs font-data" style={{ color: "var(--color-text-primary)" }}>
                                        {h?.peso?.toLocaleString("pt-BR")} kg
                                    </p>
                                    <p className="text-xs font-caption mt-0.5" style={{ color: "var(--color-muted-foreground)" }}>
                                        {h?.data}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="px-5 py-4 border-t border-border">
                    <Button variant="outline" fullWidth onClick={onClose}>Fechar</Button>
                </div>
            </div>
        </div>
    );
}