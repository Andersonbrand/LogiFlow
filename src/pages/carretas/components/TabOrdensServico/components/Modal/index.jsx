import React from 'react';

import { AppIcon as Icon, PrettySelect, Button, Field, ModalHeader, ModalOverlay } from 'components';

import { inputCls, inputStyle } from '../../../../utils/constants';

// ─── modal ───
export default function Modal({ assinarComoAdmin, caminhoes, editingId, editingStatus, form, handlePdfChange, handleSalvar, mecanicos, pdfFile, profile, setAssinarComoAdmin, setEditingId, setEditingStatus, setForm, setModal, uploading, veiculos }) {
    return (
        <ModalOverlay onClose={() => { setModal(false); setEditingId(null); setEditingStatus(null); }}>
                    <ModalHeader title={editingId ? (editingStatus === 'Rascunho' ? 'Conferir Rascunho de OS' : 'Editar Ordem de Serviço') : 'Nova Ordem de Serviço'} icon="Wrench" onClose={() => { setModal(false); setEditingId(null); setEditingStatus(null); }} />
                    <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 overflow-y-auto flex-1">
                        {editingStatus === 'Rascunho' && (
                            <div className="sm:col-span-2 flex items-center gap-2 p-3 rounded-lg text-xs" style={{ backgroundColor: '#FFF7ED', border: '1px solid #FED7AA', color: '#9A3412' }}>
                                <Icon name="ClipboardCheck" size={14} color="#9A3412" />
                                Esta OS foi gerada automaticamente a partir de um checklist com manutenção registrada. Confira os dados antes de enviar.
                            </div>
                        )}
                        <Field label="Veículo" required>
                            <PrettySelect
                                value={form.veiculo_id ? `cv:${form.veiculo_id}` : (form.veiculo_caminhao_id ? `vh:${form.veiculo_caminhao_id}` : '')}
                                onChange={e => {
                                    const val = e.target.value;
                                    if (!val) { setForm(f => ({ ...f, veiculo_id: '', veiculo_caminhao_id: '' })); return; }
                                    const [tipo, id] = val.split(':');
                                    setForm(f => tipo === 'cv'
                                        ? { ...f, veiculo_id: id, veiculo_caminhao_id: '' }
                                        : { ...f, veiculo_id: '', veiculo_caminhao_id: id });
                                }}
                                className={inputCls} style={inputStyle}>
                                <option value="">Selecione...</option>
                                {veiculos.length > 0 && (
                                    <optgroup label="Frota Carretas">
                                        {veiculos.map(v => <option key={`cv:${v.id}`} value={`cv:${v.id}`}>{v.placa} — {v.modelo}</option>)}
                                    </optgroup>
                                )}
                                {caminhoes.length > 0 && (
                                    <optgroup label="Caminhões (Veículos)">
                                        {caminhoes.map(v => <option key={`vh:${v.id}`} value={`vh:${v.id}`}>{v.placa} — {v.modelo}</option>)}
                                    </optgroup>
                                )}
                            </PrettySelect>
                        </Field>
                        <Field label="Mecânico responsável">
                            <PrettySelect value={form.mecanico_id} onChange={e => setForm(f => ({ ...f, mecanico_id: e.target.value }))} className={inputCls} style={inputStyle}>
                                <option value="">Selecione...</option>
                                {mecanicos.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                            </PrettySelect>
                        </Field>
                        <Field label="Prioridade">
                            <PrettySelect value={form.prioridade} onChange={e => setForm(f => ({ ...f, prioridade: e.target.value }))} className={inputCls} style={inputStyle}>
                                <option value="Normal">Normal</option>
                                <option value="Urgente">Urgente</option>
                            </PrettySelect>
                        </Field>
                        <Field label="Tipo de manutenção">
                            <PrettySelect value={form.tipo_manutencao} onChange={e => setForm(f => ({ ...f, tipo_manutencao: e.target.value }))} className={inputCls} style={inputStyle}>
                                <option value="Corretiva">Corretiva</option>
                                <option value="Preventiva">Preventiva</option>
                            </PrettySelect>
                        </Field>
                        <Field label="KM atual do veículo">
                            <input type="number" value={form.km_atual} onChange={e => setForm(f => ({ ...f, km_atual: e.target.value }))}
                                className={inputCls} style={inputStyle} placeholder="Ex: 245800" />
                        </Field>
                        <div className="sm:col-span-2">
                            <Field label="Descrição do serviço" required>
                                <textarea value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                                    className={inputCls} style={inputStyle} rows={4}
                                    placeholder="Descreva o serviço a ser realizado..." />
                            </Field>
                        </div>
                        <div className="sm:col-span-2">
                            <Field label="Observações do serviço">
                                <textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))}
                                    className={inputCls} style={inputStyle} rows={3}
                                    placeholder="Observações adicionais sobre o serviço (opcional)..." />
                            </Field>
                        </div>
                        <div className="sm:col-span-2">
                            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                                Anexo da OS (opcional)
                            </label>
                            <label className="flex items-center gap-3 px-4 py-3 rounded-lg border-2 border-dashed cursor-pointer hover:bg-gray-50 transition-colors"
                                style={{ borderColor: pdfFile || form.pdf_url ? '#059669' : 'var(--color-border)' }}>
                                <Icon name="Upload" size={18} color={pdfFile || form.pdf_url ? '#059669' : 'var(--color-muted-foreground)'} />
                                <div>
                                    <p className="text-sm font-medium" style={{ color: pdfFile || form.pdf_url ? '#059669' : 'var(--color-text-primary)' }}>
                                        {pdfFile ? pdfFile.name : (form.pdf_url ? 'Arquivo já anexado (clique para substituir)' : 'Clique para anexar arquivo')}
                                    </p>
                                    <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>PDF, Word (.doc/.docx) ou imagem (JPG, PNG, WEBP) — máximo 8MB</p>
                                </div>
                                <input type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.heic" onChange={handlePdfChange} className="hidden" />
                            </label>
                        </div>
                        <div className="sm:col-span-2">
                            {profile?.assinatura_digital ? (
                                <label className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg cursor-pointer" style={{ backgroundColor: assinarComoAdmin ? '#EFF6FF' : 'var(--color-muted)', border: `1px solid ${assinarComoAdmin ? '#93C5FD' : 'var(--color-border)'}` }}>
                                    <input type="checkbox" checked={assinarComoAdmin} onChange={e => setAssinarComoAdmin(e.target.checked)} className="w-4 h-4" />
                                    <Icon name="PenTool" size={14} color={assinarComoAdmin ? '#1D4ED8' : 'var(--color-muted-foreground)'} />
                                    <span className="text-xs font-medium" style={{ color: assinarComoAdmin ? '#1D4ED8' : 'var(--color-text-secondary)' }}>
                                        Assinar digitalmente como responsável ({profile.assinatura_digital})
                                        {!assinarComoAdmin && form.assinatura_admin && ' — desmarcado: a assinatura será removida ao salvar'}
                                    </span>
                                </label>
                            ) : (
                                <p className="text-xs flex items-center gap-1.5" style={{ color: 'var(--color-muted-foreground)' }}>
                                    <Icon name="Info" size={12} />
                                    Você ainda não tem uma assinatura digital cadastrada. Cadastre em "Assinaturas" na barra acima.
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="flex gap-3 p-5 justify-end border-t flex-shrink-0">
                        <button onClick={() => { setModal(false); setEditingId(null); setEditingStatus(null); }} className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50" style={{ borderColor: 'var(--color-border)' }}>Cancelar</button>
                        {editingId && editingStatus === 'Rascunho' ? (
                            <>
                                <Button onClick={() => handleSalvar(false)} iconName={uploading ? 'Loader' : 'Save'} size="sm" disabled={uploading} variant="outline">
                                    {uploading ? 'Salvando...' : 'Salvar Rascunho'}
                                </Button>
                                <Button onClick={() => handleSalvar(true)} iconName={uploading ? 'Loader' : 'Send'} size="sm" disabled={uploading}>
                                    {uploading ? 'Enviando...' : 'Enviar OS'}
                                </Button>
                            </>
                        ) : (
                            <Button onClick={() => handleSalvar(false)} iconName={uploading ? 'Loader' : 'Send'} size="sm" disabled={uploading}>
                                {uploading ? 'Salvando...' : (editingId ? 'Salvar Alterações' : 'Criar OS')}
                            </Button>
                        )}
                    </div>
                </ModalOverlay>
    );
}
