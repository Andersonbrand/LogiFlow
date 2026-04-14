import React, { useState, useEffect } from "react";
import Icon from "components/AppIcon";
import Button from "components/ui/Button";
import Input from "components/ui/Input";

const TIPO_OPTIONS = ["Caminhão", "Carreta"];
const STATUS_OPTIONS = ["Disponível", "Em Trânsito", "Manutenção"];

const EMPTY_FORM = {
    placa: "", tipo: "Caminhão", capacidadePeso: "",
    consumo_km: "", status: "Disponível",
};

const PLACA_REGEX = /^[A-Z]{3}-?\d{4}$|^[A-Z]{3}\d[A-Z]\d{2}$/i;

export default function VehicleFormModal({ isOpen, onClose, onSave, editVehicle }) {
    const [form, setForm] = useState(EMPTY_FORM);
    const [errors, setErrors] = useState({});

    useEffect(() => {
        if (editVehicle) {
            setForm({
                placa:          editVehicle?.placa || "",
                tipo:           editVehicle?.tipo === "Van" ? "Caminhão" : (editVehicle?.tipo || "Caminhão"),
                capacidadePeso: String(editVehicle?.capacidadePeso || ""),
                consumo_km:     editVehicle?.consumo_km ? String(editVehicle.consumo_km) : "",
                status:         editVehicle?.status || "Disponível",
            });
        } else {
            setForm(EMPTY_FORM);
        }
        setErrors({});
    }, [editVehicle, isOpen]);

    const validate = () => {
        const e = {};
        if (!form?.placa?.trim()) e.placa = "Placa é obrigatória";
        else if (!PLACA_REGEX?.test(form?.placa?.trim())) e.placa = "Formato inválido. Ex: ABC-1234 ou ABC1D23";
        if (!form?.capacidadePeso || isNaN(Number(form?.capacidadePeso)) || Number(form?.capacidadePeso) <= 0)
            e.capacidadePeso = "Informe uma capacidade de peso válida";
        return e;
    };

    const handleSubmit = (e) => {
        e?.preventDefault();
        const errs = validate();
        if (Object.keys(errs)?.length > 0) { setErrors(errs); return; }
        onSave({
            ...form,
            placa:          form?.placa?.toUpperCase(),
            capacidadePeso: Number(form?.capacidadePeso),
            consumo_km:     form?.consumo_km ? Number(form.consumo_km) : null,
        });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)' } onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden" style={ backgroundColor: "var(--color-card)" }>

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-border" style={{ backgroundColor: "#404040" }}>
                    <div className="flex items-center gap-3">
                        <Icon name="Truck" size={20} color="#FFFFFF" strokeWidth={2} />
                        <h2 className="text-base font-heading font-semibold text-white">
                            {editVehicle ? "Editar Veículo" : "Cadastrar Veículo"}
                        </h2>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-white/20">
                        <Icon name="X" size={18} color="#FFFFFF" strokeWidth={2} />
                    </button>
                </div>

                {/* Body */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <Input label="Placa" type="text" placeholder="Ex: ABC-1234 ou ABC1D23"
                        value={form?.placa}
                        onChange={(e) => setForm({ ...form, placa: e?.target?.value?.toUpperCase() })}
                        error={errors?.placa} required />

                    <div>
                        <label className="block text-sm font-caption font-medium mb-1.5" style={{ color: "var(--color-text-primary)" }}>
                            Tipo de Veículo <span style={{ color: "var(--color-destructive)" }}>*</span>
                        </label>
                        <select value={form?.tipo} onChange={(e) => setForm({ ...form, tipo: e?.target?.value })}
                            className="w-full px-3 py-2.5 text-sm rounded-lg border border-border outline-none"
                            style={{ backgroundColor: "var(--color-muted)", color: "var(--color-text-primary)" }}>
                            {TIPO_OPTIONS?.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>

                    <div>
                        <Input label="Capacidade Peso (kg)" type="number" placeholder="Ex: 10000"
                            value={form?.capacidadePeso}
                            onChange={(e) => setForm({ ...form, capacidadePeso: e?.target?.value })}
                            error={errors?.capacidadePeso} required min="1" />
                    </div>

                    {/* Consumo km/l */}
                    <div>
                        <label className="block text-sm font-caption font-medium mb-1.5" style={{ color: "var(--color-text-primary)" }}>
                            Consumo médio (km/l)
                        </label>
                        <div className="relative">
                            <input type="number" min="0.1" step="0.1" placeholder="Ex: 8.5"
                                value={form?.consumo_km}
                                onChange={(e) => setForm({ ...form, consumo_km: e?.target?.value })}
                                className="w-full px-3 pr-14 py-2.5 text-sm rounded-lg border border-border outline-none"
                                style={{ backgroundColor: "var(--color-muted)", color: "var(--color-text-primary)" }} />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-caption" style={{ color: "var(--color-muted-foreground)" }}>km/l</span>
                        </div>
                        <p className="text-xs mt-1 font-caption" style={{ color: "var(--color-muted-foreground)" }}>
                            Usado para estimar consumo de combustível nos romaneios
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-caption font-medium mb-1.5" style={{ color: "var(--color-text-primary)" }}>Status</label>
                        <select value={form?.status} onChange={(e) => setForm({ ...form, status: e?.target?.value })}
                            className="w-full px-3 py-2.5 text-sm rounded-lg border border-border outline-none"
                            style={{ backgroundColor: "var(--color-muted)", color: "var(--color-text-primary)" }}>
                            {STATUS_OPTIONS?.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <Button variant="outline" fullWidth onClick={onClose} type="button">Cancelar</Button>
                        <Button variant="default" fullWidth type="submit" iconName="Save" iconPosition="left" iconSize={16}>
                            {editVehicle ? "Salvar Alterações" : "Cadastrar"}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
