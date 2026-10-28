import React, { useState, useCallback, useEffect, useMemo } from 'react';

import * as XLSX from 'xlsx';

import { useToast } from 'hooks/useToast';
import { useConfirm, PrettySelect, AppIcon as Icon, Button, Toast, Field, ModalHeader, ModalOverlay, SearchInput } from 'components';
import { fetchCarregamentos, fetchCarretasVeiculos, fetchTodosMotoristas, fetchEmpresas, calcularFrete, createCarregamento, updateCarregamento, deleteCarregamento, TIPOS_CALCULO_FRETE } from 'services/carretas';
import { useRecarregarAoVoltar } from 'hooks/useRecarregarAoVoltar';

import { FMT_DATE, BRL } from '../../utils/helpers';
import { inputStyle, inputCls } from '../../utils/constants';

// ─── TAB: Carregamentos ───────────────────────────────────────────────────────
export default function TabCarregamentos({ isAdmin }) {
    const { toast, showToast } = useToast();
    const { confirm, ConfirmDialog } = useConfirm();
    const [carregamentos, setCarregamentos] = useState([]);
    const [veiculos, setVeiculos] = useState([]);
    const [motoristas, setMotoristas] = useState([]);
    const [empresas, setEmpresas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState(null);
    const mesAtualCarr = (() => { const h = new Date(); return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}`; })();
    const [filtro, setFiltro] = useState(() => {
        let savedMes = '';
        try { savedMes = sessionStorage.getItem('carregamentos_filtroMes') || ''; } catch {}
        return { empresaId: '', mes: savedMes || mesAtualCarr, dia: '' };
    });
    const handleSetFiltroMesCarr = (mes) => {
        setFiltro(f => ({ ...f, mes, dia: '' }));
        try { if (mes) sessionStorage.setItem('carregamentos_filtroMes', mes); else sessionStorage.removeItem('carregamentos_filtroMes'); } catch {}
    };
    const [form, setForm] = useState({ motorista_id: '', veiculo_id: '', empresa_id: '', data_carregamento: new Date().toISOString().split('T')[0], numero_pedido: '', numero_nota_fiscal: '', destino: '', quantidade: '', unidade_quantidade: 'saco', empresa_origem: '', tipo_calculo_frete: 'por_saco', valor_base_frete: '', observacoes: '' });

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const f = {};
            if (filtro.empresaId) f.empresaId = filtro.empresaId;
            if (filtro.dia) {
                f.dataInicio = filtro.dia; f.dataFim = filtro.dia;
            } else if (filtro.mes) { f.dataInicio = filtro.mes + '-01'; f.dataFim = filtro.mes + '-' + String(new Date(Number(filtro.mes.split('-')[0]), Number(filtro.mes.split('-')[1]), 0).getDate()).padStart(2,'0'); }
            const [c, v, m, e] = await Promise.all([fetchCarregamentos(f), fetchCarretasVeiculos(), fetchTodosMotoristas(), fetchEmpresas()]);
            setCarregamentos(c); setVeiculos(v); setMotoristas(m); setEmpresas(e);
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
        finally { setLoading(false); }
    }, [filtro]); // eslint-disable-line
    useEffect(() => { load(); }, [load]);
    useRecarregarAoVoltar(load);

    const totais = useMemo(() => ({
        carregamentos: carregamentos.length,
        freteTotal: carregamentos.reduce((s, c) => s + Number(c.valor_frete_calculado || 0), 0),
    }), [carregamentos]);

    const [pesquisa, setPesquisa] = useState('');
    const carregamentosFiltrados = useMemo(() => {
        if (!pesquisa.trim()) return carregamentos;
        const q = pesquisa.toLowerCase();
        return carregamentos.filter(c =>
            (c.numero_pedido || '').toLowerCase().includes(q) ||
            (c.numero_nota_fiscal || '').toLowerCase().includes(q) ||
            (c.motorista?.name || '').toLowerCase().includes(q) ||
            (c.destino || '').toLowerCase().includes(q) ||
            (c.veiculo?.placa || c.placa_terceiro || '').toLowerCase().includes(q)
        );
    }, [carregamentos, pesquisa]);

    // Para frete por km, precisamos do consumo do veículo selecionado
    const veiculoSelecionado = useMemo(() => veiculos.find(v => v.id === form.veiculo_id), [veiculos, form.veiculo_id]);
    const previewFrete = useMemo(() => calcularFrete(form.tipo_calculo_frete, form.quantidade, form.valor_base_frete, veiculoSelecionado?.media_consumo), [form.tipo_calculo_frete, form.quantidade, form.valor_base_frete, veiculoSelecionado]);

    const handleSubmit = async () => {
        if (!form.destino || !form.data_carregamento) { showToast('Destino e data são obrigatórios', 'error'); return; }
        const payload = { ...form, _consumoVeiculo: veiculoSelecionado?.media_consumo };
        try {
            if (modal.mode === 'create') await createCarregamento(payload);
            else await updateCarregamento(modal.data.id, payload);
            showToast('Carregamento salvo!', 'success'); setModal(null); load();
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };
    const handleDelete = async (id) => {
        const ok = await confirm({ title: 'Excluir carregamento?', message: 'Esta ação não pode ser desfeita.', confirmLabel: 'Excluir', variant: 'danger' });
        if (!ok) return;
        try { await deleteCarregamento(id); showToast('Excluído!', 'success'); load(); }
        catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };
    const exportar = () => {
        if (!carregamentos.length) { showToast('Nenhum carregamento encontrado para exportar no período selecionado.', 'error'); return; }
        const rows = carregamentos.map(c => ({
            'Data': FMT_DATE(c.data_carregamento), 'Pedido': c.numero_pedido || '', 'Motorista': c.motorista?.name || '',
            'Placa': c.veiculo?.placa || c.placa_terceiro || '', 'Empresa': c.empresa?.nome || '', 'Destino': c.destino || '',
            'Qtd': c.quantidade || 0, 'Unidade': c.unidade_quantidade || '', 'Tipo Frete': c.tipo_calculo_frete || '',
            'Base Frete': c.valor_base_frete || 0, 'Frete Calc.': c.valor_frete_calculado || 0,
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Carregamentos');
        XLSX.writeFile(wb, `carregamentos_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.xlsx`);
    };

    const openCreate = () => {
        setForm({ motorista_id: '', veiculo_id: '', empresa_id: '', data_carregamento: new Date().toISOString().split('T')[0], numero_pedido: '', numero_nota_fiscal: '', destino: '', quantidade: '', unidade_quantidade: 'saco', empresa_origem: '', tipo_calculo_frete: 'por_saco', valor_base_frete: '', observacoes: '' });
        setModal({ mode: 'create' });
    };

    return (
        <div>
            <div className="flex flex-wrap gap-3 items-center justify-between mb-5">
                <div className="flex flex-wrap gap-2">
                    <PrettySelect value={filtro.empresaId} onChange={e => setFiltro(f => ({ ...f, empresaId: e.target.value }))} className="px-3 py-2 rounded-lg border text-sm" style={inputStyle}>
                        <option value="">Todas empresas</option>
                        {empresas.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
                    </PrettySelect>
                    <input type="month" value={filtro.mes} onChange={e => handleSetFiltroMesCarr(e.target.value)}
                        className="px-3 py-2 rounded-lg border text-sm" style={inputStyle} title="Filtrar por mês" />
                    <input type="date" value={filtro.dia || ''} onChange={e => setFiltro(f => ({ ...f, dia: e.target.value, mes: '' }))}
                        className="px-3 py-2 rounded-lg border text-sm" style={inputStyle} title="Filtrar por dia específico" />
                    {(filtro.dia) && (
                        <button onClick={() => handleSetFiltroMesCarr(mesAtualCarr)}
                            className="px-2 py-1.5 rounded-lg border text-xs font-medium hover:bg-gray-50"
                            style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}
                            title="Limpar data">✕ Data</button>
                    )}
                    <SearchInput value={pesquisa} onChange={setPesquisa} placeholder="Pedido, NF, motorista, destino, placa..." width="260px" />
                </div>
                <div className="flex gap-2">
                    <button onClick={load} className="p-2 rounded-lg border hover:bg-gray-50 transition-colors" style={{ borderColor: 'var(--color-border)' }} title="Atualizar">
                        <Icon name="RefreshCw" size={14} color="var(--color-muted-foreground)" />
                    </button>
                    <button onClick={exportar} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium hover:bg-gray-50 transition-colors" style={{ borderColor: 'var(--color-border)' }}><Icon name="FileDown" size={14} /> Exportar</button>
                    <Button onClick={openCreate} iconName="Plus" size="sm">Novo Carregamento</Button>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-5">
                {[
                    { l: 'Carregamentos', v: totais.carregamentos, c: '#1D4ED8', bg: '#EFF6FF', i: 'Package' },
                    { l: 'Frete Total',   v: BRL(totais.freteTotal), c: '#7C3AED', bg: '#EDE9FE', i: 'DollarSign' },
                ].map(k => (
                    <div key={k.l} className="bg-white rounded-xl border p-4 shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
                        <div className="flex items-center gap-2 mb-1">
                            <div className="rounded-lg flex items-center justify-center" style={{ width: 28, height: 28, backgroundColor: k.bg }}><Icon name={k.i} size={14} color={k.c} /></div>
                            <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>{k.l}</span>
                        </div>
                        <p className="text-lg font-bold font-data" style={{ color: k.c }}>{k.v}</p>
                    </div>
                ))}
            </div>

            {loading ? <div className="flex justify-center py-12"><div className="animate-spin h-7 w-7 rounded-full border-4" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} /></div> : (
                <div className="bg-white rounded-xl border shadow-sm overflow-x-auto" style={{ borderColor: 'var(--color-border)' }}>
                    <table className="w-full text-sm min-w-[640px]">
                        <thead className="text-xs border-b" style={{ backgroundColor: 'var(--color-muted)', borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                            <tr>{['Data','Pedido/NF','Motorista','Placa','Empresa','Destino','Qtd','Frete',''].map(h => <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>)}</tr>
                        </thead>
                        <tbody>
                            {carregamentosFiltrados.length === 0 ? <tr><td colSpan={8} className="text-center py-12" style={{ color: 'var(--color-muted-foreground)' }}>
                                <div className="flex flex-col items-center gap-2">
                                    <Icon name="Truck" size={28} color="var(--color-muted-foreground)" />
                                    <span className="text-sm">{pesquisa ? `Nenhum resultado para "${pesquisa}"` : 'Nenhum carregamento registrado'}</span>
                                </div>
                            </td></tr>
                            : carregamentosFiltrados.map((c, i) => (
                                <tr key={c.id} className="border-t hover:bg-gray-50" style={{ borderColor: 'var(--color-border)', backgroundColor: i % 2 === 0 ? '#fff' : '#F8FAFC' }}>
                                    <td className="px-4 py-3">{FMT_DATE(c.data_carregamento)}</td>
                                    <td className="px-4 py-3 text-xs">
                                        {c.numero_pedido ? <span className="font-data">{c.numero_pedido}</span> : '—'}
                                        {c.numero_nota_fiscal && <span className="block text-gray-400">NF: {c.numero_nota_fiscal}</span>}
                                    </td>
                                    <td className="px-4 py-3">{c.motorista?.name || '—'}</td>
                                    <td className="px-4 py-3 font-data">{c.veiculo?.placa || '—'}</td>
                                    <td className="px-4 py-3 text-xs">{c.empresa?.nome || '—'}</td>
                                    <td className="px-4 py-3">{c.destino}</td>
                                    <td className="px-4 py-3 font-data text-right">{c.quantidade} {c.unidade_quantidade}</td>
                                    <td className="px-4 py-3 font-data text-right font-semibold text-purple-600">{BRL(c.valor_frete_calculado)}</td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-1">
                                            {isAdmin && <button onClick={() => handleDelete(c.id)} className="p-2 rounded hover:bg-red-50"><Icon name="Trash2" size={16} color="#DC2626" /></button>}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {modal && (
                <ModalOverlay onClose={() => setModal(null)}>
                    <ModalHeader title="Novo Carregamento" icon="Package" onClose={() => setModal(null)} />
                    <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 overflow-y-auto flex-1">
                        <Field label="Motorista"><PrettySelect value={form.motorista_id} onChange={e => setForm(f => ({ ...f, motorista_id: e.target.value }))} className={inputCls} style={inputStyle}><option value="">Selecione...</option>{motoristas.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</PrettySelect></Field>
                        <Field label="Veículo"><PrettySelect value={form.veiculo_id} onChange={e => setForm(f => ({ ...f, veiculo_id: e.target.value }))} className={inputCls} style={inputStyle}><option value="">Selecione...</option>{veiculos.map(v => <option key={v.id} value={v.id}>{v.placa} — {v.modelo}</option>)}</PrettySelect></Field>
                        <Field label="Empresa (frete)" required><PrettySelect value={form.empresa_id} onChange={e => setForm(f => ({ ...f, empresa_id: e.target.value }))} className={inputCls} style={inputStyle}><option value="">Selecione...</option>{empresas.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}</PrettySelect></Field>
                        <Field label="Empresa de origem"><PrettySelect value={form.empresa_origem} onChange={e => setForm(f => ({ ...f, empresa_origem: e.target.value }))} className={inputCls} style={inputStyle}><option value="">Selecione...</option>{empresas.map(e => <option key={e.id} value={e.nome}>{e.nome}</option>)}</PrettySelect></Field>
                        <Field label="Data" required><input type="date" value={form.data_carregamento} onChange={e => setForm(f => ({ ...f, data_carregamento: e.target.value }))} className={inputCls} style={inputStyle} /></Field>
                        <Field label="Nº do pedido"><input value={form.numero_pedido} onChange={e => setForm(f => ({ ...f, numero_pedido: e.target.value }))} className={inputCls} style={inputStyle} /></Field>
                        <Field label="Nº da nota fiscal"><input value={form.numero_nota_fiscal || ''} onChange={e => setForm(f => ({ ...f, numero_nota_fiscal: e.target.value }))} className={inputCls} style={inputStyle} /></Field>
                        <Field label="Destino" required><input value={form.destino} onChange={e => setForm(f => ({ ...f, destino: e.target.value }))} className={inputCls} style={inputStyle} placeholder="Cidade de destino" /></Field>
                        <div className="grid grid-cols-2 gap-2">
                            <Field label="Quantidade"><input type="number" step="0.01" value={form.quantidade} onChange={e => setForm(f => ({ ...f, quantidade: e.target.value }))} className={inputCls} style={inputStyle} /></Field>
                            <Field label="Unidade"><PrettySelect value={form.unidade_quantidade} onChange={e => setForm(f => ({ ...f, unidade_quantidade: e.target.value }))} className={inputCls} style={inputStyle}><option value="saco">Saco</option><option value="tonelada">Tonelada</option><option value="carga">Carga</option></PrettySelect></Field>
                        </div>
                        <div className="sm:col-span-2 p-3 rounded-xl border" style={{ borderColor: '#C4B5FD', backgroundColor: '#FAF5FF' }}>
                            <p className="text-xs font-semibold text-purple-700 mb-3">💰 Cálculo de Frete</p>
                            <div className="grid grid-cols-2 gap-3">
                                <Field label="Tipo de cálculo">
                                    <PrettySelect value={form.tipo_calculo_frete} onChange={e => setForm(f => ({ ...f, tipo_calculo_frete: e.target.value }))} className={inputCls} style={inputStyle}>
                                        {TIPOS_CALCULO_FRETE.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                    </PrettySelect>
                                </Field>
                                <Field label={
                                    form.tipo_calculo_frete === 'percentual' ? 'Percentual (%)' :
                                    form.tipo_calculo_frete === 'por_km' ? 'Preço diesel (R$/L)' : 'Valor base (R$)'
                                }>
                                    <input type="number" step="0.01" value={form.valor_base_frete} onChange={e => setForm(f => ({ ...f, valor_base_frete: e.target.value }))} className={inputCls} style={inputStyle} placeholder="0,00" />
                                </Field>
                            </div>
                            {form.tipo_calculo_frete === 'por_km' && (
                                <p className="text-xs text-purple-600 mt-2">
                                    {veiculoSelecionado?.media_consumo
                                        ? `Consumo do veículo: ${veiculoSelecionado.media_consumo} km/L — informe a distância em km no campo Quantidade`
                                        : '⚠️ Veículo sem consumo cadastrado. Cadastre o consumo em Veículos para usar este cálculo.'}
                                </p>
                            )}
                            {previewFrete > 0 && (
                                <div className="mt-3 p-2 rounded-lg bg-purple-600 text-white text-sm font-semibold flex items-center justify-between">
                                    <span>Frete calculado:</span>
                                    <span className="font-data">{BRL(previewFrete)}</span>
                                </div>
                            )}
                        </div>
                        <div className="sm:col-span-2"><Field label="Observações"><textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} className={inputCls} style={inputStyle} rows={2} /></Field></div>
                    </div>
                    <div className="flex gap-3 p-5 justify-end border-t flex-shrink-0">
                        <button onClick={() => setModal(null)} className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50" style={{ borderColor: 'var(--color-border)' }}>Cancelar</button>
                        <Button onClick={handleSubmit} size="sm" iconName="Check">Salvar</Button>
                    </div>
                </ModalOverlay>
            )}
            <Toast toast={toast} />
            {ConfirmDialog}
        </div>
    );
}
