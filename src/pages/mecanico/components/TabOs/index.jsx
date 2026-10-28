import React from 'react';

import { AppIcon as Icon, PeriodRangeFilter } from 'components';
import { printOrdemServico } from 'utils/excel';

import { getAnexoTipo, downloadAnexo } from '../../utils/helpers';

const FMT_DATE = d => d ? new Date(d).toLocaleDateString('pt-BR') : '—';

const STATUS_CFG = {
    'Pendente':           { bg: '#FEF9C3', text: '#B45309', icon: 'Clock' },
    'Em Andamento':       { bg: '#DBEAFE', text: '#1D4ED8', icon: 'Wrench' },
    'Finalizada':         { bg: '#D1FAE5', text: '#065F46', icon: 'CheckCircle2' },
    'Problema Reportado': { bg: '#FEE2E2', text: '#B91C1C', icon: 'AlertTriangle' },
};

// ─── pageTab === 'os' ───
export default function TabOs({ andamento, filtro, periodoPreset, periodo, setPeriodo, setPeriodoPreset, loading, ordens, pendentes, problemas, setAssinarFinalizacao, setDescProblema, setFiltro, setModalFinalizar, setModalPeca, setModalProblema, setObsFinalizar, setPdfUrl, setPecaItem, setPecaItemOutro, setPecaQtd, setPecasParaSolicitar }) {
    return (
        <>
                    {/* KPIs */}
                    <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4 sm:mb-5">
                        {[
                            { l: 'Pendentes', v: pendentes, c: '#B45309', bg: '#FEF9C3', i: 'Clock' },
                            { l: 'Andamento', v: andamento, c: '#1D4ED8', bg: '#DBEAFE', i: 'Wrench' },
                            { l: 'Problemas', v: problemas, c: '#DC2626', bg: '#FEE2E2', i: 'AlertTriangle' },
                        ].map(k => (
                            <div key={k.l} className="bg-white rounded-xl border p-2.5 sm:p-3 shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
                                <div className="flex items-center gap-1 sm:gap-1.5 mb-1">
                                    <div className="rounded-lg flex items-center justify-center flex-shrink-0" style={{ width: 22, height: 22, backgroundColor: k.bg }}>
                                        <Icon name={k.i} size={11} color={k.c} />
                                    </div>
                                    <span className="text-xs truncate" style={{ color: 'var(--color-muted-foreground)' }}>{k.l}</span>
                                </div>
                                <p className="text-xl font-bold font-data" style={{ color: k.c }}>{k.v}</p>
                            </div>
                        ))}
                    </div>

                    {/* Período — padrão: mês atual */}
                    <div className="mb-3 overflow-x-auto pb-1 -mx-3 px-3 sm:mx-0 sm:px-0">
                        <PeriodRangeFilter preset={periodoPreset} onPresetChange={setPeriodoPreset}
                            periodo={periodo} onPeriodoChange={setPeriodo}
                            presets={['mes', 'mes_passado', 'todos', 'personalizado']} />
                    </div>

                    {/* Filtros scroll horizontal */}
                    <div className="flex gap-2 mb-4 sm:mb-5 overflow-x-auto pb-1 scrollbar-none -mx-3 px-3 sm:mx-0 sm:px-0">
                        {['', 'Pendente', 'Em Andamento', 'Problema Reportado', 'Finalizada'].map(s => (
                            <button key={s} onClick={() => setFiltro(s)}
                                className="px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all border flex-shrink-0"
                                style={filtro === s
                                    ? { backgroundColor: 'var(--color-primary)', color: '#fff', borderColor: 'var(--color-primary)' }
                                    : { backgroundColor: 'white', color: 'var(--color-muted-foreground)', borderColor: 'var(--color-border)' }}>
                                {s || 'Todas'}
                            </button>
                        ))}
                    </div>

                    {/* Lista */}
                    {loading ? (
                        <div className="flex justify-center py-16">
                            <div className="animate-spin h-7 w-7 rounded-full border-4" style={{ borderColor: '#059669', borderTopColor: 'transparent' }} />
                        </div>
                    ) : ordens.length === 0 ? (
                        <div className="bg-white rounded-xl border p-8 flex flex-col items-center justify-center gap-2" style={{ borderColor: 'var(--color-border)' }}>
                            <Icon name="Wrench" size={32} color="var(--color-muted-foreground)" />
                            <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
                                Nenhuma ordem{filtro ? ` com status "${filtro}"` : ' de serviço encontrada'}
                            </p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3">
                            {ordens.map(o => {
                                const cfg = STATUS_CFG[o.status] || STATUS_CFG['Pendente'];
                                return (
                                    <div key={o.id} className="bg-white rounded-xl border shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
                                        <div className="p-3 sm:p-4">

                                            {/* Header da OS */}
                                            <div className="flex items-start justify-between gap-2 mb-3">
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex flex-wrap items-center gap-1.5 mb-1">
                                                        <span className="font-bold font-data text-sm" style={{ color: 'var(--color-text-primary)' }}>
                                                            OS #{o.id?.slice(0, 8).toUpperCase()}
                                                        </span>
                                                        <span className="px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1"
                                                            style={{ backgroundColor: cfg.bg, color: cfg.text }}>
                                                            <Icon name={cfg.icon} size={10} />
                                                            {o.status}
                                                        </span>
                                                        {o.prioridade === 'Urgente' && (
                                                            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-600 text-white">URGENTE</span>
                                                        )}
                                                        {o.tipo_manutencao && (
                                                            <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: o.tipo_manutencao === 'Preventiva' ? '#DBEAFE' : '#FEF3C7', color: o.tipo_manutencao === 'Preventiva' ? '#1D4ED8' : '#92400E' }}>
                                                                {o.tipo_manutencao}
                                                            </span>
                                                        )}
                                                        {o.assinatura_mecanico && (
                                                            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700" title={`Assinado por ${o.assinatura_mecanico}`}>
                                                                <Icon name="PenTool" size={10} />Assinado
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                                                        {FMT_DATE(o.created_at)}
                                                        {(o.veiculo?.placa || o.veiculo_caminhao_placa) && <> · <span className="font-data font-medium">{o.veiculo?.placa || o.veiculo_caminhao_placa}</span></>}
                                                        {(o.veiculo?.modelo || o.veiculo_caminhao_modelo) && <span className="hidden sm:inline"> — {o.veiculo?.modelo || o.veiculo_caminhao_modelo}</span>}
                                                        {o.km_atual != null && <> · KM: <span className="font-data font-medium">{Number(o.km_atual).toLocaleString('pt-BR')}</span></>}
                                                    </p>
                                                </div>
                                                <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                                                    <button onClick={() => printOrdemServico(o)}
                                                        className="flex items-center gap-1 text-xs text-gray-500 font-medium hover:underline">
                                                        <Icon name="Printer" size={14} color="var(--color-muted-foreground)" />
                                                        <span className="hidden sm:inline">Imprimir</span>
                                                    </button>
                                                    {o.pdf_url && (() => {
                                                    const tipoAnexo = getAnexoTipo(o.pdf_url);
                                                    if (tipoAnexo === 'word') {
                                                        return (
                                                            <button onClick={() => downloadAnexo(o.pdf_url, `OS_${o.id?.slice(0,8)}.docx`)}
                                                                className="flex-shrink-0 flex items-center gap-1 text-xs text-blue-600 font-medium hover:underline"
                                                                style={{ paddingTop: 2 }}>
                                                                <Icon name="FileText" size={14} color="#1D4ED8" />
                                                                <span className="hidden sm:inline">Baixar anexo</span>
                                                                <span className="sm:hidden">Word</span>
                                                            </button>
                                                        );
                                                    }
                                                    return (
                                                        <button onClick={() => setPdfUrl(o.pdf_url)}
                                                            className="flex-shrink-0 flex items-center gap-1 text-xs text-blue-600 font-medium hover:underline"
                                                            style={{ paddingTop: 2 }}>
                                                            <Icon name={tipoAnexo === 'imagem' ? 'Image' : 'FileText'} size={14} color="#1D4ED8" />
                                                            <span className="hidden sm:inline">{tipoAnexo === 'imagem' ? 'Ver imagem' : 'Ver PDF'}</span>
                                                            <span className="sm:hidden">{tipoAnexo === 'imagem' ? 'Imagem' : 'PDF'}</span>
                                                        </button>
                                                    );
                                                })()}
                                                </div>
                                            </div>

                                            {/* Descrição */}
                                            <div className="p-3 rounded-lg mb-3" style={{ backgroundColor: '#F8FAFC' }}>
                                                <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Serviço solicitado:</p>
                                                <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-primary)' }}>{o.descricao || '—'}</p>
                                            </div>

                                            {o.observacoes && (
                                                <div className="p-3 rounded-lg mb-3" style={{ backgroundColor: '#F1F5F9' }}>
                                                    <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Observações do serviço:</p>
                                                    <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-primary)' }}>{o.observacoes}</p>
                                                </div>
                                            )}

                                            {(o.pecas_solicitadas || []).length > 0 && (
                                                <div className="p-3 rounded-lg mb-3 space-y-1.5" style={{ backgroundColor: '#FAF5FF', border: '1px solid #E9D5FF' }}>
                                                    <p className="text-xs font-medium flex items-center gap-1" style={{ color: '#6D28D9' }}>
                                                        <Icon name="Package" size={13} color="#6D28D9" />Peças solicitadas
                                                    </p>
                                                    {(o.pecas_solicitadas || []).map((p, idx) => {
                                                        const statusCor = p.status === 'Aprovado' ? { bg: '#D1FAE5', text: '#065F46' } : p.status === 'Reprovado' ? { bg: '#FEE2E2', text: '#991B1B' } : { bg: '#FEF9C3', text: '#B45309' };
                                                        return (
                                                            <div key={p.id || idx} className="flex items-center justify-between gap-2 text-xs px-2 py-1 rounded-lg bg-white">
                                                                <span style={{ color: 'var(--color-text-primary)' }}>{p.item} × {p.quantidade}</span>
                                                                <span className="px-2 py-0.5 rounded-full font-medium flex-shrink-0" style={{ backgroundColor: statusCor.bg, color: statusCor.text }}>{p.status || 'Pendente'}</span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}

                                            {o.problema_encontrado && (
                                                <div className="p-3 rounded-lg mb-3" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}>
                                                    <p className="text-xs font-medium text-red-600 mb-1">⚠️ Problema reportado:</p>
                                                    <p className="text-sm text-red-700 leading-relaxed">{o.problema_encontrado}</p>
                                                </div>
                                            )}

                                            {o.obs_finalizacao && (
                                                <div className="p-3 rounded-lg mb-3" style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                                                    <p className="text-xs font-medium text-green-600 mb-1">✅ Obs de finalização:</p>
                                                    <p className="text-sm text-green-700 leading-relaxed">{o.obs_finalizacao}</p>
                                                </div>
                                            )}

                                            {/* Ações — full width no mobile */}
                                            {(o.status === 'Pendente' || o.status === 'Em Andamento') && (
                                                <div className="flex flex-col sm:flex-row gap-2 pt-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
                                                    <button onClick={() => { setModalFinalizar(o); setObsFinalizar(''); setAssinarFinalizacao(true); }}
                                                        className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-semibold text-white w-full sm:w-auto"
                                                        style={{ backgroundColor: '#059669' }}>
                                                        <Icon name="CheckCircle2" size={14} color="#fff" />
                                                        Finalizar OS
                                                    </button>
                                                    <button onClick={() => { setModalPeca(o); setPecaItem(''); setPecaItemOutro(''); setPecaQtd('1'); setPecasParaSolicitar([]); }}
                                                        className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-semibold border w-full sm:w-auto"
                                                        style={{ borderColor: '#DDD6FE', color: '#6D28D9' }}>
                                                        <Icon name="Package" size={14} color="#6D28D9" />
                                                        Solicitar Peça
                                                    </button>
                                                    <button onClick={() => { setModalProblema(o); setDescProblema(''); }}
                                                        className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-semibold border w-full sm:w-auto"
                                                        style={{ borderColor: '#FECACA', color: '#DC2626' }}>
                                                        <Icon name="AlertTriangle" size={14} color="#DC2626" />
                                                        Reportar Problema
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    </>
    );
}
