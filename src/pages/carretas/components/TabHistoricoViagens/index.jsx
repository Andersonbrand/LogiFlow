import React, { useState, useCallback, useEffect, useMemo } from 'react';

import * as XLSX from 'xlsx';

import { useToast } from 'hooks/useToast';
import { fetchViagens, fetchRomaneios, fetchCarregamentos, fetchTodosMotoristas, fetchCarretasVeiculos } from 'services/carretas';
import { useRecarregarAoVoltar } from 'hooks/useRecarregarAoVoltar';
import { useCollapsible, usePagination, PrettySelect, AppIcon as Icon, CollapseChevron, PaginationBar, Toast, SearchInput } from 'components';

import { FMT_DATE } from '../../utils/helpers';
import { inputStyle } from '../../utils/constants';
import IsExpandido from './components/IsExpandido';

// ─── PÁGINA PRINCIPAL ─────────────────────────────────────────────────────────
// ─── TAB: Histórico de Rotas por Motorista ───────────────────────────────────
export default function TabHistoricoViagens({ isAdmin }) {
    const { toast, showToast } = useToast();
    const [viagens, setViagens]     = useState([]);
    const [motoristas, setMotoristas] = useState([]);
    const [veiculos, setVeiculos]   = useState([]);
    const [loading, setLoading]     = useState(true);
    const [filtroMotorista, setFiltroMotorista] = useState('');
    const [filtroVeiculo, setFiltroVeiculo]     = useState('');
    const [filtroPeriodo, setFiltroPeriodo]     = useState('12'); // meses (usado quando filtroMes vazio)
    const mesAtualHistorico = (() => { const h = new Date(); return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}`; })();
    const [filtroMes, setFiltroMes] = useState(() => {
        try { return sessionStorage.getItem('historico_filtroMes') ?? mesAtualHistorico; } catch { return mesAtualHistorico; }
    });
    const handleSetFiltroMes = (v) => {
        setFiltroMes(v);
        try { sessionStorage.setItem('historico_filtroMes', v); } catch {}
    };
    const [pesquisa, setPesquisa] = useState('');
    const [expandidos, setExpandidos] = useState(() => new Set());
    const toggleExpandido = (nome) => {
        setExpandidos(prev => {
            const next = new Set(prev);
            if (next.has(nome)) next.delete(nome); else next.add(nome);
            return next;
        });
    };

    const load = useCallback(async () => {
        setLoading(true);
        try {
            let dataInicio, dataFim;
            if (filtroMes) {
                const [yr, mo] = filtroMes.split('-');
                const lastDay = new Date(Number(yr), Number(mo), 0).getDate();
                dataInicio = `${filtroMes}-01`;
                dataFim    = `${filtroMes}-${String(lastDay).padStart(2, '0')}`;
            } else {
                const mesesAtras = new Date();
                mesesAtras.setMonth(mesesAtras.getMonth() - Number(filtroPeriodo));
                dataInicio = mesesAtras.toISOString().slice(0, 10);
            }

            const filtros = { dataInicio, ...(dataFim ? { dataFim } : {}) };
            if (filtroMotorista) filtros.motoristaId = filtroMotorista;
            if (filtroVeiculo)   filtros.veiculoId   = filtroVeiculo;

            const [v, roms, carr, m, ve] = await Promise.all([
                fetchViagens(filtros),
                fetchRomaneios({ dataInicio, ...(dataFim ? { dataFim } : {}) }),
                fetchCarregamentos({ dataInicio, ...(dataFim ? { dataFim } : {}), is_terceiro: false, ...(filtroMotorista ? { motoristaId: filtroMotorista } : {}), ...(filtroVeiculo ? { veiculoId: filtroVeiculo } : {}) }),
                fetchTodosMotoristas(),
                fetchCarretasVeiculos(),
            ]);

            // Normaliza romaneios para o mesmo formato de viagem
            const romsNorm = (roms || [])
                .filter(r => r.destino && r.motorista_id)
                .filter(r => !filtroMotorista || r.motorista_id === filtroMotorista)
                .filter(r => !filtroVeiculo   || r.veiculo_id   === filtroVeiculo)
                .map(r => ({
                    motorista_id: r.motorista_id,
                    motorista:    r.motorista,
                    veiculo_id:   r.veiculo_id,
                    veiculo:      r.veiculo,
                    destino:      r.destino,
                    data_saida:   r.data_saida,
                    status:       r.status,
                    _fonte:       'romaneio',
                }));

            // Normaliza carregamentos (volume) para o mesmo formato
            const carrNorm = (carr || [])
                .filter(c => c.destino && c.motorista_id)
                .map(c => ({
                    motorista_id: c.motorista_id,
                    motorista:    c.motorista,
                    veiculo_id:   c.veiculo_id,
                    veiculo:      c.veiculo,
                    destino:      c.destino,
                    data_saida:   c.data_carregamento,
                    status:       'Concluído',
                    _fonte:       'carregamento',
                }));

            // Merge todos: viagens + romaneios + carregamentos
            const viagensNorm = (v || []).map(x => ({ ...x, _fonte: 'viagem' }));
            const combinados = [...viagensNorm, ...romsNorm, ...carrNorm];

            setViagens(combinados); setMotoristas(m); setVeiculos(ve);
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
        finally { setLoading(false); }
    }, [filtroMotorista, filtroVeiculo, filtroPeriodo, filtroMes]); // eslint-disable-line

    useEffect(() => { load(); }, [load]);
    useRecarregarAoVoltar(load);

    // ── Agregações ────────────────────────────────────────────────────────────
    const { porMotorista, destinosGlobais, alertasRotas } = useMemo(() => {
        const mapa = {}; // motoristaId → { nome, destinos: {cidade→{count,datas,status}} }

        viagens.forEach(v => {
            const mid  = v.motorista_id || '__sem__';
            const nome = v.motorista?.name || 'Sem motorista';
            const dest = (v.destino || '').trim();
            if (!dest) return;

            if (!mapa[mid]) mapa[mid] = { nome, destinos: {}, totalViagens: 0, placa: v.veiculo?.placa };
            mapa[mid].totalViagens++;

            const cidadeLow = dest.toLowerCase();
            if (!mapa[mid].destinos[cidadeLow]) {
                mapa[mid].destinos[cidadeLow] = { cidade: dest, count: 0, datas: [], status: [] };
            }
            mapa[mid].destinos[cidadeLow].count++;
            if (v.data_saida) mapa[mid].destinos[cidadeLow].datas.push(v.data_saida);
            mapa[mid].destinos[cidadeLow].status.push(v.status);
        });

        // Ordena destinos por frequência (desc)
        const porMotorista = Object.values(mapa)
            .sort((a, b) => b.totalViagens - a.totalViagens)
            .map(m => ({
                ...m,
                destinos: Object.values(m.destinos).sort((a, b) => b.count - a.count),
            }));

        // Destinos globais (todas as viagens)
        const globalMap = {};
        viagens.forEach(v => {
            const dest = (v.destino || '').trim().toLowerCase();
            if (!dest) return;
            globalMap[dest] = (globalMap[dest] || 0) + 1;
        });
        const destinosGlobais = Object.entries(globalMap)
            .sort((a, b) => b[1] - a[1])
            .map(([cidade, count]) => ({ cidade, count }));

        // Alertas: motoristas com cidade repetida ≥ 3x nas últimas viagens
        const alertasRotas = [];
        porMotorista.forEach(m => {
            m.destinos.forEach(d => {
                if (d.count >= 3) {
                    const ultimaData = d.datas.sort().reverse()[0];
                    alertasRotas.push({ motorista: m.nome, cidade: d.cidade, count: d.count, ultimaData });
                }
            });
        });

        return { porMotorista, destinosGlobais, alertasRotas };
    }, [viagens]);

    const { open: destinosOpen, toggle: toggleDestinos } = useCollapsible(false);

    // ── Filtro de motorista selecionado ───────────────────────────────────────
    const dadosFiltrados = useMemo(() => {
        let base = porMotorista;
        if (filtroMotorista) {
            const mot = motoristas.find(x => x.id === filtroMotorista);
            base = base.filter(m => m.nome === mot?.name);
        }
        if (pesquisa.trim()) {
            const q = pesquisa.toLowerCase();
            base = base.filter(m =>
                (m.nome || '').toLowerCase().includes(q) ||
                m.destinos.some(d => (d.cidade || '').toLowerCase().includes(q))
            );
        }
        return base;
    }, [porMotorista, filtroMotorista, motoristas, pesquisa]);

    const dadosFiltradosPag = usePagination(dadosFiltrados, 10, [dadosFiltrados.length, filtroMotorista, pesquisa, filtroMes, filtroPeriodo]);

    // ── Exportar Excel ────────────────────────────────────────────────────────
    const exportar = () => {
        if (!viagens.length) { showToast('Nenhum dado para exportar', 'error'); return; }
        const wb = XLSX.utils.book_new();

        // Aba 1 — Destinos por motorista
        const rowsM = [];
        porMotorista.forEach(m => {
            m.destinos.forEach((d, idx) => {
                rowsM.push({
                    'Motorista':       idx === 0 ? m.nome : '',
                    'Total Viagens':   idx === 0 ? m.totalViagens : '',
                    'Destino':         d.cidade,
                    'Frequência':      d.count,
                    '% do Total':      m.totalViagens > 0 ? `${((d.count / m.totalViagens) * 100).toFixed(1)}%` : '0%',
                    'Última Viagem':   d.datas.sort().reverse()[0] ? FMT_DATE(d.datas.sort().reverse()[0]) : '—',
                    'Alerta':          d.count >= 3 ? '⚠️ Rota frequente' : '',
                });
            });
            rowsM.push({});
        });
        const ws1 = XLSX.utils.json_to_sheet(rowsM);
        ws1['!cols'] = [22,14,22,12,12,14,20].map(w => ({ wch: w }));
        XLSX.utils.book_append_sheet(wb, ws1, 'Por Motorista');

        // Aba 2 — Destinos globais (ranking)
        const rowsG = destinosGlobais.map((d, i) => ({
            'Ranking': i + 1,
            'Destino': d.cidade,
            'Total de Viagens': d.count,
        }));
        const ws2 = XLSX.utils.json_to_sheet(rowsG);
        ws2['!cols'] = [10, 25, 18].map(w => ({ wch: w }));
        XLSX.utils.book_append_sheet(wb, ws2, 'Ranking Destinos');

        // Aba 3 — Alertas
        if (alertasRotas.length) {
            const ws3 = XLSX.utils.json_to_sheet(alertasRotas.map(a => ({
                'Motorista': a.motorista,
                'Cidade repetida': a.cidade,
                'Vezes':      a.count,
                'Última viagem': FMT_DATE(a.ultimaData),
            })));
            ws3['!cols'] = [22, 22, 10, 14].map(w => ({ wch: w }));
            XLSX.utils.book_append_sheet(wb, ws3, 'Alertas Rotas Frequentes');
        }

        // Aba 4 — Viagens detalhadas
        const rowsV = viagens.map(v => ({
            'Motorista':   v.motorista?.name || '',
            'Placa':       v.veiculo?.placa || '',
            'Nº Viagem':   v.numero || '',
            'Status':      v.status || '',
            'Data Saída':  FMT_DATE(v.data_saida),
            'Destino':     v.destino || '',
            'Toneladas':   v.toneladas || '',
        }));
        const ws4 = XLSX.utils.json_to_sheet(rowsV);
        ws4['!cols'] = [20, 12, 12, 18, 12, 22, 10].map(w => ({ wch: w }));
        XLSX.utils.book_append_sheet(wb, ws4, 'Viagens Detalhadas');

        XLSX.writeFile(wb, `historico_rotas_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.xlsx`);
        showToast('Exportado com sucesso!', 'success');
    };

    // ── Cor do heatmap por frequência ─────────────────────────────────────────
    const heatColor = (count, max) => {
        if (max === 0) return { bg: '#F8FAFC', text: '#64748B' };
        // Limiar mínimo: só considera "frequente" se tiver pelo menos 3 viagens
        // E "muito frequente" se tiver pelo menos 5 viagens
        if (count >= 5 && count / max >= 0.7) return { bg: '#FEE2E2', text: '#991B1B' }; // vermelho — muito frequente
        if (count >= 3 && count / max >= 0.4) return { bg: '#FEF9C3', text: '#B45309' }; // amarelo — frequente
        if (count >= 2)                        return { bg: '#DCFCE7', text: '#166534' }; // verde — moderado
        return { bg: '#F0F9FF', text: '#0369A1' };                                         // azul — raro (1 viagem)
    };

    return (
        <div>
            {/* ── Toolbar ── */}
            <div className="flex flex-wrap gap-2 items-center justify-between mb-5">
                <div className="flex flex-wrap gap-2">
                    {isAdmin && (
                        <PrettySelect value={filtroMotorista} onChange={e => setFiltroMotorista(e.target.value)}
                            className="px-3 py-2 rounded-lg border text-sm" style={inputStyle}>
                            <option value="">Todos os motoristas</option>
                            {motoristas.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </PrettySelect>
                    )}
                    <PrettySelect value={filtroVeiculo} onChange={e => setFiltroVeiculo(e.target.value)}
                        className="px-3 py-2 rounded-lg border text-sm" style={inputStyle}>
                        <option value="">Todas as placas</option>
                        {veiculos.map(v => <option key={v.id} value={v.id}>{v.placa}</option>)}
                    </PrettySelect>
                    <input type="month" value={filtroMes} onChange={e => handleSetFiltroMes(e.target.value)}
                        className="px-3 py-2 rounded-lg border text-sm" style={inputStyle} title="Filtrar por mês específico" />
                    {filtroMes && (
                        <button onClick={() => handleSetFiltroMes('')}
                            className="px-2 py-1.5 rounded-lg border text-xs font-medium hover:bg-gray-50"
                            style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}
                            title="Limpar mês e usar período relativo">✕ Mês</button>
                    )}
                    <PrettySelect value={filtroPeriodo} onChange={e => { setFiltroPeriodo(e.target.value); handleSetFiltroMes(''); }}
                        disabled={!!filtroMes}
                        className="px-3 py-2 rounded-lg border text-sm" style={{ ...inputStyle, opacity: filtroMes ? 0.5 : 1 }}
                        title={filtroMes ? 'Limpe o filtro de mês para usar período relativo' : 'Período relativo'}>
                        <option value="3">Últimos 3 meses</option>
                        <option value="6">Últimos 6 meses</option>
                        <option value="12">Último ano</option>
                        <option value="24">Últimos 2 anos</option>
                        <option value="60">Tudo</option>
                    </PrettySelect>
                </div>
                <div className="flex gap-2">
                    <SearchInput value={pesquisa} onChange={setPesquisa} placeholder="Motorista, destino..." width="210px" />
                    <button onClick={load} className="p-2 rounded-lg border hover:bg-gray-50 transition-colors" style={{ borderColor: 'var(--color-border)' }} title="Atualizar">
                        <Icon name="RefreshCw" size={14} color="var(--color-muted-foreground)" />
                    </button>
                    <button onClick={exportar} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium hover:bg-gray-50 transition-colors" style={{ borderColor: 'var(--color-border)' }}>
                        <Icon name="FileDown" size={14} /> Exportar
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-16">
                    <div className="animate-spin h-7 w-7 rounded-full border-4" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
                </div>
            ) : (
                <div className="flex flex-col gap-5">

                    {/* ── Alertas de rotas frequentes ── */}
                    {alertasRotas.length > 0 && (
                        <div className="rounded-xl border p-4" style={{ borderColor: '#FED7AA', backgroundColor: '#FFF7ED' }}>
                            <div className="flex items-center gap-2 mb-3">
                                <Icon name="AlertTriangle" size={16} color="#D97706" />
                                <p className="text-sm font-semibold text-amber-800">
                                    {alertasRotas.length} alerta{alertasRotas.length > 1 ? 's' : ''} de rota frequente
                                </p>
                                <span className="text-xs text-amber-600 ml-auto">Motoristas com ≥3 viagens ao mesmo destino</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                {alertasRotas.slice(0, 6).map((a, i) => (
                                    <div key={i} className="flex items-center gap-2 p-2.5 rounded-lg bg-white border border-orange-100">
                                        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-orange-100 flex items-center justify-center">
                                            <span className="text-xs font-bold text-orange-700">{a.count}×</span>
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-xs font-semibold truncate text-amber-900">{a.motorista}</p>
                                            <p className="text-xs text-orange-700 truncate">→ {a.cidade}</p>
                                        </div>
                                        {a.ultimaData && (
                                            <p className="text-xs text-amber-500 ml-auto flex-shrink-0">{FMT_DATE(a.ultimaData)}</p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ── Ranking de destinos globais ── */}
                    {destinosGlobais.length > 0 && (
                        <div className="bg-white rounded-xl border shadow-sm overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
                            <button type="button" onClick={toggleDestinos}
                                className="w-full px-5 py-3 border-b flex items-center gap-2 hover:bg-gray-50 transition-colors"
                                style={{ borderColor: 'var(--color-border)', backgroundColor: '#F8FAFC' }}>
                                <Icon name="BarChart2" size={16} color="var(--color-muted-foreground)" />
                                <h3 className="font-heading font-semibold text-sm" style={{ color: 'var(--color-text-primary)' }}>
                                    Ranking de Destinos {filtroMotorista ? `— ${motoristas.find(m => m.id === filtroMotorista)?.name}` : '(todos os motoristas)'}
                                </h3>
                                <span className="ml-auto text-xs" style={{ color: 'var(--color-muted-foreground)' }}>{destinosGlobais.length} destino{destinosGlobais.length > 1 ? 's' : ''}</span>
                                <CollapseChevron open={destinosOpen} color="var(--color-muted-foreground)" />
                            </button>
                            {destinosOpen && (
                                <div className="p-5">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {destinosGlobais.map((d, i) => {
                                            const maxCount = destinosGlobais[0]?.count || 1;
                                            const pct = (d.count / maxCount) * 100;
                                            const cor = heatColor(d.count, maxCount);
                                            return (
                                                <div key={d.cidade} className="flex items-center gap-3">
                                                    <span className="w-5 text-xs font-data text-right flex-shrink-0" style={{ color: 'var(--color-muted-foreground)' }}>
                                                        {i + 1}
                                                    </span>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center justify-between mb-1">
                                                            <span className="text-xs font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>{d.cidade}</span>
                                                            <span className="text-xs font-data font-semibold ml-2 flex-shrink-0 px-1.5 py-0.5 rounded-full"
                                                                style={{ backgroundColor: cor.bg, color: cor.text }}>
                                                                {d.count}×
                                                            </span>
                                                        </div>
                                                        <div className="w-full h-1.5 rounded-full bg-gray-100 overflow-hidden">
                                                            <div className="h-full rounded-full transition-all"
                                                                style={{ width: `${pct}%`, backgroundColor: cor.text }} />
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Detalhamento por motorista ── */}
                    {dadosFiltrados.length === 0 ? (
                        <div className="bg-white rounded-xl border p-10 flex flex-col items-center text-center" style={{ borderColor: 'var(--color-border)' }}>
                            <Icon name="MapPin" size={36} color="var(--color-muted-foreground)" />
                            <p className="text-sm mt-3 font-medium" style={{ color: 'var(--color-muted-foreground)' }}>Nenhum histórico encontrado</p>
                            <p className="text-xs mt-1" style={{ color: 'var(--color-muted-foreground)' }}>Ajuste os filtros ou o período</p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-4">
                            {dadosFiltradosPag.pageItems.map(m => {
                                const maxCount = m.destinos[0]?.count || 1;
                                const isExpandido = expandidos.has(m.nome);
                                return (
                                    <div key={m.nome} className="bg-white rounded-xl border shadow-sm overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
                                        {/* Header do motorista */}
                                        <div className="flex items-center justify-between px-5 py-3 border-b cursor-pointer select-none" style={{ borderColor: 'var(--color-border)', backgroundColor: '#F8FAFC' }}
                                            onClick={() => toggleExpandido(m.nome)}>
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                                                    style={{ backgroundColor: 'var(--color-primary)' }}>
                                                    {m.nome[0]?.toUpperCase() || '?'}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{m.nome}</p>
                                                    <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                                                        {m.totalViagens} viagem{m.totalViagens !== 1 ? 's' : ''} · {m.destinos.length} destino{m.destinos.length !== 1 ? 's' : ''}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                {/* Badge do destino mais frequente */}
                                                {m.destinos[0] && (
                                                    <div className="text-right hidden sm:block">
                                                        <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>Destino mais frequente</p>
                                                        <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                                                            {m.destinos[0].cidade}
                                                            <span className="ml-1.5 text-xs font-data text-orange-600">({m.destinos[0].count}×)</span>
                                                        </p>
                                                    </div>
                                                )}
                                                <button onClick={(e) => { e.stopPropagation(); toggleExpandido(m.nome); }} title={isExpandido ? 'Recolher' : 'Expandir'}
                                                    className="w-6 h-6 rounded-md flex items-center justify-center hover:bg-gray-200 transition-colors flex-shrink-0">
                                                    <Icon name={isExpandido ? 'ChevronUp' : 'ChevronDown'} size={16} color="var(--color-muted-foreground)" />
                                                </button>
                                            </div>
                                        </div>

                                        {isExpandido && (<IsExpandido heatColor={heatColor} m={m} maxCount={maxCount} />)}
                                    </div>
                                );
                            })}
                            <PaginationBar page={dadosFiltradosPag.page} setPage={dadosFiltradosPag.setPage} totalPages={dadosFiltradosPag.totalPages}
                                totalItems={dadosFiltradosPag.totalItems} pageSize={dadosFiltradosPag.pageSize} itemLabel="motorista" itemLabelPlural="motoristas" className="rounded-xl border bg-white" />
                        </div>
                    )}
                </div>
            )}
            <Toast toast={toast} />
        </div>
    );
}
