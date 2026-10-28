import React from 'react';
import { AppIcon as Icon } from 'components';
import { TIPOS } from '../../utils/constants';
import { fmtNum, BRL, parseTipo, FMT } from '../../utils/helpers';
import TipoBadge from '../TipoBadge';

// ─── Sub-componente: Dashboard ─────────────────────────────────────────────────
export default function DashboardVolume({ totais, carregamentos, carregamentosTerceiros = [], carregamentosRetira = [], mes }) {
    const pct = v => totais.totalGeral > 0 ? ((v / totais.totalGeral) * 100).toFixed(1) : '0.0';
    const tipoEntries = Object.entries(TIPOS).filter(([key]) => key !== 'ESTOQUE');

    const freteTotal = carregamentos.reduce((s, r) => s + Number(r.valor_frete_calculado || 0), 0);

    const [expandido, setExpandido] = React.useState(false);
    const totalFrota     = totais.total;
    const totalTerceiros = carregamentosTerceiros.reduce((s,r) => s + (Number(r.quantidade)||0), 0);
    const totalRetiras   = carregamentosRetira.reduce((s,r) => s + (Number(r.quantidade)||0), 0);
    const totalGeral     = totalFrota + totalTerceiros + totalRetiras;

    return (
        <div className="flex flex-col gap-6">
            {/* ── Badge de total expandível ── */}
            <div className="rounded-2xl overflow-hidden border shadow-sm" style={{ borderColor: 'var(--color-primary)' }}>
                <button
                    onClick={() => setExpandido(e => !e)}
                    data-repeat data-no-press aria-expanded={expandido}
                    className="w-full text-left px-5 py-4 text-white flex items-center justify-between gap-4"
                    style={{ background: 'var(--color-primary)' }}>
                    <div className="flex items-center gap-4">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wide opacity-75">📦 Volume Total Carregado — todas as origens</p>
                            <p className="text-4xl font-black leading-none mt-1">{fmtNum(totalGeral)}</p>
                            <p className="text-xs opacity-60 mt-1">sacos · clique para {expandido ? 'recolher' : 'detalhar'}</p>
                        </div>
                    </div>
                    <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.2)' }}>
                        <Icon name={expandido ? 'ChevronUp' : 'ChevronDown'} size={18} color="#fff" />
                    </div>
                </button>
                {expandido && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x" style={{ divideColor: 'var(--color-border)' }}>
                        <div className="px-5 py-4 flex items-center gap-3" style={{ backgroundColor: '#EFF6FF' }}>
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#DBEAFE' }}>
                                <Icon name="Truck" size={18} color="#1D4ED8" />
                            </div>
                            <div>
                                <p className="text-xs font-semibold uppercase" style={{ color: '#1E3A5F' }}>Frota Própria</p>
                                <p className="text-2xl font-black" style={{ color: '#1D4ED8' }}>{fmtNum(totalFrota)}</p>
                                <p className="text-xs" style={{ color: '#3B82F6' }}>{carregamentos.length} registros · aba Registros</p>
                            </div>
                        </div>
                        <div className="px-5 py-4 flex items-center gap-3" style={{ backgroundColor: '#FFFBEB' }}>
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#FEF3C7' }}>
                                <Icon name="Users" size={18} color="#D97706" />
                            </div>
                            <div>
                                <p className="text-xs font-semibold uppercase" style={{ color: '#92400E' }}>Terceiros</p>
                                <p className="text-2xl font-black" style={{ color: '#D97706' }}>{fmtNum(totalTerceiros)}</p>
                                <p className="text-xs" style={{ color: '#B45309' }}>{carregamentosTerceiros.length} registros · aba Terceiros</p>
                            </div>
                        </div>
                        <div className="px-5 py-4 flex items-center gap-3" style={{ backgroundColor: '#F0FDF4' }}>
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#DCFCE7' }}>
                                <Icon name="ShoppingBag" size={18} color="#059669" />
                            </div>
                            <div>
                                <p className="text-xs font-semibold uppercase" style={{ color: '#065F46' }}>Retira de Clientes</p>
                                <p className="text-2xl font-black" style={{ color: '#059669' }}>{fmtNum(totalRetiras)}</p>
                                <p className="text-xs" style={{ color: '#059669' }}>aba Retira de Clientes</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Cards por tipo (frota própria) */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {tipoEntries.map(([key, t]) => (
                    <div key={key} className="rounded-xl p-4 relative overflow-hidden border" style={{ background: t.bg, borderColor: t.border }}>
                        <div className="absolute top-0 left-0 right-0 h-1 rounded-t-xl" style={{ background: t.bar }} />
                        <p className="text-xs font-semibold uppercase tracking-wide opacity-75 mb-2" style={{ color: t.color }}>{t.label}</p>
                        <p className="text-2xl font-black leading-none" style={{ color: t.color }}>{fmtNum(totais[key] || 0)}</p>
                        <p className="text-sm font-semibold mt-1" style={{ color: t.color }}>{pct(totais[key] || 0)}%</p>
                        <p className="text-xs opacity-55" style={{ color: t.color }}>do volume total</p>
                    </div>
                ))}
            </div>

            {/* Card de Frete Total — frota própria, com detalhamento por tipo */}
            <div className="bg-white rounded-xl border p-4 shadow-sm" style={{ borderColor: '#C4B5FD' }}>
                <div className="flex items-center gap-4 mb-1">
                    <div className="rounded-xl flex items-center justify-center flex-shrink-0" style={{ width: 44, height: 44, background: '#EDE9FE' }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                    </div>
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-muted-foreground)' }}>Frete Total do Período — Frota Própria</p>
                        <p className="text-2xl font-black font-mono" style={{ color: '#7C3AED' }}>{BRL(freteTotal)}</p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted-foreground)' }}>soma de valor_frete_calculado · alimenta o Rel. Financeiro</p>
                    </div>
                </div>
                {freteTotal > 0 && (
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mt-3 pt-3 border-t" style={{ borderColor: '#EDE9FE' }}>
                        {tipoEntries.map(([key, t]) => {
                            const freteTipo = carregamentos.filter(r => parseTipo(r).tipo === key)
                                .reduce((s, r) => s + Number(r.valor_frete_calculado || 0), 0);
                            if (freteTipo === 0) return null;
                            return (
                                <div key={key} className="text-xs">
                                    <p className="font-medium" style={{ color: t.color }}>{t.label}</p>
                                    <p className="font-mono font-bold" style={{ color: 'var(--color-text-primary)' }}>{BRL(freteTipo)}</p>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Tabela de últimos carregamentos (resumo) */}
            {carregamentos.length > 0 && (
                <div className="bg-white rounded-xl border shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
                    <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--color-border)' }}>
                        <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Últimos carregamentos</p>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm min-w-[600px]">
                            <thead className="text-xs border-b" style={{ background: 'var(--color-muted)', borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                                <tr>
                                    {['Data', 'Tipo', 'Fornecedor', 'Placa', 'Destino', 'Qtd (sacos)'].map(h => (
                                        <th key={h} className="px-3 py-2.5 text-left font-medium whitespace-nowrap">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {carregamentos.slice(0, 8).map((r, i) => {
                                    const { tipo, nome } = parseTipo(r);
                                    return (
                                        <tr key={r.id} className="border-t hover:bg-gray-50" style={{ borderColor: 'var(--color-border)', background: i % 2 === 0 ? '#fff' : '#F8FAFC' }}>
                                            <td className="px-3 py-2.5 whitespace-nowrap">{FMT(r.data_carregamento)}</td>
                                            <td className="px-3 py-2.5"><TipoBadge tipo={tipo} /></td>
                                            <td className="px-3 py-2.5 max-w-[140px] truncate text-xs" style={{ color: 'var(--color-muted-foreground)' }}>{nome || '—'}</td>
                                            <td className="px-3 py-2.5 font-mono text-xs">{r.veiculo?.placa || r.placa_terceiro || r.veiculo_id || '—'}</td>
                                            <td className="px-3 py-2.5 text-xs max-w-[120px] truncate">{r.destino || '—'}</td>
                                            <td className="px-3 py-2.5 font-bold font-mono text-right">{fmtNum(r.quantidade)}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    {carregamentos.length > 8 && (
                        <div className="px-4 py-2 border-t text-xs text-center" style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                            + {carregamentos.length - 8} registros — veja todos na aba "Registros"
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
