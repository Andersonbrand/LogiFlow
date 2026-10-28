import React from 'react';

import { AppIcon as Icon } from 'components';
import { contarItensOk, CHECKLIST_ITENS, itemIsOk, itemLabelOf, itemObsOf } from 'services/carretas';

// ─── tab === 'checklist' ───
export default function TabChecklist({ checklistItens, checklistsFiltrados, handleDeleteChecklist, handleEditCheck, seletorPlaca }) {
    return (
        <div className="flex flex-col gap-4">
                                            {seletorPlaca && <div className="flex justify-end">{seletorPlaca}</div>}
                                            {checklistsFiltrados.length === 0 && (
                                                <div className="flex flex-col items-center justify-center py-12 gap-2" style={{ color: 'var(--color-muted-foreground)' }}>
                                                    <Icon name="ClipboardCheck" size={32} color="var(--color-muted-foreground)" />
                                                    <span className="text-sm">Nenhum checklist enviado ainda</span>
                                                </div>
                                            )}
                                            {checklistsFiltrados.map(c => {
                                                const itens = c.itens || {};
                                                const entradas = Object.entries(itens);
                                                const ok = contarItensOk(itens);
                                                const total = entradas.length || checklistItens.length || CHECKLIST_ITENS.length;
                                                const reprovados = entradas.filter(([, v]) => !itemIsOk(v));
                                                const fotos = (c.fotos_urls && c.fotos_urls.length) ? c.fotos_urls : (c.foto_url ? [c.foto_url] : []);
                                                return (
                                                    <div key={c.id} className="bg-white rounded-xl border p-4 shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
                                                        <div className="flex items-center justify-between mb-2">
                                                            <div>
                                                                <p className="font-medium text-sm" style={{ color: 'var(--color-text-primary)' }}>{c.veiculo?.placa || '—'}</p>
                                                                <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>Semana de {c.semana_ref ? new Date(c.semana_ref + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}</p>
                                                            </div>
                                                            {c.aprovado
                                                                ? <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700"><Icon name="CheckCircle2" size={11} />Aprovado</span>
                                                                : <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700"><Icon name="Clock" size={11} />Pendente</span>
                                                            }
                                                        </div>
                                                        <div className="flex items-center justify-between text-xs mb-1">
                                                            <span style={{ color: 'var(--color-muted-foreground)' }}>Itens OK</span>
                                                            <span className="font-medium">{ok}/{total}</span>
                                                        </div>
                                                        <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden">
                                                            <div className="h-full rounded-full" style={{ width: `${total ? (ok / total) * 100 : 0}%`, backgroundColor: ok === total ? '#059669' : '#D97706' }} />
                                                        </div>
                                                        {reprovados.length > 0 && (
                                                            <div className="mt-2 space-y-1">
                                                                {reprovados.map(([id, v]) => (
                                                                    <p key={id} className="text-xs px-2 py-1 rounded bg-red-50 text-red-700">
                                                                        <Icon name="X" size={10} className="inline mr-1" />{itemLabelOf(v, id)}{itemObsOf(v) && ` — ${itemObsOf(v)}`}
                                                                    </p>
                                                                ))}
                                                            </div>
                                                        )}
                                                        {fotos.length > 0 && (
                                                            <div className="flex flex-wrap gap-1.5 mt-2">
                                                                {fotos.map((f, i) => <img key={i} src={f} alt="" className="w-12 h-12 rounded-md border object-cover" style={{ borderColor: 'var(--color-border)' }} />)}
                                                            </div>
                                                        )}
                                                        <div className="flex justify-end gap-2 mt-3 pt-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
                                                            <button onClick={() => handleEditCheck(c)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-blue-200 text-blue-600 hover:bg-blue-50">
                                                                <Icon name="Pencil" size={16} />Editar
                                                            </button>
                                                            <button onClick={() => handleDeleteChecklist(c.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-red-200 text-red-600 hover:bg-red-50">
                                                                <Icon name="Trash2" size={16} />Excluir
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
    );
}
