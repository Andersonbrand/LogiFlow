import React, { useState } from 'react';

import { useToast } from 'hooks/useToast';
import { useConfirm, AppIcon as Icon, Toast } from 'components';
import { createCustoItem, updateCustoItem, deleteCustoItem } from 'services/custosFrotaService';

import LinhaItem from '../LinhaItem';
import { inputCls, inputStyle } from '../../utils/constants';

// ─── Tabela de itens de custo (por KM ou por Dia) ─────────────────────────────
export default function TabelaItens({ tipoVeiculo, categoria, itens, isAdmin, cor, onChanged }) {
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
                        ).map((h, i, arr) => (
                            <th
                                key={h}
                                className={`px-3 py-2.5 font-medium whitespace-nowrap ${
                                    i === 0 ? 'text-left' : i === arr.length - 1 ? 'text-center' : 'text-right'
                                }`}
                            >
                                {h}
                            </th>
                        ))}
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
                                <div className="flex items-center justify-center gap-2">
                                    <button onClick={salvarNovo} className="p-2.5 rounded-lg hover:bg-green-100"><Icon name="Check" size={22} color="#059669" /></button>
                                    <button onClick={() => setAddMode(false)} className="p-2.5 rounded-lg hover:bg-red-100"><Icon name="X" size={22} color="#DC2626" /></button>
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
