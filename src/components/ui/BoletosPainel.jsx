import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Icon from 'components/AppIcon';
import Toast from 'components/ui/Toast';
import { useToast } from 'utils/useToast';
import { useConfirm } from 'components/ui/ConfirmDialog';
import { fetchTodosBoletos, pagarBoletosEmMassa } from 'utils/boletosService';
import PeriodRangeFilter, { usePeriodRangeFilter } from 'components/ui/PeriodRangeFilter';

const BRL = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const FMT = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—';
const hojeISO = () => new Date().toISOString().slice(0, 10);

/**
 * BoletosPainel — aba de boletos "Lançados para baixa" dentro de cada tela de
 * despesas (Carretas, Caminhões, Adm. Transporte), mostrando só os boletos
 * daquele módulo (em vez do painel global misturado). Traz filtro de status,
 * filtro de período por data de vencimento, e baixa individual ou em massa.
 *
 * Uso: <BoletosPainel origem="carretas" />  (origem: 'carretas' | 'caminhoes' | 'adm')
 */
export default function BoletosPainel({ origem, onChanged }) {
    const { toast, showToast } = useToast();
    const { confirm, ConfirmDialog } = useConfirm();

    const [boletos, setBoletos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [processando, setProcessando] = useState(false);
    const [selecionados, setSelecionados] = useState(() => new Set());

    const [status, setStatus] = useState('vencidos'); // todos | pendentes | vencidos | pagos
    const [busca, setBusca] = useState('');
    const { preset: periodoPreset, periodo, onPresetChange: aplicarPreset, setPeriodo } = usePeriodRangeFilter('todos');

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const todos = await fetchTodosBoletos();
            setBoletos(todos.filter(b => b.origem === origem));
        } catch (e) { showToast('Erro ao carregar boletos: ' + e.message, 'error'); }
        finally { setLoading(false); }
    }, [origem]); // eslint-disable-line
    useEffect(() => { load(); }, [load]);

    const filtrados = useMemo(() => {
        const hoje = hojeISO();
        return boletos.filter(b => {
            if (status === 'pendentes' && b.pago) return false;
            if (status === 'vencidos' && (b.pago || !b.vencimento || b.vencimento >= hoje)) return false;
            if (status === 'pagos' && !b.pago) return false;
            if (periodo.inicio && (!b.vencimento || b.vencimento < periodo.inicio)) return false;
            if (periodo.fim && (!b.vencimento || b.vencimento > periodo.fim)) return false;
            if (busca.trim()) {
                const q = busca.trim().toLowerCase();
                const alvo = `${b.fornecedor} ${b.categoria} ${b.nota_fiscal} ${b.numero_boleto}`.toLowerCase();
                if (!alvo.includes(q)) return false;
            }
            return true;
        });
    }, [boletos, status, periodo, busca]);

    const totais = useMemo(() => {
        const hoje = hojeISO();
        let vencidosQtd = 0, vencidosValor = 0, pendentesQtd = 0, pendentesValor = 0, filtradoValor = 0;
        boletos.forEach(b => {
            if (!b.pago) {
                pendentesQtd++; pendentesValor += b.valor;
                if (b.vencimento && b.vencimento < hoje) { vencidosQtd++; vencidosValor += b.valor; }
            }
        });
        filtrados.forEach(b => { filtradoValor += b.valor; });
        return { vencidosQtd, vencidosValor, pendentesQtd, pendentesValor, filtradoValor };
    }, [boletos, filtrados]);

    const selecionaveisFiltrados = filtrados.filter(b => !b.pago);
    const todosFiltradosSelecionados = selecionaveisFiltrados.length > 0 && selecionaveisFiltrados.every(b => selecionados.has(b.key));

    const toggleSel = (key) => setSelecionados(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
    const toggleTodos = () => {
        if (todosFiltradosSelecionados) { setSelecionados(prev => { const n = new Set(prev); selecionaveisFiltrados.forEach(b => n.delete(b.key)); return n; }); return; }
        setSelecionados(prev => { const n = new Set(prev); selecionaveisFiltrados.forEach(b => n.add(b.key)); return n; });
    };

    const darBaixaUnica = async (b) => {
        setProcessando(true);
        try {
            await pagarBoletosEmMassa([b]);
            showToast('Boleto baixado!', 'success');
            setSelecionados(prev => { const n = new Set(prev); n.delete(b.key); return n; });
            load();
            onChanged && onChanged();
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
            onChanged && onChanged();
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
        finally { setProcessando(false); }
    };

    const inputCls = 'w-full px-3 py-2 rounded-lg border text-sm outline-none transition-all focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500';
    const inputStyle = { borderColor: 'var(--color-border)', color: 'var(--color-text-primary)', backgroundColor: 'transparent' };

    return (
        <div>
            {/* Cards de resumo */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
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
                </div>
                <div className="flex flex-wrap items-end gap-2">
                    <PeriodRangeFilter preset={periodoPreset} onPresetChange={aplicarPreset} periodo={periodo} onPeriodoChange={setPeriodo} label="Vencimento" />
                    <div className="flex-1 min-w-[200px]">
                        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por fornecedor, categoria, nota ou nº do boleto..."
                            className={inputCls} style={inputStyle} />
                    </div>
                    <button onClick={load} disabled={loading}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium hover:bg-gray-50 transition-colors disabled:opacity-50" style={{ borderColor: 'var(--color-border)' }}>
                        <Icon name="RefreshCw" size={14} /> Atualizar
                    </button>
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
                <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-3 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide" style={{ backgroundColor: '#F9FAFB', color: 'var(--color-muted-foreground)' }}>
                    <span>
                        <input type="checkbox" checked={todosFiltradosSelecionados} disabled={selecionaveisFiltrados.length === 0} onChange={toggleTodos} />
                    </span>
                    <span>Fornecedor / Categoria</span>
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
                            <div key={b.key} className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-3 px-4 py-3 items-center border-t text-sm" style={{ borderColor: 'var(--color-border)' }}>
                                <span>
                                    <input type="checkbox" checked={selecionados.has(b.key)} disabled={b.pago} onChange={() => toggleSel(b.key)} />
                                </span>
                                <span className="truncate">
                                    <p className="font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>{b.fornecedor || '—'}</p>
                                    <p className="text-xs truncate" style={{ color: 'var(--color-muted-foreground)' }}>{b.categoria}{b.nota_fiscal ? ` · NF ${b.nota_fiscal}` : ''}</p>
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
            <Toast toast={toast} />
            {ConfirmDialog}
        </div>
    );
}
