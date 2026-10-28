import React, { useState } from 'react';

import { useToast } from 'hooks/useToast';
import { AppIcon as Icon, Toast, ModalHeader, ModalOverlay } from 'components';

import { BRL, FMT } from '../utils/helpers';
import { TIPO_PAGAMENTO_LABEL } from '../utils/constants';

// ─── Modal de Baixa de Boletos ────────────────────────────────────────────────
// `config.servico` traz as operações da tela de origem (carretas, caminhões ou administrativas).
export default function ModalBaixa({ despesa, config, onClose, onBaixado, isAdmin }) {
    const { servico } = config;
    const { toast, showToast } = useToast();
    const [loading, setLoading] = useState(false);

    const handlePagarBoleto = async (idx) => {
        setLoading(true);
        try {
            await servico.pagarBoleto(despesa.id, idx);
            showToast('Boleto baixado!', 'success');
            onBaixado();
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
        finally { setLoading(false); }
    };

    const handleRevogarBoleto = async (idx) => {
        setLoading(true);
        try {
            await servico.revogarBoleto(despesa.id, idx);
            showToast('Baixa revogada!', 'warning');
            onBaixado();
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
        finally { setLoading(false); }
    };

    const handlePagarParcela = async (idx) => {
        setLoading(true);
        try {
            await servico.pagarParcelaCartao(despesa.id, idx);
            showToast('Parcela baixada!', 'success');
            onBaixado();
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
        finally { setLoading(false); }
    };

    const handleRevogarParcela = async (idx) => {
        setLoading(true);
        try {
            await servico.revogarParcelaCartao(despesa.id, idx);
            showToast('Baixa revogada!', 'warning');
            onBaixado();
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
        finally { setLoading(false); }
    };

    const boletos = despesa.boletos || [];
    const parcelas = despesa.parcelas_cartao || [];

    // ── Entrega ao financeiro: seleção local de 1+ boletos, salva tudo de uma vez ──
    const hojeISO = () => new Date().toISOString().slice(0, 10);
    const [entregas, setEntregas] = useState(() => boletos.map(b => !!b.entregue_financeiro));
    const [entregasDatas, setEntregasDatas] = useState(() => boletos.map(b => (b.entregue_financeiro_em ? b.entregue_financeiro_em.slice(0, 10) : hojeISO())));
    const entregasAlteradas = entregas.some((v, i) => v !== !!boletos[i]?.entregue_financeiro)
        || entregas.some((v, i) => v && entregasDatas[i] !== (boletos[i]?.entregue_financeiro_em ? boletos[i].entregue_financeiro_em.slice(0, 10) : entregasDatas[i]));
    const toggleEntrega = (idx) => setEntregas(prev => prev.map((v, i) => {
        if (i !== idx) return v;
        if (!v) setEntregasDatas(d => d.map((dt, di) => di === idx && !dt ? hojeISO() : dt));
        return !v;
    }));
    const setEntregaData = (idx, valor) => setEntregasDatas(prev => prev.map((d, i) => i === idx ? valor : d));
    const marcarTodasEntregas = (valor) => {
        setEntregas(boletos.map(() => valor));
        if (valor) setEntregasDatas(prev => prev.map(d => d || hojeISO()));
    };
    const salvarEntregas = async () => {
        setLoading(true);
        try {
            const novos = boletos.map((b, i) => ({
                ...b,
                entregue_financeiro: entregas[i],
                entregue_financeiro_em: entregas[i] ? new Date(`${entregasDatas[i] || hojeISO()}T12:00:00`).toISOString() : null,
            }));
            const { error } = await servico.salvarBoletos(despesa.id, novos);
            if (error) throw error;
            const qtd = entregas.filter((v, i) => v !== !!boletos[i]?.entregue_financeiro).length;
            showToast(`${qtd} boleto(s) atualizado(s)!`, 'success');
            onBaixado();
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
        finally { setLoading(false); }
    };

    return (
        <ModalOverlay onClose={onClose}>
            <ModalHeader title="Dar Baixa em Pagamentos" icon="CheckCircle2" onClose={onClose} />
            <div className="p-5 overflow-y-auto flex-1 space-y-5">
                {boletos.length > 0 && (
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Boletos</p>
                            <div className="flex items-center gap-3">
                                <button type="button" onClick={() => marcarTodasEntregas(true)} disabled={loading}
                                    className="text-xs font-medium text-blue-600 hover:underline disabled:opacity-50">Marcar todos entregues</button>
                                <button type="button" onClick={() => marcarTodasEntregas(false)} disabled={loading}
                                    className="text-xs font-medium text-gray-500 hover:underline disabled:opacity-50">Desmarcar todos</button>
                            </div>
                        </div>
                        <div className="space-y-2">
                            {boletos.map((b, idx) => (
                                <div key={idx} className="flex items-center gap-3 p-3 rounded-xl border" style={{ borderColor: 'var(--color-border)', backgroundColor: b.pago ? '#F0FDF4' : '#FFFBEB' }}>
                                    <div className="flex-1">
                                        <p className="text-sm font-medium font-data" style={{ color: 'var(--color-text-primary)' }}>{b.numero_boleto ? `Boleto ${b.numero_boleto}` : `Boleto ${idx + 1}`} — {BRL(b.valor)}</p>
                                        <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>Vencimento: {FMT(b.vencimento)}</p>
                                        {b.pago && <p className="text-xs text-green-600 font-medium">✓ Pago em {b.pago_em ? new Date(b.pago_em).toLocaleDateString('pt-BR') : '—'}</p>}
                                        <label className="flex items-center gap-1.5 text-xs mt-1 cursor-pointer">
                                            <input type="checkbox" checked={!!entregas[idx]} disabled={loading} onChange={() => toggleEntrega(idx)} />
                                            <span className={entregas[idx] ? 'text-blue-600 font-medium' : 'text-gray-400'}>
                                                {entregas[idx] ? '✓ Entregue ao financeiro' : 'Ainda não entregue ao financeiro'}
                                            </span>
                                        </label>
                                        {entregas[idx] && (
                                            <div className="flex items-center gap-1.5 mt-1">
                                                <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>Data da entrega:</span>
                                                <input type="date" value={entregasDatas[idx] || hojeISO()} disabled={loading}
                                                    onChange={e => setEntregaData(idx, e.target.value)}
                                                    className="px-2 py-1 rounded-md border text-xs outline-none" style={{ borderColor: 'var(--color-border)' }} />
                                            </div>
                                        )}
                                        {b.entregue_financeiro && b.entregue_financeiro_em && (
                                            <p className="text-xs text-blue-500 mt-0.5">Registrado em {new Date(b.entregue_financeiro_em).toLocaleDateString('pt-BR')}</p>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        {!b.pago ? (
                                            <button onClick={() => handlePagarBoleto(idx)} disabled={loading}
                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-60">
                                                <Icon name="Check" size={13} />Dar baixa
                                            </button>
                                        ) : (
                                            <>
                                                <span className="px-3 py-1.5 rounded-lg text-xs font-medium bg-green-100 text-green-700">Pago</span>
                                                {isAdmin && (
                                                    <button onClick={() => handleRevogarBoleto(idx)} disabled={loading}
                                                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-colors disabled:opacity-60">
                                                        <Icon name="RotateCcw" size={12} />Revogar
                                                    </button>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                        {entregasAlteradas && (
                            <div className="flex justify-end mt-3">
                                <button type="button" onClick={salvarEntregas} disabled={loading}
                                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-60">
                                    <Icon name={loading ? 'Loader' : 'Save'} size={13} /> Salvar entregas ao financeiro
                                </button>
                            </div>
                        )}
                    </div>
                )}
                {parcelas.length > 0 && (
                    <div>
                        <p className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>Parcelas do Cartão</p>
                        <div className="space-y-2">
                            {parcelas.map((p, idx) => (
                                <div key={idx} className="flex items-center gap-3 p-3 rounded-xl border" style={{ borderColor: 'var(--color-border)', backgroundColor: p.pago ? '#F0FDF4' : '#FAF5FF' }}>
                                    <div className="flex-1">
                                        <p className="text-sm font-medium font-data" style={{ color: 'var(--color-text-primary)' }}>Parcela {idx + 1} — {BRL(p.valor)}</p>
                                        <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>Vencimento: {FMT(p.vencimento)}{p.cartao ? ` · ${p.cartao}` : ''}</p>
                                        {p.pago && <p className="text-xs text-green-600 font-medium">✓ Pago em {p.pago_em ? new Date(p.pago_em).toLocaleDateString('pt-BR') : '—'}</p>}
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        {!p.pago ? (
                                            <button onClick={() => handlePagarParcela(idx)} disabled={loading}
                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-600 text-white hover:bg-purple-700 transition-colors disabled:opacity-60">
                                                <Icon name="Check" size={13} />Dar baixa
                                            </button>
                                        ) : (
                                            <>
                                                <span className="px-3 py-1.5 rounded-lg text-xs font-medium bg-purple-100 text-purple-700">Pago</span>
                                                {isAdmin && (
                                                    <button onClick={() => handleRevogarParcela(idx)} disabled={loading}
                                                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-colors disabled:opacity-60">
                                                        <Icon name="RotateCcw" size={12} />Revogar
                                                    </button>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                {boletos.length === 0 && parcelas.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
                        <Icon name="CheckCircle2" size={32} color="#9CA3AF" />
                        <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                            Nenhum pagamento pendente para baixa
                        </p>
                        <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                            Forma de pagamento: {TIPO_PAGAMENTO_LABEL[despesa.tipo_pagamento] || (despesa.forma_pagamento === 'a_vista' ? 'À Vista' : despesa.forma_pagamento === 'a_prazo' ? 'A Prazo' : 'não informada')}
                        </p>
                    </div>
                )}
            </div>
            <Toast toast={toast} />
        </ModalOverlay>
    );
}
