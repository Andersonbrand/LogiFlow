import React, { useState, useMemo, useEffect } from "react";
import NavigationBar from "components/ui/NavigationBar";
import BreadcrumbTrail from "components/ui/BreadcrumbTrail";
import QuickActionPanel from "components/ui/QuickActionPanel";
import Icon from "components/AppIcon";
import Button from "components/ui/Button";
import MetricCards from "./components/MetricCards";
import FilterBar from "./components/FilterBar";
import VehicleTable from "./components/VehicleTable";
import VehicleCards from "./components/VehicleCards";
import VehicleFormModal from "./components/VehicleFormModal";
import StatusUpdateModal from "./components/StatusUpdateModal";
import HistoryModal from "./components/HistoryModal";
import { exportVehiclesToExcel, parseVehiclesFromFile, downloadVehiclesTemplate } from "utils/excelUtils";
import { useAuth } from "utils/AuthContext";
import AccessDeniedModal from "components/ui/AccessDeniedModal";
import {
  fetchVehicles,
  createVehicle,
  updateVehicle,
  deleteVehicle,
} from "utils/vehicleService";
import { fetchRomaneios } from "utils/romaneioService";


const EMPTY_FILTERS = { search: "", tipo: "Todos", status: "Todos" };

export default function VehicleFleetManagement() {
    const { isAdmin } = useAuth();
    const [accessDenied, setAccessDenied] = useState(false);
    const [vehicles, setVehicles] = useState([]);
    const [romaneios, setRomaneios] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState(EMPTY_FILTERS);
    const [formModal, setFormModal] = useState({ open: false, vehicle: null });
    const [statusModal, setStatusModal] = useState({ open: false, vehicle: null });
    const [historyModal, setHistoryModal] = useState({ open: false, vehicle: null });
    const [toast, setToast] = useState(null);

    const showToast = (msg, type = "success") => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    // ─── Load from Supabase ───────────────────────────────────────────────────
    useEffect(() => {
        (async () => {
            try {
                setLoading(true);
                const [data, roms] = await Promise.all([fetchVehicles(), fetchRomaneios()]);
                setVehicles(data);
                setRomaneios(roms);
            } catch (err) {
                showToast("Erro ao carregar veículos: " + err.message, "error");
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const filtered = useMemo(() => {
        return vehicles?.filter((v) => {
            const matchSearch =
                filters?.search === "" ||
                v?.placa?.toLowerCase()?.includes(filters?.search?.toLowerCase()) ||
                v?.tipo?.toLowerCase()?.includes(filters?.search?.toLowerCase());
            const matchTipo = filters?.tipo === "Todos" || v?.tipo === filters?.tipo;
            const matchStatus = filters?.status === "Todos" || v?.status === filters?.status;
            return matchSearch && matchTipo && matchStatus;
        });
    }, [vehicles, filters]);

    const handleSave = async (data) => {
        if (!isAdmin()) { setAccessDenied(true); return; }
        try {
            if (formModal?.vehicle) {
                const updated = await updateVehicle(formModal.vehicle.id, data);
                setVehicles((prev) => prev.map((v) => (v.id === updated.id ? updated : v)));
                showToast(`Veículo ${data?.placa} atualizado com sucesso.`);
            } else {
                const created = await createVehicle({ ...data, ultima_utilizacao: null });
                setVehicles((prev) => [created, ...prev]);
                showToast(`Veículo ${data?.placa} cadastrado com sucesso.`);
            }
            setFormModal({ open: false, vehicle: null });
        } catch (err) {
            showToast("Erro ao salvar veículo: " + err.message, "error");
        }
    };

    const handleStatusUpdate = async (id, newStatus) => {
        if (!isAdmin()) { setAccessDenied(true); return; }
        try {
            const updated = await updateVehicle(id, { status: newStatus });
            setVehicles((prev) => prev.map((v) => (v.id === id ? { ...v, status: updated.status } : v)));
            showToast("Status atualizado com sucesso.");
        } catch (err) {
            showToast("Erro ao atualizar status: " + err.message, "error");
        }
    };

    const handleDelete = async (id) => {
        if (!isAdmin()) { setAccessDenied(true); return; }
        try {
            await deleteVehicle(id);
            setVehicles((prev) => prev.filter((v) => v.id !== id));
            showToast("Veículo removido com sucesso.", "success");
        } catch (err) {
            showToast("Erro ao remover veículo: " + err.message, "error");
        }
    };

    const handleExportExcel = () => {
        exportVehiclesToExcel(vehicles);
        showToast("Frota exportada como Excel!");
    };

    const handleImportExcel = async (file) => {
        try {
            const parsed = await parseVehiclesFromFile(file);
            if (!parsed.length) { showToast("Nenhum veículo válido encontrado.", "error"); return; }
            let created = 0, errors = 0;
            for (const v of parsed) {
                try { await createVehicle(v); created++; } catch { errors++; }
            }
            const data = await fetchVehicles();
            setVehicles(data);
            showToast(`${created} veículo(s) importado(s)${errors ? ` · ${errors} erro(s)` : ""}!`, errors ? "warning" : "success");
        } catch (err) {
            showToast("Erro na importação: " + err.message, "error");
        }
    };

    const importFileRef = React.useRef();

    return (
        <div className="min-h-screen" style={{ backgroundColor: "var(--color-background)" }}>
            <AccessDeniedModal show={accessDenied} onClose={() => setAccessDenied(false)} />
            <NavigationBar />
            <main className="main-content">
                <div className="max-w-screen-2xl mx-auto px-4 tab:px-6 lg:px-8 py-6">
                    {/* Page Header */}
                    <div className="mb-6">
                        <BreadcrumbTrail className="mb-3" />
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            <div>
                                <h1
                                    className="text-2xl md:text-3xl font-heading font-bold"
                                    style={{ color: "var(--color-text-primary)" }}
                                >
                                    Gestão de Veículos
                                </h1>
                                <p className="text-sm mt-1" style={{ color: "var(--color-muted-foreground)" }}>
                                    Gerencie a frota, capacidades e disponibilidade dos veículos
                                </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <Button variant="outline" size="sm" iconName="FileDown" iconSize={14}
                                    onClick={handleExportExcel} title="Exportar frota como Excel">
                                    Exportar Excel
                                </Button>
                                <Button variant="outline" size="sm" iconName="FileUp" iconSize={14}
                                    onClick={() => { if (!isAdmin()) { setAccessDenied(true); return; } importFileRef.current?.click(); }} title="Importar veículos de Excel">
                                    Importar Excel
                                </Button>
                                <Button variant="ghost" size="sm" iconName="FileSpreadsheet" iconSize={14}
                                    onClick={downloadVehiclesTemplate} title="Baixar modelo Excel">
                                    Modelo
                                </Button>
                                <Button variant="default" iconName="Plus" iconSize={16}
                                    onClick={() => { if (!isAdmin()) { setAccessDenied(true); return; } setFormModal({ open: true, vehicle: null }); }}>
                                    Cadastrar Veículo
                                </Button>
                                <input ref={importFileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
                                    onChange={e => { const f = e.target.files?.[0]; if (f) handleImportExcel(f); e.target.value=''; }} />
                            </div>
                        </div>
                    </div>

                    {/* Metric Cards */}
                    <MetricCards vehicles={vehicles} romaneios={romaneios} />

                    {/* Filter Bar */}
                    <FilterBar
                        filters={filters}
                        onChange={setFilters}
                        resultCount={filtered?.length}
                        onClear={() => setFilters(EMPTY_FILTERS)}
                    />

                    {/* Table (desktop) */}
                    <div className="hidden md:block">
                        <VehicleTable
                            vehicles={filtered}
                            onEdit={(v) => { if (!isAdmin()) { setAccessDenied(true); return; } setFormModal({ open: true, vehicle: v }); }}
                            onStatusChange={(v) => { if (!isAdmin()) { setAccessDenied(true); return; } setStatusModal({ open: true, vehicle: v }); }}
                            onViewHistory={(v) => setHistoryModal({ open: true, vehicle: v })}
                        />
                    </div>

                    {/* Cards (mobile) */}
                    <div className="md:hidden">
                        <VehicleCards
                            vehicles={filtered}
                            onEdit={(v) => { if (!isAdmin()) { setAccessDenied(true); return; } setFormModal({ open: true, vehicle: v }); }}
                            onStatusChange={(v) => { if (!isAdmin()) { setAccessDenied(true); return; } setStatusModal({ open: true, vehicle: v }); }}
                            onViewHistory={(v) => setHistoryModal({ open: true, vehicle: v })}
                        />
                    </div>

                    {/* Footer */}
                    <div className="mt-6 text-center text-xs font-caption" style={{ color: "var(--color-muted-foreground)" }}>
                        © {new Date()?.getFullYear()} LogiFlow — Gestão Logística. Todos os direitos reservados.
                    </div>
                </div>
            </main>
            {/* Modals */}
            <VehicleFormModal
                isOpen={formModal?.open}
                editVehicle={formModal?.vehicle}
                onClose={() => setFormModal({ open: false, vehicle: null })}
                onSave={handleSave}
            />
            <StatusUpdateModal
                isOpen={statusModal?.open}
                vehicle={statusModal?.vehicle}
                onClose={() => setStatusModal({ open: false, vehicle: null })}
                onUpdate={handleStatusUpdate}
            />
            <HistoryModal
                isOpen={historyModal?.open}
                vehicle={historyModal?.vehicle}
                onClose={() => setHistoryModal({ open: false, vehicle: null })}
            />
            {/* Toast */}
            {toast && (
                <div
                    className="fixed top-6 left-1/2 -translate-x-1/2 z-[300] flex items-center gap-3 px-5 py-3 rounded-xl shadow-modal text-sm font-caption font-medium"
                    style={{
                        backgroundColor: toast?.type === "success" ? "var(--color-success)" : "var(--color-destructive)",
                        color: "#FFFFFF",
                        minWidth: "260px",
                        maxWidth: "90vw",
                    }}
                >
                    <Icon name={toast?.type === "success" ? "CheckCircle" : "AlertCircle"} size={18} color="#FFFFFF" strokeWidth={2} />
                    {toast?.msg}
                </div>
            )}
        </div>
    );
}