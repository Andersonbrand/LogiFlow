import React from 'react';

import { AppIcon as Icon, PaginationBar } from 'components';

import { BRL, FMT_DATE } from '../../utils/helpers';

// ─── tab === 'viagens' ───
export default function TabViagens({ carregamentosComBonus, romaneiosFerragem, romaneiosPrincipais, romaneiosPrincipaisPag }) {
    return (
        <div className="flex flex-col gap-4">
                                            {/* ── Romaneios do Sistema Principal ─── */}
                                        {romaneiosPrincipais.length > 0 && (
                                                <div>
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#EFF6FF' }}>
                                                            <Icon name="FileText" size={14} color="#1D4ED8" />
                                                        </div>
                                                        <h3 className="font-heading font-semibold text-sm" style={{ color: 'var(--color-text-primary)' }}>
                                                            Romaneios Lançados pelo Admin
                                                        </h3>
                                                        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: '#EFF6FF', color: '#1D4ED8' }}>
                                                            {romaneiosPrincipais.length}
                                                        </span>
                                                    </div>
                                                    <div className="flex flex-col gap-2">
                                                        {romaneiosPrincipaisPag.pageItems.map(r => {
                                                            const nf = r.romaneio_pedidos?.[0]?.numero_pedido || '—';
                                                            const statusColors = {
                                                                'Aprovado': { bg: '#D1FAE5', text: '#065F46' },
                                                                'Pendente': { bg: '#FEF9C3', text: '#B45309' },
                                                                'Cancelado': { bg: '#FEE2E2', text: '#B91C1C' },
                                                            };
                                                            const sc = statusColors[r.status] || { bg: '#F3F4F6', text: '#6B7280' };
                                                            const frete = Number(r.valor_frete_calculado || r.valor_frete) || 0;
                                                            return (
                                                                <div key={r.id} className="bg-white rounded-xl border shadow-sm overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
                                                                    {/* Header do card */}
                                                                    <div className="flex items-center justify-between px-4 py-2.5 border-b" style={{ backgroundColor: '#F8FAFF', borderColor: '#DBEAFE' }}>
                                                                        <div className="flex items-center gap-2">
                                                                            <Icon name="FileText" size={14} color="#1D4ED8" />
                                                                            <span className="text-xs font-semibold font-data" style={{ color: '#1D4ED8' }}>
                                                                                Romaneio #{r.numero || r.id?.slice(0, 8)}
                                                                            </span>
                                                                        </div>
                                                                        <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: sc.bg, color: sc.text }}>
                                                                            {r.status || 'Pendente'}
                                                                        </span>
                                                                    </div>
                                                                    {/* Corpo do card — grid 2 colunas */}
                                                                    <div className="p-4 grid grid-cols-2 gap-x-4 gap-y-3">
                                                                        <div>
                                                                            <p className="text-xs mb-0.5" style={{ color: 'var(--color-muted-foreground)' }}>Nota Fiscal</p>
                                                                            <p className="text-sm font-semibold font-data" style={{ color: 'var(--color-text-primary)' }}>{nf}</p>
                                                                        </div>
                                                                        <div style={{ display: 'none' }}>
                                                                            <p className="text-xs mb-0.5" style={{ color: 'var(--color-muted-foreground)' }}>Valor do Frete</p>
                                                                            <p className="text-sm font-bold font-data text-purple-600">{frete > 0 ? BRL(frete) : '—'}</p>
                                                                        </div>
                                                                        <div>
                                                                            <p className="text-xs mb-0.5" style={{ color: 'var(--color-muted-foreground)' }}>Motorista</p>
                                                                            <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{r.motorista || '—'}</p>
                                                                        </div>
                                                                        <div>
                                                                            <p className="text-xs mb-0.5" style={{ color: 'var(--color-muted-foreground)' }}>Placa</p>
                                                                            <p className="text-sm font-semibold font-data" style={{ color: 'var(--color-text-primary)' }}>{r.placa || '—'}</p>
                                                                        </div>
                                                                        <div className="col-span-2">
                                                                            <p className="text-xs mb-0.5" style={{ color: 'var(--color-muted-foreground)' }}>Destino</p>
                                                                            <div className="flex items-center gap-1.5">
                                                                                <Icon name="MapPin" size={13} color="#1D4ED8" />
                                                                                <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{r.destino || '—'}</p>
                                                                            </div>
                                                                        </div>
                                                                        {r.saida && (
                                                                            <div className="col-span-2 pt-2 border-t flex items-center gap-1.5" style={{ borderColor: 'var(--color-border)' }}>
                                                                                <Icon name="Calendar" size={13} color="var(--color-muted-foreground)" />
                                                                                <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                                                                                    Saída: {FMT_DATE(r.saida)}
                                                                                </p>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                    <PaginationBar page={romaneiosPrincipaisPag.page} setPage={romaneiosPrincipaisPag.setPage} totalPages={romaneiosPrincipaisPag.totalPages}
                                                        totalItems={romaneiosPrincipaisPag.totalItems} pageSize={romaneiosPrincipaisPag.pageSize} itemLabel="romaneio" itemLabelPlural="romaneios" className="rounded-xl border bg-white mt-2" />
                                                </div>
                                            )}

                                            {/* ── Romaneios de Ferragem lançados pelo motorista ─── */}
                                            {romaneiosFerragem.length > 0 && (
                                                <div>
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#FEF3C7' }}>
                                                            <Icon name="Wrench" size={14} color="#D97706" />
                                                        </div>
                                                        <h3 className="font-heading font-semibold text-sm" style={{ color: 'var(--color-text-primary)' }}>
                                                            Romaneios de Ferragem
                                                        </h3>
                                                        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: '#FEF3C7', color: '#D97706' }}>
                                                            {romaneiosFerragem.length}
                                                        </span>
                                                    </div>
                                                    <div className="flex flex-col gap-2">
                                                        {romaneiosFerragem.map(r => (
                                                            <div key={r.id} className="bg-white rounded-xl border shadow-sm overflow-hidden" style={{ borderColor: '#FDE68A' }}>
                                                                <div className="flex items-center justify-between px-4 py-2.5 border-b" style={{ backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }}>
                                                                    <div className="flex items-center gap-2">
                                                                        <Icon name="Wrench" size={14} color="#D97706" />
                                                                        <span className="text-xs font-semibold font-data" style={{ color: '#D97706' }}>
                                                                            Romaneio #{r.numero || '—'}
                                                                        </span>
                                                                        <span className="text-xs px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}>
                                                                            Ferragem
                                                                        </span>
                                                                    </div>
                                                                    <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: '#F3F4F6', color: '#6B7280' }}>
                                                                        {r.status || 'Aguardando'}
                                                                    </span>
                                                                </div>
                                                                <div className="p-4 grid grid-cols-2 gap-x-4 gap-y-2">
                                                                    {r.numero_nf && <div><p className="text-xs mb-0.5" style={{ color: 'var(--color-muted-foreground)' }}>Nota Fiscal</p><p className="text-sm font-semibold font-data">{r.numero_nf}</p></div>}
                                                                    {r.data_saida && <div><p className="text-xs mb-0.5" style={{ color: 'var(--color-muted-foreground)' }}>Data Saída</p><p className="text-sm font-medium font-data">{FMT_DATE(r.data_saida)}</p></div>}
                                                                    {r.toneladas && <div><p className="text-xs mb-0.5" style={{ color: 'var(--color-muted-foreground)' }}>Toneladas</p><p className="text-sm font-semibold font-data" style={{ color: '#7C3AED' }}>{Number(r.toneladas).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} ton</p></div>}
                                                                    {r.empresa && <div><p className="text-xs mb-0.5" style={{ color: 'var(--color-muted-foreground)' }}>Empresa</p><p className="text-sm font-medium">{r.empresa}</p></div>}
                                                                    {r.destino && <div className="col-span-2"><p className="text-xs mb-0.5" style={{ color: 'var(--color-muted-foreground)' }}>Destino</p><div className="flex items-center gap-1.5"><Icon name="MapPin" size={13} color="#D97706" /><p className="text-sm font-medium">{r.destino}</p></div></div>}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* ── Carregamentos (sistema de carretas) ─── */}
                                            <div>
                                                {(carregamentosComBonus.length > 0 || romaneiosPrincipais.length > 0) && (
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#D1FAE5' }}>
                                                            <Icon name="Package" size={14} color="#059669" />
                                                        </div>
                                                        <h3 className="font-heading font-semibold text-sm" style={{ color: 'var(--color-text-primary)' }}>Carregamentos</h3>
                                                        {carregamentosComBonus.length > 0 && (
                                                            <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: '#D1FAE5', color: '#065F46' }}>
                                                                {carregamentosComBonus.length}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                                {carregamentosComBonus.length === 0
                                                    ? (romaneiosPrincipais.length === 0 && romaneiosFerragem.length === 0
                                                        ? <div className="bg-white rounded-xl border p-8 flex flex-col items-center justify-center gap-2" style={{ borderColor: 'var(--color-border)' }}><Icon name="Package" size={28} color="var(--color-muted-foreground)" /><span className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Nenhuma viagem no período</span></div>
                                                        : null)
                                                    : carregamentosComBonus.map(c => (
                                                        <div key={c.id} className="bg-white rounded-xl border p-4 shadow-sm mb-2" style={{ borderColor: 'var(--color-border)' }}>
                                                            <div className="flex items-start justify-between mb-2">
                                                                <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{c.destino || '—'}</p>
                                                                <span className="font-data font-bold text-purple-600 text-sm">{BRL(c.bonus)}</span>
                                                            </div>
                                                            <div className="flex items-center justify-between text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                                                                <div className="flex items-center gap-3">
                                                                    {c.data_carregamento && <span>{new Date(c.data_carregamento + 'T00:00:00').toLocaleDateString('pt-BR')}</span>}
                                                                    {c.veiculo?.placa && <span className="font-data">{c.veiculo.placa}</span>}
                                                                    {c.empresa?.nome && <span className="px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium">{c.empresa.nome}</span>}
                                                                </div>
                                                                <span className="font-data font-medium" style={{ color: 'var(--color-primary)' }}>
                                                                    {(Number(c.quantidade) || 0).toLocaleString('pt-BR')} sacos
                                                                </span>
                                                            </div>
                                                            {c.numero_nota_fiscal && (
                                                                <p className="text-xs mt-1" style={{ color: 'var(--color-muted-foreground)' }}>NF: {c.numero_nota_fiscal}</p>
                                                            )}
                                                        </div>
                                                    ))
                                                }
                                            </div>
                                        </div>
    );
}
