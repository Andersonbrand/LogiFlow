import React, { useState, useEffect } from 'react';

import * as XLSX from 'xlsx';

import { usePagination, AppIcon as Icon, Button, ActionButtonsGroup, ACTION_ICON_SIZE, EditButton, DeleteButton, PaginationBar } from 'components';
import { useToast } from 'hooks/useToast';

import { parseTipo, FMT, BRL } from '../../utils/helpers';
import SearchInput from '../SearchInput';
import TipoBadge from '../TipoBadge';

// ─── Sub-componente: Tabela Terceiros ─────────────────────────────────────────
export default function TabelaTerceiros({ carregamentos, isAdmin, onNovo, onEdit, onDelete, onTogglePago, onTogglePagoEmMassa, fretosTerceiros = [], motoristas = [], mes }) {
    const [filtroMotoristaTer, setFiltroMotoristaTer] = useState(() => sessionStorage.getItem('lf_ter_filtroMotorista') || '');
    const [filtroPago, setFiltroPago] = useState(() => sessionStorage.getItem('lf_ter_filtroPago') || 'todos'); // 'todos' | 'pendentes' | 'pagos'
    // Persiste os filtros no navegador — sobrevivem a um F5/reload da página,
    // não só a recarregamentos internos dos dados.
    useEffect(() => { sessionStorage.setItem('lf_ter_filtroMotorista', filtroMotoristaTer); }, [filtroMotoristaTer]);
    useEffect(() => { sessionStorage.setItem('lf_ter_filtroPago', filtroPago); }, [filtroPago]);

    // Calcula frete de cada carregamento: usa valor_frete_calculado se existir,
    // senão busca na tabela de fretes pelo destino
    const calcFrete = (r) => {
        if (r.valor_frete_calculado && Number(r.valor_frete_calculado) > 0) return Number(r.valor_frete_calculado);
        if (!r.destino) return 0;
        const entrada = fretosTerceiros.find(f => f.cidade.toLowerCase() === (r.destino || '').toLowerCase());
        if (entrada) return Number(entrada.frete_por_saco) * (Number(r.quantidade) || 0);
        return 0;
    };

    const totalSacos = carregamentos.reduce((s, r) => s + (Number(r.quantidade) || 0), 0);
    const totalFrete = carregamentos.reduce((s, r) => s + calcFrete(r), 0);
    const totalFretePago = carregamentos.reduce((s, r) => s + (r.frete_pago ? calcFrete(r) : 0), 0);
    const totalFretePendente = totalFrete - totalFretePago;

    // Agrupamento por motorista para o card de resumo
    const porMotorista = (() => {
        const map = {};
        carregamentos.forEach(r => {
            const key = r.motorista_id || '__sem_motorista__';
            const nome = r.motorista?.name || '—';
            const placa = r.veiculo?.placa || '—';
            if (!map[key]) map[key] = { nome, placa, sacos: 0, frete: 0, viagens: 0 };
            map[key].sacos  += Number(r.quantidade) || 0;
            map[key].frete  += calcFrete(r);
            map[key].viagens += 1;
        });
        return Object.values(map).sort((a, b) => b.frete - a.frete);
    })();

    const [buscaTer, setBuscaTer] = useState('');

    const carrBase = (filtroMotoristaTer
        ? carregamentos.filter(r => r.motorista_id === filtroMotoristaTer)
        : carregamentos
    ).filter(r => filtroPago === 'todos' ? true : filtroPago === 'pagos' ? !!r.frete_pago : !r.frete_pago);

    const carr = buscaTer
        ? carrBase.filter(r => {
            const q = buscaTer.toLowerCase();
            const { nome } = parseTipo(r);
            return (
                (r.numero_nota_fiscal || '').toLowerCase().includes(q) ||
                (r.numero_pedido || '').toLowerCase().includes(q) ||
                (r.motorista?.name || '').toLowerCase().includes(q) ||
                (r.destino || '').toLowerCase().includes(q) ||
                (r.veiculo?.placa || '').toLowerCase().includes(q) ||
                (nome || '').toLowerCase().includes(q)
            );
        })
        : carrBase;

    const pag = usePagination(carr, 15, [carr.length, filtroMotoristaTer, filtroPago, buscaTer]);
    const totalFreteFiltrado = carr.reduce((s, r) => s + calcFrete(r), 0);
    const [resumoAberto, setResumoAberto] = useState(false);
    const { showToast: showToastTer } = useToast();

    // ── Seleção múltipla para baixa em massa ────────────────────────────────
    const [selecionados, setSelecionados] = useState(new Set());
    // Limpa a seleção quando o filtro muda — evita dar baixa sem querer num
    // registro que já saiu da vista por causa de um filtro diferente.
    useEffect(() => { setSelecionados(new Set()); }, [filtroMotoristaTer, filtroPago, buscaTer, mes]);
    const toggleSelecionado = (id) => setSelecionados(prev => {
        const next = new Set(prev);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
    });
    const pendentesNaPagina = pag.pageItems.filter(r => !r.frete_pago);
    const todosPendentesPaginaSelecionados = pendentesNaPagina.length > 0 && pendentesNaPagina.every(r => selecionados.has(r.id));
    const toggleSelecionarTodosPagina = () => setSelecionados(prev => {
        const next = new Set(prev);
        if (todosPendentesPaginaSelecionados) pendentesNaPagina.forEach(r => next.delete(r.id));
        else pendentesNaPagina.forEach(r => next.add(r.id));
        return next;
    });
    const idsSelecionadosPendentes = [...selecionados].filter(id => carr.some(r => r.id === id && !r.frete_pago));
    const idsSelecionadosPagos = [...selecionados].filter(id => carr.some(r => r.id === id && r.frete_pago));

    // ── Exportar (Terceiros) ─────────────────────────────────────────────────
    const exportarTerceiros = () => {
        if (!carr.length) { showToastTer('Nenhum dado para exportar.', 'error'); return; }
        const rows = carr.map(r => {
            const { nome } = parseTipo(r);
            return {
                'Data': FMT(r.data_carregamento),
                'Motorista': r.motorista?.name || nome || '—',
                'Placa': r.veiculo?.placa || r.placa_terceiro || '—',
                'Empresa': r.empresa || '—',
                'Destino': r.destino || '—',
                'Pedido': r.numero_pedido || '—',
                'NF': r.numero_nota_fiscal || '—',
                'Quantidade (sacos)': Number(r.quantidade) || 0,
                'Frete (R$)': calcFrete(r),
                'Pagamento': r.frete_pago ? 'Pago' : 'Pendente',
            };
        });
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Terceiros');
        const sumRows = porMotorista.map(m => ({
            'Motorista': m.nome, 'Viagens': m.viagens, 'Total (sacos)': m.sacos, 'Frete Total (R$)': m.frete,
        }));
        sumRows.push({ 'Motorista': 'TOTAL', 'Viagens': carregamentos.length, 'Total (sacos)': totalSacos, 'Frete Total (R$)': totalFrete });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sumRows), 'Resumo por Motorista');
        XLSX.writeFile(wb, `terceiros_carretas_${mes || new Date().toISOString().slice(0, 7)}.xlsx`);
    };

    return (
        <div className="flex flex-col gap-4">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="p-3 rounded-xl text-xs font-medium flex items-center gap-2" style={{ backgroundColor: '#FEF3C7', color: '#92400E', border: '1px solid #FDE68A' }}>
                    <span>🚛</span>
                    <span>Carregamentos de <strong>veículos terceirizados</strong> — sem bonificações ou vínculo com a frota.</span>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={exportarTerceiros} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium hover:bg-gray-50 transition-colors" style={{ borderColor: 'var(--color-border)' }}>
                        <Icon name="FileDown" size={14} /> Exportar
                    </button>
                    {isAdmin && (
                        <Button onClick={onNovo} iconName="Plus" size="sm">Novo Carregamento Terceiro</Button>
                    )}
                </div>
            </div>
            <SearchInput value={buscaTer} onChange={setBuscaTer}
                placeholder="Buscar por NF, pedido, motorista, destino, placa..." />

            {/* Cards de resumo do mês */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="rounded-xl p-4 border" style={{ backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }}>
                    <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#B45309' }}>Total Sacos (mês)</p>
                    <p className="text-2xl font-black" style={{ color: '#D97706' }}>{totalSacos.toLocaleString('pt-BR')}</p>
                    <p className="text-xs mt-0.5" style={{ color: '#B45309' }}>{carregamentos.length} registros</p>
                </div>
                <div className="rounded-xl p-4 border" style={{ backgroundColor: '#FEF2F2', borderColor: '#FECACA' }}>
                    <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#B91C1C' }}>Frete Pendente</p>
                    <p className="text-2xl font-black" style={{ color: '#DC2626' }}>{BRL(totalFretePendente)}</p>
                    <p className="text-xs mt-0.5" style={{ color: '#B91C1C' }}>ainda não pago</p>
                </div>
                <div className="rounded-xl p-4 border" style={{ backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }}>
                    <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#065F46' }}>Frete Pago</p>
                    <p className="text-2xl font-black" style={{ color: '#059669' }}>{BRL(totalFretePago)}</p>
                    <p className="text-xs mt-0.5" style={{ color: '#065F46' }}>já quitado</p>
                </div>
                <div className="rounded-xl p-4 border" style={{ backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }}>
                    <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#1E3A5F' }}>Motoristas ativos (mês)</p>
                    <p className="text-2xl font-black" style={{ color: '#1D4ED8' }}>{porMotorista.length}</p>
                    <p className="text-xs mt-0.5" style={{ color: '#1E3A5F' }}>motoristas com carregamentos</p>
                </div>
            </div>

            {/* Filtro por status de pagamento + faixa de valor */}
            <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Pagamento:</span>
                {[
                    { v: 'todos', label: 'Todos' },
                    { v: 'pendentes', label: 'Pendentes' },
                    { v: 'pagos', label: 'Pagos' },
                ].map(op => (
                    <button key={op.v} onClick={() => setFiltroPago(op.v)}
                        className="px-3 py-1 rounded-full text-xs font-medium border transition-colors"
                        style={filtroPago === op.v
                            ? { backgroundColor: '#D97706', color: '#fff', borderColor: '#D97706' }
                            : { borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                        {op.label}
                    </button>
                ))}
                {isAdmin && pendentesNaPagina.length > 0 && (
                    <button onClick={toggleSelecionarTodosPagina}
                        className="ml-auto flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors hover:bg-amber-50"
                        style={{ borderColor: '#FDE68A', color: '#92400E' }}>
                        <Icon name={todosPendentesPaginaSelecionados ? 'CheckSquare' : 'Square'} size={13} color="#92400E" />
                        {todosPendentesPaginaSelecionados ? 'Desmarcar todos' : 'Selecionar todos (pendentes desta página)'}
                    </button>
                )}
            </div>

            {/* Card de resumo por motorista */}
            {porMotorista.length > 0 && (
                <div className="bg-white rounded-xl border shadow-sm overflow-hidden" style={{ borderColor: '#FDE68A' }}>
                    <div className="px-4 py-3 border-b flex items-center justify-between cursor-pointer select-none" style={{ borderColor: '#FDE68A', backgroundColor: '#FFFBEB' }}
                        onClick={() => setResumoAberto(v => !v)}>
                        <p className="text-sm font-semibold" style={{ color: '#92400E' }}>💰 Resumo por Motorista — {mes ? new Date(mes + '-01T00:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) : 'mês atual'}</p>
                        <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-xs font-semibold" style={{ color: '#92400E' }}>{BRL(totalFrete)}</span>
                            <button title={resumoAberto ? 'Recolher' : 'Expandir'}
                                className="w-6 h-6 rounded-md flex items-center justify-center hover:bg-amber-100 transition-colors flex-shrink-0">
                                <Icon name={resumoAberto ? 'ChevronUp' : 'ChevronDown'} size={16} color="#92400E" />
                            </button>
                        </div>
                    </div>
                    {resumoAberto && (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm min-w-[500px]">
                            <thead className="text-xs border-b" style={{ background: '#FFFBEB', borderColor: '#FDE68A', color: '#92400E' }}>
                                <tr>
                                    {['Motorista', 'Viagens', 'Total (sacos)', 'Frete Total'].map(h => (
                                        <th key={h} className="px-4 py-2.5 text-left font-semibold whitespace-nowrap">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {porMotorista.map((m, i) => (
                                    <tr key={i} className="border-t hover:bg-amber-50 transition-colors cursor-pointer"
                                        style={{ borderColor: '#FDE68A', background: i % 2 === 0 ? '#fff' : '#FFFBEB' }}
                                        onClick={() => setFiltroMotoristaTer(prev => prev === Object.keys(carregamentos.reduce((acc, r) => { if (r.motorista?.name === m.nome) acc[r.motorista_id] = true; return acc; }, {}))[0] ? '' : carregamentos.find(r => r.motorista?.name === m.nome)?.motorista_id || '')}>
                                        <td className="px-4 py-2.5 font-semibold" style={{ color: 'var(--color-text-primary)' }}>{m.nome}</td>
                                        <td className="px-4 py-2.5 font-mono text-xs" style={{ color: 'var(--color-muted-foreground)' }}>{m.viagens}</td>
                                        <td className="px-4 py-2.5 font-mono font-bold" style={{ color: '#D97706' }}>{m.sacos.toLocaleString('pt-BR')}</td>
                                        <td className="px-4 py-2.5 font-mono font-bold" style={{ color: '#059669' }}>{BRL(m.frete)}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="border-t" style={{ borderColor: '#FDE68A', backgroundColor: '#FEF3C7' }}>
                                    <td className="px-4 py-2.5 font-bold text-xs" style={{ color: '#92400E' }}>TOTAL</td>
                                    <td className="px-4 py-2.5 font-mono font-bold text-xs" style={{ color: '#92400E' }}>{carregamentos.length}</td>
                                    <td className="px-4 py-2.5 font-mono font-bold text-xs" style={{ color: '#D97706' }}>{totalSacos.toLocaleString('pt-BR')}</td>
                                    <td className="px-4 py-2.5 font-mono font-bold text-xs" style={{ color: '#059669' }}>{BRL(totalFrete)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                    )}
                </div>
            )}

            {/* Filtro por motorista */}
            {motoristas.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Filtrar:</span>
                    <button onClick={() => setFiltroMotoristaTer('')}
                        className="px-3 py-1 rounded-full text-xs font-medium border transition-colors"
                        style={!filtroMotoristaTer
                            ? { backgroundColor: '#D97706', color: '#fff', borderColor: '#D97706' }
                            : { borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                        Todos
                    </button>
                    {motoristas.map(m => (
                        <button key={m.id} onClick={() => setFiltroMotoristaTer(prev => prev === m.id ? '' : m.id)}
                            className="px-3 py-1 rounded-full text-xs font-medium border transition-colors"
                            style={filtroMotoristaTer === m.id
                                ? { backgroundColor: '#D97706', color: '#fff', borderColor: '#D97706' }
                                : { borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                            {m.name}
                        </button>
                    ))}
                </div>
            )}

            {/* Barra de ação em massa — aparece quando há registros selecionados */}
            {isAdmin && selecionados.size > 0 && (
                <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl border flex-wrap" style={{ borderColor: '#FDE68A', backgroundColor: '#FEF3C7' }}>
                    <span className="text-xs font-semibold" style={{ color: '#92400E' }}>{selecionados.size} selecionado{selecionados.size > 1 ? 's' : ''}</span>
                    <div className="flex items-center gap-2">
                        {idsSelecionadosPendentes.length > 0 && (
                            <button onClick={() => onTogglePagoEmMassa?.(idsSelecionadosPendentes, true)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-colors"
                                style={{ backgroundColor: '#059669' }}>
                                <Icon name="CheckCircle2" size={13} color="#fff" /> Dar baixa em {idsSelecionadosPendentes.length}
                            </button>
                        )}
                        {idsSelecionadosPagos.length > 0 && (
                            <button onClick={() => onTogglePagoEmMassa?.(idsSelecionadosPagos, false)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors hover:bg-gray-50"
                                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>
                                <Icon name="Undo2" size={13} /> Desfazer {idsSelecionadosPagos.length}
                            </button>
                        )}
                        <button onClick={() => setSelecionados(new Set())}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-medium hover:bg-amber-100 transition-colors" style={{ color: '#92400E' }}>
                            Limpar seleção
                        </button>
                    </div>
                </div>
            )}

            {/* Tabela de carregamentos */}
            {carr.length === 0 ? (
                <div className="bg-white rounded-xl border p-12 flex flex-col items-center justify-center gap-2" style={{ borderColor: 'var(--color-border)' }}>
                    <Icon name="Users" size={36} color="var(--color-muted-foreground)" />
                    <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
                        {filtroMotoristaTer ? 'Nenhum carregamento para este motorista no período' : 'Nenhum carregamento de terceiros no período'}
                    </p>
                </div>
            ) : (
                <div className="bg-white rounded-xl border shadow-sm overflow-x-auto" style={{ borderColor: '#FDE68A' }}>
                    <table className="w-full text-sm min-w-[780px]">
                        <thead className="text-xs border-b" style={{ background: '#FFFBEB', borderColor: '#FDE68A', color: '#92400E' }}>
                            <tr>
                                {isAdmin && <th className="w-4 px-1 py-2.5" />}
                                {['Data', 'Motorista', 'Placa', 'Tipo', 'Empresa', 'Fornecedor/Origem', 'Destino', 'Pedido', 'NF', 'Qtd (sacos)', 'Frete', 'Pagamento'].map(h => (
                                    <th key={h} className="px-2 py-2.5 text-left font-medium whitespace-nowrap">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {pag.pageItems.map((r, i) => {
                                const { tipo, nome } = parseTipo(r);
                                const frete = calcFrete(r);
                                return (
                                    <tr key={r.id} className="border-t hover:bg-amber-50 transition-colors"
                                        style={{ borderColor: '#FDE68A', background: selecionados.has(r.id) ? '#FEF3C7' : (i % 2 === 0 ? '#fff' : '#FFFBEB') }}>
                                        {isAdmin && (
                                            <td className="w-4 px-1 py-2">
                                                <input type="checkbox" checked={selecionados.has(r.id)} onChange={() => toggleSelecionado(r.id)} className="w-3 h-3 cursor-pointer align-middle" />
                                            </td>
                                        )}
                                        <td className="px-2 py-2 whitespace-nowrap">{FMT(r.data_carregamento)}</td>
                                        <td className="px-2 py-2 text-xs font-medium">{r.motorista?.name || '—'}</td>
                                        <td className="px-2 py-2 font-mono text-xs">{r.veiculo?.placa || '—'}</td>
                                        <td className="px-2 py-2"><TipoBadge tipo={tipo} /></td>
                                        <td className="px-2 py-2 text-xs max-w-[90px] truncate" style={{ color: 'var(--color-text-primary)' }}>{r.empresa?.nome || '—'}</td>
                                        <td className="px-2 py-2 max-w-[100px] truncate text-xs" style={{ color: 'var(--color-muted-foreground)' }}>{nome || '—'}</td>
                                        <td className="px-2 py-2 text-xs max-w-[100px] truncate">{r.destino || '—'}</td>
                                        <td className="px-2 py-2 font-mono text-xs">{r.numero_pedido || '—'}</td>
                                        <td className="px-2 py-2 font-mono text-xs">{r.numero_nota_fiscal || '—'}</td>
                                        <td className="px-2 py-2 font-bold font-mono whitespace-nowrap" style={{ color: '#D97706' }}>{(Number(r.quantidade)||0).toLocaleString('pt-BR')}</td>
                                        <td className="px-2 py-2 font-mono font-semibold whitespace-nowrap" style={{ color: '#059669' }}>{frete > 0 ? BRL(frete) : '—'}</td>
                                        <td className="px-2 py-2">
                                            <ActionButtonsGroup>
                                                {isAdmin ? (
                                                    <button type="button" onClick={() => onTogglePago?.(r)}
                                                        title={r.frete_pago ? 'Pago — clique para desfazer' : 'Pendente — clique para marcar como pago'}
                                                        className="p-1.5 rounded-lg hover:bg-green-100 transition-colors flex-shrink-0">
                                                        <Icon name="CheckCircle2" size={ACTION_ICON_SIZE} color={r.frete_pago ? '#059669' : '#9CA3AF'} className="flex-shrink-0" />
                                                    </button>
                                                ) : (
                                                    <Icon name="CheckCircle2" size={ACTION_ICON_SIZE} color={r.frete_pago ? '#059669' : '#9CA3AF'} />
                                                )}
                                                {isAdmin && (
                                                    <>
                                                        <EditButton onClick={() => onEdit(r)} />
                                                        <DeleteButton onClick={() => onDelete(r.id)} />
                                                    </>
                                                )}
                                            </ActionButtonsGroup>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    {/* Linha de totais do que está filtrado (status + motorista + valor) — atualiza sozinha conforme os filtros acima */}
                    <div className="flex items-center justify-between px-4 py-2.5 border-t text-xs font-semibold" style={{ borderColor: '#FDE68A', backgroundColor: '#FFFBEB', color: '#92400E' }}>
                        <span>
                            {filtroPago === 'pendentes' ? 'Total pendente' : filtroPago === 'pagos' ? 'Total pago' : 'Total filtrado'}
                            {filtroMotoristaTer && ` · ${motoristas.find(m => m.id === filtroMotoristaTer)?.name || 'motorista selecionado'}`}
                            {' — '}{carr.length} registro{carr.length !== 1 ? 's' : ''}
                        </span>
                        <span className="font-data text-sm">{BRL(totalFreteFiltrado)}</span>
                    </div>
                    <PaginationBar page={pag.page} setPage={pag.setPage} totalPages={pag.totalPages}
                        totalItems={pag.totalItems} pageSize={pag.pageSize} itemLabel="carregamento" itemLabelPlural="carregamentos" />
                </div>
            )}
        </div>
    );
}
