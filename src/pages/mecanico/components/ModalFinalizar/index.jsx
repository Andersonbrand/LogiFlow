import React from 'react';

import { AppIcon as Icon } from 'components';

import ModalOverlay from '../ModalOverlay';
import { inputCls, inputStyle } from '../../utils/constants';

// ─── modalFinalizar ───
export default function ModalFinalizar({ assinarFinalizacao, handleFinalizar, modalFinalizar, obsFinalizar, profile, setAssinarFinalizacao, setModalFinalizar, setObsFinalizar }) {
    return (
        <ModalOverlay onClose={() => setModalFinalizar(null)}>
                    <div className="flex justify-center pt-3 pb-1 sm:hidden"><div className="w-10 h-1 rounded-full bg-gray-300" /></div>
                    <div className="flex items-center justify-between px-4 sm:px-5 py-4 border-b sticky top-0 bg-white z-10" style={{ borderColor: 'var(--color-border)' }}>
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#D1FAE5' }}>
                                <Icon name="CheckCircle2" size={18} color="#059669" />
                            </div>
                            <h2 className="font-heading font-bold text-base sm:text-lg truncate" style={{ color: 'var(--color-text-primary)' }}>Finalizar OS</h2>
                        </div>
                        <button onClick={() => setModalFinalizar(null)} className="p-1.5 rounded-lg hover:bg-gray-100 flex-shrink-0">
                            <Icon name="X" size={18} color="var(--color-muted-foreground)" />
                        </button>
                    </div>
                    <div className="px-4 sm:px-5 py-4 space-y-4">
                        <div className="p-3 rounded-lg" style={{ backgroundColor: '#F8FAFC' }}>
                            <p className="font-medium text-sm" style={{ color: 'var(--color-text-primary)' }}>
                                OS #{modalFinalizar.id?.slice(0, 8).toUpperCase()}
                                {(modalFinalizar.veiculo?.placa || modalFinalizar.veiculo_caminhao_placa) && <span className="font-data"> · {modalFinalizar.veiculo?.placa || modalFinalizar.veiculo_caminhao_placa}</span>}
                            </p>
                            <p className="text-xs mt-1 line-clamp-2" style={{ color: 'var(--color-muted-foreground)' }}>{modalFinalizar.descricao}</p>
                        </div>
                        <div>
                            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Observações de conclusão (opcional)</label>
                            <textarea value={obsFinalizar} onChange={e => setObsFinalizar(e.target.value)}
                                className={inputCls} style={inputStyle} rows={4}
                                placeholder="Descreva o que foi feito, peças trocadas, etc..." />
                        </div>
                        {profile?.assinatura_digital ? (
                            <label className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg cursor-pointer" style={{ backgroundColor: assinarFinalizacao ? '#EFF6FF' : 'var(--color-muted)', border: `1px solid ${assinarFinalizacao ? '#93C5FD' : 'var(--color-border)'}` }}>
                                <input type="checkbox" checked={assinarFinalizacao} onChange={e => setAssinarFinalizacao(e.target.checked)} className="w-4 h-4" />
                                <Icon name="PenTool" size={14} color={assinarFinalizacao ? '#1D4ED8' : 'var(--color-muted-foreground)'} />
                                <span className="text-xs font-medium" style={{ color: assinarFinalizacao ? '#1D4ED8' : 'var(--color-text-secondary)' }}>
                                    Autenticar com minha assinatura digital ({profile.assinatura_digital})
                                </span>
                            </label>
                        ) : (
                            <p className="text-xs flex items-center gap-1.5" style={{ color: 'var(--color-muted-foreground)' }}>
                                <Icon name="Info" size={12} />
                                Você ainda não tem uma assinatura digital cadastrada. Peça ao administrador para cadastrar.
                            </p>
                        )}
                    </div>
                    <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 px-4 sm:px-5 pb-5 sm:justify-end">
                        <button onClick={() => setModalFinalizar(null)}
                            className="w-full sm:w-auto px-4 py-2.5 rounded-lg border text-sm font-medium hover:bg-gray-50 text-center"
                            style={{ borderColor: 'var(--color-border)' }}>Cancelar</button>
                        <button onClick={handleFinalizar}
                            className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold text-white"
                            style={{ backgroundColor: '#059669' }}>
                            <Icon name="CheckCircle2" size={15} color="#fff" />
                            Confirmar Finalização
                        </button>
                    </div>
                </ModalOverlay>
    );
}
