import React, { useState, useRef, useEffect, useMemo } from 'react';

import { useAuth } from 'context/AuthContext';
import { useToast } from 'hooks/useToast';
import { useConfirm, AccessDeniedModal, NavigationBar, BreadcrumbTrail, Button, AppIcon as Icon, Toast } from 'components';
import { fetchVehicles, updateVehicle, createVehicle, deleteVehicle } from 'services/vehicleService';
import { fetchRomaneiosResumo } from 'services/romaneio';
import { exportVehiclesToExcel, downloadVehiclesTemplate } from 'utils/excel';

import MetricCards from './components/MetricCards';
import FilterBar from './components/FilterBar';
import VehicleTable from './components/VehicleTable';
import VehicleCards from './components/VehicleCards';
import CostsPanel from './components/CostsPanel';
import VehicleFormModal from './components/VehicleFormModal';
import StatusUpdateModal from './components/StatusUpdateModal';
import HistoryModal from './components/HistoryModal';
import TabMotoristas from './components/TabMotoristas';
import TabBonificacoes from './components/TabBonificacoes';

const EMPTY_FILTERS = { search: "", tipo: "Todos", status: "Todos" };

// ─── PÁGINA PRINCIPAL ─────────────────────────────────────────────────────────
export default function VehicleFleetManagement() {
    const { isAdmin, isOperador, profile } = useAuth();
    const { toast, showToast } = useToast();
    const { confirm, ConfirmDialog } = useConfirm();
    const [accessDenied, setAccessDenied] = useState(false);
    const [vehicles, setVehicles] = useState([]);
    const [romaneios, setRomaneios] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState(EMPTY_FILTERS);
    const [activeTab, setActiveTab] = useState('frota'); // 'frota' | 'motoristas' | 'bonus' | 'custos'
    const [formModal, setFormModal] = useState({ open: false, vehicle: null });
    const [statusModal, setStatusModal] = useState({ open: false, vehicle: null });
    const [historyModal, setHistoryModal] = useState({ open: false, vehicle: null });
    const importFileRef = useRef();

    useEffect(() => {
        (async () => {
            try {
                setLoading(true);
                const [data, roms] = await Promise.all([fetchVehicles(), fetchRomaneiosResumo()]);
                setVehicles(data); setRomaneios(roms);
            } catch (err) { showToast("Erro ao carregar: " + err.message, "error"); }
            finally { setLoading(false); }
        })();
    }, []); // eslint-disable-line

    const filtered = useMemo(() => vehicles?.filter(v => {
        const s = filters?.search?.toLowerCase();
        return (!s || v?.placa?.toLowerCase().includes(s) || v?.tipo?.toLowerCase().includes(s))
            && (filters?.tipo === "Todos" || v?.tipo === filters?.tipo)
            && (filters?.status === "Todos" || v?.status === filters?.status);
    }), [vehicles, filters]);

    const handleSave = async (data) => {
        if (!isAdmin()) { setAccessDenied(true); return; }
        try {
            if (formModal?.vehicle) {
                const updated = await updateVehicle(formModal.vehicle.id, data);
                setVehicles(prev => prev.map(v => v.id === updated.id ? updated : v));
                showToast(`Veículo ${data?.placa} atualizado.`);
            } else {
                const created = await createVehicle({ ...data, ultima_utilizacao: null });
                setVehicles(prev => [created, ...prev]);
                showToast(`Veículo ${data?.placa} cadastrado.`);
            }
            setFormModal({ open: false, vehicle: null });
        } catch (err) { showToast("Erro: " + err.message, "error"); }
    };

    const handleStatusUpdate = async (id, newStatus) => {
        if (!isAdmin()) { setAccessDenied(true); return; }
        try {
            const updated = await updateVehicle(id, { status: newStatus });
            setVehicles(prev => prev.map(v => v.id === id ? { ...v, status: updated.status } : v));
            showToast("Status atualizado.");
        } catch (err) { showToast("Erro: " + err.message, "error"); }
    };

    const handleDelete = async (id) => {
        if (!isAdmin()) { setAccessDenied(true); return; }
        const ok = await confirm({
            title: 'Excluir veículo?',
            message: 'Esta ação não pode ser desfeita. O veículo será removido permanentemente.',
            confirmLabel: 'Excluir',
            cancelLabel: 'Cancelar',
            variant: 'danger',
        });
        if (!ok) return;
        try { await deleteVehicle(id); setVehicles(prev => prev.filter(v => v.id !== id)); showToast("Veículo removido."); }
        catch (err) { showToast("Erro: " + err.message, "error"); }
    };

    const handleImportExcel = async (file) => {
        try {
            const { parseVehiclesFromFile } = await import("utils/excel");
            const parsed = await parseVehiclesFromFile(file);
            if (!parsed.length) { showToast("Nenhum veículo válido.", "error"); return; }
            let created = 0, errors = 0;
            for (const v of parsed) { try { await createVehicle(v); created++; } catch { errors++; } }
            const data = await fetchVehicles(); setVehicles(data);
            showToast(`${created} importado(s)${errors ? ` · ${errors} erro(s)` : ""}!`, errors ? "warning" : "success");
        } catch (err) { showToast("Erro: " + err.message, "error"); }
    };

    return (
        <div className="min-h-screen" style={{ backgroundColor: "var(--color-background)" }}>
            <AccessDeniedModal show={accessDenied} onClose={() => setAccessDenied(false)} />
            <NavigationBar />
            <main className="main-content">
                <div className="max-w-[1920px] mx-auto px-4 lg:px-8 py-6">

                    {/* Header */}
                    <div className="mb-6">
                        <BreadcrumbTrail className="mb-3" />
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            <div>
                                <h1 className="text-2xl md:text-3xl font-heading font-bold" style={{ color: "var(--color-text-primary)" }}>Gestão de Veículos</h1>
                                <p className="text-sm mt-1" style={{ color: "var(--color-muted-foreground)" }}>Frota e motoristas de caminhão</p>
                            </div>
                            {activeTab === 'frota' && (
                                <div className="flex flex-wrap items-center gap-2">
                                    <Button variant="outline" size="sm" iconName="FileDown" iconSize={14} onClick={() => { exportVehiclesToExcel(vehicles); showToast("Exportado!"); }}>Exportar</Button>
                                    <Button variant="outline" size="sm" iconName="FileUp"   iconSize={14} onClick={() => { if (!isAdmin()) { setAccessDenied(true); return; } importFileRef.current?.click(); }}>Importar</Button>
                                    <Button variant="ghost"   size="sm" iconName="FileSpreadsheet" iconSize={14} onClick={downloadVehiclesTemplate}>Modelo</Button>
                                    <Button variant="default" iconName="Plus" iconSize={16} onClick={() => { if (!isAdmin()) { setAccessDenied(true); return; } setFormModal({ open: true, vehicle: null }); }}>Cadastrar</Button>
                                    <input ref={importFileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
                                        onChange={e => { const f = e.target.files?.[0]; if (f) handleImportExcel(f); e.target.value=''; }} />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Tabs de página */}
                    <div className="flex border-b mb-6 overflow-x-auto" style={{ borderColor: 'var(--color-border)' }}>
                        {[
                            { id: 'frota',       label: 'Frota de Veículos', icon: 'Truck' },
                            { id: 'motoristas',  label: 'Motoristas',        icon: 'Users' },
                            { id: 'bonus',       label: 'Bônus Motoristas',  icon: 'Award' },
                            { id: 'custos',      label: 'Painel de Custos',  icon: 'Wallet' },
                        ].map(t => (
                            <button key={t.id} onClick={() => setActiveTab(t.id)}
                                className={`flex items-center gap-2 px-4 sm:px-5 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex-shrink-0 ${activeTab === t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                                <Icon name={t.icon} size={16} color="currentColor" />
                                {t.label}
                            </button>
                        ))}
                    </div>

                    {/* Aba Frota */}
                    {activeTab === 'frota' && (
                        <>
                            <MetricCards vehicles={vehicles} romaneios={romaneios} />
                            <FilterBar filters={filters} onChange={setFilters} resultCount={filtered?.length} onClear={() => setFilters(EMPTY_FILTERS)} />
                            <div className="hidden md:block">
                                <VehicleTable
                                    vehicles={filtered}
                                    onEdit={v => { if (!isAdmin()) { setAccessDenied(true); return; } setFormModal({ open: true, vehicle: v }); }}
                                    onStatusChange={v => { if (!isAdmin() && !isOperador()) { setAccessDenied(true); return; } setStatusModal({ open: true, vehicle: v }); }}
                                    onViewHistory={v => setHistoryModal({ open: true, vehicle: v })}
                                    onDelete={v => { if (!isAdmin()) { setAccessDenied(true); return; } handleDelete(v.id); }}
                                />
                            </div>
                            <div className="md:hidden">
                                <VehicleCards
                                    vehicles={filtered}
                                    onEdit={v => { if (!isAdmin()) { setAccessDenied(true); return; } setFormModal({ open: true, vehicle: v }); }}
                                    onStatusChange={v => { if (!isAdmin() && !isOperador()) { setAccessDenied(true); return; } setStatusModal({ open: true, vehicle: v }); }}
                                    onViewHistory={v => setHistoryModal({ open: true, vehicle: v })}
                                    onDelete={v => { if (!isAdmin()) { setAccessDenied(true); return; } handleDelete(v.id); }}
                                />
                            </div>
                        </>
                    )}

                    {/* Aba Motoristas */}
                    {activeTab === 'motoristas' && (
                        <TabMotoristas adminProfile={profile} />
                    )}

                    {/* Aba Bônus dos motoristas de caminhão */}
                    {activeTab === 'bonus' && (
                        <TabBonificacoes />
                    )}

                    {/* Aba Painel de Custos — abastecimentos e diárias de todos os caminhões/motoristas */}
                    {activeTab === 'custos' && (
                        <CostsPanel />
                    )}

                    <div className="mt-6 text-center text-xs" style={{ color: "var(--color-muted-foreground)" }}>
                        © {new Date().getFullYear()} LogiFlow — Gestão Logística
                    </div>
                </div>
            </main>

            <VehicleFormModal isOpen={formModal?.open} editVehicle={formModal?.vehicle} onClose={() => setFormModal({ open: false, vehicle: null })} onSave={handleSave} />
            <StatusUpdateModal isOpen={statusModal?.open} vehicle={statusModal?.vehicle} onClose={() => setStatusModal({ open: false, vehicle: null })} onUpdate={handleStatusUpdate} />
            <HistoryModal isOpen={historyModal?.open} vehicle={historyModal?.vehicle} onClose={() => setHistoryModal({ open: false, vehicle: null })} />
            <Toast toast={toast} />
            {ConfirmDialog}
        </div>
    );
}
