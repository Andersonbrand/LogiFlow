import React, { useMemo, useState } from 'react';
import { AppIcon as Icon } from 'components';
import { useMapaRegionalDados } from './hooks/useMapaRegionalDados';
import { METRICAS } from './utils/agregar';
import { POLOS } from './utils/regioes';
import MapaSvg from './components/MapaSvg';
import { KpisTotais, CardsRegioes, DetalheCidade, RankingCidades, SemAtendimento } from './components/Paineis';

const chip = (ativo) => `px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${ativo ? 'bg-blue-600 text-white border-blue-600' : 'bg-white hover:bg-gray-50'}`;

export default function TabMapaRegional() {
    const [filtroMes, setFiltroMes] = useState(() => { const h = new Date(); return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}`; });
    const [usarPeriodo, setUsarPeriodo] = useState(false);
    const [periodoCustom, setPeriodoCustom] = useState({ inicio: '', fim: '' });
    const periodo = useMemo(() => {
        if (usarPeriodo) return { inicio: periodoCustom.inicio, fim: periodoCustom.fim };
        if (filtroMes) {
            const [a, m] = filtroMes.split('-').map(Number);
            return { inicio: `${filtroMes}-01`, fim: `${filtroMes}-${String(new Date(a, m, 0).getDate()).padStart(2, '0')}` };
        }
        return { inicio: '', fim: '' };
    }, [filtroMes, usarPeriodo, periodoCustom]);
    const { cidades, regioes, totais, naoLocalizados, loading, erro, recarregar } = useMapaRegionalDados(periodo);
    const [metricaId, setMetricaId] = useState('sacos');
    const [modoCor, setModoCor] = useState('regiao');
    const [foco, setFoco] = useState(true);
    const [selecionada, setSelecionada] = useState(null);
    const [regiaoDestaque, setRegiaoDestaque] = useState(null);
    const metrica = METRICAS.find(m => m.id === metricaId);
    const cidadeSel = useMemo(() => cidades.find(c => c.chave === selecionada) || null, [cidades, selecionada]);
    const poloSel = cidadeSel ? POLOS.find(p => p.id === cidadeSel.polo) : null;

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap items-end justify-end gap-3">
                <div className="flex flex-wrap items-center gap-2">
                    <input type="month" value={filtroMes} onChange={e => { setFiltroMes(e.target.value); setUsarPeriodo(false); }}
                        className="px-3 py-1.5 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-blue-500/20" style={{ borderColor: 'var(--color-border)' }} title="Mês de exercício" />
                    <button type="button" data-repeat onClick={() => setUsarPeriodo(u => !u)}
                        className="px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors"
                        style={usarPeriodo ? { backgroundColor: 'var(--color-primary)', color: '#fff', borderColor: 'var(--color-primary)' } : { borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>
                        {usarPeriodo ? '✓ Período ativo' : 'Usar período'}
                    </button>
                    {usarPeriodo && (
                        <>
                            <input type="date" value={periodoCustom.inicio} onChange={e => setPeriodoCustom(p => ({ ...p, inicio: e.target.value }))} className="px-2.5 py-1.5 rounded-lg border text-xs outline-none" style={{ borderColor: 'var(--color-border)' }} />
                            <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>até</span>
                            <input type="date" value={periodoCustom.fim} onChange={e => setPeriodoCustom(p => ({ ...p, fim: e.target.value }))} className="px-2.5 py-1.5 rounded-lg border text-xs outline-none" style={{ borderColor: 'var(--color-border)' }} />
                        </>
                    )}
                    {(filtroMes || usarPeriodo) && (
                        <button type="button" data-repeat onClick={() => { setFiltroMes(''); setUsarPeriodo(false); setPeriodoCustom({ inicio: '', fim: '' }); }}
                            className="px-2.5 py-1.5 rounded-lg border text-xs font-medium hover:bg-gray-50" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }} title="Limpar data e ver todo o período">✕ Data</button>
                    )}
                </div>
            </div>

            {erro && (
                <div className="rounded-xl border px-4 py-3 text-sm flex items-center justify-between gap-3" style={{ borderColor: '#FCA5A5', background: '#FEF2F2', color: '#B91C1C' }}>
                    <span>{erro}</span><button type="button" onClick={recarregar} className="underline font-medium">Tentar novamente</button>
                </div>
            )}

            {loading ? (
                <div className="flex items-center justify-center py-24 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    <Icon name="Loader2" size={18} color="currentColor" className="animate-spin mr-2" />Carregando mapa…
                </div>
            ) : (
                <>
                    <KpisTotais t={totais} regioes={regioes} />

                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-medium mr-1">Exibir no mapa:</span>
                        {METRICAS.map(m => <button key={m.id} type="button" data-repeat className={chip(metricaId === m.id)} onClick={() => setMetricaId(m.id)}>{m.label}</button>)}
                        <span className="mx-2 h-4 w-px bg-gray-300 hidden sm:block" />
                        <button type="button" data-repeat className={chip(modoCor === 'regiao')} onClick={() => setModoCor('regiao')}>Cor por região</button>
                        <button type="button" data-repeat className={chip(modoCor === 'margem')} onClick={() => setModoCor('margem')}>Cor por margem</button>
                        <button type="button" data-repeat className={chip(foco)} onClick={() => setFoco(f => !f)}>{foco ? 'Foco na área de atuação' : 'Bahia inteira'}</button>
                    </div>

                    <div className="grid lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] gap-4">
                        <div>
                            <MapaSvg cidades={cidades} metrica={metrica} modoCor={modoCor} selecionada={selecionada} onSelecionar={k => setSelecionada(s => (s === k ? null : k))} regiaoDestaque={regiaoDestaque} foco={foco} />
                            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                                {modoCor === 'regiao'
                                    ? POLOS.filter(p => regioes.find(r => r.id === p.id)?.cidades).map(p => <span key={p.id} className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{ background: p.cor }} />{p.nome.split(' · ')[1]}</span>)
                                    : [['#22C55E', '≥ 25%'], ['#EAB308', '10–25%'], ['#F97316', '0–10%'], ['#EF4444', 'negativa']].map(([c, t]) => <span key={t} className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{ background: c }} />margem {t}</span>)}
                                <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{ background: '#EF4444' }} />sem atendimento</span>
                                <span>· tamanho do círculo = {metrica.label.toLowerCase()}</span>
                            </div>
                        </div>
                        <div className="space-y-4">
                            <DetalheCidade cidade={cidadeSel} polo={poloSel} onFechar={() => setSelecionada(null)} />
                            <RankingCidades cidades={cidades} metrica={metrica} onSelecionar={setSelecionada} selecionada={selecionada} />
                        </div>
                    </div>

                    <div>
                        <h3 className="text-sm font-semibold mb-2">Resultado por região <span className="font-normal text-xs" style={{ color: 'var(--color-text-secondary)' }}>(clique para destacar no mapa)</span></h3>
                        <CardsRegioes regioes={regioes} destaque={regiaoDestaque} onDestaque={setRegiaoDestaque} />
                    </div>

                    <SemAtendimento cidades={cidades} onSelecionar={setSelecionada} naoLocalizados={naoLocalizados} />

                </>
            )}
        </div>
    );
}
