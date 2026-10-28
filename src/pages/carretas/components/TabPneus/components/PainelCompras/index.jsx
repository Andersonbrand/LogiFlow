import React, { useState } from 'react';
import { createCompraPneus, deleteCompraPneus, saldoCompra } from 'services/pneusService';
import { DeleteButton, AppIcon as Icon, Button } from 'components';
import { FMT, BRL } from '../../utils/helpers';
import Field from '../Field';
import SelectComOpcaoNova from '../SelectComOpcaoNova';
import { inputCls, inputStyle } from '../../utils/constants';

// ─── Painel: Compras (vínculo com NF de Despesas Adm.) ─────────────────────
export default function PainelCompras({ compras, despesasPneus, catalogo, isAdmin, showToast, confirm, load, handleAddCatalogo, pneus = [] }) {
    const [modal, setModal] = useState(null); // despesa selecionada
    const [saving, setSaving] = useState(false);
    const emptyForm = () => ({ marca: '', modelo: '', medida: '', quantidade: '', valor_total: '', observacoes: '' });
    const [form, setForm] = useState(emptyForm());

    const despesasVinculadas = new Set(compras.map(c => c.despesa_adm_id).filter(Boolean));

    const openVincular = (despesa) => {
        setForm({ ...emptyForm(), valor_total: despesa.valor || '' });
        setModal(despesa);
    };

    const handleSave = async () => {
        if (!form.marca) { showToast('Selecione a marca.', 'error'); return; }
        if (!form.quantidade || Number(form.quantidade) <= 0) { showToast('Informe a quantidade de pneus da compra.', 'error'); return; }
        setSaving(true);
        try {
            await createCompraPneus({
                despesa_adm_id: modal.id,
                marca: form.marca, modelo: form.modelo || null, medida: form.medida || null,
                quantidade: Number(form.quantidade),
                valor_total: form.valor_total !== '' ? Number(form.valor_total) : null,
                observacoes: form.observacoes || null,
            });
            showToast('Compra vinculada à NF!', 'success');
            setModal(null);
            load();
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
        finally { setSaving(false); }
    };

    const handleDelete = async (c) => {
        const ok = await confirm({ title: 'Remover vínculo de compra?', message: 'Pneus já vinculados a essa compra deixarão de referenciar o saldo.', confirmLabel: 'Remover', variant: 'danger' });
        if (!ok) return;
        try { await deleteCompraPneus(c.id); showToast('Vínculo removido.', 'success'); load(); }
        catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h3 className="text-sm font-bold mb-2" style={{ color: 'var(--color-text-primary)' }}>Compras já vinculadas</h3>
                {compras.length === 0 ? (
                    <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>Nenhuma compra de pneus vinculada ainda.</p>
                ) : (
                    <div className="rounded-xl border overflow-hidden shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs" style={{ minWidth: 800 }}>
                                <thead>
                                    <tr style={{ backgroundColor: '#1D4ED8' }}>
                                        {['NF', 'Fornecedor', 'Data', 'Marca / Modelo', 'Medida', 'Qtd.', 'Saldo', 'Valor Total', ''].map(h => (
                                            <th key={h} className="px-3 py-2.5 text-left font-semibold text-white whitespace-nowrap">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {compras.map((c, idx) => (
                                        <tr key={c.id} className="border-t" style={{ borderColor: 'var(--color-border)', backgroundColor: idx % 2 === 0 ? 'white' : '#F9FAFB' }}>
                                            <td className="px-3 py-2.5 font-data whitespace-nowrap">{c.despesa?.nota_fiscal || '—'}</td>
                                            <td className="px-3 py-2.5 max-w-[140px] truncate">{c.despesa?.fornecedor || '—'}</td>
                                            <td className="px-3 py-2.5 whitespace-nowrap">{FMT(c.despesa?.data_despesa)}</td>
                                            <td className="px-3 py-2.5 whitespace-nowrap">{c.marca}{c.modelo ? ` — ${c.modelo}` : ''}</td>
                                            <td className="px-3 py-2.5 font-data">{c.medida || '—'}</td>
                                            <td className="px-3 py-2.5 font-data text-right">{c.quantidade}</td>
                                            <td className="px-3 py-2.5 font-data text-right font-bold" style={{ color: '#059669' }}>{saldoCompra(c, pneus)}</td>
                                            <td className="px-3 py-2.5 font-data text-right whitespace-nowrap">{c.valor_total != null ? BRL(c.valor_total) : '—'}</td>
                                            <td className="px-2 py-2.5">
                                                {isAdmin && <DeleteButton title="Remover vínculo" onClick={() => handleDelete(c)} />}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            <div>
                <h3 className="text-sm font-bold mb-1" style={{ color: 'var(--color-text-primary)' }}>Notas fiscais de "Pneus em Estoque" (Despesas Administrativas)</h3>
                <p className="text-xs mb-3" style={{ color: 'var(--color-muted-foreground)' }}>
                    Vincule cada NF lançada em Despesas Administrativas → categoria <strong>Pneus em Estoque</strong> a uma quantidade de pneus, para controlar o saldo disponível quando forem usados nos veículos.
                </p>
                {despesasPneus.length === 0 ? (
                    <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>Nenhuma despesa administrativa com categoria "Pneus em Estoque" encontrada.</p>
                ) : (
                    <div className="rounded-xl border overflow-hidden shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs" style={{ minWidth: 700 }}>
                                <thead>
                                    <tr style={{ backgroundColor: '#F9FAFB' }}>
                                        {['NF', 'Fornecedor', 'Data', 'Valor', 'Status', ''].map(h => (
                                            <th key={h} className="px-3 py-2.5 text-left font-semibold whitespace-nowrap" style={{ color: 'var(--color-muted-foreground)' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {despesasPneus.map((d, idx) => {
                                        const vinculada = despesasVinculadas.has(d.id);
                                        return (
                                            <tr key={d.id} className="border-t" style={{ borderColor: 'var(--color-border)', backgroundColor: idx % 2 === 0 ? 'white' : '#F9FAFB' }}>
                                                <td className="px-3 py-2.5 font-data whitespace-nowrap">{d.nota_fiscal || '—'}</td>
                                                <td className="px-3 py-2.5 max-w-[160px] truncate">{d.fornecedor || '—'}</td>
                                                <td className="px-3 py-2.5 whitespace-nowrap">{FMT(d.data_despesa)}</td>
                                                <td className="px-3 py-2.5 font-data whitespace-nowrap">{BRL(d.valor)}</td>
                                                <td className="px-3 py-2.5">
                                                    {vinculada ? (
                                                        <span className="px-2 py-1 rounded-lg text-xs font-medium bg-green-100 text-green-700 whitespace-nowrap">Vinculada</span>
                                                    ) : (
                                                        <span className="px-2 py-1 rounded-lg text-xs font-medium bg-amber-100 text-amber-700 whitespace-nowrap">Pendente</span>
                                                    )}
                                                </td>
                                                <td className="px-2 py-2.5">
                                                    {isAdmin && (
                                                        <button onClick={() => openVincular(d)}
                                                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors whitespace-nowrap">
                                                            <Icon name="Link" size={12} /> Vincular
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {modal && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)' }}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh] overflow-hidden">
                        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
                            <h3 className="font-bold text-base" style={{ color: 'var(--color-text-primary)' }}>Vincular Compra — NF {modal.nota_fiscal || '—'}</h3>
                            <button onClick={() => setModal(null)} className="p-1.5 rounded-lg hover:bg-gray-100"><Icon name="X" size={16} color="var(--color-muted-foreground)" /></button>
                        </div>
                        <div className="overflow-y-auto flex-1 p-5 space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <Field label="Marca" required>
                                    <SelectComOpcaoNova value={form.marca} onChange={v => setForm(f => ({ ...f, marca: v }))} opcoes={catalogo.marca} onAddNova={v => { handleAddCatalogo('marca', v); setForm(f => ({ ...f, marca: v })); }} />
                                </Field>
                                <Field label="Modelo">
                                    <SelectComOpcaoNova value={form.modelo} onChange={v => setForm(f => ({ ...f, modelo: v }))} opcoes={catalogo.modelo} onAddNova={v => { handleAddCatalogo('modelo', v); setForm(f => ({ ...f, modelo: v })); }} />
                                </Field>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <Field label="Medida">
                                    <SelectComOpcaoNova value={form.medida} onChange={v => setForm(f => ({ ...f, medida: v }))} opcoes={catalogo.medida} onAddNova={v => { handleAddCatalogo('medida', v); setForm(f => ({ ...f, medida: v })); }} />
                                </Field>
                                <Field label="Quantidade Comprada" required>
                                    <input type="number" value={form.quantidade} onChange={e => setForm(f => ({ ...f, quantidade: e.target.value }))} className={inputCls} style={inputStyle} placeholder="Ex: 6" />
                                </Field>
                            </div>
                            <Field label="Valor Total (opcional)">
                                <input type="number" step="0.01" value={form.valor_total} onChange={e => setForm(f => ({ ...f, valor_total: e.target.value }))} className={inputCls} style={inputStyle} />
                            </Field>
                            <Field label="Observações">
                                <textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} className={inputCls} style={{ ...inputStyle, minHeight: 60 }} />
                            </Field>
                        </div>
                        <div className="flex justify-end gap-3 px-5 py-4 border-t flex-shrink-0" style={{ borderColor: 'var(--color-border)' }}>
                            <button onClick={() => setModal(null)} className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50" style={{ borderColor: 'var(--color-border)' }}>Cancelar</button>
                            <Button onClick={handleSave} size="sm" iconName="Check" disabled={saving}>{saving ? 'Salvando...' : 'Vincular'}</Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
