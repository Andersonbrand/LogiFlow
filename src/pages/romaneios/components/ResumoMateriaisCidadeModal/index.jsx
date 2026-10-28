import React, { useMemo } from 'react';

import { getTelhaInfo } from 'utils/telhaUtils';
import { AppIcon as Icon } from 'components';

// ═══════════════════════════════════════════════════════════════════════════════
// RESUMO DE MATERIAIS POR CARGA (agrupado por carga/rascunho e, dentro de
// cada carga, separado por cidade de destino — cada cidade soma os totais
// de todos os pedidos daquela carga que vão para ela)
// ═══════════════════════════════════════════════════════════════════════════════

/** Para cada rascunho (carga), agrupa seus itens pela cidade de destino do
 *  pedido ao qual cada item pertence (cai para o destino do rascunho quando
 *  o pedido não tem cidade própria definida). Dentro de uma mesma carga, se
 *  vários pedidos vão para a mesma cidade, os materiais desses pedidos são
 *  somados juntos (mesmo material em pedidos diferentes da mesma cidade =
 *  total único). Cargas diferentes NUNCA são somadas entre si — cada carga
 *  é seu próprio bloco, exatamente na ordem em que aparecem nos rascunhos. */
function buildResumoPorCarga(rascunhos) {
    return (rascunhos || [])
        .map((r, idx) => {
            const pedidos = r.romaneio_pedidos || [];
            const itens   = r.romaneio_itens   || [];
            const cidadePorPedido = {};
            pedidos.forEach(p => {
                cidadePorPedido[p.id] = (p.cidade_destino || r.destino || '').trim() || 'Cidade não informada';
            });
            const cidadeFallback = (r.destino || '').trim() || 'Cidade não informada';

            const cidadesMap = new Map(); // cidade -> { materiais: {}, pesoTotal, qtdTotal }
            itens.forEach(i => {
                const cidade  = (i.pedido_id && cidadePorPedido[i.pedido_id]) || cidadeFallback;
                const matNome = i.materials?.nome    || 'Material não identificado';
                const unidade = i.materials?.unidade || '';
                const { isTelha, compTelha, metros } = getTelhaInfo(i);
                // Telhas com comprimentos de corte diferentes não podem ser somadas juntas.
                const matKey  = String(i.material_id || matNome) + (isTelha ? `@${compTelha.toFixed(2)}` : '');
                const qtd     = Number(i.quantidade) || 0;
                const peso    = Number(i.peso_total) || 0;

                if (!cidadesMap.has(cidade)) cidadesMap.set(cidade, { materiais: {}, pesoTotal: 0, qtdTotal: 0 });
                const cEntry = cidadesMap.get(cidade);
                if (!cEntry.materiais[matKey]) cEntry.materiais[matKey] = { nome: matNome, unidade, isTelha, compTelha, quantidade: 0, peso: 0, metros: 0 };
                cEntry.materiais[matKey].quantidade += qtd;
                cEntry.materiais[matKey].peso       += peso;
                cEntry.materiais[matKey].metros      += metros;
                cEntry.pesoTotal += peso;
                cEntry.qtdTotal  += qtd;
            });

            const cidades = Array.from(cidadesMap.entries())
                .map(([cidade, dados]) => ({
                    cidade,
                    pesoTotal: dados.pesoTotal,
                    qtdTotal:  dados.qtdTotal,
                    materiais: Object.values(dados.materiais).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
                }))
                .sort((a, b) => a.cidade.localeCompare(b.cidade, 'pt-BR'));

            return {
                rascunhoId:    r.id,
                indice:        idx + 1,
                motorista:     r.motorista || '',
                placa:         r.placa || '',
                cidades,
                qtdTotalCarga:  cidades.reduce((s, c) => s + c.qtdTotal, 0),
                pesoTotalCarga: cidades.reduce((s, c) => s + c.pesoTotal, 0),
            };
        })
        .filter(c => c.cidades.length > 0); // esconde rascunhos sem nenhum item lançado
}

export default function ResumoMateriaisCidadeModal({ rascunhos, onClose }) {
    const resumo = useMemo(() => buildResumoPorCarga(rascunhos), [rascunhos]);
    const semDados = resumo.length === 0;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 pt-16" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0" style={{ borderColor: 'var(--color-border)' }}>
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#FFFBEB' }}>
                            <Icon name="MapPin" size={18} color="#D97706" />
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-base font-bold truncate" style={{ color: 'var(--color-text-primary)' }}>Materiais por Carga</h3>
                            <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>Cada carga (rascunho), separada por cidade de destino</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 flex-shrink-0">
                        <Icon name="X" size={18} color="var(--color-muted-foreground)" />
                    </button>
                </div>

                {/* Conteúdo */}
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
                    {semDados ? (
                        <div className="flex flex-col items-center gap-2 py-12 text-center">
                            <Icon name="PackageSearch" size={32} color="var(--color-muted-foreground)" />
                            <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Nenhum material lançado nos rascunhos ainda.</p>
                            <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>Adicione pedidos com materiais em um rascunho para ver o resumo aqui.</p>
                        </div>
                    ) : resumo.map(c => (
                        <div key={c.rascunhoId} className="rounded-xl border overflow-hidden" style={{ borderColor: '#FDE68A' }}>
                            {/* Cabeçalho da carga */}
                            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3" style={{ backgroundColor: '#FFFBEB' }}>
                                <div className="flex items-center gap-2 min-w-0">
                                    <Icon name="Package" size={14} color="#D97706" />
                                    <p className="text-sm font-bold truncate" style={{ color: '#92400E' }}>
                                        Carga {c.indice}{c.motorista ? ` — ${c.motorista}` : ''}{c.placa ? ` (${c.placa})` : ''}
                                    </p>
                                </div>
                                <div className="flex items-center gap-4 text-xs flex-shrink-0">
                                    <span style={{ color: '#92400E' }}><strong>{c.qtdTotalCarga.toLocaleString('pt-BR')}</strong> un.</span>
                                    <span style={{ color: '#92400E' }}><strong>{c.pesoTotalCarga.toLocaleString('pt-BR')}</strong> kg</span>
                                </div>
                            </div>

                            {/* Um bloco por cidade dentro da carga */}
                            <div className="divide-y" style={{ borderColor: '#FDE68A' }}>
                                {c.cidades.map(cid => (
                                    <div key={cid.cidade}>
                                        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2" style={{ backgroundColor: '#FFFDF5' }}>
                                            <div className="flex items-center gap-1.5">
                                                <Icon name="MapPin" size={12} color="#B45309" />
                                                <p className="text-xs font-semibold" style={{ color: '#B45309' }}>{cid.cidade}</p>
                                            </div>
                                            <div className="flex items-center gap-3 text-xs">
                                                <span style={{ color: '#B45309' }}><strong>{cid.qtdTotal.toLocaleString('pt-BR')}</strong> un.</span>
                                                <span style={{ color: '#B45309' }}><strong>{cid.pesoTotal.toLocaleString('pt-BR')}</strong> kg</span>
                                            </div>
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-xs">
                                                <thead style={{ color: 'var(--color-muted-foreground)' }}>
                                                    <tr>
                                                        <th className="text-left px-4 py-1.5 font-medium">Material</th>
                                                        <th className="text-right px-4 py-1.5 font-medium">Quantidade</th>
                                                        <th className="text-right px-4 py-1.5 font-medium">Peso (kg)</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {cid.materiais.map(m => (
                                                        <tr key={`${m.nome}-${m.compTelha || ''}`} className="border-t" style={{ borderColor: '#FDF1D6' }}>
                                                            <td className="px-4 py-1.5">
                                                                {m.nome}
                                                                {m.isTelha && m.compTelha > 0 && (
                                                                    <span className="ml-1 text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                                                                        (peça {m.compTelha.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}m)
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-1.5 text-right font-mono whitespace-nowrap">
                                                                {m.isTelha
                                                                    ? <>{m.quantidade.toLocaleString('pt-BR')} pç <span style={{ color: 'var(--color-muted-foreground)' }}>({m.metros.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} m)</span></>
                                                                    : <>{m.quantidade.toLocaleString('pt-BR')}{m.unidade ? ` ${m.unidade}` : ''}</>}
                                                            </td>
                                                            <td className="px-4 py-1.5 text-right font-mono whitespace-nowrap">{m.peso > 0 ? m.peso.toLocaleString('pt-BR') : '—'}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div className="flex justify-end px-5 py-3 border-t flex-shrink-0" style={{ borderColor: 'var(--color-border)' }}>
                    <button onClick={onClose} className="px-4 py-2 rounded-xl border text-sm font-medium" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>
                        Fechar
                    </button>
                </div>
            </div>
        </div>
    );
}
