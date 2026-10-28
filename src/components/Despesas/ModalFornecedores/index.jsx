import React, { useState, useEffect } from 'react';

import { useToast } from 'hooks/useToast';
import { useConfirm, Button, AppIcon as Icon, PrettySelect, Toast, ModalHeader, ModalOverlay, Field } from 'components';
import { fetchFornecedores as fetchFornecedoresCaminhoes, updateFornecedor as updateFornecedorCaminhao, createFornecedor as createFornecedorCaminhao, deleteFornecedor as deleteFornecedorCaminhao } from 'services/fornecedoresService';

import { inputCls, inputStyle } from '../utils/constants';

// ─── Página Principal ─────────────────────────────────────────────────────────
export default function ModalFornecedores({ config, onClose, onSelect }) {
    const { toast, showToast } = useToast();
    const { confirm, ConfirmDialog } = useConfirm();
    const [fornecedores, setFornecedores] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState(null);
    const [busca, setBusca] = useState('');
    const [form, setForm] = useState({ nome: '', cnpj: '', telefone: '', email: '', endereco: '', categoria: '', observacoes: '' });

    const load = async () => {
        try { setFornecedores(await fetchFornecedoresCaminhoes()); }
        catch (e) { showToast('Erro: ' + e.message, 'error'); }
        finally { setLoading(false); }
    };
    useEffect(() => { load(); }, []); // eslint-disable-line

    const handleSave = async () => {
        if (!form.nome.trim()) { showToast('Nome é obrigatório', 'error'); return; }
        // Normaliza: nome sempre presente; campos opcionais em branco viram null
        // (evita salvar strings vazias no banco e mantém consistência entre telas)
        const payload = {
            nome: form.nome.trim(),
            cnpj: form.cnpj.trim() || null,
            telefone: form.telefone.trim() || null,
            email: form.email.trim() || null,
            endereco: form.endereco.trim() || null,
            categoria: form.categoria || null,
            observacoes: form.observacoes.trim() || null,
        };
        try {
            if (modal?.mode === 'edit') await updateFornecedorCaminhao(modal.data.id, payload);
            else await createFornecedorCaminhao(payload);
            showToast('Fornecedor salvo!', 'success');
            setModal(null);
            load();
        } catch (e) {
            const msg = e.code === '23505' || /duplicate key|unique constraint/i.test(e.message)
                ? 'Já existe um fornecedor cadastrado com este CNPJ.'
                : 'Erro: ' + e.message;
            showToast(msg, 'error');
        }
    };

    const handleDelete = async (id) => {
        const ok = await confirm({ title: 'Excluir fornecedor?', message: 'Esta ação não pode ser desfeita.', confirmLabel: 'Excluir', variant: 'danger' });
        if (!ok) return;
        try { await deleteFornecedorCaminhao(id); showToast('Excluído!', 'success'); load(); }
        catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };

    const filtrados = fornecedores.filter(f => !busca || f.nome.toLowerCase().includes(busca.toLowerCase()) || (f.cnpj || '').includes(busca));

    return (
        <ModalOverlay onClose={onClose} wide>
            <ModalHeader title="Fornecedores" icon="Building2" onClose={onClose} />
            <div className="flex items-center gap-3 px-5 py-3 border-b shrink-0" style={{ borderColor: 'var(--color-border)' }}>
                <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por nome ou CNPJ..."
                    className={inputCls + ' flex-1'} style={inputStyle} />
                <Button onClick={() => { setForm({ nome: '', cnpj: '', telefone: '', email: '', endereco: '', categoria: '', observacoes: '' }); setModal({ mode: 'create' }); }} iconName="Plus" size="sm">
                    Novo
                </Button>
            </div>
            <div className="flex-1 overflow-y-auto">
                {loading ? (
                    <div className="flex justify-center py-12"><div className="animate-spin h-7 w-7 rounded-full border-4" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} /></div>
                ) : filtrados.length === 0 ? (
                    <div className="text-center py-12 text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
                        {busca ? 'Nenhum fornecedor encontrado' : 'Nenhum fornecedor cadastrado'}
                    </div>
                ) : (
                    <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
                        {filtrados.map(f => (
                            <div key={f.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
                                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: '#EFF6FF' }}>
                                    <Icon name="Building2" size={16} color="#1D4ED8" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm truncate" style={{ color: 'var(--color-text-primary)' }}>{f.nome}</p>
                                    <div className="flex items-center gap-3 flex-wrap">
                                        {f.cnpj && <span className="text-xs font-data" style={{ color: 'var(--color-muted-foreground)' }}>{f.cnpj}</span>}
                                        {f.telefone && <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>{f.telefone}</span>}
                                        {f.categoria && <span className="text-xs px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">{f.categoria}</span>}
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                    {onSelect && (
                                        <button onClick={() => { onSelect(f); onClose(); }}
                                            className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors">
                                            Selecionar
                                        </button>
                                    )}
                                    <button onClick={() => { setForm({ nome: f.nome, cnpj: f.cnpj || '', telefone: f.telefone || '', email: f.email || '', endereco: f.endereco || '', categoria: f.categoria || '', observacoes: f.observacoes || '' }); setModal({ mode: 'edit', data: f }); }}
                                        className="p-1.5 rounded hover:bg-blue-50 transition-colors"><Icon name="Pencil" size={16} color="#1D4ED8" /></button>
                                    <button onClick={() => handleDelete(f.id)}
                                        className="p-1.5 rounded hover:bg-red-50 transition-colors"><Icon name="Trash2" size={16} color="#DC2626" /></button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            {modal && (
                <div className="border-t p-5 space-y-3 shrink-0" style={{ borderColor: 'var(--color-border)' }}>
                    <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                        {modal.mode === 'create' ? 'Novo Fornecedor' : 'Editar Fornecedor'}
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                        <Field label="Nome" required className="col-span-2">
                            <input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} className={inputCls} style={inputStyle} placeholder="Razão social ou nome" />
                        </Field>
                        <Field label="CNPJ">
                            <input value={form.cnpj} onChange={e => setForm(f => ({ ...f, cnpj: e.target.value }))} className={inputCls} style={inputStyle} placeholder="00.000.000/0000-00" />
                        </Field>
                        <Field label="Telefone">
                            <input value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} className={inputCls} style={inputStyle} placeholder="(00) 00000-0000" />
                        </Field>
                        <Field label="E-mail">
                            <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className={inputCls} style={inputStyle} placeholder="contato@empresa.com" />
                        </Field>
                        <Field label="Categoria habitual">
                            <PrettySelect value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))} className={inputCls} style={inputStyle}>
                                <option value="">Selecione...</option>
                                {config.categoriasPadrao.map(c => <option key={c} value={c}>{c}</option>)}
                            </PrettySelect>
                        </Field>
                        <Field label="Endereço" className="col-span-2">
                            <input value={form.endereco} onChange={e => setForm(f => ({ ...f, endereco: e.target.value }))} className={inputCls} style={inputStyle} placeholder="Rua, número, cidade" />
                        </Field>
                    </div>
                    <div className="flex gap-2 justify-end pt-1">
                        <button onClick={() => setModal(null)} className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50" style={{ borderColor: 'var(--color-border)' }}>Cancelar</button>
                        <Button onClick={handleSave} size="sm" iconName="Check">Salvar</Button>
                    </div>
                </div>
            )}
            <Toast toast={toast} />
            {ConfirmDialog}
        </ModalOverlay>
    );
}
