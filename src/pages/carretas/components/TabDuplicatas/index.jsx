import React, { useState, useEffect } from 'react';

import { useToast } from 'hooks/useToast';
import { fetchCarregamentosPaginaPeriodo, fetchCarretasPlacasPorIds } from 'services/carretas';
import { fetchDuplicatasVerificadas, marcarDuplicataVerificada, desmarcarDuplicataVerificada } from 'services/duplicatasService';
import { AppIcon as Icon, Toast } from 'components';

import { inputStyle } from '../../utils/constants';

export default function TabDuplicatas() {
    const { toast, showToast } = useToast();
    const [mes, setMes]           = useState(() => { const h = new Date(); return `${h.getFullYear()}-${String(h.getMonth()+1).padStart(2,'0')}`; });
    const [loading, setLoading]   = useState(false);
    const [resultado, setResultado] = useState(null); // null | { total, dups, possiveis, placaMap }
    const [verificadas, setVerificadas] = useState(new Set()); // Set of assinaturas já verificadas
    const [loadingVerif, setLoadingVerif] = useState(false);

    // Carrega assinaturas já verificadas do Supabase
    const loadVerificadas = async () => {
        const data = await fetchDuplicatasVerificadas();
        setVerificadas(new Set(data.map(d => d.assinatura)));
    };
    useEffect(() => { loadVerificadas(); }, []);

    // Gera a assinatura de um grupo de possíveis duplicatas (IDs ordenados)
    const assinatura = (grupo) => grupo.itens.map(r => r.id).sort().join(',');

    const marcarVerificado = async (grupo) => {
        setLoadingVerif(true);
        try {
            const sig = assinatura(grupo);
            await marcarDuplicataVerificada(sig, grupo.tipo);
            setVerificadas(prev => new Set([...prev, sig]));
            showToast('Marcado como verificado — não aparecerá mais nas próximas pesquisas.', 'success');
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
        finally { setLoadingVerif(false); }
    };

    const desmarcarVerificado = async (grupo) => {
        setLoadingVerif(true);
        try {
            const sig = assinatura(grupo);
            await desmarcarDuplicataVerificada(sig);
            setVerificadas(prev => { const s = new Set(prev); s.delete(sig); return s; });
            showToast('Verificação removida — voltará a aparecer nas pesquisas.', 'warning');
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
        finally { setLoadingVerif(false); }
    };

    const detectar = async () => {
        setLoading(true); setResultado(null);
        try {
            const [yr, mo] = mes.split('-');
            const lastDay  = new Date(+yr, +mo, 0).getDate();
            const ini = `${mes}-01`, fim = `${mes}-${String(lastDay).padStart(2,'0')}`;

            // Busca paginada
            let all = [], offset = 0;
            while (true) {
                const { data, error } = await fetchCarregamentosPaginaPeriodo(ini, fim, offset);
                if (error) throw error;
                all = all.concat(data || []);
                if ((data || []).length < 1000) break;
                offset += 1000;
            }

            // Placas
            const vids = [...new Set(all.map(r => r.veiculo_id).filter(Boolean))];
            let placaMap = {};
            if (vids.length) {
                const vs = await fetchCarretasPlacasPorIds(vids);
                vs.forEach(v => { placaMap[v.id] = v.placa; });
            }

            // Detecta grupos duplicados
            const groups = {};
            all.forEach(r => {
                const placa = placaMap[r.veiculo_id] || '';
                const nf    = (r.numero_nota_fiscal || '').trim();
                const ped   = (r.numero_pedido || '').trim();
                const dest  = (r.destino || '').trim().toLowerCase();
                if (!nf || !ped || !dest || !placa) return;
                const key = `${placa}|||${dest}|||${nf}|||${ped}`;
                if (!groups[key]) groups[key] = [];
                groups[key].push({ ...r, _placa: placa });
            });
            const dups = Object.values(groups).filter(g => g.length > 1);

            // Detecta POSSÍVEIS duplicatas: mesmo número de pedido OU mesma NF,
            // mesmo que placa/destino difiram (ex: erro de digitação)
            const dupKeySet = new Set(Object.keys(groups).filter(k => groups[k].length > 1));
            const porPedido = {}, porNF = {};
            all.forEach(r => {
                const placa = placaMap[r.veiculo_id] || '';
                const nf    = (r.numero_nota_fiscal || '').trim();
                const ped   = (r.numero_pedido || '').trim();
                const dest  = (r.destino || '').trim().toLowerCase();
                const item  = { ...r, _placa: placa };
                if (ped) { if (!porPedido[ped]) porPedido[ped] = []; porPedido[ped].push(item); }
                if (nf)  { if (!porNF[nf])  porNF[nf]  = []; porNF[nf].push(item); }
            });
            const possiveis = [];
            const vistos = new Set();
            const addPossivel = (lista, tipo) => {
                if (lista.length < 2) return;
                // ignora se já é uma duplicata exata (placa+destino+NF+pedido iguais)
                const placas = new Set(lista.map(x => `${x._placa}|||${(x.destino||'').trim().toLowerCase()}|||${(x.numero_nota_fiscal||'').trim()}|||${(x.numero_pedido||'').trim()}`));
                if (placas.size === 1) return; // já capturado como duplicata exata
                const sig = lista.map(x => x.id).sort().join(',');
                if (vistos.has(sig)) return;
                vistos.add(sig);
                possiveis.push({ tipo, itens: lista });
            };
            Object.entries(porPedido).forEach(([ped, lista]) => addPossivel(lista, `Pedido ${ped}`));
            Object.entries(porNF).forEach(([nf, lista]) => addPossivel(lista, `NF ${nf}`));

            // Filtra possíveis já marcadas como verificadas (persistidas no Supabase)
            const possiveisNaoVerificadas = possiveis.filter(p => {
                const sig = p.itens.map(r => r.id).sort().join(',');
                return !verificadas.has(sig);
            });

            setResultado({ total: all.length, dups, possiveis: possiveisNaoVerificadas, possiveisAll: possiveis, placaMap });
        } catch (e) {
            showToast('Erro: ' + e.message, 'error');
        } finally { setLoading(false); }
    };

    const totalExtras = resultado ? resultado.dups.reduce((s, g) => s + g.length - 1, 0) : 0;
    const totalSacos  = resultado ? resultado.dups.reduce((s, g) => s + (Number(g[0].quantidade)||0) * (g.length - 1), 0) : 0;

    const exportCSV = () => {
        if (!resultado?.dups.length) return;
        const lines = ['Placa,Data,Destino,NF,Pedido,Sacos,Ocorrencias,ID_manter,IDs_remover'];
        resultado.dups.forEach(g => {
            const r0 = g[0];
            lines.push([r0._placa, r0.data_carregamento, `"${r0.destino||''}"`, r0.numero_nota_fiscal, r0.numero_pedido, r0.quantidade, g.length, r0.id, `"${g.slice(1).map(x=>x.id).join(' | ')}"`].join(','));
        });
        const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
        a.download = `duplicatas_${mes}.csv`; a.click();
    };

    const FMT = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—';
    const fmt  = n => Number(n||0).toLocaleString('pt-BR');

    return (
        <div>
            <div className="mb-5">
                <h2 className="text-lg font-semibold mb-1" style={{ color: 'var(--color-text-primary)' }}>Detector de Duplicatas</h2>
                <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Busca carregamentos com mesma <strong>placa + destino + NF + pedido</strong> no mesmo mês.</p>
            </div>

            {/* Toolbar */}
            <div className="flex flex-wrap gap-3 items-end mb-5">
                <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Mês</label>
                    <input type="month" value={mes} onChange={e => setMes(e.target.value)}
                        className="px-3 py-2 rounded-lg border text-sm" style={inputStyle} />
                </div>
                <button
                    onClick={detectar} disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors"
                    style={{ backgroundColor: loading ? '#93C5FD' : 'var(--color-primary)', cursor: loading ? 'not-allowed' : 'pointer' }}>
                    {loading
                        ? <><div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" /> Analisando...</>
                        : <><Icon name="Search" size={15} color="#fff" /> Detectar duplicatas</>}
                </button>
                {resultado?.dups.length > 0 && (
                    <button onClick={exportCSV}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50"
                        style={{ borderColor: 'var(--color-border)' }}>
                        <Icon name="FileDown" size={14} /> Exportar CSV
                    </button>
                )}
            </div>

            {/* KPIs */}
            {resultado && (
                <>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
                        {[
                            { l: 'Total no mês', v: fmt(resultado.total), c: 'var(--color-text-primary)', bg: 'var(--color-muted)' },
                            { l: 'Grupos duplicados', v: fmt(resultado.dups.length), c: resultado.dups.length ? '#DC2626' : '#16A34A', bg: resultado.dups.length ? '#FEF2F2' : '#F0FDF4' },
                            { l: 'Registros extras', v: fmt(totalExtras), c: totalExtras ? '#DC2626' : '#16A34A', bg: totalExtras ? '#FEF2F2' : '#F0FDF4' },
                            { l: 'Sacos duplicados', v: fmt(totalSacos), c: totalSacos ? '#DC2626' : '#16A34A', bg: totalSacos ? '#FEF2F2' : '#F0FDF4' },
                            { l: 'Possíveis duplicatas', v: fmt(resultado.possiveis?.length || 0), c: resultado.possiveis?.length ? '#D97706' : '#16A34A', bg: resultado.possiveis?.length ? '#FFFBEB' : '#F0FDF4' },
                        ].map(k => (
                            <div key={k.l} className="rounded-xl border p-4 shadow-sm" style={{ borderColor: 'var(--color-border)', backgroundColor: k.bg }}>
                                <p className="text-xs mb-1" style={{ color: 'var(--color-muted-foreground)' }}>{k.l}</p>
                                <p className="text-2xl font-bold font-data" style={{ color: k.c }}>{k.v}</p>
                            </div>
                        ))}
                    </div>

                    {resultado.dups.length === 0 && (!resultado.possiveis || resultado.possiveis.length === 0) ? (
                        <div className="rounded-xl border p-6 text-center" style={{ borderColor: '#BBF7D0', backgroundColor: '#F0FDF4' }}>
                            <Icon name="CheckCircle2" size={32} color="#16A34A" />
                            <p className="mt-2 font-semibold" style={{ color: '#166534' }}>Nenhuma duplicata encontrada!</p>
                            <p className="text-sm mt-1" style={{ color: '#166534' }}>Todos os registros possuem combinações únicas de placa + destino + NF + pedido, e não há pedidos/NFs repetidos entre registros diferentes.</p>
                        </div>
                    ) : resultado.dups.length > 0 ? (
                        <div className="bg-white rounded-xl border shadow-sm overflow-x-auto" style={{ borderColor: 'var(--color-border)' }}>
                            <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: 'var(--color-border)', backgroundColor: '#FEF2F2' }}>
                                <Icon name="AlertTriangle" size={16} color="#DC2626" />
                                <span className="text-sm font-semibold text-red-700">{resultado.dups.length} grupo(s) com duplicatas — sugestão: manter o primeiro registro (mais antigo) e remover os extras</span>
                            </div>
                            <table className="w-full text-sm min-w-[900px]">
                                <thead className="text-xs border-b" style={{ backgroundColor: 'var(--color-muted)', borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                                    <tr>
                                        {['Placa','Data','Destino','NF','Pedido','Sacos','Empresa Orig.','Ocorr.','IDs (manter → extras)'].map(h => (
                                            <th key={h} className="px-3 py-2 text-left font-medium whitespace-nowrap">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {resultado.dups.map((g, gi) => {
                                        const r0 = g[0];
                                        return (
                                            <tr key={gi} className="border-t" style={{ borderColor: '#FEE2E2', backgroundColor: gi % 2 === 0 ? '#FFF7F7' : '#fff' }}>
                                                <td className="px-3 py-3 font-data font-semibold whitespace-nowrap">{r0._placa}</td>
                                                <td className="px-3 py-3 whitespace-nowrap">{FMT(r0.data_carregamento)}</td>
                                                <td className="px-3 py-3 max-w-[140px] truncate">{r0.destino || '—'}</td>
                                                <td className="px-3 py-3 font-data whitespace-nowrap">{r0.numero_nota_fiscal || '—'}</td>
                                                <td className="px-3 py-3 font-data whitespace-nowrap">{r0.numero_pedido || '—'}</td>
                                                <td className="px-3 py-3 font-data text-right">{fmt(r0.quantidade)}</td>
                                                <td className="px-3 py-3 text-xs">{r0.empresa_origem || '—'}</td>
                                                <td className="px-3 py-3 text-center">
                                                    <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ backgroundColor: '#FEE2E2', color: '#991B1B' }}>{g.length}×</span>
                                                </td>
                                                <td className="px-3 py-3">
                                                    <div className="flex flex-col gap-1">
                                                        <span className="text-xs font-mono" style={{ color: '#1D4ED8' }}>✓ {r0.id.slice(0,12)}…</span>
                                                        {g.slice(1).map(x => (
                                                            <span key={x.id} className="text-xs font-mono" style={{ color: '#DC2626' }}>✕ {x.id.slice(0,12)}…</span>
                                                        ))}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    ) : null}

                    {/* ── Alertas: possíveis duplicatas (mesmo pedido OU mesma NF, mas placa/destino diferem) ── */}
                    {(resultado.possiveis?.length > 0 || (resultado.possiveisAll?.length > resultado.possiveis?.length)) && (
                        <div className="bg-white rounded-xl border shadow-sm overflow-x-auto mt-4" style={{ borderColor: 'var(--color-border)' }}>
                            <div className="px-4 py-3 border-b flex items-center justify-between gap-2 flex-wrap" style={{ borderColor: 'var(--color-border)', backgroundColor: '#FFFBEB' }}>
                                <div className="flex items-center gap-2">
                                    <Icon name="AlertTriangle" size={16} color="#D97706" />
                                    <span className="text-sm font-semibold" style={{ color: '#92400E' }}>
                                        {resultado.possiveis.length} alerta(s) — registros com o mesmo número de pedido ou NF, mas placa/destino diferentes. Pode ser erro de digitação ou registro duplicado com dado trocado.
                                    </span>
                                </div>
                                {resultado.possiveisAll?.length > resultado.possiveis?.length && (
                                    <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ backgroundColor: '#F0FDF4', color: '#15803D', border: '1px solid #A7F3D0' }}>
                                        ✅ {resultado.possiveisAll.length - resultado.possiveis.length} oculto(s) — já verificado(s) e confirmado(s) como não duplicata
                                    </span>
                                )}
                            </div>
                            {resultado.possiveis.length === 0 ? (
                                <div className="px-4 py-8 text-center">
                                    <Icon name="CheckCircle2" size={28} color="#15803D" />
                                    <p className="text-sm font-medium text-green-700 mt-2">Todos os alertas foram verificados e confirmados como corretos.</p>
                                </div>
                            ) : (
                            <table className="w-full text-sm min-w-[900px]">
                                <thead className="text-xs border-b" style={{ backgroundColor: 'var(--color-muted)', borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                                    <tr>
                                        {['Critério','Placa','Data','Destino','NF','Pedido','Sacos','Empresa Orig.',''].map(h => (
                                            <th key={h} className="px-3 py-2 text-left font-medium whitespace-nowrap">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {resultado.possiveis.map((p, pi) => (
                                        p.itens.map((r, ri) => (
                                            <tr key={`${pi}-${r.id}`} className="border-t" style={{ borderColor: '#FEF3C7', backgroundColor: pi % 2 === 0 ? '#FFFDF5' : '#fff' }}>
                                                {ri === 0 && (
                                                    <td className="px-3 py-3 font-semibold whitespace-nowrap" style={{ color: '#92400E' }} rowSpan={p.itens.length}>{p.tipo}</td>
                                                )}
                                                <td className="px-3 py-3 font-data font-semibold whitespace-nowrap">{r._placa || '—'}</td>
                                                <td className="px-3 py-3 whitespace-nowrap">{FMT(r.data_carregamento)}</td>
                                                <td className="px-3 py-3 max-w-[140px] truncate">{r.destino || '—'}</td>
                                                <td className="px-3 py-3 font-data whitespace-nowrap">{r.numero_nota_fiscal || '—'}</td>
                                                <td className="px-3 py-3 font-data whitespace-nowrap">{r.numero_pedido || '—'}</td>
                                                <td className="px-3 py-3 font-data text-right">{fmt(r.quantidade)}</td>
                                                <td className="px-3 py-3 text-xs">{r.empresa_origem || '—'}</td>
                                                {ri === 0 && (
                                                    <td className="px-3 py-3 whitespace-nowrap" rowSpan={p.itens.length}>
                                                        <button
                                                            disabled={loadingVerif}
                                                            onClick={() => marcarVerificado(p)}
                                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-60"
                                                            title="Confirmar que estes registros são intencionais e não são duplicatas — não aparecerão mais em pesquisas futuras">
                                                            <Icon name="CheckCheck" size={12} color="white" />
                                                            Verificado — não é duplicata
                                                        </button>
                                                    </td>
                                                )}
                                            </tr>
                                        ))
                                    ))}
                                </tbody>
                            </table>
                            )}
                        </div>
                    )}
                </>
            )}
            <Toast toast={toast} />
        </div>
    );
}
