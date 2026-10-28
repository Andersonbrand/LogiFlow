import React from 'react';

import { AppIcon as Icon, Button, ModalHeader, ModalOverlay } from 'components';
import { printDiaria } from 'utils/excel';

import { FMT_DATE, BRL } from '../../../../utils/helpers';

// ─── viewDiaria ───
export default function ViewDiaria({ assinando, canSign, exportarDiariaIndividual, handleAssinarDiaria, handleDesassinarDiaria, isAdmin, meuCampoAssinatura, profile, setViewDiaria, showToast, viewDiaria }) {
    return (
        <ModalOverlay onClose={() => setViewDiaria(null)}>
                    <ModalHeader title="Detalhes da Diária" icon="CalendarDays" onClose={() => setViewDiaria(null)} />
                    <div className="p-5 space-y-4 overflow-y-auto flex-1">
                        <div className="grid grid-cols-2 gap-3">
                            {[
                                { label: 'Motorista', value: viewDiaria.motorista?.name || '—' },
                                { label: 'Placa', value: viewDiaria.veiculo?.placa || '—' },
                                { label: 'Data', value: FMT_DATE(viewDiaria.data_inicio) },
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
                                    { campo: 'transporte', titulo: 'Transporte (admin)', cor: '#7C3AED', bg: '#F5F3FF', border: '#C4B5FD' },
                                ].map(({ campo, titulo, cor, bg, border }) => {
                                    const assinado = viewDiaria[`assinatura_${campo}`];
                                    const assinadoEm = viewDiaria[`assinatura_${campo}_at`];
                                    const souEu = meuCampoAssinatura === campo;
                                    if (assinado) {
                                        return (
                                            <label key={campo} className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg ${isAdmin ? 'cursor-pointer' : ''}`}
                                                style={{ backgroundColor: bg, border: `1px solid ${border}` }}
                                                title={isAdmin ? 'Desmarque para remover a assinatura' : undefined}>
                                                <input type="checkbox" checked readOnly={!isAdmin} disabled={!isAdmin || assinando}
                                                    onChange={() => isAdmin && handleDesassinarDiaria(campo)} className="w-4 h-4" />
                                                <Icon name="BadgeCheck" size={14} color={cor} />
                                                <span className="text-xs font-medium" style={{ color: cor }}>
                                                    <strong>{titulo}:</strong> {assinado}
                                                    {assinadoEm && ` em ${new Date(assinadoEm).toLocaleDateString('pt-BR')}`}
                                                    {isAdmin && ' — desmarque para remover'}
                                                </span>
                                            </label>
                                        );
                                    }
                                    if (souEu && profile?.assinatura_digital) {
                                        return (
                                            <label key={campo} className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg cursor-pointer" style={{ backgroundColor: 'var(--color-muted)', border: '1px solid var(--color-border)' }}>
                                                <input type="checkbox" checked={false} disabled={assinando} onChange={handleAssinarDiaria} className="w-4 h-4" />
                                                <Icon name="PenTool" size={14} color="var(--color-muted-foreground)" />
                                                <span className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                                                    {assinando ? 'Assinando...' : `Assinar como ${titulo} (${profile.assinatura_digital})`}
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
                                {!profile?.assinatura_digital && meuCampoAssinatura && (
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
                                <p className="text-sm">{viewDiaria.descricao}</p>
                            </div>
                        )}
                        <div className="p-4 rounded-xl text-center" style={{ backgroundColor: '#EEF2FF', border: '1px solid #C7D2FE' }}>
                            <p className="text-xs text-indigo-600 font-medium mb-1">Total da Diária</p>
                            <p className="text-3xl font-bold font-data text-indigo-700">{BRL(viewDiaria.valor_total)}</p>
                        </div>
                    </div>
                    <div className="flex gap-3 p-5 justify-end border-t flex-shrink-0" style={{ borderColor: 'var(--color-border)' }}>
                        <button onClick={() => setViewDiaria(null)} className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50" style={{ borderColor: 'var(--color-border)' }}>Fechar</button>
                        <Button variant="outline" onClick={() => printDiaria(viewDiaria)} iconName="Printer" size="sm">Imprimir</Button>
                        <Button onClick={() => { exportarDiariaIndividual(viewDiaria); showToast('Exportado!', 'success'); }} iconName="FileDown" size="sm">Exportar</Button>
                    </div>
                </ModalOverlay>
    );
}
