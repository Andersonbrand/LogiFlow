import React from 'react';

import { STATUS_ROMANEIO_COLORS } from 'services/carretas';
import { parseParadas, AppIcon as Icon, ModalHeader } from 'components';
import { calcularFretePedidoMulti } from 'config/freteConfig';
import { exportRomaneioModelo1, toModelo1Romaneio, printRomaneioCarretas } from 'utils/excel';

import ModalOverlay from '../ModalOverlay';
import { FMT_DATE, BRL } from '../../utils/helpers';
import { TIPOS_CALCULO_FRETE_ROMANEIO } from '../../utils/constants';

function StatusBadge({ status }) {
    const cfg = STATUS_ROMANEIO_COLORS[status] || STATUS_ROMANEIO_COLORS['Aguardando'];
    return (
        <span className="px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap"
            style={{ backgroundColor: cfg.bg, color: cfg.text }}>
            {status}
        </span>
    );
}

// ─── Modal de detalhe ──────────────────────────────────────────────────────────
export default function RomaneioDetailModal({ romaneio, onClose }) {
    if (!romaneio) return null;
    return (
        <ModalOverlay onClose={onClose}>
            <ModalHeader title={`Romaneio ${romaneio.numero}`} icon="FileText" onClose={onClose} />
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {[
                        { l: 'Status',      v: <StatusBadge status={romaneio.status} /> },
                        { l: 'Motorista',   v: romaneio.motorista?.name || '—' },
                        { l: 'Placa',       v: romaneio.veiculo?.placa  || '—' },
                        { l: 'Destino',     v: romaneio.destino          || '—' },
                        { l: 'Cidades adicionais', v: parseParadas(romaneio.paradas).length > 0 ? parseParadas(romaneio.paradas).join(', ') : '—' },
                        { l: 'Data Saída',  v: FMT_DATE(romaneio.data_saida) },
                        { l: 'Data Chegada',v: FMT_DATE(romaneio.data_chegada) },
                        { l: 'Modo de frete', v: TIPOS_CALCULO_FRETE_ROMANEIO.find(t => t.value === (romaneio.tipo_calculo_frete || 'percentual_pedido'))?.label || '—' },
                        ...(romaneio.tipo_calculo_frete === 'valor_fixo' && romaneio.frete_fixo_responsavel
                            ? [{ l: 'Frete combinado com', v: `${romaneio.frete_fixo_responsavel}${romaneio.frete_fixo_combinado_em ? ' em ' + FMT_DATE(romaneio.frete_fixo_combinado_em) : ''}` }]
                            : []),
                    ].map(({ l, v }) => (
                        <div key={l} className="p-3 rounded-xl border" style={{ borderColor: 'var(--color-border)' }}>
                            <p className="text-xs mb-1" style={{ color: 'var(--color-muted-foreground)' }}>{l}</p>
                            <div className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{v}</div>
                        </div>
                    ))}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                        { l: 'Valor da Carga', v: romaneio.valor_carga ? BRL(romaneio.valor_carga) : '—', color: '#065F46' },
                        { l: 'Frete',          v: romaneio.valor_frete  ? BRL(romaneio.valor_frete)  : '—', color: '#7C3AED' },
                        { l: 'Frete sobre a carga', v: (Number(romaneio.valor_carga) > 0)
                            ? `${((Number(romaneio.valor_frete || 0) / Number(romaneio.valor_carga)) * 100).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
                            : '—', color: '#DB2777' },
                        { l: 'Peso Total',     v: (() => {
                            const p = (romaneio.itens || []).reduce((s, it) => s + Number(it.peso_total || 0), 0);
                            return p > 0 ? `${p.toLocaleString('pt-BR')} kg` : (romaneio.toneladas ? `${Number(romaneio.toneladas).toLocaleString('pt-BR')} t` : '—');
                        })(), color: '#B45309' },
                    ].map(({ l, v, color }) => (
                        <div key={l} className="p-3 rounded-xl border" style={{ borderColor: 'var(--color-border)' }}>
                            <p className="text-xs mb-1" style={{ color: 'var(--color-muted-foreground)' }}>{l}</p>
                            <p className="text-base font-bold font-data" style={{ color }}>{v}</p>
                        </div>
                    ))}
                </div>
                {(romaneio.pedidos?.length || 0) > 0 && (
                    <div>
                        <p className="text-sm font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>
                            Pedidos ({romaneio.pedidos.length})
                        </p>
                        <div className="space-y-2">
                            {romaneio.pedidos.map(p => {
                                const freteMulti = calcularFretePedidoMulti(p);
                                return (
                                    <div key={p.id} className="p-3 rounded-xl border" style={{ borderColor: '#E9D5FF', backgroundColor: '#FAF5FF' }}>
                                        <div className="flex items-center justify-between flex-wrap gap-1">
                                            <span className="text-xs font-data font-semibold" style={{ color: '#7C3AED' }}>
                                                {p.numero_pedido ? `#${p.numero_pedido}` : 'Sem número'}
                                            </span>
                                            <span className="text-xs font-data font-semibold" style={{ color: '#7C3AED' }}>{BRL(freteMulti.total)} de frete</span>
                                        </div>
                                        <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                                            {p.nome_cliente && <span><span style={{ color: 'var(--color-muted-foreground)' }}>Cliente: </span>{p.nome_cliente}</span>}
                                            {p.nome_vendedor && <span><span style={{ color: 'var(--color-muted-foreground)' }}>Vendedor: </span>{p.nome_vendedor}</span>}
                                            {p.cidade_destino && <span><span style={{ color: 'var(--color-muted-foreground)' }}>Cidade: </span>{p.cidade_destino}</span>}
                                            {p.empresa && <span><span style={{ color: 'var(--color-muted-foreground)' }}>Empresa: </span>{p.empresa}</span>}
                                            <span><span style={{ color: 'var(--color-muted-foreground)' }}>Valor: </span>{BRL(p.valor_pedido)}</span>
                                            <span><span style={{ color: 'var(--color-muted-foreground)' }}>Categoria: </span>{p.categoria_frete}{Array.isArray(p.categorias_extra) && p.categorias_extra.length > 0 ? ` +${p.categorias_extra.length}` : ''}</span>
                                        </div>
                                        {p.observacao && (
                                            <p className="mt-1.5 text-xs italic px-2 py-1.5 rounded-lg bg-white" style={{ color: '#7C3AED', border: '1px dashed #E9D5FF' }}>
                                                💬 {p.observacao}
                                            </p>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
                {(romaneio.itens?.length || 0) > 0 && (
                    <div>
                        <p className="text-sm font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>
                            Materiais ({romaneio.itens.length})
                        </p>
                        <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
                            <table className="w-full text-sm">
                                <thead className="text-xs border-b"
                                    style={{ backgroundColor: 'var(--color-muted)', borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                                    <tr>
                                        {['Material','Qtd','Unid.','Peso (kg)'].map(h => (
                                            <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {romaneio.itens.map((it, i) => (
                                        <tr key={it.id} className="border-t"
                                            style={{ borderColor: 'var(--color-border)', backgroundColor: i % 2 === 0 ? '#fff' : '#F8FAFC' }}>
                                            <td className="px-3 py-2 font-medium">{it.material?.nome || it.descricao || '—'}</td>
                                            <td className="px-3 py-2 font-data">{Number(it.quantidade).toLocaleString('pt-BR')}</td>
                                            <td className="px-3 py-2">{it.unidade}</td>
                                            <td className="px-3 py-2 font-data">{it.peso_total ? Number(it.peso_total).toLocaleString('pt-BR') : '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
                {romaneio.observacoes && (
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800">
                        <p className="font-medium mb-0.5">Observações:</p>
                        <p>{romaneio.observacoes}</p>
                    </div>
                )}
            </div>
            <div className="flex gap-3 p-5 justify-end border-t flex-shrink-0">
                {(romaneio.pedidos || []).length > 0 && (
                    <button onClick={() => exportRomaneioModelo1(toModelo1Romaneio(romaneio))}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium hover:bg-green-50"
                        style={{ borderColor: '#A7F3D0', color: '#059669' }}
                        title="Exportar no modelo Excel Araguaia (mesmo modelo dos caminhões)">
                        <Icon name="FileSpreadsheet" size={14} color="#059669" /> Exportar Excel
                    </button>
                )}
                <button onClick={() => printRomaneioCarretas(romaneio)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50"
                    style={{ borderColor: 'var(--color-border)' }}>
                    <Icon name="Printer" size={14} /> Imprimir
                </button>
                <button onClick={onClose}
                    className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50"
                    style={{ borderColor: 'var(--color-border)' }}>
                    Fechar
                </button>
            </div>
        </ModalOverlay>
    );
}
