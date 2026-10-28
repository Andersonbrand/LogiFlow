import React from 'react';

import { AppIcon as Icon, PrettySelect } from 'components';

import ModalOverlay from '../ModalOverlay';
import { inputCls, inputStyle } from '../../utils/constants';

// ─── modalPeca ───
export default function ModalPeca({ handleAdicionarPecaNaLista, handleRemoverPecaDaLista, handleSolicitarPeca, modalPeca, pecaItem, pecaItemOutro, pecaQtd, pecasCatalogo, pecasParaSolicitar, setModalPeca, setPecaItem, setPecaItemOutro, setPecaQtd }) {
    return (
        <ModalOverlay onClose={() => setModalPeca(null)}>
                    <div className="flex justify-center pt-3 pb-1 sm:hidden"><div className="w-10 h-1 rounded-full bg-gray-300" /></div>
                    <div className="flex items-center justify-between px-4 sm:px-5 py-4 border-b sticky top-0 bg-white z-10" style={{ borderColor: 'var(--color-border)' }}>
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#EDE9FE' }}>
                                <Icon name="Package" size={18} color="#6D28D9" />
                            </div>
                            <h2 className="font-heading font-bold text-base sm:text-lg truncate" style={{ color: 'var(--color-text-primary)' }}>Solicitar Peça{pecasParaSolicitar.length > 0 ? `s (${pecasParaSolicitar.length})` : ''}</h2>
                        </div>
                        <button onClick={() => setModalPeca(null)} className="p-1.5 rounded-lg hover:bg-gray-100 flex-shrink-0">
                            <Icon name="X" size={18} color="var(--color-muted-foreground)" />
                        </button>
                    </div>
                    <div className="px-4 sm:px-5 py-4 space-y-4">
                        <div className="p-3 rounded-lg" style={{ backgroundColor: '#F8FAFC' }}>
                            <p className="font-medium text-sm" style={{ color: 'var(--color-text-primary)' }}>
                                OS #{modalPeca.id?.slice(0, 8).toUpperCase()}
                                {(modalPeca.veiculo?.placa || modalPeca.veiculo_caminhao_placa) && <span className="font-data"> · {modalPeca.veiculo?.placa || modalPeca.veiculo_caminhao_placa}</span>}
                            </p>
                        </div>

                        {/* Peças já adicionadas nesta requisição — "carrinho" antes de enviar tudo junto */}
                        {pecasParaSolicitar.length > 0 && (
                            <div className="rounded-xl border overflow-hidden" style={{ borderColor: '#DDD6FE' }}>
                                <div className="px-3 py-2 text-xs font-semibold" style={{ backgroundColor: '#F5F3FF', color: '#6D28D9' }}>
                                    Peças nesta solicitação ({pecasParaSolicitar.length})
                                </div>
                                <ul className="divide-y" style={{ borderColor: '#EDE9FE' }}>
                                    {pecasParaSolicitar.map(p => (
                                        <li key={p.key} className="flex items-center justify-between px-3 py-2 text-sm">
                                            <span className="truncate min-w-0">{p.item} <span className="font-data" style={{ color: 'var(--color-muted-foreground)' }}>× {p.quantidade}</span></span>
                                            <button onClick={() => handleRemoverPecaDaLista(p.key)} className="p-1 rounded-md hover:bg-red-50 flex-shrink-0" title="Remover">
                                                <Icon name="X" size={13} color="var(--color-destructive)" />
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        <div>
                            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                                Item / peça{pecasParaSolicitar.length === 0 && <span className="text-red-500"> *</span>}
                            </label>
                            <PrettySelect value={pecaItem} onChange={e => setPecaItem(e.target.value)}
                                className={inputCls} style={inputStyle}>
                                <option value="">Selecione a peça...</option>
                                {pecasCatalogo
                                    .filter(p => !modalPeca.veiculo?.tipo || p.categoria === 'Ambos' || p.categoria === modalPeca.veiculo.tipo)
                                    .map(p => <option key={p.id} value={p.nome}>{p.nome}</option>)}
                                <option value="__outro__">Outro (especificar)...</option>
                            </PrettySelect>
                            {pecaItem === '__outro__' && (
                                <input value={pecaItemOutro} onChange={e => setPecaItemOutro(e.target.value)}
                                    className={`${inputCls} mt-2`} style={inputStyle}
                                    placeholder="Digite o nome da peça" autoFocus />
                            )}
                        </div>
                        <div className="flex items-end gap-2">
                            <div className="flex-1">
                                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Quantidade</label>
                                <input type="number" min="1" value={pecaQtd} onChange={e => setPecaQtd(e.target.value)}
                                    className={inputCls} style={inputStyle} />
                            </div>
                            <button type="button" onClick={handleAdicionarPecaNaLista}
                                className="h-10 px-4 rounded-lg text-sm font-semibold flex items-center gap-1.5 flex-shrink-0"
                                style={{ backgroundColor: '#EDE9FE', color: '#6D28D9' }}>
                                <Icon name="Plus" size={15} color="#6D28D9" /> Adicionar
                            </button>
                        </div>
                        <p className="text-xs -mt-2" style={{ color: 'var(--color-muted-foreground)' }}>
                            Precisa de mais de uma peça? Clique em "Adicionar" pra cada uma e envie tudo junto numa só solicitação.
                        </p>
                        <div className="p-3 rounded-xl text-xs" style={{ backgroundColor: '#FEF9C3', border: '1px solid #FDE68A' }}>
                            <p className="text-amber-700">⚠️ A solicitação será enviada ao administrador, que poderá aprovar ou reprovar a compra.</p>
                        </div>
                    </div>
                    <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 px-4 sm:px-5 pb-5 sm:justify-end">
                        <button onClick={() => setModalPeca(null)}
                            className="w-full sm:w-auto px-4 py-2.5 rounded-lg border text-sm font-medium hover:bg-gray-50 text-center"
                            style={{ borderColor: 'var(--color-border)' }}>Cancelar</button>
                        <button onClick={handleSolicitarPeca}
                            className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold text-white"
                            style={{ backgroundColor: '#6D28D9' }}>
                            <Icon name="Send" size={14} color="#fff" />
                            Enviar Solicitação{(pecasParaSolicitar.length > 1 || (pecasParaSolicitar.length === 1 && (pecaItem === '__outro__' ? pecaItemOutro.trim() : pecaItem))) ? ` (${pecasParaSolicitar.length + ((pecaItem === '__outro__' ? pecaItemOutro.trim() : pecaItem) ? 1 : 0)})` : ''}
                        </button>
                    </div>
                </ModalOverlay>
    );
}
