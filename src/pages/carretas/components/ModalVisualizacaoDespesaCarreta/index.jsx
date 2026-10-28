import React, { useState } from 'react';

import { useToast } from 'hooks/useToast';
import { updateDespesaExtra } from 'services/carretas';
import { Toast, ModalHeader, ModalOverlay } from 'components';

import { FMT_DATE, BRL } from '../../utils/helpers';
import { TIPO_PAGAMENTO_LABEL } from '../../utils/constants';

// ─── Modal de Visualização de Despesa ─────────────────────────────────────────
export default function ModalVisualizacaoDespesaCarreta({ despesa, onClose, onAtualizado, admin }) {
    const { toast, showToast } = useToast();
    const [loading, setLoading] = useState(false);
    const [dados, setDados]     = useState(despesa);

    const act = async (fn, msg) => {
        setLoading(true);
        try {
            const novosBoletos = await fn();
            if (novosBoletos) setDados(d => ({ ...d, boletos: novosBoletos }));
            showToast(msg, 'success');
            if (onAtualizado) onAtualizado();
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
        finally { setLoading(false); }
    };

    const boletos  = dados.boletos         || [];
    const parcelas = dados.parcelas_cartao || [];
    const temParcelas = boletos.length > 0 || parcelas.length > 0;
    const statusGeral = () => {
        const todas = [...boletos, ...parcelas];
        if (!todas.length) return null;
        const pagas = todas.filter(x => x.pago).length;
        return pagas === todas.length ? 'quitado' : pagas > 0 ? 'parcial' : 'aberto';
    };
    const sg = statusGeral();

    return (
        <ModalOverlay onClose={onClose}>
            <ModalHeader title="Detalhes da Despesa" icon="Receipt" onClose={onClose} />
            <div className="p-5 overflow-y-auto flex-1 space-y-5">
                <div className="grid grid-cols-2 gap-3">
                    {[
                        { l: 'Categoria',          v: despesa.categoria       || '—' },
                        { l: 'Data',               v: FMT_DATE(despesa.data_despesa) },
                        { l: 'Placa',              v: despesa.veiculo?.placa  || '—' },
                        { l: 'Fornecedor',         v: despesa.fornecedor      || '—' },
                        { l: 'Nota Fiscal',        v: despesa.nota_fiscal     || '—' },
                        { l: 'Forma de Pagamento', v: TIPO_PAGAMENTO_LABEL[despesa.tipo_pagamento] || despesa.forma_pagamento || '—' },
                    ].map(({ l, v }) => (
                        <div key={l} className="p-3 rounded-xl border" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-muted)' }}>
                            <p className="text-xs mb-0.5" style={{ color: 'var(--color-muted-foreground)' }}>{l}</p>
                            <p className="text-sm font-semibold">{v}</p>
                        </div>
                    ))}
                    {despesa.descricao && (
                        <div className="col-span-2 p-3 rounded-xl border" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-muted)' }}>
                            <p className="text-xs mb-0.5" style={{ color: 'var(--color-muted-foreground)' }}>Descrição</p>
                            <p className="text-sm">{despesa.descricao}</p>
                        </div>
                    )}
                    {despesa.observacoes && (
                        <div className="col-span-2 p-3 rounded-xl border" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-muted)' }}>
                            <p className="text-xs mb-0.5" style={{ color: 'var(--color-muted-foreground)' }}>Observações</p>
                            <p className="text-sm">{despesa.observacoes}</p>
                        </div>
                    )}
                </div>
                <div className="p-4 rounded-xl flex items-center justify-between" style={{ backgroundColor: '#FFF1F2', border: '1px solid #FCA5A5' }}>
                    <div>
                        <p className="text-xs text-red-600 font-medium mb-0.5">Valor Total</p>
                        <p className="text-3xl font-bold font-data text-red-700">{BRL(despesa.valor)}</p>
                    </div>
                    {sg && <span className={`px-3 py-1.5 rounded-full text-xs font-bold ${sg === 'quitado' ? 'bg-green-100 text-green-700' : sg === 'parcial' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>{sg === 'quitado' ? '✅ Quitado' : sg === 'parcial' ? '⚠️ Parcialmente pago' : '🔴 Em Aberto'}</span>}
                </div>
                {boletos.length > 0 && (
                    <div>
                        <p className="text-sm font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>Boletos</p>
                        <div className="space-y-2">
                            {boletos.map((b, idx) => (
                                <div key={idx} className="flex items-center gap-3 p-3 rounded-xl border" style={{ borderColor: 'var(--color-border)', backgroundColor: b.pago ? '#F0FDF4' : '#FFFBEB' }}>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold font-data">{b.numero_boleto ? `Boleto ${b.numero_boleto}` : `Boleto ${idx + 1}`} — {BRL(b.valor)}</p>
                                        <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>Venc.: {FMT_DATE(b.vencimento)}</p>
                                        {b.pago && <p className="text-xs text-green-600 font-medium">✓ Pago em {b.pago_em ? new Date(b.pago_em).toLocaleDateString('pt-BR') : '—'}</p>}
                                        <label className="flex items-center gap-1.5 text-xs mt-1 cursor-pointer">
                                            <input type="checkbox" checked={!!b.entregue_financeiro} disabled={loading}
                                                onChange={() => act(async () => {
                                                    const novaData = !b.entregue_financeiro ? new Date().toISOString() : null;
                                                    const novos = boletos.map((x, i) => i === idx ? { ...x, entregue_financeiro: !x.entregue_financeiro, entregue_financeiro_em: novaData } : x);
                                                    await updateDespesaExtra(dados.id, { boletos: novos });
                                                    return novos;
                                                }, 'Status de entrega atualizado!')} />
                                            <span className={b.entregue_financeiro ? 'text-blue-600 font-medium' : 'text-gray-400'}>
                                                {b.entregue_financeiro ? '✓ Entregue ao financeiro' : 'Ainda não entregue ao financeiro'}
                                            </span>
                                        </label>
                                        {b.entregue_financeiro && (
                                            <div className="flex items-center gap-1.5 mt-1">
                                                <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>Data da entrega:</span>
                                                <input type="date" disabled={loading}
                                                    value={b.entregue_financeiro_em ? b.entregue_financeiro_em.slice(0, 10) : ''}
                                                    onChange={e => act(async () => {
                                                        const valor = e.target.value;
                                                        const novos = boletos.map((x, i) => i === idx ? { ...x, entregue_financeiro_em: valor ? new Date(`${valor}T12:00:00`).toISOString() : null } : x);
                                                        await updateDespesaExtra(dados.id, { boletos: novos });
                                                        return novos;
                                                    }, 'Data de entrega atualizada!')}
                                                    className="px-2 py-1 rounded-md border text-xs outline-none" style={{ borderColor: 'var(--color-border)' }} />
                                            </div>
                                        )}
                                    </div>
                                    <span className={`px-2.5 py-1 rounded-lg text-xs font-medium flex-shrink-0 ${b.pago ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{b.pago ? 'Pago' : 'Pendente'}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                {parcelas.length > 0 && (
                    <div>
                        <p className="text-sm font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>Parcelas do Cartão</p>
                        <div className="space-y-2">
                            {parcelas.map((p, idx) => (
                                <div key={idx} className="flex items-center gap-3 p-3 rounded-xl border" style={{ borderColor: 'var(--color-border)', backgroundColor: p.pago ? '#F0FDF4' : '#FAF5FF' }}>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold font-data">Parcela {idx + 1} — {BRL(p.valor)}</p>
                                        <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>Venc.: {FMT_DATE(p.vencimento)}{p.cartao ? ` · ${p.cartao}` : ''}</p>
                                        {p.pago && <p className="text-xs text-green-600 font-medium">✓ Pago em {p.pago_em ? new Date(p.pago_em).toLocaleDateString('pt-BR') : '—'}</p>}
                                    </div>
                                    <span className={`px-2.5 py-1 rounded-lg text-xs font-medium flex-shrink-0 ${p.pago ? 'bg-green-100 text-green-700' : 'bg-purple-100 text-purple-700'}`}>{p.pago ? 'Pago' : 'Pendente'}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                {!temParcelas && <p className="text-xs text-center py-4" style={{ color: 'var(--color-muted-foreground)' }}>Pagamento à vista — sem parcelas ou boletos vinculados.</p>}
            </div>
            <Toast toast={toast} />
        </ModalOverlay>
    );
}
