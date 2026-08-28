import React from 'react';
import { useCollapsible, CollapseChevron } from 'components/ui/ExpandableList';

const BRL = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const FMT = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—';

/**
 * CardMesParcelas — card de um mês na aba "Parcelas Futuras", recolhível
 * (mesmo padrão de "carregamentos de terceiros" em Carretas: clica no
 * cabeçalho do mês e a tabela dele recolhe/expande).
 */
export default function CardMesParcelas({ mes, comVeiculo = true }) {
    const { open, toggle } = useCollapsible(false);
    const colSpanTotal = comVeiculo ? 3 : 2;
    return (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: '#FED7AA' }}>
            <button type="button" onClick={toggle}
                className="w-full flex items-center justify-between px-4 py-3 hover:opacity-90 transition-opacity" style={{ backgroundColor: '#FFF7ED' }}>
                <p className="text-sm font-bold" style={{ color: '#9A3412' }}>
                    {new Date(mes.mes + '-01T00:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                    <span className="font-normal ml-2 text-xs" style={{ color: '#C2410C' }}>({mes.itens.length} parcela{mes.itens.length > 1 ? 's' : ''})</span>
                </p>
                <div className="flex items-center gap-2">
                    <p className="text-sm font-bold font-data text-orange-600">{BRL(mes.total)}</p>
                    <CollapseChevron open={open} color="#9A3412" />
                </div>
            </button>
            {open && (
                <table className="w-full text-xs table-fixed">
                    <thead style={{ color: 'var(--color-muted-foreground)', backgroundColor: '#FFFBF5' }}>
                        <tr>
                            <th className={`text-left px-4 py-2 ${comVeiculo ? 'w-[12%]' : 'w-[15%]'}`}>Vencimento</th>
                            <th className={`text-left px-4 py-2 ${comVeiculo ? 'w-[38%]' : 'w-[45%]'}`}>Despesa</th>
                            <th className={`text-left px-4 py-2 ${comVeiculo ? 'w-[16%]' : 'w-[20%]'}`}>Tipo</th>
                            {comVeiculo && <th className="text-left px-4 py-2 w-[16%]">Veículo</th>}
                            <th className={`text-right px-4 py-2 ${comVeiculo ? 'w-[18%]' : 'w-[20%]'}`}>Valor</th>
                        </tr>
                    </thead>
                    <tbody>
                        {mes.itens.map((it, idx) => (
                            <tr key={idx} className="border-t" style={{ borderColor: '#FEF3C7' }}>
                                <td className="px-4 py-2 font-data whitespace-nowrap">{FMT(it.vencimento)}</td>
                                <td className="px-4 py-2 overflow-hidden">
                                    <div className="flex items-center gap-1 min-w-0">
                                        <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 font-medium">{it.despesa.categoria}</span>
                                        <span className="truncate" title={it.despesa.fornecedor || it.despesa.descricao || '—'}>{it.despesa.fornecedor || it.despesa.descricao || '—'}</span>
                                    </div>
                                </td>
                                <td className="px-4 py-2 truncate">
                                    {it.tipo}{it.cartao ? ` (${it.cartao})` : ''}
                                    {it.numeroBoleto && <span className="text-orange-500 font-data"> · Nº {it.numeroBoleto}</span>}
                                </td>
                                {comVeiculo && <td className="px-4 py-2 font-data truncate">{it.despesa.veiculo?.placa || '—'}</td>}
                                <td className="px-4 py-2 text-right font-data font-semibold text-orange-600">{BRL(it.valor)}</td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot><tr className="border-t font-semibold" style={{ borderColor: '#FED7AA', backgroundColor: '#FFF7ED' }}><td colSpan={colSpanTotal} className="px-4 py-2 text-right" style={{ color: '#9A3412' }}>Total do mês:</td><td className="px-4 py-2 text-right font-data text-orange-600">{BRL(mes.total)}</td></tr></tfoot>
                </table>
            )}
        </div>
    );
}
