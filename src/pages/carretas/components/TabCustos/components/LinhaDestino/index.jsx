import React, { useState, useEffect } from 'react';
import { calcularCustoDestino } from 'services/custosFrotaService';
import { AppIcon as Icon } from 'components';
import { inputCls, inputStyle } from '../../utils/constants';
import { BRL } from '../../utils/helpers';

// ─── Linha editável de destino ────────────────────────────────────────────────
export default function LinhaDestino({ destino, custoPorKm, custoPorDia, margemPadrao, isAdmin, onSave, onDelete }) {
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
                    <div className="flex items-center justify-center gap-2">
                        <button onClick={() => { onSave(form); setEditando(false); }} className="p-2.5 rounded-lg hover:bg-green-100"><Icon name="Check" size={22} color="#059669" /></button>
                        <button onClick={() => { setForm(destino); setEditando(false); }} className="p-2.5 rounded-lg hover:bg-gray-200"><Icon name="X" size={22} color="#6B7280" /></button>
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
                        <button onClick={() => setEditando(true)} className="p-1.5 rounded-lg hover:bg-blue-100"><Icon name="Pencil" size={16} color="#2563EB" /></button>
                        <button onClick={() => onDelete(destino)} className="p-1.5 rounded-lg hover:bg-red-100"><Icon name="Trash2" size={16} color="#DC2626" /></button>
                    </div>
                )}
            </td>
        </tr>
    );
}
