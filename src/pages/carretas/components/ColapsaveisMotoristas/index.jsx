import React from 'react';
import { BRL } from '../../utils/helpers';

// ─── TAB: Bonificações (visão admin) ─────────────────────────────────────────
// ─── Cards colapsáveis de bônus por motorista ─────────────────────────────────
export default function ColapsaveisMotoristas({ motoristas }) {
    const [aberto, setAberto] = React.useState(null); // só um card aberto por vez
    const toggle = nome => setAberto(prev => (prev === nome ? null : nome));

    return (
        <div className="mb-5">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 items-start">
                {motoristas.map(m => {
                    const open = aberto === m.nome;
                    return (
                        <div
                            key={m.nome}
                            className="bg-white rounded-xl border shadow-sm overflow-hidden transition-all"
                            style={{ borderColor: open ? 'var(--color-primary)' : 'var(--color-border)', boxShadow: open ? '0 4px 16px rgba(0,0,0,0.10)' : undefined }}>
                            {/* ── Cabeçalho clicável (sempre visível) ── */}
                            <button
                                onClick={() => toggle(m.nome)}
                                className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left transition-colors hover:bg-gray-50"
                                style={{ background: open ? '#EFF6FF' : undefined }}>
                                <div className="flex items-center gap-2 min-w-0">
                                    <div
                                        className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold"
                                        style={{ backgroundColor: 'var(--color-primary)' }}>
                                        {m.nome[0]?.toUpperCase()}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-xs font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>{m.nome}</p>
                                        <p className="text-xs font-bold font-data text-emerald-600 leading-tight">{BRL(m.bonusTotal)}</p>
                                    </div>
                                </div>
                                <svg
                                    width="14" height="14" viewBox="0 0 24 24" fill="none"
                                    stroke="var(--color-muted-foreground)" strokeWidth="2.5" strokeLinecap="round"
                                    style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform .2s' }}>
                                    <polyline points="6 9 12 15 18 9" />
                                </svg>
                            </button>

                            {/* ── Corpo expandido ── */}
                            <div style={{
                                maxHeight: open ? '400px' : '0px',
                                overflow: 'hidden',
                                transition: 'max-height .25s ease',
                            }}>
                                <div className="px-3 pb-3 pt-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
                                    {/* Resumo financeiro */}
                                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mb-2.5 text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                                        <span>{m.carregamentos} carreg.</span>
                                        <span>Viagens: <strong className="text-purple-600">{BRL(m.bonusViagens)}</strong></span>
                                        {m.bonusExtras > 0 && <span>Extras: <strong className="text-amber-600">{BRL(m.bonusExtras)}</strong></span>}
                                    </div>
                                    {/* Notas fiscais */}
                                    {m.notas?.length > 0 && (
                                        <div>
                                            <p className="text-xs font-semibold mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Notas Fiscais</p>
                                            <div className="flex flex-wrap gap-1">
                                                {m.notas.map((nf, idx) => (
                                                    <span
                                                        key={idx}
                                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium"
                                                        style={{ backgroundColor: '#EFF6FF', color: '#1D4ED8' }}>
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                                            <polyline points="14 2 14 8 20 8"/>
                                                        </svg>
                                                        NF {nf}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {(!m.notas || m.notas.length === 0) && (
                                        <p className="text-xs italic" style={{ color: 'var(--color-muted-foreground)' }}>Sem notas no período</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
