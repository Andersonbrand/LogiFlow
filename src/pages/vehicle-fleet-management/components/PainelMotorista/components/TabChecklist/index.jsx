import React from 'react';

import { AppIcon as Icon } from 'components';
import { contarItensOk, CHECKLIST_ITENS, itemIsOk, itemLabelOf, itemObsOf } from 'services/carretas';
import { printChecklist } from 'utils/excel';

import { FMT, downloadImagem } from '../../utils/helpers';

// ─── tab === 'checklist' ───
export default function TabChecklist({ checklists, expandidosChecklist, handleAprovar, handleDeleteChecklist, openEditChecklist, setModalFoto, setModalManut, setObsManut, toggleExpandidoChecklist }) {
    return (
        <div className="space-y-4">
                                    {checklists.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-12 rounded-xl border" style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                                            <Icon name="ClipboardCheck" size={32} color="var(--color-muted-foreground)" />
                                            <p className="text-sm mt-2 text-center">Nenhum checklist enviado</p>
                                            <p className="text-xs mt-1 text-center">O motorista envia pelo app e aparece aqui para aprovação</p>
                                        </div>
                                    ) : checklists.map(c => {
                                        const itens = c.itens || {};
                                        const entradas = Object.entries(itens);
                                        const ok = contarItensOk(itens);
                                        const total = entradas.length || CHECKLIST_ITENS.length;
                                        const fotos = (c.fotos_urls && c.fotos_urls.length) ? c.fotos_urls : (c.foto_url ? [c.foto_url] : []);
                                        const isExpandido = expandidosChecklist.has(c.id);
                                        return (
                                            <div key={c.id} className="bg-white rounded-xl border shadow-sm overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
                                                <div className="flex items-start justify-between gap-2 p-4 pb-3 cursor-pointer select-none"
                                                    style={isExpandido ? { borderBottom: '1px solid #F1F5F9' } : undefined}
                                                    onClick={() => toggleExpandidoChecklist(c.id)}>
                                                    <div>
                                                        <p className="font-semibold text-sm" style={{ color: 'var(--color-text-primary)' }}>{c.veiculo?.placa || c.veiculo_caminhao_placa || 'Sem placa'}</p>
                                                        <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                                                            Semana de {c.semana_ref ? FMT(c.semana_ref) : '—'}
                                                            {c.odometro != null && <> · <Icon name="Gauge" size={11} className="inline -mt-0.5" />{' '}{Number(c.odometro).toLocaleString('pt-BR')} km</>}
                                                        </p>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 flex-wrap justify-end flex-shrink-0">
                                                        <span className="text-xs font-semibold mr-0.5" style={{ color: ok === total ? '#059669' : ok >= total * 0.7 ? '#D97706' : '#DC2626' }}>{ok}/{total}</span>
                                                        {c.aprovado
                                                            ? <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700"><Icon name="CheckCircle2" size={11} />Aprovado</span>
                                                            : <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700"><Icon name="Clock" size={11} />Pendente</span>
                                                        }
                                                        {c.manutencao_registrada && <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700"><Icon name="Wrench" size={11} />Manutenção</span>}
                                                        {fotos.length > 0 && (
                                                            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                                                                <Icon name="Camera" size={11} />{fotos.length} foto{fotos.length > 1 ? 's' : ''}
                                                            </span>
                                                        )}
                                                        <button onClick={(e) => { e.stopPropagation(); toggleExpandidoChecklist(c.id); }} title={isExpandido ? 'Recolher' : 'Expandir'}
                                                            className="w-6 h-6 rounded-md flex items-center justify-center hover:bg-gray-100 transition-colors flex-shrink-0">
                                                            <Icon name={isExpandido ? 'ChevronUp' : 'ChevronDown'} size={16} color="var(--color-muted-foreground)" />
                                                        </button>
                                                    </div>
                                                </div>
                                                {isExpandido && (
                                                <div className="p-4 pt-3">
                                                <div className="mb-3">
                                                    <div className="flex justify-between text-xs mb-1">
                                                        <span style={{ color: 'var(--color-muted-foreground)' }}>Itens verificados</span>
                                                        <span className="font-medium">{ok}/{total}</span>
                                                    </div>
                                                    <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden">
                                                        <div className="h-full rounded-full" style={{ width: `${total ? (ok/total)*100 : 0}%`, backgroundColor: ok===total ? '#059669' : ok>=total*0.7 ? '#D97706' : '#DC2626' }} />
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
                                                                <button onClick={() => downloadImagem(f, `checklist_${c.veiculo?.placa || c.veiculo_caminhao_placa || c.id}_${idx + 1}.jpg`)} title="Baixar foto"
                                                                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-gray-700 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                                    <Icon name="Download" size={11} color="white" />
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                                {(c.problemas || c.necessidades || c.obs_manutencao) && (
                                                    <div className="text-xs space-y-1 mb-3 p-3 rounded-lg bg-gray-50">
                                                        {c.problemas && <p><span className="font-medium text-red-600">⚠ Problemas:</span> {c.problemas}</p>}
                                                        {c.necessidades && <p><span className="font-medium text-amber-600">🔧 Necessidades:</span> {c.necessidades}</p>}
                                                        {c.obs_manutencao && <p className="p-2 rounded bg-orange-50 text-orange-700 border border-orange-100"><span className="font-medium">Manutenção:</span> {c.obs_manutencao}</p>}
                                                    </div>
                                                )}
                                                <div className="flex flex-wrap gap-2 pt-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
                                                    {!c.aprovado && (<>
                                                        <button onClick={() => handleAprovar(c)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-green-600 text-white hover:bg-green-700">
                                                            <Icon name="CheckCircle2" size={13} />Aprovar
                                                        </button>
                                                        <button onClick={() => { setModalManut(c.id); setObsManut(''); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-orange-300 text-orange-700 hover:bg-orange-50">
                                                            <Icon name="Wrench" size={13} />Registrar Manutenção
                                                        </button>
                                                    </>)}
                                                    <button onClick={() => printChecklist(c, CHECKLIST_ITENS)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border hover:bg-gray-50" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}>
                                                        <Icon name="Printer" size={13} color="var(--color-muted-foreground)" />Imprimir
                                                    </button>
                                                    <button onClick={() => openEditChecklist(c)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border hover:bg-gray-50" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}>
                                                        <Icon name="Pencil" size={13} color="var(--color-muted-foreground)" />Editar
                                                    </button>
                                                    <button onClick={() => handleDeleteChecklist(c.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-red-200 text-red-600 hover:bg-red-50 ml-auto">
                                                        <Icon name="Trash2" size={16} />Excluir
                                                    </button>
                                                </div>
                                                </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
    );
}
