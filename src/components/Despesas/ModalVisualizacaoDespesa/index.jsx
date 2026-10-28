import React, { useState } from 'react';

import { useToast } from 'hooks/useToast';
import { AppIcon as Icon, Toast, ModalHeader, ModalOverlay } from 'components';

import { FMT, BRL } from '../utils/helpers';
import { TIPO_PAGAMENTO_LABEL } from '../utils/constants';

// ─── Modal: Visualizar Despesa + Baixas/Revogações ───────────────────────────
export default function ModalVisualizacaoDespesa({ despesa, config, onClose, onAtualizado, admin }) {
    const { servico, comVeiculo } = config;
    const { toast, showToast } = useToast();
    const [loading, setLoading] = useState(false);
    const [dados, setDados] = useState(despesa);

    const reload = async () => {
        try {
            const updated = await servico.fetchDespesaPorId(despesa.id).catch(() => null);
            if (updated) setDados(updated);
            if (onAtualizado) onAtualizado();
        } catch {}
    };

    const act = async (fn, msg) => {
        setLoading(true);
        try { await fn(); showToast(msg, 'success'); await reload(); }
        catch (e) { showToast('Erro: ' + e.message, 'error'); }
        finally { setLoading(false); }
    };

    const boletos  = dados.boletos        || [];
    const parcelas = dados.parcelas_cartao || [];
    const cheques  = dados.cheques        || [];
    const temParcelas = boletos.length > 0 || parcelas.length > 0 || cheques.length > 0;

    const statusGeral = () => {
        const todas = [...boletos, ...parcelas, ...cheques];
        if (!todas.length) return null;
        const pagas = todas.filter(x => x.pago).length;
        return pagas === todas.length ? 'quitado' : pagas > 0 ? 'parcial' : 'aberto';
    };
    const sg = statusGeral();

    return (
        <ModalOverlay onClose={onClose}>
            <ModalHeader title="Detalhes da Despesa" icon="Receipt" onClose={onClose} />
            <div className="p-5 overflow-y-auto flex-1 space-y-5">
                {/* Cabeçalho */}
                <div className="grid grid-cols-2 gap-3">
                    {[
                        { l: 'Categoria',        v: dados.categoria          || '—' },
                        { l: 'Data',             v: FMT(dados.data_despesa)         },
                        { l: 'Fornecedor',       v: dados.fornecedor         || '—' },
                        { l: 'Nota Fiscal',      v: dados.nota_fiscal        || '—' },
                        { l: 'Forma de Pagamento', v: TIPO_PAGAMENTO_LABEL[dados.tipo_pagamento] || dados.forma_pagamento || '—' },
                        ...(comVeiculo ? [{ l: 'Placa', v: dados.veiculo?.placa || '—' }] : []),
                    ].map(({ l, v }) => (
                        <div key={l} className="p-3 rounded-xl border" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-muted)' }}>
                            <p className="text-xs mb-0.5" style={{ color: 'var(--color-muted-foreground)' }}>{l}</p>
                            <p className="text-sm font-semibold">{v}</p>
                        </div>
                    ))}
                    {dados.descricao && (
                        <div className="col-span-2 p-3 rounded-xl border" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-muted)' }}>
                            <p className="text-xs mb-0.5" style={{ color: 'var(--color-muted-foreground)' }}>Descrição</p>
                            <p className="text-sm">{dados.descricao}</p>
                        </div>
                    )}
                    {dados.observacoes && (
                        <div className="col-span-2 p-3 rounded-xl border" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-muted)' }}>
                            <p className="text-xs mb-0.5" style={{ color: 'var(--color-muted-foreground)' }}>Observações</p>
                            <p className="text-sm">{dados.observacoes}</p>
                        </div>
                    )}
                </div>

                {/* Total */}
                <div className="p-4 rounded-xl text-center flex items-center justify-between" style={{ backgroundColor: '#FFF1F2', border: '1px solid #FCA5A5' }}>
                    <div>
                        <p className="text-xs text-red-600 font-medium mb-0.5">Valor Total</p>
                        <p className="text-3xl font-bold font-data text-red-700">{BRL(dados.valor)}</p>
                    </div>
                    {sg && (
                        <span className={`px-3 py-1.5 rounded-full text-xs font-bold ${sg === 'quitado' ? 'bg-green-100 text-green-700' : sg === 'parcial' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                            {sg === 'quitado' ? '✅ Quitado' : sg === 'parcial' ? '⚠️ Parcialmente pago' : '🔴 Em Aberto'}
                        </span>
                    )}
                </div>

                {/* Boletos */}
                {boletos.length > 0 && (
                    <div>
                        <p className="text-sm font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>Boletos</p>
                        <div className="space-y-2">
                            {boletos.map((b, idx) => (
                                <div key={idx} className="flex items-center gap-3 p-3 rounded-xl border" style={{ borderColor: 'var(--color-border)', backgroundColor: b.pago ? '#F0FDF4' : '#FFFBEB' }}>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold font-data">{b.numero_boleto ? `Boleto ${b.numero_boleto}` : `Boleto ${idx + 1}`} — {BRL(b.valor)}</p>
                                        <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>Venc.: {FMT(b.vencimento)}</p>
                                        {b.pago && <p className="text-xs text-green-600 font-medium">✓ Pago em {b.pago_em ? new Date(b.pago_em).toLocaleDateString('pt-BR') : '—'}</p>}
                                        <label className="flex items-center gap-1.5 text-xs mt-1 cursor-pointer">
                                            <input type="checkbox" checked={!!b.entregue_financeiro} disabled={loading}
                                                onChange={() => act(async () => {
                                                    const novaData = !b.entregue_financeiro ? new Date().toISOString() : null;
                                                    const novos = boletos.map((x, i) => i === idx ? { ...x, entregue_financeiro: !x.entregue_financeiro, entregue_financeiro_em: novaData } : x);
                                                    const { error } = await servico.salvarBoletos(dados.id, novos);
                                                    if (error) throw error;
                                                }, 'Status de entrega atualizado!')} />
                                            <span className={b.entregue_financeiro ? 'text-blue-600 font-medium' : 'text-gray-400'}>{b.entregue_financeiro ? '✓ Entregue ao financeiro' : 'Ainda não entregue ao financeiro'}</span>
                                        </label>
                                        {b.entregue_financeiro && (
                                            <div className="flex items-center gap-1.5 mt-1">
                                                <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>Data da entrega:</span>
                                                <input type="date" disabled={loading}
                                                    value={b.entregue_financeiro_em ? b.entregue_financeiro_em.slice(0, 10) : ''}
                                                    onChange={e => act(async () => {
                                                        const valor = e.target.value;
                                                        const novos = boletos.map((x, i) => i === idx ? { ...x, entregue_financeiro_em: valor ? new Date(`${valor}T12:00:00`).toISOString() : null } : x);
                                                        const { error } = await servico.salvarBoletos(dados.id, novos);
                                                        if (error) throw error;
                                                    }, 'Data de entrega atualizada!')}
                                                    className="px-2 py-1 rounded-md border text-xs outline-none" style={{ borderColor: 'var(--color-border)' }} />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex gap-1.5 flex-shrink-0">
                                        {!b.pago ? (
                                            <button disabled={loading} onClick={() => act(() => servico.pagarBoleto(dados.id, idx), 'Boleto baixado!')}
                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-green-600 text-white hover:bg-green-700 disabled:opacity-60">
                                                <Icon name="Check" size={12} />Dar baixa
                                            </button>
                                        ) : (
                                            <>
                                                <span className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-green-100 text-green-700">Pago</span>
                                                {admin && <button disabled={loading} onClick={() => act(() => servico.revogarBoleto(dados.id, idx), 'Baixa revogada!')}
                                                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 disabled:opacity-60">
                                                    <Icon name="RotateCcw" size={11} />Revogar
                                                </button>}
                                            </>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Parcelas Cartão */}
                {parcelas.length > 0 && (
                    <div>
                        <p className="text-sm font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>Parcelas do Cartão</p>
                        <div className="space-y-2">
                            {parcelas.map((p, idx) => (
                                <div key={idx} className="flex items-center gap-3 p-3 rounded-xl border" style={{ borderColor: 'var(--color-border)', backgroundColor: p.pago ? '#F0FDF4' : '#FAF5FF' }}>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold font-data">Parcela {idx + 1} — {BRL(p.valor)}</p>
                                        <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>Venc.: {FMT(p.vencimento)}{p.cartao ? ` · ${p.cartao}` : ''}</p>
                                        {p.pago && <p className="text-xs text-green-600 font-medium">✓ Pago em {p.pago_em ? new Date(p.pago_em).toLocaleDateString('pt-BR') : '—'}</p>}
                                    </div>
                                    <div className="flex gap-1.5 flex-shrink-0">
                                        {!p.pago ? (
                                            <button disabled={loading} onClick={() => act(() => servico.pagarParcelaCartao(dados.id, idx), 'Parcela baixada!')}
                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-60">
                                                <Icon name="Check" size={12} />Dar baixa
                                            </button>
                                        ) : (
                                            <>
                                                <span className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-purple-100 text-purple-700">Pago</span>
                                                {admin && <button disabled={loading} onClick={() => act(() => servico.revogarParcelaCartao(dados.id, idx), 'Baixa revogada!')}
                                                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 disabled:opacity-60">
                                                    <Icon name="RotateCcw" size={11} />Revogar
                                                </button>}
                                            </>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {!temParcelas && (
                    <p className="text-xs text-center py-4" style={{ color: 'var(--color-muted-foreground)' }}>Pagamento à vista — sem parcelas ou boletos vinculados.</p>
                )}
            </div>
            <Toast toast={toast} />
        </ModalOverlay>
    );
}
