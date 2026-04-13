import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import NavigationBar from "components/ui/NavigationBar";
import BreadcrumbTrail from "components/ui/BreadcrumbTrail";
import Icon from "components/AppIcon";
import Button from "components/ui/Button";
import Toast from "components/ui/Toast";
import { useToast } from "utils/useToast";
import { useConfirm } from "components/ui/ConfirmDialog";
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
import { fetchVehicles, createVehicle, updateVehicle, deleteVehicle } from "utils/vehicleService";
import { fetchRomaneios } from "utils/romaneioService";
import { supabase } from "utils/supabaseClient";
import {
    fetchAbastecimentos,
    fetchChecklists, aprovarChecklistComNotificacao, reprovarChecklistComNotificacao,
    fetchDiarias, createDiaria, updateDiaria, deleteDiaria,
    fetchMotoristasCaminhao,
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

// ─── Painel de dados por motorista ────────────────────────────────────────────
function PainelMotorista({ motorista, adminProfile, onClose }) {
    const { toast, showToast } = useToast();
    const { confirm, ConfirmDialog } = useConfirm();
    const [tab, setTab]         = useState('abastecimentos');
    const [loading, setLoading] = useState(true);
    const [mes, setMes]         = useState(() => new Date().toISOString().slice(0, 7));

    const [abast, setAbast]       = useState([]);
    const [checklists, setChecklists] = useState([]);
    const [diarias, setDiarias]   = useState([]);
    const [modalManut, setModalManut] = useState(null);
    const [obsManut, setObsManut]     = useState('');
    const [modalFoto, setModalFoto]   = useState(null);
    const [modalDiaria, setModalDiaria] = useState(null);
    const [romaneiosDiarias, setRomaneiosDiarias] = useState([]);
    const [formDiaria, setFormDiaria] = useState({
        data_inicio: new Date().toISOString().split('T')[0],
        quantidade_dias: '1', valor_dia: '', descricao: '',
    });

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [ano, m] = mes.split('-').map(Number);
            const f = {
                motoristaId: motorista.id,
                dataInicio: mes + '-01',
                dataFim: mes + '-' + String(new Date(ano, m, 0).getDate()).padStart(2, '0'),
            };
            const [a, c, d] = await Promise.all([
                fetchAbastecimentos(f),
                fetchChecklists({ motoristaId: motorista.id }),
                fetchDiarias({ motoristaId: motorista.id, dataInicio: f.dataInicio, dataFim: f.dataFim }),
            ]);
            setAbast(a); setChecklists(c); setDiarias(d);
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
        finally { setLoading(false); }
    }, [motorista.id, mes]); // eslint-disable-line

    useEffect(() => { load(); }, [load]);

    // Totais
    const totaisAbast = useMemo(() => ({
        litrosDiesel: abast.reduce((s, a) => s + Number(a.litros_diesel||0), 0),
        valorDiesel:  abast.reduce((s, a) => s + Number(a.valor_diesel||0), 0),
        litrosArla:   abast.reduce((s, a) => s + Number(a.litros_arla||0), 0),
        valorArla:    abast.reduce((s, a) => s + Number(a.valor_arla||0), 0),
        total:        abast.reduce((s, a) => s + Number(a.valor_total||0), 0),
    }), [abast]);
    const totalDiariasAvulsas = useMemo(() => diarias.reduce((s, d) => s + Number(d.valor_total||0), 0), [diarias]);
    const totalDiariasRomaneios = useMemo(() => romaneiosDiarias.reduce((s, r) => s + Number(r.custo_motorista||0), 0), [romaneiosDiarias]);
    const totalDiarias = useMemo(() => totalDiariasAvulsas + totalDiariasRomaneios, [totalDiariasAvulsas, totalDiariasRomaneios]);
    const previewDiaria = useMemo(() => Number(formDiaria.quantidade_dias||0) * Number(formDiaria.valor_dia||0), [formDiaria]);

    // Checklist handlers
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

    // Diárias handlers
    const handleSaveDiaria = async () => {
        if (!formDiaria.valor_dia || !formDiaria.data_inicio) {
            showToast('Data e valor/dia são obrigatórios', 'error'); return;
        }
        try {
            const payload = { ...formDiaria, motorista_id: motorista.id };
            if (modalDiaria.mode === 'create') await createDiaria(payload);
            else await updateDiaria(modalDiaria.data.id, payload);
            showToast('Diária salva!', 'success'); setModalDiaria(null); load();
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };
    const handleDeleteDiaria = async (id) => {
        const ok = await confirm({ title: 'Excluir diária?', message: 'Esta ação não pode ser desfeita.', confirmLabel: 'Excluir', variant: 'danger' });
        if (!ok) return;
        try { await deleteDiaria(id); showToast('Excluída!', 'success'); load(); }
        catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };
    const openCreateDiaria = () => {
        setFormDiaria({ data_inicio: new Date().toISOString().split('T')[0], quantidade_dias: '1', valor_dia: '', descricao: '' });
        setModalDiaria({ mode: 'create' });
    };
    const openEditDiaria = (d) => {
        setFormDiaria({ data_inicio: d.data_inicio, quantidade_dias: d.quantidade_dias, valor_dia: d.valor_dia, descricao: d.descricao || '' });
        setModalDiaria({ mode: 'edit', data: d });
    };

    // Exportar
    const exportar = () => {
        const wb = XLSX.utils.book_new();
        if (abast.length) {
            const ws = XLSX.utils.json_to_sheet(abast.map(a => ({
                'Data': FMT(a.data_abastecimento), 'Placa': a.veiculo?.placa || '',
                'Posto': a.posto || '', 'Diesel (L)': Number(a.litros_diesel||0),
                'R$ Diesel': Number(a.valor_diesel||0), 'Arla (L)': Number(a.litros_arla||0),
                'R$ Arla': Number(a.valor_arla||0), 'Total': Number(a.valor_total||0),
            })));
            ws['!cols'] = [12,12,18,10,12,10,12,12].map(w => ({ wch: w }));
            XLSX.utils.book_append_sheet(wb, ws, 'Abastecimentos');
        }
        if (checklists.length) {
            const ws = XLSX.utils.json_to_sheet(checklists.map(c => ({
                'Semana': FMT(c.semana_ref), 'Placa': c.veiculo?.placa || '',
                'Status': c.aprovado ? 'Aprovado' : 'Pendente',
                'Itens OK': `${Object.values(c.itens||{}).filter(Boolean).length}/${CHECKLIST_ITENS.length}`,
                'Problemas': c.problemas || '', 'Necessidades': c.necessidades || '',
            })));
            ws['!cols'] = [12,12,12,10,30,30].map(w => ({ wch: w }));
            XLSX.utils.book_append_sheet(wb, ws, 'Checklists');
        }
        const todasDiarias = [
            ...romaneiosDiarias.map(r => ({
                'Tipo': 'Romaneio',
                'Referência': r.numero || '',
                'Data': r.saida ? FMT(r.saida.slice(0,10)) : r.created_at ? FMT(r.created_at.slice(0,10)) : '',
                'Destino/Descrição': r.destino || '',
                'Status': r.status || '',
                'Total': Number(r.custo_motorista||0),
            })),
            ...diarias.map(d => ({
                'Tipo': 'Avulsa',
                'Referência': `${d.quantidade_dias}x dia${d.quantidade_dias > 1 ? 's' : ''}`,
                'Data': FMT(d.data_inicio),
                'Destino/Descrição': d.descricao || '',
                'Status': '—',
                'Total': Number(d.valor_total||0),
            })),
        ];
        if (todasDiarias.length) {
            const ws = XLSX.utils.json_to_sheet(todasDiarias);
            ws['!cols'] = [12,16,12,28,14,14].map(w => ({ wch: w }));
            XLSX.utils.book_append_sheet(wb, ws, 'Diárias');
        }
        if (!wb.SheetNames.length) { showToast('Nenhum dado para exportar', 'error'); return; }
        XLSX.writeFile(wb, `motorista_${motorista.name.replace(/\s+/g, '_')}_${mes}.xlsx`);
        showToast('Exportado!', 'success');
    };

    const TABS_P = [
        { id: 'abastecimentos', label: 'Abastecimentos', icon: 'Fuel',           count: abast.length },
        { id: 'checklist',      label: 'Checklist',      icon: 'ClipboardCheck', count: checklists.length },
        { id: 'diarias',        label: 'Diárias',        icon: 'CalendarDays',   count: diarias.length + romaneiosDiarias.length },
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
            onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">

                {/* Header */}
                <div className="flex flex-col xs:flex-row xs:items-center xs:justify-between gap-3 px-4 sm:px-6 py-4 border-b flex-shrink-0"
                    style={{ borderColor: 'var(--color-border)', backgroundColor: '#F8FAFC' }}>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center text-white font-bold text-base sm:text-lg flex-shrink-0"
                            style={{ background: 'linear-gradient(135deg, #1D4ED8, #7C3AED)' }}>
                            {motorista.name[0]?.toUpperCase()}
                        </div>
                        <div>
                            <h2 className="font-heading font-bold text-base sm:text-xl" style={{ color: 'var(--color-text-primary)' }}>{motorista.name}</h2>
                            <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Motorista · Caminhão</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap xs:flex-nowrap">
                        <input type="month" value={mes} onChange={e => setMes(e.target.value)}
                            className="px-3 py-1.5 rounded-lg border text-sm flex-1 xs:flex-none" style={inputStyle} />
                        <button onClick={load} className="p-2 rounded-lg border hover:bg-gray-50 flex-shrink-0" style={{ borderColor: 'var(--color-border)' }} title="Atualizar">
                            <Icon name="RefreshCw" size={14} color="var(--color-muted-foreground)" />
                        </button>
                        <button onClick={exportar} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium hover:bg-gray-50 flex-shrink-0" style={{ borderColor: 'var(--color-border)' }}>
                            <Icon name="FileDown" size={13} /> Exportar
                        </button>
                        <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 flex-shrink-0 ml-auto xs:ml-0">
                            <Icon name="X" size={20} color="var(--color-muted-foreground)" />
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b flex-shrink-0 overflow-x-auto" style={{ borderColor: 'var(--color-border)' }}>
                    {TABS_P.map(t => (
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

                {/* Conteúdo */}
                <div className="flex-1 overflow-y-auto p-6">
                    {loading ? (
                        <div className="flex justify-center py-16">
                            <div className="animate-spin h-8 w-8 rounded-full border-4" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
                        </div>
                    ) : (
                        <>
                            {/* ── Abastecimentos ── */}
                            {tab === 'abastecimentos' && (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                        {[
                                            { l: 'Diesel (L)', v: totaisAbast.litrosDiesel.toLocaleString('pt-BR', { maximumFractionDigits: 1 }), c: '#1D4ED8', bg: '#EFF6FF', i: 'Fuel' },
                                            { l: 'Custo Diesel', v: BRL(totaisAbast.valorDiesel), c: '#1D4ED8', bg: '#EFF6FF', i: 'DollarSign' },
                                            { l: 'Arla 32 (L)', v: totaisAbast.litrosArla.toLocaleString('pt-BR', { maximumFractionDigits: 1 }), c: '#059669', bg: '#D1FAE5', i: 'Droplets' },
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
                                        <div className="flex flex-col items-center justify-center py-12 rounded-xl border" style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                                            <Icon name="Fuel" size={32} color="var(--color-muted-foreground)" />
                                            <p className="text-sm mt-2 text-center">Nenhum abastecimento registrado no período</p>
                                            <p className="text-xs mt-1 text-center">Os lançamentos do motorista aparecerão aqui</p>
                                        </div>
                                    ) : (
                                        <div className="bg-white rounded-xl border overflow-x-auto" style={{ borderColor: 'var(--color-border)' }}>
                                            <table className="w-full text-sm min-w-[600px]">
                                                <thead className="text-xs border-b" style={{ backgroundColor: 'var(--color-muted)', borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                                                    <tr>{['Data', 'Placa', 'Posto', 'Diesel (L)', 'R$ Diesel', 'Arla (L)', 'R$ Arla', 'Total'].map(h =>
                                                        <th key={h} className="px-3 py-2.5 text-left font-medium whitespace-nowrap">{h}</th>
                                                    )}</tr>
                                                </thead>
                                                <tbody>
                                                    {abast.map((a, i) => (
                                                        <tr key={a.id} className="border-t hover:bg-gray-50" style={{ borderColor: 'var(--color-border)', backgroundColor: i % 2 === 0 ? '#fff' : '#F8FAFC' }}>
                                                            <td className="px-3 py-2.5 whitespace-nowrap">{FMT(a.data_abastecimento)}</td>
                                                            <td className="px-3 py-2.5 font-data font-medium text-blue-700">{a.veiculo?.placa || '—'}</td>
                                                            <td className="px-3 py-2.5 text-xs max-w-[120px] truncate" style={{ color: 'var(--color-muted-foreground)' }}>{a.posto || '—'}</td>
                                                            <td className="px-3 py-2.5 font-data text-right text-blue-700">{Number(a.litros_diesel||0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</td>
                                                            <td className="px-3 py-2.5 font-data text-right">{BRL(a.valor_diesel)}</td>
                                                            <td className="px-3 py-2.5 font-data text-right text-emerald-600">{Number(a.litros_arla||0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</td>
                                                            <td className="px-3 py-2.5 font-data text-right text-emerald-700">{BRL(a.valor_arla)}</td>
                                                            <td className="px-3 py-2.5 font-data font-semibold text-right text-purple-600">{BRL(a.valor_total)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                                <tfoot>
                                                    <tr style={{ backgroundColor: '#F0F9FF', borderTop: '2px solid #BFDBFE' }}>
                                                        <td colSpan={3} className="px-3 py-2 text-xs font-bold text-blue-800">TOTAL</td>
                                                        <td className="px-3 py-2 font-data font-bold text-right text-blue-700">{totaisAbast.litrosDiesel.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</td>
                                                        <td className="px-3 py-2 font-data font-bold text-right text-blue-700">{BRL(totaisAbast.valorDiesel)}</td>
                                                        <td className="px-3 py-2 font-data font-bold text-right text-emerald-700">{totaisAbast.litrosArla.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</td>
                                                        <td className="px-3 py-2 font-data font-bold text-right text-emerald-700">{BRL(totaisAbast.valorArla)}</td>
                                                        <td className="px-3 py-2 font-data font-bold text-right text-purple-700">{BRL(totaisAbast.total)}</td>
                                                    </tr>
                                                </tfoot>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ── Checklist ── */}
                            {tab === 'checklist' && (
                                <div className="space-y-4">
                                    {checklists.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-12 rounded-xl border" style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                                            <Icon name="ClipboardCheck" size={32} color="var(--color-muted-foreground)" />
                                            <p className="text-sm mt-2 text-center">Nenhum checklist enviado</p>
                                            <p className="text-xs mt-1 text-center">O motorista envia pelo app e aparece aqui para aprovação</p>
                                        </div>
                                    ) : checklists.map(c => {
                                        const itens = c.itens || {};
                                        const ok = Object.values(itens).filter(Boolean).length;
                                        const total = CHECKLIST_ITENS.length;
                                        return (
                                            <div key={c.id} className="bg-white rounded-xl border p-4 shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
                                                <div className="flex items-start justify-between mb-3 gap-2">
                                                    <div>
                                                        <p className="font-semibold text-sm" style={{ color: 'var(--color-text-primary)' }}>{c.veiculo?.placa || 'Sem placa'}</p>
                                                        <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>Semana de {c.semana_ref ? FMT(c.semana_ref) : '—'}</p>
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
                                                <div className="mb-3">
                                                    <div className="flex justify-between text-xs mb-1">
                                                        <span style={{ color: 'var(--color-muted-foreground)' }}>Itens verificados</span>
                                                        <span className="font-medium">{ok}/{total}</span>
                                                    </div>
                                                    <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden">
                                                        <div className="h-full rounded-full" style={{ width: `${(ok/total)*100}%`, backgroundColor: ok===total ? '#059669' : ok>=total*0.7 ? '#D97706' : '#DC2626' }} />
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-2 sm:grid-cols-5 gap-1 mb-3">
                                                    {CHECKLIST_ITENS.map(item => (
                                                        <div key={item.id} className="flex items-center gap-1 text-xs px-2 py-1 rounded"
                                                            style={{ backgroundColor: itens[item.id] ? '#D1FAE5' : '#FEE2E2' }}>
                                                            <Icon name={itens[item.id] ? 'Check' : 'X'} size={10} color={itens[item.id] ? '#059669' : '#DC2626'} />
                                                            <span style={{ color: itens[item.id] ? '#065F46' : '#991B1B', fontSize: 10 }}>{item.label}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                                {(c.problemas || c.necessidades || c.obs_manutencao) && (
                                                    <div className="text-xs space-y-1 mb-3 p-3 rounded-lg bg-gray-50">
                                                        {c.problemas && <p><span className="font-medium text-red-600">⚠ Problemas:</span> {c.problemas}</p>}
                                                        {c.necessidades && <p><span className="font-medium text-amber-600">🔧 Necessidades:</span> {c.necessidades}</p>}
                                                        {c.obs_manutencao && <p className="p-2 rounded bg-orange-50 text-orange-700 border border-orange-100"><span className="font-medium">Manutenção:</span> {c.obs_manutencao}</p>}
                                                    </div>
                                                )}
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

                            {/* ── Diárias ── */}
                            {tab === 'diarias' && (
                                <div className="space-y-5">
                                    {/* Cards de resumo */}
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        <div className="rounded-xl border p-3" style={{ borderColor: '#C7D2FE', backgroundColor: '#EEF2FF' }}>
                                            <p className="text-xs font-medium text-indigo-600 mb-1">Total Consolidado</p>
                                            <p className="text-2xl font-bold font-data text-indigo-700">{BRL(totalDiarias)}</p>
                                        </div>
                                        <div className="rounded-xl border p-3" style={{ borderColor: '#BBF7D0', backgroundColor: '#F0FDF4' }}>
                                            <p className="text-xs font-medium text-emerald-600 mb-1">Via Romaneios</p>
                                            <p className="text-xl font-bold font-data text-emerald-700">{BRL(totalDiariasRomaneios)}</p>
                                            <p className="text-xs text-emerald-500 mt-0.5">{romaneiosDiarias.length} romaneio{romaneiosDiarias.length !== 1 ? 's' : ''}</p>
                                        </div>
                                        <div className="rounded-xl border p-3 flex items-start justify-between" style={{ borderColor: 'var(--color-border)', backgroundColor: '#F8FAFC' }}>
                                            <div>
                                                <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-muted-foreground)' }}>Diárias Avulsas</p>
                                                <p className="text-xl font-bold font-data" style={{ color: 'var(--color-text-primary)' }}>{BRL(totalDiariasAvulsas)}</p>
                                                <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted-foreground)' }}>{diarias.length} lançamento{diarias.length !== 1 ? 's' : ''}</p>
                                            </div>
                                            <button onClick={openCreateDiaria}
                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white flex-shrink-0"
                                                style={{ backgroundColor: 'var(--color-primary)' }}>
                                                <Icon name="Plus" size={12} color="white" /> Nova
                                            </button>
                                        </div>
                                    </div>

                                    {/* Seção: Diárias de Romaneios */}
                                    <div>
                                        <div className="flex items-center gap-2 mb-3">
                                            <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#D1FAE5' }}>
                                                <Icon name="FileText" size={13} color="#059669" />
                                            </div>
                                            <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Diárias via Romaneios</h3>
                                            <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: '#D1FAE5', color: '#065F46' }}>
                                                Automático
                                            </span>
                                        </div>
                                        {romaneiosDiarias.length === 0 ? (
                                            <div className="flex flex-col items-center justify-center py-8 rounded-xl border border-dashed" style={{ borderColor: '#BBF7D0', backgroundColor: '#F0FDF4' }}>
                                                <Icon name="FileText" size={24} color="#6EE7B7" />
                                                <p className="text-sm mt-2" style={{ color: '#059669' }}>Nenhum romaneio com diária no período</p>
                                                <p className="text-xs mt-1" style={{ color: '#6EE7B7' }}>As diárias são preenchidas na criação do romaneio</p>
                                            </div>
                                        ) : (
                                            <div className="bg-white rounded-xl border overflow-x-auto" style={{ borderColor: '#BBF7D0' }}>
                                                <table className="w-full text-sm min-w-[500px]">
                                                    <thead className="text-xs border-b" style={{ backgroundColor: '#F0FDF4', borderColor: '#BBF7D0', color: '#065F46' }}>
                                                        <tr>
                                                            {['Romaneio', 'Destino', 'Data', 'Status', 'Diária'].map(h =>
                                                                <th key={h} className="px-3 py-2.5 text-left font-medium whitespace-nowrap">{h}</th>
                                                            )}
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {romaneiosDiarias.map((r, i) => {
                                                            const statusColors = {
                                                                'Finalizado':  { bg: '#F3F4F6', text: '#374151' },
                                                                'Em Trânsito': { bg: '#D1FAE5', text: '#065F46' },
                                                                'Carregando':  { bg: '#DBEAFE', text: '#1D4ED8' },
                                                                'Aguardando':  { bg: '#FEF9C3', text: '#B45309' },
                                                                'Cancelado':   { bg: '#FEE2E2', text: '#991B1B' },
                                                            };
                                                            const sc = statusColors[r.status] || statusColors['Finalizado'];
                                                            return (
                                                                <tr key={r.id} className="border-t hover:bg-emerald-50/30 transition-colors" style={{ borderColor: '#D1FAE5', backgroundColor: i % 2 === 0 ? '#fff' : '#F0FDF4' }}>
                                                                    <td className="px-3 py-2.5">
                                                                        <span className="font-data font-bold text-blue-700">{r.numero}</span>
                                                                    </td>
                                                                    <td className="px-3 py-2.5 max-w-[150px] truncate text-xs" style={{ color: 'var(--color-muted-foreground)' }}>{r.destino || '—'}</td>
                                                                    <td className="px-3 py-2.5 whitespace-nowrap text-xs">{r.saida ? FMT(r.saida.slice(0,10)) : r.created_at ? FMT(r.created_at.slice(0,10)) : '—'}</td>
                                                                    <td className="px-3 py-2.5">
                                                                        <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: sc.bg, color: sc.text }}>{r.status}</span>
                                                                    </td>
                                                                    <td className="px-3 py-2.5 font-data font-semibold text-emerald-700">{BRL(r.custo_motorista)}</td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                    <tfoot>
                                                        <tr style={{ backgroundColor: '#D1FAE5', borderTop: '2px solid #6EE7B7' }}>
                                                            <td colSpan={4} className="px-3 py-2 text-xs font-bold text-emerald-800">SUBTOTAL ROMANEIOS</td>
                                                            <td className="px-3 py-2 font-data font-bold text-emerald-700">{BRL(totalDiariasRomaneios)}</td>
                                                        </tr>
                                                    </tfoot>
                                                </table>
                                            </div>
                                        )}
                                    </div>

                                    {/* Seção: Diárias Avulsas */}
                                    <div>
                                        <div className="flex items-center gap-2 mb-3">
                                            <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#EEF2FF' }}>
                                                <Icon name="CalendarDays" size={13} color="#4F46E5" />
                                            </div>
                                            <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Diárias Avulsas</h3>
                                            <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: '#EEF2FF', color: '#4F46E5' }}>
                                                Manual
                                            </span>
                                        </div>
                                        {diarias.length === 0 ? (
                                            <div className="flex flex-col items-center justify-center py-8 rounded-xl border border-dashed" style={{ borderColor: '#C7D2FE', backgroundColor: '#EEF2FF' }}>
                                                <Icon name="CalendarDays" size={24} color="#A5B4FC" />
                                                <p className="text-sm mt-2 text-indigo-600">Nenhuma diária avulsa no período</p>
                                                <button onClick={openCreateDiaria} className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ backgroundColor: '#4F46E5' }}>
                                                    <Icon name="Plus" size={12} color="white" /> Lançar diária avulsa
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="bg-white rounded-xl border overflow-x-auto" style={{ borderColor: 'var(--color-border)' }}>
                                                <table className="w-full text-sm min-w-[480px]">
                                                    <thead className="text-xs border-b" style={{ backgroundColor: 'var(--color-muted)', borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                                                        <tr>{['Data', 'Dias', 'Valor/Dia', 'Total', 'Descrição', ''].map(h =>
                                                            <th key={h} className="px-3 py-2.5 text-left font-medium whitespace-nowrap">{h}</th>
                                                        )}</tr>
                                                    </thead>
                                                    <tbody>
                                                        {diarias.map((d, i) => (
                                                            <tr key={d.id} className="border-t hover:bg-gray-50" style={{ borderColor: 'var(--color-border)', backgroundColor: i%2===0?'#fff':'#F8FAFC' }}>
                                                                <td className="px-3 py-2.5 whitespace-nowrap">{FMT(d.data_inicio)}</td>
                                                                <td className="px-3 py-2.5 font-data text-center">{d.quantidade_dias}</td>
                                                                <td className="px-3 py-2.5 font-data">{BRL(d.valor_dia)}</td>
                                                                <td className="px-3 py-2.5 font-data font-semibold text-indigo-600">{BRL(d.valor_total)}</td>
                                                                <td className="px-3 py-2.5 text-xs max-w-[180px] truncate" style={{ color: 'var(--color-muted-foreground)' }}>{d.descricao || '—'}</td>
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
                                                            <td colSpan={3} className="px-3 py-2 text-xs font-bold text-indigo-800">SUBTOTAL AVULSAS</td>
                                                            <td className="px-3 py-2 font-data font-bold text-indigo-700">{BRL(totalDiariasAvulsas)}</td>
                                                            <td colSpan={2} />
                                                        </tr>
                                                    </tfoot>
                                                </table>
                                            </div>
                                        )}
                                    </div>

                                    {/* Linha de total geral */}
                                    {(romaneiosDiarias.length > 0 || diarias.length > 0) && (
                                        <div className="rounded-xl p-4 flex items-center justify-between" style={{ background: 'linear-gradient(135deg, #4F46E5, #7C3AED)' }}>
                                            <div className="flex items-center gap-2">
                                                <Icon name="Wallet" size={18} color="white" />
                                                <span className="text-sm font-semibold text-white">Total Geral de Diárias — {mes}</span>
                                            </div>
                                            <span className="text-xl font-bold font-data text-white">{BRL(totalDiarias)}</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Modal manutenção */}
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

            {/* Modal foto */}
            {modalFoto && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.85)' }} onClick={() => setModalFoto(null)}>
                    <img src={modalFoto} alt="Foto checklist" className="rounded-xl max-w-2xl w-full max-h-[80vh] object-contain" />
                </div>
            )}

            {/* Modal diária */}
            {modalDiaria && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
                        <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: 'var(--color-border)' }}>
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-indigo-50"><Icon name="CalendarDays" size={18} color="#4F46E5" /></div>
                                <h3 className="font-bold text-base" style={{ color: 'var(--color-text-primary)' }}>
                                    {modalDiaria.mode === 'create' ? 'Nova Diária' : 'Editar Diária'}
                                </h3>
                            </div>
                            <button onClick={() => setModalDiaria(null)} className="p-1.5 rounded-lg hover:bg-gray-100"><Icon name="X" size={18} color="var(--color-muted-foreground)" /></button>
                        </div>
                        <div className="p-5 grid grid-cols-2 gap-4">
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
                                <div className="flex flex-col justify-center p-3 rounded-xl text-center" style={{ backgroundColor: '#EEF2FF', border: '1px solid #C7D2FE' }}>
                                    <p className="text-xs text-indigo-600 font-medium">Total</p>
                                    <p className="text-xl font-bold font-data text-indigo-700">{BRL(previewDiaria)}</p>
                                </div>
                            )}
                            <div className="col-span-2">
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
            {ConfirmDialog}
        </div>
    );
}

// ─── Aba Motoristas ───────────────────────────────────────────────────────────
function TabMotoristas({ adminProfile }) {
    const { toast, showToast } = useToast();
    const [motoristas, setMotoristas] = useState([]);
    const [loading, setLoading]       = useState(true);
    const [selecionado, setSelecionado] = useState(null);
    const [busca, setBusca]           = useState('');

    useEffect(() => {
        (async () => {
            try {
                const m = await fetchMotoristasCaminhao();
                setMotoristas(m);
            } catch (e) { showToast('Erro ao carregar motoristas: ' + e.message, 'error'); }
            finally { setLoading(false); }
        })();
    }, []); // eslint-disable-line

    const filtrados = useMemo(() =>
        motoristas.filter(m => m.name?.toLowerCase().includes(busca.toLowerCase()))
    , [motoristas, busca]);

    if (loading) return (
        <div className="flex justify-center py-16">
            <div className="animate-spin h-8 w-8 rounded-full border-4" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
        </div>
    );

    return (
        <div>
            {/* Busca */}
            <div className="flex items-center gap-3 mb-5">
                <div className="flex-1 relative">
                    <Icon name="Search" size={15} color="var(--color-muted-foreground)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                    <input value={busca} onChange={e => setBusca(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 rounded-lg border text-sm outline-none" style={inputStyle}
                        placeholder="Buscar motorista..." />
                </div>
                <span className="text-xs px-2 py-1 rounded-lg" style={{ backgroundColor: '#F1F5F9', color: 'var(--color-muted-foreground)' }}>
                    {filtrados.length} motorista{filtrados.length !== 1 ? 's' : ''}
                </span>
            </div>

            {filtrados.length === 0 ? (
                <div className="bg-white rounded-xl border flex flex-col items-center justify-center py-16 px-6 text-center" style={{ borderColor: 'var(--color-border)' }}>
                    <Icon name="Users" size={40} color="var(--color-muted-foreground)" />
                    <p className="text-sm mt-3 font-medium" style={{ color: 'var(--color-muted-foreground)' }}>
                        {busca ? 'Nenhum motorista encontrado' : 'Nenhum motorista de caminhão cadastrado'}
                    </p>
                    <p className="text-xs mt-1" style={{ color: 'var(--color-muted-foreground)' }}>
                        Cadastre motoristas no painel de Admin para visualizá-los aqui
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {filtrados.map(m => (
                        <button key={m.id} onClick={() => setSelecionado(m)}
                            className="flex items-center gap-4 p-4 bg-white rounded-xl border shadow-sm hover:shadow-md hover:border-blue-200 transition-all text-left"
                            style={{ borderColor: 'var(--color-border)' }}>
                            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
                                style={{ background: 'linear-gradient(135deg, #1D4ED8, #7C3AED)' }}>
                                {m.name[0]?.toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold text-sm truncate" style={{ color: 'var(--color-text-primary)' }}>{m.name}</p>
                                <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted-foreground)' }}>Motorista · Caminhão</p>
                            </div>
                            <Icon name="ChevronRight" size={16} color="var(--color-muted-foreground)" />
                        </button>
                    ))}
                </div>
            )}

            {/* Painel do motorista selecionado */}
            {selecionado && (
                <PainelMotorista
                    motorista={selecionado}
                    adminProfile={adminProfile}
                    onClose={() => setSelecionado(null)}
                />
            )}
            <Toast toast={toast} />
        </div>
    );
}

// ─── PÁGINA PRINCIPAL ─────────────────────────────────────────────────────────
export default function VehicleFleetManagement() {
    const { isAdmin, profile } = useAuth();
    const { toast, showToast } = useToast();
    const { confirm, ConfirmDialog } = useConfirm();
    const [accessDenied, setAccessDenied] = useState(false);
    const [vehicles, setVehicles] = useState([]);
    const [romaneios, setRomaneios] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState(EMPTY_FILTERS);
    const [activeTab, setActiveTab] = useState('frota'); // 'frota' | 'motoristas'
    const [formModal, setFormModal] = useState({ open: false, vehicle: null });
    const [statusModal, setStatusModal] = useState({ open: false, vehicle: null });
    const [historyModal, setHistoryModal] = useState({ open: false, vehicle: null });
    const importFileRef = useRef();

    useEffect(() => {
        (async () => {
            try {
                setLoading(true);
                const [data, roms] = await Promise.all([fetchVehicles(), fetchRomaneios()]);
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
            const { parseVehiclesFromFile } = await import("utils/excelUtils");
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
                <div className="max-w-screen-2xl mx-auto px-4 lg:px-8 py-6">

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
                                    onStatusChange={v => { if (!isAdmin()) { setAccessDenied(true); return; } setStatusModal({ open: true, vehicle: v }); }}
                                    onViewHistory={v => setHistoryModal({ open: true, vehicle: v })}
                                    onDelete={v => { if (!isAdmin()) { setAccessDenied(true); return; } handleDelete(v.id); }}
                                />
                            </div>
                            <div className="md:hidden">
                                <VehicleCards
                                    vehicles={filtered}
                                    onEdit={v => { if (!isAdmin()) { setAccessDenied(true); return; } setFormModal({ open: true, vehicle: v }); }}
                                    onStatusChange={v => { if (!isAdmin()) { setAccessDenied(true); return; } setStatusModal({ open: true, vehicle: v }); }}
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
