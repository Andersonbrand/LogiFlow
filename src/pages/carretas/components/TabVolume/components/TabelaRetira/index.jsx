import React, { useState } from 'react';

import * as XLSX from 'xlsx';

import { usePagination, AppIcon as Icon, Button, ActionButtonsGroup, EditButton, DeleteButton, PaginationBar } from 'components';

import { parseTipo, FMT } from '../../utils/helpers';
import { TIPOS } from '../../utils/constants';
import SearchInput from '../SearchInput';

// ─── Sub-componente: Retira de Clientes na Fábrica ───────────────────────────
export default function TabelaRetira({ carregamentos, isAdmin, onNovo, onEdit, onDelete, veiculos, motoristas, mes }) {
    const [buscaRetira, setBuscaRetira] = useState('');

    const itensRetira = buscaRetira
        ? carregamentos.filter(r => {
            const q = buscaRetira.toLowerCase();
            const { nome } = parseTipo(r);
            return (
                (r.numero_nota_fiscal || '').toLowerCase().includes(q) ||
                (r.numero_pedido || '').toLowerCase().includes(q) ||
                (r.nome_cliente || '').toLowerCase().includes(q) ||
                (r.destino || '').toLowerCase().includes(q) ||
                (r.veiculo?.placa || '').toLowerCase().includes(q) ||
                (nome || r.empresa_origem || '').toLowerCase().includes(q)
            );
        })
        : carregamentos;

    const pagRetira = usePagination(itensRetira, 15, [itensRetira.length, buscaRetira]);

    const totalSacos = itensRetira.reduce((s, r) => s + (Number(r.quantidade) || 0), 0);

    // Exporta o que está na tela (respeita a busca). Inclui a coluna "Tipo" (FOB/CIF ·
    // Guanambi/Barreiras) porque é ela que decide em qual card do Dashboard o volume entra —
    // essencial pra conferir com a planilha de carregamento diário.
    const exportarRetira = () => {
        if (!itensRetira.length) return;
        const rows = itensRetira.map(r => {
            const { tipo, nome } = parseTipo(r);
            return {
                'Data': FMT(r.data_carregamento),
                'Tipo': TIPOS[tipo]?.label || '—',
                'Cliente/Origem': nome || '—',
                'Cliente': r.nome_cliente || '—',
                'Placa': r.veiculo?.placa || r.placa_terceiro || '—',
                'Motorista': r.motorista?.name || '—',
                'Pedido': r.numero_pedido || '—',
                'NF': r.numero_nota_fiscal || '—',
                'Destino': r.destino || '—',
                'Quantidade (sacos)': Number(r.quantidade) || 0,
            };
        });
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Retira de Clientes');
        const porTipo = {};
        itensRetira.forEach(r => {
            const { tipo } = parseTipo(r);
            const k = TIPOS[tipo]?.label || 'Sem tipo';
            porTipo[k] = (porTipo[k] || 0) + (Number(r.quantidade) || 0);
        });
        const sumRows = Object.entries(porTipo).map(([k, v]) => ({ 'Tipo': k, 'Volume (sacos)': v }));
        sumRows.push({ 'Tipo': 'TOTAL', 'Volume (sacos)': totalSacos });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sumRows), 'Resumo por Tipo');
        XLSX.writeFile(wb, `retira_clientes_${mes || new Date().toISOString().slice(0, 7)}.xlsx`);
    };

    return (
        <div className="flex flex-col gap-4">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="p-3 rounded-xl text-xs font-medium flex items-center gap-2" style={{ backgroundColor: '#F0FDF4', color: '#065F46', border: '1px solid #BBF7D0' }}>
                    <span>🏭</span>
                    <span>Retira de clientes na fábrica — apenas volume, <strong>sem frete e sem bonificações</strong>.</span>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={exportarRetira} disabled={!itensRetira.length}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{ borderColor: 'var(--color-border)' }}>
                        <Icon name="FileDown" size={14} /> Exportar
                    </button>
                    {isAdmin && (
                        <Button onClick={onNovo} iconName="Plus" size="sm">Nova Retira</Button>
                    )}
                </div>
            </div>
            <SearchInput value={buscaRetira} onChange={setBuscaRetira}
                placeholder="Buscar por NF, pedido, cliente, placa..." />

            {/* Cards de resumo */}
            <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl p-4 border" style={{ backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }}>
                    <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#065F46' }}>Total Sacos (mês)</p>
                    <p className="text-2xl font-black" style={{ color: '#059669' }}>{totalSacos.toLocaleString('pt-BR')}</p>
                    <p className="text-xs mt-0.5" style={{ color: '#065F46' }}>{carregamentos.length} registros</p>
                </div>
                <div className="rounded-xl p-4 border" style={{ backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }}>
                    <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#065F46' }}>Média por retira</p>
                    <p className="text-2xl font-black" style={{ color: '#059669' }}>
                        {carregamentos.length > 0 ? Math.round(totalSacos / carregamentos.length).toLocaleString('pt-BR') : '—'}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: '#065F46' }}>sacos por operação</p>
                </div>
            </div>

            {carregamentos.length === 0 ? (
                <div className="bg-white rounded-xl border p-12 flex flex-col items-center justify-center gap-2" style={{ borderColor: 'var(--color-border)' }}>
                    <Icon name="ShoppingBag" size={36} color="var(--color-muted-foreground)" />
                    <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Nenhuma retira registrada no período</p>
                    {isAdmin && <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>Clique em "Nova Retira" para adicionar</p>}
                </div>
            ) : (
                <div className="bg-white rounded-xl border shadow-sm overflow-x-auto" style={{ borderColor: '#BBF7D0' }}>
                    <table className="w-full text-sm min-w-[750px]">
                        <thead className="text-xs border-b" style={{ background: '#F0FDF4', borderColor: '#BBF7D0', color: '#065F46' }}>
                            <tr>
                                {['Data', 'Cliente/Origem', 'Cliente', 'Placa', 'Pedido Venda', 'NF', 'Nº Pedido', 'Qtd (sacos)', ''].map(h => (
                                    <th key={h} className="px-3 py-3 text-left font-medium whitespace-nowrap">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {pagRetira.pageItems.map((r, i) => {
                                const { nome } = parseTipo(r);
                                return (
                                    <tr key={r.id} className="border-t hover:bg-green-50 transition-colors"
                                        style={{ borderColor: '#BBF7D0', background: i % 2 === 0 ? '#fff' : '#F0FDF4' }}>
                                        <td className="px-3 py-2.5 whitespace-nowrap">{FMT(r.data_carregamento)}</td>
                                        <td className="px-3 py-2.5 text-xs font-medium max-w-[140px] truncate">{nome || r.empresa_origem || '—'}</td>
                                        <td className="px-3 py-2.5 text-xs">{r.nome_cliente || '—'}</td>
                                        <td className="px-3 py-2.5 font-mono text-xs">{r.veiculo?.placa || '—'}</td>
                                        <td className="px-3 py-2.5 font-mono text-xs font-semibold" style={{ color: '#059669' }}>{r.pedido_venda || '—'}</td>
                                        <td className="px-3 py-2.5 font-mono text-xs">{r.numero_nota_fiscal || '—'}</td>
                                        <td className="px-3 py-2.5 font-mono text-xs">{r.numero_pedido || '—'}</td>
                                        <td className="px-3 py-2.5 font-bold font-mono whitespace-nowrap" style={{ color: '#059669' }}>{(Number(r.quantidade) || 0).toLocaleString('pt-BR')}</td>
                                        {isAdmin && (
                                            <td className="px-3 py-2.5">
                                                <ActionButtonsGroup>
                                                    <EditButton onClick={() => onEdit(r)} />
                                                    <DeleteButton onClick={() => onDelete(r.id)} />
                                                </ActionButtonsGroup>
                                            </td>
                                        )}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    <PaginationBar page={pagRetira.page} setPage={pagRetira.setPage} totalPages={pagRetira.totalPages}
                        totalItems={pagRetira.totalItems} pageSize={pagRetira.pageSize} itemLabel="retira" itemLabelPlural="retiradas" />
                </div>
            )}
        </div>
    );
}
