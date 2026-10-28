import React, { useState, useEffect,  } from 'react';


import { useToast } from 'hooks/useToast';
import { useConfirm, AppIcon as Icon, PrettySelect, ChecklistItemsField, MultiFotoField, Toast, Field } from 'components';
import {   } from 'services/romaneio';
import {                     } from 'services/carretas';
import {  } from 'services/supabaseClient';
import { } from 'services/vehicleService';
import { useRecarregarAoVoltar } from 'hooks/useRecarregarAoVoltar';
import { } from 'utils/excel';

import { inputStyle } from '../../utils/constants';
import { } from './utils/helpers';
import TabAbastecimentos from './components/TabAbastecimentos';
import TabChecklist from './components/TabChecklist';
import TabDiarias from './components/TabDiarias';
import { inputCls } from './utils/constants';
import ModalAbastEdit from './components/ModalAbastEdit';
import ModalFoto from './components/ModalFoto';
import ModalDiaria from './components/ModalDiaria';
import ViewDiaria from './components/ViewDiaria';
import { usePainelMotoristaDados, usePainelMotoristaDiarias, usePainelMotoristaAbastecimento, usePainelMotoristaChecklist, usePainelMotoristaManutencao, useExportPainelMotorista } from './hooks';

// ─── Painel de dados por motorista ────────────────────────────────────────────
export default function PainelMotorista({ motorista, adminProfile, onClose }) {
    const { toast, showToast } = useToast();
    const { confirm, ConfirmDialog } = useConfirm();
    const [tab, setTab]         = useState('abastecimentos');
    const { loading, mes, setMes, periodoCustom, setPeriodoCustom, usarPeriodo, setUsarPeriodo, abast, checklists, diarias, setDiarias, romaneiosDiarias, setRomaneiosDiarias, veiculosCaminhao, postos, configAbast, checklistItens, load, totaisAbast, totalDiariasAvulsas, totalDiariasRomaneios, totalDiarias } = usePainelMotoristaDados({ motorista, showToast });
    
     
    
    
    
    const { modalManut, setModalManut, obsManut, setObsManut, handleAprovar, handleManutencao } = usePainelMotoristaManutencao({ adminProfile, checklists, load, showToast });
    
    const { modalFoto, setModalFoto, expandidosChecklist, toggleExpandidoChecklist, modalEditChecklist, setModalEditChecklist, formEditChecklist, setFormEditChecklist, savingEditChecklist, handleDeleteChecklist, openEditChecklist, handleSalvarEditChecklist } = usePainelMotoristaChecklist({ confirm, load, showToast, veiculosCaminhao }); 
    
    // Navegação por teclado no visualizador de fotos: ← → pra trocar, Esc pra fechar
    useEffect(() => {
        if (!modalFoto) return;
        const onKey = (e) => {
            if (e.key === 'ArrowLeft') setModalFoto(m => m && ({ ...m, index: (m.index - 1 + m.fotos.length) % m.fotos.length }));
            else if (e.key === 'ArrowRight') setModalFoto(m => m && ({ ...m, index: (m.index + 1) % m.fotos.length }));
            else if (e.key === 'Escape') setModalFoto(null);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [modalFoto]);
    const { modalDiaria, setModalDiaria, viewDiaria, setViewDiaria, assinando, canSign, meuCampoAssinatura, handleAssinarDiaria, isAdminUser, handleDesassinarDiaria, formDiaria, setFormDiaria, previewDiaria, handleSaveDiaria, handleDeleteDiaria, handleDeleteRomaneio, openCreateDiaria, openEditDiaria } = usePainelMotoristaDiarias({ adminProfile, confirm, load, mes, motorista, periodoCustom, setDiarias, setMes, setRomaneiosDiarias, setUsarPeriodo, showToast, usarPeriodo });
    
    
    
    
    
    
    
    
    
    
    const { modalAbastEdit, setModalAbastEdit, formAbastEdit, setFormAbastEdit, savingAbastEdit, getPrecoAbast, handlePostoAbastChange, handleLitrosAbast, openEditAbastecimento, openNovoAbastecimento, handleSaveAbastecimento, handleDeleteAbastecimento } = usePainelMotoristaAbastecimento({ configAbast, confirm, load, motorista, postos, showToast, veiculosCaminhao }); 
    
    
    
    
     
    
     
    useRecarregarAoVoltar(load);

    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    const { exportar, exportarRomaneioComoDialia } = useExportPainelMotorista({ abast, checklists, diarias, mes, motorista, romaneiosDiarias, showToast, tab });
    
    
    const TABS_P = [
        { id: 'abastecimentos', label: 'Abastecimentos', icon: 'Fuel',           count: abast.length },
        { id: 'checklist',      label: 'Checklist',      icon: 'ClipboardCheck', count: checklists.length },
        { id: 'diarias',        label: 'Diárias',        icon: 'CalendarDays',   count: diarias.length + romaneiosDiarias.length },
    ];

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)' }}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">

                {/* Header */}
                <div className="flex flex-col xs:flex-row xs:items-center xs:justify-between gap-3 px-4 sm:px-6 py-4 border-b flex-shrink-0"
                    style={{ borderColor: 'var(--color-border)', backgroundColor: '#F8FAFC' }}>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center text-white font-bold text-base sm:text-lg flex-shrink-0"
                            style={{ background: 'linear-gradient(135deg, #1D4ED8, #7C3AED)' }}>
                            {motorista.name[0]?.toUpperCase()}
                        </div>
                        <div>
                            <h2 className="font-heading font-bold text-base sm:text-xl" style={{ color: 'var(--color-text-primary)' }}>{motorista.name}</h2>
                            <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Motorista · Caminhão</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap xs:flex-nowrap">
                        <input type="month" value={mes} onChange={e => { setMes(e.target.value); setUsarPeriodo(false); }}
                            className="px-3 py-1.5 rounded-lg border text-sm flex-1 xs:flex-none" style={inputStyle} />
                        <button type="button" onClick={() => setUsarPeriodo(v => !v)}
                            className="px-2 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap flex-shrink-0"
                            style={usarPeriodo
                                ? { backgroundColor: '#EFF6FF', color: '#1D4ED8', borderColor: '#BFDBFE' }
                                : { borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                            {usarPeriodo ? '✓ Período' : 'Período'}
                        </button>
                        {usarPeriodo && (
                            <>
                                <input type="date" value={periodoCustom.inicio} onChange={e => setPeriodoCustom(p => ({ ...p, inicio: e.target.value }))}
                                    className="px-2 py-1.5 rounded-lg border text-sm flex-shrink-0" style={inputStyle} title="Data inicial" />
                                <input type="date" value={periodoCustom.fim} onChange={e => setPeriodoCustom(p => ({ ...p, fim: e.target.value }))}
                                    className="px-2 py-1.5 rounded-lg border text-sm flex-shrink-0" style={inputStyle} title="Data final" />
                            </>
                        )}
                        <button onClick={load} className="p-2 rounded-lg border hover:bg-gray-50 flex-shrink-0" style={{ borderColor: 'var(--color-border)' }} title="Atualizar">
                            <Icon name="RefreshCw" size={14} color="var(--color-muted-foreground)" />
                        </button>
                        <button onClick={exportar} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium hover:bg-gray-50 flex-shrink-0" style={{ borderColor: 'var(--color-border)' }}>
                            <Icon name="FileDown" size={13} /> Exportar
                        </button>
                        <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 flex-shrink-0 ml-auto xs:ml-0">
                            <Icon name="X" size={20} color="var(--color-muted-foreground)" />
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b flex-shrink-0 overflow-x-auto" style={{ borderColor: 'var(--color-border)' }}>
                    {TABS_P.map(t => (
                        <button key={t.id} onClick={() => setTab(t.id)}
                            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${tab === t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                            <Icon name={t.icon} size={15} color="currentColor" />
                            {t.label}
                            {t.count > 0 && (
                                <span className="text-xs px-1.5 py-0.5 rounded-full font-bold"
                                    style={{ backgroundColor: tab === t.id ? '#DBEAFE' : '#F1F5F9', color: tab === t.id ? '#1D4ED8' : '#6B7280' }}>
                                    {t.count}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Conteúdo */}
                <div className="flex-1 overflow-y-auto p-6">
                    {loading ? (
                        <div className="flex justify-center py-16">
                            <div className="animate-spin h-8 w-8 rounded-full border-4" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
                        </div>
                    ) : (
                        <>
                            {/* ── Abastecimentos ── */}
                            {tab === 'abastecimentos' && (
                                <TabAbastecimentos abast={abast} handleDeleteAbastecimento={handleDeleteAbastecimento} openEditAbastecimento={openEditAbastecimento} openNovoAbastecimento={openNovoAbastecimento} totaisAbast={totaisAbast} />
                            )}

                            {/* ── Checklist ── */}
                            {tab === 'checklist' && (
                                <TabChecklist
                    checklists={checklists}
                    expandidosChecklist={expandidosChecklist}
                    handleAprovar={handleAprovar}
                    handleDeleteChecklist={handleDeleteChecklist}
                    openEditChecklist={openEditChecklist}
                    setModalFoto={setModalFoto}
                    setModalManut={setModalManut}
                    setObsManut={setObsManut}
                    toggleExpandidoChecklist={toggleExpandidoChecklist}
                />
                            )}

                            {/* ── Diárias ── */}
                            {tab === 'diarias' && (
                                <TabDiarias
                    diarias={diarias}
                    exportarRomaneioComoDialia={exportarRomaneioComoDialia}
                    handleDeleteDiaria={handleDeleteDiaria}
                    handleDeleteRomaneio={handleDeleteRomaneio}
                    mes={mes}
                    motorista={motorista}
                    openCreateDiaria={openCreateDiaria}
                    openEditDiaria={openEditDiaria}
                    romaneiosDiarias={romaneiosDiarias}
                    setViewDiaria={setViewDiaria}
                    totalDiarias={totalDiarias}
                    totalDiariasAvulsas={totalDiariasAvulsas}
                    totalDiariasRomaneios={totalDiariasRomaneios}
                />
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Modal manutenção */}
            {modalManut && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)' }}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
                        <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: 'var(--color-border)' }}>
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-orange-50"><Icon name="Wrench" size={18} color="#D97706" /></div>
                                <h3 className="font-bold text-base" style={{ color: 'var(--color-text-primary)' }}>Registrar Manutenção</h3>
                            </div>
                            <button onClick={() => setModalManut(null)} className="p-1.5 rounded-lg hover:bg-gray-100"><Icon name="X" size={18} color="var(--color-muted-foreground)" /></button>
                        </div>
                        <div className="p-5">
                            <Field label="Descreva a manutenção necessária" required>
                                <textarea value={obsManut} onChange={e => setObsManut(e.target.value)} className={inputCls} style={inputStyle} rows={4} placeholder="Detalhes da manutenção..." />
                            </Field>
                        </div>
                        <div className="flex gap-3 p-5 pt-0 justify-end">
                            <button onClick={() => setModalManut(null)} className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50" style={{ borderColor: 'var(--color-border)' }}>Cancelar</button>
                            <button onClick={handleManutencao} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-orange-600 hover:bg-orange-700">
                                <Icon name="Wrench" size={14} color="white" /> Registrar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal edição de checklist */}
            {modalEditChecklist && formEditChecklist && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)' }}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden max-h-[85vh]">
                        <div className="flex items-center justify-between p-5 border-b flex-shrink-0" style={{ borderColor: 'var(--color-border)' }}>
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-blue-50"><Icon name="ClipboardCheck" size={18} color="#1D4ED8" /></div>
                                <h3 className="font-bold text-base" style={{ color: 'var(--color-text-primary)' }}>Editar Checklist</h3>
                            </div>
                            <button onClick={() => { setModalEditChecklist(null); setFormEditChecklist(null); }} className="p-1.5 rounded-lg hover:bg-gray-100"><Icon name="X" size={18} color="var(--color-muted-foreground)" /></button>
                        </div>
                        <div className="p-5 space-y-4 overflow-y-auto flex-1 min-h-0">
                            <div className="grid grid-cols-2 gap-3">
                                <Field label="Veículo (placa)" required>
                                    <PrettySelect value={formEditChecklist.veiculo_caminhao_id} onChange={e => setFormEditChecklist(f => ({ ...f, veiculo_caminhao_id: e.target.value }))} className={inputCls} style={inputStyle}>
                                        <option value="">Selecione...</option>
                                        {veiculosCaminhao.map(v => <option key={v.id} value={v.id}>{v.placa} — {v.modelo}</option>)}
                                    </PrettySelect>
                                </Field>
                                <Field label="Odômetro (km)" required>
                                    <input type="number" inputMode="decimal" min="0" value={formEditChecklist.odometro}
                                        onChange={e => setFormEditChecklist(f => ({ ...f, odometro: e.target.value }))}
                                        placeholder="Ex: 152340" className={inputCls} style={inputStyle} />
                                </Field>
                            </div>
                            <div>
                                <p className="text-xs font-medium mb-3" style={{ color: 'var(--color-text-secondary)' }}>Itens verificados</p>
                                <ChecklistItemsField itens={checklistItens} value={formEditChecklist.itens} onChange={itens => setFormEditChecklist(f => ({ ...f, itens }))} />
                            </div>
                            <Field label="Problemas encontrados">
                                <textarea value={formEditChecklist.problemas} onChange={e => setFormEditChecklist(f => ({ ...f, problemas: e.target.value }))} className={inputCls} style={inputStyle} rows={2} />
                            </Field>
                            <Field label="Necessidades / peças">
                                <textarea value={formEditChecklist.necessidades} onChange={e => setFormEditChecklist(f => ({ ...f, necessidades: e.target.value }))} className={inputCls} style={inputStyle} rows={2} />
                            </Field>
                            <Field label="Observações">
                                <textarea value={formEditChecklist.observacoes_livres} onChange={e => setFormEditChecklist(f => ({ ...f, observacoes_livres: e.target.value }))} className={inputCls} style={inputStyle} rows={2} />
                            </Field>
                            <div>
                                <p className="text-xs font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>Fotos</p>
                                <MultiFotoField value={formEditChecklist.fotos_urls} onChange={fotos_urls => setFormEditChecklist(f => ({ ...f, fotos_urls }))} />
                            </div>
                        </div>
                        <div className="flex gap-3 p-5 pt-4 justify-end border-t flex-shrink-0" style={{ borderColor: 'var(--color-border)' }}>
                            <button onClick={() => { setModalEditChecklist(null); setFormEditChecklist(null); }} className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50" style={{ borderColor: 'var(--color-border)' }}>Cancelar</button>
                            <button onClick={handleSalvarEditChecklist} disabled={savingEditChecklist} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60" style={{ backgroundColor: 'var(--color-primary)' }}>
                                <Icon name="Check" size={14} color="white" /> {savingEditChecklist ? 'Salvando...' : 'Salvar Alterações'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal edição de abastecimento */}
            {modalAbastEdit && (
                <ModalAbastEdit
                    configAbast={configAbast}
                    formAbastEdit={formAbastEdit}
                    getPrecoAbast={getPrecoAbast}
                    handleLitrosAbast={handleLitrosAbast}
                    handlePostoAbastChange={handlePostoAbastChange}
                    handleSaveAbastecimento={handleSaveAbastecimento}
                    modalAbastEdit={modalAbastEdit}
                    postos={postos}
                    savingAbastEdit={savingAbastEdit}
                    setFormAbastEdit={setFormAbastEdit}
                    setModalAbastEdit={setModalAbastEdit}
                    veiculosCaminhao={veiculosCaminhao}
                />
            )}

            {/* Modal foto */}
            {modalFoto && (
                <ModalFoto modalFoto={modalFoto} setModalFoto={setModalFoto} />
            )}

            {/* Modal diária */}
            {modalDiaria && (
                <ModalDiaria
                    formDiaria={formDiaria}
                    handleSaveDiaria={handleSaveDiaria}
                    modalDiaria={modalDiaria}
                    previewDiaria={previewDiaria}
                    setFormDiaria={setFormDiaria}
                    setModalDiaria={setModalDiaria}
                    veiculosCaminhao={veiculosCaminhao}
                />
            )}

            <Toast toast={toast} />
            {ConfirmDialog}
            {viewDiaria && (
                <ViewDiaria
                    adminProfile={adminProfile}
                    assinando={assinando}
                    canSign={canSign}
                    handleAssinarDiaria={handleAssinarDiaria}
                    handleDesassinarDiaria={handleDesassinarDiaria}
                    isAdminUser={isAdminUser}
                    meuCampoAssinatura={meuCampoAssinatura}
                    setViewDiaria={setViewDiaria}
                    showToast={showToast}
                    viewDiaria={viewDiaria}
                />
            )}
        </div>
    );
}
