import React, { useState } from 'react';
import Icon from 'components/AppIcon';
import Button from 'components/ui/Button';
import { exportRomaneioModelo1 } from 'utils/excelUtils';
import { getCategoriaConfig, fmtPct } from 'utils/freteConfig';
import { useAuth } from 'utils/AuthContext';

const STATUS_COLORS = {
    'Aguardando':  { bg:'#FEF9C3', text:'#B45309', border:'#FDE68A' },
    'Carregando':  { bg:'#DBEAFE', text:'#1D4ED8', border:'#BFDBFE' },
    'Em Trânsito': { bg:'#D1FAE5', text:'#065F46', border:'#A7F3D0' },
    'Finalizado':  { bg:'#F3F4F6', text:'#374151', border:'#E5E7EB' },
    'Cancelado':   { bg:'#FEE2E2', text:'#991B1B', border:'#FECACA' },
};
const brl = v => Number(v||0).toLocaleString('pt-BR',{ style:'currency', currency:'BRL' });
const n   = v => Number(v||0);

export default function RomaneioDetailModal({ isOpen, onClose, romaneio, onEdit, onDelete }) {
    const [tab, setTab] = useState('info');
    const { isAdmin } = useAuth();
    if (!isOpen || !romaneio) return null;

    const aprovado = romaneio.aprovado === true;
    const podeExportar = aprovado || isAdmin();

    const s = STATUS_COLORS[romaneio.status] || STATUS_COLORS['Aguardando'];
    const pedidos = romaneio.romaneio_pedidos || [];
    const itens   = romaneio.romaneio_itens   || [];
    const pesoTotal = n(romaneio.peso_total) || itens.reduce((a,i)=>a+n(i.peso_total),0);

    const custoOp  = n(romaneio.custo_combustivel)+n(romaneio.custo_pedagio)+n(romaneio.custo_motorista);
    const frete    = n(romaneio.valor_frete_calculado || romaneio.valor_frete);
    const margem   = frete - custoOp;
    const valorCarga = n(romaneio.valor_total_carga) || pedidos.reduce((a,p)=>a+n(p.valor_pedido),0);

    const mapsQuery    = romaneio.destino ? encodeURIComponent(romaneio.destino+', Brasil') : null;
    const mapsEmbedUrl = mapsQuery ? `https://maps.google.com/maps?q=${mapsQuery}&output=embed&z=8` : null;
    const mapsLinkUrl  = mapsQuery ? `https://www.google.com/maps/search/${mapsQuery}` : null;

    const TABS = [
        ['info',      'Informações',  'FileText'],
        ['pedidos',   `Pedidos (${pedidos.length})`,'ShoppingCart'],
        ['mapa',      'Rota no Mapa', 'Map'],
        ['financeiro','Financeiro',   'DollarSign'],
    ];

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)' }} onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor:'var(--color-border)' }}>
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="font-heading font-bold text-lg" style={{ color:'var(--color-text-primary)' }}>{romaneio.numero}</span>
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium border font-caption"
                                style={{ backgroundColor:s.bg, color:s.text, borderColor:s.border }}>
                                {romaneio.status}
                            </span>
                        </div>
                        <p className="text-xs font-caption" style={{ color:'var(--color-muted-foreground)' }}>
                            Criado em {new Date(romaneio.created_at).toLocaleDateString('pt-BR')}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        {podeExportar ? (
                            <button
                                onClick={() => exportRomaneioModelo1(romaneio)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-caption font-medium border hover:bg-green-50 transition-colors"
                                style={{ borderColor:'var(--color-border)', color:'#059669' }}
                                title="Exportar no modelo Excel Araguaia">
                                <Icon name="FileSpreadsheet" size={14} color="#059669" />
                                Exportar Excel
                            </button>
                        ) : (
                            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-caption font-medium border cursor-not-allowed"
                                style={{ borderColor:'#FDE68A', color:'#B45309', backgroundColor:'#FEF9C3' }}
                                title="Aguardando aprovação do administrador">
                                <Icon name="Clock" size={14} color="#B45309" />
                                Aguard. Aprovação
                            </div>
                        )}
                        <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100">
                            <Icon name="X" size={18} color="var(--color-muted-foreground)" />
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b px-4 overflow-x-auto" style={{ borderColor:'var(--color-border)' }}>
                    {TABS.map(([key, label, icon]) => (
                        <button key={key} onClick={() => setTab(key)}
                            className={`flex items-center gap-1.5 px-3 py-3 text-sm font-medium font-caption border-b-2 transition-colors whitespace-nowrap
                                ${tab===key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                            <Icon name={icon} size={13} color="currentColor" />
                            {label}
                        </button>
                    ))}
                </div>

                <div className="overflow-y-auto flex-1 px-6 py-5">

                    {/* ── INFO ──────────────────────────────────────── */}
                    {tab === 'info' && (
                        <div className="flex flex-col gap-4">
                            <div className="grid grid-cols-2 gap-3">
                                <InfoCard icon="User"    label="Motorista"     value={romaneio.motorista || '—'} />
                                <InfoCard icon="Truck"   label="Placa"         value={romaneio.placa || '—'} />
                                <InfoCard icon="MapPin"  label="Destino"       value={romaneio.destino || '—'} />
                                <InfoCard icon="Clock"   label="Saída Prevista" value={romaneio.saida ? new Date(romaneio.saida).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '—'} />
                                <InfoCard icon="Weight"  label="Peso Total"    value={`${pesoTotal.toLocaleString('pt-BR',{minimumFractionDigits:2})} kg`} />
                                <InfoCard icon="ShoppingCart" label="Pedidos"  value={`${pedidos.length} pedido(s)`} />
                            </div>
                            {romaneio.observacoes && (
                                <div className="rounded-lg p-3 border" style={{ backgroundColor:'var(--color-muted)', borderColor:'var(--color-border)' }}>
                                    <p className="text-xs font-semibold mb-1 font-caption" style={{ color:'var(--color-text-secondary)' }}>Observações</p>
                                    <p className="text-sm" style={{ color:'var(--color-text-primary)' }}>{romaneio.observacoes}</p>
                                </div>
                            )}
                            {itens.length > 0 && (
                                <div>
                                    <h4 className="text-sm font-semibold mb-2 font-caption flex items-center gap-1.5" style={{ color:'var(--color-text-primary)' }}>
                                        <Icon name="Package" size={14} color="var(--color-primary)" /> Materiais da Carga
                                    </h4>
                                    <div className="rounded-lg border overflow-hidden" style={{ borderColor:'var(--color-border)' }}>
                                        <table className="w-full text-sm">
                                            <thead className="text-xs font-caption" style={{ backgroundColor:'var(--color-muted)', color:'var(--color-muted-foreground)' }}>
                                                <tr>
                                                    <th className="px-3 py-2 text-left font-medium">Material</th>
                                                    <th className="px-3 py-2 text-center font-medium">Qtd</th>
                                                    <th className="px-3 py-2 text-right font-medium">Peso</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {itens.map((item, i) => (
                                                    <tr key={i} className="border-t" style={{ borderColor:'var(--color-border)' }}>
                                                        <td className="px-3 py-2" style={{ color:'var(--color-text-primary)' }}>{item.materials?.nome || `Material #${item.material_id}`}</td>
                                                        <td className="px-3 py-2 text-center font-data text-xs" style={{ color:'var(--color-text-secondary)' }}>{item.quantidade} {item.materials?.unidade}</td>
                                                        <td className="px-3 py-2 text-right font-data text-xs" style={{ color:'var(--color-text-secondary)' }}>{n(item.peso_total).toLocaleString('pt-BR',{minimumFractionDigits:2})} kg</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── PEDIDOS ───────────────────────────────────── */}
                    {tab === 'pedidos' && (
                        <div className="flex flex-col gap-3">
                            {pedidos.length === 0 ? (
                                <div className="text-center py-8" style={{ color:'var(--color-muted-foreground)' }}>
                                    <Icon name="ShoppingCart" size={32} color="currentColor" />
                                    <p className="text-sm mt-2">Nenhum pedido registrado neste romaneio.</p>
                                </div>
                            ) : pedidos.map((p, i) => {
                                const cfg     = getCategoriaConfig(p.categoria_frete);
                                const fretePed = n(p.frete_calculado) || n(p.valor_pedido) * (n(p.percentual_frete)||0.05);
                                // itens deste pedido
                                const pedItens = itens.filter(it => it.pedido_id === p.id);
                                return (
                                    <div key={i} className="rounded-xl border overflow-hidden" style={{ borderColor: cfg.cor }}>
                                        <div className="px-4 py-3 flex items-center justify-between"
                                            style={{ backgroundColor: cfg.bg }}>
                                            <div className="flex items-center gap-2">
                                                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
                                                    style={{ backgroundColor: cfg.cor }}>{i+1}</div>
                                                <div>
                                                    <p className="text-sm font-medium" style={{ color: cfg.cor }}>
                                                        {p.numero_pedido ? `Pedido ${p.numero_pedido}` : `Pedido ${i+1}`}
                                                    </p>
                                                    <p className="text-xs font-caption" style={{ color: cfg.cor, opacity:.7 }}>
                                                        {p.categoria_frete} · {fmtPct(p.percentual_frete)}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs font-caption" style={{ color: cfg.cor, opacity:.7 }}>Valor do pedido</p>
                                                <p className="text-sm font-data font-semibold" style={{ color: cfg.cor }}>{brl(p.valor_pedido)}</p>
                                            </div>
                                        </div>
                                        <div className="px-4 py-3 flex items-center justify-between border-t" style={{ borderColor: cfg.cor + '40' }}>
                                            <span className="text-xs font-caption" style={{ color:'var(--color-muted-foreground)' }}>
                                                Frete calculado: {fmtPct(p.percentual_frete)} × {brl(p.valor_pedido)}
                                            </span>
                                            <span className="text-sm font-data font-bold" style={{ color: cfg.cor }}>{brl(fretePed)}</span>
                                        </div>
                                        {pedItens.length > 0 && (
                                            <div className="px-4 pb-3">
                                                <p className="text-xs font-caption text-gray-400 mb-1.5">Materiais deste pedido</p>
                                                <div className="flex flex-wrap gap-1">
                                                    {pedItens.map((it, j) => (
                                                        <span key={j} className="text-[11px] px-2 py-0.5 rounded bg-gray-100 text-gray-600 font-caption">
                                                            {it.materials?.nome || `Mat.${it.material_id}`} × {it.quantidade}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                            {pedidos.length > 0 && (
                                <div className="rounded-xl border p-4 mt-1" style={{ backgroundColor:'var(--color-muted)', borderColor:'var(--color-border)' }}>
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm font-semibold" style={{ color:'var(--color-text-primary)' }}>Total Frete</span>
                                        <span className="text-lg font-bold font-data text-green-600">{brl(frete)}</span>
                                    </div>
                                    <div className="flex justify-between items-center mt-1">
                                        <span className="text-xs font-caption" style={{ color:'var(--color-muted-foreground)' }}>Valor Total da Carga</span>
                                        <span className="text-sm font-data font-semibold" style={{ color:'var(--color-text-primary)' }}>{brl(valorCarga)}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── MAPA ──────────────────────────────────────── */}
                    {tab === 'mapa' && (
                        <div className="flex flex-col gap-3">
                            {!romaneio.destino ? (
                                <div className="flex flex-col items-center justify-center py-12 gap-2" style={{ color:'var(--color-muted-foreground)' }}>
                                    <Icon name="MapPin" size={36} color="currentColor" />
                                    <p className="text-sm">Nenhum destino definido neste romaneio.</p>
                                </div>
                            ) : (
                                <>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Icon name="MapPin" size={15} color="var(--color-primary)" />
                                            <span className="text-sm font-medium" style={{ color:'var(--color-text-primary)' }}>
                                                Destino: <strong>{romaneio.destino}</strong>
                                            </span>
                                        </div>
                                        <a href={mapsLinkUrl} target="_blank" rel="noopener noreferrer"
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-caption font-medium border hover:bg-blue-50 transition-colors"
                                            style={{ borderColor:'var(--color-border)', color:'var(--color-primary)' }}>
                                            <Icon name="ExternalLink" size={12} color="currentColor" />
                                            Abrir no Google Maps
                                        </a>
                                    </div>
                                    <div className="rounded-xl overflow-hidden border" style={{ borderColor:'var(--color-border)', height:320 }}>
                                        <iframe title="Mapa do destino" width="100%" height="100%"
                                            loading="lazy" referrerPolicy="no-referrer-when-downgrade"
                                            src={mapsEmbedUrl} style={{ border:0 }} />
                                    </div>
                                    {n(romaneio.distancia_km) > 0 && (
                                        <div className="flex items-center gap-2 text-xs font-caption" style={{ color:'var(--color-muted-foreground)' }}>
                                            <Icon name="Route" size={13} color="currentColor" />
                                            Distância cadastrada: <strong className="font-data">{romaneio.distancia_km} km</strong>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    {/* ── FINANCEIRO ────────────────────────────────── */}
                    {tab === 'financeiro' && (
                        <div className="flex flex-col gap-4">
                            {valorCarga > 0 && (
                                <InfoCard icon="Package" label="Valor Total da Carga" value={brl(valorCarga)} />
                            )}
                            <div className="grid grid-cols-2 gap-3">
                                <InfoCard icon="TrendingUp"  label="Frete Calculado"   value={brl(frete)}                           color="#059669" />
                                <InfoCard icon="Route"       label="Distância"          value={n(romaneio.distancia_km)>0 ? `${romaneio.distancia_km} km` : '—'} />
                                <InfoCard icon="Fuel"        label="Combustível"        value={brl(romaneio.custo_combustivel)}       color="#DC2626" />
                                <InfoCard icon="Navigation"  label="Pedágios"           value={brl(romaneio.custo_pedagio)}           color="#DC2626" />
                                <InfoCard icon="User"        label="Diária Motorista"   value={brl(romaneio.custo_motorista)}         color="#DC2626" />
                                <InfoCard icon="DollarSign"  label="Custo Operacional"  value={brl(custoOp)}                          color="#DC2626" />
                            </div>
                            <div className="rounded-xl p-4 border" style={{ backgroundColor: margem>=0 ? '#F0FDF4':'#FEF2F2', borderColor: margem>=0 ? '#BBF7D0':'#FECACA' }}>
                                <div className="flex items-center justify-between">
                                    <span className="font-heading font-semibold text-sm" style={{ color: margem>=0 ? '#065F46':'#991B1B' }}>
                                        Margem da Viagem
                                    </span>
                                    <span className="font-bold font-data text-xl" style={{ color: margem>=0 ? '#059669':'#DC2626' }}>
                                        {margem>=0 ? '+':''}{brl(margem)}
                                    </span>
                                </div>
                                {frete > 0 && (
                                    <p className="text-xs mt-1 font-caption" style={{ color: margem>=0 ? '#065F46':'#991B1B', opacity:.7 }}>
                                        {((margem/frete)*100).toFixed(1)}% de margem sobre o frete
                                    </p>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t flex justify-between gap-2" style={{ borderColor:'var(--color-border)' }}>
                    <Button variant="danger" size="sm" iconName="Trash2" iconSize={14}
                        onClick={() => { onDelete(romaneio.id); onClose(); }}>
                        Excluir
                    </Button>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={onClose}>Fechar</Button>
                        <Button variant="default" iconName="Pencil" iconSize={14}
                            onClick={() => { onEdit(romaneio); onClose(); }}>
                            Editar
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function InfoCard({ icon, label, value, color }) {
    return (
        <div className="rounded-lg p-3 border" style={{ backgroundColor:'var(--color-muted)', borderColor:'var(--color-border)' }}>
            <div className="flex items-center gap-1.5 mb-1">
                <Icon name={icon} size={12} color="var(--color-muted-foreground)" />
                <span className="text-xs font-caption" style={{ color:'var(--color-muted-foreground)' }}>{label}</span>
            </div>
            <p className="text-sm font-medium font-data" style={{ color: color || 'var(--color-text-primary)' }}>{value}</p>
        </div>
    );
}
