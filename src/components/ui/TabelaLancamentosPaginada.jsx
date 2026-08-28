import React from 'react';
import Icon from 'components/AppIcon';
import { usePagination, PaginationBar } from 'components/ui/Pagination';
import { useCollapsible, CollapseChevron } from 'components/ui/ExpandableList';

const BRL = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const FMT = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—';

/**
 * TabelaLancamentosPaginada — mesma tabela usada no relatório "Pago / Em
 * Aberto" das telas de despesas. Junta dois recursos pra tabelas grandes:
 *  - Recolhível: mesmo padrão do "carregamentos de terceiros" (carretas) —
 *    clique no cabeçalho pra recolher/expandir o card inteiro.
 *  - Paginada (20 por vez) quando expandida, pra não travar a tela com
 *    centenas de linhas de uma vez.
 * `lista`, `titulo`, `cor`, `bg`, `border`: mesmos parâmetros de antes.
 */
export default function TabelaLancamentosPaginada({ lista, titulo, cor, bg, border, totalGeral, comVeiculo = true }) {
    const pag = usePagination(lista, 20, [lista.length, titulo]);
    const { open, toggle } = useCollapsible(false);
    if (lista.length === 0) return null;
    const colSpanTotal = comVeiculo ? 4 : 3;
    return (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: border }}>
            <button type="button" onClick={toggle}
                className="w-full flex items-center justify-between px-4 py-3 font-bold text-sm hover:opacity-90 transition-opacity"
                style={{ backgroundColor: bg, color: cor }}>
                <span>{titulo} — {lista.length} lançamento(s){!open && ` · ${BRL(totalGeral)}`}</span>
                <CollapseChevron open={open} color={cor} />
            </button>
            {open && (<>
            <table className="w-full text-xs table-fixed">
                <thead style={{ color: 'var(--color-muted-foreground)' }}><tr>
                    <th className={`text-left px-4 py-2 ${comVeiculo ? 'w-[13%]' : 'w-[15%]'}`}>Data/Venc.</th>
                    <th className={`text-left px-4 py-2 ${comVeiculo ? 'w-[38%]' : 'w-[45%]'}`}>Despesa</th>
                    <th className={`text-left px-4 py-2 ${comVeiculo ? 'w-[17%]' : 'w-[20%]'}`}>Tipo</th>
                    {comVeiculo && <th className="text-left px-4 py-2 w-[14%]">Veículo</th>}
                    <th className={`text-right px-4 py-2 ${comVeiculo ? 'w-[18%]' : 'w-[20%]'}`}>Valor</th>
                </tr></thead>
                <tbody>
                    {pag.pageItems.map((it, idx) => (
                        <tr key={idx} className="border-t" style={{ borderColor: border }}>
                            <td className="px-4 py-2 font-data whitespace-nowrap">{FMT(it.vencimento)}</td>
                            <td className="px-4 py-2 overflow-hidden">
                                <div className="flex items-center gap-1 min-w-0">
                                    <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style={{ backgroundColor: titulo === 'Em Aberto' ? '#FEE2E2' : '#D1FAE5', color: cor }}>{it.despesa.categoria}</span>
                                    <span className="truncate" title={it.despesa.fornecedor || it.despesa.descricao || '—'}>{it.despesa.fornecedor || it.despesa.descricao || '—'}</span>
                                </div>
                            </td>
                            <td className="px-4 py-2 truncate">
                                {it.tipo}{it.cartao ? ` (${it.cartao})` : ''}
                                {it.numeroBoleto && <span className="font-data" style={{ color: cor }}> · Nº {it.numeroBoleto}</span>}
                            </td>
                            {comVeiculo && <td className="px-4 py-2 font-data truncate">{it.despesa.veiculo?.placa || '—'}</td>}
                            <td className="px-4 py-2 text-right font-data font-semibold" style={{ color: cor }}>{BRL(it.valor)}</td>
                        </tr>
                    ))}
                </tbody>
                <tfoot><tr className="border-t font-bold" style={{ borderColor: border, backgroundColor: bg }}><td colSpan={colSpanTotal} className="px-4 py-2 text-right" style={{ color: cor }}>Total {titulo}:</td><td className="px-4 py-2 text-right font-data" style={{ color: cor }}>{BRL(totalGeral)}</td></tr></tfoot>
            </table>
            <PaginationBar page={pag.page} setPage={pag.setPage} totalPages={pag.totalPages} totalItems={pag.totalItems} pageSize={pag.pageSize} itemLabel="lançamento" />
            </>)}
        </div>
    );
}
