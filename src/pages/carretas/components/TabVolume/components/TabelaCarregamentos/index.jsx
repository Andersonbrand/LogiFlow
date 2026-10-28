import React, { useState } from 'react';
import { usePagination, Button, AppIcon as Icon, ActionButtonsGroup, EditButton, DeleteButton, PaginationBar } from 'components';
import SearchInput from '../SearchInput';
import { parseTipo, FMT, fmtNum, BRL, calcCaptacaoDistribuicao } from '../../utils/helpers';
import TipoBadge from '../TipoBadge';

// ─── Sub-componente: Tabela completa ──────────────────────────────────────────
export default function TabelaCarregamentos({ carregamentos, isAdmin, onEdit, onDelete, onNovo, captacaoPorSaco = 0 }) {
    const [pesquisa, setPesquisa] = useState('');
    const carregamentosFiltrados = carregamentos.filter(r => {
        if (!pesquisa.trim()) return true;
        const q = pesquisa.toLowerCase();
        return (
            (r.numero_pedido || '').toLowerCase().includes(q) ||
            (r.numero_nota_fiscal || '').toLowerCase().includes(q) ||
            (r.motorista?.name || '').toLowerCase().includes(q) ||
            (r.destino || '').toLowerCase().includes(q) ||
            (r.veiculo?.placa || '').toLowerCase().includes(q)
        );
    });
    const pag = usePagination(carregamentosFiltrados, 15, [carregamentosFiltrados.length, pesquisa]);

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <SearchInput value={pesquisa} onChange={setPesquisa}
                    placeholder="Pedido, NF, motorista, destino, placa..." />
                {isAdmin && <Button onClick={onNovo} iconName="Plus" size="sm">Novo Carregamento</Button>}
            </div>
            {carregamentosFiltrados.length === 0 ? (
                <div className="bg-white rounded-xl border p-12 flex flex-col items-center justify-center gap-2" style={{ borderColor: 'var(--color-border)' }}>
                    <Icon name="Package" size={36} color="var(--color-muted-foreground)" />
                    <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>{pesquisa ? `Nenhum resultado para "${pesquisa}"` : 'Nenhum carregamento encontrado para o período'}</p>
                </div>
            ) : (
            <div className="bg-white rounded-xl border shadow-sm overflow-x-auto" style={{ borderColor: 'var(--color-border)' }}>
            <table className="w-full text-sm min-w-[800px]">
                <thead className="text-xs border-b" style={{ background: 'var(--color-muted)', borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                    <tr>
                        {['Data', 'Tipo', 'Fornecedor/Origem', 'Placa', 'Motorista', 'Pedido', 'NF', 'Destino', 'Qtd', 'Frete', ''].map(h => (
                            <th key={h} className="px-3 py-3 text-left font-medium whitespace-nowrap">{h}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {pag.pageItems.map((r, i) => {
                        const { tipo, nome } = parseTipo(r);
                        return (
                            <tr key={r.id} className="border-t hover:bg-gray-50 transition-colors" style={{ borderColor: 'var(--color-border)', background: i % 2 === 0 ? '#fff' : '#F8FAFC' }}>
                                <td className="px-3 py-2.5 whitespace-nowrap">{FMT(r.data_carregamento)}</td>
                                <td className="px-3 py-2.5"><TipoBadge tipo={tipo} /></td>
                                <td className="px-3 py-2.5 max-w-[140px] truncate text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                                    {tipo === 'ESTOQUE' ? (r.tipo_cimento || '—') : (nome || '—')}
                                </td>
                                <td className="px-3 py-2.5 font-mono text-xs">{r.veiculo?.placa || r.placa_terceiro || r.veiculo_id || '—'}</td>
                                <td className="px-3 py-2.5 text-xs">{r.motorista?.name || r.motorista_id || '—'}</td>
                                <td className="px-3 py-2.5 font-mono text-xs">{r.numero_pedido || '—'}</td>
                                <td className="px-3 py-2.5 font-mono text-xs">{r.numero_nota_fiscal || '—'}</td>
                                <td className="px-3 py-2.5 text-xs max-w-[120px] truncate">{r.destino || '—'}</td>
                                <td className="px-3 py-2.5 font-bold font-mono whitespace-nowrap">{tipo === 'ESTOQUE' && !r.quantidade ? '—' : fmtNum(r.quantidade)}</td>
                                <td className="px-3 py-2.5 font-mono font-semibold whitespace-nowrap align-top">
                                    <div style={{ color: '#7C3AED' }}>{BRL(r.valor_frete_calculado)}</div>
                                    {captacaoPorSaco > 0 && (() => {
                                        const cd = calcCaptacaoDistribuicao(r, captacaoPorSaco);
                                        if (!cd) return null;
                                        return (
                                            <div className="mt-1 text-[10px] font-normal leading-tight" style={{ minWidth: 130 }}>
                                                <div className="flex items-center justify-between gap-2" style={{ color: '#6D28D9' }}>
                                                    <span>↳ Captação</span><span className="font-semibold">{BRL(cd.captacao)}</span>
                                                </div>
                                                {!cd.isEstoque && (
                                                    <div className="flex items-center justify-between gap-2" style={{ color: '#059669' }}>
                                                        <span>↳ Distribuição</span>
                                                        <span className="font-semibold">{BRL(cd.distribuicao)} <span className="opacity-70">({cd.pctDistribuicao.toFixed(0)}%)</span></span>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })()}
                                </td>
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
            <PaginationBar page={pag.page} setPage={pag.setPage} totalPages={pag.totalPages}
                totalItems={pag.totalItems} pageSize={pag.pageSize} itemLabel="carregamento" itemLabelPlural="carregamentos" />
        </div>
            )}
        </div>
    );
}
