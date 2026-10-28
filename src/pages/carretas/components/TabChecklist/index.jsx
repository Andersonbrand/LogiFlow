import React, { useState, useMemo, useEffect, useCallback } from 'react';

import { useToast } from 'hooks/useToast';
import { useConfirm, usePagination, AppIcon as Icon, Button, PaginationBar, ChecklistItensManagerModal, Toast, Field, ModalHeader, ModalOverlay, SearchInput } from 'components';
import { fetchChecklists, fetchVeiculosProprios, fetchCarreteirosPropriosOnly, fetchChecklistItens, updateChecklist, createChecklist, aprovarChecklistComNotificacaoRetorno, reprovarChecklistComNotificacao, criarRascunhoOSDeChecklist, deleteChecklist, contarItensOk, CHECKLIST_ITENS } from 'services/carretas';
import { fetchCaminhoesPlacas } from 'services/vehicleService';
import { useRecarregarAoVoltar } from 'hooks/useRecarregarAoVoltar';

import { inputStyle, inputCls } from '../../utils/constants';
import IsExpandido from './components/IsExpandido';
import Modal from './components/Modal';
import ModalFoto from './components/ModalFoto';

// ─── TAB: Checklist ───────────────────────────────────────────────────────────
export default function TabChecklist({ isAdmin, profile }) {
    const { toast, showToast } = useToast();
    const { confirm, ConfirmDialog } = useConfirm();
    const [checklists, setChecklists] = useState([]);
    const [pesquisa, setPesquisa] = useState('');
    const checklistsFiltrados = useMemo(() => {
        if (!pesquisa.trim()) return checklists;
        const q = pesquisa.toLowerCase();
        return checklists.filter(c => (c.motorista?.name ||
            '').toLowerCase().includes(q) ||
            (c.veiculo?.placa ||
            '').toLowerCase().includes(q) ||
            (c.tipo ||
            '').toLowerCase().includes(q) ||
            (c.status ||
            '').toLowerCase().includes(q));
    }, [checklists, pesquisa]); // eslint-disable-line

    const [veiculos, setVeiculos] = useState([]);
    const [caminhoes, setCaminhoes] = useState([]);
    const [motoristas, setMotoristas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState(null);
    const [modalManut, setModalManut] = useState(null);
    const [obsManut, setObsManut] = useState('');
    const [modalAprovar, setModalAprovar] = useState(null); // checklist aguardando aprovação com retorno
    const [obsAprovar, setObsAprovar] = useState('');
    const [savingManut, setSavingManut] = useState(false);
    const [savingAprovar, setSavingAprovar] = useState(false);
    const [filtro, setFiltro] = useState('pendentes');
    const mesAtualChecklist = (() => { const h = new Date(); return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}`; })();
    const [filtroMes, setFiltroMes] = useState(() => {
        try { return sessionStorage.getItem('carretas_checklist_filtroMes') ?? mesAtualChecklist; } catch { return mesAtualChecklist; }
    });
    const checklistPag = usePagination(checklistsFiltrados, 10, [pesquisa, filtro, filtroMes]);
    const handleSetFiltroMes = (v) => {
        setFiltroMes(v);
        try { sessionStorage.setItem('carretas_checklist_filtroMes', v); } catch {}
    };
    const [form, setForm] = useState({ veiculo_id: '', veiculo_caminhao_id: '', odometro: '', itens: {}, problemas: '', necessidades: '', observacoes_livres: '', foto_url: '', fotos_urls: [] });
    const [modalFoto, setModalFoto] = useState(null); // { fotos: string[], index: number } | null

    // Navegação por teclado no visualizador de fotos: ← → pra trocar, Esc pra fechar
    useEffect(() => {
        if (!modalFoto) return;
        const onKey = (e) => {
            if (e.key === 'ArrowLeft') setModalFoto(m => m && ({ ...m, index: (m.index - 1 + m.fotos.length) % m.fotos.length }));
            else if (e.key === 'ArrowRight') setModalFoto(m => m && ({ ...m, index: (m.index + 1) % m.fotos.length }));
            else if (e.key === 'Escape') setModalFoto(null);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [modalFoto]);
    const [checklistItens, setChecklistItens] = useState([]); // itens ativos vindos do banco
    const [modalItens, setModalItens] = useState(false); // gerenciador de itens (admin)
    const [expandidos, setExpandidos] = useState(() => new Set()); // ids dos checklists com detalhes expandidos
    const toggleExpandido = (id) => {
        setExpandidos(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const f = filtro === 'pendentes' ? { pendente: true } : {};
            if (filtroMes) {
                const [yr, mo] = filtroMes.split('-');
                const lastDay = new Date(Number(yr), Number(mo), 0).getDate();
                f.dataInicio = `${filtroMes}-01`;
                f.dataFim    = `${filtroMes}-${String(lastDay).padStart(2, '0')}`;
            }
            const [c, v, m, it, cam] = await Promise.all([fetchChecklists(f), fetchVeiculosProprios(), fetchCarreteirosPropriosOnly(), fetchChecklistItens(true), fetchCaminhoesPlacas().catch(() => [])]);
            setChecklists(c); setVeiculos(v); setMotoristas(m); setChecklistItens(it); setCaminhoes(cam);
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
        finally { setLoading(false); }
    }, [filtro, filtroMes]); // eslint-disable-line
    useEffect(() => { load(); }, [load]);
    useRecarregarAoVoltar(load);

    const recarregarItens = async () => { setChecklistItens(await fetchChecklistItens(false)); };

    const openEditChecklist = (c) => {
        setForm({
            veiculo_id: c.veiculo_id != null ? String(c.veiculo_id) : '',
            veiculo_caminhao_id: c.veiculo_caminhao_id != null ? String(c.veiculo_caminhao_id) : '',
            odometro: c.odometro ?? '',
            itens: c.itens || {},
            problemas: c.problemas || '',
            necessidades: c.necessidades || '',
            observacoes_livres: c.observacoes_livres || '',
            fotos_urls: c.fotos_urls || (c.foto_url ? [c.foto_url] : []),
        });
        setModal({ mode: 'edit', id: c.id });
    };

    const handleSubmit = async () => {
        if (!form.veiculo_id && !form.veiculo_caminhao_id) { showToast('Selecione o veículo', 'error'); return; }
        if (form.odometro === '' || form.odometro == null) { showToast('Informe o odômetro do veículo', 'error'); return; }
        const semana = new Date(); semana.setDate(semana.getDate() - semana.getDay() + 1);
        try {
            if (modal?.mode === 'edit') {
                const caminhaoSel = form.veiculo_caminhao_id ? caminhoes.find(c => String(c.id) === String(form.veiculo_caminhao_id)) : null;
                await updateChecklist(modal.id, {
                    veiculo_id: form.veiculo_id || null,
                    veiculo_caminhao_id: form.veiculo_caminhao_id || null,
                    veiculo_caminhao_placa: caminhaoSel?.placa || null,
                    odometro: Number(form.odometro),
                    itens: form.itens,
                    problemas: form.problemas,
                    necessidades: form.necessidades,
                    observacoes_livres: form.observacoes_livres,
                    fotos_urls: form.fotos_urls,
                });
                showToast('Checklist atualizado!', 'success'); setModal(null); load();
                return;
            }
            const salvo = await createChecklist({
                ...form, foto_url: form.fotos_urls[0] || '', motorista_id: profile.id,
                odometro: form.odometro !== '' && form.odometro != null ? Number(form.odometro) : null,
                semana_ref: semana.toISOString().split('T')[0],
            });
            showToast('Checklist enviado!', 'success'); setModal(null); load();
            if (salvo?._fotosFalhas) {
                setTimeout(() => showToast(`Atenção: ${salvo._fotosFalhas} foto(s) não foram enviadas. Edite o checklist para tentar novamente.`, 'error'), 1400);
            }
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };
    const handleAprovarClick = (c) => {
        setModalAprovar(c);
        setObsAprovar('');
    };
    const handleConfirmarAprovacao = async () => {
        if (!modalAprovar) return;
        setSavingAprovar(true);
        try {
            await aprovarChecklistComNotificacaoRetorno(modalAprovar.id, profile.id, modalAprovar.motorista_id, obsAprovar.trim());
            showToast('Aprovado! Motorista notificado.', 'success');
            setModalAprovar(null); setObsAprovar(''); load();
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
        finally { setSavingAprovar(false); }
    };
    const handleManutencao = async () => {
        if (!obsManut.trim()) { showToast('Descreva a manutenção', 'error'); return; }
        const checklist = checklists.find(c => c.id === modalManut);
        setSavingManut(true);
        try {
            await reprovarChecklistComNotificacao(modalManut, profile.id, checklist?.motorista_id, obsManut);
            // Gera automaticamente um rascunho de OS a partir deste checklist,
            // para que o admin confira, complete e envie na aba "Ordens de Serviço".
            try {
                if (checklist) await criarRascunhoOSDeChecklist({ ...checklist, observacoes_livres: [checklist.observacoes_livres, obsManut].filter(Boolean).join(' | ') }, profile.id);
                showToast('Manutenção registrada! Rascunho de OS criado na aba Ordens de Serviço.', 'success');
            } catch (errOS) {
                console.error('Falha ao criar rascunho de OS a partir do checklist:', errOS);
                showToast(`Manutenção registrada! (Falha ao gerar o rascunho de OS: ${errOS.message || 'erro desconhecido'} — crie manualmente na aba Ordens de Serviço.)`, 'warning');
            }
            setModalManut(null); setObsManut(''); load();
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
        finally { setSavingManut(false); }
    };
    const handleDeleteChecklist = async (id) => {
        const ok = await confirm({
            title: 'Excluir Checklist?',
            message: 'O checklist será removido permanentemente. Esta ação não pode ser desfeita.',
            confirmLabel: 'Excluir',
            variant: 'danger',
        });
        if (!ok) return;
        try { await deleteChecklist(id); showToast('Checklist excluído.', 'warning'); load(); }
        catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };

    return (
        <div>
            <div className="flex flex-wrap gap-2 items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                    <div className="flex rounded-lg border overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
                        {[['pendentes','Pendentes'], ['todos','Todos']].map(([v, l]) => (
                            <button key={v} onClick={() => setFiltro(v)} className="px-4 py-2 text-xs font-medium transition-colors"
                                style={filtro === v ? { backgroundColor: 'var(--color-primary)', color: '#fff' } : { backgroundColor: 'white', color: 'var(--color-muted-foreground)' }}>{l}</button>
                        ))}
                    </div>
                    <button onClick={load} className="p-2 rounded-lg border hover:bg-gray-50 transition-colors" style={{ borderColor: 'var(--color-border)' }} title="Atualizar">
                        <Icon name="RefreshCw" size={14} color="var(--color-muted-foreground)" />
                    </button>
                    <input type="month" value={filtroMes} onChange={e => handleSetFiltroMes(e.target.value)}
                        className="px-3 py-2 rounded-lg border text-sm" style={inputStyle} title="Filtrar por mês" />
                    <SearchInput value={pesquisa} onChange={setPesquisa} placeholder="Motorista, placa, tipo..." width="220px" />
                </div>
                <div className="flex items-center gap-2">
                    {isAdmin && (
                        <button onClick={() => setModalItens(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium hover:bg-gray-50 transition-colors" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}>
                            <Icon name="ListChecks" size={14} color="var(--color-muted-foreground)" />Gerenciar itens
                        </button>
                    )}
                    <Button onClick={() => { setForm({ veiculo_id: '', veiculo_caminhao_id: '', odometro: '', itens: {}, problemas: '', necessidades: '', observacoes_livres: '', foto_url: '', fotos_urls: [] }); setModal({ mode: 'create' }); }} iconName="ClipboardCheck" size="sm">Novo Checklist</Button>
                </div>
            </div>

            {loading ? <div className="flex justify-center py-12"><div className="animate-spin h-7 w-7 rounded-full border-4" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} /></div> : (
                <div className="flex flex-col gap-4">
                    {checklistsFiltrados.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-12 gap-2 bg-white rounded-xl border" style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                            <Icon name="ClipboardCheck" size={32} color="var(--color-muted-foreground)" />
                            <span className="text-sm">{pesquisa ? `Nenhum resultado para "${pesquisa}"` : 'Nenhum checklist encontrado'}</span>
                        </div>
                    )}
                    {checklistPag.pageItems.map(c => {
                        const itens = c.itens || {};
                        const entradas = Object.entries(itens);
                        const ok = contarItensOk(itens);
                        const total = entradas.length || checklistItens.length || CHECKLIST_ITENS.length;
                        const fotos = (c.fotos_urls && c.fotos_urls.length ? c.fotos_urls : (c.foto_url ? [c.foto_url] : []));
                        const isExpandido = expandidos.has(c.id);
                        return (
                            <div key={c.id} className="bg-white rounded-xl border shadow-sm overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
                                <div className="flex items-start justify-between gap-2 p-4 sm:p-5 pb-3 cursor-pointer select-none"
                                    style={isExpandido ? { borderBottom: '1px solid #F1F5F9' } : undefined}
                                    onClick={() => toggleExpandido(c.id)}>
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm text-white" style={{ backgroundColor: ok === total ? '#059669' : ok >= total * 0.7 ? '#D97706' : '#DC2626' }}>
                                            {(c.motorista?.name || '?').trim().charAt(0).toUpperCase()}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-bold leading-tight truncate" style={{ color: 'var(--color-text-primary)' }}>{c.motorista?.name || '—'}</p>
                                            <p className="text-xs font-data" style={{ color: 'var(--color-muted-foreground)' }}>
                                                {c.veiculo?.placa || '—'} · Semana de {c.semana_ref ? new Date(c.semana_ref + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}
                                                {c.odometro != null && <> · <Icon name="Gauge" size={11} className="inline -mt-0.5" />{' '}{Number(c.odometro).toLocaleString('pt-BR')} km</>}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 flex-wrap justify-end flex-shrink-0">
                                        <span className="text-xs font-semibold mr-0.5" style={{ color: ok === total ? '#059669' : ok >= total * 0.7 ? '#D97706' : '#DC2626' }}>{ok}/{total}</span>
                                        {c.aprovado
                                            ? <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 whitespace-nowrap"><Icon name="CheckCircle2" size={11} />Aprovado</span>
                                            : <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 whitespace-nowrap"><Icon name="Clock" size={11} />Pendente</span>
                                        }
                                        {c.manutencao_registrada && <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700 whitespace-nowrap"><Icon name="Wrench" size={11} />Manutenção</span>}
                                        {fotos.length > 0 && (
                                            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 whitespace-nowrap">
                                                <Icon name="Camera" size={11} />{fotos.length} foto{fotos.length > 1 ? 's' : ''}
                                            </span>
                                        )}
                                        <button onClick={(e) => { e.stopPropagation(); toggleExpandido(c.id); }} title={isExpandido ? 'Recolher' : 'Expandir'}
                                            className="w-6 h-6 rounded-md flex items-center justify-center hover:bg-gray-100 transition-colors flex-shrink-0">
                                            <Icon name={isExpandido ? 'ChevronUp' : 'ChevronDown'} size={16} color="var(--color-muted-foreground)" />
                                        </button>
                                    </div>
                                </div>
                                {isExpandido && (
                                <IsExpandido
                    c={c}
                    checklistItens={checklistItens}
                    entradas={entradas}
                    fotos={fotos}
                    handleAprovarClick={handleAprovarClick}
                    handleDeleteChecklist={handleDeleteChecklist}
                    isAdmin={isAdmin}
                    ok={ok}
                    openEditChecklist={openEditChecklist}
                    setModalFoto={setModalFoto}
                    setModalManut={setModalManut}
                    setObsManut={setObsManut}
                    total={total}
                />
                                )}
                            </div>
                        );
                    })}
                    <PaginationBar page={checklistPag.page} setPage={checklistPag.setPage} totalPages={checklistPag.totalPages}
                        totalItems={checklistPag.totalItems} pageSize={checklistPag.pageSize} itemLabel="checklist" itemLabelPlural="checklists" className="rounded-xl border bg-white" />
                </div>
            )}

            {/* Modal novo checklist */}
            {modal && (
                <Modal
                    caminhoes={caminhoes}
                    checklistItens={checklistItens}
                    form={form}
                    handleSubmit={handleSubmit}
                    modal={modal}
                    setForm={setForm}
                    setModal={setModal}
                    showToast={showToast}
                    veiculos={veiculos}
                />
            )}

            {/* Modal gerenciar itens do checklist (admin) */}
            {modalItens && (
                <ChecklistItensManagerModal
                    itens={checklistItens}
                    onReload={recarregarItens}
                    onClose={() => setModalItens(false)}
                    showToast={showToast}
                    confirm={confirm}
                />
            )}

            {/* Modal manutenção */}
            {/* Modal aprovar checklist com retorno */}
            {modalAprovar && (
                <ModalOverlay onClose={() => setModalAprovar(null)}>
                    <ModalHeader title="Aprovar Checklist" icon="CheckCircle2" onClose={() => setModalAprovar(null)} />
                    <div className="p-5 overflow-y-auto flex-1">
                        <p className="text-sm text-slate-600 mb-4">
                            Você está aprovando o checklist de <strong>{modalAprovar.motoristas?.name || 'motorista'}</strong>.
                            Adicione um retorno/observação para o motorista (opcional).
                        </p>
                        <Field label="Retorno / Observação para o motorista">
                            <textarea value={obsAprovar} onChange={e => setObsAprovar(e.target.value)} className={inputCls} style={inputStyle} rows={4} placeholder="Ex: Tudo certo! Boa viagem. / Atenção aos pneus na próxima verificação..." />
                        </Field>
                    </div>
                    <div className="flex gap-3 p-5 justify-end border-t flex-shrink-0">
                        <button onClick={() => setModalAprovar(null)} className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50" style={{ borderColor: 'var(--color-border)' }}>Cancelar</button>
                        <Button onClick={handleConfirmarAprovacao} size="sm" iconName="CheckCircle2" loading={savingAprovar} disabled={savingAprovar}>Aprovar</Button>
                    </div>
                </ModalOverlay>
            )}

            {modalManut && (
                <ModalOverlay onClose={() => setModalManut(null)}>
                    <ModalHeader title="Registrar Manutenção" icon="Wrench" onClose={() => setModalManut(null)} />
                    <div className="p-5 overflow-y-auto flex-1">
                        <Field label="Descreva a manutenção necessária" required>
                            <textarea value={obsManut} onChange={e => setObsManut(e.target.value)} className={inputCls} style={inputStyle} rows={4} placeholder="Detalhes da manutenção..." />
                        </Field>
                    </div>
                    <div className="flex gap-3 p-5 justify-end border-t flex-shrink-0">
                        <button onClick={() => setModalManut(null)} className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50" style={{ borderColor: 'var(--color-border)' }}>Cancelar</button>
                        <Button onClick={handleManutencao} size="sm" iconName="Wrench" loading={savingManut} disabled={savingManut}>Registrar</Button>
                    </div>
                </ModalOverlay>
            )}

            {/* Modal visualizar foto — com setas laterais pra navegar entre as fotos do checklist */}
            {modalFoto && (
                <ModalFoto modalFoto={modalFoto} setModalFoto={setModalFoto} />
            )}
            <Toast toast={toast} />
            {ConfirmDialog}
        </div>
    );
}
