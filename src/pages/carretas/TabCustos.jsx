import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Icon from 'components/AppIcon';
import Button from 'components/ui/Button';
import Toast from 'components/ui/Toast';
import { useToast } from 'utils/useToast';
import { useConfirm } from 'components/ui/ConfirmDialog';
import {
    fetchCustosItens, createCustoItem, updateCustoItem, deleteCustoItem,
    fetchCustosConfig, updateCustosConfig,
    fetchCustosDestinos, createCustoDestino, updateCustoDestino, deleteCustoDestino,
    calcularCustosTotais, calcularCustoKmItem, calcularCustoDiaItem, calcularCustoDestino,
} from 'utils/custosFrotaService';

const BRL = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const inputCls = 'w-full px-2.5 py-1.5 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-blue-500/20';
const inputStyle = { borderColor: 'var(--color-border)' };

// ─── Linha editável de item de custo (KM ou Dia) ──────────────────────────────
function LinhaItem({ item, categoria, cor, isAdmin, onSave, onDelete }) {
    const [editando, setEditando] = useState(false);
    const [form, setForm] = useState(item);
    useEffect(() => { setForm(item); }, [item]);

    const valorCalculado = categoria === 'km' ? calcularCustoKmItem(form) : calcularCustoDiaItem(form);

    if (editando) {
        return (
            <tr style={{ backgroundColor: cor + '08' }}>
                <td className="px-3 py-2"><input value={form.nome || ''} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} className={inputCls} style={inputStyle} placeholder="Nome do item" /></td>
                {categoria === 'km' ? (
                    <>
                        <td className="px-3 py-2"><input type="number" step="0.01" value={form.preco_unidade ?? ''} onChange={e => setForm(f => ({ ...f, preco_unidade: e.target.value }))} className={inputCls} style={{ ...inputStyle, textAlign: 'right' }} placeholder="0,00" /></td>
                        <td className="px-3 py-2"><input type="number" value={form.km_vida_util ?? ''} onChange={e => setForm(f => ({ ...f, km_vida_util: e.target.value }))} className={inputCls} style={{ ...inputStyle, textAlign: 'right' }} placeholder="0" /></td>
                        <td className="px-3 py-2"><input type="number" step="0.5" value={form.unidades_por_veiculo ?? ''} onChange={e => setForm(f => ({ ...f, unidades_por_veiculo: e.target.value }))} className={inputCls} style={{ ...inputStyle, textAlign: 'right' }} placeholder="1" /></td>
                    </>
                ) : (
                    <>
                        <td className="px-3 py-2"><input type="number" step="0.01" value={form.valor_mensal ?? ''} onChange={e => setForm(f => ({ ...f, valor_mensal: e.target.value, valor_anual: '' }))} className={inputCls} style={{ ...inputStyle, textAlign: 'right' }} placeholder="0,00" /></td>
                        <td className="px-3 py-2"><input type="number" step="0.01" value={form.valor_anual ?? ''} onChange={e => setForm(f => ({ ...f, valor_anual: e.target.value, valor_mensal: '' }))} className={inputCls} style={{ ...inputStyle, textAlign: 'right' }} placeholder="0,00" /></td>
                    </>
                )}
                <td className="px-3 py-2 text-right font-data font-semibold" style={{ color: cor }}>{BRL(valorCalculado)}</td>
                <td className="px-3 py-2">
                    <div className="flex items-center justify-center gap-1">
                        <button onClick={() => { onSave(form); setEditando(false); }} className="p-1.5 rounded-lg hover:bg-green-100"><Icon name="Check" size={14} color="#059669" /></button>
                        <button onClick={() => { setForm(item); setEditando(false); }} className="p-1.5 rounded-lg hover:bg-gray-200"><Icon name="X" size={14} color="#6B7280" /></button>
                    </div>
                </td>
            </tr>
        );
    }

    return (
        <tr className="border-t hover:bg-gray-50" style={{ borderColor: 'var(--color-border)' }}>
            <td className="px-3 py-2 font-medium">{item.nome}</td>
            {categoria === 'km' ? (
                <>
                    <td className="px-3 py-2 text-right font-data">{item.preco_unidade ? BRL(item.preco_unidade) : '—'}</td>
                    <td className="px-3 py-2 text-right font-data">{item.km_vida_util ? Number(item.km_vida_util).toLocaleString('pt-BR') : '—'}</td>
                    <td className="px-3 py-2 text-right font-data">{item.unidades_por_veiculo || '—'}</td>
                </>
            ) : (
                <>
                    <td className="px-3 py-2 text-right font-data">{item.valor_mensal ? BRL(item.valor_mensal) : '—'}</td>
                    <td className="px-3 py-2 text-right font-data">{item.valor_anual ? BRL(item.valor_anual) : '—'}</td>
                </>
            )}
            <td className="px-3 py-2 text-right font-data font-semibold" style={{ color: cor }}>{BRL(valorCalculado)}</td>
            <td className="px-3 py-2">
                {isAdmin && (
                    <div className="flex items-center justify-center gap-1">
                        <button onClick={() => setEditando(true)} className="p-1.5 rounded-lg hover:bg-blue-100"><Icon name="Pencil" size={13} color="#2563EB" /></button>
                        <button onClick={() => onDelete(item)} className="p-1.5 rounded-lg hover:bg-red-100"><Icon name="Trash2" size={13} color="#DC2626" /></button>
                    </div>
                )}
            </td>
        </tr>
    );
}

// ─── Tabela de itens de custo (por KM ou por Dia) ─────────────────────────────
function TabelaItens({ tipoVeiculo, categoria, itens, isAdmin, cor, onChanged }) {
    const { toast, showToast } = useToast();
    const { confirm, ConfirmDialog } = useConfirm();
    const [addMode, setAddMode] = useState(false);
    const [novo, setNovo] = useState({ nome: '', preco_unidade: '', km_vida_util: '', unidades_por_veiculo: 1, valor_mensal: '', valor_anual: '' });

    const salvarNovo = async () => {
        if (!novo.nome?.trim()) { showToast('Informe o nome do item.', 'error'); return; }
        try {
            await createCustoItem({
                tipo_veiculo: tipoVeiculo, categoria, nome: novo.nome.trim(),
                preco_unidade: categoria === 'km' ? Number(novo.preco_unidade || 0) : null,
                km_vida_util: categoria === 'km' ? Number(novo.km_vida_util || 0) : null,
                unidades_por_veiculo: categoria === 'km' ? Number(novo.unidades_por_veiculo || 1) : null,
                valor_mensal: categoria === 'dia' ? (novo.valor_mensal ? Number(novo.valor_mensal) : null) : null,
                valor_anual: categoria === 'dia' ? (novo.valor_anual ? Number(novo.valor_anual) : null) : null,
            });
            setNovo({ nome: '', preco_unidade: '', km_vida_util: '', unidades_por_veiculo: 1, valor_mensal: '', valor_anual: '' });
            setAddMode(false);
            showToast('Item adicionado!', 'success');
            onChanged();
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };

    const salvarEdicao = async (form) => {
        try {
            await updateCustoItem(form.id, {
                nome: form.nome,
                preco_unidade: categoria === 'km' ? Number(form.preco_unidade || 0) : null,
                km_vida_util: categoria === 'km' ? Number(form.km_vida_util || 0) : null,
                unidades_por_veiculo: categoria === 'km' ? Number(form.unidades_por_veiculo || 1) : null,
                valor_mensal: categoria === 'dia' ? (form.valor_mensal ? Number(form.valor_mensal) : null) : null,
                valor_anual: categoria === 'dia' ? (form.valor_anual ? Number(form.valor_anual) : null) : null,
            });
            showToast('Item atualizado!', 'success');
            onChanged();
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };

    const excluir = async (item) => {
        const ok = await confirm({ title: 'Excluir item?', message: `Remover "${item.nome}" dos custos?`, confirmLabel: 'Excluir', variant: 'danger' });
        if (!ok) return;
        try { await deleteCustoItem(item.id); showToast('Item removido.', 'success'); onChanged(); }
        catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };

    return (
        <div className="bg-white rounded-xl border shadow-sm overflow-x-auto" style={{ borderColor: 'var(--color-border)' }}>
            <table className="w-full text-sm min-w-[560px]">
                <thead className="text-xs border-b" style={{ backgroundColor: 'var(--color-muted)', borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                    <tr>
                        {(categoria === 'km'
                            ? ['Item', 'Preço da unidade', 'KM de vida útil', 'Unid. por veículo', 'Custo / KM', '']
                            : ['Item', 'Valor mensal', 'Valor anual', 'Custo / Dia', '']
                        ).map(h => <th key={h} className="px-3 py-2.5 text-left font-medium whitespace-nowrap">{h}</th>)}
                    </tr>
                </thead>
                <tbody>
                    {itens.length === 0 && !addMode && (
                        <tr><td colSpan={categoria === 'km' ? 6 : 5} className="text-center py-8 text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Nenhum item cadastrado.</td></tr>
                    )}
                    {itens.map(item => (
                        <LinhaItem key={item.id} item={item} categoria={categoria} cor={cor} isAdmin={isAdmin} onSave={salvarEdicao} onDelete={excluir} />
                    ))}
                    {addMode && (
                        <tr style={{ backgroundColor: cor + '08' }}>
                            <td className="px-3 py-2"><input autoFocus value={novo.nome} onChange={e => setNovo(f => ({ ...f, nome: e.target.value }))} className={inputCls} style={inputStyle} placeholder="Ex: Pneus - Cavalo" /></td>
                            {categoria === 'km' ? (
                                <>
                                    <td className="px-3 py-2"><input type="number" step="0.01" value={novo.preco_unidade} onChange={e => setNovo(f => ({ ...f, preco_unidade: e.target.value }))} className={inputCls} style={{ ...inputStyle, textAlign: 'right' }} placeholder="0,00" /></td>
                                    <td className="px-3 py-2"><input type="number" value={novo.km_vida_util} onChange={e => setNovo(f => ({ ...f, km_vida_util: e.target.value }))} className={inputCls} style={{ ...inputStyle, textAlign: 'right' }} placeholder="0" /></td>
                                    <td className="px-3 py-2"><input type="number" step="0.5" value={novo.unidades_por_veiculo} onChange={e => setNovo(f => ({ ...f, unidades_por_veiculo: e.target.value }))} className={inputCls} style={{ ...inputStyle, textAlign: 'right' }} placeholder="1" /></td>
                                </>
                            ) : (
                                <>
                                    <td className="px-3 py-2"><input type="number" step="0.01" value={novo.valor_mensal} onChange={e => setNovo(f => ({ ...f, valor_mensal: e.target.value }))} className={inputCls} style={{ ...inputStyle, textAlign: 'right' }} placeholder="0,00" /></td>
                                    <td className="px-3 py-2"><input type="number" step="0.01" value={novo.valor_anual} onChange={e => setNovo(f => ({ ...f, valor_anual: e.target.value }))} className={inputCls} style={{ ...inputStyle, textAlign: 'right' }} placeholder="0,00" /></td>
                                </>
                            )}
                            <td className="px-3 py-2 text-right text-xs" style={{ color: 'var(--color-muted-foreground)' }}>—</td>
                            <td className="px-3 py-2">
                                <div className="flex items-center justify-center gap-1">
                                    <button onClick={salvarNovo} className="p-1.5 rounded-lg hover:bg-green-100"><Icon name="Check" size={14} color="#059669" /></button>
                                    <button onClick={() => setAddMode(false)} className="p-1.5 rounded-lg hover:bg-red-100"><Icon name="X" size={14} color="#DC2626" /></button>
                                </div>
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
            {isAdmin && !addMode && (
                <div className="p-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
                    <button onClick={() => setAddMode(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-gray-50" style={{ color: cor }}>
                        <Icon name="Plus" size={13} color={cor} /> Adicionar item
                    </button>
                </div>
            )}
            <Toast toast={toast} />
            {ConfirmDialog}
        </div>
    );
}

// ─── Linha editável de destino ────────────────────────────────────────────────
function LinhaDestino({ destino, custoPorKm, custoPorDia, margemPadrao, isAdmin, onSave, onDelete }) {
    const [editando, setEditando] = useState(false);
    const [form, setForm] = useState(destino);
    useEffect(() => { setForm(destino); }, [destino]);

    const calc = calcularCustoDestino(editando ? form : destino, custoPorKm, custoPorDia, margemPadrao);

    if (editando) {
        return (
            <tr style={{ backgroundColor: '#EEF2FF08' }}>
                <td className="px-3 py-2"><input value={form.destino || ''} onChange={e => setForm(f => ({ ...f, destino: e.target.value }))} className={inputCls} style={inputStyle} /></td>
                <td className="px-3 py-2"><input type="number" value={form.distancia_km ?? ''} onChange={e => setForm(f => ({ ...f, distancia_km: e.target.value }))} className={inputCls} style={{ ...inputStyle, textAlign: 'right' }} /></td>
                <td className="px-3 py-2"><input type="number" step="0.5" value={form.dias_viagem ?? ''} onChange={e => setForm(f => ({ ...f, dias_viagem: e.target.value }))} className={inputCls} style={{ ...inputStyle, textAlign: 'right' }} /></td>
                <td className="px-3 py-2"><input type="number" step="0.1" value={form.margem_lucro_pct ?? ''} onChange={e => setForm(f => ({ ...f, margem_lucro_pct: e.target.value }))} className={inputCls} style={{ ...inputStyle, textAlign: 'right' }} placeholder={String(margemPadrao)} /></td>
                <td className="px-3 py-2 text-right font-data" style={{ color: 'var(--color-muted-foreground)' }}>{BRL(calc.custoTotal)}</td>
                <td className="px-3 py-2 text-right font-data font-semibold text-indigo-700">{BRL(calc.valorEstimado)}</td>
                <td className="px-3 py-2"><input type="number" step="0.01" value={form.valor_praticado ?? ''} onChange={e => setForm(f => ({ ...f, valor_praticado: e.target.value }))} className={inputCls} style={{ ...inputStyle, textAlign: 'right' }} placeholder="0,00" /></td>
                <td className="px-3 py-2 text-right font-data" style={{ color: calc.diferenca == null ? 'var(--color-muted-foreground)' : calc.diferenca >= 0 ? '#059669' : '#DC2626' }}>{calc.diferenca == null ? '—' : BRL(calc.diferenca)}</td>
                <td className="px-3 py-2">
                    <div className="flex items-center justify-center gap-1">
                        <button onClick={() => { onSave(form); setEditando(false); }} className="p-1.5 rounded-lg hover:bg-green-100"><Icon name="Check" size={14} color="#059669" /></button>
                        <button onClick={() => { setForm(destino); setEditando(false); }} className="p-1.5 rounded-lg hover:bg-gray-200"><Icon name="X" size={14} color="#6B7280" /></button>
                    </div>
                </td>
            </tr>
        );
    }

    return (
        <tr className="border-t hover:bg-gray-50" style={{ borderColor: 'var(--color-border)' }}>
            <td className="px-3 py-2 font-medium">{destino.destino}</td>
            <td className="px-3 py-2 text-right font-data">{Number(destino.distancia_km || 0).toLocaleString('pt-BR')} km</td>
            <td className="px-3 py-2 text-right font-data">{destino.dias_viagem}</td>
            <td className="px-3 py-2 text-right font-data text-xs" style={{ color: 'var(--color-muted-foreground)' }}>{destino.margem_lucro_pct != null ? `${destino.margem_lucro_pct}%` : `${margemPadrao}% (padrão)`}</td>
            <td className="px-3 py-2 text-right font-data" style={{ color: 'var(--color-muted-foreground)' }}>{BRL(calc.custoTotal)}</td>
            <td className="px-3 py-2 text-right font-data font-semibold text-indigo-700">{BRL(calc.valorEstimado)}</td>
            <td className="px-3 py-2 text-right font-data">{calc.valorPraticado != null ? BRL(calc.valorPraticado) : '—'}</td>
            <td className="px-3 py-2 text-right font-data font-semibold" style={{ color: calc.diferenca == null ? 'var(--color-muted-foreground)' : calc.diferenca >= 0 ? '#059669' : '#DC2626' }}>{calc.diferenca == null ? '—' : BRL(calc.diferenca)}</td>
            <td className="px-3 py-2">
                {isAdmin && (
                    <div className="flex items-center justify-center gap-1">
                        <button onClick={() => setEditando(true)} className="p-1.5 rounded-lg hover:bg-blue-100"><Icon name="Pencil" size={13} color="#2563EB" /></button>
                        <button onClick={() => onDelete(destino)} className="p-1.5 rounded-lg hover:bg-red-100"><Icon name="Trash2" size={13} color="#DC2626" /></button>
                    </div>
                )}
            </td>
        </tr>
    );
}

// ─── Painel principal por tipo de veículo (caminhao | carreta) ───────────────
function PainelCustos({ tipoVeiculo, isAdmin }) {
    const { toast, showToast } = useToast();
    const { confirm, ConfirmDialog } = useConfirm();
    const [itens, setItens] = useState([]);
    const [config, setConfig] = useState({ margem_lucro_pct: 20 });
    const [destinos, setDestinos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busca, setBusca] = useState('');
    const [addDestinoMode, setAddDestinoMode] = useState(false);
    const [novoDestino, setNovoDestino] = useState({ destino: '', distancia_km: '', dias_viagem: '2', margem_lucro_pct: '', valor_praticado: '' });
    const [editandoMargem, setEditandoMargem] = useState(false);
    const [margemForm, setMargemForm] = useState(20);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [it, cfg, dest] = await Promise.all([
                fetchCustosItens(tipoVeiculo),
                fetchCustosConfig(tipoVeiculo),
                fetchCustosDestinos(tipoVeiculo),
            ]);
            setItens(it); setConfig(cfg); setDestinos(dest);
            setMargemForm(cfg.margem_lucro_pct);
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
        finally { setLoading(false); }
    }, [tipoVeiculo]); // eslint-disable-line
    useEffect(() => { load(); }, [load]);

    const { custoPorKm, custoPorDia } = useMemo(() => calcularCustosTotais(itens), [itens]);
    const itensKm  = itens.filter(i => i.categoria === 'km');
    const itensDia = itens.filter(i => i.categoria === 'dia');

    const destinosFiltrados = useMemo(() => {
        if (!busca.trim()) return destinos;
        const q = busca.toLowerCase();
        return destinos.filter(d => d.destino?.toLowerCase().includes(q));
    }, [destinos, busca]);

    const salvarMargem = async () => {
        try {
            await updateCustosConfig(tipoVeiculo, Number(margemForm || 0));
            showToast('Margem de lucro atualizada!', 'success');
            setEditandoMargem(false); load();
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };

    const salvarDestino = async (form) => {
        try {
            await updateCustoDestino(form.id, {
                destino: form.destino,
                distancia_km: Number(form.distancia_km || 0),
                dias_viagem: Number(form.dias_viagem || 0),
                margem_lucro_pct: form.margem_lucro_pct === '' || form.margem_lucro_pct == null ? null : Number(form.margem_lucro_pct),
                valor_praticado: form.valor_praticado === '' || form.valor_praticado == null ? null : Number(form.valor_praticado),
            });
            showToast('Destino atualizado!', 'success');
            load();
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };

    const excluirDestino = async (d) => {
        const ok = await confirm({ title: 'Excluir destino?', message: `Remover "${d.destino}" da tabela de custos?`, confirmLabel: 'Excluir', variant: 'danger' });
        if (!ok) return;
        try { await deleteCustoDestino(d.id); showToast('Destino removido.', 'success'); load(); }
        catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };

    const salvarNovoDestino = async () => {
        if (!novoDestino.destino?.trim()) { showToast('Informe o nome do destino.', 'error'); return; }
        try {
            await createCustoDestino({
                tipo_veiculo: tipoVeiculo,
                destino: novoDestino.destino.trim(),
                distancia_km: Number(novoDestino.distancia_km || 0),
                dias_viagem: Number(novoDestino.dias_viagem || 1),
                margem_lucro_pct: novoDestino.margem_lucro_pct ? Number(novoDestino.margem_lucro_pct) : null,
                valor_praticado: novoDestino.valor_praticado ? Number(novoDestino.valor_praticado) : null,
            });
            setNovoDestino({ destino: '', distancia_km: '', dias_viagem: '2', margem_lucro_pct: '', valor_praticado: '' });
            setAddDestinoMode(false);
            showToast('Destino adicionado!', 'success');
            load();
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };

    if (loading) return (
        <div className="flex justify-center py-16">
            <div className="animate-spin h-7 w-7 rounded-full border-4" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
        </div>
    );

    return (
        <div className="flex flex-col gap-6">
            {/* KPIs de custo consolidado */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-white rounded-xl border p-4 shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
                    <p className="text-xs mb-1" style={{ color: 'var(--color-muted-foreground)' }}>Custo por KM Rodado</p>
                    <p className="text-2xl font-bold font-data text-blue-700">{BRL(custoPorKm)}<span className="text-xs font-normal ml-1">/km</span></p>
                </div>
                <div className="bg-white rounded-xl border p-4 shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
                    <p className="text-xs mb-1" style={{ color: 'var(--color-muted-foreground)' }}>Custo por Dia</p>
                    <p className="text-2xl font-bold font-data text-emerald-700">{BRL(custoPorDia)}<span className="text-xs font-normal ml-1">/dia</span></p>
                </div>
                <div className="bg-white rounded-xl border p-4 shadow-sm flex items-center justify-between" style={{ borderColor: 'var(--color-border)' }}>
                    <div>
                        <p className="text-xs mb-1" style={{ color: 'var(--color-muted-foreground)' }}>Margem de Lucro Padrão</p>
                        {editandoMargem ? (
                            <div className="flex items-center gap-1.5">
                                <input type="number" step="0.1" autoFocus value={margemForm} onChange={e => setMargemForm(e.target.value)} className={inputCls} style={{ ...inputStyle, width: 80 }} />
                                <span className="text-sm">%</span>
                            </div>
                        ) : (
                            <p className="text-2xl font-bold font-data text-purple-700">{config.margem_lucro_pct}%</p>
                        )}
                    </div>
                    {isAdmin && (
                        editandoMargem ? (
                            <div className="flex gap-1">
                                <button onClick={salvarMargem} className="p-1.5 rounded-lg hover:bg-green-100"><Icon name="Check" size={14} color="#059669" /></button>
                                <button onClick={() => { setMargemForm(config.margem_lucro_pct); setEditandoMargem(false); }} className="p-1.5 rounded-lg hover:bg-gray-200"><Icon name="X" size={14} color="#6B7280" /></button>
                            </div>
                        ) : (
                            <button onClick={() => setEditandoMargem(true)} className="p-1.5 rounded-lg hover:bg-blue-100"><Icon name="Pencil" size={13} color="#2563EB" /></button>
                        )
                    )}
                </div>
            </div>

            {/* Itens de custo por KM */}
            <div>
                <div className="flex items-center gap-2 mb-2">
                    <Icon name="Gauge" size={15} color="#1D4ED8" />
                    <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Itens de Custo por KM Rodado</h3>
                    <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>(pneus, óleo, etc. — rateados pela vida útil em KM)</span>
                </div>
                <TabelaItens tipoVeiculo={tipoVeiculo} categoria="km" itens={itensKm} isAdmin={isAdmin} cor="#1D4ED8" onChanged={load} />
            </div>

            {/* Itens de custo por Dia */}
            <div>
                <div className="flex items-center gap-2 mb-2">
                    <Icon name="CalendarDays" size={15} color="#059669" />
                    <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Itens de Custo por Dia</h3>
                    <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>(salário, IPVA, seguro, manutenção, depreciação, rastreamento...)</span>
                </div>
                <TabelaItens tipoVeiculo={tipoVeiculo} categoria="dia" itens={itensDia} isAdmin={isAdmin} cor="#059669" onChanged={load} />
            </div>

            {/* Custos por destino */}
            <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                        <Icon name="MapPin" size={15} color="#4F46E5" />
                        <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Estimativa de Frete por Destino</h3>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <Icon name="Search" size={14} color="var(--color-muted-foreground)" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
                            <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar destino..."
                                className="pl-8 pr-3 py-1.5 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-blue-500/20" style={{ borderColor: 'var(--color-border)', width: 200 }} />
                        </div>
                        {isAdmin && <Button size="sm" iconName="Plus" onClick={() => setAddDestinoMode(true)}>Destino</Button>}
                    </div>
                </div>
                <div className="bg-white rounded-xl border shadow-sm overflow-x-auto" style={{ borderColor: 'var(--color-border)' }}>
                    <table className="w-full text-sm min-w-[900px]">
                        <thead className="text-xs border-b" style={{ backgroundColor: 'var(--color-muted)', borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                            <tr>{['Destino', 'Distância', 'Dias', 'Margem', 'Custo Total', 'Valor Estimado', 'Valor Praticado', 'Diferença', ''].map(h =>
                                <th key={h} className="px-3 py-2.5 text-left font-medium whitespace-nowrap">{h}</th>)}</tr>
                        </thead>
                        <tbody>
                            {addDestinoMode && (
                                <tr style={{ backgroundColor: '#EEF2FF' }}>
                                    <td className="px-3 py-2"><input autoFocus value={novoDestino.destino} onChange={e => setNovoDestino(f => ({ ...f, destino: e.target.value }))} className={inputCls} style={inputStyle} placeholder="Nome do destino" /></td>
                                    <td className="px-3 py-2"><input type="number" value={novoDestino.distancia_km} onChange={e => setNovoDestino(f => ({ ...f, distancia_km: e.target.value }))} className={inputCls} style={{ ...inputStyle, textAlign: 'right' }} placeholder="km" /></td>
                                    <td className="px-3 py-2"><input type="number" step="0.5" value={novoDestino.dias_viagem} onChange={e => setNovoDestino(f => ({ ...f, dias_viagem: e.target.value }))} className={inputCls} style={{ ...inputStyle, textAlign: 'right' }} /></td>
                                    <td className="px-3 py-2"><input type="number" step="0.1" value={novoDestino.margem_lucro_pct} onChange={e => setNovoDestino(f => ({ ...f, margem_lucro_pct: e.target.value }))} className={inputCls} style={{ ...inputStyle, textAlign: 'right' }} placeholder={String(config.margem_lucro_pct)} /></td>
                                    <td className="px-3 py-2 text-right text-xs" style={{ color: 'var(--color-muted-foreground)' }}>—</td>
                                    <td className="px-3 py-2 text-right text-xs" style={{ color: 'var(--color-muted-foreground)' }}>—</td>
                                    <td className="px-3 py-2"><input type="number" step="0.01" value={novoDestino.valor_praticado} onChange={e => setNovoDestino(f => ({ ...f, valor_praticado: e.target.value }))} className={inputCls} style={{ ...inputStyle, textAlign: 'right' }} placeholder="0,00" /></td>
                                    <td className="px-3 py-2 text-right text-xs" style={{ color: 'var(--color-muted-foreground)' }}>—</td>
                                    <td className="px-3 py-2">
                                        <div className="flex items-center justify-center gap-1">
                                            <button onClick={salvarNovoDestino} className="p-1.5 rounded-lg hover:bg-green-100"><Icon name="Check" size={14} color="#059669" /></button>
                                            <button onClick={() => setAddDestinoMode(false)} className="p-1.5 rounded-lg hover:bg-red-100"><Icon name="X" size={14} color="#DC2626" /></button>
                                        </div>
                                    </td>
                                </tr>
                            )}
                            {destinosFiltrados.length === 0 && !addDestinoMode ? (
                                <tr><td colSpan={9} className="text-center py-10 text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
                                    {busca ? `Nenhum destino encontrado para "${busca}"` : 'Nenhum destino cadastrado.'}
                                </td></tr>
                            ) : destinosFiltrados.map(d => (
                                <LinhaDestino key={d.id} destino={d} custoPorKm={custoPorKm} custoPorDia={custoPorDia} margemPadrao={config.margem_lucro_pct} isAdmin={isAdmin} onSave={salvarDestino} onDelete={excluirDestino} />
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            <Toast toast={toast} />
            {ConfirmDialog}
        </div>
    );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function TabCustos({ isAdmin }) {
    const [tipoVeiculo, setTipoVeiculo] = useState('carreta');

    return (
        <div className="flex flex-col gap-5">
            <div>
                <h2 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Custos de Rodagem</h2>
                <p className="text-sm mt-0.5" style={{ color: 'var(--color-muted-foreground)' }}>
                    Custo por KM e por dia da frota, e valor estimado de frete por destino — separados por tipo de veículo.
                </p>
            </div>

            <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ backgroundColor: 'var(--color-muted)' }}>
                {[
                    { id: 'carreta',  label: 'Carretas',   icon: 'Truck',  cor: '#4F46E5' },
                    { id: 'caminhao', label: 'Caminhões',  icon: 'Truck',  cor: '#0E7490' },
                ].map(g => (
                    <button key={g.id} onClick={() => setTipoVeiculo(g.id)}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
                        style={tipoVeiculo === g.id
                            ? { backgroundColor: '#fff', color: g.cor, boxShadow: '0 1px 3px rgba(0,0,0,0.10)' }
                            : { color: 'var(--color-muted-foreground)' }}>
                        <Icon name={g.icon} size={14} color={tipoVeiculo === g.id ? g.cor : 'var(--color-muted-foreground)'} />
                        {g.label}
                    </button>
                ))}
            </div>

            {!isAdmin && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs" style={{ backgroundColor: '#FEF3C7', border: '1px solid #FDE68A', color: '#92400E' }}>
                    <Icon name="Info" size={13} color="#D97706" />
                    Visualização apenas. Somente administradores podem editar os valores.
                </div>
            )}

            <PainelCustos key={tipoVeiculo} tipoVeiculo={tipoVeiculo} isAdmin={isAdmin} />
        </div>
    );
}
