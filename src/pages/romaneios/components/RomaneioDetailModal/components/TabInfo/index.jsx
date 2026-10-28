import React from 'react';

import { AppIcon as Icon } from 'components';
import { getTelhaInfo } from 'utils/telhaUtils';

import InfoCard from '../InfoCard';
import { n } from '../../utils/helpers';

// ─── tab === 'info' ───
export default function TabInfo({ itens, pedidos, pesoTotal, romaneio }) {
    return (
        <div className="flex flex-col gap-4">
                            <div className="grid grid-cols-2 gap-3">
                                <InfoCard icon="User"    label="Motorista"     value={romaneio.motorista || '—'} />
                                <InfoCard icon="Truck"   label="Placa"         value={romaneio.placa || '—'} />
                                <InfoCard icon="MapPin"  label="Destino"       value={romaneio.destino || '—'} />
                                <InfoCard icon="Clock"   label="Saída Prevista" value={romaneio.saida ? new Date(romaneio.saida).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '—'} />
                                <InfoCard icon="CheckCircle2" label="Chegada" value={romaneio.chegada ? new Date(romaneio.chegada).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '—'} />
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
                                                {itens.map((item, i) => {
                                                    const { isTelha, compTelha, metros } = getTelhaInfo(item);
                                                    return (
                                                        <tr key={i} className="border-t" style={{ borderColor:'var(--color-border)' }}>
                                                            <td className="px-3 py-2" style={{ color:'var(--color-text-primary)' }}>
                                                                {item.materials?.nome || `Material #${item.material_id}`}
                                                                {isTelha && compTelha > 0 && (
                                                                    <span className="ml-1 text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                                                                        (peça {compTelha.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}m)
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td className="px-3 py-2 text-center font-data text-xs" style={{ color:'var(--color-text-secondary)' }}>
                                                                {isTelha
                                                                    ? <>{item.quantidade} pç <span style={{ color: 'var(--color-muted-foreground)' }}>({metros.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} m)</span></>
                                                                    : <>{item.quantidade} {item.materials?.unidade}</>}
                                                            </td>
                                                            <td className="px-3 py-2 text-right font-data text-xs" style={{ color:'var(--color-text-secondary)' }}>{n(item.peso_total).toLocaleString('pt-BR',{minimumFractionDigits:2})} kg</td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
    );
}
