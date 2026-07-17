import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import NavigationBar from 'components/ui/NavigationBar';
import BreadcrumbTrail from 'components/ui/BreadcrumbTrail';
import Button from 'components/ui/Button';
import Icon from 'components/AppIcon';
import Toast from 'components/ui/Toast';
import { useToast } from 'utils/useToast';
import { useConfirm } from 'components/ui/ConfirmDialog';
import PeriodRangeFilter, { usePeriodRangeFilter } from 'components/ui/PeriodRangeFilter';
import BoletosPainel from 'components/ui/BoletosPainel';
import { useAuth } from 'utils/AuthContext';
import { fetchVehicles } from 'utils/vehicleService';
import {
    CATEGORIAS_DESPESA_CAMINHOES,
    fetchDespesasCaminhoes, createDespesaCaminhao, updateDespesaCaminhao, deleteDespesaCaminhao,
    pagarBoletoCaminhao, pagarParcelaCartaoCaminhao,
    revogarBoletoCaminhao, revogarParcelaCartaoCaminhao,

} from 'utils/caminhoesDespesasService';
import {
    fetchFornecedores as fetchFornecedoresCaminhoes,
    createFornecedor as createFornecedorCaminhao,
    updateFornecedor as updateFornecedorCaminhao,
    deleteFornecedor as deleteFornecedorCaminhao,
} from 'utils/fornecedoresService';
import { supabase } from 'utils/supabaseClient';
import { gerarParcelasAutomaticas, somaParcelas, detectarPossiveisDuplicatas, adicionarDiasUteis, buscarDespesasComMesmaNf, garantirFornecedorCadastrado, EMPRESAS_LOGIFLOW } from 'utils/parcelasGenerator';
import * as XLSX from 'xlsx';

// fetchDespesaById: busca despesa individual por id para recarregar após baixa/revogar
async function fetchDespesaById(id) {
    const { data } = await supabase.from('caminhoes_despesas').select('*, veiculo:vehicle_id(id, placa, tipo)').eq('id', id).single();
    return data || null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const BRL = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const FMT = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—';
const inputCls = 'w-full px-3 py-2 rounded-lg border text-sm outline-none transition-all focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500';
const inputStyle = { borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' };

// ─── Reutilizáveis ────────────────────────────────────────────────────────────
function ModalOverlay({ children, onClose, wide }) {
    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)' }}>
            <div className={`bg-white rounded-2xl shadow-2xl flex flex-col ${wide ? 'w-full max-w-4xl' : 'w-full max-w-2xl'}`}
                style={{ maxHeight: 'calc(100vh - 32px)' }}>
                {children}
            </div>
        </div>
    );
}

function ModalHeader({ title, icon, onClose }) {
    return (
        <div className="flex items-center justify-between p-5 border-b shrink-0"
            style={{ borderColor: 'var(--color-border)' }}>
            <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#EFF6FF' }}>
                    <Icon name={icon} size={18} color="#1D4ED8" />
                </div>
                <h2 className="font-heading font-bold text-lg" style={{ color: 'var(--color-text-primary)' }}>{title}</h2>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                <Icon name="X" size={18} color="var(--color-muted-foreground)" />
            </button>
        </div>
    );
}

function Field({ label, required, children, className = '' }) {
    return (
        <div className={className}>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                {label}{required && <span className="text-red-500 ml-0.5">*</span>}
            </label>
            {children}
        </div>
    );
}

// ─── Badge de pagamento ───────────────────────────────────────────────────────
function PgBadge({ d }) {
    if (!d) return null;
    if (d.forma_pagamento === 'a_prazo') {
        const map = { boleto: 'Boleto', cartao_prazo: '💳 Cartão Parc.', permuta: 'Permuta', cheque: 'Cheque' };
        const isCard = d.tipo_pagamento === 'cartao_prazo';
        return <span className={`px-2 py-0.5 rounded text-xs font-medium ${isCard ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-700'}`}>{map[d.tipo_pagamento] || 'A Prazo'}</span>;
    }
    const map = { pix: 'PIX', dinheiro: 'Dinheiro', transferencia_m: 'Transf.', cartao: '💳 Cartão' };
    const isCard = d.tipo_pagamento === 'cartao';
    return <span className={`px-2 py-0.5 rounded text-xs font-medium ${isCard ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'}`}>{map[d.tipo_pagamento] || 'À Vista'}</span>;
}

// ─── Indicador de boletos pendentes ──────────────────────────────────────────
function BoletosPendentes({ despesa, onPagar }) {
    const boletos = despesa.boletos || [];
    const parcelas = despesa.parcelas_cartao || [];
    const pendBoletos = boletos.filter(b => !b.pago);
    const pendParcelas = parcelas.filter(p => !p.pago);
    const naoEntregues = boletos.filter(b => !b.entregue_financeiro);
    if (!pendBoletos.length && !pendParcelas.length) return null;
    const numeros = boletos.map(b => b.numero_boleto).filter(Boolean);
    return (
        <div className="mt-1 flex items-center gap-1 flex-wrap">
            {pendBoletos.length > 0 && (
                <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-xs font-medium" title={numeros.length ? `Nº: ${numeros.join(', ')}` : ''}>
                    {pendBoletos.length} boleto{pendBoletos.length > 1 ? 's' : ''} pendente{pendBoletos.length > 1 ? 's' : ''}
                    {numeros.length > 0 && <span className="font-data ml-1 text-amber-500">({numeros.join(', ')})</span>}
                </span>
            )}
            {pendParcelas.length > 0 && (
                <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 text-xs font-medium">
                    {pendParcelas.length} parcela{pendParcelas.length > 1 ? 's' : ''} pendente{pendParcelas.length > 1 ? 's' : ''}
                </span>
            )}
            {boletos.length > 0 && naoEntregues.length > 0 && (
                <span className="px-1.5 py-0.5 rounded bg-red-50 text-red-600 text-xs font-medium flex items-center gap-1">
                    <Icon name="AlertCircle" size={10} /> {naoEntregues.length} boleto{naoEntregues.length > 1 ? 's' : ''} não entregue{naoEntregues.length > 1 ? 's' : ''} ao financeiro
                </span>
            )}
        </div>
    );
}

// ─── Modal de Baixa de Boletos ────────────────────────────────────────────────
function ModalBaixa({ despesa, onClose, onBaixado, isAdmin }) {
    const { toast, showToast } = useToast();
    const [loading, setLoading] = useState(false);

    const handlePagarBoleto = async (idx) => {
        setLoading(true);
        try {
            await pagarBoletoCaminhao(despesa.id, idx);
            showToast('Boleto baixado!', 'success');
            onBaixado();
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
        finally { setLoading(false); }
    };

    const handleRevogarBoleto = async (idx) => {
        setLoading(true);
        try {
            await revogarBoletoCaminhao(despesa.id, idx);
            showToast('Baixa revogada!', 'warning');
            onBaixado();
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
        finally { setLoading(false); }
    };

    const handlePagarParcela = async (idx) => {
        setLoading(true);
        try {
            await pagarParcelaCartaoCaminhao(despesa.id, idx);
            showToast('Parcela baixada!', 'success');
            onBaixado();
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
        finally { setLoading(false); }
    };

    const handleRevogarParcela = async (idx) => {
        setLoading(true);
        try {
            await revogarParcelaCartaoCaminhao(despesa.id, idx);
            showToast('Baixa revogada!', 'warning');
            onBaixado();
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
        finally { setLoading(false); }
    };

    const boletos = despesa.boletos || [];
    const parcelas = despesa.parcelas_cartao || [];

    // ── Entrega ao financeiro: seleção local de 1+ boletos, salva tudo de uma vez ──
    const [entregas, setEntregas] = useState(() => boletos.map(b => !!b.entregue_financeiro));
    const entregasAlteradas = entregas.some((v, i) => v !== !!boletos[i]?.entregue_financeiro);
    const toggleEntrega = (idx) => setEntregas(prev => prev.map((v, i) => i === idx ? !v : v));
    const marcarTodasEntregas = (valor) => setEntregas(boletos.map(() => valor));
    const salvarEntregas = async () => {
        setLoading(true);
        try {
            const novos = boletos.map((b, i) => ({ ...b, entregue_financeiro: entregas[i] }));
            const { error } = await supabase.from('caminhoes_despesas').update({ boletos: novos, updated_at: new Date().toISOString() }).eq('id', despesa.id);
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
            </div>
            <Toast toast={toast} />
        </ModalOverlay>
    );
}

// ─── Modal: Visualizar Despesa + Baixas/Revogações ───────────────────────────
function ModalVisualizacaoDespesa({ despesa, onClose, onAtualizado, admin }) {
    const { toast, showToast } = useToast();
    const [loading, setLoading] = useState(false);
    const [dados, setDados] = useState(despesa);

    const reload = async () => {
        try {
            const updated = await fetchDespesaById(despesa.id).catch(() => null);
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
                        { l: 'Forma de Pagamento', v: dados.forma_pagamento  || '—' },
                        { l: 'Veículo',          v: dados.veiculo?.placa     || '—' },
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
                                                    const novos = boletos.map((x, i) => i === idx ? { ...x, entregue_financeiro: !x.entregue_financeiro } : x);
                                                    const { error } = await supabase.from('caminhoes_despesas').update({ boletos: novos, updated_at: new Date().toISOString() }).eq('id', dados.id);
                                                    if (error) throw error;
                                                }, 'Status de entrega atualizado!')} />
                                            <span className={b.entregue_financeiro ? 'text-blue-600 font-medium' : 'text-gray-400'}>{b.entregue_financeiro ? '✓ Entregue ao financeiro' : 'Ainda não entregue ao financeiro'}</span>
                                        </label>
                                    </div>
                                    <div className="flex gap-1.5 flex-shrink-0">
                                        {!b.pago ? (
                                            <button disabled={loading} onClick={() => act(() => pagarBoletoCaminhao(dados.id, idx), 'Boleto baixado!')}
                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-green-600 text-white hover:bg-green-700 disabled:opacity-60">
                                                <Icon name="Check" size={12} />Dar baixa
                                            </button>
                                        ) : (
                                            <>
                                                <span className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-green-100 text-green-700">Pago</span>
                                                {admin && <button disabled={loading} onClick={() => act(() => revogarBoletoCaminhao(dados.id, idx), 'Baixa revogada!')}
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
                                            <button disabled={loading} onClick={() => act(() => pagarParcelaCartaoCaminhao(dados.id, idx), 'Parcela baixada!')}
                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-60">
                                                <Icon name="Check" size={12} />Dar baixa
                                            </button>
                                        ) : (
                                            <>
                                                <span className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-purple-100 text-purple-700">Pago</span>
                                                {admin && <button disabled={loading} onClick={() => act(() => revogarParcelaCartaoCaminhao(dados.id, idx), 'Baixa revogada!')}
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

// ─── Página Principal ─────────────────────────────────────────────────────────
function ModalFornecedores({ onClose, onSelect }) {
    const { toast, showToast } = useToast();
    const { confirm, ConfirmDialog } = useConfirm();
    const [fornecedores, setFornecedores] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState(null);
    const [busca, setBusca] = useState('');
    const [form, setForm] = useState({ nome: '', cnpj: '', telefone: '', email: '', endereco: '', categoria: '', observacoes: '' });

    const load = async () => {
        try { setFornecedores(await fetchFornecedoresCaminhoes()); }
        catch (e) { showToast('Erro: ' + e.message, 'error'); }
        finally { setLoading(false); }
    };
    useEffect(() => { load(); }, []); // eslint-disable-line

    const handleSave = async () => {
        if (!form.nome.trim()) { showToast('Nome é obrigatório', 'error'); return; }
        // Normaliza: nome sempre presente; campos opcionais em branco viram null
        // (evita salvar strings vazias no banco e mantém consistência entre telas)
        const payload = {
            nome: form.nome.trim(),
            cnpj: form.cnpj.trim() || null,
            telefone: form.telefone.trim() || null,
            email: form.email.trim() || null,
            endereco: form.endereco.trim() || null,
            categoria: form.categoria || null,
            observacoes: form.observacoes.trim() || null,
        };
        try {
            if (modal?.mode === 'edit') await updateFornecedorCaminhao(modal.data.id, payload);
            else await createFornecedorCaminhao(payload);
            showToast('Fornecedor salvo!', 'success');
            setModal(null);
            load();
        } catch (e) {
            const msg = e.code === '23505' || /duplicate key|unique constraint/i.test(e.message)
                ? 'Já existe um fornecedor cadastrado com este CNPJ.'
                : 'Erro: ' + e.message;
            showToast(msg, 'error');
        }
    };

    const handleDelete = async (id) => {
        const ok = await confirm({ title: 'Excluir fornecedor?', message: 'Esta ação não pode ser desfeita.', confirmLabel: 'Excluir', variant: 'danger' });
        if (!ok) return;
        try { await deleteFornecedorCaminhao(id); showToast('Excluído!', 'success'); load(); }
        catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };

    const filtrados = fornecedores.filter(f => !busca || f.nome.toLowerCase().includes(busca.toLowerCase()) || (f.cnpj || '').includes(busca));

    return (
        <ModalOverlay onClose={onClose} wide>
            <ModalHeader title="Fornecedores" icon="Building2" onClose={onClose} />
            <div className="flex items-center gap-3 px-5 py-3 border-b shrink-0" style={{ borderColor: 'var(--color-border)' }}>
                <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por nome ou CNPJ..."
                    className={inputCls + ' flex-1'} style={inputStyle} />
                <Button onClick={() => { setForm({ nome: '', cnpj: '', telefone: '', email: '', endereco: '', categoria: '', observacoes: '' }); setModal({ mode: 'create' }); }} iconName="Plus" size="sm">
                    Novo
                </Button>
            </div>
            <div className="flex-1 overflow-y-auto">
                {loading ? (
                    <div className="flex justify-center py-12"><div className="animate-spin h-7 w-7 rounded-full border-4" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} /></div>
                ) : filtrados.length === 0 ? (
                    <div className="text-center py-12 text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
                        {busca ? 'Nenhum fornecedor encontrado' : 'Nenhum fornecedor cadastrado'}
                    </div>
                ) : (
                    <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
                        {filtrados.map(f => (
                            <div key={f.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
                                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: '#EFF6FF' }}>
                                    <Icon name="Building2" size={16} color="#1D4ED8" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm truncate" style={{ color: 'var(--color-text-primary)' }}>{f.nome}</p>
                                    <div className="flex items-center gap-3 flex-wrap">
                                        {f.cnpj && <span className="text-xs font-data" style={{ color: 'var(--color-muted-foreground)' }}>{f.cnpj}</span>}
                                        {f.telefone && <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>{f.telefone}</span>}
                                        {f.categoria && <span className="text-xs px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">{f.categoria}</span>}
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                    {onSelect && (
                                        <button onClick={() => { onSelect(f); onClose(); }}
                                            className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors">
                                            Selecionar
                                        </button>
                                    )}
                                    <button onClick={() => { setForm({ nome: f.nome, cnpj: f.cnpj || '', telefone: f.telefone || '', email: f.email || '', endereco: f.endereco || '', categoria: f.categoria || '', observacoes: f.observacoes || '' }); setModal({ mode: 'edit', data: f }); }}
                                        className="p-1.5 rounded hover:bg-blue-50 transition-colors"><Icon name="Pencil" size={13} color="#1D4ED8" /></button>
                                    <button onClick={() => handleDelete(f.id)}
                                        className="p-1.5 rounded hover:bg-red-50 transition-colors"><Icon name="Trash2" size={13} color="#DC2626" /></button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            {modal && (
                <div className="border-t p-5 space-y-3 shrink-0" style={{ borderColor: 'var(--color-border)' }}>
                    <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                        {modal.mode === 'create' ? 'Novo Fornecedor' : 'Editar Fornecedor'}
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                        <Field label="Nome" required className="col-span-2">
                            <input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} className={inputCls} style={inputStyle} placeholder="Razão social ou nome" />
                        </Field>
                        <Field label="CNPJ">
                            <input value={form.cnpj} onChange={e => setForm(f => ({ ...f, cnpj: e.target.value }))} className={inputCls} style={inputStyle} placeholder="00.000.000/0000-00" />
                        </Field>
                        <Field label="Telefone">
                            <input value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} className={inputCls} style={inputStyle} placeholder="(00) 00000-0000" />
                        </Field>
                        <Field label="E-mail">
                            <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className={inputCls} style={inputStyle} placeholder="contato@empresa.com" />
                        </Field>
                        <Field label="Categoria habitual">
                            <select value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))} className={inputCls} style={inputStyle}>
                                <option value="">Selecione...</option>
                                {CATEGORIAS_DESPESA_CAMINHOES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </Field>
                        <Field label="Endereço" className="col-span-2">
                            <input value={form.endereco} onChange={e => setForm(f => ({ ...f, endereco: e.target.value }))} className={inputCls} style={inputStyle} placeholder="Rua, número, cidade" />
                        </Field>
                    </div>
                    <div className="flex gap-2 justify-end pt-1">
                        <button onClick={() => setModal(null)} className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50" style={{ borderColor: 'var(--color-border)' }}>Cancelar</button>
                        <Button onClick={handleSave} size="sm" iconName="Check">Salvar</Button>
                    </div>
                </div>
            )}
            <Toast toast={toast} />
            {ConfirmDialog}
        </ModalOverlay>
    );
}

// ─── Modal de Formulário de Despesa ──────────────────────────────────────────
function ModalDespesa({ modal, veiculos, despesasExistentes = [], onClose, onSaved }) {
    const { toast, showToast } = useToast();
    const { confirm, ConfirmDialog } = useConfirm();
    const xmlRef = useRef(null);
    const comprovanteRef = useRef(null);
    const permutaRef = useRef(null);
    const barcodeInputRef = useRef(null);
    const corpoModalRef = useRef(null);
    const [barcodeMode, setBarcodeMode] = useState(false);
    const [barcodeBuffer, setBarcodeBuffer] = useState('');
    const [loadingNFe, setLoadingNFe] = useState(false);
    const [saving, setSaving] = useState(false);
    const [showFornecedores, setShowFornecedores] = useState(false);
    const [categorias, setCategorias] = useState(() => {
        try {
            const v2 = localStorage.getItem('caminhoes_categorias_v2');
            if (v2) return JSON.parse(v2);
            // Migração: existiam apenas as categorias extras criadas pelo usuário;
            // agora a lista completa (padrão + extras) fica editável.
            const extras = JSON.parse(localStorage.getItem('caminhoes_categorias_extras') || '[]');
            return [...CATEGORIAS_DESPESA_CAMINHOES, ...extras];
        } catch { return [...CATEGORIAS_DESPESA_CAMINHOES]; }
    });
    const salvarCategorias = (novas) => {
        setCategorias(novas);
        try { localStorage.setItem('caminhoes_categorias_v2', JSON.stringify(novas)); } catch {}
    };
    const [novaCategoria, setNovaCategoria] = useState('');
    const [showNovaCategoria, setShowNovaCategoria] = useState(false);
    const [novoBoleto, setNovoBoleto] = useState({ numero_boleto: '', vencimento: '', valor: '' });
    const [novoCheque, setNovoCheque] = useState({ numero: '', banco: '', valor: '', vencimento: '' });
    const [novaParcela, setNovaParcela] = useState({ vencimento: '', valor: '', cartao: '' });
    const [gerador, setGerador] = useState({ quantidade: 2, prazoDiasUteis: 30, intervaloDias: 30, numeroBoletoInicial: '' });
    const [duplicatas, setDuplicatas] = useState([]); // achados de detectarPossiveisDuplicatas, exibidos antes de salvar

    const todasCategorias = categorias;

    const emptyForm = () => ({
        vehicle_id: '', empresa: '', categoria: 'Pneus', descricao: '', valor: '',
        data_despesa: new Date().toISOString().split('T')[0], nota_fiscal: '',
        fornecedor: '', observacoes: '',
        notas_fiscais: [], nf_itens: [],
        forma_pagamento: 'a_vista', tipo_pagamento: 'pix',
        comprovante_url: '', boletos: [], parcelas_cartao: [],
        permuta_obs: '', permuta_doc_url: '', cheques: [],
    });

    const isEdit = modal?.mode === 'edit';
    const [form, setForm] = useState(() => {
        if (isEdit && modal?.data) {
            const d = modal.data;
            return {
                vehicle_id: d.vehicle_id || '', empresa: d.empresa || '',
                categoria: d.categoria, descricao: d.descricao || '',
                valor: String(d.valor || ''), data_despesa: d.data_despesa,
                nota_fiscal: d.nota_fiscal || '', fornecedor: d.fornecedor || '',
                observacoes: d.observacoes || '', notas_fiscais: d.notas_fiscais || [],
                nf_itens: d.nf_itens || [], forma_pagamento: d.forma_pagamento || 'a_vista',
                tipo_pagamento: d.tipo_pagamento || 'pix', comprovante_url: d.comprovante_url || '',
                boletos: d.boletos || [], parcelas_cartao: d.parcelas_cartao || [],
                permuta_obs: d.permuta_obs || '', permuta_doc_url: d.permuta_doc_url || '',
                cheques: d.cheques || [],
            };
        }
        return emptyForm();
    });

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const adicionarCategoria = () => {
        const cat = novaCategoria.trim();
        if (!cat || todasCategorias.includes(cat)) { showToast(cat ? 'Categoria já existe' : 'Digite o nome', 'error'); return; }
        salvarCategorias([...categorias, cat]);
        set('categoria', cat);
        setNovaCategoria(''); setShowNovaCategoria(false);
        showToast(`Categoria "${cat}" criada!`, 'success');
    };

    // Renomeia qualquer categoria (padrão ou criada pelo usuário) e atualiza em
    // cascata as despesas já lançadas com o nome antigo.
    const editarCategoria = async (catAntiga, catNovaBruta) => {
        const catNova = catNovaBruta.trim();
        if (!catNova) { showToast('Digite o nome da categoria', 'error'); return; }
        if (catNova === catAntiga) return;
        if (todasCategorias.includes(catNova)) { showToast('Já existe uma categoria com esse nome', 'error'); return; }
        try {
            const afetadas = despesasExistentes.filter(d => d.categoria === catAntiga);
            await Promise.all(afetadas.map(d => updateDespesaCaminhao(d.id, { categoria: catNova })));
            salvarCategorias(categorias.map(c => c === catAntiga ? catNova : c));
            if (form.categoria === catAntiga) set('categoria', catNova);
            showToast(`Categoria renomeada para "${catNova}"${afetadas.length ? ` (${afetadas.length} despesa(s) atualizada(s))` : ''}!`, 'success');
        } catch (e) { showToast('Erro ao renomear categoria: ' + e.message, 'error'); }
    };

    // Exclui uma categoria da lista de opções (não apaga despesas já lançadas
    // com esse texto — elas mantêm o valor salvo).
    const excluirCategoria = async (cat) => {
        if (categorias.length <= 1) { showToast('É preciso manter ao menos uma categoria', 'error'); return; }
        const emUso = despesasExistentes.filter(d => d.categoria === cat).length;
        const ok = await confirm({
            title: 'Excluir categoria?',
            message: emUso > 0
                ? `"${cat}" está sendo usada em ${emUso} despesa(s). Elas continuarão com esse texto, mas a categoria deixará de aparecer na lista de opções. Deseja continuar?`
                : `Excluir a categoria "${cat}"?`,
            confirmLabel: 'Excluir', variant: 'danger',
        });
        if (!ok) return;
        const novas = categorias.filter(c => c !== cat);
        salvarCategorias(novas);
        if (form.categoria === cat) set('categoria', novas[0] || '');
        showToast('Categoria excluída!', 'success');
    };
    const [editandoCategoria, setEditandoCategoria] = useState(null);
    const [textoEdicaoCategoria, setTextoEdicaoCategoria] = useState('');

    // ── XML NF-e ──────────────────────────────────────────────────────────────
    const handleXmlNF = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const parser = new DOMParser();
                const xml = parser.parseFromString(ev.target.result, 'application/xml');
                const nNF        = xml.querySelector('nNF')?.textContent || '';
                const dhEmi      = xml.querySelector('dhEmi')?.textContent?.slice(0, 10) || '';
                const vnf        = xml.querySelector('vNF')?.textContent || '';
                const emitNome   = xml.querySelector('emit xNome')?.textContent || '';
                const emitCNPJ   = xml.querySelector('emit CNPJ')?.textContent || '';
                const fornecedor = emitNome || (emitCNPJ ? `CNPJ ${emitCNPJ}` : '');
                const itens = [];
                xml.querySelectorAll('det prod').forEach(p => {
                    itens.push({
                        codigo: p.querySelector('cProd')?.textContent || '',
                        descricao: p.querySelector('xProd')?.textContent || '',
                        quantidade: p.querySelector('qCom')?.textContent || '',
                        unidade: p.querySelector('uCom')?.textContent || '',
                        valor_unit: p.querySelector('vUnCom')?.textContent || '',
                        valor_total: p.querySelector('vProd')?.textContent || '',
                    });
                });
                const novaNF = { numero: nNF, fornecedor, valor: vnf, data: dhEmi, descricao: '', nf_itens: itens };
                setForm(f => {
                    const novasNFs = [...(f.notas_fiscais || []), novaNF];
                    const soma = novasNFs.reduce((s, n) => s + Number(n.valor || 0), 0);
                    return {
                        ...f, nota_fiscal: f.nota_fiscal || nNF,
                        valor: soma > 0 ? String(soma) : f.valor,
                        data_despesa: f.data_despesa || dhEmi,
                        fornecedor: f.fornecedor || fornecedor,
                        descricao: (fornecedor && !f.descricao) ? `Compra — ${fornecedor}` : f.descricao,
                        nf_itens: [...(f.nf_itens || []), ...itens],
                        notas_fiscais: novasNFs,
                    };
                });
                showToast(`NF ${nNF} importada: ${fornecedor || 'emissor não identificado'} · ${itens.length} item(s)`, 'success');
                if (fornecedor) {
                    garantirFornecedorCadastrado(fetchFornecedoresCaminhoes, createFornecedorCaminhao, { nome: fornecedor, cnpj: emitCNPJ })
                        .then(r => { if (r === 'cadastrado') showToast(`Fornecedor "${fornecedor}" cadastrado automaticamente.`, 'info'); });
                }
            } catch { showToast('Erro ao ler XML. Verifique o arquivo.', 'error'); }
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    // ── Código de barras ──────────────────────────────────────────────────────
    const buscarDadosNFe = async (chave) => {
        setLoadingNFe(true);
        try {
            const nNF = chave.substring(25, 34).replace(/^0+/, '') || chave.substring(25, 34);
            const cnpjEmit = chave.substring(6, 20);
            const serie = chave.substring(22, 25).replace(/^0+/, '') || '1';
            const aamm = chave.substring(2, 6);
            const dataEmissao = `20${aamm.substring(0, 2)}-${aamm.substring(2, 4)}-01`;
            let fornecedor = '';
            try {
                const resp = await fetch(`https://receitaws.com.br/v1/cnpj/${cnpjEmit}`, { headers: { 'Accept': 'application/json' } });
                if (resp.ok) { const json = await resp.json(); if (json?.nome) fornecedor = json.nome; }
            } catch { /* silencioso */ }
            const cnpjFmt = cnpjEmit.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
            setForm(f => ({
                ...f, nota_fiscal: nNF, data_despesa: dataEmissao,
                fornecedor: fornecedor || f.fornecedor || `CNPJ ${cnpjFmt}`,
                descricao: f.descricao || `NF ${nNF} · Série ${serie}`,
            }));
            showToast(fornecedor ? `✅ NF ${nNF} — ${fornecedor}` : `NF ${nNF} lida. Consulte o XML para dados completos.`, fornecedor ? 'success' : 'info');
            if (fornecedor) {
                garantirFornecedorCadastrado(fetchFornecedoresCaminhoes, createFornecedorCaminhao, { nome: fornecedor, cnpj: cnpjEmit })
                    .then(r => { if (r === 'cadastrado') showToast(`Fornecedor "${fornecedor}" cadastrado automaticamente.`, 'info'); });
            }
        } catch {
            const nNF = chave.length === 44 ? chave.substring(25, 34).replace(/^0+/, '') || chave : chave;
            setForm(f => ({ ...f, nota_fiscal: nNF }));
            showToast(`NF ${nNF} lida`, 'info');
        } finally { setLoadingNFe(false); }
    };

    const handleBarcodeKeyDown = async (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const codigo = barcodeBuffer.trim();
            if (!codigo) return;
            setBarcodeBuffer(''); setBarcodeMode(false);
            if (codigo.length === 44 && /^\d{44}$/.test(codigo)) await buscarDadosNFe(codigo);
            else { setForm(f => ({ ...f, nota_fiscal: codigo })); showToast(`Código lido: ${codigo}`, 'success'); }
            setTimeout(() => document.getElementById('despesa-valor-cam')?.focus(), 100);
        }
        if (e.key === 'Escape') { setBarcodeMode(false); setBarcodeBuffer(''); }
    };

    // ── Boletos / cheques / parcelas ──────────────────────────────────────────
    // Edita um campo de um boleto já lançado (manual ou gerado automaticamente) diretamente na lista.
    const setBoletoField = (idx, campo) => (e) => setForm(f => ({ ...f, boletos: f.boletos.map((x, i) => i === idx ? { ...x, [campo]: e.target.value } : x) }));
    const setParcelaCartaoField = (idx, campo) => (e) => setForm(f => ({ ...f, parcelas_cartao: f.parcelas_cartao.map((x, i) => i === idx ? { ...x, [campo]: e.target.value } : x) }));

    const addBoleto = () => {
        if (!novoBoleto.vencimento || !novoBoleto.valor) { showToast('Preencha vencimento e valor', 'error'); return; }
        setForm(f => ({ ...f, boletos: [...(f.boletos || []), { ...novoBoleto, pago: false, entregue_financeiro: false }] }));
        setNovoBoleto({ numero_boleto: '', vencimento: '', valor: '' });
    };
    const addCheque = () => {
        if (!novoCheque.numero || !novoCheque.valor) { showToast('Preencha número e valor', 'error'); return; }
        setForm(f => ({ ...f, cheques: [...(f.cheques || []), { ...novoCheque }] }));
        setNovoCheque({ numero: '', banco: '', valor: '', vencimento: '' });
    };
    const addParcela = () => {
        if (!novaParcela.vencimento || !novaParcela.valor) { showToast('Preencha vencimento e valor', 'error'); return; }
        setForm(f => ({ ...f, parcelas_cartao: [...(f.parcelas_cartao || []), { ...novaParcela, pago: false }] }));
        setNovaParcela({ vencimento: '', valor: '', cartao: '' });
    };

    // ── Geração automática de parcelas (boleto ou cartão) ─────────────────────
    const gerarAutomatico = (tipo) => {
        if (!form.valor || Number(form.valor) <= 0) { showToast('Informe o valor total da despesa antes de gerar as parcelas.', 'error'); return; }
        if (!form.data_despesa) { showToast('Informe a data da despesa/nota fiscal antes de gerar as parcelas.', 'error'); return; }
        const primeiroVencimento = adicionarDiasUteis(form.data_despesa, gerador.prazoDiasUteis);
        try {
            const parcelas = gerarParcelasAutomaticas({
                valorTotal: Number(form.valor),
                quantidade: gerador.quantidade,
                primeiroVencimento,
                intervaloDias: Number(gerador.intervaloDias) || 30,
                tipo,
                numeroBoletoInicial: gerador.numeroBoletoInicial || null,
                cartao: novaParcela.cartao,
            });
            if (tipo === 'boleto') setForm(f => ({ ...f, boletos: parcelas }));
            else setForm(f => ({ ...f, parcelas_cartao: parcelas }));
            showToast(`${parcelas.length} parcela(s) geradas a partir de ${FMT(primeiroVencimento)} (NF + ${gerador.prazoDiasUteis} dias úteis) — soma ${BRL(somaParcelas(parcelas))}.`, 'success');
        } catch (e) { showToast(e.message, 'error'); }
    };

    // ── Salvar ────────────────────────────────────────────────────────────────
    const handleSave = async (forcarApesarDeDuplicata = false) => {
        if (!form.categoria || !form.valor || !form.data_despesa) { showToast('Categoria, valor e data são obrigatórios', 'error'); return; }

        // Checagem de possíveis duplicatas — só avisa, não bloqueia sozinha.
        if (!forcarApesarDeDuplicata) {
            const veiculoSelecionado = veiculos.find(v => v.id === form.vehicle_id);
            const excluirId = isEdit ? modal.data.id : undefined;

            // Checagem GLOBAL de NF: consulta o banco inteiro, não só o que está
            //    carregado na tela (que pode estar filtrado por mês/veículo/categoria).
            let achadosNf = [];
            if (form.nota_fiscal?.trim()) {
                const existentesComMesmaNf = await buscarDespesasComMesmaNf('caminhoes_despesas', form.nota_fiscal, excluirId);
                achadosNf = existentesComMesmaNf.map(d => ({
                    despesa: d,
                    motivo: `Nota fiscal ${form.nota_fiscal} já lançada${d.fornecedor ? ` para ${d.fornecedor}` : ''}${d.categoria ? ` (${d.categoria})` : ''} em ${d.data_despesa ? FMT(d.data_despesa) : '—'}, valor ${BRL(d.valor)}.`,
                    confianca: 'alta',
                }));
            }

            // Checagem local (fornecedor+placa+valor+data, nº de boleto) sobre o que já está na tela.
            const achadosLocais = detectarPossiveisDuplicatas(despesasExistentes, { ...form, placa: veiculoSelecionado?.placa }, { excluirId });

            const achados = [...achadosNf, ...achadosLocais];
            if (achados.length > 0) {
                setDuplicatas(achados);
                showToast(`⚠️ Possível duplicidade encontrada (${achados.length}) — revise antes de salvar.`, 'error');
                corpoModalRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
                return;
            }
        }

        setSaving(true);
        try {
            const payload = {
                ...form,
                vehicle_id: form.vehicle_id || null,
                valor: Number(form.valor),
                notas_fiscais: form.notas_fiscais || [],
                nf_itens: form.nf_itens || [],
                boletos: form.boletos || [],
                parcelas_cartao: form.parcelas_cartao || [],
                cheques: form.cheques || [],
            };
            if (!payload.vehicle_id) delete payload.vehicle_id;
            if (isEdit) await updateDespesaCaminhao(modal.data.id, payload);
            else await createDespesaCaminhao(payload);
            showToast('Despesa salva!', 'success');
            onSaved();
            onClose();
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
        finally { setSaving(false); }
    };

    return (
        <>
            <ModalOverlay onClose={onClose} wide>
                <ModalHeader title={isEdit ? 'Editar Despesa' : 'Nova Despesa'} icon="Receipt" onClose={onClose} />
                <div ref={corpoModalRef} className="p-5 space-y-4 overflow-y-auto flex-1">

                    {/* ── Alerta de possível duplicidade ────────────────────── */}
                    {duplicatas.length > 0 && (
                        <div className="p-3 rounded-xl border border-red-300 bg-red-50 space-y-2">
                            <p className="text-sm font-semibold text-red-700 flex items-center gap-1.5">
                                <Icon name="AlertTriangle" size={15} /> Possível lançamento duplicado
                            </p>
                            {duplicatas.map((d, i) => (
                                <p key={i} className="text-xs text-red-600 pl-1">
                                    • {d.motivo} <span className="text-red-400">({d.confianca === 'alta' ? 'alta chance' : 'checar antes de salvar'})</span>
                                </p>
                            ))}
                            <div className="flex gap-2 pt-1">
                                <button type="button" onClick={() => setDuplicatas([])} className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-red-300 text-red-700 hover:bg-red-100">
                                    Revisar lançamento
                                </button>
                                <button type="button" onClick={() => { setDuplicatas([]); handleSave(true); }} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-600 text-white hover:bg-red-700">
                                    Salvar mesmo assim
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ── NF Section ─────────────────────────────────────── */}
                    <div className="p-3 rounded-xl border" style={{ borderColor: '#BFDBFE', backgroundColor: '#EFF6FF' }}>
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-semibold text-blue-700">
                                📄 Notas Fiscais
                                {(form.notas_fiscais || []).length > 0 && <span className="ml-2 px-1.5 py-0.5 rounded-full bg-blue-600 text-white text-xs">{(form.notas_fiscais || []).length}</span>}
                            </p>
                            <button type="button" onClick={() => setForm(f => ({ ...f, notas_fiscais: [...(f.notas_fiscais || []), { numero: '', fornecedor: '', data: '', descricao: '', valor: '', nf_itens: [], _manual: true }] }))}
                                className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium border border-blue-300 text-blue-700 hover:bg-blue-100">
                                <Icon name="Plus" size={11} /> Adicionar NF manual
                            </button>
                        </div>
                        <div className="flex flex-wrap gap-2 mb-2">
                            <button type="button" onClick={() => xmlRef.current?.click()}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-700">
                                <Icon name="FileCode" size={12} /> {(form.notas_fiscais || []).length > 0 ? 'Importar outro XML' : 'Importar XML da NF'}
                            </button>
                            <input ref={xmlRef} type="file" accept=".xml" onChange={handleXmlNF} className="hidden" />
                            <button type="button"
                                onClick={() => { setBarcodeMode(b => !b); setBarcodeBuffer(''); setTimeout(() => barcodeInputRef.current?.focus(), 50); }}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors"
                                style={barcodeMode ? { backgroundColor: '#1D4ED8', color: '#fff', borderColor: '#1D4ED8' } : { borderColor: '#93C5FD', color: '#1D4ED8', backgroundColor: 'white' }}>
                                <Icon name="ScanLine" size={12} /> {barcodeMode ? 'Aguardando leitura...' : 'Ler código de barras'}
                            </button>
                        </div>
                        {barcodeMode && (
                            <div className="mt-2">
                                <p className="text-xs text-blue-600 mb-1.5">🔫 Aponte o leitor para o código de barras da NF impressa.</p>
                                <input ref={barcodeInputRef} type="text" value={barcodeBuffer}
                                    onChange={e => setBarcodeBuffer(e.target.value)} onKeyDown={handleBarcodeKeyDown}
                                    className={inputCls} style={{ ...inputStyle, borderColor: '#3B82F6', boxShadow: '0 0 0 3px rgba(59,130,246,0.15)' }}
                                    placeholder="Aguardando leitura do scanner..." autoFocus autoComplete="off" disabled={loadingNFe} />
                                {loadingNFe && <div className="flex items-center gap-2 mt-2 text-xs text-blue-600"><div className="animate-spin h-3 w-3 rounded-full border-2 border-blue-600" style={{ borderTopColor: 'transparent' }} />Consultando SEFAZ...</div>}
                                <button type="button" onClick={() => { setBarcodeMode(false); setBarcodeBuffer(''); }} className="text-xs text-blue-600 underline mt-1">Cancelar (Esc)</button>
                            </div>
                        )}
                        {(form.notas_fiscais || []).length > 0 && (
                            <div className="mt-3 space-y-2">
                                {(form.notas_fiscais || []).map((nf, nfIdx) => (
                                    <div key={nfIdx} className="rounded-xl border border-blue-200 bg-white overflow-hidden">
                                        <div className="flex items-center justify-between px-3 py-1.5 bg-blue-50 border-b border-blue-100">
                                            <span className="text-xs font-semibold text-blue-800">NF {nfIdx + 1} {nf._manual ? '— manual' : '— XML'}</span>
                                            <button type="button" onClick={() => setForm(f => { const novas = f.notas_fiscais.filter((_, i) => i !== nfIdx); const soma = novas.reduce((s, n) => s + Number(n.valor || 0), 0); return { ...f, notas_fiscais: novas, valor: soma > 0 ? String(soma) : f.valor }; })} className="p-1 rounded hover:bg-red-100"><Icon name="X" size={12} color="#DC2626" /></button>
                                        </div>
                                        <div className="p-3 grid grid-cols-2 gap-2">
                                            {[
                                                { label: 'Nº da NF', field: 'numero', placeholder: 'Ex: 35520' },
                                                { label: 'Valor (R$)', field: 'valor', placeholder: '0,00', type: 'number' },
                                                { label: 'Fornecedor', field: 'fornecedor', placeholder: 'Nome do fornecedor' },
                                                { label: 'Data de emissão', field: 'data', placeholder: '', type: 'date' },
                                            ].map(({ label, field, placeholder, type }) => (
                                                <div key={field}>
                                                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>{label} {!nf._manual && nf[field] && <span className="text-emerald-600 font-normal text-xs">auto</span>}</label>
                                                    <input type={type || 'text'} value={nf[field] || ''} placeholder={placeholder}
                                                        onChange={e => setForm(f => {
                                                            const a = [...f.notas_fiscais];
                                                            a[nfIdx] = { ...a[nfIdx], [field]: e.target.value };
                                                            const soma = a.reduce((s, n) => s + Number(n.valor || 0), 0);
                                                            return { ...f, notas_fiscais: a, ...(field === 'valor' && soma > 0 ? { valor: String(soma) } : {}) };
                                                        })}
                                                        className={inputCls} style={inputStyle} />
                                                </div>
                                            ))}
                                            <div className="col-span-2">
                                                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Descrição</label>
                                                <input value={nf.descricao || ''} placeholder="Ex: NF de peças"
                                                    onChange={e => setForm(f => { const a = [...f.notas_fiscais]; a[nfIdx] = { ...a[nfIdx], descricao: e.target.value }; return { ...f, notas_fiscais: a }; })}
                                                    className={inputCls} style={inputStyle} />
                                            </div>
                                        </div>
                                        {nf.nf_itens?.length > 0 && (
                                            <div className="px-3 pb-3 overflow-x-auto">
                                                <p className="text-xs text-blue-600 font-medium mb-1">{nf.nf_itens.length} item(s) do XML:</p>
                                                <table className="w-full text-xs">
                                                    <thead><tr className="text-blue-700">{['Cód', 'Descrição', 'Qtd', 'Un', 'V.Total'].map(h => <th key={h} className="text-left px-1 py-0.5 border-b border-blue-100 font-medium">{h}</th>)}</tr></thead>
                                                    <tbody>{nf.nf_itens.map((it, i) => (
                                                        <tr key={i} className="border-b border-blue-50">
                                                            <td className="px-1 py-1 font-data">{it.codigo}</td>
                                                            <td className="px-1 py-1 max-w-[130px] truncate">{it.descricao}</td>
                                                            <td className="px-1 py-1 font-data text-right">{it.quantidade}</td>
                                                            <td className="px-1 py-1">{it.unidade}</td>
                                                            <td className="px-1 py-1 font-data text-right text-blue-700">{BRL(it.valor_total)}</td>
                                                        </tr>
                                                    ))}</tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {(form.notas_fiscais || []).filter(n => n.valor).length > 1 && (
                                    <div className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE' }}>
                                        <span className="text-xs font-semibold text-blue-700">Total ({(form.notas_fiscais || []).length} NFs)</span>
                                        <span className="text-sm font-bold font-data text-blue-800">{BRL((form.notas_fiscais || []).reduce((s, n) => s + Number(n.valor || 0), 0))}</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* ── Dados básicos ─────────────────────────────────────── */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="Categoria" required>
                            <div className="space-y-2">
                                <div className="flex gap-2">
                                    <select value={form.categoria} onChange={e => set('categoria', e.target.value)} className={inputCls} style={inputStyle}>
                                        {todasCategorias.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                    <button type="button" onClick={() => setShowNovaCategoria(s => !s)}
                                        className="shrink-0 px-2.5 py-2 rounded-lg border text-xs font-medium hover:bg-blue-50"
                                        style={{ borderColor: '#93C5FD', color: '#1D4ED8' }}>
                                        <Icon name={showNovaCategoria ? 'X' : 'Plus'} size={14} />
                                    </button>
                                </div>
                                {showNovaCategoria && (
                                    <div className="flex gap-2 p-2 rounded-lg" style={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE' }}>
                                        <input value={novaCategoria} onChange={e => setNovaCategoria(e.target.value)} onKeyDown={e => e.key === 'Enter' && adicionarCategoria()}
                                            className={inputCls + ' flex-1'} style={inputStyle} placeholder="Nome da nova categoria..." autoFocus />
                                        <button type="button" onClick={adicionarCategoria} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 text-white">Criar</button>
                                    </div>
                                )}
                                {showNovaCategoria && todasCategorias.length > 0 && (
                                    <div className="space-y-1 p-2 rounded-lg" style={{ backgroundColor: '#F9FAFB', border: '1px solid var(--color-border)' }}>
                                        <p className="text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--color-muted-foreground)' }}>Categorias (clique no lápis pra editar)</p>
                                        {todasCategorias.map(cat => (
                                            <div key={cat} className="flex items-center gap-2">
                                                {editandoCategoria === cat ? (
                                                    <>
                                                        <input value={textoEdicaoCategoria} onChange={e => setTextoEdicaoCategoria(e.target.value)}
                                                            onKeyDown={e => { if (e.key === 'Enter') { editarCategoria(cat, textoEdicaoCategoria); setEditandoCategoria(null); } if (e.key === 'Escape') setEditandoCategoria(null); }}
                                                            className={inputCls + ' flex-1'} style={{ ...inputStyle, padding: '4px 8px' }} autoFocus />
                                                        <button type="button" onClick={() => { editarCategoria(cat, textoEdicaoCategoria); setEditandoCategoria(null); }}
                                                            className="shrink-0 p-1.5 rounded-md text-green-600 hover:bg-green-50" title="Salvar"><Icon name="Check" size={14} /></button>
                                                        <button type="button" onClick={() => setEditandoCategoria(null)}
                                                            className="shrink-0 p-1.5 rounded-md text-gray-500 hover:bg-gray-100" title="Cancelar"><Icon name="X" size={14} /></button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <span className="flex-1 text-xs truncate" style={{ color: 'var(--color-text-primary)' }}>{cat}</span>
                                                        <button type="button" onClick={() => { setEditandoCategoria(cat); setTextoEdicaoCategoria(cat); }}
                                                            className="shrink-0 p-1.5 rounded-md hover:bg-blue-50" style={{ color: '#1D4ED8' }} title="Renomear"><Icon name="Pencil" size={13} /></button>
                                                        <button type="button" onClick={() => excluirCategoria(cat)}
                                                            className="shrink-0 p-1.5 rounded-md text-red-600 hover:bg-red-50" title="Excluir"><Icon name="Trash2" size={13} /></button>
                                                    </>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </Field>
                        <Field label="Veículo (Placa)">
                            <select value={form.vehicle_id} onChange={e => set('vehicle_id', e.target.value)} className={inputCls} style={inputStyle}>
                                <option value="">Sem veículo específico</option>
                                {veiculos.map(v => <option key={v.id} value={v.id}>{v.placa} — {v.tipo || ''}</option>)}
                            </select>
                        </Field>
                        <Field label="Data" required>
                            <input type="date" value={form.data_despesa} onChange={e => set('data_despesa', e.target.value)} className={inputCls} style={inputStyle} />
                        </Field>
                        <Field label="Valor (R$)" required>
                            <input id="despesa-valor-cam" type="number" step="0.01" min="0" value={form.valor} onChange={e => set('valor', e.target.value)} className={inputCls} style={inputStyle} placeholder="0,00" />
                        </Field>
                        <Field label="Empresa">
                            <select value={form.empresa || ''} onChange={e => set('empresa', e.target.value)} className={inputCls} style={inputStyle}>
                                <option value="">Selecione a empresa...</option>
                                {EMPRESAS_LOGIFLOW.map(nome => <option key={nome} value={nome}>{nome}</option>)}
                            </select>
                        </Field>
                        <Field label="Nº Nota Fiscal">
                            <input value={form.nota_fiscal} onChange={e => set('nota_fiscal', e.target.value)} className={inputCls} style={inputStyle} placeholder="Ex: 12345" />
                        </Field>
                        <Field label="Fornecedor" className="sm:col-span-2">
                            <div className="flex gap-2">
                                <input value={form.fornecedor || ''} onChange={e => set('fornecedor', e.target.value)} className={inputCls + ' flex-1'} style={inputStyle} placeholder="Ex: Auto Peças Silva Ltda" />
                                <button type="button" onClick={() => setShowFornecedores(true)}
                                    className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium hover:bg-gray-50 transition-colors" style={{ borderColor: 'var(--color-border)' }}>
                                    <Icon name="Building2" size={13} /> Fornecedores
                                </button>
                            </div>
                        </Field>
                        <Field label="Descrição" className="sm:col-span-2">
                            <input value={form.descricao} onChange={e => set('descricao', e.target.value)} className={inputCls} style={inputStyle} placeholder="Ex: 4 pneus traseiros Bridgestone" />
                        </Field>
                    </div>

                    {/* ── Pagamento ─────────────────────────────────────────── */}
                    <div className="space-y-3">
                        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-secondary)' }}>Forma de Pagamento</p>
                        <div className="flex gap-2">
                            {[['a_vista', '💳 À Vista'], ['a_prazo', '📋 A Prazo']].map(([v, l]) => (
                                <button key={v} type="button" onClick={() => setForm(f => ({ ...f, forma_pagamento: v, tipo_pagamento: v === 'a_vista' ? 'pix' : 'boleto' }))}
                                    className="flex-1 py-2 rounded-lg text-sm font-medium border transition-colors"
                                    style={form.forma_pagamento === v ? { backgroundColor: 'var(--color-primary)', color: '#fff', borderColor: 'var(--color-primary)' } : { borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}>
                                    {l}
                                </button>
                            ))}
                        </div>

                        {form.forma_pagamento === 'a_vista' && (
                            <div className="space-y-3 p-3 rounded-xl border" style={{ borderColor: '#BBF7D0', backgroundColor: '#F0FDF4' }}>
                                <p className="text-xs font-semibold text-green-700">Tipo de pagamento</p>
                                <div className="flex gap-2 flex-wrap">
                                    {[['pix', 'PIX'], ['dinheiro', 'Dinheiro'], ['transferencia_m', 'Transferência'], ['cartao', '💳 Cartão à vista']].map(([v, l]) => (
                                        <button key={v} type="button" onClick={() => set('tipo_pagamento', v)}
                                            className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors"
                                            style={form.tipo_pagamento === v ? { backgroundColor: '#059669', color: '#fff', borderColor: '#059669' } : { borderColor: '#BBF7D0', color: '#065F46', backgroundColor: 'white' }}>
                                            {l}
                                        </button>
                                    ))}
                                </div>
                                <div>
                                    <p className="text-xs font-medium mb-2 text-green-700">Comprovante (opcional)</p>
                                    <div className="flex items-center gap-2">
                                        <button type="button" onClick={() => comprovanteRef.current?.click()} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium hover:bg-green-50" style={{ borderColor: '#BBF7D0' }}>
                                            <Icon name="Paperclip" size={13} /> Anexar comprovante
                                        </button>
                                        {form.comprovante_url && <span className="text-xs text-green-700 flex items-center gap-1"><Icon name="CheckCircle2" size={12} /> Anexado</span>}
                                        <input ref={comprovanteRef} type="file" accept="image/*,.pdf" onChange={e => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = ev => set('comprovante_url', ev.target.result); r.readAsDataURL(f); }} className="hidden" />
                                    </div>
                                </div>
                            </div>
                        )}

                        {form.forma_pagamento === 'a_prazo' && (
                            <div className="space-y-3 p-3 rounded-xl border" style={{ borderColor: '#FED7AA', backgroundColor: '#FFF7ED' }}>
                                <p className="text-xs font-semibold text-amber-700">Tipo de pagamento a prazo</p>
                                <div className="flex gap-2 flex-wrap">
                                    {[['boleto', 'Boleto'], ['cartao_prazo', '💳 Cartão Parcelado'], ['cheque', 'Cheque'], ['permuta', 'Permuta']].map(([v, l]) => (
                                        <button key={v} type="button" onClick={() => set('tipo_pagamento', v)}
                                            className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors"
                                            style={form.tipo_pagamento === v ? { backgroundColor: '#D97706', color: '#fff', borderColor: '#D97706' } : { borderColor: '#FED7AA', color: '#92400E', backgroundColor: 'white' }}>
                                            {l}
                                        </button>
                                    ))}
                                </div>

                                {/* Boleto */}
                                {form.tipo_pagamento === 'boleto' && (
                                    <div className="space-y-2">
                                        <p className="text-xs font-medium text-amber-800">Boletos / Parcelas</p>
                                        {(form.boletos || []).map((b, idx) => (
                                            <div key={idx} className="p-2 rounded-lg bg-white border" style={{ borderColor: '#FED7AA' }}>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <input value={b.numero_boleto || ''} onChange={setBoletoField(idx, 'numero_boleto')} placeholder={`Boleto ${idx + 1}`}
                                                        className="text-xs font-medium text-amber-700 border rounded px-1.5 py-1 w-24 shrink-0" style={{ borderColor: '#FED7AA' }} title="Nº do boleto" />
                                                    <input type="date" value={b.vencimento || ''} onChange={setBoletoField(idx, 'vencimento')}
                                                        className="text-xs font-data border rounded px-1.5 py-1 shrink-0" style={{ borderColor: '#FED7AA' }} />
                                                    <input type="number" step="0.01" value={b.valor} onChange={setBoletoField(idx, 'valor')}
                                                        className="text-xs font-data font-semibold text-amber-800 border rounded px-1.5 py-1 w-24 shrink-0" style={{ borderColor: '#FED7AA' }} />
                                                    <span className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${b.pago ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{b.pago ? 'Pago' : 'Pendente'}</span>
                                                    <button type="button" onClick={() => setForm(f => ({ ...f, boletos: f.boletos.filter((_, i) => i !== idx) }))} className="ml-auto p-1 rounded hover:bg-red-50 shrink-0"><Icon name="X" size={11} color="#DC2626" /></button>
                                                </div>
                                                <label className="flex items-center gap-1 text-xs cursor-pointer mt-1.5" title="Marcar se o boleto já foi entregue ao setor financeiro">
                                                    <input type="checkbox" checked={!!b.entregue_financeiro}
                                                        onChange={() => setForm(f => ({ ...f, boletos: f.boletos.map((x, i) => i === idx ? { ...x, entregue_financeiro: !x.entregue_financeiro } : x) }))} />
                                                    <span className={b.entregue_financeiro ? 'text-blue-600' : 'text-gray-400'}>Entregue ao financeiro</span>
                                                </label>
                                            </div>
                                        ))}

                                        {/* Gerador automático de parcelas */}
                                        <div className="p-2.5 rounded-lg border border-dashed" style={{ borderColor: '#D97706', backgroundColor: '#FFFBEB' }}>
                                            <p className="text-xs font-semibold text-amber-800 mb-1.5 flex items-center gap-1"><Icon name="Wand2" size={12} /> Gerar parcelas automaticamente</p>
                                            <div className="grid grid-cols-4 gap-2">
                                                <Field label="Qtde parcelas"><input type="number" min="1" value={gerador.quantidade} onChange={e => setGerador(g => ({ ...g, quantidade: e.target.value }))} className={inputCls} style={inputStyle} /></Field>
                                                <Field label="Prazo (dias úteis)"><input type="number" min="0" value={gerador.prazoDiasUteis} onChange={e => setGerador(g => ({ ...g, prazoDiasUteis: e.target.value }))} className={inputCls} style={inputStyle} placeholder="Ex: 30" /></Field>
                                                <Field label="Intervalo (dias)"><input type="number" min="1" value={gerador.intervaloDias} onChange={e => setGerador(g => ({ ...g, intervaloDias: e.target.value }))} className={inputCls} style={inputStyle} /></Field>
                                                <Field label="Nº do 1º boleto (opcional)"><input value={gerador.numeroBoletoInicial} onChange={e => setGerador(g => ({ ...g, numeroBoletoInicial: e.target.value }))} className={inputCls} style={inputStyle} placeholder="Ex: 4521" /></Field>
                                            </div>
                                            <p className="text-[11px] text-amber-600 mt-1">
                                                1º vencimento calculado: <strong>{form.data_despesa && gerador.prazoDiasUteis !== '' ? FMT(adicionarDiasUteis(form.data_despesa, gerador.prazoDiasUteis)) : '—'}</strong> (data da despesa/NF + {gerador.prazoDiasUteis || 0} dias úteis).
                                                Valor total ({BRL(form.valor || 0)}) dividido pela quantidade — a diferença de centavos fica na última parcela. Isso substitui os boletos já lançados manualmente e continua editável depois.
                                            </p>
                                            <button type="button" onClick={() => gerarAutomatico('boleto')} className="mt-1.5 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-600 text-white hover:bg-amber-700"><Icon name="Wand2" size={12} /> Gerar boletos automaticamente</button>
                                        </div>

                                        <p className="text-xs font-medium text-amber-700 pt-1">ou adicione manualmente:</p>
                                        <div className="grid grid-cols-3 gap-2">
                                            <Field label="Nº do boleto"><input value={novoBoleto.numero_boleto} onChange={e => setNovoBoleto(b => ({ ...b, numero_boleto: e.target.value }))} className={inputCls} style={inputStyle} placeholder="Ex: 01/03" /></Field>
                                            <Field label="Vencimento"><input type="date" value={novoBoleto.vencimento} onChange={e => setNovoBoleto(b => ({ ...b, vencimento: e.target.value }))} className={inputCls} style={inputStyle} /></Field>
                                            <Field label="Valor (R$)"><input type="number" step="0.01" value={novoBoleto.valor} onChange={e => setNovoBoleto(b => ({ ...b, valor: e.target.value }))} className={inputCls} style={inputStyle} placeholder="0,00" /></Field>
                                        </div>
                                        <button type="button" onClick={addBoleto} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-amber-300 text-amber-700 hover:bg-amber-50"><Icon name="Plus" size={12} /> Adicionar boleto</button>
                                    </div>
                                )}

                                {/* Cartão parcelado */}
                                {form.tipo_pagamento === 'cartao_prazo' && (
                                    <div className="space-y-2">
                                        <p className="text-xs font-medium text-amber-800">Parcelas do Cartão</p>
                                        {(form.parcelas_cartao || []).map((p, idx) => (
                                            <div key={idx} className="flex items-center gap-2 p-2 rounded-lg bg-white border text-xs flex-wrap" style={{ borderColor: '#FED7AA' }}>
                                                <span className="text-amber-700 font-medium">Parcela {idx + 1}</span>
                                                <input type="date" value={p.vencimento || ''} onChange={setParcelaCartaoField(idx, 'vencimento')} className="font-data border rounded px-1.5 py-1" style={{ borderColor: '#FED7AA' }} />
                                                <input type="number" step="0.01" value={p.valor} onChange={setParcelaCartaoField(idx, 'valor')} className="font-data font-semibold text-amber-800 border rounded px-1.5 py-1 w-24" style={{ borderColor: '#FED7AA' }} />
                                                <input value={p.cartao || ''} onChange={setParcelaCartaoField(idx, 'cartao')} placeholder="Cartão" className="text-amber-600 border rounded px-1.5 py-1 w-24" style={{ borderColor: '#FED7AA' }} />
                                                <span className={`ml-auto px-1.5 py-0.5 rounded ${p.pago ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{p.pago ? 'Pago' : 'Pendente'}</span>
                                                <button type="button" onClick={() => setForm(f => ({ ...f, parcelas_cartao: f.parcelas_cartao.filter((_, i) => i !== idx) }))} className="p-1 rounded hover:bg-red-50"><Icon name="X" size={11} color="#DC2626" /></button>
                                            </div>
                                        ))}
                                        <div className="p-2.5 rounded-lg border border-dashed" style={{ borderColor: '#D97706', backgroundColor: '#FFFBEB' }}>
                                            <p className="text-xs font-semibold text-amber-800 mb-1.5 flex items-center gap-1"><Icon name="Wand2" size={12} /> Gerar parcelas automaticamente</p>
                                            <div className="grid grid-cols-3 gap-2">
                                                <Field label="Qtde parcelas"><input type="number" min="1" value={gerador.quantidade} onChange={e => setGerador(g => ({ ...g, quantidade: e.target.value }))} className={inputCls} style={inputStyle} /></Field>
                                                <Field label="Prazo (dias úteis)"><input type="number" min="0" value={gerador.prazoDiasUteis} onChange={e => setGerador(g => ({ ...g, prazoDiasUteis: e.target.value }))} className={inputCls} style={inputStyle} placeholder="Ex: 30" /></Field>
                                                <Field label="Intervalo (dias)"><input type="number" min="1" value={gerador.intervaloDias} onChange={e => setGerador(g => ({ ...g, intervaloDias: e.target.value }))} className={inputCls} style={inputStyle} /></Field>
                                            </div>
                                            <button type="button" onClick={() => gerarAutomatico('cartao')} className="mt-1.5 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-600 text-white hover:bg-amber-700"><Icon name="Wand2" size={12} /> Gerar parcelas automaticamente</button>
                                        </div>
                                        <p className="text-xs font-medium text-amber-700 pt-1">ou adicione manualmente:</p>
                                        <div className="grid grid-cols-3 gap-2 mt-2">
                                            <Field label="Vencimento"><input type="date" value={novaParcela.vencimento} onChange={e => setNovaParcela(p => ({ ...p, vencimento: e.target.value }))} className={inputCls} style={inputStyle} /></Field>
                                            <Field label="Valor (R$)"><input type="number" step="0.01" value={novaParcela.valor} onChange={e => setNovaParcela(p => ({ ...p, valor: e.target.value }))} className={inputCls} style={inputStyle} placeholder="0,00" /></Field>
                                            <Field label="Cartão"><input value={novaParcela.cartao} onChange={e => setNovaParcela(p => ({ ...p, cartao: e.target.value }))} className={inputCls} style={inputStyle} placeholder="Ex: Nubank" /></Field>
                                        </div>
                                        <button type="button" onClick={addParcela} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-amber-300 text-amber-700 hover:bg-amber-50"><Icon name="Plus" size={12} /> Adicionar parcela</button>
                                    </div>
                                )}

                                {/* Cheque */}
                                {form.tipo_pagamento === 'cheque' && (
                                    <div className="space-y-2">
                                        <p className="text-xs font-medium text-amber-800">Cheques</p>
                                        {(form.cheques || []).map((ch, idx) => (
                                            <div key={idx} className="flex items-center gap-2 p-2 rounded-lg bg-white border text-xs" style={{ borderColor: '#FED7AA' }}>
                                                <span className="font-medium text-amber-800">#{ch.numero}</span>
                                                {ch.banco && <span className="text-amber-700">{ch.banco}</span>}
                                                <span className="font-data font-semibold">{BRL(ch.valor)}</span>
                                                {ch.vencimento && <span className="text-gray-500">{FMT(ch.vencimento)}</span>}
                                                <button type="button" onClick={() => setForm(f => ({ ...f, cheques: f.cheques.filter((_, i) => i !== idx) }))} className="ml-auto p-1 rounded hover:bg-red-50"><Icon name="X" size={11} color="#DC2626" /></button>
                                            </div>
                                        ))}
                                        <div className="grid grid-cols-2 gap-2 mt-2">
                                            <Field label="Nº Cheque"><input value={novoCheque.numero} onChange={e => setNovoCheque(c => ({ ...c, numero: e.target.value }))} className={inputCls} style={inputStyle} placeholder="000123" /></Field>
                                            <Field label="Banco"><input value={novoCheque.banco} onChange={e => setNovoCheque(c => ({ ...c, banco: e.target.value }))} className={inputCls} style={inputStyle} placeholder="Bradesco" /></Field>
                                            <Field label="Valor (R$)"><input type="number" step="0.01" value={novoCheque.valor} onChange={e => setNovoCheque(c => ({ ...c, valor: e.target.value }))} className={inputCls} style={inputStyle} placeholder="0,00" /></Field>
                                            <Field label="Vencimento"><input type="date" value={novoCheque.vencimento} onChange={e => setNovoCheque(c => ({ ...c, vencimento: e.target.value }))} className={inputCls} style={inputStyle} /></Field>
                                        </div>
                                        <button type="button" onClick={addCheque} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-amber-300 text-amber-700 hover:bg-amber-50"><Icon name="Plus" size={12} /> Adicionar cheque</button>
                                    </div>
                                )}

                                {/* Permuta */}
                                {form.tipo_pagamento === 'permuta' && (
                                    <div className="space-y-2">
                                        <Field label="Observações da permuta">
                                            <textarea value={form.permuta_obs} onChange={e => set('permuta_obs', e.target.value)} className={inputCls} style={inputStyle} rows={3} placeholder="Descreva os termos da permuta..." />
                                        </Field>
                                        <div className="flex items-center gap-2">
                                            <button type="button" onClick={() => permutaRef.current?.click()} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium hover:bg-amber-50" style={{ borderColor: '#FED7AA' }}>
                                                <Icon name="Paperclip" size={13} /> Anexar documento
                                            </button>
                                            {form.permuta_doc_url && <span className="text-xs text-amber-700 flex items-center gap-1"><Icon name="CheckCircle2" size={12} /> Anexado</span>}
                                            <input ref={permutaRef} type="file" accept="image/*,.pdf" onChange={e => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = ev => set('permuta_doc_url', ev.target.result); r.readAsDataURL(f); }} className="hidden" />
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* ── Observações ────────────────────────────────────────── */}
                    <Field label="Observações">
                        <textarea value={form.observacoes} onChange={e => set('observacoes', e.target.value)} className={inputCls} style={inputStyle} rows={2} placeholder="Observações adicionais..." />
                    </Field>
                </div>

                <div className="flex gap-3 p-5 justify-end border-t shrink-0" style={{ borderColor: 'var(--color-border)' }}>
                    <button onClick={onClose} className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50" style={{ borderColor: 'var(--color-border)' }}>Cancelar</button>
                    <Button onClick={() => handleSave()} size="sm" iconName={saving ? 'Loader' : 'Check'} disabled={saving}>
                        {saving ? 'Salvando...' : (isEdit ? 'Atualizar' : 'Salvar Despesa')}
                    </Button>
                </div>
                <Toast toast={toast} />
            </ModalOverlay>

            {showFornecedores && (
                <ModalFornecedores
                    onClose={() => setShowFornecedores(false)}
                    onSelect={f => { set('fornecedor', f.nome); if (f.categoria) set('categoria', f.categoria); }}
                />
            )}
            {ConfirmDialog}
        </>
    );
}

// ─── PÁGINA PRINCIPAL ─────────────────────────────────────────────────────────
export default function DespesasCaminhoes() {
    const { isAdmin } = useAuth();
    const { toast, showToast } = useToast();
    const { confirm, ConfirmDialog } = useConfirm();
    const admin = isAdmin();

    const [despesas, setDespesas]     = useState([]);
    const [veiculos, setVeiculos]     = useState([]);
    const [loading, setLoading]       = useState(true);
    const [modal, setModal]           = useState(null);
    const [modalBaixa, setModalBaixa] = useState(null);
    const [viewDespesa, setViewDespesa] = useState(null);
    const [filtro, setFiltro]         = useState({ vehicleId: '', categoria: '', formaPgto: '' });
    const { preset: periodoPreset, periodo, onPresetChange: aplicarPreset, setPeriodo } = usePeriodRangeFilter('todos');
    const [busca, setBusca] = useState('');
    const despesasFiltradas = useMemo(() => {
        if (!busca.trim()) return despesas;
        const q = busca.trim().toLowerCase();
        return despesas.filter(d =>
            (d.categoria || '').toLowerCase().includes(q) ||
            (d.descricao || '').toLowerCase().includes(q) ||
            (d.fornecedor || '').toLowerCase().includes(q) ||
            (d.veiculo?.placa || '').toLowerCase().includes(q) ||
            (d.nota_fiscal || '').toLowerCase().includes(q) ||
            (d.boletos || []).some(b => (b.numero_boleto || '').toLowerCase().includes(q)) ||
            (d.parcelas_cartao || []).some(p => (p.cartao || '').toLowerCase().includes(q))
        );
    }, [despesas, busca]);
    const [categoriasExtras]          = useState(() => {
        try {
            const v2 = localStorage.getItem('caminhoes_categorias_v2');
            if (v2) return JSON.parse(v2);
            return [...CATEGORIAS_DESPESA_CAMINHOES, ...JSON.parse(localStorage.getItem('caminhoes_categorias_extras') || '[]')];
        } catch { return [...CATEGORIAS_DESPESA_CAMINHOES]; }
    });

    const todasCategorias = categoriasExtras;
    const [guiaDespesas, setGuiaDespesas] = useState('registros');
    const [relatorioPeriodo, setRelatorioPeriodo] = useState(() => {
        const h = new Date();
        return { inicio: `${h.getFullYear()}-${String(h.getMonth()+1).padStart(2,'0')}-01`, fim: `${h.getFullYear()}-${String(h.getMonth()+1).padStart(2,'0')}-${String(new Date(h.getFullYear(),h.getMonth()+1,0).getDate()).padStart(2,'0')}` };
    });
    const parcelasFuturas = useMemo(() => {
        const hoje = new Date(); hoje.setHours(0,0,0,0);
        const porMes = {};
        const add = (d, tipo, valor, venc, cartao, numeroBoleto) => {
            if (!venc) return; const dt = new Date(venc+'T00:00:00'); if (dt < hoje) return;
            const k = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}`;
            if (!porMes[k]) porMes[k] = { total: 0, itens: [] };
            porMes[k].total += Number(valor)||0;
            porMes[k].itens.push({ despesa: d, tipo, valor: Number(valor)||0, vencimento: venc, cartao, numeroBoleto });
        };
        despesasFiltradas.forEach(d => {
            (d.boletos||[]).forEach(b => { if (!b.pago) add(d,'Boleto',b.valor,b.vencimento,null,b.numero_boleto); });
            (d.parcelas_cartao||[]).forEach(p => { if (!p.pago) add(d,'Cartão',p.valor,p.vencimento,p.cartao); });
            (d.cheques||[]).forEach(c => { if (!c.pago) add(d,'Cheque',c.valor,c.vencimento); });
        });
        return Object.entries(porMes).sort(([a],[b]) => a.localeCompare(b)).map(([mes,dados]) => ({ mes, ...dados, itens: dados.itens.sort((a,b) => a.vencimento.localeCompare(b.vencimento)) }));
    }, [despesasFiltradas]);
    const relatorioStatus = useMemo(() => {
        const { inicio, fim } = relatorioPeriodo; if (!inicio||!fim) return null;
        const pagos=[],abertos=[];
        despesasFiltradas.forEach(d => {
            if (d.forma_pagamento==='a_prazo') {
                (d.boletos||[]).forEach(b => { const v=b.vencimento||d.data_despesa; if(v<inicio||v>fim) return; const it={despesa:d,tipo:'Boleto',valor:Number(b.valor)||0,vencimento:v,pago:b.pago,numeroBoleto:b.numero_boleto}; b.pago?pagos.push(it):abertos.push(it); });
                (d.parcelas_cartao||[]).forEach(p => { const v=p.vencimento||d.data_despesa; if(v<inicio||v>fim) return; const it={despesa:d,tipo:'Cartão',valor:Number(p.valor)||0,vencimento:v,pago:p.pago,cartao:p.cartao}; p.pago?pagos.push(it):abertos.push(it); });
            } else if (d.data_despesa>=inicio&&d.data_despesa<=fim) { pagos.push({despesa:d,tipo:d.tipo_pagamento||'À vista',valor:Number(d.valor)||0,vencimento:d.data_despesa,pago:true}); }
        });
        return { pagos:pagos.sort((a,b)=>a.vencimento.localeCompare(b.vencimento)), abertos:abertos.sort((a,b)=>a.vencimento.localeCompare(b.vencimento)), totalPago:pagos.reduce((s,i)=>s+i.valor,0), totalAberto:abertos.reduce((s,i)=>s+i.valor,0) };
    }, [despesasFiltradas, relatorioPeriodo]);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const f = {};
            if (filtro.vehicleId) f.vehicleId = filtro.vehicleId;
            if (filtro.categoria) f.categoria = filtro.categoria;
            if (filtro.formaPgto) f.formaPgto = filtro.formaPgto;
            if (periodo.inicio) f.dataInicio = periodo.inicio;
            if (periodo.fim)    f.dataFim    = periodo.fim;
            const [d, v] = await Promise.all([fetchDespesasCaminhoes(f), fetchVehicles()]);
            setDespesas(d); setVeiculos(v);
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
        finally { setLoading(false); }
    }, [filtro, periodo]); // eslint-disable-line
    useEffect(() => { load(); }, [load]);

    const handleDelete = async (id) => {
        const ok = await confirm({ title: 'Excluir despesa?', message: 'Esta ação não pode ser desfeita.', confirmLabel: 'Excluir', variant: 'danger' });
        if (!ok) return;
        try { await deleteDespesaCaminhao(id); showToast('Despesa excluída!', 'warning'); load(); }
        catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };

    const totalPeriodo = useMemo(() => despesas.reduce((s, d) => s + Number(d.valor || 0), 0), [despesas]);
    const totalPorCategoria = useMemo(() => {
        const acc = {};
        despesas.forEach(d => { acc[d.categoria] = (acc[d.categoria] || 0) + Number(d.valor || 0); });
        return Object.entries(acc).sort((a, b) => b[1] - a[1]);
    }, [despesas]);

    const boletosVencendo = useMemo(() => {
        const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
        const em7 = new Date(hoje); em7.setDate(em7.getDate() + 7);
        const alertas = [];
        despesas.forEach(d => {
            (d.boletos || []).forEach((b, idx) => {
                if (!b.pago && b.vencimento) {
                    const venc = new Date(b.vencimento + 'T00:00:00');
                    if (venc <= em7) alertas.push({ despesa: d, boletoIdx: idx, boleto: b, venc, atrasado: venc < hoje });
                }
            });
            (d.parcelas_cartao || []).forEach((p, idx) => {
                if (!p.pago && p.vencimento) {
                    const venc = new Date(p.vencimento + 'T00:00:00');
                    if (venc <= em7) alertas.push({ despesa: d, parcelaIdx: idx, parcela: p, venc, atrasado: venc < hoje });
                }
            });
        });
        return alertas;
    }, [despesas]);

    const exportar = () => {
        if (!despesas.length) { showToast('Nenhuma despesa no período', 'error'); return; }
        const rows = despesas.map(d => ({
            'Data': FMT(d.data_despesa), 'Placa': d.veiculo?.placa || '—',
            'Categoria': d.categoria, 'Empresa': d.empresa || '',
            'Fornecedor': d.fornecedor || '', 'Descrição': d.descricao || '',
            'NF': d.nota_fiscal || '', 'Forma Pgto': d.forma_pagamento === 'a_vista' ? 'À Vista' : 'A Prazo',
            'Tipo': d.tipo_pagamento || '', 'Valor (R$)': Number(d.valor || 0),
            'Observações': d.observacoes || '',
        }));
        rows.push({ 'Data': 'TOTAL', 'Valor (R$)': totalPeriodo });
        const ws = XLSX.utils.json_to_sheet(rows);
        ws['!cols'] = [12, 12, 22, 22, 28, 28, 12, 12, 14, 14, 30].map(w => ({ wch: w }));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Despesas');
        XLSX.writeFile(wb, `despesas_caminhoes_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.xlsx`);
        showToast('Exportado!', 'success');
    };

    return (
        <div className="min-h-screen" style={{ backgroundColor: 'var(--color-background)' }}>
            <NavigationBar />
            <main className="main-content">
                <div className="max-w-screen-2xl mx-auto px-4 lg:px-8 py-6">
                    <BreadcrumbTrail className="mb-4" />

                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                        <div>
                            <h1 className="font-heading font-bold text-2xl md:text-3xl flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
                                <Icon name="Receipt" size={28} color="var(--color-primary)" /> Despesas — Caminhões
                            </h1>
                            <p className="text-sm mt-1" style={{ color: 'var(--color-muted-foreground)' }}>
                                Controle financeiro de despesas da frota de caminhões
                            </p>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                            <button onClick={exportar} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium hover:bg-gray-50 transition-colors" style={{ borderColor: 'var(--color-border)' }}>
                                <Icon name="FileDown" size={14} /> Exportar Excel
                            </button>
                            {admin && (
                                <Button onClick={() => setModal({ mode: 'create' })} iconName="Plus">Nova Despesa</Button>
                            )}
                        </div>
                    </div>

                    {/* Alertas de boletos vencendo */}
                    {boletosVencendo.length > 0 && (
                        <div className="mb-5 p-4 rounded-2xl border flex items-start gap-3"
                            style={{ backgroundColor: '#FFF7ED', borderColor: '#FED7AA' }}>
                            <Icon name="AlertTriangle" size={20} color="#D97706" />
                            <div className="flex-1">
                                <p className="text-sm font-semibold text-amber-800 mb-1">
                                    ⚠️ {boletosVencendo.length} pagamento{boletosVencendo.length > 1 ? 's' : ''} vencendo nos próximos 7 dias
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {boletosVencendo.map((alerta, i) => (
                                        <button key={i} onClick={() => setModalBaixa(alerta.despesa)}
                                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors"
                                            style={{ backgroundColor: alerta.atrasado ? '#FEE2E2' : '#FEF3C7', color: alerta.atrasado ? '#B91C1C' : '#92400E', border: `1px solid ${alerta.atrasado ? '#FECACA' : '#FDE68A'}` }}>
                                            {alerta.atrasado ? '🔴' : '🟡'}
                                            {alerta.despesa.veiculo?.placa || 'Sem placa'} · {BRL(alerta.boleto?.valor || alerta.parcela?.valor)} · {FMT(alerta.boleto?.vencimento || alerta.parcela?.vencimento)}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Filtros */}
                    <div className="flex flex-wrap gap-2 items-center mb-5">
                        <select value={filtro.vehicleId} onChange={e => setFiltro(f => ({ ...f, vehicleId: e.target.value }))} className="px-3 py-2 rounded-lg border text-sm" style={inputStyle}>
                            <option value="">Todos veículos</option>
                            {veiculos.map(v => <option key={v.id} value={v.id}>{v.placa}</option>)}
                        </select>
                        <select value={filtro.categoria} onChange={e => setFiltro(f => ({ ...f, categoria: e.target.value }))} className="px-3 py-2 rounded-lg border text-sm" style={inputStyle}>
                            <option value="">Todas categorias</option>
                            {todasCategorias.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <select value={filtro.formaPgto} onChange={e => setFiltro(f => ({ ...f, formaPgto: e.target.value }))} className="px-3 py-2 rounded-lg border text-sm" style={inputStyle}>
                            <option value="">Todas as formas</option>
                            <option value="a_vista">À Vista</option>
                            <option value="a_prazo">A Prazo</option>
                        </select>
                        <PeriodRangeFilter preset={periodoPreset} onPresetChange={aplicarPreset} periodo={periodo} onPeriodoChange={setPeriodo} />
                        <div className="relative flex-1 min-w-[220px] max-w-[320px]">
                            <Icon name="Search" size={14} color="var(--color-muted-foreground)" className="absolute left-3 top-1/2 -translate-y-1/2" />
                            <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="NF, nº boleto, fornecedor, placa..."
                                className="w-full pl-9 pr-3 py-2 rounded-lg border text-sm" style={inputStyle} />
                        </div>
                        <button onClick={load} className="p-2 rounded-lg border hover:bg-gray-50" style={{ borderColor: 'var(--color-border)' }} title="Atualizar">
                            <Icon name="RefreshCw" size={14} color="var(--color-muted-foreground)" />
                        </button>
                        {(filtro.vehicleId || filtro.categoria || periodoPreset !== 'todos' || filtro.formaPgto || busca) && (
                            <button onClick={() => { setFiltro({ vehicleId: '', categoria: '', formaPgto: '' }); aplicarPreset('todos'); setBusca(''); }}
                                className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 border border-red-200">
                                <Icon name="X" size={12} /> Limpar filtros
                            </button>
                        )}
                    </div>

                    {/* KPIs */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                        <div className="bg-white rounded-2xl border p-4 shadow-sm sm:col-span-2" style={{ borderColor: 'var(--color-border)' }}>
                            <p className="text-xs mb-1" style={{ color: 'var(--color-muted-foreground)' }}>Total no Período</p>
                            <p className="text-2xl font-bold font-data text-red-600">{BRL(totalPeriodo)}</p>
                            <p className="text-xs mt-1" style={{ color: 'var(--color-muted-foreground)' }}>{despesas.length} lançamento{despesas.length !== 1 ? 's' : ''}</p>
                        </div>
                        {totalPorCategoria.slice(0, 2).map(([cat, val]) => (
                            <div key={cat} className="bg-white rounded-2xl border p-4 shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
                                <p className="text-xs mb-1 truncate" style={{ color: 'var(--color-muted-foreground)' }}>{cat}</p>
                                <p className="text-lg font-bold font-data text-orange-600">{BRL(val)}</p>
                                <p className="text-xs mt-1" style={{ color: 'var(--color-muted-foreground)' }}>
                                    {totalPeriodo > 0 ? ((val / totalPeriodo) * 100).toFixed(1) : 0}% do total
                                </p>
                            </div>
                        ))}
                    </div>

                    {/* Gráfico de categorias */}
                    {totalPorCategoria.length > 0 && (
                        <div className="bg-white rounded-2xl border p-4 shadow-sm mb-5" style={{ borderColor: 'var(--color-border)' }}>
                            <p className="text-xs font-semibold mb-3" style={{ color: 'var(--color-text-secondary)' }}>Distribuição por categoria</p>
                            <div className="space-y-2">
                                {totalPorCategoria.map(([cat, val]) => {
                                    const pct = totalPeriodo > 0 ? (val / totalPeriodo) * 100 : 0;
                                    return (
                                        <div key={cat}>
                                            <div className="flex justify-between text-xs mb-1">
                                                <span style={{ color: 'var(--color-text-primary)' }}>{cat}</span>
                                                <span className="font-data font-medium">{BRL(val)} <span style={{ color: 'var(--color-muted-foreground)' }}>({pct.toFixed(1)}%)</span></span>
                                            </div>
                                            <div className="w-full h-1.5 rounded-full bg-gray-100 overflow-hidden">
                                                <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: '#F97316' }} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Sub-guias */}
                    <div className="flex gap-1 mb-5 p-1 rounded-xl border" style={{ borderColor: 'var(--color-border)', backgroundColor: '#F9FAFB', width: 'fit-content' }}>
                        {[{ id: 'registros', label: 'Registros', icon: 'Receipt' }, { id: 'parcelas', label: 'Parcelas Futuras', icon: 'Clock' }, { id: 'relatorio', label: 'Pago / Em Aberto', icon: 'BarChart2' }, { id: 'boletos', label: 'Boletos', icon: 'CalendarClock' }].map(g => (
                            <button key={g.id} onClick={() => setGuiaDespesas(g.id)}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
                                style={guiaDespesas === g.id ? { backgroundColor: 'white', color: '#F97316', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', fontWeight: 600 } : { color: 'var(--color-muted-foreground)' }}>
                                <Icon name={g.icon} size={14} color={guiaDespesas === g.id ? '#F97316' : 'var(--color-muted-foreground)'} />{g.label}
                            </button>
                        ))}
                    </div>

                    {/* Tabela */}
                    {guiaDespesas === 'registros' && (loading ? (
                        <div className="flex justify-center py-16">
                            <div className="animate-spin h-7 w-7 rounded-full border-4" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
                        </div>
                    ) : despesasFiltradas.length === 0 ? (
                        <div className="bg-white rounded-2xl border p-16 flex flex-col items-center justify-center gap-3" style={{ borderColor: 'var(--color-border)' }}>
                            <Icon name="Receipt" size={40} color="var(--color-muted-foreground)" />
                            <p className="text-base font-medium" style={{ color: 'var(--color-muted-foreground)' }}>{busca ? `Nenhum resultado para "${busca}"` : 'Nenhuma despesa registrada'}</p>
                            {admin && !busca && (
                                <button onClick={() => setModal({ mode: 'create' })}
                                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white"
                                    style={{ backgroundColor: 'var(--color-primary)' }}>
                                    <Icon name="Plus" size={14} color="white" /> Registrar primeira despesa
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="bg-white rounded-2xl border shadow-sm overflow-x-auto" style={{ borderColor: 'var(--color-border)' }}>
                            <table className="w-full text-sm min-w-[800px]">
                                <thead className="text-xs border-b" style={{ backgroundColor: 'var(--color-muted)', borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                                    <tr>{['Data', 'Placa', 'Categoria', 'Empresa / Fornecedor', 'Descrição', 'NF', 'Pagamento', 'Valor', ''].map(h => (
                                        <th key={h} className="px-3 py-3 text-left font-medium whitespace-nowrap">{h}</th>
                                    ))}</tr>
                                </thead>
                                <tbody>
                                    {despesasFiltradas.map((d, i) => (
                                        <tr key={d.id} className="border-t hover:bg-gray-50 transition-colors" style={{ borderColor: 'var(--color-border)', backgroundColor: i % 2 === 0 ? '#fff' : '#F8FAFC' }}>
                                            <td className="px-3 py-3 whitespace-nowrap text-xs" style={{ color: 'var(--color-muted-foreground)' }}>{FMT(d.data_despesa)}</td>
                                            <td className="px-3 py-3 font-data font-medium text-xs" style={{ color: 'var(--color-primary)' }}>{d.veiculo?.placa || '—'}</td>
                                            <td className="px-3 py-3">
                                                <span className="px-2 py-0.5 rounded-full text-xs bg-orange-100 text-orange-700 font-medium whitespace-nowrap">{d.categoria}</span>
                                            </td>
                                            <td className="px-3 py-3 text-xs max-w-[140px]">
                                                {d.empresa && <p className="font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>{d.empresa}</p>}
                                                {d.fornecedor && <p className="truncate" style={{ color: 'var(--color-muted-foreground)' }}>{d.fornecedor}</p>}
                                                {!d.empresa && !d.fornecedor && <span style={{ color: 'var(--color-muted-foreground)' }}>—</span>}
                                            </td>
                                            <td className="px-3 py-3 text-xs max-w-[150px] truncate" style={{ color: 'var(--color-muted-foreground)' }}>{d.descricao || '—'}</td>
                                            <td className="px-3 py-3 text-xs font-data" style={{ color: 'var(--color-muted-foreground)' }}>{d.nota_fiscal || '—'}</td>
                                            <td className="px-3 py-3">
                                                <div className="flex flex-col gap-0.5">
                                                    <PgBadge d={d} />
                                                    <BoletosPendentes despesa={d} />
                                                </div>
                                            </td>
                                            <td className="px-3 py-3 font-data font-bold text-red-600 whitespace-nowrap">{BRL(d.valor)}</td>
                                            <td className="px-3 py-3">
                                                <div className="flex items-center gap-1">
                                                    <button onClick={() => setViewDespesa(d)} title="Visualizar despesa"
                                                        className="p-1.5 rounded hover:bg-indigo-50 transition-colors">
                                                        <Icon name="Eye" size={13} color="#4F46E5" />
                                                    </button>
                                                    {((d.boletos || []).some(b => !b.pago) || (d.parcelas_cartao || []).some(p => !p.pago)) && (
                                                        <button onClick={() => setModalBaixa(d)} title="Dar baixa em pagamentos"
                                                            className="p-1.5 rounded hover:bg-green-50 transition-colors">
                                                            <Icon name="CheckCircle2" size={13} color="#059669" />
                                                        </button>
                                                    )}
                                                    {admin && (
                                                        <>
                                                            <button onClick={() => setModal({ mode: 'edit', data: d })} className="p-1.5 rounded hover:bg-blue-50 transition-colors">
                                                                <Icon name="Pencil" size={13} color="#1D4ED8" />
                                                            </button>
                                                            <button onClick={() => handleDelete(d.id)} className="p-1.5 rounded hover:bg-red-50 transition-colors">
                                                                <Icon name="Trash2" size={13} color="#DC2626" />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="border-t-2" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-muted)' }}>
                                    <tr>
                                        <td colSpan={7} className="px-3 py-3 text-xs font-semibold text-right" style={{ color: 'var(--color-text-secondary)' }}>Total</td>
                                        <td className="px-3 py-3 font-data font-bold text-red-600 text-base">{BRL(totalPeriodo)}</td>
                                        <td />
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    ))}

                    {/* Parcelas Futuras */}
                    {guiaDespesas === 'parcelas' && (
                        <div className="space-y-4">
                            {parcelasFuturas.length === 0 ? (
                                <div className="flex flex-col items-center gap-2 py-16 text-center">
                                    <Icon name="CheckCircle2" size={32} color="#059669" />
                                    <p className="text-sm font-medium">Nenhuma parcela futura em aberto</p>
                                </div>
                            ) : parcelasFuturas.map(mes => (
                                <div key={mes.mes} className="rounded-xl border overflow-hidden" style={{ borderColor: '#FED7AA' }}>
                                    <div className="flex items-center justify-between px-4 py-3" style={{ backgroundColor: '#FFF7ED' }}>
                                        <p className="text-sm font-bold" style={{ color: '#9A3412' }}>{new Date(mes.mes+'-01T00:00:00').toLocaleDateString('pt-BR',{month:'long',year:'numeric'})}</p>
                                        <p className="text-sm font-bold font-data text-orange-600">{BRL(mes.total)}</p>
                                    </div>
                                    <table className="w-full text-xs table-fixed">
                                        <thead style={{ color: 'var(--color-muted-foreground)', backgroundColor: '#FFFBF5' }}>
                                            <tr>
                                                <th className="text-left px-4 py-2 w-[12%]">Vencimento</th>
                                                <th className="text-left px-4 py-2 w-[38%]">Despesa</th>
                                                <th className="text-left px-4 py-2 w-[16%]">Tipo</th>
                                                <th className="text-left px-4 py-2 w-[16%]">Veículo</th>
                                                <th className="text-right px-4 py-2 w-[18%]">Valor</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {mes.itens.map((it, idx) => (
                                                <tr key={idx} className="border-t" style={{ borderColor: '#FEF3C7' }}>
                                                    <td className="px-4 py-2 font-data whitespace-nowrap">{FMT(it.vencimento)}</td>
                                                    <td className="px-4 py-2 overflow-hidden">
                                                        <div className="flex items-center gap-1 min-w-0">
                                                            <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 font-medium">{it.despesa.categoria}</span>
                                                            <span className="truncate" title={it.despesa.fornecedor||it.despesa.descricao||'—'}>{it.despesa.fornecedor||it.despesa.descricao||'—'}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-2 truncate">
                                                        {it.tipo}{it.cartao?` (${it.cartao})`:''}
                                                        {it.numeroBoleto && <span className="text-orange-500 font-data"> · Nº {it.numeroBoleto}</span>}
                                                    </td>
                                                    <td className="px-4 py-2 font-data truncate">{it.despesa.veiculo?.placa||'—'}</td>
                                                    <td className="px-4 py-2 text-right font-data font-semibold text-orange-600">{BRL(it.valor)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot><tr className="border-t font-semibold" style={{ borderColor: '#FED7AA', backgroundColor: '#FFF7ED' }}><td colSpan={4} className="px-4 py-2 text-right" style={{ color: '#9A3412' }}>Total do mês:</td><td className="px-4 py-2 text-right font-data text-orange-600">{BRL(mes.total)}</td></tr></tfoot>
                                    </table>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Relatório Pago / Em Aberto */}
                    {guiaDespesas === 'relatorio' && (
                        <div className="space-y-5">
                            <div className="flex flex-wrap items-end gap-3 p-4 rounded-xl border" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-card)' }}>
                                <div><label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Início</label><input type="date" value={relatorioPeriodo.inicio} onChange={e => setRelatorioPeriodo(p => ({ ...p, inicio: e.target.value }))} className="px-3 py-2 rounded-lg border text-sm" /></div>
                                <div><label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Fim</label><input type="date" value={relatorioPeriodo.fim} onChange={e => setRelatorioPeriodo(p => ({ ...p, fim: e.target.value }))} className="px-3 py-2 rounded-lg border text-sm" /></div>
                            </div>
                            {relatorioStatus && (<>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="rounded-xl border p-4" style={{ borderColor: '#A7F3D0', backgroundColor: '#F0FDF4' }}><p className="text-xs font-medium text-green-700 mb-1">✅ Total Pago</p><p className="text-2xl font-bold font-data text-green-700">{BRL(relatorioStatus.totalPago)}</p><p className="text-xs text-green-600">{relatorioStatus.pagos.length} lançamento(s)</p></div>
                                    <div className="rounded-xl border p-4" style={{ borderColor: '#FCA5A5', backgroundColor: '#FFF1F2' }}><p className="text-xs font-medium text-red-700 mb-1">🔴 Total em Aberto</p><p className="text-2xl font-bold font-data text-red-700">{BRL(relatorioStatus.totalAberto)}</p><p className="text-xs text-red-600">{relatorioStatus.abertos.length} lançamento(s)</p></div>
                                </div>
                                {[{ lista: relatorioStatus.abertos, titulo: 'Em Aberto', cor: '#DC2626', bg: '#FFF1F2', border: '#FCA5A5' }, { lista: relatorioStatus.pagos, titulo: 'Pagos', cor: '#059669', bg: '#F0FDF4', border: '#A7F3D0' }].map(({ lista, titulo, cor, bg, border }) => lista.length > 0 && (
                                    <div key={titulo} className="rounded-xl border overflow-hidden" style={{ borderColor: border }}>
                                        <div className="px-4 py-3 font-bold text-sm" style={{ backgroundColor: bg, color: cor }}>{titulo} — {lista.length} lançamento(s)</div>
                                        <table className="w-full text-xs table-fixed">
                                            <thead style={{ color: 'var(--color-muted-foreground)' }}><tr>
                                                <th className="text-left px-4 py-2 w-[13%]">Data/Venc.</th>
                                                <th className="text-left px-4 py-2 w-[38%]">Despesa</th>
                                                <th className="text-left px-4 py-2 w-[17%]">Tipo</th>
                                                <th className="text-left px-4 py-2 w-[14%]">Veículo</th>
                                                <th className="text-right px-4 py-2 w-[18%]">Valor</th>
                                            </tr></thead>
                                            <tbody>
                                                {lista.map((it, idx) => (
                                                    <tr key={idx} className="border-t" style={{ borderColor: border }}>
                                                        <td className="px-4 py-2 font-data whitespace-nowrap">{FMT(it.vencimento)}</td>
                                                        <td className="px-4 py-2 overflow-hidden">
                                                            <div className="flex items-center gap-1 min-w-0">
                                                                <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style={{ backgroundColor: titulo==='Em Aberto'?'#FEE2E2':'#D1FAE5', color: cor }}>{it.despesa.categoria}</span>
                                                                <span className="truncate" title={it.despesa.fornecedor||it.despesa.descricao||'—'}>{it.despesa.fornecedor||it.despesa.descricao||'—'}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-2 truncate">
                                                            {it.tipo}{it.cartao?` (${it.cartao})`:''}
                                                            {it.numeroBoleto && <span className="font-data" style={{ color: cor }}> · Nº {it.numeroBoleto}</span>}
                                                        </td>
                                                        <td className="px-4 py-2 font-data truncate">{it.despesa.veiculo?.placa||'—'}</td>
                                                        <td className="px-4 py-2 text-right font-data font-semibold" style={{ color: cor }}>{BRL(it.valor)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                            <tfoot><tr className="border-t font-bold" style={{ borderColor: border, backgroundColor: bg }}><td colSpan={4} className="px-4 py-2 text-right" style={{ color: cor }}>Total {titulo}:</td><td className="px-4 py-2 text-right font-data" style={{ color: cor }}>{BRL(titulo==='Em Aberto'?relatorioStatus.totalAberto:relatorioStatus.totalPago)}</td></tr></tfoot>
                                        </table>
                                    </div>
                                ))}
                            </>)}
                        </div>
                    )}

                    {/* Boletos deste módulo */}
                    {guiaDespesas === 'boletos' && <BoletosPainel origem="caminhoes" onChanged={load} />}
                </div>
            </main>

            {/* Modals */}
            {modal && (
                <ModalDespesa
                    modal={modal}
                    veiculos={veiculos}
                    despesasExistentes={despesas}
                    onClose={() => setModal(null)}
                    onSaved={load}
                />
            )}
            {viewDespesa && (
                <ModalVisualizacaoDespesa
                    despesa={viewDespesa}
                    onClose={() => setViewDespesa(null)}
                    onAtualizado={load}
                    admin={admin}
                />
            )}
            {modalBaixa && (
                <ModalBaixa
                    despesa={modalBaixa}
                    onClose={() => setModalBaixa(null)}
                    onBaixado={() => { load(); setModalBaixa(null); }}
                    isAdmin={admin}
                />
            )}

            <Toast toast={toast} />
            {ConfirmDialog}
        </div>
    );
}
