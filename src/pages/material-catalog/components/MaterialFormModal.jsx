import React, { useState, useEffect } from 'react';
import Icon from 'components/AppIcon';
import Button from 'components/ui/Button';
import { FRETE_CATEGORIAS, fmtPct, detectarCategoriaFrete } from 'utils/freteConfig';

const UNIDADES = ['kg', 'un', 'cx', 'm', 'm²', 'm³', 'l', 'pc', 'SC', 'BR', 'RL', 'MT', 'KG', 'PC'];
const CATEGORIAS_PRODUTO = [
    'Construção', 'Ferragens', 'Tubos e Perfis', 'Chapas', 'Telhas',
    'Treliças e Colunas', 'Cimento', 'Arames e Pregos', 'Elétrico',
    'Hidráulico', 'Químico', 'Outros',
];

const EMPTY = { nome: '', categoria: 'Construção', unidade: 'kg', peso: '', categoria_frete: '', percentual_frete: '', is_telha_zinco: false, peso_base_metro: '3.80' };

export default function MaterialFormModal({ isOpen, onClose, onSave, editingMaterial }) {
    const [form, setForm]       = useState(EMPTY);
    const [errors, setErrors]   = useState({});
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        if (editingMaterial) {
            setForm({
                nome:             editingMaterial.nome            || '',
                categoria:        editingMaterial.categoria       || 'Construção',
                unidade:          editingMaterial.unidade         || 'kg',
                peso:             String(editingMaterial.peso     || ''),
                categoria_frete:  editingMaterial.categoria_frete || '',
                percentual_frete: editingMaterial.percentual_frete != null
                                    ? String(Number(editingMaterial.percentual_frete) * 100) : '',
                is_telha_zinco:   editingMaterial.is_telha_zinco  || false,
                peso_base_metro:  editingMaterial.peso_base_metro != null ? String(editingMaterial.peso_base_metro) : '3.80',
            });
        } else { setForm(EMPTY); }
        setErrors({});
    }, [isOpen, editingMaterial]);

    const set = (k, v) => {
        setForm(prev => {
            const next = { ...prev, [k]: v };
            if (k === 'nome') {
                const cat = detectarCategoriaFrete(v);
                const cfg = FRETE_CATEGORIAS.find(f => f.categoria === cat);
                next.categoria_frete = cat;
                next.percentual_frete = cfg ? String(cfg.percentual * 100) : '';
            }
            if (k === 'categoria_frete') {
                const cfg = FRETE_CATEGORIAS.find(f => f.categoria === v);
                if (cfg) next.percentual_frete = String(cfg.percentual * 100);
            }
            return next;
        });
        setErrors(prev => ({ ...prev, [k]: '' }));
    };

    const validate = () => {
        const e = {};
        if (!form.nome.trim()) e.nome = 'Nome é obrigatório';
        if (!form.peso || isNaN(Number(form.peso)) || Number(form.peso) <= 0)
            e.peso = 'Informe um peso válido maior que zero';
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleSubmit = async () => {
        if (!validate()) return;
        setLoading(true);
        try {
            const pctRaw = form.percentual_frete !== '' ? Number(form.percentual_frete) / 100 : null;
            await onSave({
                ...(editingMaterial?.id ? { id: editingMaterial.id } : {}),
                nome: form.nome.trim(), categoria: form.categoria,
                unidade: form.unidade, peso: Number(form.peso),
                categoria_frete:   form.categoria_frete   || null,
                percentual_frete:  pctRaw,
                is_telha_zinco:    form.is_telha_zinco,
                peso_base_metro:   form.is_telha_zinco ? Number(form.peso_base_metro) || 3.80 : null,
            });
            onClose();
        } catch (err) {
            alert('Erro ao salvar: ' + (err.message || 'Verifique sua conexão.'));
        } finally { setLoading(false); }
    };

    if (!isOpen) return null;
    const catFreteConfig = FRETE_CATEGORIAS.find(f => f.categoria === form.categoria_frete);

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40" onClick={onClose} />
            <div className="relative bg-white rounded-2xl shadow-modal w-full max-w-lg">
                <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center rounded-lg" style={{ width:36, height:36, backgroundColor:'var(--color-primary)' }}>
                            <Icon name="Package" size={18} color="#fff" />
                        </div>
                        <div>
                            <h2 className="font-heading font-bold text-lg" style={{ color:'var(--color-text-primary)' }}>
                                {editingMaterial ? 'Editar Material' : 'Novo Material'}
                            </h2>
                            <p className="text-xs font-caption" style={{ color:'var(--color-muted-foreground)' }}>Preencha as informações</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="rounded-lg p-2 hover:bg-gray-100"><Icon name="X" size={18} color="var(--color-muted-foreground)" /></button>
                </div>

                <div className="px-6 py-5 flex flex-col gap-4 max-h-[70vh] overflow-y-auto">
                    <div>
                        <label className="block text-xs font-medium font-caption mb-1.5" style={{ color:'var(--color-text-primary)' }}>Nome do Material *</label>
                        <input value={form.nome} onChange={e => set('nome', e.target.value)} placeholder="Ex: VERGALHAO 1/2 GERDAU"
                            className={`w-full h-10 px-3 rounded-lg border text-sm focus:outline-none bg-white uppercase ${errors.nome ? 'border-red-400':'border-gray-200'}`} />
                        {errors.nome && <p className="text-xs mt-1 text-red-500">{errors.nome}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-medium font-caption mb-1.5" style={{ color:'var(--color-text-primary)' }}>Categoria do Produto</label>
                            <select value={form.categoria} onChange={e => set('categoria', e.target.value)}
                                className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none bg-white">
                                {CATEGORIAS_PRODUTO.map(c => <option key={c}>{c}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium font-caption mb-1.5" style={{ color:'var(--color-text-primary)' }}>Unidade</label>
                            <select value={form.unidade} onChange={e => set('unidade', e.target.value)}
                                className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none bg-white">
                                {UNIDADES.map(u => <option key={u}>{u}</option>)}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-medium font-caption mb-1.5" style={{ color:'var(--color-text-primary)' }}>Peso por Unidade (kg) *</label>
                        <input type="number" min="0.001" step="0.001" value={form.peso} onChange={e => set('peso', e.target.value)} placeholder="Ex: 11.55"
                            className={`w-full h-10 px-3 rounded-lg border text-sm font-data focus:outline-none bg-white ${errors.peso ? 'border-red-400':'border-gray-200'}`} />
                        {errors.peso && <p className="text-xs mt-1 text-red-500">{errors.peso}</p>}
                    </div>

                    {/* Telha de Zinco */}
                    <div className="rounded-lg border p-3 flex flex-col gap-3" style={{ borderColor: form.is_telha_zinco ? '#3B82F6' : 'var(--color-border)', backgroundColor: form.is_telha_zinco ? '#EFF6FF' : 'transparent' }}>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={form.is_telha_zinco}
                                onChange={e => set('is_telha_zinco', e.target.checked)}
                                className="w-4 h-4 rounded" />
                            <span className="text-xs font-semibold font-caption" style={{ color: 'var(--color-text-primary)' }}>
                                Produto especial: Telha de Zinco (vendida por metro)
                            </span>
                        </label>
                        {form.is_telha_zinco && (
                            <div>
                                <label className="block text-xs font-medium font-caption mb-1.5" style={{ color: 'var(--color-text-primary)' }}>
                                    Peso base por metro (kg/m)
                                </label>
                                <div className="relative w-40">
                                    <input type="number" min="0.1" step="0.01" value={form.peso_base_metro}
                                        onChange={e => set('peso_base_metro', e.target.value)}
                                        className="w-full h-9 pl-3 pr-10 rounded-lg border border-blue-300 text-sm font-data focus:outline-none bg-white" />
                                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">kg/m</span>
                                </div>
                                <p className="text-xs mt-1.5 font-caption" style={{ color: '#3B82F6' }}>
                                    Fórmula: peso total = {form.peso_base_metro || '3.80'} kg/m × comprimento × qtd de telhas
                                </p>
                            </div>
                        )}
                    </div>

                    <div className="border-t pt-4" style={{ borderColor:'var(--color-border)' }}>
                        <div className="flex items-center gap-2 mb-3">
                            <Icon name="Percent" size={14} color="var(--color-primary)" />
                            <span className="text-xs font-semibold font-caption uppercase tracking-wider" style={{ color:'var(--color-text-primary)' }}>Cálculo de Frete</span>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-medium font-caption mb-1.5" style={{ color:'var(--color-text-primary)' }}>Categoria de Frete</label>
                                <select value={form.categoria_frete} onChange={e => set('categoria_frete', e.target.value)}
                                    className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none bg-white">
                                    <option value="">Detectar pelo nome</option>
                                    {FRETE_CATEGORIAS.map(f => (
                                        <option key={f.categoria} value={f.categoria}>{f.label} — {fmtPct(f.percentual)}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium font-caption mb-1.5" style={{ color:'var(--color-text-primary)' }}>% de Frete</label>
                                <div className="relative">
                                    <input type="number" min="0" step="0.01" max="100" value={form.percentual_frete}
                                        onChange={e => set('percentual_frete', e.target.value)}
                                        placeholder={catFreteConfig ? String(catFreteConfig.percentual * 100) : '5.00'}
                                        className="w-full h-10 pl-3 pr-7 rounded-lg border border-gray-200 text-sm font-data focus:outline-none bg-white" />
                                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
                                </div>
                            </div>
                        </div>

                        {form.categoria_frete && (
                            <div className="mt-3 rounded-lg px-3 py-2.5 flex items-center gap-2 text-xs font-caption"
                                style={{ backgroundColor: catFreteConfig?.bg || '#F3F4F6', color: catFreteConfig?.cor || '#374151' }}>
                                <Icon name="Info" size={13} color="currentColor" />
                                <span>
                                    Frete calculado como <strong>{form.percentual_frete || (catFreteConfig ? catFreteConfig.percentual * 100 : '?')}%</strong> do valor do pedido para <strong>{form.categoria_frete}</strong>
                                </span>
                            </div>
                        )}

                        <details className="mt-3">
                            <summary className="text-xs cursor-pointer font-caption" style={{ color:'var(--color-muted-foreground)' }}>Ver tabela completa de percentuais ▾</summary>
                            <div className="mt-2 rounded-lg border overflow-hidden" style={{ borderColor:'var(--color-border)' }}>
                                {FRETE_CATEGORIAS.filter(f => f.categoria !== 'Outros').map((f, i) => (
                                    <div key={f.categoria} className="flex items-center justify-between px-3 py-2 border-b last:border-0" style={{ borderColor:'var(--color-border)' }}>
                                        <span className="text-xs px-2 py-0.5 rounded font-caption" style={{ backgroundColor: f.bg, color: f.cor }}>{f.label}</span>
                                        <span className="text-xs font-data font-bold" style={{ color: f.cor }}>{fmtPct(f.percentual)}</span>
                                    </div>
                                ))}
                            </div>
                        </details>
                    </div>
                </div>

                <div className="px-6 py-4 border-t flex justify-end gap-2" style={{ borderColor:'var(--color-border)' }}>
                    <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
                    <Button variant="default" onClick={handleSubmit} loading={loading} iconName="Save" iconSize={15}>
                        {editingMaterial ? 'Salvar Alterações' : 'Cadastrar Material'}
                    </Button>
                </div>
            </div>
        </div>
    );
}
