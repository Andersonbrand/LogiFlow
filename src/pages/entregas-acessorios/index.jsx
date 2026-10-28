import React, { useState, useCallback, useEffect, useMemo } from 'react';

import { useAuth } from 'context/AuthContext';
import { useToast } from 'hooks/useToast';
import { useConfirm, usePeriodRangeFilter, NavigationBar, BreadcrumbTrail, AppIcon as Icon, Button, PeriodRangeFilter, Toast } from 'components';
import { fetchEntregasAcessorios, fetchItensAcessorios, createEntregaAcessorio, updateEntregaAcessorio, deleteEntregaAcessorio, createItemAcessorio, updateItemAcessorio, deleteItemAcessorio } from 'services/entregasAcessoriosService';
import { fetchMotoristasProprios, fetchVeiculosProprios } from 'services/carretas';
import { fetchVehicles } from 'services/vehicleService';
import { useRecarregarAoVoltar } from 'hooks/useRecarregarAoVoltar';

import SearchSelect from './components/SearchSelect';
import SearchInput from './components/SearchInput';
import Modal from './components/Modal';
import ModalItens from './components/ModalItens';

const FMT_DATE = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—';

const FORM_VAZIO = { motorista_id: '', placa: '', item: '', quantidade: '1', data_entrega: new Date().toISOString().split('T')[0], observacoes: '' };

export default function EntregasAcessorios() {
    const { profile, isAdmin } = useAuth();
    const admin = isAdmin();
    const { toast, showToast } = useToast();
    const { confirm, ConfirmDialog } = useConfirm();

    const [entregas, setEntregas]   = useState([]);
    const [motoristas, setMotoristas] = useState([]);
    const [placasSugeridas, setPlacasSugeridas] = useState([]);
    const [itensCatalogo, setItensCatalogo] = useState([]);
    const [loading, setLoading]     = useState(true);
    const [pesquisa, setPesquisa]   = useState('');
    const [filtroMotorista, setFiltroMotorista] = useState('');
    const [filtroItem, setFiltroItem] = useState('');
    const { preset: periodoPreset, periodo, onPresetChange: aplicarPeriodoPreset, setPeriodo } = usePeriodRangeFilter('todos');

    const [modal, setModal] = useState(null); // null | { mode: 'create' | 'edit', data? }
    const [form, setForm] = useState(FORM_VAZIO);
    const [saving, setSaving] = useState(false);
    const [modalItens, setModalItens] = useState(false); // gerenciar catálogo de itens (admin)

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const f = {};
            if (periodoPreset === 'personalizado' && (periodo.inicio || periodo.fim)) {
                if (periodo.inicio) f.dataInicio = periodo.inicio;
                if (periodo.fim)    f.dataFim = periodo.fim;
            }
            const [e, m, vCarretas, vCaminhoes, itens] = await Promise.all([
                fetchEntregasAcessorios(f),
                fetchMotoristasProprios(),
                fetchVeiculosProprios().catch(() => []),
                fetchVehicles().catch(() => []),
                fetchItensAcessorios().catch(() => []),
            ]);
            setEntregas(e);
            setMotoristas(m);
            setItensCatalogo(itens);
            const placas = [
                ...(vCarretas || []).map(v => v.placa),
                ...(vCaminhoes || []).map(v => v.placa),
            ].filter(Boolean);
            setPlacasSugeridas([...new Set(placas)].sort());
        } catch (e) { showToast('Erro ao carregar: ' + e.message, 'error'); }
        finally { setLoading(false); }
    }, [periodoPreset, periodo]); // eslint-disable-line
    useEffect(() => { load(); }, [load]);
    useRecarregarAoVoltar(load);

    const entregasFiltradas = useMemo(() => entregas.filter(e => {
        if (filtroMotorista && e.motorista_id !== filtroMotorista) return false;
        if (filtroItem && e.item !== filtroItem) return false;
        if (pesquisa.trim()) {
            const q = pesquisa.toLowerCase();
            return (
                (e.motorista?.name || '').toLowerCase().includes(q) ||
                (e.placa || '').toLowerCase().includes(q) ||
                (e.item || '').toLowerCase().includes(q) ||
                (e.observacoes || '').toLowerCase().includes(q)
            );
        }
        return true;
    }), [entregas, filtroMotorista, filtroItem, pesquisa]);

    // ── Rankings / resumo ──────────────────────────────────────────────────────
    const resumo = useMemo(() => {
        const porItem = {};
        const porMotorista = {};
        entregasFiltradas.forEach(e => {
            const qtd = Number(e.quantidade || 0);
            porItem[e.item] = (porItem[e.item] || 0) + qtd;
            const nome = e.motorista?.name || 'Sem motorista';
            if (!porMotorista[nome]) porMotorista[nome] = { nome, entregas: 0, quantidade: 0 };
            porMotorista[nome].entregas += 1;
            porMotorista[nome].quantidade += qtd;
        });
        const itensRanking = Object.entries(porItem).sort((a, b) => b[1] - a[1]);
        const motoristasRanking = Object.values(porMotorista).sort((a, b) => b.quantidade - a.quantidade);
        return {
            totalItens: entregasFiltradas.reduce((s, e) => s + Number(e.quantidade || 0), 0),
            totalRegistros: entregasFiltradas.length,
            itensRanking,
            motoristasRanking,
            itemTop: itensRanking[0] || null,
            motoristaTop: motoristasRanking[0] || null,
        };
    }, [entregasFiltradas]);

    const itensDisponiveis = useMemo(() => {
        const doCatalogo = itensCatalogo.map(i => i.nome);
        const doHistorico = entregas.map(e => e.item).filter(Boolean);
        return [...new Set([...doCatalogo, ...doHistorico])].sort();
    }, [itensCatalogo, entregas]);

    // ── CRUD ──────────────────────────────────────────────────────────────────
    const abrirNova = () => { setForm(FORM_VAZIO); setModal({ mode: 'create' }); };
    const abrirEdit = e => {
        setForm({
            motorista_id: e.motorista_id || '',
            placa: e.placa || '',
            item: e.item || '',
            quantidade: String(e.quantidade ?? '1'),
            data_entrega: e.data_entrega || '',
            observacoes: e.observacoes || '',
        });
        setModal({ mode: 'edit', data: e });
    };

    const salvar = async () => {
        if (!form.motorista_id) { showToast('Selecione o motorista', 'error'); return; }
        if (!form.placa.trim()) { showToast('Informe a placa', 'error'); return; }
        if (!form.item.trim())  { showToast('Informe o item entregue', 'error'); return; }
        if (!form.quantidade || Number(form.quantidade) <= 0) { showToast('Informe uma quantidade válida', 'error'); return; }
        setSaving(true);
        try {
            const payload = {
                motorista_id: form.motorista_id,
                placa: form.placa.trim().toUpperCase(),
                item: form.item.trim(),
                quantidade: Number(form.quantidade),
                data_entrega: form.data_entrega || new Date().toISOString().split('T')[0],
                observacoes: form.observacoes || null,
            };
            if (modal.mode === 'create') {
                await createEntregaAcessorio({ ...payload, criado_por: profile?.id || null });
            } else {
                await updateEntregaAcessorio(modal.data.id, payload);
            }
            showToast('Entrega registrada!', 'success');
            setModal(null); load();
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
        finally { setSaving(false); }
    };

    const excluir = async id => {
        const ok = await confirm({ title: 'Excluir entrega?', message: 'Esta ação não pode ser desfeita.', confirmLabel: 'Excluir', variant: 'danger' });
        if (!ok) return;
        try { await deleteEntregaAcessorio(id); showToast('Excluída!', 'success'); load(); }
        catch (e) { showToast('Erro ao excluir: ' + e.message, 'error'); }
    };

    // ── Catálogo de itens (admin) ───────────────────────────────────────────────
    const [novoItemNome, setNovoItemNome] = useState('');
    const [editandoItem, setEditandoItem] = useState(null); // { id, nome }
    const [savingItem, setSavingItem] = useState(false);

    const recarregarCatalogo = async () => {
        try { setItensCatalogo(await fetchItensAcessorios()); }
        catch (e) { showToast('Erro ao recarregar itens: ' + e.message, 'error'); }
    };

    const criarItem = async () => {
        const nome = novoItemNome.trim();
        if (!nome) return;
        setSavingItem(true);
        try {
            await createItemAcessorio({ nome, criado_por: profile?.id || null });
            setNovoItemNome('');
            showToast('Item adicionado!', 'success');
            await recarregarCatalogo();
        } catch (e) {
            const msg = /duplicate key|unique constraint/i.test(e.message) ? 'Já existe um item com esse nome.' : 'Erro: ' + e.message;
            showToast(msg, 'error');
        } finally { setSavingItem(false); }
    };

    const salvarEdicaoItem = async () => {
        if (!editandoItem?.nome?.trim()) return;
        setSavingItem(true);
        try {
            await updateItemAcessorio(editandoItem.id, { nome: editandoItem.nome.trim() });
            setEditandoItem(null);
            showToast('Item atualizado!', 'success');
            await recarregarCatalogo();
        } catch (e) {
            const msg = /duplicate key|unique constraint/i.test(e.message) ? 'Já existe um item com esse nome.' : 'Erro: ' + e.message;
            showToast(msg, 'error');
        } finally { setSavingItem(false); }
    };

    const excluirItem = async item => {
        const ok = await confirm({ title: `Excluir "${item.nome}"?`, message: 'O item deixa de aparecer na lista de seleção. Entregas já registradas com ele não são afetadas.', confirmLabel: 'Excluir', variant: 'danger' });
        if (!ok) return;
        try { await deleteItemAcessorio(item.id); showToast('Item excluído!', 'success'); await recarregarCatalogo(); }
        catch (e) { showToast('Erro ao excluir: ' + e.message, 'error'); }
    };

    return (
        <div className="min-h-screen" style={{ backgroundColor: 'var(--color-background)' }}>
            <NavigationBar />
            <main className="main-content">
                <div className="max-w-[1920px] mx-auto px-4 sm:px-6 py-6">
                    <BreadcrumbTrail className="mb-4" />

                    <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
                        <div>
                            <h1 className="font-heading font-bold text-xl sm:text-2xl" style={{ color: 'var(--color-text-primary)' }}>
                                Entregas de Acessórios
                            </h1>
                            <p className="text-xs sm:text-sm font-caption" style={{ color: 'var(--color-muted-foreground)' }}>
                                Registro de itens entregues aos motoristas — cintas, catracas, coletes, produtos de limpeza e outros
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={() => setModalItens(true)}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50 transition-colors"
                                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}>
                                <Icon name="ListTodo" size={14} /> Gerenciar itens
                            </button>
                            <Button onClick={abrirNova} size="sm" iconName="Plus">Nova entrega</Button>
                        </div>
                    </div>

                    {/* Cards de resumo */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
                        <div className="bg-white rounded-xl border p-4 shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
                            <p className="text-xs mb-1" style={{ color: 'var(--color-muted-foreground)' }}>Total de itens entregues</p>
                            <p className="text-2xl font-bold font-data" style={{ color: 'var(--color-text-primary)' }}>{resumo.totalItens}</p>
                        </div>
                        <div className="bg-white rounded-xl border p-4 shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
                            <p className="text-xs mb-1" style={{ color: 'var(--color-muted-foreground)' }}>Registros de entrega</p>
                            <p className="text-2xl font-bold font-data" style={{ color: 'var(--color-text-primary)' }}>{resumo.totalRegistros}</p>
                        </div>
                        <div className="bg-white rounded-xl border p-4 shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
                            <p className="text-xs mb-1" style={{ color: 'var(--color-muted-foreground)' }}>Item mais distribuído</p>
                            <p className="text-base font-bold break-words" style={{ color: '#1D4ED8' }}>{resumo.itemTop ? resumo.itemTop[0] : '—'}</p>
                            {resumo.itemTop && <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>{resumo.itemTop[1]} unidade(s)</p>}
                        </div>
                        <div className="bg-white rounded-xl border p-4 shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
                            <p className="text-xs mb-1" style={{ color: 'var(--color-muted-foreground)' }}>Motorista com mais retiradas</p>
                            <p className="text-base font-bold break-words" style={{ color: '#059669' }}>{resumo.motoristaTop ? resumo.motoristaTop.nome : '—'}</p>
                            {resumo.motoristaTop && <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>{resumo.motoristaTop.quantidade} item(ns) · {resumo.motoristaTop.entregas} entrega(s)</p>}
                        </div>
                    </div>

                    {/* Rankings */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
                        <div className="bg-white rounded-xl border p-4 shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
                            <p className="text-xs font-semibold mb-3 flex items-center gap-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                                <Icon name="Package" size={13} /> Itens mais distribuídos
                            </p>
                            {resumo.itensRanking.length === 0 ? (
                                <p className="text-xs text-center py-4" style={{ color: 'var(--color-muted-foreground)' }}>Sem dados no período.</p>
                            ) : (
                                <div className="space-y-2">
                                    {resumo.itensRanking.slice(0, 6).map(([item, qtd], idx) => {
                                        const max = resumo.itensRanking[0][1] || 1;
                                        return (
                                            <div key={item}>
                                                <div className="flex justify-between text-xs mb-1">
                                                    <span style={{ color: 'var(--color-text-primary)' }}>{idx + 1}. {item}</span>
                                                    <span className="font-data font-medium">{qtd}</span>
                                                </div>
                                                <div className="w-full h-1.5 rounded-full bg-gray-100 overflow-hidden">
                                                    <div className="h-full rounded-full" style={{ width: `${(qtd / max) * 100}%`, backgroundColor: '#1D4ED8' }} />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                        <div className="bg-white rounded-xl border p-4 shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
                            <p className="text-xs font-semibold mb-3 flex items-center gap-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                                <Icon name="Trophy" size={13} /> Ranking de motoristas
                            </p>
                            {resumo.motoristasRanking.length === 0 ? (
                                <p className="text-xs text-center py-4" style={{ color: 'var(--color-muted-foreground)' }}>Sem dados no período.</p>
                            ) : (
                                <div className="space-y-2">
                                    {resumo.motoristasRanking.slice(0, 6).map((m, idx) => (
                                        <div key={m.nome} className="flex items-center justify-between text-xs py-1.5 border-b last:border-b-0" style={{ borderColor: 'var(--color-border)' }}>
                                            <span className="flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
                                                <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                                                    style={{ backgroundColor: idx === 0 ? '#FEF3C7' : '#F3F4F6', color: idx === 0 ? '#D97706' : '#6B7280' }}>{idx + 1}</span>
                                                {m.nome}
                                            </span>
                                            <span className="font-data" style={{ color: 'var(--color-muted-foreground)' }}>{m.quantidade} itens · {m.entregas} entregas</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Toolbar */}
                    <div className="flex flex-wrap items-center gap-3 mb-4">
                        <div className="w-48">
                            <SearchSelect
                                value={filtroMotorista}
                                onChange={setFiltroMotorista}
                                options={motoristas.map(m => ({ value: m.id, label: m.name }))}
                                placeholder="Todos os motoristas"
                                allowClear
                                clearLabel="Todos os motoristas"
                            />
                        </div>
                        <div className="w-48">
                            <SearchSelect
                                value={filtroItem}
                                onChange={setFiltroItem}
                                options={itensDisponiveis.map(i => ({ value: i, label: i }))}
                                placeholder="Todos os itens"
                                allowClear
                                clearLabel="Todos os itens"
                            />
                        </div>
                        <PeriodRangeFilter presets={['personalizado']} preset={periodoPreset} onPresetChange={aplicarPeriodoPreset} periodo={periodo} onPeriodoChange={setPeriodo} label="Período" />
                        <SearchInput value={pesquisa} onChange={setPesquisa} placeholder="Motorista, placa, item..." width="220px" />
                        <button onClick={load} className="p-2 rounded-lg border hover:bg-gray-50 transition-colors ml-auto" style={{ borderColor: 'var(--color-border)' }} title="Atualizar">
                            <Icon name="RefreshCw" size={14} color="var(--color-muted-foreground)" />
                        </button>
                    </div>

                    {loading ? (
                        <div className="flex justify-center py-16">
                            <div className="animate-spin h-7 w-7 rounded-full border-4" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
                        </div>
                    ) : entregasFiltradas.length === 0 ? (
                        <div className="bg-white rounded-xl border p-12 flex flex-col items-center gap-3" style={{ borderColor: 'var(--color-border)' }}>
                            <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#EFF6FF' }}>
                                <Icon name="Package" size={28} color="#1D4ED8" />
                            </div>
                            <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>Nenhuma entrega encontrada</p>
                            <p className="text-xs text-center" style={{ color: 'var(--color-muted-foreground)' }}>
                                {pesquisa || filtroMotorista || filtroItem ? 'Ajuste os filtros ou pesquisa.' : 'Clique em "Nova entrega" para registrar o primeiro item entregue.'}
                            </p>
                        </div>
                    ) : (
                        <div className="rounded-xl border overflow-hidden shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs" style={{ minWidth: 700 }}>
                                    <thead>
                                        <tr style={{ backgroundColor: '#1D4ED8' }}>
                                            {['Data', 'Motorista', 'Placa', 'Item', 'Qtd.', 'Observações', 'Ações'].map(h => (
                                                <th key={h} className="px-3 py-2.5 text-left font-semibold text-white whitespace-nowrap">{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {entregasFiltradas.map((e, idx) => (
                                            <tr key={e.id} className="border-t hover:bg-blue-50/30 transition-colors"
                                                style={{ borderColor: 'var(--color-border)', backgroundColor: idx % 2 === 0 ? 'white' : '#F9FAFB' }}>
                                                <td className="px-3 py-2.5 font-data whitespace-nowrap" style={{ color: 'var(--color-text-primary)' }}>{FMT_DATE(e.data_entrega)}</td>
                                                <td className="px-3 py-2.5 font-medium" style={{ color: 'var(--color-text-primary)' }}>{e.motorista?.name || '—'}</td>
                                                <td className="px-3 py-2.5 font-data">{e.placa || '—'}</td>
                                                <td className="px-3 py-2.5">
                                                    <span className="inline-block px-1.5 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: '#EFF6FF', color: '#1D4ED8' }}>{e.item}</span>
                                                </td>
                                                <td className="px-3 py-2.5 font-data text-center font-semibold">{e.quantidade}</td>
                                                <td className="px-3 py-2.5 max-w-[180px] truncate" style={{ color: 'var(--color-muted-foreground)' }} title={e.observacoes}>{e.observacoes || '—'}</td>
                                                <td className="px-2 py-2.5">
                                                    <div className="flex gap-1 items-center">
                                                        {admin && <button onClick={() => abrirEdit(e)} className="p-1.5 rounded hover:bg-blue-50 transition-colors"><Icon name="Pencil" size={16} color="#1D4ED8" /></button>}
                                                        {admin && <button onClick={() => excluir(e.id)} className="p-1.5 rounded hover:bg-red-50 transition-colors"><Icon name="Trash2" size={16} color="#DC2626" /></button>}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="px-4 py-2 border-t text-xs" style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)', backgroundColor: '#F9FAFB' }}>
                                {entregasFiltradas.length} registro{entregasFiltradas.length !== 1 ? 's' : ''}
                            </div>
                        </div>
                    )}
                </div>
            </main>

            {modal && (
                <Modal
                    form={form}
                    itensDisponiveis={itensDisponiveis}
                    modal={modal}
                    motoristas={motoristas}
                    placasSugeridas={placasSugeridas}
                    salvar={salvar}
                    saving={saving}
                    setForm={setForm}
                    setModal={setModal}
                />
            )}

            {modalItens && (
                <ModalItens
                    criarItem={criarItem}
                    editandoItem={editandoItem}
                    excluirItem={excluirItem}
                    itensCatalogo={itensCatalogo}
                    novoItemNome={novoItemNome}
                    salvarEdicaoItem={salvarEdicaoItem}
                    savingItem={savingItem}
                    setEditandoItem={setEditandoItem}
                    setModalItens={setModalItens}
                    setNovoItemNome={setNovoItemNome}
                />
            )}

            <Toast toast={toast} />
            {ConfirmDialog}
        </div>
    );
}
