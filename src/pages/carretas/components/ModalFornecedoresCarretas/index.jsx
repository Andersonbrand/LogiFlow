import React, { useState, useEffect } from 'react';

import { useToast } from 'hooks/useToast';
import { useConfirm, AppIcon as Icon, PrettySelect, Button, Toast, ModalHeader, ModalOverlay } from 'components';
import { fetchFornecedores as fetchFornecedoresCarretas, updateFornecedor as updateFornecedorCarretas, createFornecedor as createFornecedorCarretas, deleteFornecedor as deleteFornecedorCarretas } from 'services/fornecedoresService';
import { CATEGORIAS_DESPESA } from 'services/carretas';

import { inputCls, inputStyle } from '../../utils/constants';

// ─── TAB: Despesas Extras (por veículo) ──────────────────────────────────────

// ─── Modal de Cadastro de Fornecedores (Carretas) ─────────────────────────────
export default function ModalFornecedoresCarretas({ onClose, onSelect }) {
    const { toast, showToast } = useToast();
    const { confirm, ConfirmDialog } = useConfirm();
    const [fornecedores, setFornecedores] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState(null); // null | {mode:'create'|'edit', data?}
    const [busca, setBusca] = useState('');
    const emptyForm = { nome: '', cnpj: '', telefone: '', email: '', endereco: '', categoria: '', observacoes: '' };
    const [form, setForm] = useState(emptyForm);

    const load = async () => {
        try { setFornecedores(await fetchFornecedoresCarretas()); }
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
            if (modal?.mode === 'edit') await updateFornecedorCarretas(modal.data.id, payload);
            else await createFornecedorCarretas(payload);
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
        try { await deleteFornecedorCarretas(id); showToast('Excluído!', 'success'); load(); }
        catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };

    const filtrados = fornecedores.filter(f =>
        !busca || f.nome.toLowerCase().includes(busca.toLowerCase()) || (f.cnpj || '').includes(busca)
    );

    return (
        <ModalOverlay onClose={onClose} wide>
            <ModalHeader title="Fornecedores" icon="Building2" onClose={onClose} />

                {/* Search + New */}
                <div className="flex items-center gap-3 px-5 py-3 border-b shrink-0" style={{ borderColor: 'var(--color-border)' }}>
                    <input value={busca} onChange={e => setBusca(e.target.value)}
                        placeholder="Buscar por nome ou CNPJ..."
                        className={inputCls + ' flex-1'} style={inputStyle} />
                    <button onClick={() => { setForm(emptyForm); setModal({ mode: 'create' }); }}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-white"
                        style={{ backgroundColor: 'var(--color-primary)' }}>
                        <Icon name="Plus" size={13} color="white" /> Novo
                    </button>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="flex justify-center py-12"><div className="animate-spin h-7 w-7 rounded-full border-4" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} /></div>
                    ) : filtrados.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-2" style={{ color: 'var(--color-muted-foreground)' }}>
                            <Icon name="Building2" size={32} color="var(--color-muted-foreground)" />
                            <span className="text-sm">{busca ? 'Nenhum fornecedor encontrado' : 'Nenhum fornecedor cadastrado ainda'}</span>
                        </div>
                    ) : (
                        <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
                            {filtrados.map(f => (
                                <div key={f.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
                                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: '#EFF6FF' }}>
                                        <Icon name="Building2" size={15} color="#1D4ED8" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-sm truncate" style={{ color: 'var(--color-text-primary)' }}>{f.nome}</p>
                                        <div className="flex items-center gap-3 flex-wrap mt-0.5">
                                            {f.cnpj && <span className="text-xs font-data" style={{ color: 'var(--color-muted-foreground)' }}>{f.cnpj}</span>}
                                            {f.telefone && <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>{f.telefone}</span>}
                                            {f.categoria && <span className="text-xs px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700">{f.categoria}</span>}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                        {onSelect && (
                                            <button onClick={() => { onSelect(f); onClose(); }}
                                                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white"
                                                style={{ backgroundColor: 'var(--color-primary)' }}>
                                                Selecionar
                                            </button>
                                        )}
                                        <button onClick={() => { setForm({ nome: f.nome, cnpj: f.cnpj||'', telefone: f.telefone||'', email: f.email||'', endereco: f.endereco||'', categoria: f.categoria||'', observacoes: f.observacoes||'' }); setModal({ mode: 'edit', data: f }); }}
                                            className="p-2 rounded hover:bg-blue-50"><Icon name="Pencil" size={16} color="#1D4ED8" /></button>
                                        <button onClick={() => handleDelete(f.id)}
                                            className="p-2 rounded hover:bg-red-50"><Icon name="Trash2" size={16} color="#DC2626" /></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Inline form */}
                {modal && (
                    <div className="border-t p-5 space-y-3 shrink-0" style={{ borderColor: 'var(--color-border)' }}>
                        <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                            {modal.mode === 'create' ? 'Novo Fornecedor' : 'Editar Fornecedor'}
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="col-span-2">
                                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Nome *</label>
                                <input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} className={inputCls} style={inputStyle} placeholder="Razão social ou nome fantasia" autoFocus />
                            </div>
                            <div>
                                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>CNPJ</label>
                                <input value={form.cnpj} onChange={e => setForm(f => ({ ...f, cnpj: e.target.value }))} className={inputCls} style={inputStyle} placeholder="00.000.000/0000-00" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Telefone</label>
                                <input value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} className={inputCls} style={inputStyle} placeholder="(00) 00000-0000" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>E-mail</label>
                                <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className={inputCls} style={inputStyle} placeholder="contato@empresa.com" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Categoria habitual</label>
                                <PrettySelect value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))} className={inputCls} style={inputStyle}>
                                    <option value="">Selecione...</option>
                                    {CATEGORIAS_DESPESA.map(c => <option key={c} value={c}>{c}</option>)}
                                </PrettySelect>
                            </div>
                            <div className="col-span-2">
                                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Endereço</label>
                                <input value={form.endereco} onChange={e => setForm(f => ({ ...f, endereco: e.target.value }))} className={inputCls} style={inputStyle} placeholder="Rua, número, cidade" />
                            </div>
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
