import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { useToast } from 'hooks/useToast';
import { useConfirm, NavigationBar, BreadcrumbTrail, AppIcon as Icon, Button, Toast } from 'components';
import { periodoDeDatas, periodoDoMes, fetchRomaneios, fetchRascunhos, fetchMotoristasComId, STATUS_SEMPRE_VISIVEIS, updateRomaneio, createRomaneio, updateRomaneioStatus, deleteRomaneio, duplicateRomaneio, deleteRascunho, promoverRascunho, updateRascunho, createRascunho } from 'services/romaneio';
import { fetchMaterials } from 'services/materialService';
import { fetchVehicles } from 'services/vehicleService';
import { subscribeTabela } from 'services/supabaseClient';
import { useRecarregarAoVoltar } from 'hooks/useRecarregarAoVoltar';
import { exportRomaneiosToExcel } from 'utils/excel';
import RascunhoFormModal from './components/RascunhoFormModal';
import ResumoMateriaisCidadeModal from './components/ResumoMateriaisCidadeModal';
import RomaneioFormModal from './components/RomaneioFormModal';
import RomaneioDetailModal from './components/RomaneioDetailModal';
import RomaneioImportModal from './components/RomaneioImportModal';
import TabRomaneios from './components/TabRomaneios';
import GuiaRascunhos from './components/GuiaRascunhos';

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
    // Padrão: só o mês corrente (mês de exercício). Limpar o filtro mostra todos.
    const [filtroMes, setFiltroMes] = useState(() => { const h = new Date(); return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}`; });
    const [usarPeriodo, setUsarPeriodo] = useState(false);
    const [periodoCustom, setPeriodoCustom] = useState({ inicio: '', fim: '' });
    const [formModal, setFormModal] = useState({ open: false, romaneio: null });
    const [detailModal, setDetailModal] = useState({ open: false, romaneio: null });
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 10;
    const { toast, showToast } = useToast();
    const [importModal, setImportModal] = useState(false);
    const { confirm, ConfirmDialog } = useConfirm();
    // Ref para rastrear IDs cujo status está sendo atualizado
    // Evita que o realtime sobrescreva o status durante uma atualização em andamento
    const updatingIdsRef = useRef(new Set());

    // Período enviado ao servidor: só carrega o mês escolhido (ou o intervalo personalizado)
    const periodoServidor = useMemo(() => {
        if (usarPeriodo && (periodoCustom.inicio || periodoCustom.fim)) return periodoDeDatas(periodoCustom.inicio, periodoCustom.fim);
        if (filtroMes) return periodoDoMes(filtroMes);
        return null;
    }, [usarPeriodo, periodoCustom, filtroMes]);
    const periodoRef = useRef(periodoServidor);
    periodoRef.current = periodoServidor;
    const montadoRef = useRef(false);

    // Carrega APENAS romaneios (usado pelo Realtime — não recarrega veículos/materiais desnecessariamente)
    const loadRomaneios = useCallback(async () => {
        try {
            const rom = await fetchRomaneios(periodoRef.current);
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
                fetchRomaneios(periodoRef.current), fetchMaterials(), fetchVehicles(),
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

    // Trocou o mês/período → busca só o novo recorte no servidor (a 1ª carga já usa o período inicial)
    useEffect(() => {
        if (!montadoRef.current) { montadoRef.current = true; return; }
        loadRomaneios();
    }, [periodoServidor]); // eslint-disable-line

    const filtered = useMemo(() => {
        return romaneios.filter(r => {
            const q = search.toLowerCase();
            const matchSearch = !q || r.numero?.toLowerCase().includes(q) || r.motorista?.toLowerCase().includes(q) || r.destino?.toLowerCase().includes(q) || r.placa?.toLowerCase().includes(q);
            // Comparação case-insensitive para garantir que "Cancelado" == "cancelado"
            const matchStatus = filterStatus === 'Todos' || (r.status || '').toLowerCase() === filterStatus.toLowerCase();
            let matchData = true;
            // Referência: saída; sem saída (ex.: Aguardando) vale a data de criação
            const dataRef = (r.saida || r.created_at) ? String(r.saida || r.created_at).slice(0, 10) : null;
            // Na estrada (Carregando/Em Trânsito) sempre aparece, mesmo que tenha saído em outro mês
            const naEstrada = STATUS_SEMPRE_VISIVEIS.includes(r.status);
            if (naEstrada) { /* sempre visível */ }
            else if (usarPeriodo && (periodoCustom.inicio || periodoCustom.fim)) {
                if (!dataRef) matchData = false;
                else {
                    if (periodoCustom.inicio && dataRef < periodoCustom.inicio) matchData = false;
                    if (periodoCustom.fim && dataRef > periodoCustom.fim) matchData = false;
                }
            } else if (filtroMes) {
                matchData = !!dataRef && dataRef.slice(0, 7) === filtroMes;
            }
            return matchSearch && matchStatus && matchData;
        });
    }, [romaneios, search, filterStatus, filtroMes, usarPeriodo, periodoCustom]);

    // Volta pra página 1 sempre que busca/filtro muda — evita cair numa
    // página que não existe mais pro novo resultado filtrado.
    useEffect(() => { setPage(1); }, [search, filterStatus, filtroMes, usarPeriodo, periodoCustom]);

    // Só exibe (renderiza) 10 romaneios por vez — os demais já estão
    // carregados em memória, mas ficam fora da tela até o usuário navegar,
    // reduzindo a quantidade de linhas montadas de uma vez.
    const totalPaginas = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const paginaSegura = Math.min(page, totalPaginas);
    const paginado = useMemo(() =>
        filtered.slice((paginaSegura - 1) * PAGE_SIZE, paginaSegura * PAGE_SIZE),
    [filtered, paginaSegura]);

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
                <div className="max-w-[1920px] mx-auto px-4 tab:px-6 lg:px-8 py-6">
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

                    {guia === 'romaneios' && (<TabRomaneios
                    PAGE_SIZE={PAGE_SIZE}
                    filterStatus={filterStatus}
                    filtered={filtered}
                    filtroMes={filtroMes}
                    handleDelete={handleDelete}
                    handleStatusChange={handleStatusChange}
                    loading={loading}
                    metrics={metrics}
                    paginaSegura={paginaSegura}
                    paginado={paginado}
                    periodoCustom={periodoCustom}
                    romaneios={romaneios}
                    search={search}
                    setDetailModal={setDetailModal}
                    setFilterStatus={setFilterStatus}
                    setFiltroMes={setFiltroMes}
                    setFormModal={setFormModal}
                    setPage={setPage}
                    setPeriodoCustom={setPeriodoCustom}
                    setSearch={setSearch}
                    setUsarPeriodo={setUsarPeriodo}
                    totalPaginas={totalPaginas}
                    usarPeriodo={usarPeriodo}
                />)} {/* fim guia romaneios */}

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
