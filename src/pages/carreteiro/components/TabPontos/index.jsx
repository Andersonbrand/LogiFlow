import React from 'react';

import { Button, AppIcon as Icon, ActionButtonsGroup, EditButton, DeleteButton } from 'components';
import { deletePontoParada } from 'services/carretas';

import { FMT_DATE } from '../../utils/helpers';

// ─── tab === 'pontos' ───
export default function TabPontos({ confirm, load, pontosParadaFiltrados, setEditandoPontoId, setFormPonto, setModalPonto, setPontoDetalhe, showToast }) {
    return (
        <div>
                                            <div className="flex justify-end mb-4">
                                                <Button onClick={() => {
                                                    setEditandoPontoId(null);
                                                    setFormPonto({
                                                        tipo_local: 'Fábrica', local: '', veiculo_id: '',
                                                        data_saida: new Date().toISOString().split('T')[0],
                                                        horario_saida: '', km_saida: '',
                                                        tipo_local_chegada: 'Fábrica', local_chegada: '',
                                                        data_chegada: '', horario_chegada: '', km_chegada: '',
                                                        cupom_fiscal: '', observacoes: '',
                                                        horarios_extras: [],
                                                    });
                                                    setModalPonto(true);
                                                }} iconName="Plus" size="sm">
                                                    Novo Registro
                                                </Button>
                                            </div>

                                            {pontosParadaFiltrados.length === 0 ? (
                                                <div className="bg-white rounded-xl border p-10 flex flex-col items-center justify-center gap-3"
                                                    style={{ borderColor: 'var(--color-border)' }}>
                                                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#EFF6FF' }}>
                                                        <Icon name="MapPin" size={28} color="#1D4ED8" />
                                                    </div>
                                                    <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>Nenhum ponto de parada registrado</p>
                                                    <p className="text-xs text-center" style={{ color: 'var(--color-muted-foreground)' }}>
                                                        Registre os horários de saída e chegada em fábricas, estoques e entregas.
                                                    </p>
                                                </div>
                                            ) : (
                                                <>
                                                {/* Mobile: resumo compacto — toque no card para ver todos os dados */}
                                                <div className="md:hidden rounded-xl border overflow-hidden shadow-sm bg-white" style={{ borderColor: 'var(--color-border)' }}>
                                                    {pontosParadaFiltrados.map((p, idx) => {
                                                        const rodado = p.km_saida != null && p.km_chegada != null ? Number(p.km_chegada) - Number(p.km_saida) : null;
                                                        return (
                                                            <button key={p.id} type="button" onClick={() => setPontoDetalhe(p)}
                                                                className="w-full text-left px-3 py-2.5 flex items-center gap-2 active:bg-blue-50"
                                                                style={{ borderTop: idx === 0 ? 'none' : '1px solid var(--color-border)' }}>
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>
                                                                        {p.local || '—'}{p.local_chegada ? ` → ${p.local_chegada}` : ''}
                                                                    </p>
                                                                    <p className="text-xs font-data truncate" style={{ color: 'var(--color-muted-foreground)' }}>
                                                                        {p.data_saida ? FMT_DATE(p.data_saida) : '—'}{p.horario_saida ? ` · ${String(p.horario_saida).slice(0, 5)}` : ''}
                                                                        {p.veiculo?.placa ? ` · ${p.veiculo.placa}` : ''}
                                                                    </p>
                                                                </div>
                                                                {rodado != null && rodado >= 0 && (
                                                                    <span className="text-xs font-data font-semibold flex-shrink-0 px-2 py-0.5 rounded-full" style={{ backgroundColor: '#EFF6FF', color: '#1D4ED8' }}>
                                                                        {rodado.toLocaleString('pt-BR')} km
                                                                    </span>
                                                                )}
                                                                <Icon name="ChevronRight" size={16} color="var(--color-muted-foreground)" />
                                                            </button>
                                                        );
                                                    })}
                                                    <div className="px-4 py-2 border-t text-xs" style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)', backgroundColor: '#F9FAFB' }}>
                                                        {pontosParadaFiltrados.length} registro{pontosParadaFiltrados.length !== 1 ? 's' : ''}
                                                    </div>
                                                </div>
                                                {/* Desktop/tablet: tabela estilo planilha */}
                                                <div className="hidden md:block rounded-xl border overflow-hidden shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
                                                    <div className="overflow-x-auto">
                                                        <table className="w-full text-xs" style={{ minWidth: 700 }}>
                                                            <thead>
                                                                <tr style={{ backgroundColor: '#1D4ED8' }}>
                                                                    {['Saída','Data Saída','Hor. Saída','KM Saída','Chegada','Data Chegada','Hor. Chegada','KM Chegada','Cupom','Obs.',''].map(h => (
                                                                        <th key={h} className="px-3 py-2.5 text-left font-semibold text-white whitespace-nowrap">{h}</th>
                                                                    ))}
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {pontosParadaFiltrados.map((p, idx) => {
                                                                    const TIPO_COLOR = {
                                                                        'Fábrica': '#EFF6FF', 'Empresa': '#FEF3C7', 'Estoque': '#FEF9C3',
                                                                        'Entrega': '#D1FAE5', 'Posto': '#EDE9FE',
                                                                        'Oficina': '#FEE2E2', 'Outro': '#F3F4F6',
                                                                    };
                                                                    const TIPO_TEXT = {
                                                                        'Fábrica': '#1D4ED8', 'Empresa': '#D97706', 'Estoque': '#B45309',
                                                                        'Entrega': '#065F46', 'Posto': '#7C3AED',
                                                                        'Oficina': '#B91C1C', 'Outro': '#6B7280',
                                                                    };
                                                                    return (
                                                                        <>
                                                                        <tr key={p.id}
                                                                            className="border-t transition-colors hover:bg-blue-50/30"
                                                                            style={{ borderColor: 'var(--color-border)', backgroundColor: idx % 2 === 0 ? 'white' : '#F9FAFB' }}>
                                                                            <td className="px-3 py-2.5">
                                                                                <div>
                                                                                    <p className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>{p.local}</p>
                                                                                    <span className="inline-block px-1.5 py-0.5 rounded text-xs font-medium mt-0.5"
                                                                                        style={{ backgroundColor: TIPO_COLOR[p.tipo_local] || '#F3F4F6', color: TIPO_TEXT[p.tipo_local] || '#6B7280' }}>
                                                                                        {p.tipo_local}
                                                                                    </span>
                                                                                    {p.veiculo?.placa && (
                                                                                        <p className="font-data text-xs mt-0.5" style={{ color: 'var(--color-muted-foreground)' }}>{p.veiculo.placa}</p>
                                                                                    )}
                                                                                </div>
                                                                            </td>
                                                                            <td className="px-3 py-2.5 font-data whitespace-nowrap" style={{ color: 'var(--color-text-primary)' }}>
                                                                                {p.data_saida ? FMT_DATE(p.data_saida) : '—'}
                                                                            </td>
                                                                            <td className="px-3 py-2.5 font-data whitespace-nowrap" style={{ color: 'var(--color-text-primary)' }}>
                                                                                {p.horario_saida || '—'}
                                                                            </td>
                                                                            <td className="px-3 py-2.5 font-data text-right" style={{ color: '#1D4ED8' }}>
                                                                                {p.km_saida != null ? Number(p.km_saida).toLocaleString('pt-BR') : '—'}
                                                                            </td>
                                                                            <td className="px-3 py-2.5">
                                                                                {p.local_chegada ? (
                                                                                    <div>
                                                                                        <p className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>{p.local_chegada}</p>
                                                                                        <span className="inline-block px-1.5 py-0.5 rounded text-xs font-medium mt-0.5"
                                                                                            style={{ backgroundColor: TIPO_COLOR[p.tipo_local_chegada] || '#F3F4F6', color: TIPO_TEXT[p.tipo_local_chegada] || '#6B7280' }}>
                                                                                            {p.tipo_local_chegada}
                                                                                        </span>
                                                                                    </div>
                                                                                ) : '—'}
                                                                            </td>
                                                                            <td className="px-3 py-2.5 font-data whitespace-nowrap" style={{ color: 'var(--color-text-primary)' }}>
                                                                                {p.data_chegada ? FMT_DATE(p.data_chegada) : '—'}
                                                                            </td>
                                                                            <td className="px-3 py-2.5 font-data whitespace-nowrap" style={{ color: 'var(--color-text-primary)' }}>
                                                                                {p.horario_chegada || '—'}
                                                                            </td>
                                                                            <td className="px-3 py-2.5 font-data text-right" style={{ color: '#059669' }}>
                                                                                {p.km_chegada != null ? Number(p.km_chegada).toLocaleString('pt-BR') : '—'}
                                                                            </td>
                                                                            <td className="px-3 py-2.5 font-data whitespace-nowrap" style={{ color: 'var(--color-text-primary)' }}>
                                                                                {p.cupom_fiscal || '—'}
                                                                            </td>
                                                                            <td className="px-3 py-2.5 max-w-[120px] truncate" style={{ color: 'var(--color-muted-foreground)' }}
                                                                                title={p.observacoes}>
                                                                                {p.observacoes || ''}
                                                                            </td>
                                                                            <td className="px-2 py-2.5">
                                                                                <ActionButtonsGroup>
                                                                                    <EditButton title="Editar" onClick={() => {
                                                                                        setEditandoPontoId(p.id);
                                                                                        setFormPonto({
                                                                                            tipo_local: p.tipo_local || 'Fábrica', local: p.local || '',
                                                                                            veiculo_id: p.veiculo_id || '',
                                                                                            data_saida: p.data_saida || '',
                                                                                            horario_saida: p.horario_saida || '', km_saida: p.km_saida ?? '',
                                                                                            tipo_local_chegada: p.tipo_local_chegada || 'Fábrica', local_chegada: p.local_chegada || '',
                                                                                            data_chegada: p.data_chegada || '',
                                                                                            horario_chegada: p.horario_chegada || '', km_chegada: p.km_chegada ?? '',
                                                                                            cupom_fiscal: p.cupom_fiscal || '', observacoes: p.observacoes || '',
                                                                                            horarios_extras: p.horarios_extras || [],
                                                                                        });
                                                                                        setModalPonto(true);
                                                                                    }} />
                                                                                    <DeleteButton title="Excluir" onClick={async () => {
                                                                                        const ok = await confirm({ title: 'Excluir registro?', message: 'Esta ação não pode ser desfeita.', confirmLabel: 'Excluir', variant: 'danger' });
                                                                                        if (!ok) return;
                                                                                        try { await deletePontoParada(p.id); showToast('Registro excluído.', 'success'); load(); }
                                                                                        catch (e) { showToast('Erro: ' + e.message, 'error'); }
                                                                                    }} />
                                                                                </ActionButtonsGroup>
                                                                            </td>
                                                                        </tr>
                                                                        {p.horarios_extras && p.horarios_extras.length > 0 && p.horarios_extras.map((ex, exIdx) => (
                                                                            <tr key={`${p.id}-extra-${exIdx}`} className="border-t" style={{ borderColor: '#E9D5FF', backgroundColor: '#FAF5FF' }}>
                                                                                <td className="px-3 py-1.5">
                                                                                    <div>
                                                                                        <span className="text-xs font-medium px-1.5 py-0.5 rounded" style={{ backgroundColor: '#E9D5FF', color: '#6D28D9' }}>
                                                                                            {ex.local || `Extra #${exIdx + 1}`}
                                                                                        </span>
                                                                                        {ex.tipo_local && <span className="ml-1 text-xs" style={{ color: '#9CA3AF' }}>{ex.tipo_local}</span>}
                                                                                    </div>
                                                                                </td>
                                                                                <td className="px-3 py-1.5 font-data text-xs whitespace-nowrap" style={{ color: '#6D28D9' }}>{ex.data_saida ? FMT_DATE(ex.data_saida) : '—'}</td>
                                                                                <td className="px-3 py-1.5 font-data text-xs" style={{ color: '#6D28D9' }}>{ex.horario_saida || '—'}</td>
                                                                                <td className="px-3 py-1.5 font-data text-xs text-right" style={{ color: '#1D4ED8' }}>{ex.km_saida != null ? Number(ex.km_saida).toLocaleString('pt-BR') : '—'}</td>
                                                                                <td className="px-3 py-1.5">
                                                                                    {ex.local_chegada ? (
                                                                                        <div>
                                                                                            <span className="text-xs font-medium px-1.5 py-0.5 rounded" style={{ backgroundColor: '#D1FAE5', color: '#065F46' }}>
                                                                                                {ex.local_chegada}
                                                                                            </span>
                                                                                            {ex.tipo_local_chegada && <span className="ml-1 text-xs" style={{ color: '#9CA3AF' }}>{ex.tipo_local_chegada}</span>}
                                                                                        </div>
                                                                                    ) : '—'}
                                                                                </td>
                                                                                <td className="px-3 py-1.5 font-data text-xs whitespace-nowrap" style={{ color: '#6D28D9' }}>{ex.data_chegada ? FMT_DATE(ex.data_chegada) : '—'}</td>
                                                                                <td className="px-3 py-1.5 font-data text-xs" style={{ color: '#6D28D9' }}>{ex.horario_chegada || '—'}</td>
                                                                                <td className="px-3 py-1.5 font-data text-xs text-right" style={{ color: '#059669' }}>{ex.km_chegada != null ? Number(ex.km_chegada).toLocaleString('pt-BR') : '—'}</td>
                                                                                <td colSpan={3} />
                                                                            </tr>
                                                                        ))}
                                                                    </>
                                                                    );
                                                                })}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                    <div className="px-4 py-2 border-t text-xs" style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)', backgroundColor: '#F9FAFB' }}>
                                                        {pontosParadaFiltrados.length} registro{pontosParadaFiltrados.length !== 1 ? 's' : ''}
                                                    </div>
                                                </div>
                                                </>
                                            )}
                                        </div>
    );
}
