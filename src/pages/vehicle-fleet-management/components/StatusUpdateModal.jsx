import React, { useState } from "react";
import Icon from "components/AppIcon";
import Button from "components/ui/Button";
import StatusBadge from "./StatusBadge";

const STATUS_OPTIONS = ["Disponível", "Em Trânsito", "Manutenção"];

export default function StatusUpdateModal({ isOpen, vehicle, onClose, onUpdate }) {
    const [selected, setSelected] = useState(vehicle?.status || "Disponível");

    if (!isOpen || !vehicle) return null;

    const handleSave = () => {
        onUpdate(vehicle?.id, selected);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)' } onClick={e => e.target === e.currentTarget && onClose()}>
            <div
                className="w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden"
                style={ backgroundColor: "var(--color-card)" }
            >
                <div
                    className="flex items-center justify-between px-5 py-4 border-b border-border"
                    style={{ backgroundColor: "#404040" }}
                >
                    <div className="flex items-center gap-2">
                        <Icon name="RefreshCw" size={18} color="#FFFFFF" strokeWidth={2} />
                        <h3 className="text-sm font-heading font-semibold text-white">Atualizar Status</h3>
                    </div>
                    <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/20">
                        <Icon name="X" size={16} color="#FFFFFF" strokeWidth={2} />
                    </button>
                </div>

                <div className="p-5">
                    <p className="text-sm mb-1" style={{ color: "var(--color-muted-foreground)" }}>Veículo</p>
                    <p className="font-data font-bold text-base mb-4" style={{ color: "var(--color-primary)" }}>
                        {vehicle?.placa} — {vehicle?.tipo}
                    </p>

                    <p className="text-sm font-caption font-medium mb-3" style={{ color: "var(--color-text-primary)" }}>
                        Selecionar novo status:
                    </p>

                    <div className="space-y-2 mb-5">
                        {STATUS_OPTIONS?.map((s) => (
                            <button
                                key={s}
                                onClick={() => setSelected(s)}
                                className="w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all duration-150"
                                style={{
                                    borderColor: selected === s ? "var(--color-primary)" : "var(--color-border)",
                                    backgroundColor: selected === s ? "#EFF6FF" : "var(--color-muted)",
                                }}
                            >
                                <StatusBadge status={s} />
                                {selected === s && <Icon name="Check" size={16} color="var(--color-primary)" strokeWidth={2.5} />}
                            </button>
                        ))}
                    </div>

                    <div className="flex gap-3">
                        <Button variant="outline" fullWidth onClick={onClose}>Cancelar</Button>
                        <Button variant="default" fullWidth onClick={handleSave} iconName="Check" iconPosition="left" iconSize={16}>
                            Confirmar
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}