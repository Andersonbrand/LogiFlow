import React, { useState, useCallback, useEffect } from 'react';

import { useToast } from 'hooks/useToast';
import { useConfirm, Button, AppIcon as Icon, Toast, Field, ModalHeader, ModalOverlay } from 'components';
import { fetchEmpresas, createEmpresa, deleteEmpresa } from 'services/carretas';
import { useRecarregarAoVoltar } from 'hooks/useRecarregarAoVoltar';

import { inputCls, inputStyle } from '../../utils/constants';

// ─── TAB: Empresas ────────────────────────────────────────────────────────────
export default function TabEmpresas({ isAdmin }) {
    const { toast, showToast } = useToast();
    const { confirm, ConfirmDialog } = useConfirm();
    const [empresas, setEmpresas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState(false);
    const [form, setForm] = useState({ nome: '', cnpj: '', observacoes: '' });

    const load = useCallback(async () => {
        setLoading(true);
        try { setEmpresas(await fetchEmpresas()); }
        catch (e) { showToast('Erro: ' + e.message, 'error'); }
        finally { setLoading(false); }
    }, []); // eslint-disable-line
    useEffect(() => { load(); }, [load]);
    useRecarregarAoVoltar(load);

    const handleSubmit = async () => {
        if (!form.nome.trim()) { showToast('Nome é obrigatório', 'error'); return; }
        try { await createEmpresa(form); showToast('Empresa cadastrada!', 'success'); setModal(false); load(); }
        catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };
    const handleDelete = async (id) => {
        const ok = await confirm({ title: 'Excluir empresa?', message: 'Esta ação não pode ser desfeita.', confirmLabel: 'Excluir', variant: 'danger' });
        if (!ok) return;
        try { await deleteEmpresa(id); showToast('Excluída!', 'success'); load(); }
        catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };

    return (
        <div>
            <div className="flex justify-end mb-5">
                {isAdmin && <Button onClick={() => { setForm({ nome: '', cnpj: '', observacoes: '' }); setModal(true); }} iconName="Plus" size="sm">Nova Empresa</Button>}
            </div>
            {loading ? <div className="flex justify-center py-12"><div className="animate-spin h-7 w-7 rounded-full border-4" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} /></div> : (
                <div className="bg-white rounded-xl border shadow-sm overflow-x-auto" style={{ borderColor: 'var(--color-border)' }}>
                    <table className="w-full text-sm min-w-[640px]">
                        <thead className="text-xs border-b" style={{ backgroundColor: 'var(--color-muted)', borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                            <tr>{['Empresa','CNPJ','Observações',''].map(h => <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>)}</tr>
                        </thead>
                        <tbody>
                            {empresas.length === 0 ? <tr><td colSpan={4} className="text-center py-12" style={{ color: 'var(--color-muted-foreground)' }}>
                                <div className="flex flex-col items-center gap-2">
                                    <Icon name="Building2" size={28} color="var(--color-muted-foreground)" />
                                    <span className="text-sm">Nenhuma empresa cadastrada</span>
                                </div>
                            </td></tr>
                            : empresas.map((e, i) => (
                                <tr key={e.id} className="border-t hover:bg-gray-50" style={{ borderColor: 'var(--color-border)', backgroundColor: i % 2 === 0 ? '#fff' : '#F8FAFC' }}>
                                    <td className="px-4 py-3 font-medium" style={{ color: 'var(--color-text-primary)' }}>{e.nome}</td>
                                    <td className="px-4 py-3 font-data text-sm" style={{ color: 'var(--color-muted-foreground)' }}>{e.cnpj || '—'}</td>
                                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-muted-foreground)' }}>{e.observacoes || '—'}</td>
                                    <td className="px-4 py-3">{isAdmin && <button onClick={() => handleDelete(e.id)} className="p-2 rounded hover:bg-red-50"><Icon name="Trash2" size={16} color="#DC2626" /></button>}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            {modal && (
                <ModalOverlay onClose={() => setModal(false)}>
                    <ModalHeader title="Nova Empresa" icon="Building2" onClose={() => setModal(false)} />
                    <div className="p-5 space-y-4 overflow-y-auto flex-1">
                        <Field label="Nome da empresa" required><input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} className={inputCls} style={inputStyle} placeholder="Comercial Araguaia" /></Field>
                        <Field label="CNPJ"><input value={form.cnpj} onChange={e => setForm(f => ({ ...f, cnpj: e.target.value }))} className={inputCls} style={inputStyle} placeholder="00.000.000/0000-00" /></Field>
                        <Field label="Observações"><textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} className={inputCls} style={inputStyle} rows={2} /></Field>
                    </div>
                    <div className="flex gap-3 p-5 justify-end border-t flex-shrink-0">
                        <button onClick={() => setModal(false)} className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50" style={{ borderColor: 'var(--color-border)' }}>Cancelar</button>
                        <Button onClick={handleSubmit} size="sm" iconName="Check">Salvar</Button>
                    </div>
                </ModalOverlay>
            )}
            <Toast toast={toast} />
            {ConfirmDialog}
        </div>
    );
}
