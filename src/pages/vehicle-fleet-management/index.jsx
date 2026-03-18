import React, { useState, useMemo, useEffect, useCallback } from "react";
import NavigationBar from "components/ui/NavigationBar";
import BreadcrumbTrail from "components/ui/BreadcrumbTrail";
import QuickActionPanel from "components/ui/QuickActionPanel";
import Icon from "components/AppIcon";
import Button from "components/ui/Button";
import Toast from "components/ui/Toast";
import { useToast } from "utils/useToast";
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
  fetchVehicles, createVehicle, updateVehicle, deleteVehicle,
} from "utils/vehicleService";
import { fetchRomaneios } from "utils/romaneioService";
import {
    fetchAbastecimentos, deleteAbastecimento,
    fetchChecklists, aprovarChecklistComNotificacao, reprovarChecklistComNotificacao,
    fetchDiarias, createDiaria, updateDiaria, deleteDiaria,
    fetchTodosMotoristas, fetchCarretasVeiculos,
    CHECKLIST_ITENS,
} from "utils/carretasService";
import * as XLSX from "xlsx";

const BRL = v => Number(v||0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const FMT = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—';
const inputCls = 'w-full px-3 py-2 rounded-lg border text-sm outline-none transition-all focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500';
const inputStyle = { borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' };
const EMPTY_FILTERS = { search: "", tipo: "Todos", status: "Todos" };

function Field({ label, children, required }) {
    return (
        <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                {label}{required && <span className="text-red-500 ml-0.5">*</span>}
            </label>
            {children}
        </div>
    );
}

// ─── Painel de dados do veículo (abastecimentos, checklist, diárias) ──────────
function VehicleDataPanel({ vehicle, adminProfile, onClose }) {
    const { toast, showToast } = useToast();
    const [tab, setTab]           = useState('abastecimentos');
    const [loading, setLoading]   = useState(true);
    const [motoristas, setMotoristas] = useState([]);
    const [carretas, setCarretas] = useState([]);
    const [mes, setMes]           = useState(() => new Date().toISOString().slice(0,7));

    // Abastecimentos
    const [abast, setAbast]       = useState([]);
    // Checklists
    const [checklists, setChecklists] = useState([]);
    const [modalManut, setModalManut] = useState(null);
    const [obsManut, setObsManut] = useState('');
    const [modalFoto, setModalFoto] = useState(null);
    // Diárias
    const [diarias, setDiarias]   = useState([]);
    const [modalDiaria, setModalDiaria] = useState(null);
    const [formDiaria, setFormDiaria] = useState({
        motorista_id: '', data_inicio: new Date().toISOString().split('T')[0],
        quantidade_dias: '1', valor_dia: '', descricao: '',
    });

    // Carrega dados do veículo selecionado
    const load = useCallback(async () => {
        setLoading(true);
        try {
            const f = {};
            if (mes) {
                const [ano, m] = mes.split('-').map(Number);
                f.dataInicio = mes + '-01';
                f.dataFim    = mes + '-' + String(new Date(ano, m, 0).getDate()).padStart(2,'0');
            }

            // Busca por veiculo_id na tabela de carretas (carretas_veiculos)
            // E também tenta encontrar correspondência por placa
            const [a, c, d, mots, cvs] = await Promise.all([
                fetchAbastecimentos(f).then(rows =>
                    rows.filter(r => r.veiculo?.placa === vehicle.placa || r.veiculo_id === vehicle.id)
                ),
                fetchChecklists({}).then(rows =>
                    rows.filter(r => r.veiculo?.placa === vehicle.placa || r.veiculo_id === vehicle.id)
                ),
                fetchDiarias(f),
                fetchTodosMotoristas(),
                fetchCarretasVeiculos(),
            ]);

            // Diárias: filtra por motoristas que usam este veículo
            // (via abastecimentos ou checklists vinculados a esta placa)
            const motoristaIds = new Set([
                ...a.map(x => x.motorista_id),
                ...c.map(x => x.motorista_id),
            ]);
            const diariasFiltradas = d.filter(x => motoristaIds.has(x.motorista_id));

            setAbast(a); setChecklists(c); setDiarias(diariasFiltradas);
            setMotoristas(mots); setCarretas(cvs);
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
        finally { setLoading(false); }
    }, [vehicle.placa, vehicle.id, mes]); // eslint-disable-line

    useEffect(() => { load(); }, [load]);

    // ── Totais abastecimentos
    const totaisAbast = useMemo(() => ({
        litrosDiesel: abast.reduce((s, a) => s + Number(a.litros_diesel||0), 0),
        valorDiesel:  abast.reduce((s, a) => s + Number(a.valor_diesel||0), 0),
        litrosArla:   abast.reduce((s, a) => s + Number(a.litros_arla||0), 0),
        valorArla:    abast.reduce((s, a) => s + Number(a.valor_arla||0), 0),
        total:        abast.reduce((s, a) => s + Number(a.valor_total||0), 0),
    }), [abast]);

    // ── Totais diárias
    const totalDiarias = useMemo(() => diarias.reduce((s, d) => s + Number(d.valor_total||0), 0), [diarias]);

    const previewDiaria = useMemo(() =>
        Number(formDiaria.quantidade_dias||0) * Number(formDiaria.valor_dia||0)
    , [formDiaria.quantidade_dias, formDiaria.valor_dia]);

    // ── Handlers checklists
    const handleAprovar = async (c) => {
        try {
            await aprovarChecklistComNotificacao(c.id, adminProfile?.id, c.motorista_id);
            showToast('Aprovado! Motorista notificado.', 'success'); load();
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };
    const handleManutencao = async () => {
        if (!obsManut.trim()) { showToast('Descreva a manutenção', 'error'); return; }
        const chk = checklists.find(c => c.id === modalManut);
        try {
            await reprovarChecklistComNotificacao(modalManut, adminProfile?.id, chk?.motorista_id, obsManut);
            showToast('Manutenção registrada!', 'success');
            setModalManut(null); setObsManut(''); load();
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };

    // ── Handlers diárias
    const handleSaveDiaria = async () => {
        if (!formDiaria.motorista_id || !formDiaria.valor_dia || !formDiaria.data_inicio) {
            showToast('Motorista, valor/dia e data são obrigatórios', 'error'); return;
        }
        try {
            if (modalDiaria.mode === 'create') await createDiaria(formDiaria);
            else await updateDiaria(modalDiaria.data.id, formDiaria);
            showToast('Diária salva!', 'success'); setModalDiaria(null); load();
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };
    const handleDeleteDiaria = async (id) => {
        if (!confirm('Excluir esta diária?')) return;
        try { await deleteDiaria(id); showToast('Excluída!', 'success'); load(); }
        catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };
    const openCreateDiaria = () => {
        setFormDiaria({ motorista_id: '', data_inicio: new Date().toISOString().split('T')[0], quantidade_dias: '1', valor_dia: '', descricao: '' });
        setModalDiaria({ mode: 'create' });
    };
    const openEditDiaria = (d) => {
        setFormDiaria({ motorista_id: d.motorista_id||'', data_inicio: d.data_inicio, quantidade_dias: d.quantidade_dias, valor_dia: d.valor_dia, descricao: d.descricao||'' });
        setModalDiaria({ mode: 'edit', data: d });
    };

    // ── Exportar Excel
    const exportar = () => {
        const wb = XLSX.utils.book_new();

        // Aba abastecimentos
        if (abast.length) {
            const rows = abast.map(a => ({
                'Data': FMT(a.data_abastecimento), 'Motorista': a.motorista?.name||'',
                'Posto': a.posto||'', 'Diesel (L)': Number(a.litros_diesel||0),
                'R$ Diesel': Number(a.valor_diesel||0), 'Arla (L)': Number(a.litros_arla||0),
                'R$ Arla': Number(a.valor_arla||0), 'Total R$': Number(a.valor_total||0),
            }));
            rows.push({ 'Data':'TOTAL','Diesel (L)':totaisAbast.litrosDiesel,'R$ Diesel':totaisAbast.valorDiesel,'Arla (L)':totaisAbast.litrosArla,'R$ Arla':totaisAbast.valorArla,'Total R$':totaisAbast.total });
            const ws = XLSX.utils.json_to_sheet(rows);
            ws['!cols'] = [12,20,18,10,14,10,14,14].map(w=>({wch:w}));
            XLSX.utils.book_append_sheet(wb, ws, 'Abastecimentos');
        }

        // Aba checklists
        if (checklists.length) {
            const rows = checklists.map(c => ({
                'Semana': FMT(c.semana_ref), 'Motorista': c.motorista?.name||'',
                'Status': c.aprovado ? 'Aprovado' : 'Pendente',
                'Itens OK': Object.values(c.itens||{}).filter(Boolean).length + '/' + CHECKLIST_ITENS.length,
                'Problemas': c.problemas||'', 'Necessidades': c.necessidades||'',
                'Obs Manutenção': c.obs_manutencao||'',
            }));
            const ws = XLSX.utils.json_to_sheet(rows);
            ws['!cols'] = [12,20,12,10,30,30,30].map(w=>({wch:w}));
            XLSX.utils.book_append_sheet(wb, ws, 'Checklists');
        }

        // Aba diárias
        if (diarias.length) {
            const rows = diarias.map(d => ({
                'Data': FMT(d.data_inicio), 'Motorista': d.motorista?.name||'',
                'Dias': d.quantidade_dias, 'Valor/Dia R$': Number(d.valor_dia||0),
                'Total R$': Number(d.valor_total||0), 'Descrição': d.descricao||'',
            }));
            rows.push({ 'Data':'TOTAL','Total R$': totalDiarias });
            const ws = XLSX.utils.json_to_sheet(rows);
            ws['!cols'] = [12,20,8,14,14,30].map(w=>({wch:w}));
            XLSX.utils.book_append_sheet(wb, ws, 'Diárias');
        }

        if (!wb.SheetNames.length) { showToast('Nenhum dado para exportar', 'error'); return; }
        XLSX.writeFile(wb, `veiculo_${vehicle.placa}_${mes}.xlsx`);
        showToast('Exportado!', 'success');
    };

    const TABS_PANEL = [
        { id: 'abastecimentos', label: 'Abastecimentos', icon: 'Fuel',          count: abast.length },
        { id: 'checklist',      label: 'Checklist',       icon: 'ClipboardCheck',count: checklists.length },
        { id: 'diarias',        label: 'Diárias',         icon: 'CalendarDays',  count: diarias.length },
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
            onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0"
                    style={{ borderColor: 'var(--color-border)', backgroundColor: '#F8FAFC' }}>
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: '#EFF6FF' }}>
                            <Icon name="Truck" size={24} color="#1D4ED8" />
                        </div>
                        <div>
                            <h2 className="font-heading font-bold text-xl" style={{ color: 'var(--color-text-primary)' }}>
                                {vehicle.placa}
                            </h2>
                            <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
                                {vehicle.tipo || ''}{vehicle.modelo ? ` · ${vehicle.modelo}` : ''}{vehicle.status ? ` · ${vehicle.status}` : ''}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* Filtro de mês */}
                        <input type="month" value={mes} onChange={e => setMes(e.target.value)}
                            className="px-3 py-1.5 rounded-lg border text-sm" style={inputStyle} />
                        <button onClick={load} className="p-2 rounded-lg border hover:bg-gray-50" style={{ borderColor: 'var(--color-border)' }} title="Atualizar">
                            <Icon name="RefreshCw" size={14} color="var(--color-muted-foreground)" />
                        </button>
                        <button onClick={exportar} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium hover:bg-gray-50" style={{ borderColor: 'var(--color-border)' }}>
                            <Icon name="FileDown" size={13} /> Exportar
                        </button>
                        <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100">
                            <Icon name="X" size={20} color="var(--color-muted-foreground)" />
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b flex-shrink-0 overflow-x-auto" style={{ borderColor: 'var(--color-border)' }}>
                    {TABS_PANEL.map(t => (
                        <button key={t.id} onClick={() => setTab(t.id)}
                            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${tab === t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                            <Icon name={t.icon} size={15} color="currentColor" />
                            {t.label}
                            {t.count > 0 && (
                                <span className="text-xs px-1.5 py-0.5 rounded-full font-bold"
                                    style={{ backgroundColor: tab === t.id ? '#DBEAFE' : '#F1F5F9', color: tab === t.id ? '#1D4ED8' : '#6B7280' }}>
                                    {t.count}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Conteúdo scrollável */}
                <div className="flex-1 overflow-y-auto p-6">
                    {loading ? (
                        <div className="flex justify-center py-16">
                            <div className="animate-spin h-8 w-8 rounded-full border-4" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
                        </div>
                    ) : (
                        <>
                            {/* ── ABA: Abastecimentos ── */}
                            {tab === 'abastecimentos' && (
                                <div className="space-y-4">
                                    {/* KPIs */}
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                        {[
                                            { l: 'Diesel (L)', v: totaisAbast.litrosDiesel.toLocaleString('pt-BR',{maximumFractionDigits:1}), c: '#1D4ED8', bg: '#EFF6FF', i: 'Fuel' },
                                            { l: 'Custo Diesel', v: BRL(totaisAbast.valorDiesel), c: '#1D4ED8', bg: '#EFF6FF', i: 'DollarSign' },
                                            { l: 'Arla 32 (L)', v: totaisAbast.litrosArla.toLocaleString('pt-BR',{maximumFractionDigits:1}), c: '#059669', bg: '#D1FAE5', i: 'Droplets' },
                                            { l: 'Total Gasto', v: BRL(totaisAbast.total), c: '#7C3AED', bg: '#EDE9FE', i: 'Receipt' },
                                        ].map(k => (
                                            <div key={k.l} className="bg-gray-50 rounded-xl border p-3" style={{ borderColor: 'var(--color-border)' }}>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <div className="rounded-lg flex items-center justify-center" style={{ width: 26, height: 26, backgroundColor: k.bg }}>
                                                        <Icon name={k.i} size={13} color={k.c} />
                                                    </div>
                                                    <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>{k.l}</span>
                                                </div>
                                                <p className="text-base font-bold font-data" style={{ color: k.c }}>{k.v}</p>
                                            </div>
                                        ))}
                                    </div>

                                    {abast.length === 0 ? (
                                        <div className="text-center py-12 rounded-xl border" style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                                            <Icon name="Fuel" size={32} color="var(--color-muted-foreground)" />
                                            <p className="text-sm mt-2">Nenhum abastecimento registrado para este veículo no período</p>
                                            <p className="text-xs mt-1">Os lançamentos do motorista aparecerão aqui</p>
                                        </div>
                                    ) : (
                                        <div className="bg-white rounded-xl border overflow-x-auto" style={{ borderColor: 'var(--color-border)' }}>
                                            <table className="w-full text-sm min-w-[600px]">
                                                <thead className="text-xs border-b" style={{ backgroundColor: 'var(--color-muted)', borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                                                    <tr>{['Data','Motorista','Posto','Diesel (L)','R$ Diesel','Arla (L)','R$ Arla','Total'].map(h =>
                                                        <th key={h} className="px-3 py-2.5 text-left font-medium whitespace-nowrap">{h}</th>
                                                    )}</tr>
                                                </thead>
                                                <tbody>
                                                    {abast.map((a, i) => (
                                                        <tr key={a.id} className="border-t hover:bg-gray-50" style={{ borderColor: 'var(--color-border)', backgroundColor: i%2===0?'#fff':'#F8FAFC' }}>
                                                            <td className="px-3 py-2.5 whitespace-nowrap">{FMT(a.data_abastecimento)}</td>
                                                            <td className="px-3 py-2.5 font-medium">{a.motorista?.name||'—'}</td>
                                                            <td className="px-3 py-2.5 text-xs max-w-[120px] truncate" style={{ color: 'var(--color-muted-foreground)' }}>{a.posto||'—'}</td>
                                                            <td className="px-3 py-2.5 font-data text-right text-blue-700">{Number(a.litros_diesel||0).toLocaleString('pt-BR',{maximumFractionDigits:1})}</td>
                                                            <td className="px-3 py-2.5 font-data text-right">{BRL(a.valor_diesel)}</td>
                                                            <td className="px-3 py-2.5 font-data text-right text-emerald-600">{Number(a.litros_arla||0).toLocaleString('pt-BR',{maximumFractionDigits:1})}</td>
                                                            <td className="px-3 py-2.5 font-data text-right text-emerald-700">{BRL(a.valor_arla)}</td>
                                                            <td className="px-3 py-2.5 font-data font-semibold text-right text-purple-600">{BRL(a.valor_total)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                                <tfoot>
                                                    <tr style={{ backgroundColor: '#F0F9FF', borderTop: '2px solid #BFDBFE' }}>
                                                        <td colSpan={3} className="px-3 py-2 text-xs font-bold text-blue-800">TOTAL</td>
                                                        <td className="px-3 py-2 font-data font-bold text-right text-blue-700">{totaisAbast.litrosDiesel.toLocaleString('pt-BR',{maximumFractionDigits:1})}</td>
                                                        <td className="px-3 py-2 font-data font-bold text-right text-blue-700">{BRL(totaisAbast.valorDiesel)}</td>
                                                        <td className="px-3 py-2 font-data font-bold text-right text-emerald-700">{totaisAbast.litrosArla.toLocaleString('pt-BR',{maximumFractionDigits:1})}</td>
                                                        <td className="px-3 py-2 font-data font-bold text-right text-emerald-700">{BRL(totaisAbast.valorArla)}</td>
                                                        <td className="px-3 py-2 font-data font-bold text-right text-purple-700">{BRL(totaisAbast.total)}</td>
                                                    </tr>
                                                </tfoot>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ── ABA: Checklist ── */}
                            {tab === 'checklist' && (
                                <div className="space-y-4">
                                    {checklists.length === 0 ? (
                                        <div className="text-center py-12 rounded-xl border" style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                                            <Icon name="ClipboardCheck" size={32} color="var(--color-muted-foreground)" />
                                            <p className="text-sm mt-2">Nenhum checklist enviado para este veículo</p>
                                            <p className="text-xs mt-1">O motorista envia pelo app e aparece aqui para aprovação</p>
                                        </div>
                                    ) : checklists.map(c => {
                                        const itens = c.itens || {};
                                        const ok = Object.values(itens).filter(Boolean).length;
                                        const total = CHECKLIST_ITENS.length;
                                        return (
                                            <div key={c.id} className="bg-white rounded-xl border p-4 shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
                                                <div className="flex items-start justify-between mb-3 gap-2">
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                            <p className="font-semibold text-sm" style={{ color: 'var(--color-text-primary)' }}>{c.motorista?.name||'—'}</p>
                                                        </div>
                                                        <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                                                            Semana de {c.semana_ref ? FMT(c.semana_ref) : '—'}
                                                        </p>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 flex-wrap justify-end">
                                                        {c.aprovado
                                                            ? <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700"><Icon name="CheckCircle2" size={11} />Aprovado</span>
                                                            : <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700"><Icon name="Clock" size={11} />Pendente</span>
                                                        }
                                                        {c.manutencao_registrada && <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700"><Icon name="Wrench" size={11} />Manutenção</span>}
                                                        {c.foto_url && (
                                                            <button onClick={() => setModalFoto(c.foto_url)} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 hover:bg-blue-200">
                                                                <Icon name="Camera" size={11} />Foto
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                                {/* Barra de progresso */}
                                                <div className="mb-3">
                                                    <div className="flex justify-between text-xs mb-1">
                                                        <span style={{ color: 'var(--color-muted-foreground)' }}>Itens verificados</span>
                                                        <span className="font-medium">{ok}/{total}</span>
                                                    </div>
                                                    <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden">
                                                        <div className="h-full rounded-full" style={{ width: `${(ok/total)*100}%`, backgroundColor: ok===total ? '#059669' : ok>=total*0.7 ? '#D97706' : '#DC2626' }} />
                                                    </div>
                                                </div>
                                                {/* Grid de itens */}
                                                <div className="grid grid-cols-2 sm:grid-cols-5 gap-1 mb-3">
                                                    {CHECKLIST_ITENS.map(item => (
                                                        <div key={item.id} className="flex items-center gap-1 text-xs px-2 py-1 rounded"
                                                            style={{ backgroundColor: itens[item.id] ? '#D1FAE5' : '#FEE2E2' }}>
                                                            <Icon name={itens[item.id] ? 'Check' : 'X'} size={10} color={itens[item.id] ? '#059669' : '#DC2626'} />
                                                            <span style={{ color: itens[item.id] ? '#065F46' : '#991B1B', fontSize: 10 }}>{item.label}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                                {/* Observações */}
                                                {(c.problemas || c.necessidades || c.obs_manutencao) && (
                                                    <div className="text-xs space-y-1 mb-3 p-3 rounded-lg bg-gray-50">
                                                        {c.problemas && <p><span className="font-medium text-red-600">⚠ Problemas:</span> {c.problemas}</p>}
                                                        {c.necessidades && <p><span className="font-medium text-amber-600">🔧 Necessidades:</span> {c.necessidades}</p>}
                                                        {c.obs_manutencao && <p className="p-2 rounded bg-orange-50 text-orange-700 border border-orange-100"><span className="font-medium">Manutenção:</span> {c.obs_manutencao}</p>}
                                                    </div>
                                                )}
                                                {/* Ações admin */}
                                                {!c.aprovado && (
                                                    <div className="flex flex-wrap gap-2 pt-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
                                                        <button onClick={() => handleAprovar(c)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-green-600 text-white hover:bg-green-700">
                                                            <Icon name="CheckCircle2" size={13} />Aprovar
                                                        </button>
                                                        <button onClick={() => { setModalManut(c.id); setObsManut(''); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-orange-300 text-orange-700 hover:bg-orange-50">
                                                            <Icon name="Wrench" size={13} />Registrar Manutenção
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* ── ABA: Diárias ── */}
                            {tab === 'diarias' && (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="bg-gray-50 rounded-xl border p-3 flex-1 mr-4" style={{ borderColor: 'var(--color-border)' }}>
                                            <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>Total Diárias no Período</p>
                                            <p className="text-2xl font-bold font-data text-indigo-600">{BRL(totalDiarias)}</p>
                                        </div>
                                        <button onClick={openCreateDiaria}
                                            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white flex-shrink-0"
                                            style={{ backgroundColor: 'var(--color-primary)' }}>
                                            <Icon name="Plus" size={14} color="white" /> Nova Diária
                                        </button>
                                    </div>

                                    {diarias.length === 0 ? (
                                        <div className="text-center py-12 rounded-xl border" style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                                            <Icon name="CalendarDays" size={32} color="var(--color-muted-foreground)" />
                                            <p className="text-sm mt-2">Nenhuma diária registrada para motoristas deste veículo</p>
                                            <p className="text-xs mt-1">Clique em "Nova Diária" para lançar</p>
                                        </div>
                                    ) : (
                                        <div className="bg-white rounded-xl border overflow-x-auto" style={{ borderColor: 'var(--color-border)' }}>
                                            <table className="w-full text-sm min-w-[500px]">
                                                <thead className="text-xs border-b" style={{ backgroundColor: 'var(--color-muted)', borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                                                    <tr>{['Data','Motorista','Dias','Valor/Dia','Total','Descrição',''].map(h =>
                                                        <th key={h} className="px-3 py-2.5 text-left font-medium whitespace-nowrap">{h}</th>
                                                    )}</tr>
                                                </thead>
                                                <tbody>
                                                    {diarias.map((d, i) => (
                                                        <tr key={d.id} className="border-t hover:bg-gray-50" style={{ borderColor: 'var(--color-border)', backgroundColor: i%2===0?'#fff':'#F8FAFC' }}>
                                                            <td className="px-3 py-2.5 whitespace-nowrap">{FMT(d.data_inicio)}</td>
                                                            <td className="px-3 py-2.5 font-medium">{d.motorista?.name||'—'}</td>
                                                            <td className="px-3 py-2.5 font-data text-center">{d.quantidade_dias}</td>
                                                            <td className="px-3 py-2.5 font-data">{BRL(d.valor_dia)}</td>
                                                            <td className="px-3 py-2.5 font-data font-semibold text-indigo-600">{BRL(d.valor_total)}</td>
                                                            <td className="px-3 py-2.5 text-xs max-w-[180px] truncate" style={{ color: 'var(--color-muted-foreground)' }}>{d.descricao||'—'}</td>
                                                            <td className="px-3 py-2.5">
                                                                <div className="flex gap-1">
                                                                    <button onClick={() => openEditDiaria(d)} className="p-1.5 rounded hover:bg-blue-50"><Icon name="Pencil" size={13} color="#1D4ED8" /></button>
                                                                    <button onClick={() => handleDeleteDiaria(d.id)} className="p-1.5 rounded hover:bg-red-50"><Icon name="Trash2" size={13} color="#DC2626" /></button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                                <tfoot>
                                                    <tr style={{ backgroundColor: '#EEF2FF', borderTop: '2px solid #C7D2FE' }}>
                                                        <td colSpan={4} className="px-3 py-2 text-xs font-bold text-indigo-800">TOTAL</td>
                                                        <td className="px-3 py-2 font-data font-bold text-indigo-700">{BRL(totalDiarias)}</td>
                                                        <td colSpan={2} />
                                                    </tr>
                                                </tfoot>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Modal manutenção checklist */}
            {modalManut && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
                        <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: 'var(--color-border)' }}>
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-orange-50"><Icon name="Wrench" size={18} color="#D97706" /></div>
                                <h3 className="font-bold text-base" style={{ color: 'var(--color-text-primary)' }}>Registrar Manutenção</h3>
                            </div>
                            <button onClick={() => setModalManut(null)} className="p-1.5 rounded-lg hover:bg-gray-100"><Icon name="X" size={18} color="var(--color-muted-foreground)" /></button>
                        </div>
                        <div className="p-5">
                            <Field label="Descreva a manutenção necessária" required>
                                <textarea value={obsManut} onChange={e => setObsManut(e.target.value)} className={inputCls} style={inputStyle} rows={4} placeholder="Detalhes da manutenção..." />
                            </Field>
                        </div>
                        <div className="flex gap-3 p-5 pt-0 justify-end">
                            <button onClick={() => setModalManut(null)} className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50" style={{ borderColor: 'var(--color-border)' }}>Cancelar</button>
                            <button onClick={handleManutencao} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-orange-600 hover:bg-orange-700">
                                <Icon name="Wrench" size={14} color="white" /> Registrar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal foto checklist */}
            {modalFoto && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.85)' }} onClick={() => setModalFoto(null)}>
                    <img src={modalFoto} alt="Foto do checklist" className="rounded-xl max-w-2xl w-full max-h-[80vh] object-contain" />
                </div>
            )}

            {/* Modal nova/editar diária */}
            {modalDiaria && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
                        <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: 'var(--color-border)' }}>
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-indigo-50"><Icon name="CalendarDays" size={18} color="#4F46E5" /></div>
                                <h3 className="font-bold text-base" style={{ color: 'var(--color-text-primary)' }}>
                                    {modalDiaria.mode === 'create' ? 'Nova Diária' : 'Editar Diária'}
                                </h3>
                            </div>
                            <button onClick={() => setModalDiaria(null)} className="p-1.5 rounded-lg hover:bg-gray-100"><Icon name="X" size={18} color="var(--color-muted-foreground)" /></button>
                        </div>
                        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Field label="Motorista" required>
                                <select value={formDiaria.motorista_id} onChange={e => setFormDiaria(f => ({ ...f, motorista_id: e.target.value }))} className={inputCls} style={inputStyle}>
                                    <option value="">Selecione...</option>
                                    {motoristas.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                </select>
                            </Field>
                            <Field label="Data de início" required>
                                <input type="date" value={formDiaria.data_inicio} onChange={e => setFormDiaria(f => ({ ...f, data_inicio: e.target.value }))} className={inputCls} style={inputStyle} />
                            </Field>
                            <Field label="Quantidade de dias" required>
                                <input type="number" step="0.5" min="0.5" value={formDiaria.quantidade_dias} onChange={e => setFormDiaria(f => ({ ...f, quantidade_dias: e.target.value }))} className={inputCls} style={inputStyle} placeholder="1" />
                            </Field>
                            <Field label="Valor por dia (R$)" required>
                                <input type="number" step="0.01" min="0" value={formDiaria.valor_dia} onChange={e => setFormDiaria(f => ({ ...f, valor_dia: e.target.value }))} className={inputCls} style={inputStyle} placeholder="0,00" />
                            </Field>
                            {previewDiaria > 0 && (
                                <div className="sm:col-span-2 p-3 rounded-xl text-center" style={{ backgroundColor: '#EEF2FF', border: '1px solid #C7D2FE' }}>
                                    <p className="text-xs text-indigo-600 font-medium mb-0.5">Total calculado</p>
                                    <p className="text-2xl font-bold font-data text-indigo-700">{BRL(previewDiaria)}</p>
                                </div>
                            )}
                            <div className="sm:col-span-2">
                                <Field label="Descrição / motivo">
                                    <input value={formDiaria.descricao} onChange={e => setFormDiaria(f => ({ ...f, descricao: e.target.value }))} className={inputCls} style={inputStyle} placeholder="Ex: Viagem a Ibotirama — 2 diárias" />
                                </Field>
                            </div>
                        </div>
                        <div className="flex gap-3 p-5 pt-0 justify-end">
                            <button onClick={() => setModalDiaria(null)} className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50" style={{ borderColor: 'var(--color-border)' }}>Cancelar</button>
                            <button onClick={handleSaveDiaria} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ backgroundColor: 'var(--color-primary)' }}>
                                <Icon name="Check" size={14} color="white" /> Salvar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <Toast toast={toast} />
        </div>
    );
}

// ─── PÁGINA PRINCIPAL ─────────────────────────────────────────────────────────
export default function VehicleFleetManagement() {
    const { isAdmin, profile } = useAuth();
    const { toast, showToast } = useToast();
    const [accessDenied, setAccessDenied] = useState(false);
    const [vehicles, setVehicles] = useState([]);
    const [romaneios, setRomaneios] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState(EMPTY_FILTERS);
    const [formModal, setFormModal] = useState({ open: false, vehicle: null });
    const [statusModal, setStatusModal] = useState({ open: false, vehicle: null });
    const [historyModal, setHistoryModal] = useState({ open: false, vehicle: null });
    const [dataPanel, setDataPanel] = useState(null); // veículo selecionado para o painel

    useEffect(() => {
        (async () => {
            try {
                setLoading(true);
                const [data, roms] = await Promise.all([fetchVehicles(), fetchRomaneios()]);
                setVehicles(data); setRomaneios(roms);
            } catch (err) { showToast("Erro ao carregar veículos: " + err.message, "error"); }
            finally { setLoading(false); }
        })();
    }, []);

    const filtered = useMemo(() => vehicles?.filter(v => {
        const matchSearch = filters?.search === "" || v?.placa?.toLowerCase()?.includes(filters?.search?.toLowerCase()) || v?.tipo?.toLowerCase()?.includes(filters?.search?.toLowerCase());
        const matchTipo   = filters?.tipo   === "Todos" || v?.tipo   === filters?.tipo;
        const matchStatus = filters?.status === "Todos" || v?.status === filters?.status;
        return matchSearch && matchTipo && matchStatus;
    }), [vehicles, filters]);

    const handleSave = async (data) => {
        if (!isAdmin()) { setAccessDenied(true); return; }
        try {
            if (formModal?.vehicle) {
                const updated = await updateVehicle(formModal.vehicle.id, data);
                setVehicles(prev => prev.map(v => v.id === updated.id ? updated : v));
                showToast(`Veículo ${data?.placa} atualizado com sucesso.`);
            } else {
                const created = await createVehicle({ ...data, ultima_utilizacao: null });
                setVehicles(prev => [created, ...prev]);
                showToast(`Veículo ${data?.placa} cadastrado com sucesso.`);
            }
            setFormModal({ open: false, vehicle: null });
        } catch (err) { showToast("Erro ao salvar veículo: " + err.message, "error"); }
    };

    const handleStatusUpdate = async (id, newStatus) => {
        if (!isAdmin()) { setAccessDenied(true); return; }
        try {
            const updated = await updateVehicle(id, { status: newStatus });
            setVehicles(prev => prev.map(v => v.id === id ? { ...v, status: updated.status } : v));
            showToast("Status atualizado com sucesso.");
        } catch (err) { showToast("Erro ao atualizar status: " + err.message, "error"); }
    };

    const handleDelete = async (id) => {
        if (!isAdmin()) { setAccessDenied(true); return; }
        try {
            await deleteVehicle(id);
            setVehicles(prev => prev.filter(v => v.id !== id));
            showToast("Veículo removido com sucesso.");
        } catch (err) { showToast("Erro ao remover veículo: " + err.message, "error"); }
    };

    const handleExportExcel = () => { exportVehiclesToExcel(vehicles); showToast("Frota exportada como Excel!"); };
    const handleImportExcel = async (file) => {
        try {
            const parsed = await parseVehiclesFromFile(file);
            if (!parsed.length) { showToast("Nenhum veículo válido encontrado.", "error"); return; }
            let created = 0, errors = 0;
            for (const v of parsed) { try { await createVehicle(v); created++; } catch { errors++; } }
            const data = await fetchVehicles(); setVehicles(data);
            showToast(`${created} veículo(s) importado(s)${errors ? ` · ${errors} erro(s)` : ""}!`, errors ? "warning" : "success");
        } catch (err) { showToast("Erro na importação: " + err.message, "error"); }
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
                                <h1 className="text-2xl md:text-3xl font-heading font-bold" style={{ color: "var(--color-text-primary)" }}>
                                    Gestão de Veículos
                                </h1>
                                <p className="text-sm mt-1" style={{ color: "var(--color-muted-foreground)" }}>
                                    Gerencie a frota · clique em um veículo para ver combustível, checklists e diárias
                                </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <Button variant="outline" size="sm" iconName="FileDown" iconSize={14} onClick={handleExportExcel}>Exportar Excel</Button>
                                <Button variant="outline" size="sm" iconName="FileUp"   iconSize={14} onClick={() => { if (!isAdmin()) { setAccessDenied(true); return; } importFileRef.current?.click(); }}>Importar Excel</Button>
                                <Button variant="ghost"   size="sm" iconName="FileSpreadsheet" iconSize={14} onClick={downloadVehiclesTemplate}>Modelo</Button>
                                <Button variant="default" iconName="Plus" iconSize={16} onClick={() => { if (!isAdmin()) { setAccessDenied(true); return; } setFormModal({ open: true, vehicle: null }); }}>Cadastrar Veículo</Button>
                                <input ref={importFileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
                                    onChange={e => { const f = e.target.files?.[0]; if (f) handleImportExcel(f); e.target.value=''; }} />
                            </div>
                        </div>
                    </div>

                    <MetricCards vehicles={vehicles} romaneios={romaneios} />
                    <FilterBar filters={filters} onChange={setFilters} resultCount={filtered?.length} onClear={() => setFilters(EMPTY_FILTERS)} />

                    {/* Indicação visual que veículos são clicáveis */}
                    <div className="flex items-center gap-2 mb-3 text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                        <Icon name="MousePointerClick" size={13} />
                        <span>Clique no ícone <strong>📊</strong> de qualquer veículo para ver combustível, checklists e diárias</span>
                    </div>

                    {/* Table (desktop) */}
                    <div className="hidden md:block">
                        <VehicleTable
                            vehicles={filtered}
                            onEdit={v => { if (!isAdmin()) { setAccessDenied(true); return; } setFormModal({ open: true, vehicle: v }); }}
                            onStatusChange={v => { if (!isAdmin()) { setAccessDenied(true); return; } setStatusModal({ open: true, vehicle: v }); }}
                            onViewHistory={v => setHistoryModal({ open: true, vehicle: v })}
                            onViewData={v => setDataPanel(v)}
                        />
                    </div>

                    {/* Cards (mobile) */}
                    <div className="md:hidden">
                        <VehicleCards
                            vehicles={filtered}
                            onEdit={v => { if (!isAdmin()) { setAccessDenied(true); return; } setFormModal({ open: true, vehicle: v }); }}
                            onStatusChange={v => { if (!isAdmin()) { setAccessDenied(true); return; } setStatusModal({ open: true, vehicle: v }); }}
                            onViewHistory={v => setHistoryModal({ open: true, vehicle: v })}
                            onViewData={v => setDataPanel(v)}
                        />
                    </div>

                    <div className="mt-6 text-center text-xs font-caption" style={{ color: "var(--color-muted-foreground)" }}>
                        © {new Date()?.getFullYear()} LogiFlow — Gestão Logística. Todos os direitos reservados.
                    </div>
                </div>
            </main>

            {/* Modals existentes */}
            <VehicleFormModal isOpen={formModal?.open} editVehicle={formModal?.vehicle} onClose={() => setFormModal({ open: false, vehicle: null })} onSave={handleSave} />
            <StatusUpdateModal isOpen={statusModal?.open} vehicle={statusModal?.vehicle} onClose={() => setStatusModal({ open: false, vehicle: null })} onUpdate={handleStatusUpdate} />
            <HistoryModal isOpen={historyModal?.open} vehicle={historyModal?.vehicle} onClose={() => setHistoryModal({ open: false, vehicle: null })} />

            {/* Painel de dados do veículo */}
            {dataPanel && (
                <VehicleDataPanel
                    vehicle={dataPanel}
                    adminProfile={profile}
                    onClose={() => setDataPanel(null)}
                />
            )}

            <Toast toast={toast} />
        </div>
    );
}
