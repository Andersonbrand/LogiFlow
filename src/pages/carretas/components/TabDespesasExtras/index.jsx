import React, { useState, useCallback, useEffect, useMemo } from 'react';

import * as XLSX from 'xlsx';

import { useToast } from 'hooks/useToast';
import { useConfirm, usePagination, useCollapsible, PrettySelect, AppIcon as Icon, Button, CardMesParcelas, BoletosPainel, Toast, SearchInput } from 'components';
import { CATEGORIAS_DESPESA, fetchCategoriasDespesaCarretas,     fetchDespesasExtras, fetchCarretasVeiculos,  deleteDespesaExtra } from 'services/carretas';
import { useRecarregarAoVoltar } from 'hooks/useRecarregarAoVoltar';

import { FMT_DATE, BRL } from '../../utils/helpers';
import { inputStyle, } from '../../utils/constants';
import { ModalDespesa, ModalBaixa, ModalVisualizacaoDespesa } from 'components/Despesas';

import { despesasCarretasConfig } from '../../despesasConfig';
import TabRegistros from './components/TabRegistros';
import TabRelatorio from './components/TabRelatorio';

export default function TabDespesasExtras({ isAdmin, profile }) {
    const { toast, showToast } = useToast();
    const { confirm, ConfirmDialog } = useConfirm();
    const [despesas, setDespesas]   = useState([]);
    const [veiculos, setVeiculos]   = useState([]);
    const [loading, setLoading]     = useState(true);
    const [modal, setModal]         = useState(null);
    
    const [modalBaixa, setModalBaixa] = useState(null);
    const [viewDespesa, setViewDespesa] = useState(null);
    
    const mesAtualDespesas = (() => { const h = new Date(); return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}`; })();
    const [filtro, setFiltro]       = useState(() => {
        let mes = mesAtualDespesas;
        try { mes = sessionStorage.getItem('carretas_despesas_filtroMes') ?? mesAtualDespesas; } catch {}
        return { veiculoId: '', categoria: '', mes };
    });
    const [periodoCustom, setPeriodoCustom] = useState({ inicio: '', fim: '' }); // tem prioridade sobre dia/mês
    const [usarPeriodo, setUsarPeriodo] = useState(false);
    const handleSetFiltroMes = (mes) => {
        setFiltro(f => ({ ...f, mes }));
        try { sessionStorage.setItem('carretas_despesas_filtroMes', mes); } catch {}
    };
    const [categorias, setCategorias] = useState(() => [...CATEGORIAS_DESPESA]);
    
    const recarregarCategorias = useCallback(async () => {
        try { setCategorias(await fetchCategoriasDespesaCarretas()); }
        catch (e) { showToast('Erro ao carregar categorias: ' + e.message, 'error'); }
    }, []);
    useEffect(() => { recarregarCategorias(); }, [recarregarCategorias]);

    const [guiaDespesas, setGuiaDespesas] = useState('registros'); // 'registros' | 'parcelas' | 'relatorio'
    const [relatorioPeriodo, setRelatorioPeriodo] = useState(() => {
        const h = new Date();
        return {
            inicio: `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}-01`,
            fim:    `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}-${String(new Date(h.getFullYear(), h.getMonth() + 1, 0).getDate()).padStart(2, '0')}`,
        };
    });

    const todasCategorias = categorias;

    // ── Parcelas futuras a vencer (de TODAS as despesas, não apenas do período filtrado) ──
    const [pesquisa, setPesquisa] = useState('');
    const despesasFiltradas = useMemo(() => {
        if (!pesquisa.trim()) return despesas;
        const q = pesquisa.toLowerCase();
        return despesas.filter(d =>
            (d.categoria || '').toLowerCase().includes(q) ||
            (d.descricao || '').toLowerCase().includes(q) ||
            (d.fornecedor || '').toLowerCase().includes(q) ||
            (d.veiculo?.placa || '').toLowerCase().includes(q) ||
            (d.nota_fiscal || '').toLowerCase().includes(q) ||
            (d.boletos || []).some(b => (b.numero_boleto || '').toLowerCase().includes(q)) ||
            (d.parcelas_cartao || []).some(p => (p.cartao || '').toLowerCase().includes(q)) ||
            (d.cheques || []).some(c => (c.numero || '').toLowerCase().includes(q))
        );
    }, [despesas, pesquisa]);
    const despesasPag = usePagination(despesasFiltradas, 15, [despesasFiltradas.length, pesquisa]);

    const parcelasFuturas = useMemo(() => {
        const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
        const porMes = {}; // 'YYYY-MM' -> { total, itens: [{despesa, tipo, valor, vencimento, cartao?}] }
        const addItem = (despesa, tipo, valor, vencimento, cartao, numeroBoleto) => {
            if (!vencimento) return;
            const d = new Date(vencimento + 'T00:00:00');
            if (d < hoje) return; // apenas futuras
            const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            if (!porMes[chave]) porMes[chave] = { total: 0, itens: [] };
            porMes[chave].total += Number(valor) || 0;
            porMes[chave].itens.push({ despesa, tipo, valor: Number(valor) || 0, vencimento, cartao, numeroBoleto });
        };
        despesasFiltradas.forEach(d => {
            (d.boletos || []).forEach(b => { if (!b.pago) addItem(d, 'Boleto', b.valor, b.vencimento, null, b.numero_boleto); });
            (d.parcelas_cartao || []).forEach(p => { if (!p.pago) addItem(d, 'Cartão', p.valor, p.vencimento, p.cartao); });
            (d.cheques || []).forEach(c => { if (!c.pago) addItem(d, 'Cheque', c.valor, c.vencimento); });
        });
        return Object.entries(porMes)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([mes, dados]) => ({ mes, ...dados, itens: dados.itens.sort((a, b) => a.vencimento.localeCompare(b.vencimento)) }));
    }, [despesasFiltradas]);

    // ── Relatório pago/aberto por período selecionado ──
    const relatorioStatus = useMemo(() => {
        const { inicio, fim } = relatorioPeriodo;
        if (!inicio || !fim) return null;
        
        const pagos = [], abertos = [];
        despesasFiltradas.forEach(d => {
            const isNoPeriodo = d.data_despesa >= inicio && d.data_despesa <= fim;
            // A prazo: analisa cada parcela/boleto individualmente
            if (d.forma_pagamento === 'a_prazo') {
                (d.boletos || []).forEach(b => {
                    const v = b.vencimento || d.data_despesa;
                    if (v < inicio || v > fim) return;
                    const item = { despesa: d, tipo: 'Boleto', valor: Number(b.valor) || 0, vencimento: v, pago: b.pago, pago_em: b.pago_em, numeroBoleto: b.numero_boleto };
                    b.pago ? pagos.push(item) : abertos.push(item);
                });
                (d.parcelas_cartao || []).forEach(p => {
                    const v = p.vencimento || d.data_despesa;
                    if (v < inicio || v > fim) return;
                    const item = { despesa: d, tipo: 'Cartão', valor: Number(p.valor) || 0, vencimento: v, pago: p.pago, pago_em: p.pago_em, cartao: p.cartao };
                    p.pago ? pagos.push(item) : abertos.push(item);
                });
            } else if (isNoPeriodo) {
                // À vista: a própria despesa é paga ou aberta
                const item = { despesa: d, tipo: d.tipo_pagamento || 'À vista', valor: Number(d.valor) || 0, vencimento: d.data_despesa, pago: true };
                pagos.push(item);
            }
        });
        return {
            pagos:        pagos.sort((a, b) => a.vencimento.localeCompare(b.vencimento)),
            abertos:      abertos.sort((a, b) => a.vencimento.localeCompare(b.vencimento)),
            totalPago:    pagos.reduce((s, i) => s + i.valor, 0),
            totalAberto:  abertos.reduce((s, i) => s + i.valor, 0),
        };
    }, [despesasFiltradas, relatorioPeriodo]);

    // Renomeia qualquer categoria (padrão ou criada pelo usuário) e atualiza em
    // cascata todas as despesas já lançadas com o nome antigo, pra não "perder"
    // o histórico nem quebrar filtros/relatórios.

    // Exclui uma categoria da lista de opções. Não apaga despesas já
    // lançadas com essa categoria (o texto continua salvo nelas) — apenas
    // avisa quantas existem antes de confirmar.
    
    // nome da categoria em edição inline

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const f = {};
            if (filtro.veiculoId) f.veiculoId  = filtro.veiculoId;
            if (filtro.categoria) f.categoria  = filtro.categoria;
            if (usarPeriodo && periodoCustom.inicio && periodoCustom.fim) {
                f.dataInicio = periodoCustom.inicio;
                f.dataFim    = periodoCustom.fim;
            } else if (filtro.dia) {
                f.dataInicio = filtro.dia; f.dataFim = filtro.dia;
            } else if (filtro.mes) {
                f.dataInicio = filtro.mes + '-01';
                f.dataFim    = filtro.mes + '-' + String(new Date(Number(filtro.mes.split('-')[0]), Number(filtro.mes.split('-')[1]), 0).getDate()).padStart(2,'0');
            }
            const [d, v] = await Promise.all([fetchDespesasExtras(f), fetchCarretasVeiculos()]);
            setDespesas(d); setVeiculos(v);
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
        finally { setLoading(false); }
    }, [filtro, usarPeriodo, periodoCustom]); // eslint-disable-line
    useEffect(() => { load(); }, [load]);
    useRecarregarAoVoltar(load);

    const totalPeriodo = useMemo(() => despesas.reduce((s, d) => s + Number(d.valor || 0), 0), [despesas]);
    const totalPorCategoria = useMemo(() => {
        const acc = {};
        despesas.forEach(d => { acc[d.categoria] = (acc[d.categoria] || 0) + Number(d.valor || 0); });
        return Object.entries(acc).sort((a, b) => b[1] - a[1]);
    }, [despesas]);
    const { open: categoriasOpen, toggle: toggleCategorias } = useCollapsible(false);

    // Item 9: leitura de XML de NF

    // Item 2 (extra): Leitor de código de barras / laser (NF em papel)
    // Leitores a laser digitam os caracteres muito rápido e encerram com Enter.
    // Capturamos o buffer e preenchemos o campo da NF automaticamente.

    // Busca dados completos da NF-e pela chave de acesso (44 dígitos)
    // usando a API pública da ReceitaWS / NFe.io / nfe.fazenda.gov.br

    // Edita um campo de um boleto/parcela já lançado diretamente na lista.

    // ── Geração automática de parcelas (boleto ou cartão) ─────────────────────

    const handleDelete = async (id) => {
        const ok = await confirm({ title: 'Excluir despesa?', message: 'Esta ação não pode ser desfeita.', confirmLabel: 'Excluir', variant: 'danger' });
        if (!ok) return;
        try { await deleteDespesaExtra(id); showToast('Excluída!', 'success'); load(); }
        catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };

    const exportar = () => {
        if (!despesas.length) { showToast('Nenhuma despesa no período selecionado.', 'error'); return; }
        const rows = despesas.map(d => ({
            'Data': FMT_DATE(d.data_despesa), 'Placa': d.veiculo?.placa || '—',
            'Categoria': d.categoria, 'Fornecedor': d.fornecedor || '',
            'Descrição': d.descricao || '', 'NF': d.nota_fiscal || '',
            'Forma Pgto': d.forma_pagamento === 'a_vista' ? 'À Vista' : 'A Prazo',
            'Tipo Pgto': d.tipo_pagamento || '', 'Valor (R$)': Number(d.valor || 0),
            'Observações': d.observacoes || '',
        }));
        rows.push({ 'Data': 'TOTAL', 'Valor (R$)': totalPeriodo });
        const ws = XLSX.utils.json_to_sheet(rows);
        ws['!cols'] = [12,12,22,28,28,12,12,14,14,30].map(w => ({ wch: w }));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Despesas');
        XLSX.writeFile(wb, `despesas_extras_${new Date().toLocaleDateString('pt-BR').replace(/\//g,'-')}.xlsx`);
        showToast('Exportado!', 'success');
    };

    const openCreate = () => setModal({ mode: 'create' });
    const openEdit = (d) => setModal({ mode: 'edit', data: d });

    // Badge de pagamento
    const pgBadge = (d) => {
        if (d.forma_pagamento === 'a_prazo') {
            const label = d.tipo_pagamento === 'boleto' ? 'Boleto'
                : d.tipo_pagamento === 'cartao_prazo' ? '💳 Cartão Parc.'
                : d.tipo_pagamento === 'permuta' ? 'Permuta' : 'Cheque';
            const isCard = d.tipo_pagamento === 'cartao_prazo';
            return <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${isCard ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-700'}`}>{label}</span>;
        }
        const label = d.tipo_pagamento === 'pix' ? 'PIX'
            : d.tipo_pagamento === 'dinheiro' ? 'Dinheiro'
            : d.tipo_pagamento === 'cartao' ? '💳 Cartão'
            : 'Transf.';
        const isCard = d.tipo_pagamento === 'cartao';
        return <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${isCard ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'}`}>{label}</span>;
    };

    return (
        <div>
            <div className="flex flex-wrap gap-2 items-center justify-between mb-5">
                <div className="flex flex-wrap gap-2">
                    <PrettySelect value={filtro.veiculoId} onChange={e => setFiltro(f => ({ ...f, veiculoId: e.target.value }))} className="px-3 py-2 rounded-lg border text-sm" style={inputStyle}>
                        <option value="">Todos veículos</option>
                        {veiculos.map(v => <option key={v.id} value={v.id}>{v.placa}</option>)}
                    </PrettySelect>
                    <PrettySelect value={filtro.categoria} onChange={e => setFiltro(f => ({ ...f, categoria: e.target.value }))} className="px-3 py-2 rounded-lg border text-sm" style={inputStyle}>
                        <option value="">Todas categorias</option>
                        {todasCategorias.map(c => <option key={c} value={c}>{c}</option>)}
                    </PrettySelect>
                    <input type="month" value={filtro.mes} onChange={e => { handleSetFiltroMes(e.target.value); setFiltro(f => ({ ...f, dia: '' })); setUsarPeriodo(false); }}
                        className="px-3 py-2 rounded-lg border text-sm" style={inputStyle} title="Filtrar por mês" />
                    <input type="date" value={filtro.dia || ''} onChange={e => { setFiltro(f => ({ ...f, dia: e.target.value })); handleSetFiltroMes(''); setUsarPeriodo(false); }}
                        className="px-3 py-2 rounded-lg border text-sm" style={inputStyle} title="Filtrar por dia específico" />
                    <button type="button" onClick={() => setUsarPeriodo(v => !v)}
                        className="px-2.5 py-2 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap"
                        style={usarPeriodo
                            ? { backgroundColor: '#EFF6FF', color: '#1D4ED8', borderColor: '#BFDBFE' }
                            : { borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                        {usarPeriodo ? '✓ Período ativo' : 'Usar período'}
                    </button>
                    {usarPeriodo && (
                        <>
                            <input type="date" value={periodoCustom.inicio} onChange={e => setPeriodoCustom(p => ({ ...p, inicio: e.target.value }))}
                                className="px-2.5 py-2 rounded-lg border text-sm" style={inputStyle} title="Data inicial" />
                            <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>até</span>
                            <input type="date" value={periodoCustom.fim} onChange={e => setPeriodoCustom(p => ({ ...p, fim: e.target.value }))}
                                className="px-2.5 py-2 rounded-lg border text-sm" style={inputStyle} title="Data final" />
                        </>
                    )}
                    {(filtro.mes || filtro.dia || usarPeriodo) && (
                        <button onClick={() => { handleSetFiltroMes(''); setFiltro(f => ({ ...f, dia: '' })); setUsarPeriodo(false); setPeriodoCustom({ inicio: '', fim: '' }); }}
                            className="px-2 py-1.5 rounded-lg border text-xs font-medium hover:bg-gray-50"
                            style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}
                            title="Limpar data">✕ Data</button>
                    )}
                    <SearchInput value={pesquisa} onChange={setPesquisa} placeholder="NF, nº boleto, fornecedor, placa..." width="240px" />
                </div>
                <div className="flex gap-2 flex-wrap">
                    <button onClick={load} className="p-2 rounded-lg border hover:bg-gray-50 transition-colors" style={{ borderColor: 'var(--color-border)' }} title="Atualizar">
                        <Icon name="RefreshCw" size={14} color="var(--color-muted-foreground)" />
                    </button>
                    <button onClick={exportar} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium hover:bg-gray-50 transition-colors" style={{ borderColor: 'var(--color-border)' }}>
                        <Icon name="FileDown" size={14} /> Exportar
                    </button>
                    <Button onClick={openCreate} iconName="Plus" size="sm">Nova Despesa</Button>
                </div>
            </div>

            {/* ── Sub-guias ── */}
            <div className="flex gap-1 mb-5 p-1 rounded-xl border" style={{ borderColor: 'var(--color-border)', backgroundColor: '#F9FAFB', width: 'fit-content' }}>
                {[
                    { id: 'registros',  label: 'Registros',        icon: 'Receipt' },
                    { id: 'parcelas',   label: 'Parcelas Futuras',  icon: 'Clock' },
                    { id: 'relatorio',  label: 'Pago / Em Aberto',  icon: 'BarChart2' },
                    { id: 'boletos',    label: 'Boletos',           icon: 'CalendarClock' },
                ].map(g => (
                    <button key={g.id} onClick={() => setGuiaDespesas(g.id)}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
                        style={guiaDespesas === g.id
                            ? { backgroundColor: 'white', color: '#DC2626', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', fontWeight: 600 }
                            : { color: 'var(--color-muted-foreground)' }}>
                        <Icon name={g.icon} size={14} color={guiaDespesas === g.id ? '#DC2626' : 'var(--color-muted-foreground)'} />
                        {g.label}
                    </button>
                ))}
            </div>

            {/* ══════════════════════════════════════════════════ */}
            {/* GUIA: REGISTROS                                    */}
            {/* ══════════════════════════════════════════════════ */}
            {guiaDespesas === 'registros' && (<TabRegistros
                    categoriasOpen={categoriasOpen}
                    despesasFiltradas={despesasFiltradas}
                    despesasPag={despesasPag}
                    handleDelete={handleDelete}
                    isAdmin={isAdmin}
                    loading={loading}
                    openEdit={openEdit}
                    pesquisa={pesquisa}
                    pgBadge={pgBadge}
                    setModalBaixa={setModalBaixa}
                    setViewDespesa={setViewDespesa}
                    toggleCategorias={toggleCategorias}
                    totalPeriodo={totalPeriodo}
                    totalPorCategoria={totalPorCategoria}
                />)}

            {/* ══════════════════════════════════════════════════ */}
            {/* GUIA: PARCELAS FUTURAS A VENCER                   */}
            {/* ══════════════════════════════════════════════════ */}
            {guiaDespesas === 'parcelas' && (
                <div className="space-y-4">
                    {parcelasFuturas.length === 0 ? (
                        <div className="flex flex-col items-center gap-2 py-16 text-center">
                            <Icon name="CheckCircle2" size={32} color="#059669" />
                            <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>Nenhuma parcela futura em aberto</p>
                            <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>Todas as parcelas estão pagas ou não há parcelas cadastradas.</p>
                        </div>
                    ) : (<>
                        <div className="grid grid-cols-2 gap-3 mb-2">
                            <div className="bg-white rounded-xl border p-4 shadow-sm" style={{ borderColor: '#FED7AA' }}>
                                <p className="text-xs mb-1" style={{ color: 'var(--color-muted-foreground)' }}>Total a vencer</p>
                                <p className="text-2xl font-bold font-data text-orange-600">{BRL(parcelasFuturas.reduce((s, m) => s + m.total, 0))}</p>
                            </div>
                            <div className="bg-white rounded-xl border p-4 shadow-sm" style={{ borderColor: '#FED7AA' }}>
                                <p className="text-xs mb-1" style={{ color: 'var(--color-muted-foreground)' }}>Meses com vencimentos</p>
                                <p className="text-2xl font-bold font-data text-orange-600">{parcelasFuturas.length}</p>
                            </div>
                        </div>
                        {parcelasFuturas.map(mes => (
                            <CardMesParcelas key={mes.mes} mes={mes} comVeiculo />
                        ))}
                    </>)}
                </div>
            )}

            {/* ══════════════════════════════════════════════════ */}
            {/* GUIA: RELATÓRIO PAGO / EM ABERTO                  */}
            {/* ══════════════════════════════════════════════════ */}
            {guiaDespesas === 'relatorio' && (
                <TabRelatorio relatorioPeriodo={relatorioPeriodo} relatorioStatus={relatorioStatus} setRelatorioPeriodo={setRelatorioPeriodo} />
            )}

            {/* ══════════════════════════════════════════════════ */}
            {/* GUIA: BOLETOS                                       */}
            {/* ══════════════════════════════════════════════════ */}
            {guiaDespesas === 'boletos' && <BoletosPainel origem="carretas" onChanged={load} />}

            {modal && isAdmin && (
                <ModalDespesa
                    modal={modal}
                    config={despesasCarretasConfig}
                    veiculos={veiculos}
                    despesasExistentes={despesas}
                    categorias={categorias}
                    onCategoriasChange={recarregarCategorias}
                    onClose={() => setModal(null)}
                    onSaved={load}
                />
            )}
            <Toast toast={toast} />
            {ConfirmDialog}
            {modalBaixa && (
                <ModalBaixa
                    despesa={modalBaixa}
                    config={despesasCarretasConfig}
                    onClose={() => setModalBaixa(null)}
                    onBaixado={() => { load(); setModalBaixa(null); }}
                    isAdmin={isAdmin}
                />
            )}
            {viewDespesa && (
                <ModalVisualizacaoDespesa
                    despesa={viewDespesa}
                    config={despesasCarretasConfig}
                    onClose={() => setViewDespesa(null)}
                    onAtualizado={load}
                    admin={isAdmin}
                />
            )}
        </div>
    );
}
