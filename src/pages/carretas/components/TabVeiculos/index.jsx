import React, { useState, useCallback, useEffect, useMemo } from 'react';

import { useToast } from 'hooks/useToast';
import { useConfirm, Button, AppIcon as Icon, PrettySelect, Toast, Field, ModalHeader, ModalOverlay, SearchInput } from 'components';
import { fetchCarretasVeiculos, createCarretaVeiculo, updateCarretaVeiculo, deleteCarretaVeiculo } from 'services/carretas';
import { useRecarregarAoVoltar } from 'hooks/useRecarregarAoVoltar';

import { inputCls, inputStyle } from '../../utils/constants';

const TIPO_COMPOSICAO = ['Cavalo + Carreta', 'Truck', 'Toco', 'Bitrem', 'Outro'];

// ─── TAB: Veículos ────────────────────────────────────────────────────────────
export default function TabVeiculos({ isAdmin }) {
    const { toast, showToast } = useToast();
    const { confirm, ConfirmDialog } = useConfirm();
    const [veiculos, setVeiculos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState(null);
    const [form, setForm] = useState({ placa: '', marca: '', modelo: '', ano_fabricacao: '', tipo_composicao: 'Cavalo + Carreta', capacidade_carga: '', media_consumo: '', capacidade_tanque: '', observacoes: '', is_terceiro: false });

    const load = useCallback(async () => {
        setLoading(true);
        try { setVeiculos(await fetchCarretasVeiculos()); }
        catch (e) { showToast('Erro: ' + e.message, 'error'); }
        finally { setLoading(false); }
    }, []); // eslint-disable-line
    useEffect(() => { load(); }, [load]);
    useRecarregarAoVoltar(load);

    const openCreate = () => {
        setForm({ placa: '', marca: '', modelo: '', ano_fabricacao: '', tipo_composicao: 'Cavalo + Carreta', capacidade_carga: '', media_consumo: '', capacidade_tanque: '', observacoes: '', is_terceiro: false });
        setModal({ mode: 'create' });
    };
    const openEdit = (v) => {
        setForm({ placa: v.placa, marca: v.marca, modelo: v.modelo, ano_fabricacao: v.ano_fabricacao || '', tipo_composicao: v.tipo_composicao || 'Cavalo + Carreta', capacidade_carga: v.capacidade_carga || '', media_consumo: v.media_consumo || '', capacidade_tanque: v.capacidade_tanque || '', observacoes: v.observacoes || '', is_terceiro: v.is_terceiro || false });
        setModal({ mode: 'edit', data: v });
    };
    const handleSubmit = async () => {
        if (!form.placa || !form.marca || !form.modelo) { showToast('Placa, marca e modelo são obrigatórios', 'error'); return; }
        try {
            // Campos integer: converter string vazia para null para evitar erro no banco
            const payload = {
                ...form,
                ano_fabricacao:    form.ano_fabricacao    !== '' ? Number(form.ano_fabricacao)    : null,
                capacidade_carga:  form.capacidade_carga  !== '' ? Number(form.capacidade_carga)  : null,
                capacidade_tanque: form.capacidade_tanque !== '' ? Number(form.capacidade_tanque) : null,
                media_consumo:     form.media_consumo     !== '' ? Number(form.media_consumo)     : null,
            };
            if (modal.mode === 'create') await createCarretaVeiculo(payload);
            else await updateCarretaVeiculo(modal.data.id, payload);
            showToast('Veículo salvo!', 'success'); setModal(null); load();
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };
    const handleDelete = async (id) => {
        const ok = await confirm({ title: 'Excluir veículo?', message: 'Esta ação não pode ser desfeita.', confirmLabel: 'Excluir', variant: 'danger' });
        if (!ok) return;
        try { await deleteCarretaVeiculo(id); showToast('Excluído!', 'success'); load(); }
        catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };

    const [pesquisa, setPesquisa] = useState('');
    const veiculosFiltrados = useMemo(() => {
        if (!pesquisa.trim()) return veiculos;
        const q = pesquisa.toLowerCase();
        return veiculos.filter(v =>
            (v.placa || '').toLowerCase().includes(q) ||
            (v.marca || '').toLowerCase().includes(q) ||
            (v.modelo || '').toLowerCase().includes(q) ||
            (v.tipo_composicao || '').toLowerCase().includes(q)
        );
    }, [veiculos, pesquisa]);

    return (
        <div>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                <SearchInput value={pesquisa} onChange={setPesquisa} placeholder="Buscar por placa, marca, modelo..." width="280px" />
                {isAdmin && <Button onClick={openCreate} iconName="Plus" size="sm">Novo Veículo</Button>}
            </div>
            {loading ? <div className="flex justify-center py-16"><div className="animate-spin h-7 w-7 rounded-full border-4" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} /></div> : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {veiculosFiltrados.length === 0 ? (
                        <div className="col-span-3 flex flex-col items-center justify-center py-12 gap-2" style={{ color: 'var(--color-muted-foreground)' }}>
                            <Icon name="Truck" size={32} color="var(--color-muted-foreground)" />
                            <span className="text-sm">{pesquisa ? `Nenhum resultado para "${pesquisa}"` : 'Nenhum veículo cadastrado'}</span>
                        </div>
                    ) : veiculosFiltrados.map(v => (
                        <div key={v.id} className="bg-white rounded-xl border p-4 shadow-sm hover:shadow-md transition-shadow" style={{ borderColor: v.is_terceiro ? '#FDE68A' : 'var(--color-border)' }}>
                            <div className="flex items-start justify-between mb-3">
                                <div>
                                    <p className="font-bold text-lg font-data" style={{ color: 'var(--color-text-primary)' }}>{v.placa}</p>
                                    <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>{v.marca} {v.modelo} {v.ano_fabricacao ? `(${v.ano_fabricacao})` : ''}</p>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                    <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: '#EFF6FF', color: '#1D4ED8' }}>{v.tipo_composicao}</span>
                                    {v.is_terceiro && <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ backgroundColor: '#FEF3C7', color: '#D97706' }}>Terceirizado</span>}
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-xs mb-3">
                                {v.capacidade_carga && <div><p className="text-gray-400">Carga</p><p className="font-medium">{v.capacidade_carga} t</p></div>}
                                {v.media_consumo && <div><p className="text-gray-400">Consumo</p><p className="font-medium">{v.media_consumo} km/l</p></div>}
                                {v.capacidade_tanque && <div><p className="text-gray-400">Tanque</p><p className="font-medium">{v.capacidade_tanque} L</p></div>}
                            </div>
                            {isAdmin && (
                                <div className="flex gap-2 pt-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
                                    <button onClick={() => openEdit(v)} className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded"><Icon name="Pencil" size={16} />Editar</button>
                                    <button onClick={() => handleDelete(v.id)} className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-red-500 hover:bg-red-50 rounded"><Icon name="Trash2" size={16} />Excluir</button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
            {modal && (
                <ModalOverlay onClose={() => setModal(null)}>
                    <ModalHeader title={modal.mode === 'create' ? 'Novo Veículo' : 'Editar Veículo'} icon="Truck" onClose={() => setModal(null)} />
                    <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 overflow-y-auto flex-1">
                        <Field label="Placa" required><input value={form.placa} onChange={e => setForm(f => ({ ...f, placa: e.target.value.toUpperCase() }))} className={inputCls} style={inputStyle} placeholder="ABC-1234" /></Field>
                        <Field label="Marca" required><input value={form.marca} onChange={e => setForm(f => ({ ...f, marca: e.target.value }))} className={inputCls} style={inputStyle} placeholder="Volvo, Scania..." /></Field>
                        <Field label="Modelo" required><input value={form.modelo} onChange={e => setForm(f => ({ ...f, modelo: e.target.value }))} className={inputCls} style={inputStyle} placeholder="FH 540..." /></Field>
                        <Field label="Ano de fabricação"><input type="number" value={form.ano_fabricacao} onChange={e => setForm(f => ({ ...f, ano_fabricacao: e.target.value }))} className={inputCls} style={inputStyle} placeholder="2020" /></Field>
                        <Field label="Tipo de composição">
                            <PrettySelect value={form.tipo_composicao} onChange={e => setForm(f => ({ ...f, tipo_composicao: e.target.value }))} className={inputCls} style={inputStyle}>
                                {TIPO_COMPOSICAO.map(t => <option key={t} value={t}>{t}</option>)}
                            </PrettySelect>
                        </Field>
                        <Field label="Cap. carga (t)"><input type="number" step="0.1" value={form.capacidade_carga} onChange={e => setForm(f => ({ ...f, capacidade_carga: e.target.value }))} className={inputCls} style={inputStyle} placeholder="30" /></Field>
                        <Field label="Média consumo (km/l)"><input type="number" step="0.1" value={form.media_consumo} onChange={e => setForm(f => ({ ...f, media_consumo: e.target.value }))} className={inputCls} style={inputStyle} placeholder="2.5" /></Field>
                        <Field label="Cap. tanque (L)"><input type="number" step="1" value={form.capacidade_tanque} onChange={e => setForm(f => ({ ...f, capacidade_tanque: e.target.value }))} className={inputCls} style={inputStyle} placeholder="600" /></Field>
                        <div className="sm:col-span-2">
                            <Field label="Observações"><textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} className={inputCls} style={inputStyle} rows={2} /></Field>
                        </div>
                        {/* Veículo Terceirizado */}
                        <div className="sm:col-span-2">
                            <div className="flex items-center gap-3 p-3 rounded-xl border" style={{ borderColor: '#FDE68A', backgroundColor: '#FFFBEB' }}>
                                <button
                                    type="button"
                                    onClick={() => setForm(f => ({ ...f, is_terceiro: !f.is_terceiro }))}
                                    className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0"
                                    style={{ backgroundColor: form.is_terceiro ? '#D97706' : '#D1D5DB' }}>
                                    <span className="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform"
                                        style={{ transform: form.is_terceiro ? 'translateX(20px)' : 'translateX(4px)' }} />
                                </button>
                                <div>
                                    <p className="text-xs font-semibold" style={{ color: '#92400E' }}>Veículo Terceirizado</p>
                                    <p className="text-xs" style={{ color: '#B45309' }}>Volume registrado separadamente, sem gerar bonificações</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-3 p-5 justify-end border-t flex-shrink-0">
                        <button onClick={() => setModal(null)} className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50" style={{ borderColor: 'var(--color-border)' }}>Cancelar</button>
                        <Button onClick={handleSubmit} size="sm" iconName="Check">Salvar</Button>
                    </div>
                </ModalOverlay>
            )}
            <Toast toast={toast} />
            {ConfirmDialog}
        </div>
    );
}
