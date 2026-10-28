import React from 'react';

import { AppIcon as Icon } from 'components';

import ModalOverlay from '../ModalOverlay';
import { inputCls, inputStyle } from '../../utils/constants';

// ─── modalProblema ───
export default function ModalProblema({ descProblema, handleReportarProblema, modalProblema, setDescProblema, setModalProblema }) {
    return (
        <ModalOverlay onClose={() => setModalProblema(null)}>
                    <div className="flex justify-center pt-3 pb-1 sm:hidden"><div className="w-10 h-1 rounded-full bg-gray-300" /></div>
                    <div className="flex items-center justify-between px-4 sm:px-5 py-4 border-b sticky top-0 bg-white z-10" style={{ borderColor: 'var(--color-border)' }}>
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#FEE2E2' }}>
                                <Icon name="AlertTriangle" size={18} color="#DC2626" />
                            </div>
                            <h2 className="font-heading font-bold text-base sm:text-lg truncate" style={{ color: 'var(--color-text-primary)' }}>Reportar Problema</h2>
                        </div>
                        <button onClick={() => setModalProblema(null)} className="p-1.5 rounded-lg hover:bg-gray-100 flex-shrink-0">
                            <Icon name="X" size={18} color="var(--color-muted-foreground)" />
                        </button>
                    </div>
                    <div className="px-4 sm:px-5 py-4 space-y-4">
                        <div className="p-3 rounded-lg" style={{ backgroundColor: '#F8FAFC' }}>
                            <p className="font-medium text-sm" style={{ color: 'var(--color-text-primary)' }}>
                                OS #{modalProblema.id?.slice(0, 8).toUpperCase()}
                                {(modalProblema.veiculo?.placa || modalProblema.veiculo_caminhao_placa) && <span className="font-data"> · {modalProblema.veiculo?.placa || modalProblema.veiculo_caminhao_placa}</span>}
                            </p>
                        </div>
                        <div>
                            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                                Descreva o problema encontrado <span className="text-red-500">*</span>
                            </label>
                            <textarea value={descProblema} onChange={e => setDescProblema(e.target.value)}
                                className={inputCls} style={inputStyle} rows={5}
                                placeholder="Ex: Desgaste excessivo nas pastilhas de freio, necessário substituição imediata..." />
                        </div>
                        <div className="p-3 rounded-xl text-xs" style={{ backgroundColor: '#FEF9C3', border: '1px solid #FDE68A' }}>
                            <p className="text-amber-700">⚠️ O problema será enviado ao administrador para aprovação antes de prosseguir.</p>
                        </div>
                    </div>
                    <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 px-4 sm:px-5 pb-5 sm:justify-end">
                        <button onClick={() => setModalProblema(null)}
                            className="w-full sm:w-auto px-4 py-2.5 rounded-lg border text-sm font-medium hover:bg-gray-50 text-center"
                            style={{ borderColor: 'var(--color-border)' }}>Cancelar</button>
                        <button onClick={handleReportarProblema}
                            className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold text-white"
                            style={{ backgroundColor: '#DC2626' }}>
                            <Icon name="Send" size={14} color="#fff" />
                            Enviar para Admin
                        </button>
                    </div>
                </ModalOverlay>
    );
}
