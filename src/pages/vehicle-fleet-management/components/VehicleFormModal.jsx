import React, { useState, useEffect } from "react";
import Icon from "components/AppIcon";
import Button from "components/ui/Button";
import Input from "components/ui/Input";

const TIPO_OPTIONS = ["Caminhão", "Van", "Carreta"];
const STATUS_OPTIONS = ["Disponível", "Em Trânsito", "Manutenção"];

const EMPTY_FORM = {
    placa: "",
    tipo: "Caminhão",
    capacidadePeso: "",
    capacidadeVolume: "",
    status: "Disponível",
};

const PLACA_REGEX = /^[A-Z]{3}-?\d{4}$|^[A-Z]{3}\d[A-Z]\d{2}$/i;

export default function VehicleFormModal({ isOpen, onClose, onSave, editVehicle }) {
    const [form, setForm] = useState(EMPTY_FORM);
    const [errors, setErrors] = useState({});

    useEffect(() => {
        if (editVehicle) {
            setForm({
                placa: editVehicle?.placa,
                tipo: editVehicle?.tipo,
                capacidadePeso: String(editVehicle?.capacidadePeso),
                capacidadeVolume: String(editVehicle?.capacidadeVolume),
                status: editVehicle?.status,
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
        if (!form?.capacidadeVolume || isNaN(Number(form?.capacidadeVolume)) || Number(form?.capacidadeVolume) <= 0)
            e.capacidadeVolume = "Informe uma capacidade de volume válida";
        return e;
    };

    const handleSubmit = (e) => {
        e?.preventDefault();
        const errs = validate();
        if (Object.keys(errs)?.length > 0) { setErrors(errs); return; }
        onSave({
            ...form,
            placa: form?.placa?.toUpperCase(),
            capacidadePeso: Number(form?.capacidadePeso),
            capacidadeVolume: Number(form?.capacidadeVolume),
        });
    };

    if (!isOpen) return null;

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
                {/* Header */}
                <div
                    className="flex items-center justify-between px-6 py-4 border-b border-border"
                    style={{ backgroundColor: "#404040" }}
                >
                    <div className="flex items-center gap-3">
                        <Icon name="Truck" size={20} color="#FFFFFF" strokeWidth={2} />
                        <h2 className="text-base font-heading font-semibold text-white">
                            {editVehicle ? "Editar Veículo" : "Cadastrar Veículo"}
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-white/20"
                    >
                        <Icon name="X" size={18} color="#FFFFFF" strokeWidth={2} />
                    </button>
                </div>

                {/* Body */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <Input
                        label="Placa"
                        type="text"
                        placeholder="Ex: ABC-1234 ou ABC1D23"
                        value={form?.placa}
                        onChange={(e) => setForm({ ...form, placa: e?.target?.value?.toUpperCase() })}
                        error={errors?.placa}
                        required
                    />

                    <div>
                        <label className="block text-sm font-caption font-medium mb-1.5" style={{ color: "var(--color-text-primary)" }}>
                            Tipo de Veículo <span style={{ color: "var(--color-destructive)" }}>*</span>
                        </label>
                        <select
                            value={form?.tipo}
                            onChange={(e) => setForm({ ...form, tipo: e?.target?.value })}
                            className="w-full px-3 py-2.5 text-sm rounded-lg border border-border outline-none"
                            style={{
                                backgroundColor: "var(--color-muted)",
                                color: "var(--color-text-primary)",
                                fontFamily: "Inter, sans-serif",
                            }}
                        >
                            {TIPO_OPTIONS?.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label="Capacidade Peso (kg)"
                            type="number"
                            placeholder="Ex: 10000"
                            value={form?.capacidadePeso}
                            onChange={(e) => setForm({ ...form, capacidadePeso: e?.target?.value })}
                            error={errors?.capacidadePeso}
                            required
                            min="1"
                        />
                        <Input
                            label="Capacidade Volume (m³)"
                            type="number"
                            placeholder="Ex: 40.5"
                            value={form?.capacidadeVolume}
                            onChange={(e) => setForm({ ...form, capacidadeVolume: e?.target?.value })}
                            error={errors?.capacidadeVolume}
                            required
                            min="0.1"
                            step="0.1"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-caption font-medium mb-1.5" style={{ color: "var(--color-text-primary)" }}>
                            Status
                        </label>
                        <select
                            value={form?.status}
                            onChange={(e) => setForm({ ...form, status: e?.target?.value })}
                            className="w-full px-3 py-2.5 text-sm rounded-lg border border-border outline-none"
                            style={{
                                backgroundColor: "var(--color-muted)",
                                color: "var(--color-text-primary)",
                                fontFamily: "Inter, sans-serif",
                            }}
                        >
                            {STATUS_OPTIONS?.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <Button variant="outline" fullWidth onClick={onClose} type="button">
                            Cancelar
                        </Button>
                        <Button variant="default" fullWidth type="submit" iconName="Save" iconPosition="left" iconSize={16}>
                            {editVehicle ? "Salvar Alterações" : "Cadastrar"}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}