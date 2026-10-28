import React, { useState, useCallback, useEffect, useMemo } from 'react';

import * as XLSX from 'xlsx';

import { useToast } from 'hooks/useToast';
import { useConfirm, usePagination, PrettySelect, AppIcon as Icon, PaginationBar, Toast } from 'components';
import { useBonusConfig } from 'services/settingsService';
import { fetchCarregamentos, fetchAllRegistrosViagem, deleteRegistroViagem, calcularBonusCarreteiro } from 'services/carretas';
import { useRecarregarAoVoltar } from 'hooks/useRecarregarAoVoltar';

import { FMT_DATE, BRL } from '../../utils/helpers';
import { inputStyle } from '../../utils/constants';

// ─── TAB: Viagens ────────────────────────────────────────────────────────────
// ─── TAB: Viagens (Resumo de Carregamentos + Registros Motoristas) ────────────
// Fonte principal: carretas_carregamentos (lançados via aba Volume)
// Sem formulário de criação manual — o admin é direcionado para a aba Volume.
export default function TabViagens({ isAdmin }) {
    const { toast, showToast } = useToast();
    const { confirm, ConfirmDialog } = useConfirm();
    const { bonusConfig } = useBonusConfig();
    const [carregamentos, setCarregamentos] = useState([]);
    const [registrosMotoristas, setRegistrosMotoristas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [abaViagens, setAbaViagens] = useState('carregamentos'); // 'carregamentos' | 'motoristas'

    // Iniciar no mês atual; persistir seleção na sessão (limpa ao recarregar)
    const mesAtualStr = (() => {
        const h = new Date();
        return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}`;
    })();
    const [filtroMes, setFiltroMes] = useState(() => {
        try { return sessionStorage.getItem('viagens_filtroMes') || mesAtualStr; } catch { return mesAtualStr; }
    });
    const [filtroDia, setFiltroDia] = useState(() => {
        try { return sessionStorage.getItem('viagens_filtroDia') || ''; } catch { return ''; }
    });
    // Filtro por período (data inicial/final personalizadas) — mesmo padrão
    // já usado na aba Bonificações.
    const [usarPeriodo, setUsarPeriodo] = useState(false);
    const [periodoCustom, setPeriodoCustom] = useState({ inicio: '', fim: '' });

    // Persiste na sessão quando muda
    const handleSetFiltroMes = (v) => {
        setFiltroMes(v);
        try { if (v) sessionStorage.setItem('viagens_filtroMes', v); else sessionStorage.removeItem('viagens_filtroMes'); } catch {}
    };
    const handleSetFiltroDia = (v) => {
        setFiltroDia(v);
        try { if (v) sessionStorage.setItem('viagens_filtroDia', v); else sessionStorage.removeItem('viagens_filtroDia'); } catch {}
    };

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const f = {};
            if (usarPeriodo && (periodoCustom.inicio || periodoCustom.fim)) {
                if (periodoCustom.inicio) f.dataInicio = periodoCustom.inicio;
                if (periodoCustom.fim)    f.dataFim    = periodoCustom.fim;
            } else if (filtroDia) {
                f.dataInicio = filtroDia;
                f.dataFim    = filtroDia;
            } else if (filtroMes) {
                const [yr, mo] = filtroMes.split('-');
                const lastDay = new Date(+yr, +mo, 0).getDate();
                f.dataInicio = `${filtroMes}-01`;
                f.dataFim    = `${filtroMes}-${String(lastDay).padStart(2, '0')}`;
            }
            const [c, regs] = await Promise.all([
                fetchCarregamentos({ ...f, is_terceiro: false }),
                isAdmin ? fetchAllRegistrosViagem(f) : Promise.resolve([]), // fix: passa filtros de data
            ]);
            setCarregamentos(c);
            setRegistrosMotoristas(regs);

        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
        finally { setLoading(false); }
    }, [filtroMes, filtroDia, isAdmin, usarPeriodo, periodoCustom]); // eslint-disable-line

    useEffect(() => { load(); }, [load]);
    useRecarregarAoVoltar(load);

    const handleDeleteRegistroMotorista = async (id) => {
        const ok = await confirm({ title: 'Excluir registro?', message: 'Este registro lançado pelo motorista será excluído permanentemente.', confirmLabel: 'Excluir', variant: 'danger' });
        if (!ok) return;
        try { await deleteRegistroViagem(id); showToast('Registro excluído com sucesso.', 'success'); load(); }
        catch (e) { showToast('Erro ao excluir: ' + e.message, 'error'); }
    };

    // CIF: apenas volume — excluir completamente da aba Viagens
    const isCIF = (c) => {
        const orig = (c.empresa_origem || '').toUpperCase();
        return orig.startsWith('CIF_') || orig.includes('|CIF_');
    };

    const [pesquisa, setPesquisa] = useState('');
    const [filtroPlaca, setFiltroPlaca] = useState('');

    // Placas disponíveis para o filtro, extraídas dos dados já carregados
    const placasDisponiveis = useMemo(() => {
        const set = new Set();
        carregamentos.forEach(c => { if (c.veiculo?.placa) set.add(c.veiculo.placa); else if (c.placa_terceiro) set.add(c.placa_terceiro); });
        registrosMotoristas.forEach(r => r.veiculo?.placa && set.add(r.veiculo.placa));
        return Array.from(set).sort();
    }, [carregamentos, registrosMotoristas]);

    const carregamentosComBonus = useMemo(() => {
        const base = carregamentos
            .filter(c => !isCIF(c))
            // Carregamentos avulsos de caminhão da frota (fora da frota de
            // carretas — ex: Montes Claros) não geram bônus de carreteiro:
            // marcados por não ter veiculo_id de carreta mas ter placa_terceiro.
            .filter(c => !(!c.veiculo_id && c.placa_terceiro))
            .filter(c => !filtroPlaca || c.veiculo?.placa === filtroPlaca || c.placa_terceiro === filtroPlaca)
            .map(c => ({ ...c, bonus: calcularBonusCarreteiro(c.destino, bonusConfig) }));
        if (!pesquisa.trim()) return base;
        const q = pesquisa.trim().toLowerCase();
        return base.filter(c =>
            (c.numero_pedido || '').toLowerCase().includes(q) ||
            (c.numero_nota_fiscal || '').toLowerCase().includes(q) ||
            (c.motorista?.name || '').toLowerCase().includes(q) ||
            (c.destino || '').toLowerCase().includes(q) ||
            (c.veiculo?.placa || c.placa_terceiro || '').toLowerCase().includes(q)
        );
    }, [carregamentos, pesquisa, filtroPlaca, bonusConfig]); // eslint-disable-line

    const registrosMotoristasFiltrados = useMemo(() => {
        let base = registrosMotoristas;
        if (filtroPlaca) base = base.filter(r => r.veiculo?.placa === filtroPlaca);
        if (!pesquisa.trim()) return base;
        const q = pesquisa.trim().toLowerCase();
        return base.filter(r =>
            (r.motorista?.name || '').toLowerCase().includes(q) ||
            (r.numero_nota_fiscal || '').toLowerCase().includes(q) ||
            (r.destino || '').toLowerCase().includes(q) ||
            (r.veiculo?.placa || '').toLowerCase().includes(q)
        );
    }, [registrosMotoristas, pesquisa, filtroPlaca]);

    const carregamentosCarreta = useMemo(() =>
        carregamentosComBonus.filter(c => !c.is_terceiro && !c.motorista?.is_terceiro),
    [carregamentosComBonus]);
    const carregamentosPag = usePagination(carregamentosCarreta, 15, [carregamentosCarreta.length, pesquisa, filtroPlaca]);
    const registrosMotoristasPag = usePagination(registrosMotoristasFiltrados, 15, [registrosMotoristasFiltrados.length, pesquisa, filtroPlaca]);

    const exportar = () => {
        const wb = XLSX.utils.book_new();
        if (carregamentosComBonus.length) {
            const rows = carregamentosComBonus.map(c => ({
                'Data': FMT_DATE(c.data_carregamento),
                'Motorista': c.motorista?.name || '',
                'Placa': c.veiculo?.placa || c.placa_terceiro || '',
                'Empresa': c.empresa?.nome || '',
                'Destino': c.destino || '',
                'Qtd (sacos)': c.quantidade || 0,
                'Frete (R$)': Number(c.valor_frete_calculado || 0),
                'Bônus (R$)': calcularBonusCarreteiro(c.destino, bonusConfig),
                'Pedido': c.numero_pedido || '',
                'NF': c.numero_nota_fiscal || '',
            }));
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Carregamentos');
        }
        if (registrosMotoristasFiltrados.length) {
            const rows2 = registrosMotoristasFiltrados.map(r => ({
                'Motorista': r.motorista?.name || '', 'Placa': r.veiculo?.placa || '',
                'Data Carregamento': FMT_DATE(r.data_carregamento), 'NF': r.numero_nota_fiscal || '',
                'Destino': r.destino || '', 'Data Descarga': FMT_DATE(r.data_descarga), 'Obs': r.observacoes || '',
            }));
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows2), 'Registros Motoristas');
        }
        if (!carregamentosComBonus.length && !registrosMotoristasFiltrados.length) { showToast('Nenhum dado para exportar.', 'error'); return; }
        XLSX.writeFile(wb, `viagens_carretas_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.xlsx`);
        showToast('Exportado!', 'success');
    };

    return (
        <div>
            {/* ── Toolbar ── */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                <div className="flex flex-wrap gap-2 items-center">
                    {/* Sub-abas */}
                    <div className="flex gap-1 p-1 rounded-xl" style={{ backgroundColor: 'var(--color-muted)' }}>
                        {[
                        { id: 'carregamentos', label: 'Carregamentos', count: carregamentosCarreta.length },
                            { id: 'motoristas',    label: 'Viagens lançadas pelos motoristas', count: registrosMotoristasFiltrados.length },
                        ].map(s => (
                            <button key={s.id} onClick={() => setAbaViagens(s.id)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                                style={abaViagens === s.id
                                    ? { backgroundColor: '#fff', color: 'var(--color-primary)', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }
                                    : { color: 'var(--color-muted-foreground)' }}>
                                {s.label}
                                <span className="px-1.5 py-0.5 rounded-full text-xs font-bold"
                                    style={{ backgroundColor: abaViagens === s.id ? '#DBEAFE' : 'transparent', color: abaViagens === s.id ? '#1D4ED8' : 'var(--color-muted-foreground)' }}>
                                    {s.count}
                                </span>
                            </button>
                        ))}
                    </div>
                    <input type="month" value={filtroMes} onChange={e => { handleSetFiltroMes(e.target.value); handleSetFiltroDia(''); setUsarPeriodo(false); }}
                        className="px-3 py-2 rounded-lg border text-sm" style={inputStyle} title="Filtrar por mês" />
                    <input type="date" value={filtroDia} onChange={e => { handleSetFiltroDia(e.target.value); handleSetFiltroMes(''); setUsarPeriodo(false); }}
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
                    {(filtroMes || filtroDia || usarPeriodo) && (
                        <button onClick={() => { handleSetFiltroMes(''); handleSetFiltroDia(''); setUsarPeriodo(false); setPeriodoCustom({ inicio: '', fim: '' }); }}
                            className="px-2 py-1.5 rounded-lg border text-xs font-medium hover:bg-gray-50"
                            style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}
                            title="Limpar data">✕ Data</button>
                    )}
                    <PrettySelect value={filtroPlaca} onChange={e => setFiltroPlaca(e.target.value)}
                        className="px-3 py-2 rounded-lg border text-sm" style={inputStyle} title="Filtrar por placa">
                        <option value="">Todas as placas</option>
                        {placasDisponiveis.map(p => <option key={p} value={p}>{p}</option>)}
                    </PrettySelect>
                    {/* ── Barra de pesquisa ── */}
                    <div className="relative">
                        <Icon name="Search" size={13} color="var(--color-muted-foreground)"
                            style={{ position:'absolute', left:'9px', top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }} />
                        <input
                            type="text" value={pesquisa} onChange={e => setPesquisa(e.target.value)}
                            placeholder="Pedido, NF, motorista, destino, placa..."
                            className="pl-7 pr-7 py-2 rounded-lg border text-xs"
                            style={{ borderColor:'var(--color-border)', backgroundColor:'var(--color-background)', color:'var(--color-text-primary)', minWidth:'260px' }}
                        />
                        {pesquisa && (
                            <button onClick={() => setPesquisa('')}
                                style={{ position:'absolute', right:'7px', top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'var(--color-muted-foreground)', fontSize:'13px', lineHeight:1 }}>✕</button>
                        )}
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={load} className="p-2 rounded-lg border hover:bg-gray-50 transition-colors" style={{ borderColor: 'var(--color-border)' }} title="Atualizar">
                        <Icon name="RefreshCw" size={14} color="var(--color-muted-foreground)" />
                    </button>
                    <button onClick={exportar} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium hover:bg-gray-50 transition-colors" style={{ borderColor: 'var(--color-border)' }}>
                        <Icon name="FileDown" size={14} /> Exportar
                    </button>
                    {/* Direciona para aba Volume em vez de abrir formulário */}
                    {isAdmin && (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium"
                            style={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE', color: '#1D4ED8' }}>
                            <Icon name="Info" size={13} color="#1D4ED8" />
                            Para lançar, use a aba <strong>Volume de Carregamento</strong>
                        </div>
                    )}
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-16">
                    <div className="animate-spin h-7 w-7 rounded-full border-4" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
                </div>
            ) : (
                <>
                    {/* ── Sub-aba: Resumo de Carregamentos ── */}
                    {abaViagens === 'carregamentos' && (
                        <div className="bg-white rounded-xl border shadow-sm overflow-x-auto" style={{ borderColor: 'var(--color-border)' }}>
                            <table className="w-full text-sm min-w-[700px]">
                                <thead className="text-xs border-b" style={{ backgroundColor: 'var(--color-muted)', borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                                    <tr>{['Data','Motorista','Placa','Empresa','Destino','Qtd (sacos)','Frete','Bônus'].map(h => (
                                        <th key={h} className="px-3 py-3 text-left font-medium whitespace-nowrap">{h}</th>
                                    ))}</tr>
                                </thead>
                                <tbody>
                                    {carregamentosComBonus.length === 0 ? (
                                        <tr><td colSpan={8} className="text-center py-12" style={{ color: 'var(--color-muted-foreground)' }}>
                                            <div className="flex flex-col items-center gap-2">
                                                <Icon name="Package" size={28} color="var(--color-muted-foreground)" />
                                                <span className="text-sm">Nenhum carregamento no período. Lance pela aba <strong>Volume de Carregamento</strong>.</span>
                                            </div>
                                        </td></tr>
                                    ) : carregamentosPag.pageItems.map((c, i) => (
                                        <tr key={c.id} className="border-t hover:bg-gray-50 transition-colors"
                                            style={{ borderColor: 'var(--color-border)', backgroundColor: i % 2 === 0 ? '#fff' : '#F8FAFC' }}>
                                            <td className="px-3 py-3 whitespace-nowrap">{FMT_DATE(c.data_carregamento)}</td>
                                            <td className="px-3 py-3 font-medium whitespace-nowrap">{c.motorista?.name || '—'}</td>
                                            <td className="px-3 py-3 font-data whitespace-nowrap">{c.veiculo?.placa || c.placa_terceiro || '—'}</td>
                                            <td className="px-3 py-3 text-xs">{c.empresa?.nome || '—'}</td>
                                            <td className="px-3 py-3 max-w-[140px] truncate">{c.destino || '—'}</td>
                                            <td className="px-3 py-3 font-data text-right font-semibold" style={{ color: 'var(--color-primary)' }}>
                                                {(Number(c.quantidade) || 0).toLocaleString('pt-BR')}
                                            </td>
                                            <td className="px-3 py-3 font-data text-right text-purple-600 font-semibold">{BRL(c.valor_frete_calculado)}</td>
                                            <td className="px-3 py-3 font-data text-right font-semibold" style={{ color: '#059669' }}>
                                                {c.destino ? BRL(calcularBonusCarreteiro(c.destino, bonusConfig)) : '—'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <PaginationBar page={carregamentosPag.page} setPage={carregamentosPag.setPage} totalPages={carregamentosPag.totalPages}
                                totalItems={carregamentosPag.totalItems} pageSize={carregamentosPag.pageSize} itemLabel="carregamento" itemLabelPlural="carregamentos" />
                        </div>
                    )}

                    {/* ── Sub-aba: Lançados pelos Motoristas ── */}
                    {abaViagens === 'motoristas' && (
                        <div>
                            <div className="flex items-center gap-2 mb-3 p-3 rounded-xl" style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                                <Icon name="Info" size={14} color="#15803D" />
                                <p className="text-xs" style={{ color: '#15803D' }}>
                                    Registros auto-reportados pelos motoristas de carreta. Use para confirmar destinos e notas fiscais.
                                </p>
                            </div>
                            <div className="bg-white rounded-xl border shadow-sm overflow-x-auto" style={{ borderColor: 'var(--color-border)' }}>
                                <table className="w-full text-sm min-w-[750px]">
                                    <thead className="text-xs border-b" style={{ backgroundColor: '#F0FDF4', borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                                        <tr>{['Motorista','Placa','Data Carregamento','Nota Fiscal','Destino','Data Descarga','Observações','Ações'].map(h => (
                                            <th key={h} className="px-3 py-3 text-left font-medium whitespace-nowrap">{h}</th>
                                        ))}</tr>
                                    </thead>
                                    <tbody>
                                        {registrosMotoristasFiltrados.length === 0 ? (
                                            <tr><td colSpan={8} className="text-center py-12" style={{ color: 'var(--color-muted-foreground)' }}>
                                                <div className="flex flex-col items-center gap-2">
                                                    <Icon name="Truck" size={28} color="var(--color-muted-foreground)" />
                                                    <span className="text-sm">{pesquisa ? `Nenhum resultado para "${pesquisa}"` : 'Nenhum registro lançado pelos motoristas ainda'}</span>
                                                </div>
                                            </td></tr>
                                        ) : registrosMotoristasPag.pageItems.map((r, i) => (
                                            <tr key={r.id} className="border-t hover:bg-gray-50 transition-colors"
                                                style={{ borderColor: 'var(--color-border)', backgroundColor: i % 2 === 0 ? '#fff' : '#F8FAFC' }}>
                                                <td className="px-3 py-3 font-medium whitespace-nowrap">{r.motorista?.name || '—'}</td>
                                                <td className="px-3 py-3 font-data whitespace-nowrap">{r.veiculo?.placa || '—'}</td>
                                                <td className="px-3 py-3 whitespace-nowrap">{FMT_DATE(r.data_carregamento)}</td>
                                                <td className="px-3 py-3 font-data whitespace-nowrap text-blue-700">{r.numero_nota_fiscal || '—'}</td>
                                                <td className="px-3 py-3 max-w-[160px] truncate font-medium" style={{ color: 'var(--color-text-primary)' }}>{r.destino || '—'}</td>
                                                <td className="px-3 py-3 whitespace-nowrap">{r.data_descarga ? FMT_DATE(r.data_descarga) : <span style={{ color: 'var(--color-muted-foreground)' }}>Em trânsito</span>}</td>
                                                <td className="px-3 py-3 max-w-[180px] truncate text-xs" style={{ color: 'var(--color-muted-foreground)' }}>{r.observacoes || '—'}</td>
                                                <td className="px-3 py-3 whitespace-nowrap">
                                                    <button onClick={() => handleDeleteRegistroMotorista(r.id)} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-red-200 text-red-600 hover:bg-red-50 transition-colors">
                                                        <Icon name="Trash2" size={16} />Excluir
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                <PaginationBar page={registrosMotoristasPag.page} setPage={registrosMotoristasPag.setPage} totalPages={registrosMotoristasPag.totalPages}
                                    totalItems={registrosMotoristasPag.totalItems} pageSize={registrosMotoristasPag.pageSize} itemLabel="registro" itemLabelPlural="registros" />
                            </div>
                        </div>
                    )}
                </>
            )}
            <Toast toast={toast} />
            {ConfirmDialog}
        </div>
    );
}
