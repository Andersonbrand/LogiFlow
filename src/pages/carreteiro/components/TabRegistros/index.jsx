import React from 'react';

import { AppIcon as Icon, parseParadas } from 'components';
import { deleteRomaneio } from 'services/carretas';

import { FMT_DATE } from '../../utils/helpers';

// ─── tab === 'registros' ───
export default function TabRegistros({ confirm, emptyRegistro, handleDeleteRegistro, handleEditRegistro, registrosFiltrados, romaneiosFerragemFiltrados, seletorPlaca, setEditandoFerragemId, setEditandoRegistroId, setFormFerragem, setFormRegistro, setModalFerragem, setModalRegistro, setParadasFerragem, setParadasRegistro, setRomaneiosFerragem, showToast }) {
    return (
        <div>
                                            {seletorPlaca && <div className="flex justify-end mb-3">{seletorPlaca}</div>}
                                            {/* Dois botões de ação separados */}
                                            <div className="grid grid-cols-1 gap-3 mb-5">
                                                <button onClick={() => { setEditandoRegistroId(null); setFormRegistro(emptyRegistro()); setParadasRegistro([]); setModalRegistro(true); }}
                                                    className="flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all hover:shadow-md active:scale-[0.99]"
                                                    style={{ borderColor: '#BFDBFE', backgroundColor: '#EFF6FF' }}>
                                                    <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#1D4ED8' }}>
                                                        <Icon name="Package" size={22} color="white" />
                                                    </div>
                                                    <div className="flex-1">
                                                        <p className="font-bold text-sm" style={{ color: '#1D4ED8' }}>Registrar Viagem de Cimento</p>
                                                        <p className="text-xs mt-0.5" style={{ color: '#3B82F6' }}>Nota fiscal, placa, destino e data de descarga</p>
                                                    </div>
                                                    <Icon name="ChevronRight" size={18} color="#1D4ED8" />
                                                </button>
                                                <button onClick={() => { setFormFerragem({ numero_romaneio: '', numero_nf: '', veiculo_id: '', data_saida: new Date().toISOString().split('T')[0], destino: '', toneladas: '', empresa: '', observacoes: '' }); setParadasFerragem([]); setModalFerragem(true); }}
                                                    className="flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all hover:shadow-md active:scale-[0.99]"
                                                    style={{ borderColor: '#D1FAE5', backgroundColor: '#ECFDF5' }}>
                                                    <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#059669' }}>
                                                        <Icon name="FileText" size={22} color="white" />
                                                    </div>
                                                    <div className="flex-1">
                                                        <p className="font-bold text-sm" style={{ color: '#065F46' }}>Registrar Romaneio de Ferragens</p>
                                                        <p className="text-xs mt-0.5" style={{ color: '#059669' }}>NF, placa, destino, peso e empresa</p>
                                                    </div>
                                                    <Icon name="ChevronRight" size={18} color="#059669" />
                                                </button>
                                            </div>

                                            {registrosFiltrados.length > 0 && (
                                                <div>
                                                    <p className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: 'var(--color-muted-foreground)' }}>Viagens de Cimento</p>
                                                    <div className="flex flex-col gap-2">
                                                        {registrosFiltrados.map(r => (
                                                            <div key={r.id} className="bg-white rounded-xl border p-4 shadow-sm" style={{ borderColor: r.local_carregamento === 'Estoque' ? '#FDE68A' : 'var(--color-border)' }}>
                                                                <div className="flex items-start justify-between mb-2">
                                                                    <div>
                                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                                            <p className="font-semibold text-sm" style={{ color: 'var(--color-text-primary)' }}>{r.destino || '—'}</p>
                                                                            {r.local_carregamento === 'Estoque' && (
                                                                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}>
                                                                                    📦 Estoque
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        <p className="text-xs font-data" style={{ color: 'var(--color-muted-foreground)' }}>{r.veiculo?.placa || '—'}</p>
                                                                    </div>
                                                                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
                                                                        {r.data_carregamento ? new Date(r.data_carregamento + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}
                                                                    </span>
                                                                </div>
                                                                <div className="flex flex-wrap gap-3 text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                                                                    {r.local_carregamento === 'Estoque'
                                                                        ? (r.tipo_cimento && <span>Cimento: <strong>{r.tipo_cimento}</strong></span>)
                                                                        : <>
                                                                            {r.numero_nota_fiscal && <span>NF: <strong>{r.numero_nota_fiscal}</strong></span>}
                                                                            {r.data_descarga && <span>Descarga: <strong>{new Date(r.data_descarga + 'T00:00:00').toLocaleDateString('pt-BR')}</strong></span>}
                                                                        </>}
                                                                </div>
                                                                {r.observacoes && <p className="text-xs mt-2 text-gray-500">{r.observacoes}</p>}
                                                                <div className="flex justify-end gap-2 mt-3 pt-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
                                                                    <button onClick={() => handleDeleteRegistro(r.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-red-200 text-red-600 hover:bg-red-50">
                                                                        <Icon name="Trash2" size={16} />Excluir
                                                                    </button>
                                                                    <button onClick={() => handleEditRegistro(r)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-blue-200 text-blue-600 hover:bg-blue-50">
                                                                        <Icon name="Pencil" size={16} />Editar
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* ── Romaneios de Ferragem lançados pelo motorista — editáveis aqui ── */}
                                            {romaneiosFerragemFiltrados.length > 0 && (
                                                <div className="mt-4">
                                                    <p className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: 'var(--color-muted-foreground)' }}>Romaneios de Ferragem</p>
                                                    <div className="flex flex-col gap-2">
                                                        {romaneiosFerragemFiltrados.map(r => (
                                                            <div key={r.id} className="bg-white rounded-xl border shadow-sm overflow-hidden" style={{ borderColor: '#FDE68A' }}>
                                                                <div className="flex items-center justify-between px-4 py-2.5 border-b" style={{ backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }}>
                                                                    <div className="flex items-center gap-2">
                                                                        <Icon name="Wrench" size={13} color="#D97706" />
                                                                        <span className="text-xs font-semibold font-data" style={{ color: '#D97706' }}>
                                                                            Romaneio #{r.numero || '—'}
                                                                        </span>
                                                                        <span className="text-xs px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}>
                                                                            Ferragem
                                                                        </span>
                                                                    </div>
                                                                    <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: '#F3F4F6', color: '#6B7280' }}>
                                                                        {r.status || 'Aguardando'}
                                                                    </span>
                                                                </div>
                                                                <div className="p-4">
                                                                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-3">
                                                                        {r.numero_nf && <div><p className="text-xs mb-0.5" style={{ color: 'var(--color-muted-foreground)' }}>Nota Fiscal</p><p className="text-sm font-semibold font-data">{r.numero_nf}</p></div>}
                                                                        {r.data_saida && <div><p className="text-xs mb-0.5" style={{ color: 'var(--color-muted-foreground)' }}>Data Saída</p><p className="text-sm font-medium font-data">{FMT_DATE(r.data_saida)}</p></div>}
                                                                        {r.toneladas && <div><p className="text-xs mb-0.5" style={{ color: 'var(--color-muted-foreground)' }}>Toneladas</p><p className="text-sm font-semibold font-data" style={{ color: '#7C3AED' }}>{Number(r.toneladas).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} ton</p></div>}
                                                                        {r.empresa && <div><p className="text-xs mb-0.5" style={{ color: 'var(--color-muted-foreground)' }}>Empresa</p><p className="text-sm font-medium">{r.empresa}</p></div>}
                                                                        {r.destino && <div className="col-span-2"><p className="text-xs mb-0.5" style={{ color: 'var(--color-muted-foreground)' }}>Destino</p><div className="flex items-center gap-1.5"><Icon name="MapPin" size={12} color="#D97706" /><p className="text-sm font-medium">{r.destino}</p></div></div>}
                                                                    </div>
                                                                    <div className="flex justify-end gap-2 pt-3 border-t" style={{ borderColor: '#FDE68A' }}>
                                                                        <button
                                                                            onClick={async () => {
                                                                                const ok = await confirm({
                                                                                    title: 'Excluir romaneio?',
                                                                                    message: 'Esta ação não pode ser desfeita.',
                                                                                    confirmLabel: 'Excluir',
                                                                                    variant: 'danger',
                                                                                });
                                                                                if (!ok) return;
                                                                                try {
                                                                                    await deleteRomaneio(r.id);
                                                                                    showToast('Romaneio excluído!', 'success');
                                                                                    setRomaneiosFerragem(prev => prev.filter(x => x.id !== r.id));
                                                                                } catch (e) { showToast('Erro: ' + e.message, 'error'); }
                                                                            }}
                                                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-red-200 text-red-600 hover:bg-red-50">
                                                                            <Icon name="Trash2" size={16} />Excluir
                                                                        </button>
                                                                        <button
                                                                            onClick={() => {
                                                                                setEditandoFerragemId(r.id);
                                                                                setFormFerragem({
                                                                                    numero_nf:   r.numero_nf || '',
                                                                                    veiculo_id:  r.veiculo_id || '',
                                                                                    data_saida:  r.data_saida || new Date().toISOString().split('T')[0],
                                                                                    destino:     r.destino || '',
                                                                                    toneladas:   r.toneladas ? String(r.toneladas) : '',
                                                                                    empresa:     r.empresa || '',
                                                                                    observacoes: r.observacoes || '',
                                                                                });
                                                                                setParadasFerragem(parseParadas(r.paradas));
                                                                                setModalFerragem(true);
                                                                            }}
                                                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-amber-200 text-amber-700 hover:bg-amber-50">
                                                                            <Icon name="Pencil" size={16} />Editar
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {registrosFiltrados.length === 0 && romaneiosFerragemFiltrados.length === 0 && (
                                                <div className="bg-white rounded-xl border p-8 flex flex-col items-center justify-center gap-2" style={{ borderColor: 'var(--color-border)' }}>
                                                    <Icon name="Navigation" size={28} color="var(--color-muted-foreground)" />
                                                    <span className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Nenhuma viagem registrada</span>
                                                </div>
                                            )}
                                        </div>
    );
}
