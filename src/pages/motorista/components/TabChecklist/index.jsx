import React from 'react';

import { PrettySelect, AppIcon as Icon } from 'components';
import { contarItensOk, CHECKLIST_ITENS, itemIsOk, itemLabelOf, itemObsOf } from 'services/carretas';

import { inputStyle } from '../../utils/constants';
import { FMT } from '../../utils/helpers';

// ─── tab === 'checklist' ───
export default function TabChecklist({ abrirEdicaoCheck, checklistItens, checklists, excluirCheck, filtroPlaca, setFiltroPlaca, veiculos }) {
    return (
        <div className="flex flex-col gap-4">
                                            {veiculos.length > 0 && (
                                                <PrettySelect value={filtroPlaca} onChange={e => setFiltroPlaca(e.target.value)}
                                                    className="px-3 py-2 rounded-lg border text-sm self-start" style={inputStyle}>
                                                    <option value="">Todas as placas</option>
                                                    {veiculos.map(v => <option key={v.id} value={v.id}>{v.placa} — {v.modelo}</option>)}
                                                </PrettySelect>
                                            )}
                                            {checklists.filter(c => !filtroPlaca || String(c.veiculo_caminhao_id) === filtroPlaca).length === 0
                                                ? <div className="bg-white rounded-xl border p-8 flex flex-col items-center justify-center gap-2" style={{ borderColor: 'var(--color-border)' }}><Icon name="ClipboardCheck" size={28} color="var(--color-muted-foreground)" /><span className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Nenhum checklist enviado</span></div>
                                                : checklists.filter(c => !filtroPlaca || String(c.veiculo_caminhao_id) === filtroPlaca).map(c => {
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
                                                                    <p className="font-medium text-sm" style={{ color: 'var(--color-text-primary)' }}>{c.veiculo?.placa || c.veiculo_caminhao_placa || '—'}</p>
                                                                    <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>Semana de {c.semana_ref ? FMT(c.semana_ref) : '—'}</p>
                                                                </div>
                                                                <div className="flex items-center gap-1">
                                                                    {c.aprovado
                                                                        ? <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700"><Icon name="CheckCircle2" size={11} />Aprovado</span>
                                                                        : <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700"><Icon name="Clock" size={11} />Pendente</span>
                                                                    }
                                                                    <button onClick={() => abrirEdicaoCheck(c)} className="p-1.5 rounded-lg hover:bg-gray-100" title="Editar">
                                                                        <Icon name="Pencil" size={14} color="var(--color-muted-foreground)" />
                                                                    </button>
                                                                    <button onClick={() => excluirCheck(c)} className="p-1.5 rounded-lg hover:bg-red-50" title="Excluir">
                                                                        <Icon name="Trash2" size={14} color="#DC2626" />
                                                                    </button>
                                                                </div>
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
                                                            {c.obs_manutencao && (
                                                                <p className="text-xs mt-2 p-2 rounded-lg bg-orange-50 text-orange-700 border border-orange-100">🔧 {c.obs_manutencao}</p>
                                                            )}
                                                        </div>
                                                    );
                                                })
                                            }
                                        </div>
    );
}
