import React from 'react';

import { AppIcon as Icon } from 'components';

import { downloadImagem } from '../../utils/helpers';

// ─── modalFoto ───
export default function ModalFoto({ modalFoto, setModalFoto }) {
    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)' }} onClick={() => setModalFoto(null)}>
                    <div className="relative max-w-2xl w-full" onClick={e => e.stopPropagation()}>
                        <div className="absolute -top-10 right-0 flex items-center gap-3">
                            {modalFoto.fotos.length > 1 && (
                                <span className="text-white opacity-70 text-xs font-medium">{modalFoto.index + 1} / {modalFoto.fotos.length}</span>
                            )}
                            <button onClick={() => downloadImagem(modalFoto.fotos[modalFoto.index], `checklist_foto_${modalFoto.index + 1}_${Date.now()}.jpg`)} className="text-white opacity-80 hover:opacity-100 flex items-center gap-1 text-sm">
                                <Icon name="Download" size={16} color="white" /> Baixar
                            </button>
                            <button onClick={() => setModalFoto(null)} className="text-white opacity-80 hover:opacity-100 flex items-center gap-1 text-sm">
                                <Icon name="X" size={16} color="white" /> Fechar
                            </button>
                        </div>
                        {modalFoto.fotos.length > 1 && (
                            <button onClick={() => setModalFoto(m => ({ ...m, index: (m.index - 1 + m.fotos.length) % m.fotos.length }))}
                                className="absolute left-0 sm:-left-14 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center transition-colors"
                                title="Foto anterior">
                                <Icon name="ChevronLeft" size={22} color="white" />
                            </button>
                        )}
                        <img src={modalFoto.fotos[modalFoto.index]} alt="Foto checklist" className="rounded-xl max-w-2xl w-full max-h-[80vh] object-contain" />
                        {modalFoto.fotos.length > 1 && (
                            <button onClick={() => setModalFoto(m => ({ ...m, index: (m.index + 1) % m.fotos.length }))}
                                className="absolute right-0 sm:-right-14 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center transition-colors"
                                title="Próxima foto">
                                <Icon name="ChevronRight" size={22} color="white" />
                            </button>
                        )}
                    </div>
                </div>
    );
}
