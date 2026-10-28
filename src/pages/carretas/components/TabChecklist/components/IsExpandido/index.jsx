import React from 'react';

import { itemIsOk, itemLabelOf, itemObsOf } from 'services/carretas';
import { AppIcon as Icon } from 'components';
import { printChecklist } from 'utils/excel';

import { downloadImagem } from '../../../../utils/helpers';

// ─── isExpandido ───
export default function IsExpandido({ c, checklistItens, entradas, fotos, handleAprovarClick, handleDeleteChecklist, isAdmin, ok, openEditChecklist, setModalFoto, setModalManut, setObsManut, total }) {
    return (
        <div className="p-4 sm:p-5 pt-3">
                                <div className="mb-3">
                                    <div className="flex items-center justify-between text-xs mb-1">
                                        <span style={{ color: 'var(--color-muted-foreground)' }}>Itens verificados</span>
                                        <span className="font-semibold" style={{ color: ok === total ? '#059669' : ok >= total * 0.7 ? '#D97706' : '#DC2626' }}>{ok}/{total}</span>
                                    </div>
                                    <div className="w-full h-1.5 rounded-full bg-gray-100 overflow-hidden">
                                        <div className="h-full rounded-full transition-all" style={{ width: `${total ? (ok / total) * 100 : 0}%`, backgroundColor: ok === total ? '#059669' : ok >= total * 0.7 ? '#D97706' : '#DC2626' }} />
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mb-3 items-start">
                                    {entradas.map(([id, v]) => {
                                        const itemOk = itemIsOk(v);
                                        const label = itemLabelOf(v, id);
                                        const obs = itemObsOf(v);
                                        return (
                                            <div key={id} className="flex items-start justify-between gap-2 text-xs px-2.5 py-1.5 rounded-lg border" style={{ backgroundColor: itemOk ? '#F0FDF4' : '#FFF5F5', borderColor: itemOk ? '#D1FAE5' : '#FECACA' }}>
                                                <div className="min-w-0">
                                                    <span style={{ color: itemOk ? '#065F46' : '#991B1B' }}>{label}</span>
                                                    {obs && <p className="text-[11px] italic mt-0.5" style={{ color: '#991B1B' }}>"{obs}"</p>}
                                                </div>
                                                <span className="flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center mt-0.5" style={{ backgroundColor: itemOk ? '#059669' : '#DC2626' }}>
                                                    <Icon name={itemOk ? 'Check' : 'X'} size={10} color="white" />
                                                </span>
                                            </div>
                                        );
                                    })}
                                    {entradas.length === 0 && <p className="text-xs col-span-full" style={{ color: 'var(--color-muted-foreground)' }}>Nenhum item registrado.</p>}
                                </div>
                                {fotos.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mb-3">
                                        {fotos.map((f, idx) => (
                                            <div key={idx} className="relative group">
                                                <button onClick={() => setModalFoto({ fotos, index: idx })}>
                                                    <img src={f} alt={`Foto ${idx + 1}`} className="w-16 h-16 rounded-lg border object-cover hover:opacity-80 transition-opacity" style={{ borderColor: 'var(--color-border)' }} />
                                                </button>
                                                <button onClick={() => downloadImagem(f, `checklist_${c.veiculo?.placa || c.id}_${idx + 1}.jpg`)} title="Baixar foto"
                                                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-gray-700 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Icon name="Download" size={11} color="white" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {(c.problemas || c.necessidades || c.observacoes_livres) && (
                                    <div className="text-xs space-y-1 mb-3 p-3 rounded-lg bg-gray-50">
                                        {c.problemas && <p><span className="font-medium text-red-600">⚠ Problemas:</span> {c.problemas}</p>}
                                        {c.necessidades && <p><span className="font-medium text-amber-600">🔧 Necessidades:</span> {c.necessidades}</p>}
                                        {c.observacoes_livres && <p><span className="font-medium text-gray-500">Obs:</span> {c.observacoes_livres}</p>}
                                    </div>
                                )}
                                {c.obs_manutencao && (
                                    <div className="text-xs p-3 rounded-lg mb-3" style={{ backgroundColor: '#FFF7ED', border: '1px solid #FED7AA' }}>
                                        <span className="font-medium text-orange-700">Manutenção registrada:</span> {c.obs_manutencao}
                                    </div>
                                )}
                                {isAdmin && !c.aprovado && (
                                    <div className="flex flex-wrap gap-2 pt-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
                                        <button onClick={() => handleAprovarClick(c)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-green-600 text-white hover:bg-green-700 transition-colors"><Icon name="CheckCircle2" size={13} />Aprovar</button>
                                        <button onClick={() => openEditChecklist(c)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border hover:bg-gray-50 transition-colors" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}><Icon name="Pencil" size={13} color="var(--color-muted-foreground)" />Editar</button>
                                        <button onClick={() => { setModalManut(c.id); setObsManut(''); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-orange-300 text-orange-700 hover:bg-orange-50 transition-colors"><Icon name="Wrench" size={13} />Registrar Manutenção</button>
                                        <button onClick={() => printChecklist(c, checklistItens)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border hover:bg-gray-50 transition-colors" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}><Icon name="Printer" size={13} color="var(--color-muted-foreground)" />Imprimir</button>
                                        <button onClick={() => handleDeleteChecklist(c.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-red-300 text-red-600 hover:bg-red-50 transition-colors ml-auto"><Icon name="Trash2" size={16} />Excluir</button>
                                    </div>
                                )}
                                {isAdmin && c.aprovado && (
                                    <div className="flex flex-wrap gap-2 justify-end pt-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
                                        <button onClick={() => printChecklist(c, checklistItens)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border hover:bg-gray-50 transition-colors" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}><Icon name="Printer" size={13} color="var(--color-muted-foreground)" />Imprimir</button>
                                        <button onClick={() => openEditChecklist(c)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border hover:bg-gray-50 transition-colors" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}><Icon name="Pencil" size={13} color="var(--color-muted-foreground)" />Editar</button>
                                        <button onClick={() => handleDeleteChecklist(c.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-red-300 text-red-600 hover:bg-red-50 transition-colors"><Icon name="Trash2" size={16} />Excluir</button>
                                    </div>
                                )}
                                </div>
    );
}
