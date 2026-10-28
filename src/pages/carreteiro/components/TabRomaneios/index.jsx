import React from 'react';

import { AppIcon as Icon } from 'components';

import { FMT_DATE } from '../../utils/helpers';

// ─── tab === 'romaneios' ───
export default function TabRomaneios({ romaneiosCarreteiroFiltrados }) {
    return (
        <div className="flex flex-col gap-3">
                                            {/* Header informativo */}
                                            <div className="flex items-center gap-2 p-3 rounded-xl border"
                                                style={{ backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }}>
                                                <Icon name="Info" size={15} color="#1D4ED8" />
                                                <p className="text-xs" style={{ color: '#1D4ED8' }}>
                                                    Romaneios e viagens lançados pelo administrador e vinculados ao seu perfil.
                                                </p>
                                            </div>

                                            {romaneiosCarreteiroFiltrados.length === 0 ? (
                                                <div className="bg-white rounded-xl border p-10 flex flex-col items-center justify-center gap-3"
                                                    style={{ borderColor: 'var(--color-border)' }}>
                                                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#EFF6FF' }}>
                                                        <Icon name="FileText" size={28} color="#1D4ED8" />
                                                    </div>
                                                    <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>Nenhum romaneio encontrado</p>
                                                    <p className="text-xs text-center" style={{ color: 'var(--color-muted-foreground)' }}>
                                                        Quando o admin lançar um romaneio para você, ele aparecerá aqui.
                                                    </p>
                                                </div>
                                            ) : romaneiosCarreteiroFiltrados.map(r => {
                                                const STATUS_ROM = {
                                                    'Aguardando':        { bg: '#FEF9C3', text: '#B45309', icon: 'Clock' },
                                                    'Carregando':        { bg: '#FEF3C7', text: '#D97706', icon: 'Package' },
                                                    'Em Trânsito':       { bg: '#D1FAE5', text: '#065F46', icon: 'Truck' },
                                                    'Entrega finalizada':{ bg: '#DCFCE7', text: '#15803D', icon: 'CheckCircle2' },
                                                    'Cancelado':         { bg: '#FEE2E2', text: '#B91C1C', icon: 'XCircle' },
                                                };
                                                const sc = STATUS_ROM[r.status] || { bg: '#F3F4F6', text: '#6B7280', icon: 'FileText' };
                                                const itens = r.carretas_romaneio_itens || [];
                                                const pesoTotal = itens.reduce((s, i) => s + Number(i.peso_total || i.quantidade || 0), 0);
                                                const nfs = r.numero_nf || itens.map(i => i.descricao).filter(Boolean).join(', ');
                                                return (
                                                    <div key={r.id} className="bg-white rounded-xl border shadow-sm overflow-hidden"
                                                        style={{ borderColor: 'var(--color-border)' }}>
                                                        {/* Header */}
                                                        <div className="flex items-center justify-between px-4 py-3 border-b"
                                                            style={{ backgroundColor: '#F8FAFF', borderColor: '#DBEAFE' }}>
                                                            <div className="flex items-center gap-2">
                                                                <Icon name="FileText" size={15} color="#1D4ED8" />
                                                                <span className="font-semibold text-sm font-data" style={{ color: '#1D4ED8' }}>
                                                                    Romaneio #{r.numero}
                                                                </span>
                                                                {r.aprovado && (
                                                                    <span className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full font-medium"
                                                                        style={{ backgroundColor: '#D1FAE5', color: '#065F46' }}>
                                                                        <Icon name="CheckCircle2" size={10} />Aprovado
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium"
                                                                style={{ backgroundColor: sc.bg, color: sc.text }}>
                                                                <Icon name={sc.icon} size={11} />{r.status}
                                                            </span>
                                                        </div>

                                                        {/* Grid de informações */}
                                                        <div className="p-4 grid grid-cols-2 gap-x-4 gap-y-3">
                                                            {/* NF / Descrição */}
                                                            <div className="col-span-2">
                                                                <p className="text-xs mb-0.5" style={{ color: 'var(--color-muted-foreground)' }}>Nota(s) Fiscal / Carga</p>
                                                                <p className="text-sm font-semibold font-data" style={{ color: 'var(--color-text-primary)' }}>
                                                                    {nfs || '—'}
                                                                </p>
                                                            </div>

                                                            {/* Data saída */}
                                                            <div>
                                                                <p className="text-xs mb-0.5" style={{ color: 'var(--color-muted-foreground)' }}>Data Saída</p>
                                                                <div className="flex items-center gap-1">
                                                                    <Icon name="Calendar" size={13} color="#1D4ED8" />
                                                                    <p className="text-sm font-medium font-data" style={{ color: 'var(--color-text-primary)' }}>
                                                                        {r.data_saida ? FMT_DATE(r.data_saida) : '—'}
                                                                    </p>
                                                                </div>
                                                            </div>

                                                            {/* Peso total */}
                                                            <div>
                                                                <p className="text-xs mb-0.5" style={{ color: 'var(--color-muted-foreground)' }}>Peso / Toneladas</p>
                                                                <div className="flex items-center gap-1">
                                                                    <Icon name="Weight" size={13} color="#7C3AED" />
                                                                    <p className="text-sm font-semibold font-data" style={{ color: '#7C3AED' }}>
                                                                        {(pesoTotal || Number(r.toneladas) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} ton
                                                                    </p>
                                                                </div>
                                                            </div>

                                                            {/* Placa */}
                                                            <div>
                                                                <p className="text-xs mb-0.5" style={{ color: 'var(--color-muted-foreground)' }}>Placa</p>
                                                                <p className="text-sm font-semibold font-data" style={{ color: 'var(--color-text-primary)' }}>
                                                                    {r.veiculo?.placa || '—'}
                                                                </p>
                                                            </div>

                                                            {/* Empresa */}
                                                            {r.empresa && (
                                                                <div>
                                                                    <p className="text-xs mb-0.5" style={{ color: 'var(--color-muted-foreground)' }}>Empresa</p>
                                                                    <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{r.empresa}</p>
                                                                </div>
                                                            )}

                                                            {/* Destino */}
                                                            <div className="col-span-2">
                                                                <p className="text-xs mb-0.5" style={{ color: 'var(--color-muted-foreground)' }}>Destino</p>
                                                                <div className="flex items-center gap-1.5">
                                                                    <Icon name="MapPin" size={13} color="#1D4ED8" />
                                                                    <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{r.destino || '—'}</p>
                                                                </div>
                                                            </div>

                                                            {/* Frete oculto para motorista */}

                                                            {/* Observações */}
                                                            {r.observacoes && (
                                                                <div className="col-span-2 pt-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
                                                                    <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>{r.observacoes}</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
    );
}
