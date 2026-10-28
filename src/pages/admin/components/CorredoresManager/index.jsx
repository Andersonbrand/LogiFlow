import React, { useState, useCallback, useEffect } from 'react';
import { invalidarCache, fetchCorredores, upsertCorredor, deleteCorredor } from 'services/corredoresService';
import { AppIcon as Icon, Button, PrettySelect } from 'components';

// ────────────────────────────────────────────────────────────────────────────
// Componente de gerenciamento de corredores
// ────────────────────────────────────────────────────────────────────────────
const ICONES_DISPONIVEIS = [
    { value: 'ArrowUp',        label: '↑ Cima'         },
    { value: 'ArrowDown',      label: '↓ Baixo'        },
    { value: 'ArrowLeft',      label: '← Esquerda'     },
    { value: 'ArrowRight',     label: '→ Direita'      },
    { value: 'ArrowUpRight',   label: '↗ Cima-Direita' },
    { value: 'ArrowUpLeft',    label: '↖ Cima-Esquerda'},
    { value: 'ArrowDownRight', label: '↘ Baixo-Dir.'   },
    { value: 'ArrowDownLeft',  label: '↙ Baixo-Esq.'   },
    { value: 'MapPin',         label: '📍 Pino'        },
];

export default function CorredoresManager({ showToast }) {
    const [corredores, setCorredores] = useState([]);
    const [loading, setLoading]       = useState(true);
    const [editando, setEditando]     = useState(null);
    const [criando, setCriando]       = useState(false);
    const [saving, setSaving]         = useState(false);
    const [confirmDel, setConfirmDel] = useState(null);
    const [expandidos, setExpandidos] = useState({}); // { [nome]: true/false }

    const [form, setForm] = useState({ nome: '', label: '', icone: 'ArrowRight', cidades: '' });
    const [novaCidade, setNovaCidade] = useState('');

    const load = useCallback(async () => {
        try {
            setLoading(true);
            invalidarCache();
            const data = await fetchCorredores();
            setCorredores(data);
        } catch (err) {
            showToast('Erro ao carregar corredores: ' + err.message, 'error');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, []);

    const abrirEdicao = (corredor) => {
        setEditando(corredor.nome);
        setCriando(false);
        setForm({
            nome:    corredor.nome,
            label:   corredor.label,
            icone:   corredor.icone || 'ArrowRight',
            cidades: corredor.cidades.join('\n'),
        });
        setNovaCidade('');
    };

    const abrirCriacao = () => {
        setCriando(true);
        setEditando(null);
        setForm({ nome: '', label: '', icone: 'ArrowRight', cidades: '' });
        setNovaCidade('');
    };

    const fecharForm = () => { setEditando(null); setCriando(false); setNovaCidade(''); };

    const cidadesDoForm = () =>
        form.cidades
            .split('\n')
            .map(c => c.trim().toLowerCase())
            .filter(Boolean);

    const adicionarCidade = () => {
        if (!novaCidade.trim()) return;
        const atual = cidadesDoForm();
        const nova  = novaCidade.trim().toLowerCase();
        if (atual.includes(nova)) { showToast('Cidade já existe neste corredor', 'error'); return; }
        setForm(p => ({ ...p, cidades: [...atual, nova].join('\n') }));
        setNovaCidade('');
    };

    const removerCidade = (idx) => {
        const lista = cidadesDoForm().filter((_, i) => i !== idx);
        setForm(p => ({ ...p, cidades: lista.join('\n') }));
    };

    const salvar = async () => {
        if (!form.nome.trim()) { showToast('Nome do corredor é obrigatório', 'error'); return; }
        if (!form.label.trim()) { showToast('Rótulo é obrigatório', 'error'); return; }
        const cidades = cidadesDoForm();
        if (cidades.length === 0) { showToast('Adicione ao menos uma cidade', 'error'); return; }

        setSaving(true);
        try {
            await upsertCorredor({
                nome:   form.nome.trim().toLowerCase().replace(/\s+/g, '_'),
                label:  form.label.trim(),
                icone:  form.icone,
                cidades,
            });
            showToast('Corredor salvo com sucesso!', 'success');
            fecharForm();
            await load();
        } catch (err) {
            showToast('Erro ao salvar: ' + err.message, 'error');
        } finally {
            setSaving(false);
        }
    };

    const confirmarDelete = async () => {
        if (!confirmDel) return;
        try {
            await deleteCorredor(confirmDel);
            showToast('Corredor removido.', 'success');
            setConfirmDel(null);
            await load();
        } catch (err) {
            showToast('Erro ao remover: ' + err.message, 'error');
        }
    };

    if (loading) return (
        <div className="flex justify-center py-16">
            <div className="animate-spin h-7 w-7 rounded-full border-4 border-slate-300" style={{ borderTopColor: 'var(--color-primary)' }} />
        </div>
    );

    return (
        <div className="flex flex-col gap-5">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
                        <Icon name="Map" size={18} color="var(--color-primary)" />
                        Corredores de Rota
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                        Defina as cidades de cada corredor para o sistema de consolidação de cargas.
                        Base: <strong>Guanambi, BA</strong>.
                    </p>
                </div>
                <Button variant="default" iconName="Plus" iconSize={14} onClick={abrirCriacao}>
                    Novo Corredor
                </Button>
            </div>

            {/* Formulário de criação / edição */}
            {(criando || editando) && (
                <div className="bg-slate-50 rounded-xl border-2 border-blue-200 p-5">
                    <h3 className="font-semibold text-sm text-slate-800 mb-4">
                        {criando ? '+ Novo Corredor' : `✏️ Editando: ${form.label}`}
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                        {/* Nome interno */}
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">
                                Nome interno <span className="text-slate-400">(sem espaços)</span>
                            </label>
                            <input
                                value={form.nome}
                                onChange={e => setForm(p => ({ ...p, nome: e.target.value }))}
                                placeholder="ex: norte, sul_proximo"
                                disabled={!!editando}
                                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm bg-white font-mono disabled:opacity-50 disabled:bg-slate-100"
                            />
                        </div>

                        {/* Ícone */}
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Ícone / Direção</label>
                            <PrettySelect
                                value={form.icone}
                                onChange={e => setForm(p => ({ ...p, icone: e.target.value }))}
                                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm bg-white">
                                {ICONES_DISPONIVEIS.map(ic => (
                                    <option key={ic.value} value={ic.value}>{ic.label}</option>
                                ))}
                            </PrettySelect>
                        </div>

                        {/* Rótulo */}
                        <div className="sm:col-span-2">
                            <label className="block text-xs font-medium text-slate-600 mb-1">Rótulo exibido</label>
                            <input
                                value={form.label}
                                onChange={e => setForm(p => ({ ...p, label: e.target.value }))}
                                placeholder="ex: ↑ Norte (BR-030 → Lapa / Ibotirama)"
                                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm bg-white"
                            />
                        </div>
                    </div>

                    {/* Cidades */}
                    <div>
                        <label className="block text-xs font-medium text-slate-600 mb-2">
                            Cidades do corredor <span className="text-slate-400">({cidadesDoForm().length} cadastradas)</span>
                        </label>

                        {/* Adicionar nova cidade */}
                        <div className="flex gap-2 mb-3">
                            <input
                                value={novaCidade}
                                onChange={e => setNovaCidade(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), adicionarCidade())}
                                placeholder="Digite o nome da cidade e pressione Enter ou clique em +"
                                className="flex-1 h-9 px-3 rounded-lg border border-blue-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
                            />
                            <button
                                onClick={adicionarCidade}
                                className="h-9 px-4 rounded-lg text-white text-sm font-medium flex items-center gap-1 transition-colors"
                                style={{ backgroundColor: 'var(--color-primary)' }}>
                                <Icon name="Plus" size={14} color="#fff" /> Adicionar
                            </button>
                        </div>

                        {/* Lista de cidades com chip + remoção */}
                        <div className="flex flex-wrap gap-2 min-h-[40px] p-3 rounded-lg border border-slate-200 bg-white">
                            {cidadesDoForm().length === 0 ? (
                                <span className="text-xs text-slate-400 italic">Nenhuma cidade adicionada ainda...</span>
                            ) : cidadesDoForm().map((cidade, idx) => (
                                <span key={idx}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
                                    {cidade}
                                    <button
                                        onClick={() => removerCidade(idx)}
                                        className="ml-0.5 hover:text-red-600 transition-colors">
                                        <Icon name="X" size={10} color="currentColor" />
                                    </button>
                                </span>
                            ))}
                        </div>
                    </div>

                    <div className="flex gap-2 mt-4 justify-end">
                        <Button variant="outline" onClick={fecharForm} disabled={saving}>Cancelar</Button>
                        <Button variant="default" iconName="Save" iconSize={14} onClick={salvar} loading={saving}>
                            Salvar Corredor
                        </Button>
                    </div>
                </div>
            )}

            {/* Modal de confirmação de exclusão */}
            {confirmDel && (
                <div className="fixed inset-0 z-[400] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40" onClick={() => setConfirmDel(null)} />
                    <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
                        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-3">
                            <Icon name="Trash2" size={22} color="#DC2626" />
                        </div>
                        <h3 className="font-bold text-slate-800 mb-1">Remover corredor?</h3>
                        <p className="text-sm text-slate-500 mb-5">
                            O corredor <strong>"{confirmDel}"</strong> será removido permanentemente. Romaneios existentes não serão afetados.
                        </p>
                        <div className="flex gap-3 justify-center">
                            <Button variant="outline" onClick={() => setConfirmDel(null)}>Cancelar</Button>
                            <Button variant="destructive" iconName="Trash2" onClick={confirmarDelete}>Remover</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Lista de corredores */}
            <div className="grid grid-cols-1 tab:grid-cols-2 gap-4">
                {corredores.map(corredor => (
                    <div key={corredor.nome}
                        className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        {/* Header do card */}
                        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100"
                            style={{ backgroundColor: 'var(--color-muted)' }}>
                            <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                                    style={{ backgroundColor: 'var(--color-primary)' }}>
                                    <Icon name={corredor.icone || 'MapPin'} size={14} color="#fff" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-slate-800">{corredor.label}</p>
                                    <p className="text-xs text-slate-400 font-mono">{corredor.nome}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
                                    {(corredor.cidades || []).length} cidades
                                </span>
                                <button
                                    onClick={() => abrirEdicao(corredor)}
                                    className="p-1.5 rounded-lg hover:bg-slate-200 transition-colors ml-1">
                                    <Icon name="Pencil" size={16} color="#475569" />
                                </button>
                                <button
                                    onClick={() => setConfirmDel(corredor.nome)}
                                    className="p-1.5 rounded-lg hover:bg-red-100 transition-colors">
                                    <Icon name="Trash2" size={16} color="#DC2626" />
                                </button>
                            </div>
                        </div>

                        {/* Cidades em chips — expansíveis */}
                        <div className="px-4 py-3">
                            <div className="flex flex-wrap gap-1.5">
                                {(corredor.cidades || [])
                                    .slice(0, expandidos[corredor.nome] ? undefined : 12)
                                    .map((cidade, i) => (
                                        <span key={i}
                                            className="inline-block px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-600 border border-slate-200 capitalize">
                                            {cidade}
                                        </span>
                                    ))
                                }
                                {(corredor.cidades || []).length === 0 && (
                                    <span className="text-xs text-slate-400 italic">Sem cidades cadastradas</span>
                                )}
                            </div>
                            {(corredor.cidades || []).length > 12 && (
                                <button
                                    onClick={() => setExpandidos(prev => ({ ...prev, [corredor.nome]: !prev[corredor.nome] }))}
                                    className="mt-2 text-xs font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors">
                                    <Icon
                                        name={expandidos[corredor.nome] ? 'ChevronUp' : 'ChevronDown'}
                                        size={13} color="currentColor" />
                                    {expandidos[corredor.nome]
                                        ? 'Mostrar menos'
                                        : `Ver todas as ${corredor.cidades.length} cidades`}
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {corredores.length === 0 && !loading && (
                <div className="text-center py-12 text-slate-400">
                    <Icon name="Map" size={36} color="#CBD5E1" />
                    <p className="mt-2 text-sm">Nenhum corredor cadastrado</p>
                    <p className="text-xs mt-1">Clique em "Novo Corredor" para começar</p>
                </div>
            )}
        </div>
    );
}
