import React from 'react';

import { kmRodado } from 'services/pneusService';
import { ActionButtonsGroup, AppIcon as Icon, EditButton, DeleteButton } from 'components';

import { BANDAGEM_LABEL } from '../../utils/constants';

const BANDAGEM_COR = { mista: '#7C3AED', borrachudo: '#D97706', liso: '#2563EB' };

// ─── Painel: Lista/cadastro de pneus ───────────────────────────────────────
// Uma linha da tabela de pneus. Reutilizada tanto para pneus avulsos quanto
// para os que aparecem dentro de um grupo expandido (troca em lote).
export default function LinhaPneu({ p, isAdmin, indent = false, stripe = false, onSubstituir, onEditar, onExcluir }) {
    const km = kmRodado(p);
    return (
        <tr className="border-t hover:bg-blue-50/30 transition-colors"
            style={{ borderColor: 'var(--color-border)', backgroundColor: indent ? '#F8FAFC' : (stripe ? 'white' : '#F9FAFB') }}>
            <td className="px-3 py-2.5 whitespace-nowrap" style={indent ? { paddingLeft: '2.25rem' } : undefined}>
                {p.numero_sequencial ? (
                    <div className="flex flex-col gap-0.5">
                        <span className="font-data font-semibold">{p.numero_sequencial}</span>
                        <span className="w-fit px-1.5 py-0.5 rounded text-[10px] font-medium"
                            style={{ backgroundColor: p.tipo_pneu === 'recapado' ? '#FEF3C7' : '#D1FAE5', color: p.tipo_pneu === 'recapado' ? '#B45309' : '#059669' }}>
                            {p.tipo_pneu === 'recapado' ? 'Recapado' : 'Novo'}
                        </span>
                    </div>
                ) : '—'}
            </td>
            <td className="px-3 py-2.5 font-semibold whitespace-nowrap" style={{ color: 'var(--color-text-primary)' }}>{p.veiculo?.placa || p.veiculo_caminhao_placa || '—'}</td>
            <td className="px-3 py-2.5 whitespace-nowrap">{p.motorista?.name || '—'}</td>
            <td className="px-3 py-2.5 whitespace-nowrap">{p.marca}{p.modelo ? ` — ${p.modelo}` : ''}</td>
            <td className="px-3 py-2.5 font-data">{p.medida || '—'}</td>
            <td className="px-3 py-2.5">
                <span className="px-1.5 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: `${BANDAGEM_COR[p.categoria_bandagem]}1A`, color: BANDAGEM_COR[p.categoria_bandagem] }}>
                    {BANDAGEM_LABEL[p.categoria_bandagem] || '—'}
                </span>
            </td>
            <td className="px-3 py-2.5 max-w-[140px] truncate" title={p.eixo_trocado}>{p.eixo_trocado || '—'}</td>
            <td className="px-3 py-2.5 font-data text-right">{p.km_atual != null ? Number(p.km_atual).toLocaleString('pt-BR') : '—'}</td>
            <td className="px-3 py-2.5 font-data text-right">{p.km_final != null ? Number(p.km_final).toLocaleString('pt-BR') : '—'}</td>
            <td className="px-3 py-2.5 font-data text-right font-bold" style={{ color: '#059669' }}>{km != null ? km.toLocaleString('pt-BR') : '—'}</td>
            <td className="px-3 py-2.5 max-w-[130px] truncate" title={p.compra?.despesa?.nota_fiscal}>
                {p.compra?.despesa?.nota_fiscal ? `NF ${p.compra.despesa.nota_fiscal}` : '—'}
            </td>
            <td className="px-3 py-2.5">
                {p.status === 'em_uso' ? (
                    <span className="px-2 py-1 rounded-lg text-xs font-medium bg-green-100 text-green-700 whitespace-nowrap">Em uso</span>
                ) : (
                    <span className="px-2 py-1 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 whitespace-nowrap">Substituído</span>
                )}
            </td>
            <td className="px-2 py-2.5">
                {isAdmin && (
                    <ActionButtonsGroup>
                        {p.status === 'em_uso' && (
                            <button onClick={onSubstituir} title="Registrar substituição"
                                className="p-1.5 rounded-lg hover:bg-amber-50" style={{ color: '#D97706' }}>
                                <Icon name="RefreshCw" size={14} color="#D97706" />
                            </button>
                        )}
                        <EditButton title="Editar" onClick={onEditar} />
                        <DeleteButton title="Excluir" onClick={onExcluir} />
                    </ActionButtonsGroup>
                )}
            </td>
        </tr>
    );
}
