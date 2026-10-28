import React, { useState, useCallback, useEffect } from 'react';

import { useToast } from 'hooks/useToast';
import { useConfirm, usePeriodRangeFilter, usePagination, AppIcon as Icon, PrettySelect, PeriodRangeFilter, ActionButtonsGroup, EditButton, DeleteButton, PaginationBar, Toast, SearchInput } from 'components';
import { fetchPontosParada, fetchTodosMotoristas, fetchEmpresas, fetchFretesCidades, fetchPostos, fetchLocaisParada, fetchAbastecimentos, fetchVeiculosProprios, deletePontoParada, updatePontoParada } from 'services/carretas';
import { useRecarregarAoVoltar } from 'hooks/useRecarregarAoVoltar';
import { agruparDesempenhoPorMotorista, calcularAlertasJornada, calcularHorasExtras } from 'services/desempenhoMotoristaService';
import { exportDesempenhoMotoristasExcel, exportPontosParadaExcel } from 'utils/excel';

import PainelHorasExtras from '../PainelHorasExtras';
import PainelDesempenhoMotoristas from '../PainelDesempenhoMotoristas';
import { FMT_DATE } from '../../utils/helpers';
import GerenciarLocaisModal from '../GerenciarLocaisModal';
import EditModal from './components/EditModal';

// ─── TAB: Pontos de Parada (admin) ───────────────────────────────────────────
export default function TabPontosParada({ isAdmin }) {
    const { toast, showToast } = useToast();
    const { confirm, ConfirmDialog } = useConfirm();
    const [pontos, setPontos] = useState([]);
    // Sub-aba: "Registros" (tela original) ou "Desempenho" (novo painel de
    // KM/horas/consumo médio/alerta de jornada) — reaproveita os mesmos
    // filtros de motorista e período já existentes nesta tela.
    const [subTab, setSubTab] = useState('registros');
    const [abastecimentos, setAbastecimentos] = useState([]);

    const [loading, setLoading] = useState(true);
    const mesAtualPontos = (() => { const h = new Date(); return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}`; })();
    const [filtroMes, setFiltroMes] = useState(() => {
        try { return sessionStorage.getItem('carretas_pontos_filtroMes') ?? mesAtualPontos; } catch { return mesAtualPontos; }
    });
    const handleSetFiltroMes = (v) => {
        setFiltroMes(v);
        try { sessionStorage.setItem('carretas_pontos_filtroMes', v); } catch {}
        if (v && periodoPreset === 'personalizado') resetPeriodo();
    };
    const [filtroMotorista, setFiltroMotorista] = useState('');
    const [pesquisa, setPesquisa] = useState('');
    const [motoristas, setMotoristas] = useState([]);
    const [veiculosRef, setVeiculosRef] = useState([]);
    const [editModal, setEditModal] = useState(null);
    const [formEdit, setFormEdit] = useState({});
    const [saving, setSaving] = useState(false);
    // Filtro por período (data inicial a data final)
    const { preset: periodoPreset, periodo, onPresetChange: aplicarPeriodoPreset, setPeriodo, reset: resetPeriodo } = usePeriodRangeFilter('todos');
    const handleAplicarPeriodo = (p) => {
        aplicarPeriodoPreset(p);
        if (p === 'personalizado') handleSetFiltroMes('');
    };

    const inputCls = 'w-full px-3 py-2 rounded-lg border text-sm outline-none transition-all focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500';
    const inputStyle = { borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' };

    const [empresasRef, setEmpresasRef] = useState([]);
    const [cidadesRef, setCidadesRef] = useState([]);
    const [postosRef, setPostosRef] = useState([]);
    const [locaisFabricaRef, setLocaisFabricaRef] = useState([]);
    const [locaisOutroRef, setLocaisOutroRef] = useState([]);
    const [gerenciarLocaisModal, setGerenciarLocaisModal] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [p, m, emps, cidades, postosData, fabricas, outros, abast, veiculosData] = await Promise.all([
                fetchPontosParada(null), // null = todos os motoristas
                isAdmin ? fetchTodosMotoristas() : Promise.resolve([]),
                fetchEmpresas().catch(() => []),
                fetchFretesCidades().catch(() => []),
                fetchPostos().catch(() => []),
                fetchLocaisParada('Fábrica').catch(() => []),
                fetchLocaisParada('Outro').catch(() => []),
                fetchAbastecimentos({ apenasCarretas: true }).catch(() => []),
                fetchVeiculosProprios().catch(() => []),
            ]);
            setPontos(p);
            setMotoristas(m);
            setAbastecimentos(abast || []);
            setEmpresasRef(emps || []);
            setCidadesRef(cidades || []);
            setPostosRef(postosData || []);
            setLocaisFabricaRef(fabricas || []);
            setLocaisOutroRef(outros || []);
            setVeiculosRef(veiculosData || []);
        } catch (e) { showToast('Erro ao carregar: ' + e.message, 'error'); }
        finally { setLoading(false); }
    }, []); // eslint-disable-line
    useEffect(() => { load(); }, [load]);
    useRecarregarAoVoltar(load);

    const destinosParaTipo = useCallback((tipo) => {
        switch (tipo) {
            case 'Empresa': return empresasRef.map(e => e.nome).filter(Boolean);
            case 'Fábrica':  return locaisFabricaRef.map(l => l.nome).filter(Boolean);
            case 'Entrega': return cidadesRef.map(c => c.cidade).filter(Boolean);
            case 'Posto':    return postosRef.map(p => p.nome).filter(Boolean);
            case 'Outro':    return locaisOutroRef.map(l => l.nome).filter(Boolean);
            default: return [];
        }
    }, [empresasRef, locaisFabricaRef, cidadesRef, postosRef, locaisOutroRef]);

    const TIPO_COLOR = {
        'Fábrica': '#EFF6FF', 'Empresa': '#FEF3C7', 'Estoque': '#FEF9C3',
        'Entrega': '#D1FAE5', 'Posto': '#EDE9FE', 'Oficina': '#FEE2E2', 'Outro': '#F3F4F6',
    };
    const TIPO_TEXT = {
        'Fábrica': '#1D4ED8', 'Empresa': '#D97706', 'Estoque': '#B45309',
        'Entrega': '#065F46', 'Posto': '#7C3AED', 'Oficina': '#B91C1C', 'Outro': '#6B7280',
    };

    // Ordena por motorista e, dentro de cada motorista, em ordem cronológica de
    // saída — assim a lista reflete a sequência real da rota do veículo
    // (saída da empresa → chegada na fábrica → saída da fábrica → chegada...),
    // facilitando a conferência do admin.
    const chaveDataHora = (data, hora) => `${data || '9999-99-99'}T${hora || '99:99'}`;
    const pontosFiltrados = pontos
        .filter(p => {
        if (filtroMotorista && p.motorista_id !== filtroMotorista) return false;
        if (periodoPreset === 'personalizado' && (periodo.inicio || periodo.fim)) {
            const d = p.data_saida || '';
            if (periodo.inicio && d < periodo.inicio) return false;
            if (periodo.fim && d > periodo.fim) return false;
        } else if (filtroMes) {
            const d = p.data_saida || '';
            if (!d.startsWith(filtroMes)) return false;
        }
        if (pesquisa.trim()) {
            const q = pesquisa.toLowerCase();
            const motoristaNome = motoristas.find(m => m.id === p.motorista_id)?.name || '';
            const extrasTexto = (p.extras || []).map(ex => `${ex.local || ''} ${ex.tipo_local || ''}`).join(' ');
            return (
                (p.local || '').toLowerCase().includes(q) ||
                (p.tipo_local || '').toLowerCase().includes(q) ||
                (p.local_chegada || '').toLowerCase().includes(q) ||
                (p.tipo_local_chegada || '').toLowerCase().includes(q) ||
                (p.veiculo?.placa || '').toLowerCase().includes(q) ||
                motoristaNome.toLowerCase().includes(q) ||
                extrasTexto.toLowerCase().includes(q)
            );
        }
        return true;
    })
        .map(p => (p.horarios_extras && p.horarios_extras.length > 1)
            ? { ...p, horarios_extras: [...p.horarios_extras].sort((a, b) => chaveDataHora(a.data_saida, a.horario_saida).localeCompare(chaveDataHora(b.data_saida, b.horario_saida))) }
            : p)
        .sort((a, b) => {
            const nomeA = motoristas.find(m => m.id === a.motorista_id)?.name || '';
            const nomeB = motoristas.find(m => m.id === b.motorista_id)?.name || '';
            if (nomeA !== nomeB) return nomeA.localeCompare(nomeB, 'pt-BR');
            return chaveDataHora(a.data_saida, a.horario_saida).localeCompare(chaveDataHora(b.data_saida, b.horario_saida));
        });

    // Paginação — mesmo padrão já usado em Materiais/Romaneios: só renderiza
    // 10 registros por vez (os demais continuam carregados em memória, só
    // fora da tela), evitando que a página fique enorme com muitos registros.
    const pontosPag = usePagination(pontosFiltrados, 10, [filtroMotorista, filtroMes, pesquisa, periodoPreset, periodo.inicio, periodo.fim]);

    // Marca o início de cada bloco de motorista e alterna a cor de fundo por
    // bloco (em vez de por linha), para deixar claro onde termina um motorista
    // e começa o próximo — evita que os registros fiquem "grudados".
    let __grupoAnterior;
    let __grupoIdx = -1;
    const pontosComGrupo = pontosPag.pageItems.map(p => {
        const chave = p.motorista_id || '—';
        const novoGrupo = chave !== __grupoAnterior;
        if (novoGrupo) __grupoIdx++;
        __grupoAnterior = chave;
        return { ...p, __novoGrupo: novoGrupo, __grupoIdx };
    });

    // ── Dados para a sub-aba "Desempenho" — reaproveita os mesmos filtros
    // de motorista/período já aplicados acima em pontosFiltrados. ──────────
    const abastecimentosFiltrados = abastecimentos.filter(a => {
        if (filtroMotorista && a.motorista_id !== filtroMotorista) return false;
        const d = a.data_abastecimento || '';
        if (periodoPreset === 'personalizado' && (periodo.inicio || periodo.fim)) {
            if (periodo.inicio && d < periodo.inicio) return false;
            if (periodo.fim && d > periodo.fim) return false;
        } else if (filtroMes && !d.startsWith(filtroMes)) return false;
        return true;
    });
    // O serviço de cálculo espera `motorista.name` já vinculado ao ponto
    // (fetchPontosParada(null) não faz esse join, então resolvemos aqui
    // usando a lista de motoristas já carregada pela tela).
    const pontosParaDesempenho = pontosFiltrados.map(p => ({
        ...p,
        motorista: { name: motoristas.find(m => m.id === p.motorista_id)?.name },
    }));
    const desempenhoPorMotorista = agruparDesempenhoPorMotorista(pontosParaDesempenho, abastecimentosFiltrados);
    const { alertasDiarios, alertasSemanais } = calcularAlertasJornada(pontosParaDesempenho);
    const horasExtrasData = calcularHorasExtras(pontosParaDesempenho);

    const handleDelete = async (id) => {
        const ok = await confirm({ title: 'Excluir ponto de parada?', message: 'Esta ação não pode ser desfeita.', confirmLabel: 'Excluir', variant: 'danger' });
        if (!ok) return;
        try { await deletePontoParada(id); showToast('Registro excluído.', 'success'); load(); }
        catch (e) { showToast('Erro ao excluir: ' + e.message, 'error'); }
    };

    const openEdit = (p) => {
        setFormEdit({
            veiculo_id: p.veiculo_id != null ? String(p.veiculo_id) : '',
            tipo_local: p.tipo_local || 'Fábrica',
            local: p.local || '',
            tipo_local_chegada: p.tipo_local_chegada || 'Fábrica',
            local_chegada: p.local_chegada || '',
            cupom_fiscal: p.cupom_fiscal || '',
            data_saida: p.data_saida || '',
            horario_saida: p.horario_saida || '',
            km_saida: p.km_saida ?? '',
            data_chegada: p.data_chegada || '',
            horario_chegada: p.horario_chegada || '',
            km_chegada: p.km_chegada ?? '',
            observacoes: p.observacoes || '',
        });
        setEditModal(p);
    };

    const handleSave = async () => {
        if (!editModal) return;
        if (!formEdit.veiculo_id) {
            showToast('Selecione o veículo — obrigatório pra saber qual placa fez essa parada', 'error'); return;
        }
        setSaving(true);
        try {
            await updatePontoParada(editModal.id, {
                veiculo_id: formEdit.veiculo_id,
                local: formEdit.local,
                tipo_local: formEdit.tipo_local,
                local_chegada: formEdit.local_chegada || null,
                tipo_local_chegada: formEdit.tipo_local_chegada || null,
                cupom_fiscal: formEdit.cupom_fiscal || null,
                data_saida: formEdit.data_saida || null,
                horario_saida: formEdit.horario_saida || null,
                km_saida: formEdit.km_saida !== '' ? Number(formEdit.km_saida) : null,
                data_chegada: formEdit.data_chegada || null,
                horario_chegada: formEdit.horario_chegada || null,
                km_chegada: formEdit.km_chegada !== '' ? Number(formEdit.km_chegada) : null,
                observacoes: formEdit.observacoes || null,
            });
            showToast('Ponto atualizado!', 'success');
            setEditModal(null);
            load();
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
        finally { setSaving(false); }
    };

    return (
        <div>
            {/* Sub-abas: Registros (tela original) vs Desempenho (novo) */}
            <div className="flex items-center gap-1 mb-4 p-1 rounded-lg w-fit" style={{ backgroundColor: '#F3F4F6' }}>
                {[
                    { id: 'registros', label: 'Registros', icon: 'Navigation2' },
                    { id: 'desempenho', label: 'Desempenho', icon: 'Gauge' },
                    { id: 'horas_extras', label: 'Horas Extras', icon: 'Clock' },
                ].map(st => (
                    <button key={st.id} onClick={() => setSubTab(st.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
                        style={subTab === st.id
                            ? { backgroundColor: 'white', color: 'var(--color-text-primary)', boxShadow: '0 1px 2px rgba(0,0,0,0.06)' }
                            : { color: 'var(--color-muted-foreground)' }}>
                        <Icon name={st.icon} size={14} color={subTab === st.id ? 'var(--color-primary)' : 'var(--color-muted-foreground)'} />
                        {st.label}
                        {st.id === 'horas_extras' && horasExtrasData.porMotorista.length > 0 && (
                            <span className="ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: '#FEF3C7', color: '#B45309' }}>
                                {horasExtrasData.porMotorista.length}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {subTab === 'horas_extras' ? (
                <PainelHorasExtras dados={horasExtrasData} loading={loading} />
            ) : subTab === 'desempenho' ? (
                <PainelDesempenhoMotoristas
                    dados={desempenhoPorMotorista}
                    alertasDiarios={alertasDiarios}
                    alertasSemanais={alertasSemanais}
                    loading={loading}
                    onExport={() => exportDesempenhoMotoristasExcel(desempenhoPorMotorista)}
                />
            ) : (
            <>
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-3 mb-5">
                <PrettySelect
                    value={filtroMotorista}
                    onChange={e => setFiltroMotorista(e.target.value)}
                    className="px-3 py-2 rounded-lg border text-sm" style={inputStyle}>
                    <option value="">Todos os motoristas</option>
                    {motoristas.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </PrettySelect>
                <input type="month" value={filtroMes} onChange={e => handleSetFiltroMes(e.target.value)}
                    className="px-3 py-2 rounded-lg border text-sm" style={inputStyle} title="Filtrar por mês" />
                <PeriodRangeFilter presets={['personalizado']} preset={periodoPreset} onPresetChange={handleAplicarPeriodo} periodo={periodo} onPeriodoChange={setPeriodo} label="Período" />
                {(filtroMes || filtroMotorista || periodoPreset === 'personalizado') && (
                    <button onClick={() => { handleSetFiltroMes(''); setFiltroMotorista(''); resetPeriodo(); }}
                        className="px-2 py-1.5 rounded-lg border text-xs font-medium hover:bg-gray-50"
                        style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                        ✕ Limpar
                    </button>
                )}
                <SearchInput value={pesquisa} onChange={setPesquisa} placeholder="Local, tipo, placa, motorista..." width="220px" />
                <button onClick={() => exportPontosParadaExcel(pontosFiltrados, motoristas)}
                    disabled={!pontosFiltrados.length}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium hover:bg-gray-50 transition-colors disabled:opacity-50 ml-auto"
                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}>
                    <Icon name="Download" size={13} /> Exportar
                </button>
                <button onClick={load} className="p-2 rounded-lg border hover:bg-gray-50 transition-colors" style={{ borderColor: 'var(--color-border)' }} title="Atualizar">
                    <Icon name="RefreshCw" size={14} color="var(--color-muted-foreground)" />
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center py-16">
                    <div className="animate-spin h-7 w-7 rounded-full border-4" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
                </div>
            ) : pontosFiltrados.length === 0 ? (
                <div className="bg-white rounded-xl border p-12 flex flex-col items-center gap-3" style={{ borderColor: 'var(--color-border)' }}>
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#EFF6FF' }}>
                        <Icon name="Navigation2" size={28} color="#1D4ED8" />
                    </div>
                    <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>Nenhum ponto de parada encontrado</p>
                    <p className="text-xs text-center" style={{ color: 'var(--color-muted-foreground)' }}>
                        Os motoristas registram os pontos de parada pelo aplicativo deles.
                    </p>
                </div>
            ) : (
                <div className="rounded-xl border overflow-hidden shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs" style={{ minWidth: 820 }}>
                            <thead>
                                <tr style={{ backgroundColor: '#1D4ED8' }}>
                                    {['Motorista','Saída','Data Saída','Hor. Saída','KM Saída','Chegada','Data Chegada','Hor. Chegada','KM Chegada','Cupom','Obs.','Ações'].map(h => (
                                        <th key={h} className="px-3 py-2.5 text-left font-semibold text-white whitespace-nowrap">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {pontosComGrupo.map((p, idx) => (
                                    <React.Fragment key={p.id}>
                                    {p.__novoGrupo && idx > 0 && (
                                        <tr aria-hidden="true">
                                            <td colSpan={12} style={{ padding: 0, height: 10, backgroundColor: 'var(--color-background)', borderBottom: '2px solid #1D4ED8' }} />
                                        </tr>
                                    )}
                                    <tr
                                        className="transition-colors hover:bg-blue-50/30"
                                        style={{
                                            borderTop: p.__novoGrupo && idx === 0 ? 'none' : '1px solid var(--color-border)',
                                            backgroundColor: p.__grupoIdx % 2 === 0 ? 'white' : '#F3F6FB',
                                        }}>
                                        <td className="px-3 py-2.5">
                                            <span className="font-semibold text-xs" style={{ color: '#1D4ED8' }}>
                                                {motoristas.find(m => m.id === p.motorista_id)?.name || '—'}
                                            </span>
                                            {p.veiculo?.placa && (
                                                <p className="font-data text-xs mt-0.5" style={{ color: 'var(--color-muted-foreground)' }}>{p.veiculo.placa}</p>
                                            )}
                                        </td>
                                        <td className="px-3 py-2.5">
                                            <p className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>{p.local}</p>
                                            <span className="inline-block px-1.5 py-0.5 rounded text-xs font-medium mt-0.5"
                                                style={{ backgroundColor: TIPO_COLOR[p.tipo_local] || '#F3F4F6', color: TIPO_TEXT[p.tipo_local] || '#6B7280' }}>
                                                {p.tipo_local}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2.5 font-data whitespace-nowrap" style={{ color: 'var(--color-text-primary)' }}>
                                            {p.data_saida ? FMT_DATE(p.data_saida) : '—'}
                                        </td>
                                        <td className="px-3 py-2.5 font-data whitespace-nowrap">{p.horario_saida || '—'}</td>
                                        <td className="px-3 py-2.5 font-data text-right" style={{ color: '#1D4ED8' }}>
                                            {p.km_saida != null ? Number(p.km_saida).toLocaleString('pt-BR') : '—'}
                                        </td>
                                        <td className="px-3 py-2.5">
                                            {p.local_chegada ? (
                                                <>
                                                    <p className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>{p.local_chegada}</p>
                                                    <span className="inline-block px-1.5 py-0.5 rounded text-xs font-medium mt-0.5"
                                                        style={{ backgroundColor: TIPO_COLOR[p.tipo_local_chegada] || '#F3F4F6', color: TIPO_TEXT[p.tipo_local_chegada] || '#6B7280' }}>
                                                        {p.tipo_local_chegada}
                                                    </span>
                                                </>
                                            ) : '—'}
                                        </td>
                                        <td className="px-3 py-2.5 font-data whitespace-nowrap" style={{ color: 'var(--color-text-primary)' }}>
                                            {p.data_chegada ? FMT_DATE(p.data_chegada) : '—'}
                                        </td>
                                        <td className="px-3 py-2.5 font-data whitespace-nowrap">{p.horario_chegada || '—'}</td>
                                        <td className="px-3 py-2.5 font-data text-right" style={{ color: '#059669' }}>
                                            {p.km_chegada != null ? Number(p.km_chegada).toLocaleString('pt-BR') : '—'}
                                        </td>
                                        <td className="px-3 py-2.5 font-data whitespace-nowrap" style={{ color: 'var(--color-text-primary)' }}>
                                            {p.cupom_fiscal || '—'}
                                        </td>
                                        <td className="px-3 py-2.5 max-w-[120px] truncate" style={{ color: 'var(--color-muted-foreground)' }}
                                            title={p.observacoes}>{p.observacoes || ''}</td>
                                        <td className="px-2 py-2.5">
                                            <ActionButtonsGroup>
                                                <EditButton onClick={() => openEdit(p)} />
                                                <DeleteButton onClick={() => handleDelete(p.id)} />
                                            </ActionButtonsGroup>
                                        </td>
                                    </tr>
                                    {/* Pontos extras registrados pelo motorista */}
                                    {p.horarios_extras && p.horarios_extras.length > 0 && p.horarios_extras.map((ex, exIdx) => (
                                        <tr key={`${p.id}-ex-${exIdx}`} className="border-t" style={{ borderColor: '#E9D5FF', backgroundColor: '#FAF5FF' }}>
                                            <td className="px-3 py-1.5" style={{ color: '#6D28D9' }}>
                                                <span className="text-xs italic">↳ ponto extra</span>
                                            </td>
                                            <td className="px-3 py-1.5">
                                                <span className="text-xs font-medium px-1.5 py-0.5 rounded" style={{ backgroundColor: '#E9D5FF', color: '#6D28D9' }}>
                                                    {ex.local || `Extra #${exIdx + 1}`}
                                                </span>
                                                {ex.tipo_local && <span className="ml-1 text-xs" style={{ color: '#9CA3AF' }}>{ex.tipo_local}</span>}
                                            </td>
                                            <td className="px-3 py-1.5 font-data text-xs whitespace-nowrap" style={{ color: '#6D28D9' }}>{ex.data_saida ? FMT_DATE(ex.data_saida) : '—'}</td>
                                            <td className="px-3 py-1.5 font-data text-xs" style={{ color: '#6D28D9' }}>{ex.horario_saida || '—'}</td>
                                            <td className="px-3 py-1.5 font-data text-xs text-right" style={{ color: '#1D4ED8' }}>{ex.km_saida != null ? Number(ex.km_saida).toLocaleString('pt-BR') : '—'}</td>
                                            <td className="px-3 py-1.5">
                                                {ex.local_chegada ? (
                                                    <>
                                                        <span className="text-xs font-medium px-1.5 py-0.5 rounded" style={{ backgroundColor: '#D1FAE5', color: '#065F46' }}>
                                                            {ex.local_chegada}
                                                        </span>
                                                        {ex.tipo_local_chegada && <span className="ml-1 text-xs" style={{ color: '#9CA3AF' }}>{ex.tipo_local_chegada}</span>}
                                                    </>
                                                ) : '—'}
                                            </td>
                                            <td className="px-3 py-1.5 font-data text-xs whitespace-nowrap" style={{ color: '#6D28D9' }}>{ex.data_chegada ? FMT_DATE(ex.data_chegada) : '—'}</td>
                                            <td className="px-3 py-1.5 font-data text-xs" style={{ color: '#6D28D9' }}>{ex.horario_chegada || '—'}</td>
                                            <td className="px-3 py-1.5 font-data text-xs text-right" style={{ color: '#059669' }}>{ex.km_chegada != null ? Number(ex.km_chegada).toLocaleString('pt-BR') : '—'}</td>
                                            <td colSpan={3} />
                                        </tr>
                                    ))}
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <PaginationBar page={pontosPag.page} setPage={pontosPag.setPage} totalPages={pontosPag.totalPages}
                        totalItems={pontosPag.totalItems} pageSize={pontosPag.pageSize} itemLabel="registro" />
                </div>
            )}
            </>
            )}

            {/* Modal edição */}
            {editModal && (
                <EditModal
                    destinosParaTipo={destinosParaTipo}
                    formEdit={formEdit}
                    handleSave={handleSave}
                    inputCls={inputCls}
                    inputStyle={inputStyle}
                    saving={saving}
                    setEditModal={setEditModal}
                    setFormEdit={setFormEdit}
                    setGerenciarLocaisModal={setGerenciarLocaisModal}
                    veiculosRef={veiculosRef}
                />
            )}

            {gerenciarLocaisModal && (
                <GerenciarLocaisModal
                    locaisFabrica={locaisFabricaRef}
                    locaisOutro={locaisOutroRef}
                    onClose={() => setGerenciarLocaisModal(false)}
                    onChanged={load}
                    showToast={showToast}
                />
            )}

            <Toast toast={toast} />
            {ConfirmDialog}
        </div>
    );
}
