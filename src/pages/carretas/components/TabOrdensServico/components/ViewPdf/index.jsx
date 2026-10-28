import React from 'react';

import { AppIcon as Icon } from 'components';

import { downloadImagem } from '../../../../utils/helpers';
import { getAnexoTipo } from '../../utils/helpers';

// ─── viewPdf ───
export default function ViewPdf({ setViewPdf, viewPdf }) {
    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', flexDirection: 'column' }}>
                    {/* Barra superior discreta — apenas título e fechar */}
                    <div style={{
                        position: 'relative', zIndex: 10000, flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '8px 16px', backgroundColor: '#111827',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                    }}>
                        <span style={{ color: '#9CA3AF', fontSize: 13 }}>Ordem de Serviço — Anexo</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <button
                                onClick={() => downloadImagem(viewPdf, `OS_anexo_${Date.now()}${getAnexoTipo(viewPdf) === 'imagem' ? '.jpg' : '.pdf'}`)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 6,
                                    padding: '0 12px', height: 32, borderRadius: 6,
                                    backgroundColor: '#374151', color: '#D1D5DB',
                                    border: 'none', cursor: 'pointer', fontSize: 12,
                                }}
                                title="Baixar">
                                <Icon name="Download" size={14} color="#D1D5DB" /> Baixar
                            </button>
                            <button
                                onClick={() => { setViewPdf(null); window.history.back(); }}
                                style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    width: 32, height: 32, borderRadius: 6,
                                    backgroundColor: '#374151', color: '#D1D5DB',
                                    border: 'none', cursor: 'pointer', fontSize: 18, lineHeight: 1,
                                }}
                                title="Fechar">
                                ✕
                            </button>
                        </div>
                    </div>
                    {getAnexoTipo(viewPdf) === 'imagem' ? (
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1a1a1a', overflow: 'auto', padding: 16 }}>
                            <img src={viewPdf} alt="Anexo da OS" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 6 }} />
                        </div>
                    ) : (
                    <iframe
                        src={viewPdf}
                        title="Ordem de Serviço"
                        style={{ flex: 1, border: 'none', width: '100%', backgroundColor: '#1a1a1a' }}
                    />
                    )}
                </div>
    );
}
