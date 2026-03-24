'use client';

import React, { useState, useEffect, useRef } from 'react';
import AppIcon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { COMPANIES, COMPANY_ORDER, CompanyId } from '@/context/CompanyContext';
import { Product } from '@/lib/supabase';
import toast from 'react-hot-toast';

interface Props {
    product: Product | null;
    categories: string[];
    onSave: () => void;
    onClose: () => void;
}

const UNITS = ['saco', 'barra 12m', 'barra 6m', 'cento', 'kg', 'par', 'painel 6x2,4m',
               'chapa 3x1,2m', 'metro', 'unidade', 'rolo', 'peça', 'caixa', 'litro'];
const DEFAULT_CATEGORIES = ['Cimento', 'Vergalhões', 'Ferragens', 'Serralheria'];

type FormData = Omit<Product, 'id' | 'created_at' | 'updated_at'>;
type ImageMode = 'upload' | 'url';

export default function ProductModal({ product, categories, onSave, onClose }: Props) {
    const supabase      = createClient();
    const allCategories = Array.from(new Set([...DEFAULT_CATEGORIES, ...categories]));

    const [form, setForm]             = useState<FormData>({
        name: '', category: allCategories[0] ?? 'Cimento',
        description: '', image_url: null, price: 0, unit: UNITS[0], stock: 0, is_active: true, companies: ['araguaia'],
    });
    const [imageMode, setImageMode]   = useState<ImageMode>('upload');
    const [urlInput, setUrlInput]     = useState('');
    const [uploading, setUploading]   = useState(false);
    const [saving, setSaving]         = useState(false);
    const [preview, setPreview]       = useState<string | null>(null);
    // Nova categoria: digitação em tempo real → já atualiza form.category
    const [showNewCat, setShowNewCat] = useState(false);
    const [newCat, setNewCat]         = useState('');
    const fileRef                     = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (product) {
            const { id: _id, created_at: _c, updated_at: _u, ...rest } = product;
            // Garantir que companies é array
            const formData = { ...rest };
            if ((formData as any).company && !(formData as any).companies) {
              (formData as any).companies = [(formData as any).company];
            }
            if (!(formData as any).companies) (formData as any).companies = ['araguaia'];
            setForm(formData);
            setPreview(rest.image_url);
            if (rest.image_url) setUrlInput(rest.image_url);
        }
    }, [product]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        if (name === 'category' && value === '__new__') {
            setShowNewCat(true);
            setNewCat('');
            return;
        }
        setForm((prev) => ({
            ...prev,
            [name]: type === 'checkbox'
                ? (e.target as HTMLInputElement).checked
                : (name === 'price' || name === 'stock') ? parseFloat(value) || 0 : value,
        }));
    };

    // Nova categoria: atualiza form.category em tempo real enquanto digita
    const handleNewCatChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setNewCat(val);
        // Persiste no form em tempo real
        setForm((prev) => ({ ...prev, category: val }));
    };

    const confirmNewCat = () => {
        if (!newCat.trim()) return;
        setForm((prev) => ({ ...prev, category: newCat.trim() }));
        setShowNewCat(false);
    };

    const cancelNewCat = () => {
        setShowNewCat(false);
        setNewCat('');
        setForm((prev) => ({ ...prev, category: allCategories[0] ?? 'Cimento' }));
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) { toast.error('Arquivo muito grande. Máximo 5MB.'); return; }
        setUploading(true);
        try {
            const ext      = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
            const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
            const { error } = await supabase.storage.from('product-images').upload(filename, file, { cacheControl: '3600', upsert: true });
            if (error) throw error;
            const { data } = supabase.storage.from('product-images').getPublicUrl(filename);
            setForm((prev) => ({ ...prev, image_url: data.publicUrl }));
            setPreview(data.publicUrl);
            toast.success('Imagem enviada!');
        } catch (err: any) {
            toast.error(err?.message ?? 'Erro ao enviar imagem.');
        } finally {
            setUploading(false);
        }
    };

    const handleUrlApply = () => {
        if (!urlInput.trim()) return;
        setForm((prev) => ({ ...prev, image_url: urlInput.trim() }));
        setPreview(urlInput.trim());
        toast.success('URL aplicada!');
    };

    const handleRemoveImage = () => {
        setForm((prev) => ({ ...prev, image_url: null }));
        setPreview(null);
        setUrlInput('');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name.trim()) { toast.error('Nome é obrigatório.'); return; }
        if (!form.category.trim()) { toast.error('Categoria é obrigatória.'); return; }
        setSaving(true);
        try {
            const payload = {
                ...form,
                price: Number(form.price),
                stock: Number(form.stock),
                companies: (form as any).companies ?? ['araguaia'],
            };
            if (product) {
                const { error } = await supabase.from('products')
                    .update({ ...payload, updated_at: new Date().toISOString() })
                    .eq('id', product.id);
                if (error) throw error;
                toast.success('Produto atualizado!');
            } else {
                const { error } = await supabase.from('products').insert([payload]);
                if (error) throw error;
                toast.success('Produto cadastrado!');
            }
            onSave();
        } catch (err: any) {
            toast.error(err?.message ?? 'Erro ao salvar produto.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 modal-backdrop z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-4xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-red-xl border border-border">
                {/* Header */}
                <div className="sticky top-0 bg-white border-b border-border px-8 py-5 flex items-center justify-between rounded-t-4xl z-10">
                    <div>
                        <h2 className="text-xl font-bold text-foreground">{product ? 'Editar Produto' : 'Novo Produto'}</h2>
                        <p className="text-[11px] text-muted uppercase tracking-widest">{product ? 'Atualize as informações' : 'Preencha os dados'}</p>
                    </div>
                    <button onClick={onClose} className="w-10 h-10 rounded-xl bg-surface hover:bg-border transition-colors flex items-center justify-center">
                        <AppIcon name="XMarkIcon" size={18} className="text-muted" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-6">
                    {/* Imagem */}
                    <div className="space-y-3">
                        <label className="text-[10px] uppercase tracking-[0.25em] font-bold text-muted block">Imagem do Produto</label>
                        <div className="flex gap-2 p-1 bg-surface rounded-xl w-fit">
                            {(['upload', 'url'] as ImageMode[]).map((mode) => (
                                <button key={mode} type="button" onClick={() => setImageMode(mode)}
                                    className={`px-4 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-widest transition-all ${imageMode === mode ? 'bg-white text-primary shadow-sm' : 'text-muted'}`}>
                                    {mode === 'upload' ? '📁 Upload' : '🔗 URL'}
                                </button>
                            ))}
                        </div>
                        <div className="relative w-full h-44 rounded-2xl border-2 border-dashed border-border overflow-hidden bg-surface flex items-center justify-center">
                            {preview ? (
                                <>
                                    <img src={preview} alt="Preview" className="w-full h-full object-cover"
                                        onError={() => { setPreview(null); toast.error('Imagem inválida.'); }} />
                                    <button type="button" onClick={handleRemoveImage}
                                        className="absolute top-3 right-3 w-8 h-8 rounded-xl bg-white/90 border border-border text-muted hover:text-primary flex items-center justify-center shadow-sm">
                                        <AppIcon name="XMarkIcon" size={16} />
                                    </button>
                                </>
                            ) : (
                                <div className="text-center px-4">
                                    {uploading ? (
                                        <div className="space-y-2">
                                            <svg className="animate-spin h-8 w-8 text-primary mx-auto" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                                            </svg>
                                            <p className="text-sm text-muted">Enviando...</p>
                                        </div>
                                    ) : (
                                        <>
                                            <AppIcon name="PhotoIcon" size={36} className="text-muted mx-auto mb-2" />
                                            <p className="text-sm text-muted font-medium">Nenhuma imagem</p>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                        {imageMode === 'upload' && (
                            <>
                                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleFileUpload} className="hidden" />
                                <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                                    className="w-full py-3 rounded-xl border-2 border-dashed border-primary/30 text-primary text-sm font-bold hover:bg-primary/5 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                                    <AppIcon name="ArrowUpTrayIcon" size={18} />
                                    {uploading ? 'Enviando...' : 'Clique para selecionar (PNG, JPG, WEBP · máx 5MB)'}
                                </button>
                            </>
                        )}
                        {imageMode === 'url' && (
                            <div className="flex gap-2">
                                <input type="url" value={urlInput} onChange={(e) => setUrlInput(e.target.value)}
                                    placeholder="https://exemplo.com/imagem.jpg"
                                    className="flex-1 px-4 py-3 rounded-xl border border-border bg-white text-sm focus:outline-none focus:border-primary transition-colors" />
                                <button type="button" onClick={handleUrlApply}
                                    className="px-5 py-3 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary-dark transition-all">
                                    Aplicar
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Nome */}
                    <div>
                        <label className="text-[10px] uppercase tracking-[0.25em] font-bold text-muted block mb-2">Nome do Produto *</label>
                        <input type="text" name="name" value={form.name} onChange={handleChange}
                            placeholder="Ex: Cimento CP-II 50kg — Votoran" required
                            className="w-full px-4 py-3 rounded-xl border border-border bg-white text-sm focus:outline-none focus:border-primary transition-colors" />
                    </div>

                    {/* Categoria + Unidade */}
                    <div className="grid grid-cols-2 gap-5">
                        <div>
                            <label className="text-[10px] uppercase tracking-[0.25em] font-bold text-muted block mb-2">Categoria *</label>
                            {showNewCat ? (
                                <div className="space-y-2">
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={newCat}
                                            onChange={handleNewCatChange}
                                            placeholder="Nome da categoria"
                                            autoFocus
                                            className="flex-1 px-3 py-3 rounded-xl border-2 border-primary/40 bg-white text-sm focus:outline-none focus:border-primary transition-colors font-medium"
                                        />
                                        <button type="button" onClick={confirmNewCat}
                                            className="px-3 py-3 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary-dark transition-all"
                                            title="Confirmar categoria">
                                            <AppIcon name="CheckIcon" size={16} />
                                        </button>
                                        <button type="button" onClick={cancelNewCat}
                                            className="px-3 py-3 rounded-xl bg-surface border border-border text-muted text-sm hover:bg-border transition-all"
                                            title="Cancelar">
                                            <AppIcon name="XMarkIcon" size={16} />
                                        </button>
                                    </div>
                                    {/* Preview em tempo real */}
                                    {newCat.trim() && (
                                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/8 border border-primary/20">
                                            <AppIcon name="TagIcon" size={14} className="text-primary" />
                                            <span className="text-[12px] font-bold text-primary">
                                                Categoria: <span className="text-foreground">{newCat}</span>
                                            </span>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <select name="category" value={form.category} onChange={handleChange}
                                    className="w-full px-4 py-3 rounded-xl border border-border bg-white text-sm focus:outline-none focus:border-primary transition-colors">
                                    {allCategories.map((c) => <option key={c} value={c}>{c}</option>)}
                                    <option value="__new__">+ Nova categoria</option>
                                </select>
                            )}
                        </div>
                        <div>
                            <label className="text-[10px] uppercase tracking-[0.25em] font-bold text-muted block mb-2">Unidade *</label>
                            <select name="unit" value={form.unit} onChange={handleChange}
                                className="w-full px-4 py-3 rounded-xl border border-border bg-white text-sm focus:outline-none focus:border-primary transition-colors">
                                {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Preço + Estoque */}
                    <div className="grid grid-cols-2 gap-5">
                        <div>
                            <label className="text-[10px] uppercase tracking-[0.25em] font-bold text-muted block mb-2">Preço (R$)</label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted text-sm font-bold">R$</span>
                                <input type="number" name="price" value={form.price || ''} onChange={handleChange}
                                    step="0.01" min="0" placeholder="0,00"
                                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-border bg-white text-sm focus:outline-none focus:border-primary transition-colors" />
                            </div>
                            <p className="text-[10px] text-muted mt-1">Deixe 0 se o preço for sob consulta</p>
                        </div>
                        <div>
                            <label className="text-[10px] uppercase tracking-[0.25em] font-bold text-muted block mb-2">Estoque *</label>
                            <input type="number" name="stock" value={form.stock || ''} onChange={handleChange} min="0" placeholder="0"
                                className="w-full px-4 py-3 rounded-xl border border-border bg-white text-sm focus:outline-none focus:border-primary transition-colors" />
                        </div>
                    </div>

                    {/* Descrição */}
                    <div>
                        <label className="text-[10px] uppercase tracking-[0.25em] font-bold text-muted block mb-2">Descrição / Especificações</label>
                        <textarea name="description" value={form.description ?? ''} onChange={handleChange} rows={3}
                            placeholder="Especificações técnicas, marca, características..."
                            className="w-full px-4 py-3 rounded-xl border border-border bg-white text-sm focus:outline-none focus:border-primary transition-colors resize-none" />
                    </div>

                    {/* Empresas — seleção múltipla */}
                    <div>
                        <label className="block text-[11px] uppercase tracking-widest font-bold text-muted mb-1">
                            Empresas que vendem este produto
                        </label>
                        <p className="text-[10px] text-muted mb-2">Selecione uma ou mais empresas do Grupo HC</p>
                        <div className="grid grid-cols-3 gap-2">
                            {COMPANY_ORDER.map((id) => {
                                const co = COMPANIES[id];
                                const companies = (form as any).companies as string[] ?? [];
                                const isSelected = companies.includes(id);
                                return (
                                    <button key={id} type="button"
                                        onClick={() => {
                                            const cur = (form as any).companies as string[] ?? [];
                                            const next = isSelected
                                                ? cur.filter((x: string) => x !== id)
                                                : [...cur, id];
                                            setForm(prev => ({ ...prev, companies: next.length ? next : [id] }));
                                        }}
                                        className="flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl border-2 transition-all relative"
                                        style={{
                                            borderColor: isSelected ? co.primaryColor : '#dde3ed',
                                            backgroundColor: isSelected ? co.bgLight : 'white',
                                        }}>
                                        {isSelected && (
                                            <span className="absolute top-1.5 right-1.5 w-3.5 h-3.5 rounded-full flex items-center justify-center text-white text-[8px] font-bold"
                                                style={{ backgroundColor: co.primaryColor }}>✓</span>
                                        )}
                                        <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: co.primaryColor }} />
                                        <span className="text-[11px] font-bold leading-tight text-center" style={{ color: isSelected ? co.primaryColor : '#9ca3af' }}>{co.shortName}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Ativo */}
                    <div className="flex items-center justify-between p-4 rounded-xl bg-surface border border-border">
                        <div>
                            <p className="text-sm font-bold text-foreground">Produto ativo</p>
                            <p className="text-[11px] text-muted">Exibir no catálogo público</p>
                        </div>
                        <button type="button" onClick={() => setForm((prev) => ({ ...prev, is_active: !prev.is_active }))}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.is_active ? 'bg-primary' : 'bg-border'}`}>
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${form.is_active ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                    </div>

                    {/* Ações */}
                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={onClose}
                            className="flex-1 py-3.5 rounded-xl border border-border text-sm font-bold text-foreground hover:bg-surface transition-colors">
                            Cancelar
                        </button>
                        <button type="submit" disabled={saving || uploading}
                            className="flex-1 py-3.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary-dark transition-all shadow-red-lg disabled:opacity-60 flex items-center justify-center gap-2">
                            {saving
                                ? <><svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Salvando...</>
                                : <><AppIcon name="CheckIcon" size={16} />{product ? 'Salvar Alterações' : 'Cadastrar Produto'}</>}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
