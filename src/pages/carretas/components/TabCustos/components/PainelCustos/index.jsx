import React, { useState, useCallback, useEffect, useMemo } from 'react';

import { useToast } from 'hooks/useToast';
import { useConfirm, useCollapsible, AppIcon as Icon, CollapseChevron, Button, Toast } from 'components';
import { fetchCustosItens, fetchCustosConfig, fetchCustosDestinos, calcularCustosTotais, updateCustosConfig, updateCustoDestino, deleteCustoDestino, createCustoDestino } from 'services/custosFrotaService';

import { BRL } from '../../utils/helpers';
import { inputCls, inputStyle } from '../../utils/constants';
import TabelaItens from '../TabelaItens';
import LinhaDestino from '../LinhaDestino';

// ─── Painel principal por tipo de veículo (caminhao | carreta) ───────────────
export default function PainelCustos({ tipoVeiculo, isAdmin }) {
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
    const { open: destinosOpen, toggle: toggleDestinos } = useCollapsible(false);

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
                            <div className="flex gap-2">
                                <button onClick={salvarMargem} className="p-2.5 rounded-lg hover:bg-green-100"><Icon name="Check" size={22} color="#059669" /></button>
                                <button onClick={() => { setMargemForm(config.margem_lucro_pct); setEditandoMargem(false); }} className="p-2.5 rounded-lg hover:bg-gray-200"><Icon name="X" size={22} color="#6B7280" /></button>
                            </div>
                        ) : (
                            <button onClick={() => setEditandoMargem(true)} className="p-1.5 rounded-lg hover:bg-blue-100"><Icon name="Pencil" size={16} color="#2563EB" /></button>
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
                    <button type="button" onClick={toggleDestinos} className="flex items-center gap-2 hover:opacity-70 transition-opacity">
                        <Icon name="MapPin" size={15} color="#4F46E5" />
                        <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Estimativa de Frete por Destino</h3>
                        <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>({destinosFiltrados.length})</span>
                        <CollapseChevron open={destinosOpen} color="var(--color-muted-foreground)" />
                    </button>
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <Icon name="Search" size={14} color="var(--color-muted-foreground)" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
                            <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar destino..."
                                className="pl-8 pr-3 py-1.5 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-blue-500/20" style={{ borderColor: 'var(--color-border)', width: 200 }} />
                        </div>
                        {isAdmin && <Button size="sm" iconName="Plus" onClick={() => setAddDestinoMode(true)}>Destino</Button>}
                    </div>
                </div>
                {destinosOpen && (
                <div className="bg-white rounded-xl border shadow-sm overflow-x-auto" style={{ borderColor: 'var(--color-border)' }}>
                    <table className="w-full text-sm min-w-[900px]">
                        <thead className="text-xs border-b" style={{ backgroundColor: 'var(--color-muted)', borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                            <tr>{['Destino', 'Distância', 'Dias', 'Margem', 'Custo Total', 'Valor Estimado', 'Valor Praticado', 'Diferença', ''].map((h, i, arr) => (
                                <th
                                    key={h}
                                    className={`px-3 py-2.5 font-medium whitespace-nowrap ${
                                        i === 0 ? 'text-left' : i === arr.length - 1 ? 'text-center' : 'text-right'
                                    }`}
                                >
                                    {h}
                                </th>
                            ))}</tr>
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
                                        <div className="flex items-center justify-center gap-2">
                                            <button onClick={salvarNovoDestino} className="p-2.5 rounded-lg hover:bg-green-100"><Icon name="Check" size={22} color="#059669" /></button>
                                            <button onClick={() => setAddDestinoMode(false)} className="p-2.5 rounded-lg hover:bg-red-100"><Icon name="X" size={22} color="#DC2626" /></button>
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
                )}
            </div>
            <Toast toast={toast} />
            {ConfirmDialog}
        </div>
    );
}
