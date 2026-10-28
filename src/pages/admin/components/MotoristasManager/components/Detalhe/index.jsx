import React from 'react';

import { AppIcon as Icon } from 'components';

import { DRIVER_ROLES } from '../../utils/constants';

// ─── detalhe ───
export default function Detalhe({ detalhe, setDetalhe, setLightbox }) {
    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 pt-20"
                    style={{ backgroundColor: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(2px)' }}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden max-h-[80vh] flex flex-col">
                        {/* Header */}
                        <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100 bg-slate-50 flex-shrink-0">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                                style={{ backgroundColor: 'var(--color-primary)' }}>
                                <Icon name="User" size={20} color="#fff" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold text-slate-800 truncate">{detalhe.name || '—'}</p>
                                {detalhe.email && <p className="text-xs text-slate-500 truncate">{detalhe.email}</p>}
                            </div>
                            <button onClick={() => setDetalhe(null)}
                                className="p-1.5 rounded-lg hover:bg-slate-200 transition-colors flex-shrink-0">
                                <Icon name="X" size={16} color="#64748B" />
                            </button>
                        </div>

                        {/* Body scrollável */}
                        <div className="overflow-y-auto flex-1 p-5 flex flex-col gap-4">
                            {/* Grid de informações */}
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                {[
                                    ['Função',        DRIVER_ROLES.find(r => r.value === (detalhe.role === 'motorista' && detalhe.tipo_veiculo === 'carreta' ? 'motorista_carreta' : detalhe.role))?.label || detalhe.role || ''],
                                    ['CNH N°',        detalhe.cnh_numero      || ''],
                                    ['Categoria',     detalhe.cnh_categoria   || ''],
                                    ['Vencimento CNH',detalhe.cnh_vencimento  ? new Date(detalhe.cnh_vencimento + 'T12:00:00').toLocaleDateString('pt-BR') : ''],
                                    ['Nascimento',    detalhe.data_nascimento ? new Date(detalhe.data_nascimento + 'T12:00:00').toLocaleDateString('pt-BR') : ''],
                                ].filter(([, val]) => val).map(([label, val]) => (
                                    <div key={label} className="bg-slate-50 rounded-lg px-3 py-2">
                                        <p className="text-xs text-slate-500 mb-0.5">{label}</p>
                                        <p className="font-medium text-slate-800 text-sm">{val}</p>
                                    </div>
                                ))}
                            </div>

                            {/* Seção de documento CNH */}
                            <div className="border-t border-slate-100 pt-3">
                                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                                    <Icon name="FileImage" size={13} color="#64748B" />
                                    Documento CNH
                                </p>
                                {detalhe.cnh_foto_url ? (
                                    <div className="space-y-2">
                                        {/\.(jpe?g|png|gif|webp|bmp)$/i.test(detalhe.cnh_foto_url) ? (
                                            /* Thumbnail clicável — abre lightbox interno */
                                            <button
                                                onClick={() => setLightbox(true)}
                                                className="w-full rounded-xl overflow-hidden border border-slate-200 bg-slate-100 block relative group"
                                                title="Clique para ampliar">
                                                <img
                                                    src={detalhe.cnh_foto_url}
                                                    alt="Foto da CNH"
                                                    className="w-full object-contain max-h-48"
                                                    onError={e => {
                                                        e.target.style.display = 'none';
                                                        e.target.nextElementSibling.style.display = 'flex';
                                                    }}
                                                />
                                                <div style={{ display: 'none' }}
                                                    className="items-center justify-center h-28 text-slate-400 text-xs flex-col gap-2">
                                                    <Icon name="ImageOff" size={22} color="#CBD5E1" />
                                                    <span>Imagem não pôde ser carregada</span>
                                                </div>
                                                {/* Overlay de zoom ao hover */}
                                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                                    <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 text-white text-xs px-2 py-1 rounded-lg flex items-center gap-1">
                                                        <Icon name="ZoomIn" size={12} color="#fff" /> Ampliar
                                                    </span>
                                                </div>
                                            </button>
                                        ) : (
                                            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                                                <div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
                                                    <Icon name="FileText" size={18} color="#DC2626" />
                                                </div>
                                                <p className="text-xs text-slate-600 flex-1">Documento PDF anexado</p>
                                                <a href={detalhe.cnh_foto_url} target="_blank" rel="noopener noreferrer"
                                                    className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 flex-shrink-0">
                                                    <Icon name="ExternalLink" size={12} color="currentColor" /> Abrir
                                                </a>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                        <Icon name="FileX" size={16} color="#CBD5E1" />
                                        <p className="text-xs text-slate-400">Nenhum documento anexado</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
    );
}
