import React, { useState, useEffect } from 'react';
import { calcularCustoKmItem, calcularCustoDiaItem } from 'services/custosFrotaService';
import { AppIcon as Icon } from 'components';
import { inputCls, inputStyle } from '../../utils/constants';
import { BRL } from '../../utils/helpers';

// ─── Linha editável de item de custo (KM ou Dia) ──────────────────────────────
export default function LinhaItem({ item, categoria, cor, isAdmin, onSave, onDelete }) {
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
                    <div className="flex items-center justify-center gap-2">
                        <button onClick={() => { onSave(form); setEditando(false); }} className="p-2.5 rounded-lg hover:bg-green-100"><Icon name="Check" size={22} color="#059669" /></button>
                        <button onClick={() => { setForm(item); setEditando(false); }} className="p-2.5 rounded-lg hover:bg-gray-200"><Icon name="X" size={22} color="#6B7280" /></button>
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
                        <button onClick={() => setEditando(true)} className="p-1.5 rounded-lg hover:bg-blue-100"><Icon name="Pencil" size={16} color="#2563EB" /></button>
                        <button onClick={() => onDelete(item)} className="p-1.5 rounded-lg hover:bg-red-100"><Icon name="Trash2" size={16} color="#DC2626" /></button>
                    </div>
                )}
            </td>
        </tr>
    );
}
