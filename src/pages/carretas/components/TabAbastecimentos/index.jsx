import React, { useState, useCallback, useEffect, useMemo } from 'react';

import * as XLSX from 'xlsx';

import { useToast } from 'hooks/useToast';
import { useConfirm, usePeriodRangeFilter, usePagination, PrettySelect, PeriodRangeFilter, AppIcon as Icon, Button, PaginationBar, Toast, Field, ModalHeader, ModalOverlay, SearchInput } from 'components';
import { fetchAbastecimentos, fetchCarretasVeiculos, fetchCarreteirosPropriosOnly, fetchPostos, updateAbastecimento, createAbastecimento, deleteAbastecimento, updatePosto, createPosto, deletePosto } from 'services/carretas';
import { fetchCaminhoesPlacas } from 'services/vehicleService';
import { useRecarregarAoVoltar } from 'hooks/useRecarregarAoVoltar';

import { FMT_DATE, BRL } from '../../utils/helpers';
import { inputStyle, inputCls } from '../../utils/constants';
import Modal from './components/Modal';

// ─── TAB: Abastecimentos ──────────────────────────────────────────────────────
export default function TabAbastecimentos({ isAdmin, profile }) {
    const { toast, showToast } = useToast();
    const { confirm, ConfirmDialog } = useConfirm();
    const [abast, setAbast] = useState([]);
    const [veiculos, setVeiculos] = useState([]);
    const [motoristas, setMotoristas] = useState([]);

    const [postos, setPostos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [modalPostos, setModalPostos] = useState(false);
    const [editPosto, setEditPosto] = useState(null);
    const [formPosto, setFormPosto] = useState({ nome: '', cidade: '', cnpj: '', preco_diesel: '', preco_arla: '' });
    const mesAtualAbast = (() => { const h = new Date(); return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}`; })();
    const [filtro, setFiltro] = useState(() => {
        let savedMes = '';
        try { savedMes = sessionStorage.getItem('abastecimentos_filtroMes') || ''; } catch {}
        return { motoristaId: '', veiculoId: '', mes: savedMes || mesAtualAbast, dia: '' };
    });
    // Filtro adicional por período (data inicial a data final), além dos filtros de dia/mês existentes
    const { preset: periodoPreset, periodo, onPresetChange: aplicarPeriodoPreset, setPeriodo, reset: resetPeriodo } = usePeriodRangeFilter('todos');
    const handleSetFiltroMes = (mes) => {
        setFiltro(f => ({ ...f, mes, dia: '' }));
        try { if (mes) sessionStorage.setItem('abastecimentos_filtroMes', mes); else sessionStorage.removeItem('abastecimentos_filtroMes'); } catch {}
        if (periodoPreset === 'personalizado') resetPeriodo();
    };
    const handleAplicarPeriodo = (p) => {
        aplicarPeriodoPreset(p);
        if (p === 'personalizado') setFiltro(f => ({ ...f, mes: '', dia: '' }));
    };
    const [form, setForm] = useState({ motorista_id: '', veiculo_id: '', data_abastecimento: new Date().toISOString().split('T')[0], horario: '', posto_id: '', litros_diesel: '', valor_diesel: '', litros_arla: '', valor_arla: '', cupom_fiscal: '', observacoes: '' });

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const f = {};
            if (filtro.motoristaId) f.motoristaId = filtro.motoristaId;
            if (filtro.veiculoId)   f.veiculoId   = filtro.veiculoId;
            if (periodoPreset === 'personalizado' && (periodo.inicio || periodo.fim)) {
                if (periodo.inicio) f.dataInicio = periodo.inicio;
                if (periodo.fim)    f.dataFim    = periodo.fim;
            } else if (filtro.dia) {
                f.dataInicio = filtro.dia; f.dataFim = filtro.dia;
            } else if (filtro.mes) { f.dataInicio = filtro.mes + '-01'; f.dataFim = filtro.mes + '-' + String(new Date(Number(filtro.mes.split('-')[0]), Number(filtro.mes.split('-')[1]), 0).getDate()).padStart(2,'0'); }
            const [a, v, m, p, camPlacas] = await Promise.all([fetchAbastecimentos({ ...f, apenasCarretas: true }), fetchCarretasVeiculos(), fetchCarreteirosPropriosOnly(), fetchPostos().catch(() => []), fetchCaminhoesPlacas().catch(() => [])]);
            // Segunda camada de proteção: além de excluir pelo campo veiculo_caminhao_id,
            // remove qualquer registro cuja placa também exista no cadastro de caminhões
            // (página Veículos) — cobre casos legados sem o vínculo explícito.
            const placasCaminhao = new Set((camPlacas || []).map(c => (c.placa || '').toUpperCase().trim()));
            const aSoCarretas = (a || []).filter(r => {
                const placa = (r.veiculo?.placa || r.veiculo_caminhao_placa || '').toUpperCase().trim();
                return !placa || !placasCaminhao.has(placa);
            });
            setAbast(aSoCarretas); setVeiculos(v); setMotoristas(m); setPostos(p);
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
        finally { setLoading(false); }
    }, [filtro, periodoPreset, periodo]); // eslint-disable-line
    useEffect(() => { load(); }, [load]);
    useRecarregarAoVoltar(load);

    const [pesquisa, setPesquisa] = useState('');
    const abastFiltrados = useMemo(() => {
        if (!pesquisa.trim()) return abast;
        const q = pesquisa.toLowerCase();
        return abast.filter(a =>
            (a.motorista?.name || '').toLowerCase().includes(q) ||
            (a.veiculo?.placa  || '').toLowerCase().includes(q) ||
            (a.posto_rel?.nome || a.posto || '').toLowerCase().includes(q) ||
            (a.cupom_fiscal    || '').toLowerCase().includes(q)
        );
    }, [abast, pesquisa]);

    // Paginação — mostra 10 por vez, mas totais/exportação continuam
    // considerando TODOS os registros filtrados (abastFiltrados), não só a página atual.
    const abastPag = usePagination(abastFiltrados, 10, [pesquisa, filtro.motoristaId, filtro.veiculoId, filtro.mes, filtro.dia]);

    // Totais consideram os registros efetivamente filtrados (período, placa,
    // motorista e busca por texto), não apenas o total geral sem filtro.
    const totais = useMemo(() => ({
        litrosDiesel: abastFiltrados.reduce((s, a) => s + Number(a.litros_diesel || 0), 0),
        litrosArla:   abastFiltrados.reduce((s, a) => s + Number(a.litros_arla   || 0), 0),
        valorDiesel:  abastFiltrados.reduce((s, a) => s + Number(a.valor_diesel  || 0), 0),
        valorArla:    abastFiltrados.reduce((s, a) => s + Number(a.valor_arla    || 0), 0),
        valorTotal:   abastFiltrados.reduce((s, a) => s + Number(a.valor_total   || 0), 0),
    }), [abastFiltrados]);

    const handleEdit = (a) => {
        setForm({
            motorista_id: a.motorista_id || '',
            veiculo_id: a.veiculo_id || '',
            data_abastecimento: a.data_abastecimento || new Date().toISOString().split('T')[0],
            horario: a.horario || '',
            posto_id: a.posto_id || '',
            litros_diesel: a.litros_diesel != null ? String(a.litros_diesel) : '',
            valor_diesel: a.valor_diesel != null ? String(a.valor_diesel) : '',
            litros_arla: a.litros_arla != null ? String(a.litros_arla) : '',
            valor_arla: a.valor_arla != null ? String(a.valor_arla) : '',
            cupom_fiscal: a.cupom_fiscal || '',
            observacoes: a.observacoes || '',
        });
        setEditingId(a.id);
        setModal(true);
    };

    const handleSubmit = async () => {
        if (!form.veiculo_id || !form.motorista_id || !form.data_abastecimento) { showToast('Preencha veículo, motorista e data', 'error'); return; }
        if (!form.cupom_fiscal?.trim()) { showToast('Informe o N° do cupom fiscal', 'error'); return; }
        const payload = {
            ...form,
            litros_diesel: Number(form.litros_diesel || 0),
            valor_diesel: Number(form.valor_diesel || 0),
            litros_arla: Number(form.litros_arla || 0),
            valor_arla: Number(form.valor_arla || 0),
        };
        if (!payload.posto_id) delete payload.posto_id;
        const posto = postos.find(p => p.id === form.posto_id);
        if (posto) payload.posto = posto.nome;
        try {
            if (editingId) { await updateAbastecimento(editingId, payload); showToast('Abastecimento atualizado!', 'success'); }
            else { await createAbastecimento(payload); showToast('Abastecimento registrado!', 'success'); }
            setModal(false); setEditingId(null); load();
        }
        catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };
    const handleDelete = async (id) => {
        const ok = await confirm({ title: 'Excluir abastecimento?', message: 'Esta ação não pode ser desfeita.', confirmLabel: 'Excluir', variant: 'danger' });
        if (!ok) return;
        try { await deleteAbastecimento(id); showToast('Excluído!', 'success'); load(); }
        catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };

    const handleSavePosto = async () => {
        if (!formPosto.nome.trim()) { showToast('Nome do posto é obrigatório', 'error'); return; }
        try {
            if (editPosto) { await updatePosto(editPosto.id, formPosto); showToast('Posto atualizado!', 'success'); }
            else { await createPosto(formPosto); showToast('Posto cadastrado!', 'success'); }
            setEditPosto(null); setFormPosto({ nome: '', cidade: '', cnpj: '', preco_diesel: '', preco_arla: '' });
            const p = await fetchPostos().catch(() => []); setPostos(p);
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };

    // Auto-preenche preços quando motorista seleciona o posto
    const handlePostoChange = (postoId) => {
        const posto = postos.find(p => p.id === postoId);
        setForm(f => ({
            ...f,
            posto_id: postoId,
            // Preenche valor automaticamente se o posto tiver preço cadastrado
            valor_diesel: posto?.preco_diesel && f.litros_diesel
                ? (Number(f.litros_diesel) * Number(posto.preco_diesel)).toFixed(2)
                : f.valor_diesel,
            valor_arla: posto?.preco_arla && f.litros_arla
                ? (Number(f.litros_arla) * Number(posto.preco_arla)).toFixed(2)
                : f.valor_arla,
        }));
    };

    // Recalcula valor ao mudar litros quando posto já está selecionado
    const handleLitrosChange = (campo, valor) => {
        const posto = postos.find(p => p.id === form.posto_id);
        setForm(f => {
            const novo = { ...f, [campo]: valor };
            if (campo === 'litros_diesel' && posto?.preco_diesel) {
                novo.valor_diesel = valor ? (Number(valor) * Number(posto.preco_diesel)).toFixed(2) : '';
            }
            if (campo === 'litros_arla' && posto?.preco_arla) {
                novo.valor_arla = valor ? (Number(valor) * Number(posto.preco_arla)).toFixed(2) : '';
            }
            return novo;
        });
    };
    const handleDeletePosto = async (id) => {
        const ok = await confirm({ title: 'Excluir posto?', message: 'Esta ação não pode ser desfeita.', confirmLabel: 'Excluir', variant: 'danger' });
        if (!ok) return;
        try { await deletePosto(id); showToast('Excluído!', 'success'); const p = await fetchPostos().catch(() => []); setPostos(p); }
        catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };

    const exportar = () => {
        if (!abastFiltrados.length) { showToast('Nenhum abastecimento encontrado para exportar.', 'error'); return; }
        const rows = abastFiltrados.map(a => ({
            'Data': FMT_DATE(a.data_abastecimento), 'Horário': a.horario || '', 'Motorista': a.motorista?.name || '', 'Placa': a.veiculo?.placa || '',
            'Posto': a.posto || '', 'Cupom': a.cupom_fiscal || '', 'L. Diesel': Number(a.litros_diesel || 0), 'R$ Diesel': Number(a.valor_diesel || 0),
            'L. Arla': Number(a.litros_arla || 0), 'R$ Arla': Number(a.valor_arla || 0), 'Total R$': Number(a.valor_total || 0),
            'Observações': a.observacoes || '',
        }));
        // linha totais (reflete os registros filtrados/exportados)
        rows.push({ 'Data': 'TOTAL', 'L. Diesel': totais.litrosDiesel, 'R$ Diesel': totais.valorDiesel, 'L. Arla': totais.litrosArla, 'R$ Arla': totais.valorArla, 'Total R$': totais.valorTotal });
        const ws = XLSX.utils.json_to_sheet(rows);
        ws['!cols'] = [12,8,20,12,18,12,10,12,10,12,12,25].map(w => ({ wch: w }));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Abastecimentos');
        XLSX.writeFile(wb, `abastecimentos_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.xlsx`);
        showToast('Exportado!', 'success');
    };

    const postoNome = (a) => a.posto || (postos.find(p => p.id === a.posto_id)?.nome) || '—';

    return (
        <div>
            <div className="flex flex-wrap gap-2 items-center justify-between mb-5">
                <div className="flex flex-wrap gap-2 items-center">
                    {isAdmin && (
                        <PrettySelect value={filtro.motoristaId} onChange={e => setFiltro(f => ({ ...f, motoristaId: e.target.value }))} className="px-3 py-2 rounded-lg border text-sm" style={inputStyle}>
                            <option value="">Todos motoristas</option>
                            {motoristas.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </PrettySelect>
                    )}
                    <PrettySelect value={filtro.veiculoId} onChange={e => setFiltro(f => ({ ...f, veiculoId: e.target.value }))} className="px-3 py-2 rounded-lg border text-sm" style={inputStyle}>
                        <option value="">Todos veículos</option>
                        {veiculos.map(v => <option key={v.id} value={v.id}>{v.placa}</option>)}
                    </PrettySelect>
                    <input type="month" value={filtro.mes} onChange={e => handleSetFiltroMes(e.target.value)}
                        className="px-3 py-2 rounded-lg border text-sm" style={inputStyle} title="Filtrar por mês" />
                    <input type="date" value={filtro.dia || ''} onChange={e => { setFiltro(f => ({ ...f, dia: e.target.value, mes: '' })); if (periodoPreset === 'personalizado') resetPeriodo(); }}
                        className="px-3 py-2 rounded-lg border text-sm" style={inputStyle} title="Filtrar por dia específico" />
                    {(filtro.dia) && (
                        <button onClick={() => handleSetFiltroMes(mesAtualAbast)}
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
                    <SearchInput value={pesquisa} onChange={setPesquisa} placeholder="Motorista, placa, posto, cupom..." width="230px" />
                </div>
                <div className="flex gap-2 flex-wrap">
                    {/* item 4: botão atualizar */}
                    <button onClick={load} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium hover:bg-gray-50 transition-colors" style={{ borderColor: 'var(--color-border)' }} title="Atualizar">
                        <Icon name="RefreshCw" size={14} color="var(--color-muted-foreground)" />
                    </button>
                    {isAdmin && (
                        <button onClick={() => setModalPostos(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium hover:bg-gray-50 transition-colors" style={{ borderColor: 'var(--color-border)' }}>
                            <Icon name="MapPin" size={14} /> Postos
                        </button>
                    )}
                    <button onClick={exportar} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium hover:bg-gray-50 transition-colors" style={{ borderColor: 'var(--color-border)' }}><Icon name="FileDown" size={14} /> Exportar</button>
                    <Button onClick={() => { setForm({ motorista_id: isAdmin ? '' : (profile?.id || ''), veiculo_id: '', data_abastecimento: new Date().toISOString().split('T')[0], horario: '', posto_id: '', litros_diesel: '', valor_diesel: '', litros_arla: '', valor_arla: '', cupom_fiscal: '', observacoes: '' }); setEditingId(null); setModal(true); }} iconName="Plus" size="sm">Registrar</Button>
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
                {[
                    { l: 'Diesel (L)', v: totais.litrosDiesel.toLocaleString('pt-BR', { maximumFractionDigits: 1 }), c: '#1D4ED8', bg: '#EFF6FF', i: 'Fuel' },
                    { l: 'Custo Diesel', v: BRL(totais.valorDiesel), c: '#1D4ED8', bg: '#EFF6FF', i: 'DollarSign' },
                    { l: 'Arla (L)', v: totais.litrosArla.toLocaleString('pt-BR', { maximumFractionDigits: 1 }), c: '#059669', bg: '#D1FAE5', i: 'Droplets' },
                    { l: 'Custo Arla', v: BRL(totais.valorArla), c: '#059669', bg: '#D1FAE5', i: 'DollarSign' },
                    { l: 'Gasto Total', v: BRL(totais.valorTotal), c: '#7C3AED', bg: '#EDE9FE', i: 'Receipt' },
                ].map(k => (
                    <div key={k.l} className="bg-white rounded-xl border p-4 shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
                        <div className="flex items-center gap-2 mb-1">
                            <div className="rounded-lg flex items-center justify-center" style={{ width: 28, height: 28, backgroundColor: k.bg }}><Icon name={k.i} size={14} color={k.c} /></div>
                            <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>{k.l}</span>
                        </div>
                        <p className="text-lg font-bold font-data" style={{ color: k.c }}>{k.v}</p>
                        {k.sub && <p className="text-xs font-data font-semibold" style={{ color: k.c }}>{k.sub}</p>}
                    </div>
                ))}
            </div>

            {loading ? <div className="flex justify-center py-12"><div className="animate-spin h-7 w-7 rounded-full border-4" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} /></div> : (
                <div className="bg-white rounded-xl border shadow-sm overflow-x-auto" style={{ borderColor: 'var(--color-border)' }}>
                    <table className="w-full text-sm min-w-[700px]">
                        <thead className="text-xs border-b" style={{ backgroundColor: 'var(--color-muted)', borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                            <tr>{['Data','Motorista','Placa','Posto','Cupom','Diesel (L)','R$ Diesel','Arla (L)','R$ Arla','Total',''].map(h => <th key={h} className="px-3 py-3 text-left font-medium whitespace-nowrap">{h}</th>)}</tr>
                        </thead>
                        <tbody>
                            {abastFiltrados.length === 0 ? <tr><td colSpan={11} className="text-center py-12" style={{ color: 'var(--color-muted-foreground)' }}>
                                <div className="flex flex-col items-center gap-2">
                                    <Icon name="Fuel" size={28} color="var(--color-muted-foreground)" />
                                    <span className="text-sm">{pesquisa ? `Nenhum resultado para "${pesquisa}"` : 'Nenhum abastecimento registrado'}</span>
                                </div>
                            </td></tr>
                            : abastPag.pageItems.map((a, i) => (
                                <tr key={a.id} className="border-t hover:bg-gray-50" style={{ borderColor: 'var(--color-border)', backgroundColor: i % 2 === 0 ? '#fff' : '#F8FAFC' }}>
                                    <td className="px-3 py-3 whitespace-nowrap">{FMT_DATE(a.data_abastecimento)}</td>
                                    <td className="px-3 py-3 whitespace-nowrap">{a.motorista?.name || '—'}</td>
                                    <td className="px-3 py-3 font-data whitespace-nowrap">{a.veiculo?.placa || '—'}</td>
                                    <td className="px-3 py-3 text-xs max-w-[120px] truncate">{postoNome(a)}</td>
                                    <td className="px-3 py-3 font-data text-xs whitespace-nowrap">{a.cupom_fiscal || '—'}</td>
                                    <td className="px-3 py-3 font-data text-right text-blue-700">{Number(a.litros_diesel || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</td>
                                    <td className="px-3 py-3 font-data text-right">{BRL(a.valor_diesel)}</td>
                                    <td className="px-3 py-3 font-data text-right text-emerald-600">{Number(a.litros_arla || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</td>
                                    <td className="px-3 py-3 font-data text-right text-emerald-700">{BRL(a.valor_arla)}</td>
                                    <td className="px-3 py-3 font-data text-right font-semibold text-purple-600">{BRL(a.valor_total)}</td>
                                    <td className="px-3 py-3">
                                        <div className="flex items-center gap-1">
                                            {isAdmin && <button onClick={() => handleEdit(a)} className="p-2 rounded hover:bg-blue-50" title="Editar"><Icon name="Pencil" size={16} color="#2563EB" /></button>}
                                            {isAdmin && <button onClick={() => handleDelete(a.id)} className="p-2 rounded hover:bg-red-50" title="Excluir"><Icon name="Trash2" size={16} color="#DC2626" /></button>}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        {abastFiltrados.length > 0 && (
                            <tfoot>
                                <tr style={{ backgroundColor: '#F0F9FF', borderTop: '2px solid #BFDBFE' }}>
                                    <td colSpan={5} className="px-3 py-2 text-xs font-bold text-blue-800">TOTAL</td>
                                    <td className="px-3 py-2 font-data font-bold text-right text-blue-700">{totais.litrosDiesel.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</td>
                                    <td className="px-3 py-2 font-data font-bold text-right text-blue-700">{BRL(totais.valorDiesel)}</td>
                                    <td className="px-3 py-2 font-data font-bold text-right text-emerald-700">{totais.litrosArla.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</td>
                                    <td className="px-3 py-2 font-data font-bold text-right text-emerald-700">{BRL(totais.valorArla)}</td>
                                    <td className="px-3 py-2 font-data font-bold text-right text-purple-700">{BRL(totais.valorTotal)}</td>
                                    <td />
                                </tr>
                            </tfoot>
                        )}
                    </table>
                    <PaginationBar page={abastPag.page} setPage={abastPag.setPage} totalPages={abastPag.totalPages}
                        totalItems={abastPag.totalItems} pageSize={abastPag.pageSize} itemLabel="abastecimento" />
                </div>
            )}

            {/* Modal registrar abastecimento */}
            {modal && (
                <Modal
                    editingId={editingId}
                    form={form}
                    handleLitrosChange={handleLitrosChange}
                    handlePostoChange={handlePostoChange}
                    handleSubmit={handleSubmit}
                    isAdmin={isAdmin}
                    motoristas={motoristas}
                    postos={postos}
                    setEditingId={setEditingId}
                    setForm={setForm}
                    setModal={setModal}
                    veiculos={veiculos}
                />
            )}

            {/* Modal gerenciar postos (admin) */}
            {modalPostos && isAdmin && (
                <ModalOverlay onClose={() => { setModalPostos(false); setEditPosto(null); setFormPosto({ nome: '', cidade: '', cnpj: '', preco_diesel: '', preco_arla: '' }); }}>
                    <ModalHeader title="Gerenciar Postos de Combustível" icon="MapPin" onClose={() => { setModalPostos(false); setEditPosto(null); setFormPosto({ nome: '', cidade: '', cnpj: '', preco_diesel: '', preco_arla: '' }); }} />
                    <div className="p-5 overflow-y-auto flex-1">
                        {/* Formulário add/edit */}
                        <div className="p-4 rounded-xl border mb-4" style={{ borderColor: 'var(--color-border)', backgroundColor: '#F8FAFC' }}>
                            <p className="text-xs font-semibold mb-3" style={{ color: 'var(--color-text-secondary)' }}>
                                {editPosto ? '✏️ Editar Posto' : '➕ Novo Posto'}
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <Field label="Nome do posto" required>
                                    <input value={formPosto.nome} onChange={e => setFormPosto(f => ({ ...f, nome: e.target.value }))} className={inputCls} style={inputStyle} placeholder="Ex: Posto Shell Centro" />
                                </Field>
                                <Field label="Cidade">
                                    <input value={formPosto.cidade} onChange={e => setFormPosto(f => ({ ...f, cidade: e.target.value }))} className={inputCls} style={inputStyle} placeholder="Ex: Guanambi" />
                                </Field>
                                <Field label="CNPJ (opcional)">
                                    <input value={formPosto.cnpj} onChange={e => setFormPosto(f => ({ ...f, cnpj: e.target.value }))} className={inputCls} style={inputStyle} placeholder="00.000.000/0001-00" />
                                </Field>
                            </div>
                            {/* Preços de combustível */}
                            <div className="grid grid-cols-2 gap-3 mt-3 p-3 rounded-lg" style={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE' }}>
                                <div>
                                    <label className="block text-xs font-semibold text-blue-700 mb-1.5">🛢️ Preço Diesel (R$/L)</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium text-blue-600">R$</span>
                                        <input type="number" step="0.001" min="0" value={formPosto.preco_diesel}
                                            onChange={e => setFormPosto(f => ({ ...f, preco_diesel: e.target.value }))}
                                            className={inputCls + ' pl-8'} style={inputStyle} placeholder="6,800" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-emerald-700 mb-1.5">💧 Preço Arla (R$/L)</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium text-emerald-600">R$</span>
                                        <input type="number" step="0.001" min="0" value={formPosto.preco_arla}
                                            onChange={e => setFormPosto(f => ({ ...f, preco_arla: e.target.value }))}
                                            className={inputCls + ' pl-8'} style={inputStyle} placeholder="3,200" />
                                    </div>
                                </div>
                                <p className="col-span-2 text-xs text-blue-600">Preços preenchidos automaticamente ao motorista selecionar este posto no abastecimento.</p>
                            </div>
                            <div className="flex gap-2 mt-3">
                                <Button onClick={handleSavePosto} size="sm" iconName={editPosto ? 'Save' : 'Plus'}>{editPosto ? 'Atualizar Posto' : 'Adicionar Posto'}</Button>
                                {editPosto && (
                                    <button onClick={() => { setEditPosto(null); setFormPosto({ nome: '', cidade: '', cnpj: '', preco_diesel: '', preco_arla: '' }); }}
                                        className="px-3 py-1.5 rounded-lg border text-xs hover:bg-gray-50" style={{ borderColor: 'var(--color-border)' }}>
                                        Cancelar
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Lista de postos */}
                        <p className="text-xs font-semibold mb-2" style={{ color: 'var(--color-text-secondary)' }}>Postos cadastrados ({postos.length})</p>
                        <div className="space-y-2 max-h-72 overflow-y-auto">
                            {postos.length === 0 && (
                                <div className="flex flex-col items-center justify-center py-6 gap-1.5" style={{ color: 'var(--color-muted-foreground)' }}>
                                    <Icon name="MapPin" size={24} color="var(--color-muted-foreground)" />
                                    <p className="text-sm">Nenhum posto cadastrado</p>
                                </div>
                            )}
                            {postos.map(p => (
                                <div key={p.id} className="flex items-center justify-between p-3 rounded-lg border" style={{ borderColor: 'var(--color-border)' }}>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{p.nome}</p>
                                        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                                            {p.cidade && <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>{p.cidade}</span>}
                                            {p.preco_diesel && (
                                                <span className="text-xs font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                                                    🛢️ R$ {Number(p.preco_diesel).toFixed(3)}/L
                                                </span>
                                            )}
                                            {p.preco_arla && (
                                                <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                                                    💧 R$ {Number(p.preco_arla).toFixed(3)}/L
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex gap-1 ml-2">
                                        <button onClick={() => {
                                            setEditPosto(p);
                                            setFormPosto({ nome: p.nome, cidade: p.cidade || '', cnpj: p.cnpj || '', preco_diesel: p.preco_diesel || '', preco_arla: p.preco_arla || '' });
                                        }} className="p-2 rounded hover:bg-blue-50"><Icon name="Pencil" size={16} color="#1D4ED8" /></button>
                                        <button onClick={() => handleDeletePosto(p.id)} className="p-2 rounded hover:bg-red-50"><Icon name="Trash2" size={16} color="#DC2626" /></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </ModalOverlay>
            )}
            <Toast toast={toast} />
            {ConfirmDialog}
        </div>
    );
}
