import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import NavigationBar from 'components/ui/NavigationBar';
import BreadcrumbTrail from 'components/ui/BreadcrumbTrail';
import Button from 'components/ui/Button';
import Icon from 'components/AppIcon';
import Toast from 'components/ui/Toast';
import { useConfirm } from 'components/ui/ConfirmDialog';
import RomaneioFormModal from './components/RomaneioFormModal';
import RomaneioDetailModal from './components/RomaneioDetailModal';
import RomaneioImportModal  from './components/RomaneioImportModal';
import { exportRomaneiosToExcel } from 'utils/excelUtils';
import { fetchRomaneios, createRomaneio, updateRomaneio, updateRomaneioStatus, deleteRomaneio, duplicateRomaneio, sincronizarStatusVeiculo, fetchRascunhos, createRascunho, updateRascunho, deleteRascunho, promoverRascunho, fetchMotoristasComId } from 'utils/romaneioService';
import { FRETE_CATEGORIAS, getCategoriaConfig, calcularFretePedidoMulti } from 'utils/freteConfig';
import { useRecarregarAoVoltar } from 'utils/useRecarregarAoVoltar';
import { fetchMaterials } from 'utils/materialService';
import { fetchVehicles } from 'utils/vehicleService';
import { useToast } from 'utils/useToast';
import { getTelhaInfo } from 'utils/telhaUtils';
import { subscribeTabela } from 'utils/supabaseClient';

const STATUS_COLORS = {
    'Aguardando':  { bg: '#FEF9C3', text: '#B45309' },
    'Carregando':  { bg: '#DBEAFE', text: '#1D4ED8' },
    'Em Trânsito': { bg: '#D1FAE5', text: '#065F46' },
    'Finalizado':  { bg: '#F3F4F6', text: '#374151' },
    'Cancelado':   { bg: '#FEE2E2', text: '#991B1B' },
};

const ALL_STATUS = ['Todos', 'Aguardando', 'Carregando', 'Em Trânsito', 'Finalizado', 'Cancelado'];

export default function Romaneios() {
    const [guia, setGuia]             = useState('romaneios');
    const [romaneios, setRomaneios]   = useState([]);
    const [rascunhos, setRascunhos]   = useState([]);
    const [materials, setMaterials]   = useState([]);
    const [vehicles, setVehicles]     = useState([]);
    const [motoristasComId, setMotoristasComId] = useState([]);
    const [rascunhoModal, setRascunhoModal] = useState({ open: false, rascunho: null });
    const [resumoCidadeOpen, setResumoCidadeOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState('Todos');
    const [formModal, setFormModal] = useState({ open: false, romaneio: null });
    const [detailModal, setDetailModal] = useState({ open: false, romaneio: null });
    const { toast, showToast } = useToast();
    const [importModal, setImportModal] = useState(false);
    const { confirm, ConfirmDialog } = useConfirm();
    // Ref para rastrear IDs cujo status está sendo atualizado
    // Evita que o realtime sobrescreva o status durante uma atualização em andamento
    const updatingIdsRef = useRef(new Set());

    // Carrega APENAS romaneios (usado pelo Realtime — não recarrega veículos/materiais desnecessariamente)
    const loadRomaneios = useCallback(async () => {
        try {
            const rom = await fetchRomaneios();
            // Preserva o status dos romaneios que estão sendo atualizados no momento
            setRomaneios(prev => rom.map(r =>
                updatingIdsRef.current.has(r.id)
                    ? { ...r, status: prev.find(p => p.id === r.id)?.status ?? r.status }
                    : r
            ));
        } catch (err) {
            console.warn('Erro ao recarregar romaneios:', err.message);
        }
    }, []);

    // Carregamento inicial completo (romaneios + materiais + veículos)
    const load = useCallback(async () => {
        try {
            setLoading(true);
            const [rom, mat, veh, rasc, mots] = await Promise.all([
                fetchRomaneios(), fetchMaterials(), fetchVehicles(),
                fetchRascunhos().catch(() => []),
                fetchMotoristasComId().catch(() => []),
            ]);
            setRomaneios(rom); setMaterials(mat); setVehicles(veh);
            setRascunhos(rasc); setMotoristasComId(mots);
        } catch (err) {
            showToast('Erro ao carregar dados: ' + err.message, 'error');
        } finally {
            setLoading(false);
        }
    }, []); // eslint-disable-line

    useEffect(() => {
        load();
        // Realtime: só atualiza a lista de romaneios (não recarrega vehicles/materials)
        const unsub = subscribeTabela('romaneios', loadRomaneios);
        return () => unsub();
    }, []);
    useRecarregarAoVoltar(load);

    const filtered = useMemo(() => {
        return romaneios.filter(r => {
            const q = search.toLowerCase();
            const matchSearch = !q || r.numero?.toLowerCase().includes(q) || r.motorista?.toLowerCase().includes(q) || r.destino?.toLowerCase().includes(q) || r.placa?.toLowerCase().includes(q);
            // Comparação case-insensitive para garantir que "Cancelado" == "cancelado"
            const matchStatus = filterStatus === 'Todos' || (r.status || '').toLowerCase() === filterStatus.toLowerCase();
            return matchSearch && matchStatus;
        });
    }, [romaneios, search, filterStatus]);

    const handleSave = async (payload, itens) => {
        try {
            if (formModal.romaneio) {
                const updated = await updateRomaneio(formModal.romaneio.id, payload, itens);
                setRomaneios(prev => prev.map(r => r.id === updated.id ? updated : r));
                // Atualiza o detail modal se estiver aberto para o mesmo romaneio
                if (detailModal.open && detailModal.romaneio?.id === updated.id) {
                    setDetailModal(prev => ({ ...prev, romaneio: updated }));
                }
                showToast(`Romaneio ${updated.numero} atualizado!`);
            } else {
                const created = await createRomaneio(payload, itens);
                setRomaneios(prev => [created, ...prev]);
                showToast(`Romaneio ${created.numero} criado com sucesso!`);
            }
            setFormModal({ open: false, romaneio: null });
        } catch (err) {
            showToast('Erro ao salvar: ' + err.message, 'error');
        }
    };

    const handleStatusChange = async (id, status) => {
        // Marca o ID como "em atualização" para evitar que o realtime sobrescreva o status
        updatingIdsRef.current.add(id);
        // Atualiza otimisticamente na UI imediatamente
        setRomaneios(prev => prev.map(r => r.id === id ? { ...r, status } : r));
        try {
            await updateRomaneioStatus(id, status);
            showToast(`Status atualizado para "${status}"`);
        } catch (err) {
            // Reverte em caso de erro
            showToast('Erro ao atualizar status: ' + err.message, 'error');
            const rom = await fetchRomaneios().catch(() => null);
            if (rom) setRomaneios(rom);
        } finally {
            // Libera o lock após 2 segundos (tempo suficiente para o realtime não sobrescrever)
            setTimeout(() => updatingIdsRef.current.delete(id), 2000);
        }
    };

    const handleDelete = async (id) => {
        const ok = await confirm({
            title: 'Excluir romaneio?',
            message: 'Esta ação não pode ser desfeita. O romaneio e todos os seus itens serão removidos permanentemente.',
            confirmLabel: 'Excluir',
            cancelLabel: 'Cancelar',
            variant: 'danger',
        });
        if (!ok) return;
        try {
            await deleteRomaneio(id);
            setRomaneios(prev => prev.filter(r => r.id !== id));
            showToast('Romaneio excluído.', 'warning');
        } catch (err) {
            showToast('Erro ao excluir: ' + err.message, 'error');
        }
    };

    const handleDuplicate = async (romaneio) => {
        try {
            const dup = await duplicateRomaneio(romaneio);
            setRomaneios(prev => [dup, ...prev]);
            showToast(`Romaneio duplicado: ${dup.numero}!`);
        } catch (err) {
            showToast('Erro ao duplicar: ' + err.message, 'error');
        }
    };

    // Metrics
    const metrics = useMemo(() => ({
        total: romaneios.length,
        emTransito: romaneios.filter(r => r.status === 'Em Trânsito').length,
        carregando: romaneios.filter(r => r.status === 'Carregando').length,
        finalizados: romaneios.filter(r => r.status === 'Finalizado').length,
    }), [romaneios]);

    return (
        <div className="min-h-screen" style={{ backgroundColor: 'var(--color-background)' }}>
            <NavigationBar />
            <main className="main-content">
                <div className="max-w-screen-2xl mx-auto px-4 tab:px-6 lg:px-8 py-6">
                    <BreadcrumbTrail className="mb-4" />

                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                        <div>
                            <h1 className="font-heading font-bold text-2xl md:text-3xl flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
                                <Icon name="FileText" size={28} color="var(--color-primary)" /> Romaneios
                            </h1>
                            <p className="text-sm mt-0.5 font-caption" style={{ color: 'var(--color-text-secondary)' }}>
                                Gerencie as ordens de transporte e alocação de cargas
                            </p>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                            {guia === 'romaneios' && (<>
                                <Button variant="outline" iconName="FileDown" iconSize={15}
                                    onClick={() => { const aptos = romaneios.filter(r => r.status_aprovacao !== 'reprovado'); exportRomaneiosToExcel(aptos); showToast(`${aptos.length} romaneio(s) exportados. Reprovados excluídos.`); }}>
                                    <span className="hidden sm:inline">Exportar </span>Excel
                                </Button>
                                <Button variant="outline" iconName="FileSpreadsheet" iconSize={15} onClick={() => setImportModal(true)}>
                                    <span className="hidden sm:inline">Importar </span>Excel
                                </Button>
                                <Button variant="default" iconName="Plus" iconSize={16} onClick={() => setFormModal({ open: true, romaneio: null })}>
                                    <span className="hidden xs:inline sm:inline">Novo </span>Romaneio
                                </Button>
                            </>)}
                            {guia === 'rascunhos' && (<>
                                <Button variant="outline" iconName="MapPin" iconSize={15}
                                    onClick={() => setResumoCidadeOpen(true)}
                                    disabled={rascunhos.length === 0}>
                                    Materiais por Carga
                                </Button>
                                <Button variant="default" iconName="Plus" iconSize={16}
                                    onClick={() => setRascunhoModal({ open: true, rascunho: null })}
                                    style={{ backgroundColor: '#D97706' }}>
                                    Novo Rascunho
                                </Button>
                            </>)}
                        </div>
                    </div>

                    {/* Sub-abas */}
                    <div className="flex gap-1 mb-5 p-1 rounded-xl border" style={{ borderColor: 'var(--color-border)', backgroundColor: '#F9FAFB', width: 'fit-content' }}>
                        {[
                            { id: 'romaneios', label: 'Romaneios',  icon: 'FileText',      color: 'var(--color-primary)', bg: '#DBEAFE', count: romaneios.length },
                            { id: 'rascunhos', label: 'Rascunhos',  icon: 'ClipboardList', color: '#D97706',              bg: '#FFFBEB', count: rascunhos.length },
                        ].map(g => (
                            <button key={g.id} onClick={() => setGuia(g.id)}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
                                style={guia === g.id
                                    ? { backgroundColor: 'white', color: g.color, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', fontWeight: 600 }
                                    : { color: 'var(--color-muted-foreground)' }}>
                                <Icon name={g.icon} size={14} color={guia === g.id ? g.color : 'var(--color-muted-foreground)'} />
                                {g.label}
                                <span className="ml-1 text-xs px-1.5 py-0.5 rounded-full font-semibold"
                                    style={guia === g.id
                                        ? { backgroundColor: g.bg, color: g.color }
                                        : { backgroundColor: '#F3F4F6', color: 'var(--color-muted-foreground)' }}>
                                    {g.count}
                                </span>
                            </button>
                        ))}
                    </div>

                    {guia === 'romaneios' && (<>
                    {/* Metric Cards */}
                    <div className="grid grid-cols-2 tab:grid-cols-4 gap-3 mb-6">
                        {[
                            { label: 'Total', value: metrics.total, icon: 'FileText', color: '#1D4ED8', bg: '#DBEAFE' },
                            { label: 'Em Trânsito', value: metrics.emTransito, icon: 'Truck', color: '#065F46', bg: '#D1FAE5' },
                            { label: 'Carregando', value: metrics.carregando, icon: 'Package', color: '#1D4ED8', bg: '#DBEAFE' },
                            { label: 'Finalizados', value: metrics.finalizados, icon: 'CheckCircle2', color: '#374151', bg: '#F3F4F6' },
                        ].map(m => (
                            <div key={m.label} className="bg-white rounded-xl border p-3 sm:p-4 flex items-center gap-2 sm:gap-3 shadow-card" style={{ borderColor: 'var(--color-border)' }}>
                                <div className="rounded-lg flex items-center justify-center flex-shrink-0" style={{ width: 34, height: 34, backgroundColor: m.bg }}>
                                    <Icon name={m.icon} size={16} color={m.color} />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs font-caption leading-tight" style={{ color: 'var(--color-muted-foreground)' }}>{m.label}</p>
                                    <p className="text-xl font-bold font-data leading-tight" style={{ color: 'var(--color-text-primary)' }}>{m.value}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Filters */}
                    <div className="flex flex-col gap-3 mb-4">
                        <div className="relative">
                            <Icon name="Search" size={15} color="var(--color-muted-foreground)" className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                            <input
                                value={search} onChange={e => setSearch(e.target.value)}
                                placeholder="Buscar por número, motorista, destino ou placa..."
                                className="w-full h-10 pl-9 pr-4 rounded-lg border text-sm focus:outline-none focus:ring-2 bg-white"
                                style={{ borderColor: 'var(--color-border)' }}
                            />
                        </div>
                        <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                            {ALL_STATUS.map(s => (
                                <button key={s}
                                    onClick={() => setFilterStatus(s)}
                                    className="px-3 py-1.5 rounded-lg text-xs font-medium font-caption border transition-all flex-shrink-0 whitespace-nowrap"
                                    style={filterStatus === s
                                        ? { backgroundColor: 'var(--color-primary)', color: '#fff', borderColor: 'var(--color-primary)' }
                                        : { backgroundColor: 'white', color: 'var(--color-muted-foreground)', borderColor: 'var(--color-border)' }
                                    }
                                >{s}</button>
                            ))}
                        </div>
                    </div>

                    {/* Table */}
                    {loading ? (
                        <LoadingState />
                    ) : filtered.length === 0 ? (
                        <EmptyState onNew={() => setFormModal({ open: true, romaneio: null })} />
                    ) : (
                        <div className="bg-white rounded-xl border shadow-card overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="text-xs font-caption border-b" style={{ backgroundColor: 'var(--color-muted)', borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                                        <tr>
                                            <th className="px-3 py-3 text-left font-medium">Número</th>
                                            <th className="px-3 py-3 text-left font-medium hidden sm:table-cell">Motorista</th>
                                            <th className="px-3 py-3 text-left font-medium hidden md:table-cell">Destino</th>
                                            <th className="px-3 py-3 text-left font-medium hidden tab:table-cell">Placa</th>
                                            <th className="px-3 py-3 text-right font-medium hidden tab:table-cell">Peso</th>
                                            <th className="px-3 py-3 text-left font-medium hidden tab:table-cell">Saída</th>
                                            <th className="px-3 py-3 text-left font-medium hidden tab:table-cell">Chegada</th>
                                            <th className="px-3 py-3 text-right font-medium hidden lg:table-cell">Frete</th>
                                            <th className="px-3 py-3 text-right font-medium hidden lg:table-cell">Margem</th>
                                            <th className="px-3 py-3 text-center font-medium hidden tab:table-cell">Aprovação</th>
                                            <th className="px-3 py-3 text-center font-medium">Status</th>
                                            <th className="px-3 py-3 text-center font-medium">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filtered.map(r => {
                                            const sc = STATUS_COLORS[r.status] || STATUS_COLORS['Aguardando'];
                                            const isReprovado = r.status_aprovacao === 'reprovado';
                                            const isCancelado = r.status === 'Cancelado';
                                            return (
                                                <React.Fragment key={r.id}>
                                                {/* Linha principal do romaneio */}
                                                <tr className="border-t transition-colors"
                                                    style={{
                                                        borderColor: isReprovado ? '#FCA5A5' : 'var(--color-border)',
                                                        borderLeft: isReprovado ? '3px solid #EF4444' : isCancelado ? '3px solid #9CA3AF' : '3px solid transparent',
                                                        borderRight: isReprovado ? '1px solid #FCA5A5' : undefined,
                                                        borderTop: isReprovado ? '2px solid #FCA5A5' : undefined,
                                                        borderBottom: isReprovado ? 'none' : undefined,
                                                        backgroundColor: isReprovado ? '#FFF8F8' : isCancelado ? '#F9FAFB' : undefined,
                                                    }}
                                                    onMouseEnter={e => { if (!isReprovado && !isCancelado) e.currentTarget.style.backgroundColor = '#F8FAFC'; }}
                                                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = isReprovado ? '#FFF8F8' : isCancelado ? '#F9FAFB' : ''; }}>
                                                    <td className="px-3 py-3">
                                                        <button onClick={() => setDetailModal({ open: true, romaneio: r })}
                                                            className="font-data text-xs font-semibold hover:underline whitespace-nowrap"
                                                            style={{ color: isCancelado ? '#6B7280' : 'var(--color-primary)', textDecoration: isCancelado ? 'line-through' : 'none' }}>
                                                            {r.numero}
                                                        </button>
                                                        <p className="text-xs mt-0.5 sm:hidden" style={{ color: isCancelado ? '#9CA3AF' : '#64748b' }}>{r.motorista || ''}</p>
                                                    </td>
                                                    <td className="px-3 py-3 hidden sm:table-cell" style={{ color: isCancelado ? '#9CA3AF' : 'var(--color-text-primary)' }}>{r.motorista || '—'}</td>
                                                    <td className="px-3 py-3 hidden md:table-cell" style={{ color: isCancelado ? '#9CA3AF' : 'var(--color-text-secondary)' }}>{r.destino || '—'}</td>
                                                    <td className="px-3 py-3 hidden tab:table-cell font-data text-xs" style={{ color: 'var(--color-text-secondary)' }}>{r.placa || '—'}</td>
                                                    <td className="px-3 py-3 text-right hidden tab:table-cell font-data text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                                                        {r.peso_total ? `${Number(r.peso_total).toLocaleString('pt-BR')} kg` : '—'}
                                                    </td>
                                                    <td className="px-3 py-3 hidden tab:table-cell text-xs font-caption" style={{ color: 'var(--color-text-secondary)' }}>
                                                        {r.saida ? new Date(r.saida).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                                                    </td>
                                                    <td className="px-3 py-3 hidden tab:table-cell text-xs font-caption" style={{ color: 'var(--color-text-secondary)' }}>
                                                        {r.chegada ? new Date(r.chegada).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                                                    </td>
                                                    <td className="px-3 py-3 text-right hidden lg:table-cell font-data text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                                                        {r.valor_frete ? Number(r.valor_frete).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'}
                                                    </td>
                                                    <td className="px-3 py-3 text-right hidden lg:table-cell font-data text-xs font-semibold">
                                                        {r.margem_lucro != null ? (
                                                            <span style={{ color: r.margem_lucro >= 0 ? '#059669' : '#DC2626' }}>
                                                                {r.margem_lucro >= 0 ? '+' : ''}{Number(r.margem_lucro).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                            </span>
                                                        ) : '—'}
                                                    </td>
                                                    <td className="px-3 py-3 text-center hidden tab:table-cell">
                                                        {r.aprovado ? (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: '#D1FAE5', color: '#065F46' }}>
                                                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                                                                Aprovado
                                                            </span>
                                                        ) : r.status_aprovacao === 'reprovado' ? (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: '#FEE2E2', color: '#991B1B' }} title={r.motivo_reprovacao || ''}>
                                                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                                                Reprovado
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: '#FEF9C3', color: '#B45309' }}>
                                                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                                                Pendente
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <select
                                                            value={r.status}
                                                            onChange={e => handleStatusChange(r.id, e.target.value)}
                                                            className="px-2 py-1 rounded-full text-xs font-medium border cursor-pointer font-caption focus:outline-none"
                                                            style={{ backgroundColor: sc.bg, color: sc.text, borderColor: sc.bg }}>
                                                            {['Aguardando', 'Carregando', 'Em Trânsito', 'Finalizado', 'Cancelado'].map(s => <option key={s}>{s}</option>)}
                                                        </select>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex items-center justify-center gap-1">
                                                            <button onClick={() => setDetailModal({ open: true, romaneio: r })}
                                                                className="p-1.5 rounded hover:bg-blue-50 transition-colors flex-shrink-0" title="Ver detalhes">
                                                                <Icon name="Eye" size={16} color="var(--color-primary)" className="flex-shrink-0" />
                                                            </button>
                                                            <button onClick={() => setFormModal({ open: true, romaneio: r })}
                                                                className="p-1.5 rounded hover:bg-gray-100 transition-colors" title="Editar">
                                                                <Icon name="Pencil" size={16} color="var(--color-muted-foreground)" />
                                                            </button>
                                                            <button onClick={() => handleDelete(r.id)}
                                                                className="p-1.5 rounded hover:bg-red-50 transition-colors" title="Excluir">
                                                                <Icon name="Trash2" size={16} color="var(--color-destructive)" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                                {/* Painel de reprovação — aparece abaixo da linha, dentro do Fragment */}
                                                {isReprovado && (
                                                    <tr style={{ backgroundColor: '#FFF8F8' }}>
                                                        <td colSpan={11} style={{ padding: 0, borderBottom: '2px solid #FCA5A5', borderLeft: '3px solid #EF4444', borderRight: '1px solid #FCA5A5', borderTop: 'none' }}>
                                                            <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3" style={{ backgroundColor: '#FEF2F2' }}>
                                                                {/* Ícone + texto */}
                                                                <div className="flex items-start gap-2 flex-1 min-w-0">
                                                                    <Icon name="AlertCircle" size={15} color="#DC2626" style={{ flexShrink: 0, marginTop: 1 }} />
                                                                    <div className="min-w-0">
                                                                        <p className="text-xs font-bold" style={{ color: '#DC2626' }}>
                                                                            Reprovado pelo admin
                                                                        </p>
                                                                        {r.motivo_reprovacao && (
                                                                            <p className="text-xs mt-0.5 leading-relaxed" style={{ color: '#7F1D1D' }}>
                                                                                {r.motivo_reprovacao}
                                                                            </p>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                {/* Ações */}
                                                                <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                                                                    <button
                                                                        onClick={() => setFormModal({ open: true, romaneio: r })}
                                                                        className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg"
                                                                        style={{ backgroundColor: '#1D4ED8', color: 'white', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                                                        <Icon name="Pencil" size={16} color="white" />
                                                                        Editar e reenviar
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleDelete(r.id)}
                                                                        className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg"
                                                                        style={{ backgroundColor: 'white', color: '#DC2626', border: '1px solid #FCA5A5', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                                                        <Icon name="Trash2" size={16} color="#DC2626" />
                                                                        Excluir
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                                </React.Fragment>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            <div className="px-4 py-3 border-t text-xs font-caption text-right" style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                                Exibindo {filtered.length} de {romaneios.length} romaneios
                            </div>
                        </div>
                    )}
                    </>)} {/* fim guia romaneios */}

                    {/* ═══ GUIA RASCUNHOS ═══ */}
                    {guia === 'rascunhos' && (
                        <GuiaRascunhos
                            rascunhos={rascunhos}
                            loading={loading}
                            onNew={() => setRascunhoModal({ open: true, rascunho: null })}
                            onEdit={r => setRascunhoModal({ open: true, rascunho: r })}
                            onDelete={async id => {
                                const ok = await confirm({ title: 'Excluir rascunho?', message: 'Esta ação não pode ser desfeita.', confirmLabel: 'Excluir', variant: 'danger' });
                                if (!ok) return;
                                try { await deleteRascunho(id); showToast('Rascunho excluído', 'warning'); load(); }
                                catch (e) { showToast('Erro: ' + e.message, 'error'); }
                            }}
                            onPromover={async id => {
                                const ok = await confirm({ title: 'Promover para Romaneio oficial?', message: 'O rascunho receberá um número sequencial (ex: ROM-003) e ficará disponível em "Aguardando". Todos os pedidos e itens já lançados são mantidos.', confirmLabel: 'Promover', variant: 'primary' });
                                if (!ok) return;
                                try { const rom = await promoverRascunho(id); showToast(`Romaneio ${rom.numero} criado!`, 'success'); load(); setGuia('romaneios'); }
                                catch (e) { showToast('Erro ao promover: ' + e.message, 'error'); }
                            }}
                        />
                    )}

                    {rascunhoModal.open && (
                        <RascunhoFormModal
                            rascunho={rascunhoModal.rascunho}
                            vehicles={vehicles}
                            materials={materials}
                            motoristasComId={motoristasComId}
                            onClose={() => setRascunhoModal({ open: false, rascunho: null })}
                            onSave={async (payload, itens) => {
                                try {
                                    if (rascunhoModal.rascunho) { await updateRascunho(rascunhoModal.rascunho.id, payload, itens); showToast('Rascunho atualizado!'); }
                                    else { await createRascunho(payload, itens); showToast('Rascunho criado!'); }
                                    setRascunhoModal({ open: false, rascunho: null }); load();
                                } catch (err) { showToast('Erro: ' + err.message, 'error'); }
                            }}
                        />
                    )}
                    {resumoCidadeOpen && (
                        <ResumoMateriaisCidadeModal
                            rascunhos={rascunhos}
                            onClose={() => setResumoCidadeOpen(false)}
                        />
                    )}
                </div>
            </main>

            <RomaneioFormModal
                isOpen={formModal.open}
                onClose={() => setFormModal({ open: false, romaneio: null })}
                onSave={handleSave}
                editingRomaneio={formModal.romaneio}
                vehicles={vehicles}
                materials={materials}
            />
            <RomaneioDetailModal
                isOpen={detailModal.open}
                onClose={() => setDetailModal({ open: false, romaneio: null })}
                romaneio={detailModal.romaneio}
                onEdit={r => setFormModal({ open: true, romaneio: r })}
                onDelete={handleDelete}
            />
            <RomaneioImportModal
                isOpen={importModal}
                onClose={() => setImportModal(false)}
                onImported={() => { load(); showToast('Romaneios importados com sucesso!'); }}
            />
            <Toast toast={toast} />
            {ConfirmDialog}
        </div>
    );
}

function LoadingState() {
    return (
        <div className="bg-white rounded-xl border shadow-card p-12 flex flex-col items-center gap-3" style={{ borderColor: 'var(--color-border)' }}>
            <svg className="animate-spin h-8 w-8" style={{ color: 'var(--color-primary)' }} fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-sm font-caption" style={{ color: 'var(--color-muted-foreground)' }}>Carregando romaneios...</span>
        </div>
    );
}

function EmptyState({ onNew }) {
    return (
        <div className="bg-white rounded-xl border shadow-card p-12 flex flex-col items-center gap-3 text-center" style={{ borderColor: 'var(--color-border)' }}>
            <Icon name="FileSearch" size={40} color="var(--color-muted-foreground)" />
            <p className="font-medium" style={{ color: 'var(--color-text-primary)' }}>Nenhum romaneio encontrado</p>
            <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Ajuste os filtros ou crie um novo romaneio</p>
            <Button variant="default" iconName="Plus" iconSize={15} onClick={onNew} size="sm">Criar Romaneio</Button>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// GUIA RASCUNHOS
// ═══════════════════════════════════════════════════════════════════════════════
const brl = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function GuiaRascunhos({ rascunhos, loading, onNew, onEdit, onDelete, onPromover }) {
    if (loading) return (
        <div className="flex justify-center py-12">
            <div className="animate-spin h-8 w-8 rounded-full border-4" style={{ borderColor: '#D97706', borderTopColor: 'transparent' }} />
        </div>
    );
    return (
        <div>
            <div className="flex items-start gap-3 p-3 rounded-xl border mb-5" style={{ backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }}>
                <Icon name="Info" size={14} color="#92400E" style={{ marginTop: 2, flexShrink: 0 }} />
                <p className="text-xs" style={{ color: '#92400E' }}>
                    Rascunhos são romaneios em formação. Adicione pedidos cumulativos com materiais e fretes calculados automaticamente.
                    Quando a carga estiver pronta, clique em <strong>Promover</strong> — o romaneio oficial é criado com número sequencial e todos os dados são aproveitados.
                </p>
            </div>
            {rascunhos.length === 0 ? (
                <div className="bg-white rounded-xl border shadow-card p-12 flex flex-col items-center gap-3 text-center" style={{ borderColor: 'var(--color-border)' }}>
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#FFFBEB' }}>
                        <Icon name="ClipboardList" size={28} color="#D97706" />
                    </div>
                    <p className="font-medium" style={{ color: 'var(--color-text-primary)' }}>Nenhum rascunho criado</p>
                    <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Crie um rascunho para planejar a carga antes de emitir o romaneio oficial.</p>
                    <button onClick={onNew} className="mt-1 px-4 py-2 rounded-xl text-sm font-semibold text-white" style={{ backgroundColor: '#D97706' }}>
                        Criar primeiro rascunho
                    </button>
                </div>
            ) : (
                <div className="space-y-4">
                    {rascunhos.map(r => <RascunhoCard key={r.id} r={r} onEdit={onEdit} onDelete={onDelete} onPromover={onPromover} />)}
                </div>
            )}
        </div>
    );
}

function RascunhoCard({ r, onEdit, onDelete, onPromover }) {
    const pedidos  = r.romaneio_pedidos || [];
    const itens    = r.romaneio_itens   || [];
    const pesoTotal  = itens.reduce((s, i) => s + (Number(i.peso_total) || 0), 0);
    const freteTotal = Number(r.valor_frete_calculado || r.valor_frete || 0);
    const valorCarga = Number(r.valor_total_carga || 0);

    return (
        <div className="bg-white rounded-2xl border shadow-sm overflow-hidden" style={{ borderColor: '#FDE68A' }}>
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b" style={{ backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }}>
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#FEF3C7' }}>
                        <Icon name="ClipboardList" size={16} color="#D97706" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm font-bold" style={{ color: '#92400E' }}>Rascunho</p>
                        <p className="text-xs truncate" style={{ color: '#B45309' }}>
                            {r.destino || 'Destino não definido'}{r.motorista ? ` · ${r.motorista}` : ''}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <button onClick={() => onEdit(r)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border hover:bg-amber-50 transition-colors" style={{ borderColor: '#FDE68A', color: '#92400E' }}>
                        <Icon name="Pencil" size={16} color="#92400E" /> Editar
                    </button>
                    <button onClick={() => onDelete(r.id)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border hover:bg-red-50 transition-colors" style={{ borderColor: '#FECACA', color: '#DC2626' }}>
                        <Icon name="Trash2" size={16} color="#DC2626" /> Excluir
                    </button>
                    <button onClick={() => onPromover(r.id)} className="flex items-center gap-1 px-4 py-1.5 rounded-xl text-xs font-semibold text-white hover:opacity-90 transition-opacity" style={{ backgroundColor: '#059669' }}>
                        <Icon name="ArrowRightCircle" size={12} color="white" /> Promover para Romaneio
                    </button>
                </div>
            </div>

            {/* Badges resumo */}
            <div className="px-5 py-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                    { icon: 'FileText',   label: 'Pedidos',     value: pedidos.length > 0 ? `${pedidos.length} pedido${pedidos.length > 1 ? 's' : ''}` : '—', color: '#D97706', bg: '#FFFBEB' },
                    { icon: 'Scale',      label: 'Peso Total',  value: pesoTotal > 0 ? `${pesoTotal.toLocaleString('pt-BR')} kg` : '—',                        color: '#7C3AED', bg: '#FAF5FF' },
                    { icon: 'DollarSign', label: 'Frete Total', value: freteTotal > 0 ? brl(freteTotal) : '—',                                                  color: '#059669', bg: '#ECFDF5' },
                    { icon: 'BarChart2',  label: 'Valor Carga', value: valorCarga > 0 ? brl(valorCarga) : '—',                                                  color: '#1D4ED8', bg: '#EFF6FF' },
                ].map(b => (
                    <div key={b.label} className="flex items-center gap-2 p-3 rounded-xl" style={{ backgroundColor: b.bg }}>
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: b.color + '22' }}>
                            <Icon name={b.icon} size={13} color={b.color} />
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>{b.label}</p>
                            <p className="text-xs font-bold truncate" style={{ color: b.color }}>{b.value}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Chips pedidos */}
            {pedidos.length > 0 && (
                <div className="px-5 pb-4">
                    <p className="text-xs font-semibold mb-2" style={{ color: 'var(--color-text-secondary)' }}>PEDIDOS VINCULADOS</p>
                    <div className="flex flex-wrap gap-2">
                        {pedidos.map((p, i) => {
                            const frete = calcularFretePedidoMulti(p).total;
                            return (
                                <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs" style={{ borderColor: '#FDE68A', backgroundColor: '#FFFBEB' }}>
                                    {p.numero_pedido && <span className="font-semibold" style={{ color: '#92400E' }}>#{p.numero_pedido}</span>}
                                    {p.empresa && <span style={{ color: '#B45309' }}>{p.empresa}</span>}
                                    {frete > 0 && <span className="font-medium" style={{ color: '#059669' }}>{brl(frete)}</span>}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Sugestão IA */}
            {r.sugestao_veiculo && (
                <div className="mx-5 mb-4 p-3 rounded-xl border flex items-start gap-2" style={{ backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }}>
                    <Icon name="Cpu" size={14} color="#059669" />
                    <div>
                        <p className="text-xs font-semibold mb-0.5" style={{ color: '#065F46' }}>Sugestão de veículo</p>
                        <p className="text-xs leading-relaxed" style={{ color: '#059669' }}>{r.sugestao_veiculo}</p>
                    </div>
                </div>
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// RESUMO DE MATERIAIS POR CARGA (agrupado por carga/rascunho e, dentro de
// cada carga, separado por cidade de destino — cada cidade soma os totais
// de todos os pedidos daquela carga que vão para ela)
// ═══════════════════════════════════════════════════════════════════════════════

/** Para cada rascunho (carga), agrupa seus itens pela cidade de destino do
 *  pedido ao qual cada item pertence (cai para o destino do rascunho quando
 *  o pedido não tem cidade própria definida). Dentro de uma mesma carga, se
 *  vários pedidos vão para a mesma cidade, os materiais desses pedidos são
 *  somados juntos (mesmo material em pedidos diferentes da mesma cidade =
 *  total único). Cargas diferentes NUNCA são somadas entre si — cada carga
 *  é seu próprio bloco, exatamente na ordem em que aparecem nos rascunhos. */
function buildResumoPorCarga(rascunhos) {
    return (rascunhos || [])
        .map((r, idx) => {
            const pedidos = r.romaneio_pedidos || [];
            const itens   = r.romaneio_itens   || [];
            const cidadePorPedido = {};
            pedidos.forEach(p => {
                cidadePorPedido[p.id] = (p.cidade_destino || r.destino || '').trim() || 'Cidade não informada';
            });
            const cidadeFallback = (r.destino || '').trim() || 'Cidade não informada';

            const cidadesMap = new Map(); // cidade -> { materiais: {}, pesoTotal, qtdTotal }
            itens.forEach(i => {
                const cidade  = (i.pedido_id && cidadePorPedido[i.pedido_id]) || cidadeFallback;
                const matNome = i.materials?.nome    || 'Material não identificado';
                const unidade = i.materials?.unidade || '';
                const { isTelha, compTelha, metros } = getTelhaInfo(i);
                // Telhas com comprimentos de corte diferentes não podem ser somadas juntas.
                const matKey  = String(i.material_id || matNome) + (isTelha ? `@${compTelha.toFixed(2)}` : '');
                const qtd     = Number(i.quantidade) || 0;
                const peso    = Number(i.peso_total) || 0;

                if (!cidadesMap.has(cidade)) cidadesMap.set(cidade, { materiais: {}, pesoTotal: 0, qtdTotal: 0 });
                const cEntry = cidadesMap.get(cidade);
                if (!cEntry.materiais[matKey]) cEntry.materiais[matKey] = { nome: matNome, unidade, isTelha, compTelha, quantidade: 0, peso: 0, metros: 0 };
                cEntry.materiais[matKey].quantidade += qtd;
                cEntry.materiais[matKey].peso       += peso;
                cEntry.materiais[matKey].metros      += metros;
                cEntry.pesoTotal += peso;
                cEntry.qtdTotal  += qtd;
            });

            const cidades = Array.from(cidadesMap.entries())
                .map(([cidade, dados]) => ({
                    cidade,
                    pesoTotal: dados.pesoTotal,
                    qtdTotal:  dados.qtdTotal,
                    materiais: Object.values(dados.materiais).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
                }))
                .sort((a, b) => a.cidade.localeCompare(b.cidade, 'pt-BR'));

            return {
                rascunhoId:    r.id,
                indice:        idx + 1,
                motorista:     r.motorista || '',
                placa:         r.placa || '',
                cidades,
                qtdTotalCarga:  cidades.reduce((s, c) => s + c.qtdTotal, 0),
                pesoTotalCarga: cidades.reduce((s, c) => s + c.pesoTotal, 0),
            };
        })
        .filter(c => c.cidades.length > 0); // esconde rascunhos sem nenhum item lançado
}

function ResumoMateriaisCidadeModal({ rascunhos, onClose }) {
    const resumo = useMemo(() => buildResumoPorCarga(rascunhos), [rascunhos]);
    const semDados = resumo.length === 0;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 pt-16" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0" style={{ borderColor: 'var(--color-border)' }}>
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#FFFBEB' }}>
                            <Icon name="MapPin" size={18} color="#D97706" />
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-base font-bold truncate" style={{ color: 'var(--color-text-primary)' }}>Materiais por Carga</h3>
                            <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>Cada carga (rascunho), separada por cidade de destino</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 flex-shrink-0">
                        <Icon name="X" size={18} color="var(--color-muted-foreground)" />
                    </button>
                </div>

                {/* Conteúdo */}
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
                    {semDados ? (
                        <div className="flex flex-col items-center gap-2 py-12 text-center">
                            <Icon name="PackageSearch" size={32} color="var(--color-muted-foreground)" />
                            <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Nenhum material lançado nos rascunhos ainda.</p>
                            <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>Adicione pedidos com materiais em um rascunho para ver o resumo aqui.</p>
                        </div>
                    ) : resumo.map(c => (
                        <div key={c.rascunhoId} className="rounded-xl border overflow-hidden" style={{ borderColor: '#FDE68A' }}>
                            {/* Cabeçalho da carga */}
                            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3" style={{ backgroundColor: '#FFFBEB' }}>
                                <div className="flex items-center gap-2 min-w-0">
                                    <Icon name="Package" size={14} color="#D97706" />
                                    <p className="text-sm font-bold truncate" style={{ color: '#92400E' }}>
                                        Carga {c.indice}{c.motorista ? ` — ${c.motorista}` : ''}{c.placa ? ` (${c.placa})` : ''}
                                    </p>
                                </div>
                                <div className="flex items-center gap-4 text-xs flex-shrink-0">
                                    <span style={{ color: '#92400E' }}><strong>{c.qtdTotalCarga.toLocaleString('pt-BR')}</strong> un.</span>
                                    <span style={{ color: '#92400E' }}><strong>{c.pesoTotalCarga.toLocaleString('pt-BR')}</strong> kg</span>
                                </div>
                            </div>

                            {/* Um bloco por cidade dentro da carga */}
                            <div className="divide-y" style={{ borderColor: '#FDE68A' }}>
                                {c.cidades.map(cid => (
                                    <div key={cid.cidade}>
                                        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2" style={{ backgroundColor: '#FFFDF5' }}>
                                            <div className="flex items-center gap-1.5">
                                                <Icon name="MapPin" size={12} color="#B45309" />
                                                <p className="text-xs font-semibold" style={{ color: '#B45309' }}>{cid.cidade}</p>
                                            </div>
                                            <div className="flex items-center gap-3 text-xs">
                                                <span style={{ color: '#B45309' }}><strong>{cid.qtdTotal.toLocaleString('pt-BR')}</strong> un.</span>
                                                <span style={{ color: '#B45309' }}><strong>{cid.pesoTotal.toLocaleString('pt-BR')}</strong> kg</span>
                                            </div>
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-xs">
                                                <thead style={{ color: 'var(--color-muted-foreground)' }}>
                                                    <tr>
                                                        <th className="text-left px-4 py-1.5 font-medium">Material</th>
                                                        <th className="text-right px-4 py-1.5 font-medium">Quantidade</th>
                                                        <th className="text-right px-4 py-1.5 font-medium">Peso (kg)</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {cid.materiais.map(m => (
                                                        <tr key={`${m.nome}-${m.compTelha || ''}`} className="border-t" style={{ borderColor: '#FDF1D6' }}>
                                                            <td className="px-4 py-1.5">
                                                                {m.nome}
                                                                {m.isTelha && m.compTelha > 0 && (
                                                                    <span className="ml-1 text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                                                                        (peça {m.compTelha.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}m)
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-1.5 text-right font-mono whitespace-nowrap">
                                                                {m.isTelha
                                                                    ? <>{m.quantidade.toLocaleString('pt-BR')} pç <span style={{ color: 'var(--color-muted-foreground)' }}>({m.metros.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} m)</span></>
                                                                    : <>{m.quantidade.toLocaleString('pt-BR')}{m.unidade ? ` ${m.unidade}` : ''}</>}
                                                            </td>
                                                            <td className="px-4 py-1.5 text-right font-mono whitespace-nowrap">{m.peso > 0 ? m.peso.toLocaleString('pt-BR') : '—'}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div className="flex justify-end px-5 py-3 border-t flex-shrink-0" style={{ borderColor: 'var(--color-border)' }}>
                    <button onClick={onClose} className="px-4 py-2 rounded-xl border text-sm font-medium" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>
                        Fechar
                    </button>
                </div>
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODAL DE RASCUNHO
// ═══════════════════════════════════════════════════════════════════════════════
function RascunhoFormModal({ rascunho, vehicles, materials, motoristasComId, onClose, onSave }) {
    const isEdit = !!rascunho;

    const EMPTY_FORM    = { motorista: '', motorista_id: '', placa: '', vehicle_id: '', destino: '', saida: '', observacoes: '' };
    const EMPTY_PEDIDO  = () => ({ numero_pedido: '', empresa: 'Comercial Araguaia', valor_pedido: '', categoria_frete: 'Ferragens', categorias_extra: [], cidade_destino: '', itens: [] });
    const EMPTY_ITEM    = () => ({ material_id: '', quantidade: '1', peso_unit: '', peso_total: '', is_telha_zinco: false, comprimento_telha: '', metros_totais: '' });

    const [form, setForm]       = useState(EMPTY_FORM);
    const [pedidos, setPedidos] = useState([EMPTY_PEDIDO()]);
    const [tab, setTab]         = useState('dados');
    const [saving, setSaving]   = useState(false);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiSugestao, setAiSugestao] = useState('');
    const [buscaPedido, setBuscaPedido] = useState('');
    const [openPedidos, setOpenPedidos] = useState(() => new Set([0]));
    const togglePedido = idx => setOpenPedidos(s => {
        const n = new Set(s);
        n.has(idx) ? n.delete(idx) : n.add(idx);
        return n;
    });

    useEffect(() => {
        if (rascunho) {
            setForm({ motorista: rascunho.motorista || '', motorista_id: rascunho.motorista_id || '', placa: rascunho.placa || '', vehicle_id: rascunho.vehicle_id || '', destino: rascunho.destino || '', saida: rascunho.saida || '', observacoes: rascunho.observacoes || '' });
            const peds = rascunho.romaneio_pedidos || [];
            setPedidos(peds.length > 0 ? peds.map(p => ({
                numero_pedido: p.numero_pedido || '', empresa: p.empresa || 'Comercial Araguaia',
                valor_pedido: String(p.valor_pedido || ''), categoria_frete: p.categoria_frete || 'Ferragens',
                categorias_extra: Array.isArray(p.categorias_extra) ? p.categorias_extra : [],
                cidade_destino: p.cidade_destino || '',
                itens: (rascunho.romaneio_itens || []).filter(i => i.pedido_id === p.id).map(i => ({
                    material_id: i.material_id || '', quantidade: String(i.quantidade || 1),
                    peso_unit: i.materials?.peso ? String(i.materials.peso) : '',
                    peso_total: i.peso_total != null ? String(i.peso_total) : '',
                    is_telha_zinco: i.is_telha_zinco || i.materials?.is_telha_zinco || false,
                    comprimento_telha: i.comprimento_telha != null ? String(i.comprimento_telha) : '',
                    metros_totais: i.metros_totais != null ? String(i.metros_totais) : '',
                })),
            })) : [EMPTY_PEDIDO()]);
            setAiSugestao(rascunho.sugestao_veiculo || '');
        } else {
            setForm(EMPTY_FORM); setPedidos([EMPTY_PEDIDO()]); setAiSugestao('');
        }
        setTab('dados');
        setBuscaPedido('');
        setOpenPedidos(new Set([0]));
    }, [rascunho]); // eslint-disable-line

    const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const updPedido = (idx, patch) => setPedidos(p => p.map((x, i) => i === idx ? { ...x, ...patch } : x));
    // Categorias extras — permite mais de uma categoria de material (com percentuais
    // diferentes) dentro do mesmo pedido, igual ao romaneio já publicado.
    const addCategoriaExtra = idx => setPedidos(p => p.map((x, i) => i !== idx ? x : {
        ...x, categorias_extra: [...(x.categorias_extra || []), { categoria: 'Outros', valor: '' }],
    }));
    const updCategoriaExtra = (idx, eIdx, patch) => setPedidos(p => p.map((x, i) => i !== idx ? x : {
        ...x, categorias_extra: (x.categorias_extra || []).map((e, j) => j !== eIdx ? e : { ...e, ...patch }),
    }));
    const delCategoriaExtra = (idx, eIdx) => setPedidos(p => p.map((x, i) => i !== idx ? x : {
        ...x, categorias_extra: (x.categorias_extra || []).filter((_, j) => j !== eIdx),
    }));
    const addPedido = () => {
        setPedidos(p => {
            setOpenPedidos(s => new Set([...s, p.length]));
            return [...p, EMPTY_PEDIDO()];
        });
    };
    const delPedido = idx => {
        setPedidos(p => p.filter((_, i) => i !== idx));
        setOpenPedidos(s => new Set([...s].filter(i => i !== idx).map(i => i > idx ? i - 1 : i)));
    };

    // useRef garante que materials sempre aponta para a versão mais recente
    // sem criar stale closure (o problema que causava peso_total não calcular)
    const materialsRef = React.useRef(materials);
    React.useEffect(() => { materialsRef.current = materials; }, [materials]);

    const updItem = (pIdx, iIdx, patch) => setPedidos(p => p.map((ped, pi) => {
        if (pi !== pIdx) return ped;
        const mats = materialsRef.current || [];
        const newItens = ped.itens.map((it, ii) => {
            if (ii !== iIdx) return it;
            const merged = { ...it, ...patch };

            // Se material mudou: detecta telha de zinco e (re)inicializa campos
            if (patch.material_id !== undefined) {
                const mat = mats.find(m => String(m.id) === String(patch.material_id));
                merged.is_telha_zinco = !!mat?.is_telha_zinco;
                if (merged.is_telha_zinco) {
                    // Telha: quantidade = nº de peças, calculada a partir de metros totais
                    // ÷ comprimento de cada peça — mesma lógica usada em Romaneios.
                    merged.comprimento_telha = merged.comprimento_telha || '';
                    merged.metros_totais     = merged.metros_totais || '';
                    merged.peso_unit  = '';
                    merged.quantidade = merged.quantidade || '';
                    merged.peso_total = '';
                } else {
                    merged.is_telha_zinco = false;
                    merged.comprimento_telha = '';
                    merged.metros_totais = '';
                    if (mat?.peso) {
                        merged.peso_unit  = String(mat.peso);
                        merged.peso_total = String(Math.round(Number(mat.peso) * Number(merged.quantidade || 1) * 1000) / 1000);
                    } else {
                        merged.peso_unit  = '';
                        if (!merged._manualPeso) merged.peso_total = '';
                    }
                }
            }

            if (merged.is_telha_zinco) {
                // Recalcula sempre que comprimento ou metros totais mudarem
                const mat = mats.find(m => String(m.id) === String(merged.material_id));
                const pesoBaseMetro = Number(mat?.peso_base_metro) || Number(mat?.peso) || 3.80;
                const comp = Number(merged.comprimento_telha) || 0;
                const metros = Number(merged.metros_totais) || 0;
                if (comp > 0) {
                    const pesoUnit = pesoBaseMetro * comp;
                    merged.peso_unit = String(Math.round(pesoUnit * 1000) / 1000);
                    if (metros > 0) {
                        const qtdTelhas = Math.round(metros / comp);
                        merged.quantidade = String(qtdTelhas);
                        merged.peso_total = String(Math.round(qtdTelhas * pesoUnit * 1000) / 1000);
                    } else {
                        merged.quantidade = '';
                        merged.peso_total = '';
                    }
                } else {
                    merged.peso_unit  = '';
                    merged.quantidade = '';
                    merged.peso_total = '';
                }
                return merged;
            }

            // Se quantidade mudou e temos peso_unit: recalcula (se não editado manualmente)
            if (patch.quantidade !== undefined && merged.peso_unit && !merged._manualPeso) {
                merged.peso_total = String(Math.round(Number(merged.peso_unit) * Number(merged.quantidade || 1) * 1000) / 1000);
            }
            // Garante que peso_total nunca fique '' se temos peso_unit e quantidade
            if (!merged._manualPeso && merged.peso_unit && merged.quantidade && merged.peso_total === '') {
                merged.peso_total = String(Math.round(Number(merged.peso_unit) * Number(merged.quantidade) * 1000) / 1000);
            }
            return merged;
        });
        return { ...ped, itens: newItens };
    }));
    const addItem = pIdx => setPedidos(p => p.map((ped, pi) => pi === pIdx ? { ...ped, itens: [...ped.itens, EMPTY_ITEM()] } : ped));
    const delItem = (pIdx, iIdx) => setPedidos(p => p.map((ped, pi) => pi === pIdx ? { ...ped, itens: ped.itens.filter((_, ii) => ii !== iIdx) } : ped));

    const totais = React.useMemo(() => {
        const valorCarga  = pedidos.reduce((s, p) => s + Number(p.valor_pedido || 0), 0);
        const frete       = pedidos.reduce((s, p) => s + calcularFretePedidoMulti(p).total, 0);
        const peso = pedidos.flatMap(p => p.itens).reduce((s, i) => {
            // Usa peso_total do state; se vazio, calcula na hora com peso_unit × quantidade
            const pt = i.peso_total !== '' && i.peso_total != null
                ? Number(i.peso_total)
                : (i.peso_unit && i.quantidade ? Number(i.peso_unit) * Number(i.quantidade) : 0);
            return s + pt;
        }, 0);
        return { valorCarga, frete, peso };
    }, [pedidos]);

    // Sugestão de veículo — lógica local gratuita (sem API paga)
    // Analisa capacidade dos veículos disponíveis vs peso total da carga
    const sugerirVeiculo = async () => {
        setAiLoading(true);
        await new Promise(r => setTimeout(r, 600)); // simula "pensando"
        try {
            const disponiveis = (vehicles || []).filter(v =>
                v.status !== 'Em Manutenção' && v.status !== 'Inativo'
            );

            if (disponiveis.length === 0) {
                setAiSugestao('Nenhum veículo disponível no momento. Verifique o cadastro de veículos.');
                return;
            }

            const peso = totais.peso;
            const frete = totais.frete;
            const nPedidos = pedidos.filter(p => p.numero_pedido).length;

            // Função para extrair capacidade do veículo
            const getCap = v => Number(v.capacidade_peso || v.capacidade_carga || v.tara || 0);

            // Ordena: primeiro os que cabem a carga (cap >= peso), depois os maiores
            const ordenados = [...disponiveis].sort((a, b) => {
                const capA = getCap(a), capB = getCap(b);
                const aFit = capA >= peso, bFit = capB >= peso;
                if (aFit && !bFit) return -1;
                if (!aFit && bFit) return 1;
                // Ambos cabem: prefere o menor (mais eficiente)
                if (aFit && bFit) return capA - capB;
                // Nenhum cabe: prefere o maior
                return capB - capA;
            });

            const melhor = ordenados[0];
            const cap = getCap(melhor);
            const ocup = cap > 0 ? Math.round((peso / cap) * 100) : null;
            const status = melhor.status || 'Disponível';

            let linhas = [];

            // Veículo recomendado
            linhas.push(`✅ Veículo recomendado: ${melhor.placa}${melhor.modelo ? ` — ${melhor.modelo}` : ''} (${status})`);

            if (cap > 0) {
                if (peso > 0) {
                    linhas.push(`📦 Carga: ${peso.toLocaleString('pt-BR')} kg de ${cap.toLocaleString('pt-BR')} kg de capacidade (${ocup}% de ocupação)`);
                    if (ocup >= 95) linhas.push('⚠️  Carga próxima do limite — verifique o peso com o motorista antes de carregar.');
                    else if (ocup >= 70) linhas.push('✔️  Ocupação boa. Veículo bem aproveitado para esta viagem.');
                    else if (ocup < 40) linhas.push('ℹ️  Baixa ocupação. Considere consolidar com outra carga para reduzir custo por kg.');
                } else {
                    linhas.push('ℹ️  Peso não informado — adicione materiais para calcular a ocupação.');
                }
            }

            if (frete > 0) linhas.push(`💰 Frete estimado: ${brl(frete)}`);
            if (nPedidos > 0) linhas.push(`📋 ${nPedidos} pedido${nPedidos > 1 ? 's' : ''} vinculado${nPedidos > 1 ? 's' : ''} a esta carga.`);

            // Alternativas
            const alternativas = ordenados.slice(1, 3).filter(v => getCap(v) >= peso);
            if (alternativas.length > 0) {
                linhas.push('');
                linhas.push('🔄 Alternativas disponíveis:');
                alternativas.forEach(v => {
                    const c = getCap(v);
                    const o = c > 0 && peso > 0 ? ` — ${Math.round((peso/c)*100)}% ocupação` : '';
                    linhas.push(`  • ${v.placa}${v.modelo ? ` (${v.modelo})` : ''}${o}`);
                });
            }

            // Alerta se nenhum veículo cabe a carga
            if (peso > 0 && cap > 0 && cap < peso) {
                linhas.push('');
                linhas.push(`⚠️  Atenção: nenhum veículo disponível tem capacidade suficiente para ${peso.toLocaleString('pt-BR')} kg. Verifique o cadastro ou divida a carga.`);
            }

            setAiSugestao(linhas.join('\n'));
        } catch (e) {
            setAiSugestao('Erro ao gerar sugestão: ' + (e.message || String(e)));
        } finally { setAiLoading(false); }
    };

    const handleSave = async () => {
        if (!form.destino.trim()) { alert('Destino é obrigatório'); setTab('dados'); return; }
        setSaving(true);
        try {
            const allItens = pedidos.flatMap((ped, pIdx) =>
                ped.itens.filter(i => i.material_id).map(i => ({
                    material_id: i.material_id, quantidade: Number(i.quantidade) || 1,
                    peso_total: i.peso_total ? Number(i.peso_total) : null,
                    pedido_index: pIdx,
                }))
            );
            await onSave({
                ...form,
                peso_total:            totais.peso      || null,
                valor_frete:           totais.frete     || null,
                valor_frete_calculado: totais.frete     || null,
                valor_total_carga:     totais.valorCarga || null,
                sugestao_veiculo:      aiSugestao       || null,
                _pedidos: pedidos.filter(p => p.numero_pedido || p.valor_pedido).map(p => ({
                    numero_pedido:   p.numero_pedido || '',
                    cidade_destino:  p.cidade_destino || form.destino,
                    valor_pedido:    Number(p.valor_pedido || 0),
                    categoria_frete: p.categoria_frete || 'Outros',
                    categorias_extra: (p.categorias_extra || []).filter(e => Number(e.valor) > 0).map(e => ({ categoria: e.categoria, valor: Number(e.valor) })),
                    empresa:         p.empresa || '',
                    percentual_frete: (FRETE_CATEGORIAS || []).find(f => f.categoria === p.categoria_frete)?.percentual || 0,
                    frete_calculado:  calcularFretePedidoMulti(p).total,
                })),
            }, allItens);
        } finally { setSaving(false); }
    };

    const inputCls   = 'w-full px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 transition-all';
    const inputStyle = { borderColor: 'var(--color-border)', color: 'var(--color-text-primary)', backgroundColor: '#ffffff' };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)' }}>
            <div className="bg-white rounded-2xl shadow-2xl flex flex-col w-full max-w-3xl" style={{ maxHeight: 'calc(100vh - 32px)', backgroundColor: '#ffffff' }}>

                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0" style={{ borderColor: 'var(--color-border)' }}>
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#FFFBEB' }}>
                            <Icon name="ClipboardList" size={18} color="#D97706" />
                        </div>
                        <h2 className="font-heading font-bold text-lg" style={{ color: 'var(--color-text-primary)' }}>
                            {isEdit ? 'Editar Rascunho' : 'Novo Rascunho de Romaneio'}
                        </h2>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                        <Icon name="X" size={18} color="var(--color-muted-foreground)" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b flex-shrink-0 px-5 pt-3 gap-1" style={{ borderColor: 'var(--color-border)' }}>
                    {[
                        { id: 'dados',   label: 'Identificação',               icon: 'FileText'    },
                        { id: 'pedidos', label: `Pedidos (${pedidos.length})`, icon: 'ShoppingCart' },
                        { id: 'ia',      label: 'Sugestão Veículo',            icon: 'Truck'       },
                    ].map(t => (
                        <button key={t.id} onClick={() => setTab(t.id)}
                            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors"
                            style={tab === t.id ? { borderColor: '#D97706', color: '#D97706' } : { borderColor: 'transparent', color: 'var(--color-muted-foreground)' }}>
                            <Icon name={t.icon} size={13} color={tab === t.id ? '#D97706' : 'var(--color-muted-foreground)'} />
                            {t.label}
                        </button>
                    ))}
                </div>

                {/* Body */}
                <div className="p-5 overflow-y-auto flex-1 space-y-4">

                    {/* ── ABA: Identificação ── */}
                    {tab === 'dados' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* Motorista — select dos cadastrados */}
                            <div>
                                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Motorista</label>
                                <select value={form.motorista_id} onChange={e => {
                                    const m = motoristasComId.find(x => x.id === e.target.value);
                                    setF('motorista_id', e.target.value);
                                    setF('motorista', m?.name || '');
                                }} className={inputCls} style={inputStyle}>
                                    <option value="">Selecione o motorista...</option>
                                    {motoristasComId.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                </select>
                            </div>

                            {/* Destino */}
                            <div>
                                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Destino <span style={{ color: '#DC2626' }}>*</span></label>
                                <input value={form.destino} onChange={e => setF('destino', e.target.value)} className={inputCls} style={inputStyle} placeholder="Cidade / Endereço" />
                            </div>

                            {/* Veículo */}
                            <div>
                                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Veículo (opcional)</label>
                                <select value={form.vehicle_id} onChange={e => {
                                    const v = vehicles.find(x => x.id === e.target.value || String(x.id) === e.target.value);
                                    setF('vehicle_id', e.target.value);
                                    setF('placa', v?.placa || '');
                                }} className={inputCls} style={inputStyle}>
                                    <option value="">A definir...</option>
                                    {vehicles.map(v => <option key={v.id} value={v.id}>{v.placa} — {v.modelo || ''}</option>)}
                                </select>
                            </div>

                            {/* Data saída */}
                            <div>
                                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Data de Saída</label>
                                <input type="datetime-local" value={form.saida} onChange={e => setF('saida', e.target.value)} className={inputCls} style={inputStyle} />
                            </div>

                            {/* Observações */}
                            <div className="sm:col-span-2">
                                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Observações</label>
                                <textarea value={form.observacoes} onChange={e => setF('observacoes', e.target.value)} rows={2} className={inputCls} style={inputStyle} placeholder="Informações adicionais..." />
                            </div>
                        </div>
                    )}

                    {/* ── ABA: Pedidos ── */}
                    {tab === 'pedidos' && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-2">
                                <div className="relative flex-1">
                                    <Icon name="Search" size={14} color="var(--color-muted-foreground)" className="absolute left-3 top-1/2 -translate-y-1/2" />
                                    <input value={buscaPedido} onChange={e => setBuscaPedido(e.target.value)}
                                        className={inputCls} style={{ ...inputStyle, paddingLeft: 32 }}
                                        placeholder="Buscar por nº do pedido, empresa ou cidade..." />
                                </div>
                                <button onClick={addPedido} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white flex-shrink-0" style={{ backgroundColor: '#D97706' }}>
                                    <Icon name="Plus" size={12} color="white" /> Adicionar pedido
                                </button>
                            </div>

                            {(() => {
                                const termo = buscaPedido.trim().toLowerCase();
                                const visiveis = pedidos
                                    .map((ped, pIdx) => ({ ped, pIdx }))
                                    .filter(({ ped }) => !termo ||
                                        (ped.numero_pedido || '').toLowerCase().includes(termo) ||
                                        (ped.empresa || '').toLowerCase().includes(termo) ||
                                        (ped.cidade_destino || '').toLowerCase().includes(termo));
                                if (visiveis.length === 0) return (
                                    <div className="flex flex-col items-center justify-center py-8 gap-1 rounded-xl border border-dashed" style={{ borderColor: 'var(--color-border)' }}>
                                        <Icon name="SearchX" size={20} color="var(--color-muted-foreground)" />
                                        <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>Nenhum pedido encontrado para "{buscaPedido}"</p>
                                    </div>
                                );
                                return visiveis.map(({ ped, pIdx }) => {
                                const freteMulti = calcularFretePedidoMulti(ped);
                                const frete = freteMulti.total;
                                const temExtras = (ped.categorias_extra || []).some(e => Number(e.valor) > 0);
                                const pct   = (FRETE_CATEGORIAS || []).find(f => f.categoria === ped.categoria_frete)?.percentual || 0;
                                const aberto = openPedidos.has(pIdx);
                                return (
                                    <div key={pIdx} className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
                                        {/* Cabeçalho pedido — clique expande/recolhe */}
                                        <div onClick={() => togglePedido(pIdx)}
                                            className="flex items-center justify-between px-4 py-2 border-b cursor-pointer select-none"
                                            style={{ backgroundColor: 'var(--color-subtle)', borderColor: 'var(--color-border)' }}>
                                            <div className="flex items-center gap-2 min-w-0">
                                                <Icon name={aberto ? 'ChevronDown' : 'ChevronRight'} size={14} color="var(--color-muted-foreground)" />
                                                <span className="text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0" style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}>
                                                    Pedido #{pIdx + 1}
                                                </span>
                                                {ped.numero_pedido && <span className="text-xs font-mono font-semibold" style={{ color: 'var(--color-primary)' }}>#{ped.numero_pedido}</span>}
                                                {!aberto && ped.empresa && <span className="text-xs truncate" style={{ color: 'var(--color-muted-foreground)' }}>{ped.empresa}</span>}
                                                {!aberto && ped.itens?.length > 0 && <span className="text-xs flex-shrink-0" style={{ color: 'var(--color-muted-foreground)' }}>· {ped.itens.length} item(s)</span>}
                                                {frete > 0 && <span className="text-xs font-semibold flex-shrink-0" style={{ color: '#059669' }}>Frete: {brl(frete)} ({temExtras ? `${(freteMulti.percentualEfetivo*100).toFixed(1)}% médio` : `${(pct * 100).toFixed(0)}%`})</span>}
                                            </div>
                                            {pedidos.length > 1 && (
                                                <button onClick={e => { e.stopPropagation(); delPedido(pIdx); }} className="text-xs flex items-center gap-1 flex-shrink-0" style={{ color: '#DC2626' }}>
                                                    <Icon name="X" size={12} color="#DC2626" /> Remover
                                                </button>
                                            )}
                                        </div>

                                        {aberto && (
                                        <div className="p-4 space-y-3">
                                            {/* Campos do pedido */}
                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                                <div>
                                                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Nº do Pedido</label>
                                                    <input value={ped.numero_pedido} onChange={e => updPedido(pIdx, { numero_pedido: e.target.value })} className={inputCls} style={inputStyle} placeholder="Ex: 37443" />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Empresa</label>
                                                    <select value={ped.empresa} onChange={e => updPedido(pIdx, { empresa: e.target.value })} className={inputCls} style={inputStyle}>
                                                        {['Comercial Araguaia', 'Aços Confiance', 'Confiance'].map(e => <option key={e} value={e}>{e}</option>)}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Valor do Pedido (R$)</label>
                                                    <input type="number" step="0.01" min="0" value={ped.valor_pedido} onChange={e => updPedido(pIdx, { valor_pedido: e.target.value })} className={inputCls} style={inputStyle} placeholder="0,00" />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Categoria de Frete</label>
                                                    <select value={ped.categoria_frete} onChange={e => updPedido(pIdx, { categoria_frete: e.target.value })} className={inputCls} style={inputStyle}>
                                                        {(FRETE_CATEGORIAS || []).map(f => <option key={f.categoria} value={f.categoria}>{f.label || f.categoria} ({(f.percentual * 100).toFixed(0)}%)</option>)}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Cidade Destino do Pedido</label>
                                                    <input value={ped.cidade_destino} onChange={e => updPedido(pIdx, { cidade_destino: e.target.value })} className={inputCls} style={inputStyle} placeholder={form.destino || 'Cidade'} />
                                                </div>
                                                <div className="flex items-end">
                                                    <div className="w-full p-2.5 rounded-lg border" style={{ backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }}>
                                                        <p className="text-xs" style={{ color: '#065F46' }}>Frete calculado</p>
                                                        <p className="text-sm font-bold" style={{ color: '#059669' }}>{brl(frete)}</p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Categorias extras — quando o pedido mistura materiais de mais de uma
                                                categoria de frete, cada uma com seu próprio percentual */}
                                            <div className="rounded-lg border p-3" style={{ borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' }}>
                                                <div className="flex items-center justify-between mb-2">
                                                    <label className="text-xs font-medium" style={{ color: 'var(--color-text-primary)' }}>
                                                        Outras categorias neste pedido
                                                    </label>
                                                    <button type="button" onClick={() => addCategoriaExtra(pIdx)}
                                                        className="flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg hover:bg-blue-50"
                                                        style={{ color: 'var(--color-primary)' }}>
                                                        <Icon name="Plus" size={12} /> Adicionar categoria
                                                    </button>
                                                </div>
                                                {(ped.categorias_extra || []).length === 0 ? (
                                                    <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                                                        Use isso quando o pedido tiver materiais de mais de uma categoria (ex: Telha 2% + Vergalhão 6% no mesmo pedido).
                                                    </p>
                                                ) : (
                                                    <div className="flex flex-col gap-2">
                                                        <p className="text-[11px]" style={{ color: 'var(--color-muted-foreground)' }}>
                                                            A categoria principal acima ({ped.categoria_frete}) passa a valer sobre o restante do valor do pedido: {brl(freteMulti.valorPrincipal)}.
                                                        </p>
                                                        {ped.categorias_extra.map((extra, eIdx) => (
                                                            <div key={eIdx} className="flex items-center gap-2">
                                                                <select value={extra.categoria}
                                                                    onChange={e => updCategoriaExtra(pIdx, eIdx, { categoria: e.target.value })}
                                                                    className="flex-1 h-9 px-2 rounded-lg border border-gray-200 text-xs bg-white">
                                                                    {(FRETE_CATEGORIAS || []).map(f => <option key={f.categoria} value={f.categoria}>{f.label || f.categoria} ({(f.percentual * 100).toFixed(0)}%)</option>)}
                                                                </select>
                                                                <input type="number" min="0" step="0.01" value={extra.valor}
                                                                    onChange={e => updCategoriaExtra(pIdx, eIdx, { valor: e.target.value })}
                                                                    placeholder="Valor (R$)"
                                                                    className="w-32 h-9 px-3 rounded-lg border border-gray-200 text-xs bg-white font-mono" />
                                                                <button type="button" onClick={() => delCategoriaExtra(pIdx, eIdx)}
                                                                    className="p-1.5 rounded-lg hover:bg-red-50 flex-shrink-0">
                                                                    <Icon name="X" size={14} color="#DC2626" />
                                                                </button>
                                                            </div>
                                                        ))}
                                                        {freteMulti.valorExtras > Number(ped.valor_pedido || 0) && (
                                                            <p className="text-xs text-red-600 flex items-center gap-1">
                                                                <Icon name="AlertTriangle" size={12} />
                                                                A soma das categorias extras ultrapassa o valor do pedido.
                                                            </p>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Itens / Materiais do pedido */}
                                            <div className="rounded-lg border p-3" style={{ borderColor: '#E9D5FF', backgroundColor: '#FAF5FF' }}>
                                                <div className="flex items-center justify-between mb-2">
                                                    <p className="text-xs font-semibold" style={{ color: '#6D28D9' }}>📦 Materiais / Itens</p>
                                                    <button onClick={() => addItem(pIdx)} className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-white" style={{ backgroundColor: '#7C3AED' }}>
                                                        <Icon name="Plus" size={11} color="white" /> Adicionar
                                                    </button>
                                                </div>
                                                {ped.itens.length === 0 ? (
                                                    <div className="flex flex-col items-center justify-center py-4 gap-1"><Icon name="Package" size={18} color="var(--color-muted-foreground)" /><p className="text-xs text-center" style={{ color: 'var(--color-muted-foreground)' }}>Nenhum material adicionado</p></div>
                                                ) : (
                                                    <div className="space-y-2">
                                                        {ped.itens.map((item, iIdx) => {
                                                            const mat = (materials || []).find(m => m.id === item.material_id);
                                                            const isTelha = item.is_telha_zinco || mat?.is_telha_zinco;
                                                            if (isTelha) {
                                                                return (
                                                                    <div key={iIdx} className="grid grid-cols-4 gap-2 items-end bg-white rounded-lg p-2 border" style={{ borderColor: '#DDD6FE' }}>
                                                                        <div className="col-span-4 sm:col-span-1">
                                                                            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Material</label>
                                                                            <select value={item.material_id} onChange={e => updItem(pIdx, iIdx, { material_id: e.target.value })} className={inputCls} style={{ ...inputStyle, fontSize: '11px', padding: '6px 8px' }}>
                                                                                <option value="">Selecione...</option>
                                                                                {(materials || []).map(m => <option key={m.id} value={m.id}>{m.nome} {m.peso ? `(${m.peso}kg/${m.unidade})` : ''}</option>)}
                                                                            </select>
                                                                        </div>
                                                                        <div>
                                                                            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Comp. (m)</label>
                                                                            <input type="number" min="0.5" step="0.5" value={item.comprimento_telha} onChange={e => updItem(pIdx, iIdx, { comprimento_telha: e.target.value })} placeholder="Ex: 2.5" className={inputCls} style={{ ...inputStyle, fontSize: '12px', padding: '6px 8px' }} />
                                                                        </div>
                                                                        <div>
                                                                            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Metros totais</label>
                                                                            <input type="number" min="0" step="0.01" value={item.metros_totais} onChange={e => updItem(pIdx, iIdx, { metros_totais: e.target.value })} placeholder="Ex: 100" className={inputCls} style={{ ...inputStyle, fontSize: '12px', padding: '6px 8px' }} />
                                                                        </div>
                                                                        <div className="flex items-end gap-1">
                                                                            <div className="flex-1">
                                                                                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Peças / Peso</label>
                                                                                <div className="px-2 py-1.5 rounded-lg border bg-gray-50 text-xs font-data" style={{ borderColor: '#DDD6FE' }}>
                                                                                    {item.quantidade ? `${item.quantidade} pç` : '—'} · {item.peso_total ? `${Number(item.peso_total).toLocaleString('pt-BR')} kg` : '—'}
                                                                                </div>
                                                                            </div>
                                                                            <button onClick={() => delItem(pIdx, iIdx)} className="mb-0.5 p-1.5 rounded-lg hover:bg-red-50 transition-colors flex-shrink-0">
                                                                                <Icon name="X" size={12} color="#DC2626" />
                                                                            </button>
                                                                        </div>
                                                                        {!item.comprimento_telha && (
                                                                            <p className="col-span-4 text-[11px] flex items-center gap-1" style={{ color: '#B45309' }}>
                                                                                <Icon name="AlertTriangle" size={11} color="#B45309" /> Informe o comprimento de cada telha (m) para calcular peças e peso.
                                                                            </p>
                                                                        )}
                                                                    </div>
                                                                );
                                                            }
                                                            return (
                                                                <div key={iIdx} className="grid grid-cols-4 gap-2 items-end bg-white rounded-lg p-2 border" style={{ borderColor: '#DDD6FE' }}>
                                                                    <div className="col-span-2">
                                                                        <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Material</label>
                                                                        <select value={item.material_id} onChange={e => updItem(pIdx, iIdx, { material_id: e.target.value })} className={inputCls} style={{ ...inputStyle, fontSize: '11px', padding: '6px 8px' }}>
                                                                            <option value="">Selecione...</option>
                                                                            {(materials || []).map(m => <option key={m.id} value={m.id}>{m.nome} {m.peso ? `(${m.peso}kg/${m.unidade})` : ''}</option>)}
                                                                        </select>
                                                                    </div>
                                                                    <div>
                                                                        <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Qtd ({mat?.unidade || 'un'})</label>
                                                                        <input type="number" min="1" value={item.quantidade} onChange={e => updItem(pIdx, iIdx, { quantidade: e.target.value })} className={inputCls} style={{ ...inputStyle, fontSize: '12px', padding: '6px 8px' }} />
                                                                    </div>
                                                                    <div className="flex items-end gap-1">
                                                                        <div className="flex-1">
                                                                            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Peso (kg)</label>
                                                                            <input type="number" min="0" step="0.1" value={item.peso_total !== '' ? item.peso_total : (item.peso_unit && item.quantidade ? String(Math.round(Number(item.peso_unit) * Number(item.quantidade) * 100) / 100) : '')} onChange={e => updItem(pIdx, iIdx, { peso_total: e.target.value, _manualPeso: true })} className={inputCls} style={{ ...inputStyle, fontSize: '12px', padding: '6px 8px' }} placeholder="auto" />
                                                                        </div>
                                                                        <button onClick={() => delItem(pIdx, iIdx)} className="mb-0.5 p-1.5 rounded-lg hover:bg-red-50 transition-colors flex-shrink-0">
                                                                            <Icon name="X" size={12} color="#DC2626" />
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                                {ped.itens.length > 0 && (
                                                    <p className="text-xs mt-2 font-medium" style={{ color: '#6D28D9' }}>
                                                        Peso do pedido: <strong>{ped.itens.reduce((s, i) => s + Number(i.peso_total || 0), 0).toLocaleString('pt-BR')} kg</strong>
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        )}
                                    </div>
                                );
                                });
                            })()}

                            {/* Resumo totais */}
                            <div className="grid grid-cols-3 gap-3">
                                {[
                                    { label: 'Frete Total', value: brl(totais.frete), color: '#059669', bg: '#ECFDF5' },
                                    { label: 'Valor Carga', value: brl(totais.valorCarga), color: '#1D4ED8', bg: '#EFF6FF' },
                                    { label: 'Peso Total', value: totais.peso > 0 ? `${totais.peso.toLocaleString('pt-BR')} kg` : '—', color: '#7C3AED', bg: '#FAF5FF' },
                                ].map(s => (
                                    <div key={s.label} className="p-3 rounded-xl border text-center" style={{ backgroundColor: s.bg, borderColor: s.color + '44' }}>
                                        <p className="text-xs mb-1" style={{ color: s.color }}>{s.label}</p>
                                        <p className="text-sm font-bold" style={{ color: s.color }}>{s.value}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ── ABA: Sugestão IA ── */}
                    {tab === 'ia' && (
                        <div className="space-y-4">
                            <div className="p-4 rounded-xl border" style={{ backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }}>
                                <div className="flex items-center justify-between mb-3">
                                    <div>
                                        <p className="text-sm font-semibold" style={{ color: '#065F46' }}>🚛 Sugestão de Veículo</p>
                                        <p className="text-xs mt-0.5" style={{ color: '#059669' }}>Analisa peso, pedidos e veículos disponíveis para recomendar o melhor para esta viagem.</p>
                                    </div>
                                    <button onClick={sugerirVeiculo} disabled={aiLoading}
                                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white disabled:opacity-60 flex-shrink-0 ml-3"
                                        style={{ backgroundColor: '#059669' }}>
                                        {aiLoading
                                            ? <><div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> Consultando...</>
                                            : <><Icon name="Truck" size={13} color="white" /> Sugerir veículo</>}
                                    </button>
                                </div>
                                {aiSugestao ? (
                                    <div className="p-3 rounded-xl bg-white border" style={{ borderColor: '#BBF7D0' }}>
                                        <p className="text-xs leading-relaxed" style={{ color: '#065F46' }}>{aiSugestao}</p>
                                    </div>
                                ) : (
                                    <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>Adicione pedidos e clique em "Sugerir veículo".</p>
                                )}
                            </div>
                            <div className="p-4 rounded-xl border" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-subtle)' }}>
                                <p className="text-xs font-semibold mb-3" style={{ color: 'var(--color-text-secondary)' }}>RESUMO DA CARGA</p>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div><span style={{ color: 'var(--color-muted-foreground)' }}>Peso total:</span> <strong>{totais.peso > 0 ? `${totais.peso.toLocaleString('pt-BR')} kg` : '—'}</strong></div>
                                    <div><span style={{ color: 'var(--color-muted-foreground)' }}>Frete total:</span> <strong style={{ color: '#059669' }}>{brl(totais.frete)}</strong></div>
                                    <div><span style={{ color: 'var(--color-muted-foreground)' }}>Valor carga:</span> <strong>{brl(totais.valorCarga)}</strong></div>
                                    <div><span style={{ color: 'var(--color-muted-foreground)' }}>Nº pedidos:</span> <strong>{pedidos.filter(p => p.numero_pedido).length}</strong></div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-5 py-4 border-t flex-shrink-0" style={{ borderColor: 'var(--color-border)' }}>
                    <button onClick={onClose} className="px-4 py-2 rounded-xl border text-sm font-medium" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>
                        Cancelar
                    </button>
                    <button onClick={handleSave} disabled={saving}
                        className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-60"
                        style={{ backgroundColor: '#D97706' }}>
                        {saving
                            ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Salvando...</>
                            : <><Icon name="Save" size={14} color="white" /> {isEdit ? 'Salvar Alterações' : 'Criar Rascunho'}</>}
                    </button>
                </div>
            </div>
        </div>
    );
}
