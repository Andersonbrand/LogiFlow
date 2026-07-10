import React, { useState, useEffect, useMemo, useCallback } from 'react';
import NavigationBar from 'components/ui/NavigationBar';
import BreadcrumbTrail from 'components/ui/BreadcrumbTrail';
import Icon from 'components/AppIcon';
import Toast from 'components/ui/Toast';
import { useToast } from 'utils/useToast';
import { useConfirm } from 'components/ui/ConfirmDialog';
import { fetchTodosBoletos, pagarBoletosEmMassa, ORIGEM_LABEL } from 'utils/boletosService';

const BRL = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const FMT = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—';
const hojeISO = () => new Date().toISOString().slice(0, 10);
const inputCls = 'w-full px-3 py-2 rounded-lg border text-sm outline-none transition-all focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500';
const inputStyle = { borderColor: 'var(--color-border)', color: 'var(--color-text-primary)', backgroundColor: 'transparent' };

const ORIGEM_COR = { carretas: '#7C3AED', caminhoes: '#2563EB', adm: '#059669' };

export default function Boletos() {
    const { toast, showToast } = useToast();
    const { confirm, ConfirmDialog } = useConfirm();

    const [boletos, setBoletos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [processando, setProcessando] = useState(false);
    const [selecionados, setSelecionados] = useState(() => new Set());

    const [status, setStatus] = useState('vencidos'); // todos | pendentes | vencidos | pagos
    const [origem, setOrigem] = useState('');          // '' | carretas | caminhoes | adm
    const [busca, setBusca] = useState('');
    const [periodoPreset, setPeriodoPreset] = useState('todos'); // todos | hoje | mes | mes_passado | personalizado
    const [periodo, setPeriodo] = useState({ inicio: '', fim: '' });

    const load = useCallback(async () => {
        setLoading(true);
        try { setBoletos(await fetchTodosBoletos()); }
        catch (e) { showToast('Erro ao carregar boletos: ' + e.message, 'error'); }
        finally { setLoading(false); }
    }, []); // eslint-disable-line
    useEffect(() => { load(); }, [load]);

    // Presets de período aplicados sobre a data de vencimento
    const aplicarPreset = (preset) => {
        setPeriodoPreset(preset);
        const h = new Date(); h.setHours(0, 0, 0, 0);
        const y = h.getFullYear(), m = h.getMonth();
        const pad = n => String(n).padStart(2, '0');
        if (preset === 'hoje') {
            const d = `${y}-${pad(m + 1)}-${pad(h.getDate())}`;
            setPeriodo({ inicio: d, fim: d });
        } else if (preset === 'mes') {
            setPeriodo({ inicio: `${y}-${pad(m + 1)}-01`, fim: `${y}-${pad(m + 1)}-${pad(new Date(y, m + 1, 0).getDate())}` });
        } else if (preset === 'mes_passado') {
            const mp = new Date(y, m - 1, 1);
            setPeriodo({ inicio: `${mp.getFullYear()}-${pad(mp.getMonth() + 1)}-01`, fim: `${mp.getFullYear()}-${pad(mp.getMonth() + 1)}-${pad(new Date(mp.getFullYear(), mp.getMonth() + 1, 0).getDate())}` });
        } else {
            setPeriodo({ inicio: '', fim: '' });
        }
    };

    const filtrados = useMemo(() => {
        const hoje = hojeISO();
        const q = busca.trim().toLowerCase();
        return boletos.filter(b => {
            const vencido = !b.pago && b.vencimento && b.vencimento < hoje;
            if (status === 'pendentes' && b.pago) return false;
            if (status === 'vencidos' && !vencido) return false;
            if (status === 'pagos' && !b.pago) return false;
            if (origem && b.origem !== origem) return false;
            if (periodo.inicio && (!b.vencimento || b.vencimento < periodo.inicio)) return false;
            if (periodo.fim && (!b.vencimento || b.vencimento > periodo.fim)) return false;
            if (q && !(
                (b.fornecedor || '').toLowerCase().includes(q) ||
                (b.categoria || '').toLowerCase().includes(q) ||
                (b.numero_boleto || '').toLowerCase().includes(q) ||
                (b.nota_fiscal || '').toLowerCase().includes(q)
            )) return false;
            return true;
        });
    }, [boletos, status, origem, periodo, busca]);

    const totais = useMemo(() => {
        const hoje = hojeISO();
        const vencidos = boletos.filter(b => !b.pago && b.vencimento && b.vencimento < hoje);
        const pendentes = boletos.filter(b => !b.pago);
        return {
            vencidosQtd: vencidos.length, vencidosValor: vencidos.reduce((s, b) => s + b.valor, 0),
            pendentesQtd: pendentes.length, pendentesValor: pendentes.reduce((s, b) => s + b.valor, 0),
            filtradoValor: filtrados.reduce((s, b) => s + b.valor, 0),
        };
    }, [boletos, filtrados]);

    const toggleSel = (key) => setSelecionados(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
    const selecionaveisFiltrados = useMemo(() => filtrados.filter(b => !b.pago), [filtrados]);
    const todosFiltradosSelecionados = selecionaveisFiltrados.length > 0 && selecionaveisFiltrados.every(b => selecionados.has(b.key));
    const toggleTodos = () => {
        setSelecionados(prev => {
            if (todosFiltradosSelecionados) {
                const n = new Set(prev); selecionaveisFiltrados.forEach(b => n.delete(b.key)); return n;
            }
            const n = new Set(prev); selecionaveisFiltrados.forEach(b => n.add(b.key)); return n;
        });
    };

    const darBaixaUnica = async (b) => {
        setProcessando(true);
        try {
            await pagarBoletosEmMassa([b]);
            showToast('Boleto baixado!', 'success');
            setSelecionados(prev => { const n = new Set(prev); n.delete(b.key); return n; });
            load();
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
        finally { setProcessando(false); }
    };

    const darBaixaEmMassa = async () => {
        const itens = boletos.filter(b => selecionados.has(b.key));
        if (itens.length === 0) return;
        const ok = await confirm({
            title: 'Dar baixa em massa?',
            message: `Confirmar baixa de ${itens.length} boleto(s), totalizando ${BRL(itens.reduce((s, b) => s + b.valor, 0))}?`,
            confirmLabel: 'Dar baixa', variant: 'default',
        });
        if (!ok) return;
        setProcessando(true);
        try {
            const qtd = await pagarBoletosEmMassa(itens);
            showToast(`${qtd} boleto(s) baixado(s)!`, 'success');
            setSelecionados(new Set());
            load();
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
        finally { setProcessando(false); }
    };

    return (
        <div className="min-h-screen" style={{ backgroundColor: 'var(--color-background)' }}>
            <NavigationBar />
            <main className="main-content">
                <div className="max-w-screen-2xl mx-auto px-4 lg:px-8 py-6">
                    <BreadcrumbTrail className="mb-4" />

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                        <div>
                            <h1 className="font-heading font-bold text-2xl md:text-3xl flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
                                <Icon name="CalendarClock" size={28} color="#DC2626" /> Boletos
                            </h1>
                            <p className="text-sm mt-1" style={{ color: 'var(--color-muted-foreground)' }}>
                                Visão consolidada de boletos de Carretas, Caminhões e Despesas Administrativas
                            </p>
                        </div>
                        <button onClick={load} disabled={loading}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium hover:bg-gray-50 transition-colors disabled:opacity-50" style={{ borderColor: 'var(--color-border)' }}>
                            <Icon name="RefreshCw" size={14} /> Atualizar
                        </button>
                    </div>

                    {/* Cards de resumo */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                        <div className="p-4 rounded-2xl border" style={{ borderColor: '#FECACA', backgroundColor: '#FEF2F2' }}>
                            <p className="text-xs font-medium text-red-700 mb-1">Vencidos</p>
                            <p className="text-2xl font-bold text-red-700">{totais.vencidosQtd}</p>
                            <p className="text-xs text-red-600">{BRL(totais.vencidosValor)}</p>
                        </div>
                        <div className="p-4 rounded-2xl border" style={{ borderColor: '#FDE68A', backgroundColor: '#FFFBEB' }}>
                            <p className="text-xs font-medium text-amber-700 mb-1">Pendentes (total)</p>
                            <p className="text-2xl font-bold text-amber-700">{totais.pendentesQtd}</p>
                            <p className="text-xs text-amber-600">{BRL(totais.pendentesValor)}</p>
                        </div>
                        <div className="p-4 rounded-2xl border" style={{ borderColor: 'var(--color-border)' }}>
                            <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-muted-foreground)' }}>Total no filtro atual</p>
                            <p className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>{filtrados.length}</p>
                            <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>{BRL(totais.filtradoValor)}</p>
                        </div>
                    </div>

                    {/* Filtros */}
                    <div className="p-4 rounded-2xl border mb-4 space-y-3" style={{ borderColor: 'var(--color-border)' }}>
                        <div className="flex flex-wrap gap-2">
                            {[
                                { v: 'vencidos', label: 'Vencidos' },
                                { v: 'pendentes', label: 'Pendentes' },
                                { v: 'pagos', label: 'Pagos' },
                                { v: 'todos', label: 'Todos' },
                            ].map(op => (
                                <button key={op.v} onClick={() => setStatus(op.v)}
                                    className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors"
                                    style={status === op.v
                                        ? { backgroundColor: '#1D4ED8', color: '#fff', borderColor: '#1D4ED8' }
                                        : { borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}>
                                    {op.label}
                                </button>
                            ))}
                            <span className="w-px h-6 self-center" style={{ backgroundColor: 'var(--color-border)' }} />
                            {[
                                { v: '', label: 'Todos módulos' },
                                { v: 'carretas', label: 'Carretas' },
                                { v: 'caminhoes', label: 'Caminhões' },
                                { v: 'adm', label: 'Administrativo' },
                            ].map(op => (
                                <button key={op.v} onClick={() => setOrigem(op.v)}
                                    className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors"
                                    style={origem === op.v
                                        ? { backgroundColor: ORIGEM_COR[op.v] || '#374151', color: '#fff', borderColor: ORIGEM_COR[op.v] || '#374151' }
                                        : { borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}>
                                    {op.label}
                                </button>
                            ))}
                        </div>

                        <div className="flex flex-wrap items-end gap-2">
                            <div className="flex gap-1.5">
                                {[
                                    { v: 'todos', label: 'Sem filtro de data' },
                                    { v: 'hoje', label: 'Hoje' },
                                    { v: 'mes', label: 'Este mês' },
                                    { v: 'mes_passado', label: 'Mês passado' },
                                    { v: 'personalizado', label: 'Período' },
                                ].map(op => (
                                    <button key={op.v} onClick={() => aplicarPreset(op.v)}
                                        className="px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors"
                                        style={periodoPreset === op.v
                                            ? { backgroundColor: '#EFF6FF', color: '#1D4ED8', borderColor: '#BFDBFE' }
                                            : { borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                                        {op.label}
                                    </button>
                                ))}
                            </div>
                            {periodoPreset === 'personalizado' && (
                                <div className="flex items-center gap-2">
                                    <div>
                                        <label className="text-[11px] block mb-0.5" style={{ color: 'var(--color-muted-foreground)' }}>Vencimento de</label>
                                        <input type="date" value={periodo.inicio} onChange={e => setPeriodo(p => ({ ...p, inicio: e.target.value }))} className={inputCls} style={inputStyle} />
                                    </div>
                                    <div>
                                        <label className="text-[11px] block mb-0.5" style={{ color: 'var(--color-muted-foreground)' }}>até</label>
                                        <input type="date" value={periodo.fim} onChange={e => setPeriodo(p => ({ ...p, fim: e.target.value }))} className={inputCls} style={inputStyle} />
                                    </div>
                                </div>
                            )}
                            <div className="flex-1 min-w-[200px]">
                                <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por fornecedor, categoria, nota ou nº do boleto..."
                                    className={inputCls} style={inputStyle} />
                            </div>
                        </div>
                    </div>

                    {/* Ações em massa */}
                    {selecionados.size > 0 && (
                        <div className="flex items-center justify-between gap-3 p-3 rounded-xl mb-3" style={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE' }}>
                            <p className="text-sm font-medium text-blue-800">{selecionados.size} boleto(s) selecionado(s)</p>
                            <div className="flex gap-2">
                                <button onClick={() => setSelecionados(new Set())} className="text-xs font-medium text-gray-600 hover:underline">Limpar seleção</button>
                                <button onClick={darBaixaEmMassa} disabled={processando}
                                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-60">
                                    <Icon name={processando ? 'Loader' : 'CheckCheck'} size={13} /> Dar baixa em massa
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Lista */}
                    <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
                        <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto_auto] gap-3 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide" style={{ backgroundColor: '#F9FAFB', color: 'var(--color-muted-foreground)' }}>
                            <span>
                                <input type="checkbox" checked={todosFiltradosSelecionados} disabled={selecionaveisFiltrados.length === 0} onChange={toggleTodos} />
                            </span>
                            <span>Fornecedor / Categoria</span>
                            <span>Módulo</span>
                            <span>Nº Boleto</span>
                            <span>Vencimento</span>
                            <span>Valor</span>
                            <span>Status</span>
                        </div>
                        {loading ? (
                            <p className="p-6 text-sm text-center" style={{ color: 'var(--color-muted-foreground)' }}>Carregando boletos...</p>
                        ) : filtrados.length === 0 ? (
                            <p className="p-6 text-sm text-center" style={{ color: 'var(--color-muted-foreground)' }}>Nenhum boleto encontrado com esses filtros.</p>
                        ) : (
                            filtrados.map(b => {
                                const vencido = !b.pago && b.vencimento && b.vencimento < hojeISO();
                                return (
                                    <div key={b.key} className="grid grid-cols-[auto_1fr_auto_auto_auto_auto_auto] gap-3 px-4 py-3 items-center border-t text-sm" style={{ borderColor: 'var(--color-border)' }}>
                                        <span>
                                            <input type="checkbox" checked={selecionados.has(b.key)} disabled={b.pago} onChange={() => toggleSel(b.key)} />
                                        </span>
                                        <span className="truncate">
                                            <p className="font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>{b.fornecedor || '—'}</p>
                                            <p className="text-xs truncate" style={{ color: 'var(--color-muted-foreground)' }}>{b.categoria}{b.nota_fiscal ? ` · NF ${b.nota_fiscal}` : ''}</p>
                                        </span>
                                        <span className="text-xs font-medium px-2 py-1 rounded-md whitespace-nowrap" style={{ color: ORIGEM_COR[b.origem], backgroundColor: `${ORIGEM_COR[b.origem]}1A` }}>
                                            {ORIGEM_LABEL[b.origem]?.replace('Despesas — ', '')}
                                        </span>
                                        <span className="font-data whitespace-nowrap">{b.numero_boleto || '—'}</span>
                                        <span className={`whitespace-nowrap ${vencido ? 'text-red-600 font-semibold' : ''}`}>{FMT(b.vencimento)}</span>
                                        <span className="font-semibold whitespace-nowrap" style={{ color: 'var(--color-text-primary)' }}>{BRL(b.valor)}</span>
                                        <span className="flex items-center gap-2 justify-end">
                                            {b.pago ? (
                                                <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-green-100 text-green-700 whitespace-nowrap">Pago</span>
                                            ) : (
                                                <>
                                                    {vencido && <span className="px-2 py-1 rounded-lg text-xs font-medium bg-red-100 text-red-700 whitespace-nowrap">Vencido</span>}
                                                    <button onClick={() => darBaixaUnica(b)} disabled={processando}
                                                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-60 whitespace-nowrap">
                                                        <Icon name="Check" size={12} /> Dar baixa
                                                    </button>
                                                </>
                                            )}
                                        </span>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </main>
            <Toast toast={toast} />
            {ConfirmDialog}
        </div>
    );
}
