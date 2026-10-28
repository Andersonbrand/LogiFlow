import React, { useState, useCallback } from 'react';

import * as XLSX from 'xlsx';

import { AppIcon as Icon, useConfirm, usePeriodRangeFilter, usePagination, useCollapsible, NavigationBar, BreadcrumbTrail, Button, PrettySelect, PeriodRangeFilter, CollapseChevron, PaginationBar, CardMesParcelas, TabelaLancamentosPaginada, BoletosPainel, Toast } from 'components';
import { useAuth } from 'context/AuthContext';
import { useToast } from 'hooks/useToast';

import { FMT, BRL } from '../utils/helpers';
import { inputStyle } from '../utils/constants';
import { useDespesasLista, useDespesasResumo } from '../hooks';
import PgBadge from '../PgBadge';
import BoletosPendentes from '../BoletosPendentes';
import ModalDespesa from '../ModalDespesa';
import ModalVisualizacaoDespesa from '../ModalVisualizacaoDespesa';
import ModalBaixa from '../ModalBaixa';

// Paleta de cores das categorias
const CAT_COLORS = [
    '#3B82F6', '#8B5CF6', '#EC4899', '#F97316', '#10B981',
    '#06B6D4', '#EAB308', '#EF4444', '#6366F1', '#14B8A6',
    '#F59E0B', '#84CC16', '#A855F7', '#0EA5E9', '#D946EF',
    '#22C55E', '#FB923C', '#E11D48', '#7C3AED', '#0891B2',
];

/**
 * Tela de despesas compartilhada por Caminhões e Administrativas (a de Carretas usa os mesmos
 * modais/hooks dentro das abas da página de carretas). Tudo que muda entre as telas vem em `config`:
 * serviço (tabelas), textos, ícone e se há vínculo com veículo — ver pages/despesas-*\/config.js.
 */
export default function DespesasPage({ config }) {
    const { servico, comVeiculo, textos } = config;
    const { isAdmin } = useAuth();
    const { toast, showToast } = useToast();
    const { confirm, ConfirmDialog } = useConfirm();
    const admin = isAdmin();

    const [modal, setModal] = useState(null);
    const [modalBaixa, setModalBaixa] = useState(null);
    const [viewDespesa, setViewDespesa] = useState(null);
    const [filtro, setFiltro] = useState({ vehicleId: '', categoria: '', formaPgto: '' });
    const { preset: periodoPreset, periodo, onPresetChange: aplicarPreset, setPeriodo } = usePeriodRangeFilter('todos');
    const [busca, setBusca] = useState('');
    const [guiaDespesas, setGuiaDespesas] = useState('registros');
    const [relatorioPeriodo, setRelatorioPeriodo] = useState(() => {
        const h = new Date();
        return { inicio: `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}-01`, fim: `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}-${String(new Date(h.getFullYear(), h.getMonth() + 1, 0).getDate()).padStart(2, '0')}` };
    });

    const { despesas, veiculos, loading, load, categorias: todasCategorias, recarregarCategorias } = useDespesasLista({ config, filtro, periodo, showToast });
    const { despesasFiltradas, totalPeriodo, totalPorCategoria, parcelasFuturas, relatorioStatus, boletosVencendo } = useDespesasResumo({ despesas, busca, relatorioPeriodo });
    const despesasPag = usePagination(despesasFiltradas, 20, [despesasFiltradas.length, busca]);
    const { open: categoriasOpen, toggle: toggleCategorias } = useCollapsible(false);
    const getCatColor = useCallback((cat) => CAT_COLORS[todasCategorias.indexOf(cat) % CAT_COLORS.length] || '#6B7280', [todasCategorias]);

    const handleDelete = async (id) => {
        const ok = await confirm({ title: 'Excluir despesa?', message: 'Esta ação não pode ser desfeita.', confirmLabel: 'Excluir', variant: 'danger' });
        if (!ok) return;
        try { await servico.deleteDespesa(id); showToast('Despesa excluída!', 'warning'); load(); }
        catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };

    const exportar = () => {
        if (!despesas.length) { showToast('Nenhuma despesa no período', 'error'); return; }
        const rows = despesas.map(d => ({
            'Data': FMT(d.data_despesa), ...(comVeiculo ? { 'Placa': d.veiculo?.placa || '—' } : {}),
            'Categoria': d.categoria, 'Empresa': d.empresa || '',
            'Fornecedor': d.fornecedor || '', 'Descrição': d.descricao || '',
            'NF': d.nota_fiscal || '', 'Forma Pgto': d.forma_pagamento === 'a_vista' ? 'À Vista' : 'A Prazo',
            'Tipo': d.tipo_pagamento || '', 'Valor (R$)': Number(d.valor || 0),
            'Observações': d.observacoes || '',
        }));
        rows.push({ 'Data': 'TOTAL', 'Valor (R$)': totalPeriodo });
        const ws = XLSX.utils.json_to_sheet(rows);
        ws['!cols'] = (comVeiculo ? [12, 12, 22, 22, 28, 28, 12, 12, 14, 14, 30] : [12, 22, 22, 28, 28, 12, 12, 14, 14, 30]).map(w => ({ wch: w }));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, textos.abaExcel);
        XLSX.writeFile(wb, `${textos.arquivoExcel}_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.xlsx`);
        showToast('Exportado!', 'success');
    };

    return (
        <div className="min-h-screen" style={{ backgroundColor: 'var(--color-background)' }}>
            <NavigationBar />
            <main className="main-content">
                <div className="max-w-[1920px] mx-auto px-4 lg:px-8 py-6">
                    <BreadcrumbTrail className="mb-4" />

                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                        <div>
                            <h1 className="font-heading font-bold text-2xl md:text-3xl flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
                                <Icon name={config.icone} size={28} color="var(--color-primary)" /> {textos.titulo}
                            </h1>
                            <p className="text-sm mt-1" style={{ color: 'var(--color-muted-foreground)' }}>
                                {textos.subtitulo}
                            </p>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                            <button onClick={exportar} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium hover:bg-gray-50 transition-colors" style={{ borderColor: 'var(--color-border)' }}>
                                <Icon name="FileDown" size={14} /> Exportar Excel
                            </button>
                            {admin && (
                                <Button onClick={() => setModal({ mode: 'create' })} iconName="Plus">Nova Despesa</Button>
                            )}
                        </div>
                    </div>

                    {/* Alertas de boletos vencendo */}
                    {boletosVencendo.length > 0 && (
                        <div className="mb-5 p-4 rounded-2xl border flex items-start gap-3"
                            style={{ backgroundColor: '#FFF7ED', borderColor: '#FED7AA' }}>
                            <Icon name="AlertTriangle" size={20} color="#D97706" />
                            <div className="flex-1">
                                <p className="text-sm font-semibold text-amber-800 mb-1">
                                    ⚠️ {boletosVencendo.length} pagamento{boletosVencendo.length > 1 ? 's' : ''} vencendo nos próximos 7 dias
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {boletosVencendo.map((alerta, i) => (
                                        <button key={i} onClick={() => setModalBaixa(alerta.despesa)}
                                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors"
                                            style={{ backgroundColor: alerta.atrasado ? '#FEE2E2' : '#FEF3C7', color: alerta.atrasado ? '#B91C1C' : '#92400E', border: `1px solid ${alerta.atrasado ? '#FECACA' : '#FDE68A'}` }}>
                                            {alerta.atrasado ? '🔴' : '🟡'}
                                            {comVeiculo ? (alerta.despesa.veiculo?.placa || 'Sem placa') : alerta.despesa.categoria} · {BRL(alerta.boleto?.valor || alerta.parcela?.valor)} · {FMT(alerta.boleto?.vencimento || alerta.parcela?.vencimento)}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Filtros */}
                    <div className="flex flex-wrap gap-2 items-center mb-5">
                        {comVeiculo && (
                            <PrettySelect value={filtro.vehicleId} onChange={e => setFiltro(f => ({ ...f, vehicleId: e.target.value }))} className="px-3 py-2 rounded-lg border text-sm" style={inputStyle}>
                                <option value="">Todos veículos</option>
                                {veiculos.map(v => <option key={v.id} value={v.id}>{v.placa}</option>)}
                            </PrettySelect>
                        )}
                        <PrettySelect value={filtro.categoria} onChange={e => setFiltro(f => ({ ...f, categoria: e.target.value }))} className="px-3 py-2 rounded-lg border text-sm" style={inputStyle}>
                            <option value="">Todas categorias</option>
                            {todasCategorias.map(c => <option key={c} value={c}>{c}</option>)}
                        </PrettySelect>
                        <PrettySelect value={filtro.formaPgto} onChange={e => setFiltro(f => ({ ...f, formaPgto: e.target.value }))} className="px-3 py-2 rounded-lg border text-sm" style={inputStyle}>
                            <option value="">Todas as formas</option>
                            <option value="a_vista">À Vista</option>
                            <option value="a_prazo">A Prazo</option>
                        </PrettySelect>
                        <PeriodRangeFilter preset={periodoPreset} onPresetChange={aplicarPreset} periodo={periodo} onPeriodoChange={setPeriodo} />
                        <div className="relative flex-1 min-w-[220px] max-w-[320px]">
                            <Icon name="Search" size={14} color="var(--color-muted-foreground)" className="absolute left-3 top-1/2 -translate-y-1/2" />
                            <input value={busca} onChange={e => setBusca(e.target.value)} placeholder={textos.placeholderBusca}
                                className="w-full pl-9 pr-3 py-2 rounded-lg border text-sm" style={inputStyle} />
                        </div>
                        <button onClick={load} className="p-2 rounded-lg border hover:bg-gray-50" style={{ borderColor: 'var(--color-border)' }} title="Atualizar">
                            <Icon name="RefreshCw" size={14} color="var(--color-muted-foreground)" />
                        </button>
                        {((comVeiculo && filtro.vehicleId) || filtro.categoria || periodoPreset !== 'todos' || filtro.formaPgto || busca) && (
                            <button onClick={() => { setFiltro({ vehicleId: '', categoria: '', formaPgto: '' }); aplicarPreset('todos'); setBusca(''); }}
                                className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 border border-red-200">
                                <Icon name="X" size={12} /> Limpar filtros
                            </button>
                        )}
                    </div>

                    {/* KPIs */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                        <div className="bg-white rounded-2xl border p-4 shadow-sm sm:col-span-2" style={{ borderColor: 'var(--color-border)' }}>
                            <p className="text-xs mb-1" style={{ color: 'var(--color-muted-foreground)' }}>Total no Período</p>
                            <p className="text-2xl font-bold font-data text-red-600">{BRL(totalPeriodo)}</p>
                            <p className="text-xs mt-1" style={{ color: 'var(--color-muted-foreground)' }}>{despesas.length} lançamento{despesas.length !== 1 ? 's' : ''}</p>
                        </div>
                        {totalPorCategoria.slice(0, 2).map(([cat, val]) => (
                            <div key={cat} className="bg-white rounded-2xl border p-4 shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
                                <p className="text-xs mb-1 truncate" style={{ color: 'var(--color-muted-foreground)' }}>{cat}</p>
                                <p className="text-lg font-bold font-data" style={{ color: getCatColor(cat) }}>{BRL(val)}</p>
                                <p className="text-xs mt-1" style={{ color: 'var(--color-muted-foreground)' }}>
                                    {totalPeriodo > 0 ? ((val / totalPeriodo) * 100).toFixed(1) : 0}% do total
                                </p>
                            </div>
                        ))}
                    </div>

                    {/* Gráfico de categorias */}
                    {totalPorCategoria.length > 0 && (
                        <div className="bg-white rounded-2xl border shadow-sm mb-5 overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
                            <button type="button" onClick={toggleCategorias}
                                className="w-full px-4 py-3 flex items-center justify-between gap-2 hover:bg-gray-50 transition-colors">
                                <p className="text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Distribuição por categoria</p>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    <span className="text-xs font-data font-semibold" style={{ color: 'var(--color-primary)' }}>{BRL(totalPeriodo)}</span>
                                    <CollapseChevron open={categoriasOpen} color="var(--color-text-secondary)" />
                                </div>
                            </button>
                            {categoriasOpen && (
                                <div className="px-4 pb-4 space-y-2">
                                    {totalPorCategoria.map(([cat, val]) => {
                                        const pct = totalPeriodo > 0 ? (val / totalPeriodo) * 100 : 0;
                                        return (
                                            <div key={cat}>
                                                <div className="flex justify-between items-center text-xs mb-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: getCatColor(cat) }} />
                                                        <span className="font-medium" style={{ color: 'var(--color-text-primary)' }}>{cat}</span>
                                                    </div>
                                                    <span className="font-data font-medium">{BRL(val)} <span style={{ color: 'var(--color-muted-foreground)' }}>({pct.toFixed(1)}%)</span></span>
                                                </div>
                                                <div className="w-full h-1.5 rounded-full bg-gray-100 overflow-hidden">
                                                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: getCatColor(cat) }} />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Sub-guias */}
                    <div className="flex gap-1 mb-5 p-1 rounded-xl border" style={{ borderColor: 'var(--color-border)', backgroundColor: '#F9FAFB', width: 'fit-content' }}>
                        {[{ id: 'registros', label: 'Registros', icon: 'Receipt' }, { id: 'parcelas', label: 'Parcelas Futuras', icon: 'Clock' }, { id: 'relatorio', label: 'Pago / Em Aberto', icon: 'BarChart2' }, { id: 'boletos', label: 'Boletos', icon: 'CalendarClock' }].map(g => (
                            <button key={g.id} onClick={() => setGuiaDespesas(g.id)}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
                                style={guiaDespesas === g.id ? { backgroundColor: 'white', color: 'var(--color-primary)', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', fontWeight: 600 } : { color: 'var(--color-muted-foreground)' }}>
                                <Icon name={g.icon} size={14} color={guiaDespesas === g.id ? 'var(--color-primary)' : 'var(--color-muted-foreground)'} />{g.label}
                            </button>
                        ))}
                    </div>

                    {/* Tabela */}
                    {guiaDespesas === 'registros' && (loading ? (
                        <div className="flex justify-center py-16">
                            <div className="animate-spin h-7 w-7 rounded-full border-4" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
                        </div>
                    ) : despesasFiltradas.length === 0 ? (
                        <div className="bg-white rounded-2xl border p-16 flex flex-col items-center justify-center gap-3" style={{ borderColor: 'var(--color-border)' }}>
                            <Icon name={config.icone} size={40} color="var(--color-muted-foreground)" />
                            <p className="text-base font-medium" style={{ color: 'var(--color-muted-foreground)' }}>{busca ? `Nenhum resultado para "${busca}"` : textos.nenhumaDespesa}</p>
                            {admin && !busca && (
                                <button onClick={() => setModal({ mode: 'create' })}
                                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white"
                                    style={{ backgroundColor: 'var(--color-primary)' }}>
                                    <Icon name="Plus" size={14} color="white" /> Registrar primeira despesa
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="bg-white rounded-2xl border shadow-sm overflow-x-auto" style={{ borderColor: 'var(--color-border)' }}>
                            <table className="w-full text-sm min-w-[800px]">
                                <thead className="text-xs border-b" style={{ backgroundColor: 'var(--color-muted)', borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                                    <tr>{['Data', ...(comVeiculo ? ['Placa'] : []), 'Categoria', 'Empresa / Fornecedor', 'Descrição', 'NF', 'Pagamento', 'Valor', ''].map(h => (
                                        <th key={h} className="px-3 py-3 text-left font-medium whitespace-nowrap">{h}</th>
                                    ))}</tr>
                                </thead>
                                <tbody>
                                    {despesasPag.pageItems.map((d, i) => (
                                        <tr key={d.id} className="border-t hover:bg-gray-50 transition-colors" style={{ borderColor: 'var(--color-border)', backgroundColor: i % 2 === 0 ? '#fff' : '#F8FAFC' }}>
                                            <td className="px-3 py-3 whitespace-nowrap text-xs" style={{ color: 'var(--color-muted-foreground)' }}>{FMT(d.data_despesa)}</td>
                                            {comVeiculo && <td className="px-3 py-3 font-data font-medium text-xs" style={{ color: 'var(--color-primary)' }}>{d.veiculo?.placa || '—'}</td>}
                                            <td className="px-3 py-3">
                                                <span className="px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap" style={{ backgroundColor: getCatColor(d.categoria) + '20', color: getCatColor(d.categoria) }}>{d.categoria}</span>
                                            </td>
                                            <td className="px-3 py-3 text-xs max-w-[140px]">
                                                {d.empresa && <p className="font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>{d.empresa}</p>}
                                                {d.fornecedor && <p className="truncate" style={{ color: 'var(--color-muted-foreground)' }}>{d.fornecedor}</p>}
                                                {!d.empresa && !d.fornecedor && <span style={{ color: 'var(--color-muted-foreground)' }}>—</span>}
                                            </td>
                                            <td className="px-3 py-3 text-xs max-w-[150px] truncate" style={{ color: 'var(--color-muted-foreground)' }}>{d.descricao || '—'}</td>
                                            <td className="px-3 py-3 text-xs font-data" style={{ color: 'var(--color-muted-foreground)' }}>{d.nota_fiscal || '—'}</td>
                                            <td className="px-3 py-3">
                                                <div className="flex flex-col gap-0.5">
                                                    <PgBadge d={d} />
                                                    <BoletosPendentes despesa={d} />
                                                </div>
                                            </td>
                                            <td className="px-3 py-3 font-data font-bold text-red-600 whitespace-nowrap">{BRL(d.valor)}</td>
                                            <td className="px-3 py-3">
                                                <div className="flex items-center gap-1">
                                                    <button onClick={() => setViewDespesa(d)} title="Visualizar despesa"
                                                        className="p-1.5 rounded hover:bg-indigo-50 transition-colors">
                                                        <Icon name="Eye" size={16} color="#4F46E5" />
                                                    </button>
                                                    <button onClick={() => setModalBaixa(d)} title="Dar baixa em pagamentos"
                                                        className="p-1.5 rounded hover:bg-green-50 transition-colors">
                                                        <Icon name="CheckCircle2" size={16} color={((d.boletos || []).some(b => !b.pago) || (d.parcelas_cartao || []).some(p => !p.pago)) ? "#059669" : "#9CA3AF"} />
                                                    </button>
                                                    {admin && (
                                                        <>
                                                            <button onClick={() => setModal({ mode: 'edit', data: d })} className="p-1.5 rounded hover:bg-blue-50 transition-colors">
                                                                <Icon name="Pencil" size={16} color="#1D4ED8" />
                                                            </button>
                                                            <button onClick={() => handleDelete(d.id)} className="p-1.5 rounded hover:bg-red-50 transition-colors">
                                                                <Icon name="Trash2" size={16} color="#DC2626" />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="border-t-2" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-muted)' }}>
                                    <tr>
                                        <td colSpan={comVeiculo ? 7 : 6} className="px-3 py-3 text-xs font-semibold text-right" style={{ color: 'var(--color-text-secondary)' }}>Total</td>
                                        <td className="px-3 py-3 font-data font-bold text-red-600 text-base">{BRL(totalPeriodo)}</td>
                                        <td />
                                    </tr>
                                </tfoot>
                            </table>
                            <PaginationBar page={despesasPag.page} setPage={despesasPag.setPage} totalPages={despesasPag.totalPages}
                                totalItems={despesasPag.totalItems} pageSize={despesasPag.pageSize} itemLabel="despesa" itemLabelPlural="despesas" />
                        </div>
                    ))}

                    {/* Parcelas Futuras */}
                    {guiaDespesas === 'parcelas' && (
                        <div className="space-y-4">
                            {parcelasFuturas.length === 0 ? (
                                <div className="flex flex-col items-center gap-2 py-16 text-center">
                                    <Icon name="CheckCircle2" size={32} color="#059669" />
                                    <p className="text-sm font-medium">Nenhuma parcela futura em aberto</p>
                                </div>
                            ) : parcelasFuturas.map(mes => (
                                <CardMesParcelas key={mes.mes} mes={mes} comVeiculo={comVeiculo} />
                            ))}
                        </div>
                    )}

                    {/* Relatório Pago / Em Aberto */}
                    {guiaDespesas === 'relatorio' && (
                        <div className="space-y-5">
                            <div className="flex flex-wrap items-end gap-3 p-4 rounded-xl border" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-card)' }}>
                                <div><label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Início</label><input type="date" value={relatorioPeriodo.inicio} onChange={e => setRelatorioPeriodo(p => ({ ...p, inicio: e.target.value }))} className="px-3 py-2 rounded-lg border text-sm" /></div>
                                <div><label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Fim</label><input type="date" value={relatorioPeriodo.fim} onChange={e => setRelatorioPeriodo(p => ({ ...p, fim: e.target.value }))} className="px-3 py-2 rounded-lg border text-sm" /></div>
                            </div>
                            {relatorioStatus && (<>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="rounded-xl border p-4" style={{ borderColor: '#A7F3D0', backgroundColor: '#F0FDF4' }}><p className="text-xs font-medium text-green-700 mb-1">✅ Total Pago</p><p className="text-2xl font-bold font-data text-green-700">{BRL(relatorioStatus.totalPago)}</p><p className="text-xs text-green-600">{relatorioStatus.pagos.length} lançamento(s)</p></div>
                                    <div className="rounded-xl border p-4" style={{ borderColor: '#FCA5A5', backgroundColor: '#FFF1F2' }}><p className="text-xs font-medium text-red-700 mb-1">🔴 Total em Aberto</p><p className="text-2xl font-bold font-data text-red-700">{BRL(relatorioStatus.totalAberto)}</p><p className="text-xs text-red-600">{relatorioStatus.abertos.length} lançamento(s)</p></div>
                                </div>
                                {[{ lista: relatorioStatus.abertos, titulo: 'Em Aberto', cor: '#DC2626', bg: '#FFF1F2', border: '#FCA5A5', total: relatorioStatus.totalAberto }, { lista: relatorioStatus.pagos, titulo: 'Pagos', cor: '#059669', bg: '#F0FDF4', border: '#A7F3D0', total: relatorioStatus.totalPago }].map(({ lista, titulo, cor, bg, border, total }) => (
                                    <TabelaLancamentosPaginada key={titulo} lista={lista} titulo={titulo} cor={cor} bg={bg} border={border} totalGeral={total} comVeiculo={comVeiculo} />
                                ))}
                            </>)}
                        </div>
                    )}

                    {/* Boletos deste módulo */}
                    {guiaDespesas === 'boletos' && <BoletosPainel origem={config.origemBoletos} onChanged={load} />}
                </div>
            </main>

            {/* Modals */}
            {modal && (
                <ModalDespesa
                    modal={modal}
                    config={config}
                    veiculos={veiculos}
                    despesasExistentes={despesas}
                    categorias={todasCategorias}
                    onCategoriasChange={recarregarCategorias}
                    onClose={() => setModal(null)}
                    onSaved={load}
                />
            )}
            {viewDespesa && (
                <ModalVisualizacaoDespesa
                    despesa={viewDespesa}
                    config={config}
                    onClose={() => setViewDespesa(null)}
                    onAtualizado={load}
                    admin={admin}
                />
            )}
            {modalBaixa && (
                <ModalBaixa
                    despesa={modalBaixa}
                    config={config}
                    onClose={() => setModalBaixa(null)}
                    onBaixado={() => { load(); setModalBaixa(null); }}
                    isAdmin={admin}
                />
            )}

            <Toast toast={toast} />
            {ConfirmDialog}
        </div>
    );
}
