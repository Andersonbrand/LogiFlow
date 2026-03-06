import React, { useState, useEffect, useMemo, useCallback } from "react";
import { fetchRomaneios } from "utils/romaneioService";
import { fetchVehicles } from "utils/vehicleService";
import { fetchMaintenanceAlerts, resolveMaintenanceAlert, createMaintenanceAlert } from "utils/userService";
import { useNavigate } from "react-router-dom";
import { useAuth } from "utils/AuthContext";

import NavigationBar from "components/ui/NavigationBar";
import BreadcrumbTrail from "components/ui/BreadcrumbTrail";
import QuickActionPanel from "components/ui/QuickActionPanel";
import Button from "components/ui/Button";
import Icon from "components/AppIcon";
import Toast from "components/ui/Toast";
import { useToast } from "utils/useToast";

import RomaneiosTable from "./components/RomaneiosTable";
import AISuggestionsPanel from "./components/AISuggestionsP";
import FleetUtilizationChart from "./components/FleetUtilizationChart";

// ─── Metric Card ──────────────────────────────────────────────────────────────
function MetricCard({ label, value, unit, icon, bg, iconColor, sub, onClick }) {
    return (
        <div onClick={onClick} className={`bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex items-center gap-4 ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}>
            <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: bg }}>
                <Icon name={icon} size={24} color={iconColor} />
            </div>
            <div>
                <p className="text-xs font-caption text-slate-500">{label}</p>
                <p className="text-2xl font-bold font-data text-slate-800">{value}<span className="text-sm font-normal text-slate-500 ml-1">{unit}</span></p>
                {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
            </div>
        </div>
    );
}

// ─── Maintenance Alert Card ───────────────────────────────────────────────────
function MaintenanceCard({ alerts, onResolve }) {
    if (!alerts.length) return null;
    return (
        <div className="bg-white rounded-lg border border-orange-200 shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-orange-100" style={{ backgroundColor: '#FFF7ED' }}>
                <Icon name="AlertTriangle" size={18} color="#D97706" />
                <h2 className="text-sm font-semibold text-orange-800 flex-1">Alertas de Manutenção</h2>
                <span className="text-xs bg-orange-500 text-white px-2 py-0.5 rounded-full">{alerts.length}</span>
            </div>
            <div className="divide-y divide-orange-50">
                {alerts.map(a => (
                    <div key={a.id} className="flex items-start gap-3 p-4">
                        <div className="flex-1">
                            <p className="text-sm font-medium text-slate-800">{a.vehicles?.placa} — {a.tipo}</p>
                            <p className="text-xs text-slate-500 mt-0.5">{a.mensagem}</p>
                        </div>
                        <button onClick={() => onResolve(a.id)}
                            className="flex-shrink-0 text-xs font-medium text-green-600 hover:text-green-800 underline">
                            Resolver
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function MainDashboard() {
    const navigate = useNavigate();
    const { isAdmin } = useAuth();
    const { toast, showToast } = useToast();

    const [romaneios, setRomaneios] = useState([]);
    const [vehicles, setVehicles] = useState([]);
    const [maintenanceAlerts, setMaintenanceAlerts] = useState([]);
    const [loading, setLoading] = useState(true);

    // ✅ FIX: isAdmin always called as function, with safe fallback
    const adminCheck = useCallback(() => {
        if (typeof isAdmin === 'function') return isAdmin();
        return false;
    }, [isAdmin]);

    const load = async () => {
        try {
            setLoading(true);
            const [rom, veh, alerts] = await Promise.all([
                fetchRomaneios(), fetchVehicles(), fetchMaintenanceAlerts()
            ]);
            setRomaneios(rom);
            setVehicles(veh);

            // ✅ FIX: Batch alert creation with Promise.all (no N+1 loop)
            // Only create alerts that don't already exist
            const now = new Date();
            const toCreate = [];

            for (const v of veh) {
                if ((v.utilizacao || 0) >= 90) {
                    const exists = alerts.some(a => a.vehicle_id === v.id && a.tipo === 'Alta utilização');
                    if (!exists) {
                        toCreate.push(createMaintenanceAlert(v.id, 'Alta utilização',
                            `${v.placa} está com ${v.utilizacao}% de utilização. Verificação preventiva recomendada.`).catch(() => {}));
                    }
                }
                if (v.ultimaUtilizacao) {
                    const days = (now - new Date(v.ultimaUtilizacao)) / (1000 * 60 * 60 * 24);
                    if (days > 14 && v.status === 'Disponível') {
                        const exists = alerts.some(a => a.vehicle_id === v.id && a.tipo === 'Veículo ocioso');
                        if (!exists) {
                            toCreate.push(createMaintenanceAlert(v.id, 'Veículo ocioso',
                                `${v.placa} sem uso há ${Math.round(days)} dias. Verificar condições.`).catch(() => {}));
                        }
                    }
                }
            }

            // ✅ FIX: Single parallel batch — only fetch again if we created something new
            if (toCreate.length > 0) {
                await Promise.all(toCreate);
                const fresh = await fetchMaintenanceAlerts();
                setMaintenanceAlerts(fresh);
            } else {
                setMaintenanceAlerts(alerts);
            }
        } catch (err) {
            showToast("Erro ao carregar dados: " + err.message, "error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const handleResolveAlert = async (id) => {
        try {
            await resolveMaintenanceAlert(id);
            setMaintenanceAlerts(prev => prev.filter(a => a.id !== id));
            showToast("Alerta resolvido!", "success");
        } catch (err) {
            showToast("Erro: " + err.message, "error");
        }
    };

    // ─── Real metrics from DB ──────────────────────────────────────
    const metrics = useMemo(() => {
        const ativos = romaneios.filter(r => ['Aguardando', 'Carregando', 'Em Trânsito'].includes(r.status)).length;
        const disponiveis = vehicles.filter(v => v.status === 'Disponível').length;
        const utilizacaoMedia = vehicles.length > 0
            ? Math.round(vehicles.reduce((s, v) => s + (v.utilizacao || 0), 0) / vehicles.length) : 0;
        const pesoHoje = romaneios
            .filter(r => r.saida && new Date(r.saida).toDateString() === new Date().toDateString())
            .reduce((s, r) => s + (r.peso_total || 0), 0);

        return [
            { label: "Romaneios Ativos", value: String(ativos), unit: "", icon: "FileText", bg: "#DBEAFE", iconColor: "#1D4ED8", sub: `${romaneios.filter(r => r.status === 'Em Trânsito').length} em trânsito agora` },
            { label: "Utilização Média da Frota", value: String(utilizacaoMedia), unit: "%", icon: "Truck", bg: "#FEF9C3", iconColor: "#D97706", sub: `${vehicles.length} veículos cadastrados` },
            { label: "Peso Despachado Hoje", value: pesoHoje.toLocaleString('pt-BR'), unit: "kg", icon: "Weight", bg: "#D1FAE5", iconColor: "#059669", sub: "Saídas do dia" },
            { label: "Veículos Disponíveis", value: String(disponiveis), unit: "", icon: "CheckCircle2", bg: "#EDE9FE", iconColor: "#7C3AED", sub: `${vehicles.filter(v => v.status === 'Manutenção').length} em manutenção` },
        ];
    }, [romaneios, vehicles]);

    const fleetData = useMemo(() => vehicles.map(v => ({ placa: v.placa, utilizacao: v.utilizacao ?? 0 })), [vehicles]);

    return (
        <div className="min-h-screen" style={{ backgroundColor: "var(--color-background)" }}>
            <NavigationBar />
            <main className="main-content">
                {/* Header */}
                <div className="border-b border-slate-200 bg-white">
                    <div className="max-w-screen-2xl mx-auto px-4 md:px-6 lg:px-8 py-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                                <BreadcrumbTrail />
                                <h1 className="text-xl md:text-2xl font-heading font-bold mt-1" style={{ color: "var(--color-primary)" }}>
                                    Dashboard Principal
                                </h1>
                                <p className="text-sm text-gray-500 font-caption mt-0.5">
                                    {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
                                </p>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <Button variant="outline" iconName="Package" iconPosition="left" iconSize={15} onClick={() => navigate("/material-catalog")}>Materiais</Button>
                                <Button variant="outline" iconName="Truck" iconPosition="left" iconSize={15} onClick={() => navigate("/vehicle-fleet-management")}>Veículos</Button>
                                <Button variant="outline" iconName="BarChart2" iconPosition="left" iconSize={15} onClick={() => navigate("/relatorios")}>Relatórios</Button>
                                {adminCheck() && (
                                    <Button variant="outline" iconName="Shield" iconPosition="left" iconSize={15} onClick={() => navigate("/admin")}>Admin</Button>
                                )}
                                <QuickActionPanel />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="max-w-screen-2xl mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-8 flex flex-col gap-6">

                    {/* Maintenance Alerts Banner */}
                    {maintenanceAlerts.length > 0 && (
                        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex flex-wrap gap-3 items-start">
                            <div className="flex items-center gap-2 flex-shrink-0">
                                <Icon name="AlertTriangle" size={20} color="#D97706" />
                                <span className="text-sm font-semibold text-orange-800">{maintenanceAlerts.length} Alerta(s) de Manutenção</span>
                            </div>
                            <div className="flex-1 flex flex-wrap gap-2">
                                {maintenanceAlerts.slice(0, 3).map(a => (
                                    <div key={a.id} className="flex items-center gap-2 bg-white border border-orange-200 rounded-lg px-3 py-1.5 text-xs">
                                        <span className="font-medium text-orange-800">{a.vehicles?.placa}</span>
                                        <span className="text-slate-500">— {a.tipo}</span>
                                        <button onClick={() => handleResolveAlert(a.id)} className="text-green-600 font-semibold hover:underline ml-1">✓</button>
                                    </div>
                                ))}
                                {maintenanceAlerts.length > 3 && (
                                    <span className="text-xs text-orange-600 self-center">+{maintenanceAlerts.length - 3} mais</span>
                                )}
                            </div>
                        </div>
                    )}

                    {/* KPI Cards */}
                    {loading ? (
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            {[1,2,3,4].map(i => <div key={i} className="bg-white rounded-xl border border-slate-200 h-24 animate-pulse" />)}
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            {metrics.map((m, i) => <MetricCard key={i} {...m} />)}
                        </div>
                    )}

                    {/* Main Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2 flex flex-col gap-6">
                            <RomaneiosTable romaneios={romaneios} />
                            <FleetUtilizationChart data={fleetData} />
                        </div>
                        <div className="flex flex-col gap-6">
                            {maintenanceAlerts.length > 0 && (
                                <MaintenanceCard alerts={maintenanceAlerts} onResolve={handleResolveAlert} />
                            )}
                            <AISuggestionsPanel romaneios={romaneios} vehicles={vehicles} />
                        </div>
                    </div>

                    <footer className="border-t border-slate-200 pt-6 flex flex-col sm:flex-row items-center justify-between gap-2">
                        <p className="text-xs text-gray-400 font-caption">
                            © {new Date().getFullYear()} LogiFlow — Gestão Logística
                        </p>
                        <p className="text-xs text-gray-400 font-caption">
                            Última sincronização: {new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                    </footer>
                </div>
            </main>
            {toast && <Toast toast={toast} />}
        </div>
    );
}
