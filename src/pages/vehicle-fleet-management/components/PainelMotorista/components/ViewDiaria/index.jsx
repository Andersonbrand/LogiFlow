import React from 'react';

import { AppIcon as Icon } from 'components';
import { printDiaria, exportDiariaModelo } from 'utils/excel';

import { FMT, BRL } from '../../utils/helpers';

// ─── viewDiaria ───
export default function ViewDiaria({ adminProfile, assinando, canSign, handleAssinarDiaria, handleDesassinarDiaria, isAdminUser, meuCampoAssinatura, setViewDiaria, showToast, viewDiaria }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={() => setViewDiaria(null)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden max-h-[85vh]" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0" style={{ borderColor: 'var(--color-border)' }}>
                            <div className="flex items-center gap-2">
                                <Icon name="CalendarDays" size={18} color="#4F46E5" />
                                <h3 className="text-base font-bold" style={{ color: 'var(--color-text-primary)' }}>Detalhes da Diária</h3>
                            </div>
                            <button onClick={() => setViewDiaria(null)} className="p-1.5 rounded-lg hover:bg-gray-100"><Icon name="X" size={16} color="var(--color-muted-foreground)" /></button>
                        </div>
                        <div className="p-5 space-y-4 overflow-y-auto flex-1 min-h-0">
                            <div className="grid grid-cols-2 gap-3">
                                {[
                                    { label: 'Motorista', value: viewDiaria.motorista?.name || '—' },
                                    { label: 'Data', value: FMT(viewDiaria.data_inicio) },
                                    { label: 'Quantidade de dias', value: viewDiaria.quantidade_dias },
                                    { label: 'Valor por dia', value: BRL(viewDiaria.valor_dia) },
                                ].map(({ label, value }) => (
                                    <div key={label} className="p-3 rounded-xl border" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-muted)' }}>
                                        <p className="text-xs mb-0.5" style={{ color: 'var(--color-muted-foreground)' }}>{label}</p>
                                        <p className="text-sm font-semibold font-data">{value}</p>
                                    </div>
                                ))}
                            </div>
                            {viewDiaria.viagem && (
                                <div className="p-3 rounded-xl border" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-muted)' }}>
                                    <p className="text-xs mb-0.5" style={{ color: 'var(--color-muted-foreground)' }}>Viagem vinculada</p>
                                    <p className="text-sm font-semibold font-data text-blue-700">{viewDiaria.viagem.numero}</p>
                                    {viewDiaria.viagem.destino && <p className="text-xs text-gray-500">{viewDiaria.viagem.destino}</p>}
                                </div>
                            )}
                            {canSign && (
                                <div className="space-y-2">
                                    {[
                                        { campo: 'logistica', titulo: 'Logística (operador)', cor: '#1D4ED8', bg: '#EFF6FF', border: '#93C5FD' },
                                        { campo: 'transporte', titulo: 'Transporte (admin)', cor: '#7C3AED', bg: '#F5F3FF', border: '#C4B5FD' },
                                    ].map(({ campo, titulo, cor, bg, border }) => {
                                        const assinado = viewDiaria[`assinatura_${campo}`];
                                        const assinadoEm = viewDiaria[`assinatura_${campo}_at`];
                                        const souEu = meuCampoAssinatura === campo;
                                        if (assinado) {
                                            return (
                                                <label key={campo} className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg ${isAdminUser ? 'cursor-pointer' : ''}`}
                                                    style={{ backgroundColor: bg, border: `1px solid ${border}` }}
                                                    title={isAdminUser ? 'Desmarque para remover a assinatura' : undefined}>
                                                    <input type="checkbox" checked readOnly={!isAdminUser} disabled={!isAdminUser || assinando}
                                                        onChange={() => isAdminUser && handleDesassinarDiaria(campo)} className="w-4 h-4" />
                                                    <Icon name="BadgeCheck" size={14} color={cor} />
                                                    <span className="text-xs font-medium" style={{ color: cor }}>
                                                        <strong>{titulo}:</strong> {assinado}
                                                        {assinadoEm && ` em ${new Date(assinadoEm).toLocaleDateString('pt-BR')}`}
                                                        {isAdminUser && ' — desmarque para remover'}
                                                    </span>
                                                </label>
                                            );
                                        }
                                        if (souEu && adminProfile?.assinatura_digital) {
                                            return (
                                                <label key={campo} className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg cursor-pointer" style={{ backgroundColor: 'var(--color-muted)', border: '1px solid var(--color-border)' }}>
                                                    <input type="checkbox" checked={false} disabled={assinando} onChange={handleAssinarDiaria} className="w-4 h-4" />
                                                    <Icon name="PenTool" size={14} color="var(--color-muted-foreground)" />
                                                    <span className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                                                        {assinando ? 'Assinando...' : `Assinar como ${titulo} (${adminProfile.assinatura_digital})`}
                                                    </span>
                                                </label>
                                            );
                                        }
                                        return (
                                            <div key={campo} className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg" style={{ backgroundColor: 'var(--color-muted)', border: '1px dashed var(--color-border)' }}>
                                                <Icon name="Clock" size={14} color="var(--color-muted-foreground)" />
                                                <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                                                    Aguardando assinatura de <strong>{titulo}</strong>
                                                </span>
                                            </div>
                                        );
                                    })}
                                    {!adminProfile?.assinatura_digital && meuCampoAssinatura && (
                                        <p className="text-xs flex items-center gap-1.5" style={{ color: 'var(--color-muted-foreground)' }}>
                                            <Icon name="Info" size={12} />
                                            Você ainda não tem uma assinatura digital cadastrada. Cadastre em Admin &gt; Configurações.
                                        </p>
                                    )}
                                </div>
                            )}
                            {viewDiaria.descricao && (
                                <div className="p-3 rounded-xl border" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-muted)' }}>
                                    <p className="text-xs mb-0.5" style={{ color: 'var(--color-muted-foreground)' }}>Descrição / Motivo</p>
                                    <p className="text-sm whitespace-pre-wrap break-words">{viewDiaria.descricao}</p>
                                </div>
                            )}
                            <div className="p-4 rounded-xl text-center" style={{ backgroundColor: '#EEF2FF', border: '1px solid #C7D2FE' }}>
                                <p className="text-xs text-indigo-600 font-medium mb-1">Total da Diária</p>
                                <p className="text-3xl font-bold font-data text-indigo-700">{BRL(viewDiaria.valor_total)}</p>
                            </div>
                        </div>
                        <div className="flex gap-3 p-5 justify-end border-t flex-shrink-0" style={{ borderColor: 'var(--color-border)' }}>
                            <button onClick={() => setViewDiaria(null)} className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50" style={{ borderColor: 'var(--color-border)' }}>Fechar</button>
                            <button onClick={() => printDiaria(viewDiaria)}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border" style={{ borderColor: '#4F46E5', color: '#4F46E5' }}>
                                <Icon name="Printer" size={14} color="#4F46E5" /> Imprimir
                            </button>
                            <button onClick={() => { exportDiariaModelo(viewDiaria); showToast('Exportado!', 'success'); }}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ backgroundColor: '#4F46E5' }}>
                                <Icon name="FileDown" size={14} color="white" /> Exportar
                            </button>
                        </div>
                    </div>
                </div>
    );
}
