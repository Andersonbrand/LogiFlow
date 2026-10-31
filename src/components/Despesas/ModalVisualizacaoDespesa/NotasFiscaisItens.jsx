import React, { useState } from 'react';

import { AppIcon as Icon } from 'components';

import { FMT, BRL } from '../utils/helpers';

const ORIGEM = {
    xml:    { label: 'XML importado',      bg: '#DBEAFE', cor: '#1D4ED8' },
    chave:  { label: 'Código de barras',   bg: '#EDE9FE', cor: '#6D28D9' },
    manual: { label: 'Lançada manualmente', bg: '#FEF3C7', cor: '#B45309' },
};

const num = v => Number(String(v ?? '').replace(',', '.')) || 0;
const qtd = v => (v === '' || v == null ? '—' : num(v).toLocaleString('pt-BR', { maximumFractionDigits: 4 }));

function origemDe(nf) {
    if (nf._origem && ORIGEM[nf._origem]) return nf._origem;
    if (nf._manual) return 'manual';
    return 'xml';
}

/**
 * Notas fiscais / notas de serviço da despesa com os itens de cada uma
 * (XML importado, lida pelo código de barras ou lançada manualmente).
 * Despesas antigas só com a lista geral `nf_itens` caem no bloco "Itens da nota".
 */
export default function NotasFiscaisItens({ despesa }) {
    const nfs = Array.isArray(despesa.notas_fiscais) ? despesa.notas_fiscais : [];
    const itensGerais = Array.isArray(despesa.nf_itens) ? despesa.nf_itens : [];
    const [abertas, setAbertas] = useState({});

    // NF "avulsa" (só o número no cabeçalho, sem lista de NFs) → mostra uma linha simples
    const semLista = nfs.length === 0;
    const itensDeNfs = nfs.reduce((s, n) => s + (n.nf_itens?.length || 0), 0);
    const itensSoltos = itensDeNfs === 0 ? itensGerais : [];

    if (semLista && itensGerais.length === 0) return null;

    const toggle = (i) => setAbertas(a => ({ ...a, [i]: !(a[i] ?? true) }));

    const TabelaItens = ({ itens }) => (
        <div className="overflow-x-auto">
            <table className="w-full text-xs">
                <thead>
                    <tr style={{ color: 'var(--color-muted-foreground)' }}>
                        {['Cód.', 'Descrição', 'Qtd.', 'Un.', 'V. unit.', 'V. total'].map((h, i) => (
                            <th key={h} className={`px-2 py-1.5 border-b font-medium ${i >= 2 && h !== 'Un.' ? 'text-right' : 'text-left'}`} style={{ borderColor: 'var(--color-border)' }}>{h}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {itens.map((it, i) => {
                        const total = it.valor_total !== '' && it.valor_total != null ? num(it.valor_total) : num(it.quantidade) * num(it.valor_unit);
                        return (
                            <tr key={i} className="border-b last:border-b-0" style={{ borderColor: 'var(--color-border)' }}>
                                <td className="px-2 py-1.5 font-data whitespace-nowrap">{it.codigo || '—'}</td>
                                <td className="px-2 py-1.5 min-w-[160px]">{it.descricao || '—'}</td>
                                <td className="px-2 py-1.5 font-data text-right whitespace-nowrap">{qtd(it.quantidade)}</td>
                                <td className="px-2 py-1.5 whitespace-nowrap">{it.unidade || '—'}</td>
                                <td className="px-2 py-1.5 font-data text-right whitespace-nowrap">{it.valor_unit !== '' && it.valor_unit != null ? BRL(num(it.valor_unit)) : '—'}</td>
                                <td className="px-2 py-1.5 font-data text-right font-semibold whitespace-nowrap">{total > 0 ? BRL(total) : '—'}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );

    return (
        <div>
            <p className="text-sm font-semibold mb-2 flex items-center gap-1.5" style={{ color: 'var(--color-text-primary)' }}>
                <Icon name="FileText" size={15} color="#1D4ED8" /> Notas fiscais e itens
                {nfs.length > 0 && <span className="px-1.5 py-0.5 rounded-full bg-blue-600 text-white text-xs">{nfs.length}</span>}
            </p>
            <div className="space-y-2">
                {nfs.map((nf, i) => {
                    const o = ORIGEM[origemDe(nf)];
                    const itens = nf.nf_itens || [];
                    const aberta = abertas[i] ?? true;
                    const somaItens = itens.reduce((s, it) => s + (it.valor_total !== '' && it.valor_total != null ? num(it.valor_total) : num(it.quantidade) * num(it.valor_unit)), 0);
                    return (
                        <div key={i} className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
                            <button type="button" data-repeat data-no-press onClick={() => toggle(i)}
                                className="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left" style={{ backgroundColor: 'var(--color-muted)' }}>
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold truncate">
                                        NF {nf.numero || '—'}{nf.fornecedor ? ` · ${nf.fornecedor}` : ''}
                                    </p>
                                    <p className="text-xs flex flex-wrap items-center gap-x-2 gap-y-0.5" style={{ color: 'var(--color-muted-foreground)' }}>
                                        <span className="px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: o.bg, color: o.cor }}>{o.label}</span>
                                        {nf.data && <span>Emissão {FMT(nf.data)}</span>}
                                        <span>{itens.length} item(s)</span>
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    {num(nf.valor) > 0 && <span className="text-sm font-bold font-data">{BRL(num(nf.valor))}</span>}
                                    <Icon name={aberta ? 'ChevronUp' : 'ChevronDown'} size={16} color="currentColor" />
                                </div>
                            </button>
                            {aberta && (
                                <div className="px-3 py-2">
                                    {nf.descricao && <p className="text-xs mb-2" style={{ color: 'var(--color-text-secondary)' }}>{nf.descricao}</p>}
                                    {itens.length > 0 ? (
                                        <>
                                            <TabelaItens itens={itens} />
                                            {somaItens > 0 && <p className="text-xs text-right mt-1.5" style={{ color: 'var(--color-muted-foreground)' }}>Soma dos itens: <strong className="font-data">{BRL(somaItens)}</strong></p>}
                                        </>
                                    ) : (
                                        <p className="text-xs py-1" style={{ color: 'var(--color-muted-foreground)' }}>Nenhum item detalhado nesta nota.</p>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
                {itensSoltos.length > 0 && (
                    <div className="rounded-xl border px-3 py-2" style={{ borderColor: 'var(--color-border)' }}>
                        <p className="text-xs font-semibold mb-1">Itens da nota ({itensSoltos.length})</p>
                        <TabelaItens itens={itensSoltos} />
                    </div>
                )}
            </div>
        </div>
    );
}
