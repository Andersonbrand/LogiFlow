import React, { useState, useCallback, useEffect, useMemo } from 'react';

import { useToast } from 'hooks/useToast';
import { useConfirm, usePeriodRangeFilter, usePagination, PrettySelect, PeriodRangeFilter, AppIcon as Icon, Button, PaginationBar, Toast, SearchInput } from 'components';
import { fetchCarreteirosPropriosOnly, fetchCarretasVeiculos, fetchDiarias, fetchViagens, createDiaria, updateDiaria, deleteDiaria, assinarDiaria, desassinarDiaria } from 'services/carretas';
import { useRecarregarAoVoltar } from 'hooks/useRecarregarAoVoltar';
import { exportDiariasRomaneiosModelo, exportDiariaModelo } from 'utils/excel';

import { inputStyle } from '../../utils/constants';
import { BRL, FMT_DATE } from '../../utils/helpers';
import Modal from './components/Modal';
import ViewDiaria from './components/ViewDiaria';

// ─── TAB: Diárias de Motoristas ───────────────────────────────────────────────
export default function TabDiarias({ isAdmin, profile }) {
    const { toast, showToast } = useToast();
    const { confirm, ConfirmDialog } = useConfirm();
    const [diarias, setDiarias]     = useState([]);
    const [motoristas, setMotoristas] = useState([]);
    const [veiculos, setVeiculos]   = useState([]);
    const [viagens, setViagens]     = useState([]);
    const [loading, setLoading]     = useState(true);
    const [modal, setModal]         = useState(null);
    const mesAtualDiarias = (() => { const h = new Date(); return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}`; })();
    const [filtro, setFiltro]       = useState(() => {
        let mes = mesAtualDiarias;
        try { mes = sessionStorage.getItem('carretas_diarias_filtroMes') ?? mesAtualDiarias; } catch {}
        return { motoristaId: '', mes };
    });
    const handleSetFiltroMes = (mes) => {
        setFiltro(f => ({ ...f, mes }));
        try { sessionStorage.setItem('carretas_diarias_filtroMes', mes); } catch {}
        if (mes && periodoPreset === 'personalizado') resetPeriodo();
    };
    // Filtro por período (data inicial a data final), além do filtro de mês/dia existente
    const { preset: periodoPreset, periodo, onPresetChange: aplicarPeriodoPreset, setPeriodo, reset: resetPeriodo } = usePeriodRangeFilter('todos');
    const handleAplicarPeriodo = (p) => {
        aplicarPeriodoPreset(p);
        if (p === 'personalizado') setFiltro(f => ({ ...f, mes: '', dia: '' }));
    };
    const [form, setForm] = useState({
        motorista_id: '', viagem_id: '', veiculo_id: '', data_inicio: new Date().toISOString().split('T')[0],
        quantidade_dias: '1', valor_dia: '', descricao: '',
    });

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const f = {};
            if (filtro.motoristaId) f.motoristaId = filtro.motoristaId;
            if (periodoPreset === 'personalizado' && (periodo.inicio || periodo.fim)) {
                if (periodo.inicio) f.dataInicio = periodo.inicio;
                if (periodo.fim)    f.dataFim    = periodo.fim;
            } else if (filtro.dia) {
                f.dataInicio = filtro.dia; f.dataFim = filtro.dia;
            } else if (filtro.mes) {
                f.dataInicio = filtro.mes + '-01';
                f.dataFim    = filtro.mes + '-' + String(new Date(Number(filtro.mes.split('-')[0]), Number(filtro.mes.split('-')[1]), 0).getDate()).padStart(2,'0');
            }
            // Busca motoristas de carreta primeiro para filtrar as diárias
            // Isso impede que diárias lançadas por motoristas de caminhão apareçam aqui
            const [m, vc] = await Promise.all([fetchCarreteirosPropriosOnly(), fetchCarretasVeiculos()]);
            const idsCarretas = m.map(x => x.id);
            // Só busca diárias de carreteiros (filtro por IDs)
            const df = { ...f };
            if (idsCarretas.length > 0) df.motoristasIds = idsCarretas;
            const [d, v] = await Promise.all([fetchDiarias(df), fetchViagens({})]);
            setDiarias(d);
            setMotoristas(m);
            setViagens(v);
            setVeiculos((vc || []).filter(x => !x.is_terceiro));
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
        finally { setLoading(false); }
    }, [filtro, periodoPreset, periodo]); // eslint-disable-line
    useEffect(() => { load(); }, [load]);
    useRecarregarAoVoltar(load);

    const [pesquisa, setPesquisa] = useState('');
    const diariasFiltradas = useMemo(() => {
        if (!pesquisa.trim()) return diarias;
        const q = pesquisa.toLowerCase();
        return diarias.filter(d =>
            (d.motorista?.name || '').toLowerCase().includes(q) ||
            (d.destino || '').toLowerCase().includes(q) ||
            (d.descricao || '').toLowerCase().includes(q)
        );
    }, [diarias, pesquisa]);
    const diariasPag = usePagination(diariasFiltradas, 15, [diariasFiltradas.length, pesquisa]);

    const totais = useMemo(() => ({
        total: diariasFiltradas.reduce((s, d) => s + Number(d.valor_total || 0), 0),
        dias:  diariasFiltradas.reduce((s, d) => s + Number(d.quantidade_dias || 0), 0),
        porMotorista: Object.values(diariasFiltradas.reduce((acc, d) => {
            const id = d.motorista_id || 'sem';
            const nome = d.motorista?.name || '—';
            if (!acc[id]) acc[id] = { nome, valor: 0, dias: 0 };
            acc[id].valor += Number(d.valor_total || 0);
            acc[id].dias  += Number(d.quantidade_dias || 0);
            return acc;
        }, {})).sort((a, b) => b.valor - a.valor),
    }), [diariasFiltradas]);

    const previewTotal = useMemo(() =>
        Number(form.quantidade_dias || 0) * Number(form.valor_dia || 0)
    , [form.quantidade_dias, form.valor_dia]);

    const handleSubmit = async () => {
        if (!form.motorista_id || !form.valor_dia || !form.data_inicio) { showToast('Motorista, valor/dia e data são obrigatórios', 'error'); return; }
        try {
            if (modal.mode === 'create') await createDiaria(form);
            else await updateDiaria(modal.data.id, form);
            showToast('Diária salva!', 'success'); setModal(null); load();
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };

    const handleDelete = async (id) => {
        const ok = await confirm({ title: 'Excluir diária?', message: 'Esta ação não pode ser desfeita.', confirmLabel: 'Excluir', variant: 'danger' });
        if (!ok) return;
        try { await deleteDiaria(id); showToast('Excluída!', 'success'); load(); }
        catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };

    // Exportação em lote — usa modelo com resumo por motorista
    const exportar = () => {
        if (!diariasFiltradas.length) { showToast('Nenhuma diária no período.', 'error'); return; }
        exportDiariasRomaneiosModelo(diariasFiltradas);
        showToast('Exportado!', 'success');
    };

    // Exportação individual — usa modelo da planilha de diárias
    const exportarDiariaIndividual = (d) => {
        exportDiariaModelo(d);
    };

    const openCreate = () => {
        setForm({ motorista_id: '', viagem_id: '', veiculo_id: '', data_inicio: new Date().toISOString().split('T')[0], quantidade_dias: '1', valor_dia: '', descricao: '' });
        setModal({ mode: 'create' });
    };
    const openEdit = (d) => {
        setForm({ motorista_id: d.motorista_id || '', viagem_id: d.viagem_id || '', veiculo_id: d.veiculo_id || '', data_inicio: d.data_inicio, quantidade_dias: d.quantidade_dias, valor_dia: d.valor_dia, descricao: d.descricao || '' });
        setModal({ mode: 'edit', data: d });
    };
    const [viewDiaria, setViewDiaria] = useState(null);
    const [assinando, setAssinando] = useState(false);
    const canSign = profile?.role === 'admin' || profile?.role === 'operador';
    // Assina a diária no setor do usuário logado (admin -> transporte, operador -> logística).
    // Cada setor assina de forma independente, sem sobrescrever o outro.
    const meuCampoAssinatura = profile?.role === 'admin' ? 'transporte' : profile?.role === 'operador' ? 'logistica' : null;
    const handleAssinarDiaria = async () => {
        if (!viewDiaria?.id || !canSign || !profile?.assinatura_digital || !meuCampoAssinatura) return;
        setAssinando(true);
        try {
            const texto = profile.assinatura_digital;
            const campo = meuCampoAssinatura;
            await assinarDiaria(viewDiaria.id, campo, texto, profile.id);
            setDiarias(ds => ds.map(d => d.id === viewDiaria.id
                ? { ...d, [`assinatura_${campo}`]: texto, [`assinatura_${campo}_at`]: new Date().toISOString() } : d));
            setViewDiaria(v => ({ ...v, [`assinatura_${campo}`]: texto, [`assinatura_${campo}_at`]: new Date().toISOString() }));
            showToast('Diária assinada digitalmente!', 'success');
        } catch (e) { showToast('Erro ao assinar: ' + e.message, 'error'); }
        finally { setAssinando(false); }
    };
    // Remove a assinatura de um setor específico (ação reservada a administradores na UI).
    const handleDesassinarDiaria = async (campo) => {
        if (!viewDiaria?.id || !isAdmin || !campo) return;
        setAssinando(true);
        try {
            await desassinarDiaria(viewDiaria.id, campo);
            setDiarias(ds => ds.map(d => d.id === viewDiaria.id
                ? { ...d, [`assinatura_${campo}`]: null, [`assinatura_${campo}_at`]: null } : d));
            setViewDiaria(v => ({ ...v, [`assinatura_${campo}`]: null, [`assinatura_${campo}_at`]: null }));
            showToast('Assinatura removida.', 'success');
        } catch (e) { showToast('Erro ao remover assinatura: ' + e.message, 'error'); }
        finally { setAssinando(false); }
    };

    return (
        <div>
            <div className="flex flex-wrap gap-3 items-center justify-between mb-5">
                <div className="flex flex-wrap gap-2">
                    <PrettySelect value={filtro.motoristaId} onChange={e => setFiltro(f => ({ ...f, motoristaId: e.target.value }))} className="px-3 py-2 rounded-lg border text-sm" style={inputStyle}>
                        <option value="">Todos motoristas</option>
                        {motoristas.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </PrettySelect>
                    <input type="month" value={filtro.mes} onChange={e => { handleSetFiltroMes(e.target.value); setFiltro(f => ({ ...f, dia: '' })); }}
                        className="px-3 py-2 rounded-lg border text-sm" style={inputStyle} title="Filtrar por mês" />
                    <input type="date" value={filtro.dia || ''} onChange={e => { setFiltro(f => ({ ...f, dia: e.target.value })); handleSetFiltroMes(''); }}
                        className="px-3 py-2 rounded-lg border text-sm" style={inputStyle} title="Filtrar por dia específico" />
                    {(filtro.mes || filtro.dia) && (
                        <button onClick={() => { handleSetFiltroMes(''); setFiltro(f => ({ ...f, dia: '' })); }}
                            className="px-2 py-1.5 rounded-lg border text-xs font-medium hover:bg-gray-50"
                            style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}
                            title="Limpar data">✕ Data</button>
                    )}
                    <PeriodRangeFilter presets={['personalizado']} preset={periodoPreset} onPresetChange={handleAplicarPeriodo} periodo={periodo} onPeriodoChange={setPeriodo} label="Período" />
                    {periodoPreset === 'personalizado' && (
                        <button onClick={resetPeriodo}
                            className="px-2 py-1.5 rounded-lg border text-xs font-medium hover:bg-gray-50"
                            style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}
                            title="Limpar período">✕ Período</button>
                    )}
                </div>
                <div className="flex gap-2">
                    <button onClick={load} className="p-2 rounded-lg border hover:bg-gray-50 transition-colors" style={{ borderColor: 'var(--color-border)' }} title="Atualizar">
                        <Icon name="RefreshCw" size={14} color="var(--color-muted-foreground)" />
                    </button>
                    <button onClick={exportar} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium hover:bg-gray-50 transition-colors" style={{ borderColor: 'var(--color-border)' }}>
                        <Icon name="FileDown" size={14} /> Exportar
                    </button>
                    <SearchInput value={pesquisa} onChange={setPesquisa} placeholder="Motorista, destino, motivo..." width="220px" />
                    <Button onClick={openCreate} iconName="Plus" size="sm">Nova Diária</Button>
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
                <div className="bg-white rounded-xl border p-4 shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
                    <p className="text-xs mb-1" style={{ color: 'var(--color-muted-foreground)' }}>Total Diárias</p>
                    <p className="text-2xl font-bold font-data text-indigo-600">{BRL(totais.total)}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted-foreground)' }}>{totais.dias} diária{totais.dias !== 1 ? 's' : ''} somadas (todos os motoristas)</p>
                </div>
                {totais.porMotorista.slice(0, 2).map(m => (
                    <div key={m.nome} className="bg-white rounded-xl border p-4 shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
                        <p className="text-xs mb-1 truncate font-medium" style={{ color: 'var(--color-muted-foreground)' }}>{m.nome}</p>
                        <p className="text-lg font-bold font-data text-indigo-600">{BRL(m.valor)}</p>
                        <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>{m.dias} dia{m.dias !== 1 ? 's' : ''}</p>
                    </div>
                ))}
            </div>

            {/* Tabela */}
            {loading ? <div className="flex justify-center py-12"><div className="animate-spin h-7 w-7 rounded-full border-4" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} /></div> : (
                <div className="bg-white rounded-xl border shadow-sm overflow-x-auto" style={{ borderColor: 'var(--color-border)' }}>
                    <table className="w-full text-sm min-w-[640px]">
                        <thead className="text-xs border-b" style={{ backgroundColor: 'var(--color-muted)', borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                            <tr>{['Data','Motorista','Placa','Dias','Valor/Dia','Total',''].map(h => <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>)}</tr>
                        </thead>
                        <tbody>
                            {diariasFiltradas.length === 0 ? <tr><td colSpan={7} className="text-center py-12" style={{ color: 'var(--color-muted-foreground)' }}>
                                <div className="flex flex-col items-center gap-2">
                                    <Icon name="CalendarDays" size={28} color="var(--color-muted-foreground)" />
                                    <span className="text-sm">{pesquisa ? `Nenhum resultado para "${pesquisa}"` : 'Nenhuma diária registrada'}</span>
                                </div>
                            </td></tr>
                            : diariasPag.pageItems.map((d, i) => (
                                <tr key={d.id} className="border-t hover:bg-gray-50" style={{ borderColor: 'var(--color-border)', backgroundColor: i % 2 === 0 ? '#fff' : '#F8FAFC' }}>
                                    <td className="px-4 py-3 whitespace-nowrap">{FMT_DATE(d.data_inicio)}</td>
                                    <td className="px-4 py-3 font-medium">{d.motorista?.name || '—'}</td>
                                    <td className="px-4 py-3 font-data whitespace-nowrap">{d.veiculo?.placa || '—'}</td>
                                    <td className="px-4 py-3 font-data text-center">{d.quantidade_dias}</td>
                                    <td className="px-4 py-3 font-data">{BRL(d.valor_dia)}</td>
                                    <td className="px-4 py-3 font-data font-semibold text-indigo-600">{BRL(d.valor_total)}</td>
                                    <td className="px-4 py-3">
                                        <div className="flex gap-1">
                                            <button onClick={() => setViewDiaria(d)}
                                                className="p-2 rounded hover:bg-indigo-50"
                                                title="Visualizar diária">
                                                <Icon name="Eye" size={16} color="#4F46E5" />
                                            </button>
                                            {isAdmin && <button onClick={() => openEdit(d)} className="p-2 rounded hover:bg-blue-50"><Icon name="Pencil" size={16} color="#1D4ED8" /></button>}
                                            {isAdmin && <button onClick={() => handleDelete(d.id)} className="p-2 rounded hover:bg-red-50"><Icon name="Trash2" size={16} color="#DC2626" /></button>}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        {diariasFiltradas.length > 0 && (
                            <tfoot>
                                <tr style={{ backgroundColor: '#EEF2FF', borderTop: '2px solid #C7D2FE' }}>
                                    <td colSpan={3} className="px-4 py-2 text-xs font-bold text-indigo-800">TOTAL</td>
                                    <td className="px-4 py-2 font-data font-bold text-center text-indigo-700">{totais.dias}</td>
                                    <td />
                                    <td className="px-4 py-2 font-data font-bold text-indigo-700">{BRL(totais.total)}</td>
                                    <td />
                                </tr>
                            </tfoot>
                        )}
                    </table>
                    <PaginationBar page={diariasPag.page} setPage={diariasPag.setPage} totalPages={diariasPag.totalPages}
                        totalItems={diariasPag.totalItems} pageSize={diariasPag.pageSize} itemLabel="diária" itemLabelPlural="diárias" />
                </div>
            )}

            {modal && (
                <Modal
                    form={form}
                    handleSubmit={handleSubmit}
                    modal={modal}
                    motoristas={motoristas}
                    previewTotal={previewTotal}
                    setForm={setForm}
                    setModal={setModal}
                    veiculos={veiculos}
                />
            )}
            {viewDiaria && (
                <ViewDiaria
                    assinando={assinando}
                    canSign={canSign}
                    exportarDiariaIndividual={exportarDiariaIndividual}
                    handleAssinarDiaria={handleAssinarDiaria}
                    handleDesassinarDiaria={handleDesassinarDiaria}
                    isAdmin={isAdmin}
                    meuCampoAssinatura={meuCampoAssinatura}
                    profile={profile}
                    setViewDiaria={setViewDiaria}
                    showToast={showToast}
                    viewDiaria={viewDiaria}
                />
            )}
            <Toast toast={toast} />
            {ConfirmDialog}
        </div>
    );
}
