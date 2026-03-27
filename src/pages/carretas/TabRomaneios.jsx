import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Button from 'components/ui/Button';
import Icon from 'components/AppIcon';
import Toast from 'components/ui/Toast';
import { useToast } from 'utils/useToast';
import { useConfirm } from 'components/ui/ConfirmDialog';
import {
    fetchRomaneios, createRomaneio, updateRomaneio, deleteRomaneio,
    fetchCarretasVeiculos, fetchTodosMotoristas, fetchEmpresas,
    STATUS_ROMANEIO, STATUS_ROMANEIO_COLORS,
} from 'utils/carretasService';
import { fetchMaterials } from 'utils/materialService';
import * as XLSX from 'xlsx';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const BRL = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const FMT_DATE = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—';
const inputCls = 'w-full px-3 py-2 rounded-lg border text-sm outline-none transition-all focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500';
const inputStyle = { borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' };

// ─── Sub-componentes reutilizáveis ────────────────────────────────────────────
function ModalOverlay({ children, onClose }) {
    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
            onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col"
                style={{ maxHeight: 'calc(100vh - 32px)' }}>
                {children}
            </div>
        </div>
    );
}

function ModalHeader({ title, icon, onClose }) {
    return (
        <div className="flex items-center justify-between p-5 border-b flex-shrink-0"
            style={{ borderColor: 'var(--color-border)' }}>
            <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: '#EFF6FF' }}>
                    <Icon name={icon} size={18} color="#1D4ED8" />
                </div>
                <h2 className="font-heading font-bold text-lg" style={{ color: 'var(--color-text-primary)' }}>{title}</h2>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                <Icon name="X" size={18} color="var(--color-muted-foreground)" />
            </button>
        </div>
    );
}

function Field({ label, children, required, className = '' }) {
    return (
        <div className={className}>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                {label}{required && <span className="text-red-500 ml-0.5">*</span>}
            </label>
            {children}
        </div>
    );
}

function StatusBadge({ status }) {
    const cfg = STATUS_ROMANEIO_COLORS[status] || STATUS_ROMANEIO_COLORS['Aguardando'];
    return (
        <span className="px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap"
            style={{ backgroundColor: cfg.bg, color: cfg.text }}>
            {status}
        </span>
    );
}

// ─── Linha de item do romaneio ─────────────────────────────────────────────────
function ItemRow({ item, index, materiais, onUpdate, onRemove }) {
    const mat = materiais.find(m => m.id === item.material_id);

    // Peso calculado automaticamente: quantidade × peso unitário do material
    const pesoCalculado = useMemo(() => {
        if (!mat?.peso || !item.quantidade) return null;
        return Number(item.quantidade) * Number(mat.peso);
    }, [mat, item.quantidade]);

    // Sempre que pesoCalculado mudar E o usuário não tiver editado manualmente → atualiza
    useEffect(() => {
        if (pesoCalculado !== null && !item._pesoManual) {
            onUpdate(index, { peso_total: String(pesoCalculado) });
        }
    }, [pesoCalculado]); // eslint-disable-line

    return (
        <div className="grid grid-cols-12 gap-2 items-start p-3 rounded-xl border"
            style={{ borderColor: 'var(--color-border)', backgroundColor: index % 2 === 0 ? '#F8FAFC' : '#fff' }}>

            {/* Nº */}
            <div className="col-span-12 sm:col-span-1 flex items-center justify-center pt-6">
                <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                    style={{ backgroundColor: 'var(--color-primary)' }}>{index + 1}</span>
            </div>

            {/* Material */}
            <div className="col-span-12 sm:col-span-4">
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Material</label>
                <select
                    value={item.material_id || ''}
                    onChange={e => {
                        const mid = e.target.value;
                        const m = materiais.find(x => x.id === mid);
                        // Ao trocar material: reseta flag manual para recalcular peso
                        onUpdate(index, {
                            material_id: mid,
                            descricao:   m?.nome    || '',
                            unidade:     m?.unidade || item.unidade,
                            _pesoManual: false,
                            peso_total:  m?.peso ? String(Number(item.quantidade || 1) * Number(m.peso)) : '',
                        });
                    }}
                    className={inputCls} style={inputStyle}>
                    <option value="">Selecione...</option>
                    {materiais.map(m => (
                        <option key={m.id} value={m.id}>{m.nome}</option>
                    ))}
                </select>
                {mat?.peso && (
                    <p className="text-xs mt-1 font-medium" style={{ color: '#059669' }}>
                        {Number(mat.peso).toLocaleString('pt-BR')} kg/un
                    </p>
                )}
            </div>

            {/* Qtd */}
            <div className="col-span-5 sm:col-span-2">
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Qtd</label>
                <input type="number" step="0.001" min="0"
                    value={item.quantidade}
                    onChange={e => {
                        const newQtd = e.target.value;
                        // Recalcula peso automaticamente se não foi editado manualmente
                        const newPeso = mat?.peso && !item._pesoManual
                            ? String(Number(newQtd) * Number(mat.peso))
                            : item.peso_total;
                        onUpdate(index, { quantidade: newQtd, peso_total: newPeso });
                    }}
                    className={inputCls} style={inputStyle} placeholder="0" />
            </div>

            {/* Unidade */}
            <div className="col-span-7 sm:col-span-2">
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Unidade</label>
                <select value={item.unidade} onChange={e => onUpdate(index, { unidade: e.target.value })}
                    className={inputCls} style={inputStyle}>
                    {['sc', 'ton', 'kg', 'un', 'cx', 'm³', 'pallet', 'br', 'mt'].map(u => <option key={u} value={u}>{u}</option>)}
                </select>
            </div>

            {/* Peso total — automático ou manual */}
            <div className="col-span-10 sm:col-span-2">
                <div className="flex items-center gap-1 mb-1">
                    <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>Peso (kg)</label>
                    {mat?.peso && !item._pesoManual
                        ? <span className="px-1 py-0.5 rounded text-xs font-semibold" style={{ backgroundColor: '#D1FAE5', color: '#065F46' }}>auto</span>
                        : mat?.peso
                            ? <button onClick={() => onUpdate(index, { peso_total: String(pesoCalculado || ''), _pesoManual: false })}
                                className="px-1 py-0.5 rounded text-xs" style={{ backgroundColor: '#FEF9C3', color: '#B45309' }}
                                title="Recalcular automaticamente">↻ recalc</button>
                            : null
                    }
                </div>
                <input type="number" step="0.01" min="0"
                    value={item.peso_total || ''}
                    onChange={e => onUpdate(index, { peso_total: e.target.value, _pesoManual: true })}
                    className={inputCls}
                    style={{
                        ...inputStyle,
                        borderColor: mat?.peso && !item._pesoManual ? '#6EE7B7' : 'var(--color-border)',
                        backgroundColor: mat?.peso && !item._pesoManual ? '#F0FDF4' : undefined,
                    }}
                    placeholder="—" />
                {mat?.peso && !item._pesoManual && item.quantidade && (
                    <p className="text-xs mt-0.5" style={{ color: '#059669' }}>
                        {Number(item.quantidade).toLocaleString('pt-BR')} × {Number(mat.peso).toLocaleString('pt-BR')}
                    </p>
                )}
            </div>

            {/* Remove */}
            <div className="col-span-2 sm:col-span-1 flex items-end pb-0.5 pt-6">
                <button onClick={() => onRemove(index)}
                    className="w-full flex items-center justify-center h-9 rounded-lg border border-red-200 hover:bg-red-50 transition-colors">
                    <Icon name="Trash2" size={14} color="#DC2626" />
                </button>
            </div>
        </div>
    );
}

// ─── Modal Formulário Romaneio ─────────────────────────────────────────────────
function RomaneioFormModal({ modal, onClose, onSaved, motoristas, veiculos, empresas, materiais }) {
    const { toast, showToast } = useToast();
    const isEdit = modal?.mode === 'edit';
    const rom = modal?.data;

    const emptyForm = () => ({
        status: 'Aguardando',
        motorista_id: '',
        veiculo_id: '',
        empresa: '',
        data_saida: new Date().toISOString().split('T')[0],
        data_chegada: '',
        destino: '',
        numero_nf: '',
        numero_pedido: '',
        valor_carga: '',
        tipo_calculo_frete: 'fixo',
        valor_frete: '',
        observacoes: '',
    });

    const [form, setForm] = useState(emptyForm());
    const [itens, setItens] = useState([]);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (isEdit && rom) {
            setForm({
                status:               rom.status || 'Aguardando',
                motorista_id:         rom.motorista_id || '',
                veiculo_id:           rom.veiculo_id || '',
                empresa:              rom.empresa || '',
                data_saida:           rom.data_saida || '',
                data_chegada:         rom.data_chegada || '',
                destino:              rom.destino || '',
                numero_nf:            rom.numero_nf || '',
                numero_pedido:        rom.numero_pedido || '',
                valor_carga:          rom.valor_carga != null ? String(rom.valor_carga) : '',
                tipo_calculo_frete:   rom.tipo_calculo_frete || 'fixo',
                valor_frete:          rom.valor_frete != null ? String(rom.valor_frete) : '',
                observacoes:          rom.observacoes || '',
            });
            setItens((rom.itens || []).map(it => ({
                material_id: it.material_id || '',
                descricao:   it.descricao || '',
                quantidade:  String(it.quantidade || 1),
                unidade:     it.unidade || 'sc',
                peso_total:  it.peso_total != null ? String(it.peso_total) : '',
                _pesoManual: true, // ao editar, mantém o peso salvo
            })));
        } else {
            setForm(emptyForm());
            setItens([]);
        }
    }, [modal]); // eslint-disable-line

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const addItem = () => setItens(p => [...p, {
        material_id: '', descricao: '', quantidade: '1', unidade: 'sc', peso_total: '', _pesoManual: false,
    }]);
    const updateItem = (idx, patch) => setItens(p => p.map((it, i) => i === idx ? { ...it, ...patch } : it));
    const removeItem = (idx) => setItens(p => p.filter((_, i) => i !== idx));

    // Preview do frete
    const fretePreview = useMemo(() => {
        if (form.tipo_calculo_frete === 'fixo') return Number(form.valor_frete) || 0;
        if (form.tipo_calculo_frete === 'percentual' && form.valor_carga && form.valor_frete)
            return (Number(form.valor_carga) * Number(form.valor_frete)) / 100;
        return 0;
    }, [form.tipo_calculo_frete, form.valor_frete, form.valor_carga]);

    // Peso total dos itens
    const pesoTotal = useMemo(() =>
        itens.reduce((s, it) => s + (Number(it.peso_total) || 0), 0),
    [itens]);

    const handleSave = async () => {
        if (!form.destino) { showToast('Destino é obrigatório', 'error'); return; }
        setSaving(true);
        try {
            const freteValor = (() => {
                if (form.tipo_calculo_frete === 'fixo') return form.valor_frete ? Number(form.valor_frete) : null;
                if (form.tipo_calculo_frete === 'percentual' && form.valor_carga && form.valor_frete)
                    return (Number(form.valor_carga) * Number(form.valor_frete)) / 100;
                return null;
            })();

            const payload = {
                status:              form.status,
                destino:             form.destino,
                data_saida:          form.data_saida   || undefined,
                data_chegada:        form.data_chegada || undefined,
                motorista_id:        form.motorista_id || undefined,
                veiculo_id:          form.veiculo_id   || undefined,
                empresa:             form.empresa       || undefined,
                numero_nf:           form.numero_nf     || undefined,
                numero_pedido:       form.numero_pedido || undefined,
                valor_carga:         form.valor_carga   ? Number(form.valor_carga) : null,
                tipo_calculo_frete:  form.tipo_calculo_frete,
                valor_frete:         freteValor,
                observacoes:         form.observacoes   || undefined,
                itens:               itens.filter(it => it.material_id || it.descricao),
            };
            // Remove undefined
            Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);

            if (isEdit) await updateRomaneio(rom.id, payload);
            else        await createRomaneio(payload);

            showToast(isEdit ? 'Romaneio atualizado!' : 'Romaneio criado!', 'success');
            setTimeout(() => { onSaved(); onClose(); }, 800);
        } catch (e) {
            console.error(e);
            showToast('Erro: ' + (e.message || JSON.stringify(e)), 'error');
        } finally {
            setSaving(false);
        }
    };

    return (
        <ModalOverlay onClose={onClose}>
            <ModalHeader
                title={isEdit ? `Editar Romaneio ${rom?.numero || ''}` : 'Novo Romaneio'}
                icon="FileText"
                onClose={onClose}
            />

            <div className="p-5 space-y-5 overflow-y-auto flex-1">

                {/* ── Bloco 1: Identificação ── */}
                <div className="p-4 rounded-xl border" style={{ borderColor: '#BFDBFE', backgroundColor: '#EFF6FF' }}>
                    <p className="text-xs font-semibold text-blue-700 mb-3">🚛 Identificação do Romaneio</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {isEdit && (
                            <Field label="Status">
                                <select value={form.status} onChange={e => set('status', e.target.value)}
                                    className={inputCls} style={inputStyle}>
                                    {STATUS_ROMANEIO.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </Field>
                        )}
                        <Field label="Placa do Veículo" required>
                            <select value={form.veiculo_id} onChange={e => set('veiculo_id', e.target.value)}
                                className={inputCls} style={inputStyle}>
                                <option value="">Selecione a placa...</option>
                                {veiculos.map(v => <option key={v.id} value={v.id}>{v.placa} — {v.modelo}</option>)}
                            </select>
                        </Field>
                        <Field label="Motorista">
                            <select value={form.motorista_id} onChange={e => set('motorista_id', e.target.value)}
                                className={inputCls} style={inputStyle}>
                                <option value="">Selecione o motorista...</option>
                                {motoristas.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                            </select>
                        </Field>
                        <Field label="Empresa">
                            <select value={form.empresa} onChange={e => set('empresa', e.target.value)}
                                className={inputCls} style={inputStyle}>
                                <option value="">Selecione a empresa...</option>
                                {empresas.map(e => <option key={e.id} value={e.nome}>{e.nome}</option>)}
                            </select>
                        </Field>
                        <Field label="Destino de Entrega" required>
                            <input value={form.destino} onChange={e => set('destino', e.target.value)}
                                className={inputCls} style={inputStyle} placeholder="Cidade / Endereço" />
                        </Field>
                        <Field label="Data de Saída">
                            <input type="date" value={form.data_saida} onChange={e => set('data_saida', e.target.value)}
                                className={inputCls} style={inputStyle} />
                        </Field>
                        <Field label="Data de Chegada (prevista)">
                            <input type="date" value={form.data_chegada} onChange={e => set('data_chegada', e.target.value)}
                                className={inputCls} style={inputStyle} />
                        </Field>
                    </div>
                </div>

                {/* ── Bloco 2: NF / Pedido + Valor Carga ── */}
                <div className="p-4 rounded-xl border" style={{ borderColor: '#A7F3D0', backgroundColor: '#ECFDF5' }}>
                    <p className="text-xs font-semibold text-emerald-700 mb-3">📄 Nota Fiscal / Pedido</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <Field label="Nº da Nota Fiscal">
                            <input value={form.numero_nf} onChange={e => set('numero_nf', e.target.value)}
                                className={inputCls} style={inputStyle} placeholder="Ex: 00012345" />
                        </Field>
                        <Field label="Nº do Pedido">
                            <input value={form.numero_pedido} onChange={e => set('numero_pedido', e.target.value)}
                                className={inputCls} style={inputStyle} placeholder="Ex: 37443" />
                        </Field>
                        <Field label="Valor da Carga (R$)">
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium text-emerald-600">R$</span>
                                <input type="number" step="0.01" min="0" value={form.valor_carga}
                                    onChange={e => set('valor_carga', e.target.value)}
                                    className={inputCls + ' pl-9'} style={inputStyle} placeholder="0,00" />
                            </div>
                        </Field>
                    </div>
                    {pesoTotal > 0 && (
                        <div className="mt-3 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200">
                            <p className="text-xs text-emerald-700 font-medium">
                                ⚖️ Peso total dos itens: <strong>{pesoTotal.toLocaleString('pt-BR')} kg</strong>
                            </p>
                        </div>
                    )}
                </div>

                {/* ── Bloco 3: Frete ── */}
                <div className="p-4 rounded-xl border" style={{ borderColor: '#C4B5FD', backgroundColor: '#FAF5FF' }}>
                    <p className="text-xs font-semibold text-purple-700 mb-3">💰 Frete</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="Tipo de Frete">
                            <select value={form.tipo_calculo_frete} onChange={e => set('tipo_calculo_frete', e.target.value)}
                                className={inputCls} style={inputStyle}>
                                <option value="fixo">Valor Fixo (R$)</option>
                                <option value="percentual">Percentual sobre a carga (%)</option>
                            </select>
                        </Field>
                        <Field label={form.tipo_calculo_frete === 'fixo' ? 'Valor do Frete (R$)' : 'Percentual (%)'}>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium text-purple-600">
                                    {form.tipo_calculo_frete === 'fixo' ? 'R$' : '%'}
                                </span>
                                <input type="number" step="0.01" min="0" value={form.valor_frete}
                                    onChange={e => set('valor_frete', e.target.value)}
                                    className={inputCls + ' pl-9'} style={inputStyle} placeholder="0,00" />
                            </div>
                        </Field>
                    </div>
                    {fretePreview > 0 && (
                        <div className="mt-3 p-3 rounded-xl bg-purple-600 text-white flex items-center justify-between">
                            <span className="text-sm font-medium">✅ Frete calculado:</span>
                            <span className="text-lg font-bold font-data">{BRL(fretePreview)}</span>
                        </div>
                    )}
                </div>

                {/* ── Bloco 4: Materiais ── */}
                <div>
                    <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                            📋 Materiais do Romaneio
                            {itens.length > 0 && (
                                <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                                    {itens.length} item{itens.length > 1 ? 's' : ''}
                                </span>
                            )}
                        </p>
                        <button onClick={addItem}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-blue-300 text-blue-700 hover:bg-blue-50 transition-colors">
                            <Icon name="Plus" size={13} /> Adicionar Material
                        </button>
                    </div>

                    {itens.length === 0 ? (
                        <div className="text-center py-8 rounded-xl border-2 border-dashed cursor-pointer hover:bg-gray-50 transition-colors"
                            style={{ borderColor: 'var(--color-border)' }} onClick={addItem}>
                            <Icon name="Package" size={28} color="var(--color-muted-foreground)" />
                            <p className="text-sm mt-2" style={{ color: 'var(--color-muted-foreground)' }}>
                                Clique para adicionar materiais
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {itens.map((item, idx) => (
                                <ItemRow
                                    key={idx}
                                    item={item}
                                    index={idx}
                                    materiais={materiais}
                                    onUpdate={updateItem}
                                    onRemove={removeItem}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {/* ── Observações ── */}
                <Field label="Observações">
                    <textarea value={form.observacoes} onChange={e => set('observacoes', e.target.value)}
                        className={inputCls} style={inputStyle} rows={3}
                        placeholder="Observações gerais sobre o romaneio..." />
                </Field>
            </div>

            {/* Footer */}
            <div className="flex gap-3 p-5 justify-end border-t flex-shrink-0"
                style={{ borderColor: 'var(--color-border)' }}>
                <button onClick={onClose}
                    className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50"
                    style={{ borderColor: 'var(--color-border)' }}>
                    Cancelar
                </button>
                <Button onClick={handleSave} size="sm" iconName={saving ? 'Loader' : 'Check'} disabled={saving}>
                    {saving ? 'Salvando...' : (isEdit ? 'Atualizar' : 'Criar Romaneio')}
                </Button>
            </div>
            <Toast toast={toast} />
        </ModalOverlay>
    );
}

// ─── Modal de detalhe ──────────────────────────────────────────────────────────
function RomaneioDetailModal({ romaneio, onClose }) {
    if (!romaneio) return null;
    return (
        <ModalOverlay onClose={onClose}>
            <ModalHeader title={`Romaneio ${romaneio.numero}`} icon="FileText" onClose={onClose} />
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {[
                        { l: 'Status',      v: <StatusBadge status={romaneio.status} /> },
                        { l: 'Motorista',   v: romaneio.motorista?.name || '—' },
                        { l: 'Placa',       v: romaneio.veiculo?.placa  || '—' },
                        { l: 'Empresa',     v: romaneio.empresa          || '—' },
                        { l: 'Destino',     v: romaneio.destino          || '—' },
                        { l: 'Data Saída',  v: FMT_DATE(romaneio.data_saida) },
                        { l: 'Nº NF',       v: romaneio.numero_nf        || '—' },
                        { l: 'Nº Pedido',   v: romaneio.numero_pedido    || '—' },
                        { l: 'Data Chegada',v: FMT_DATE(romaneio.data_chegada) },
                    ].map(({ l, v }) => (
                        <div key={l} className="p-3 rounded-xl border" style={{ borderColor: 'var(--color-border)' }}>
                            <p className="text-xs mb-1" style={{ color: 'var(--color-muted-foreground)' }}>{l}</p>
                            <div className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{v}</div>
                        </div>
                    ))}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {[
                        { l: 'Valor da Carga', v: romaneio.valor_carga ? BRL(romaneio.valor_carga) : '—', color: '#065F46' },
                        { l: 'Frete',          v: romaneio.valor_frete  ? BRL(romaneio.valor_frete)  : '—', color: '#7C3AED' },
                        { l: 'Peso Total',     v: (() => {
                            const p = (romaneio.itens || []).reduce((s, it) => s + Number(it.peso_total || 0), 0);
                            return p > 0 ? `${p.toLocaleString('pt-BR')} kg` : (romaneio.toneladas ? `${Number(romaneio.toneladas).toLocaleString('pt-BR')} t` : '—');
                        })(), color: '#B45309' },
                    ].map(({ l, v, color }) => (
                        <div key={l} className="p-3 rounded-xl border" style={{ borderColor: 'var(--color-border)' }}>
                            <p className="text-xs mb-1" style={{ color: 'var(--color-muted-foreground)' }}>{l}</p>
                            <p className="text-base font-bold font-data" style={{ color }}>{v}</p>
                        </div>
                    ))}
                </div>
                {(romaneio.itens?.length || 0) > 0 && (
                    <div>
                        <p className="text-sm font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>
                            Materiais ({romaneio.itens.length})
                        </p>
                        <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
                            <table className="w-full text-sm">
                                <thead className="text-xs border-b"
                                    style={{ backgroundColor: 'var(--color-muted)', borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                                    <tr>
                                        {['Material','Qtd','Unid.','Peso (kg)'].map(h => (
                                            <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {romaneio.itens.map((it, i) => (
                                        <tr key={it.id} className="border-t"
                                            style={{ borderColor: 'var(--color-border)', backgroundColor: i % 2 === 0 ? '#fff' : '#F8FAFC' }}>
                                            <td className="px-3 py-2 font-medium">{it.material?.nome || it.descricao || '—'}</td>
                                            <td className="px-3 py-2 font-data">{Number(it.quantidade).toLocaleString('pt-BR')}</td>
                                            <td className="px-3 py-2">{it.unidade}</td>
                                            <td className="px-3 py-2 font-data">{it.peso_total ? Number(it.peso_total).toLocaleString('pt-BR') : '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
                {romaneio.observacoes && (
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800">
                        <p className="font-medium mb-0.5">Observações:</p>
                        <p>{romaneio.observacoes}</p>
                    </div>
                )}
            </div>
            <div className="flex gap-3 p-5 justify-end border-t flex-shrink-0">
                <button onClick={() => window.print()}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50"
                    style={{ borderColor: 'var(--color-border)' }}>
                    <Icon name="Printer" size={14} /> Imprimir
                </button>
                <button onClick={onClose}
                    className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50"
                    style={{ borderColor: 'var(--color-border)' }}>
                    Fechar
                </button>
            </div>
        </ModalOverlay>
    );
}

// ─── COMPONENTE PRINCIPAL ──────────────────────────────────────────────────────
export default function TabRomaneios({ isAdmin }) {
    const { toast, showToast } = useToast();
    const { confirm, ConfirmDialog } = useConfirm();

    const [romaneios, setRomaneios]     = useState([]);
    const [motoristas, setMotoristas]   = useState([]);
    const [veiculos, setVeiculos]       = useState([]);
    const [empresas, setEmpresas]       = useState([]);
    const [materiais, setMateriais]     = useState([]);
    const [loading, setLoading]         = useState(true);
    const [modal, setModal]             = useState(null);
    const [detailModal, setDetailModal] = useState(null);
    const [filtroStatus, setFiltroStatus] = useState('');
    const [filtroMes, setFiltroMes]       = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const f = {};
            if (filtroStatus) f.status = filtroStatus;
            if (filtroMes) {
                f.dataInicio = filtroMes + '-01';
                f.dataFim    = filtroMes + '-' + String(new Date(
                    Number(filtroMes.split('-')[0]),
                    Number(filtroMes.split('-')[1]), 0
                ).getDate()).padStart(2, '0');
            }
            const [r, v, m, e, mat] = await Promise.all([
                fetchRomaneios(f),
                fetchCarretasVeiculos(),
                fetchTodosMotoristas(),
                fetchEmpresas(),
                fetchMaterials(),
            ]);
            setRomaneios(r); setVeiculos(v); setMotoristas(m); setEmpresas(e); setMateriais(mat);
        } catch (e) { showToast('Erro ao carregar: ' + e.message, 'error'); }
        finally { setLoading(false); }
    }, [filtroStatus, filtroMes]); // eslint-disable-line

    useEffect(() => { load(); }, [load]);

    // Auto-atualiza status por data ao carregar
    useEffect(() => {
        if (!romaneios.length) return;
        const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
        const para_atualizar = romaneios.filter(r => {
            if (!r.data_saida || r.status !== 'Aguardando') return false;
            return new Date(r.data_saida + 'T00:00:00') <= hoje;
        });
        if (!para_atualizar.length) return;
        Promise.all(para_atualizar.map(r => updateRomaneio(r.id, { status: 'Em Trânsito' })))
            .then(() => load())
            .catch(() => {});
    }, [romaneios.length]); // eslint-disable-line

    const handleStatusChange = async (id, novoStatus) => {
        try {
            await updateRomaneio(id, { status: novoStatus });
            setRomaneios(prev => prev.map(r => r.id === id ? { ...r, status: novoStatus } : r));
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };

    const handleDelete = async (id) => {
        const ok = await confirm({
            title: 'Excluir romaneio?',
            message: 'Esta ação não pode ser desfeita.',
            confirmLabel: 'Excluir',
            variant: 'danger',
        });
        if (!ok) return;
        try { await deleteRomaneio(id); showToast('Excluído!', 'warning'); load(); }
        catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };

    const exportar = () => {
        if (!romaneios.length) { showToast('Nenhum romaneio para exportar', 'error'); return; }
        const rows = romaneios.map(r => ({
            'Número':      r.numero,
            'Status':      r.status,
            'Motorista':   r.motorista?.name || '',
            'Placa':       r.veiculo?.placa  || '',
            'Empresa':     r.empresa          || '',
            'Destino':     r.destino          || '',
            'Data Saída':  FMT_DATE(r.data_saida),
            'Nº NF':       r.numero_nf        || '',
            'Nº Pedido':   r.numero_pedido    || '',
            'Valor Carga': Number(r.valor_carga || 0),
            'Frete (R$)':  Number(r.valor_frete  || 0),
            'Materiais':   (r.itens || []).map(it => it.material?.nome || it.descricao || '').filter(Boolean).join(', '),
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        ws['!cols'] = [12,16,20,12,18,22,12,12,12,14,14,40].map(w => ({ wch: w }));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Romaneios');
        XLSX.writeFile(wb, `romaneios_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.xlsx`);
        showToast('Exportado!', 'success');
    };

    const kpis = useMemo(() => ({
        total:       romaneios.length,
        transito:    romaneios.filter(r => r.status === 'Em Trânsito').length,
        finalizados: romaneios.filter(r => r.status === 'Entrega finalizada').length,
        freteTotal:  romaneios.reduce((s, r) => s + Number(r.valor_frete || 0), 0),
    }), [romaneios]);

    return (
        <div>
            {/* ── Toolbar ── */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                <div className="flex flex-wrap gap-2">
                    <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}
                        className="px-3 py-2 rounded-lg border text-sm" style={inputStyle}>
                        <option value="">Todos os status</option>
                        {STATUS_ROMANEIO.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <input type="month" value={filtroMes} onChange={e => setFiltroMes(e.target.value)}
                        className="px-3 py-2 rounded-lg border text-sm" style={inputStyle} />
                </div>
                <div className="flex gap-2 flex-wrap">
                    <button onClick={load}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium hover:bg-gray-50 transition-colors"
                        style={{ borderColor: 'var(--color-border)' }} title="Atualizar">
                        <Icon name="RefreshCw" size={14} color="var(--color-muted-foreground)" />
                    </button>
                    {isAdmin && (
                        <>
                            <button onClick={exportar}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium hover:bg-gray-50 transition-colors"
                                style={{ borderColor: 'var(--color-border)' }}>
                                <Icon name="FileDown" size={14} /> Exportar
                            </button>
                            <Button onClick={() => setModal({ mode: 'create' })} iconName="Plus" size="sm">
                                Novo Romaneio
                            </Button>
                        </>
                    )}
                </div>
            </div>

            {/* ── KPIs ── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                {[
                    { l: 'Total',       v: kpis.total,           c: '#1D4ED8', bg: '#EFF6FF', i: 'FileText'    },
                    { l: 'Em Trânsito', v: kpis.transito,        c: '#7C3AED', bg: '#EDE9FE', i: 'Truck'       },
                    { l: 'Finalizados', v: kpis.finalizados,     c: '#065F46', bg: '#D1FAE5', i: 'CheckCircle2' },
                    { l: 'Frete Total', v: BRL(kpis.freteTotal), c: '#B45309', bg: '#FEF9C3', i: 'DollarSign'  },
                ].map(k => (
                    <div key={k.l} className="bg-white rounded-xl border p-4 shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
                        <div className="flex items-center gap-2 mb-1">
                            <div className="rounded-lg flex items-center justify-center" style={{ width: 28, height: 28, backgroundColor: k.bg }}>
                                <Icon name={k.i} size={14} color={k.c} />
                            </div>
                            <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>{k.l}</span>
                        </div>
                        <p className="text-lg font-bold font-data" style={{ color: k.c }}>{k.v}</p>
                    </div>
                ))}
            </div>

            {/* ── Lista de Cards ── */}
            {loading ? (
                <div className="flex justify-center py-16">
                    <div className="animate-spin h-7 w-7 rounded-full border-4"
                        style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
                </div>
            ) : romaneios.length === 0 ? (
                <div className="bg-white rounded-xl border p-12 text-center" style={{ borderColor: 'var(--color-border)' }}>
                    <Icon name="FileText" size={40} color="var(--color-muted-foreground)" />
                    <p className="text-sm mt-3 font-medium" style={{ color: 'var(--color-muted-foreground)' }}>
                        Nenhum romaneio cadastrado
                    </p>
                    {isAdmin && (
                        <button onClick={() => setModal({ mode: 'create' })}
                            className="mt-4 flex items-center gap-2 mx-auto px-4 py-2 rounded-lg text-sm font-medium text-white"
                            style={{ backgroundColor: 'var(--color-primary)' }}>
                            <Icon name="Plus" size={14} color="white" /> Criar primeiro romaneio
                        </button>
                    )}
                </div>
            ) : (
                <div className="flex flex-col gap-3">
                    {romaneios.map(r => {
                        const statusCfg = STATUS_ROMANEIO_COLORS[r.status] || STATUS_ROMANEIO_COLORS['Aguardando'];
                        const materiais_nomes = (r.itens || [])
                            .map(it => it.material?.nome || it.descricao || '')
                            .filter(Boolean).join(', ');
                        const pesoItens = (r.itens || []).reduce((s, it) => s + Number(it.peso_total || 0), 0);

                        return (
                            <div key={r.id} className="bg-white rounded-xl border shadow-sm hover:shadow-md transition-shadow"
                                style={{ borderColor: 'var(--color-border)' }}>

                                {/* ── Topo: número + status + ações ── */}
                                <div className="flex items-center justify-between px-4 py-3 gap-3 flex-wrap">
                                    <div className="flex items-center gap-3">
                                        <button onClick={() => setDetailModal(r)}
                                            className="font-bold font-data text-blue-700 hover:underline text-sm whitespace-nowrap">
                                            {r.numero}
                                        </button>
                                        <select
                                            value={r.status}
                                            onChange={e => handleStatusChange(r.id, e.target.value)}
                                            className="text-xs font-semibold rounded-full px-2.5 py-1 border-0 cursor-pointer outline-none"
                                            style={{ backgroundColor: statusCfg.bg, color: statusCfg.text }}
                                            title="Clique para mudar o status">
                                            {STATUS_ROMANEIO.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </div>

                                    {/* Botões sempre visíveis */}
                                    <div className="flex items-center gap-1.5 flex-shrink-0">
                                        <button onClick={() => setDetailModal(r)}
                                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border hover:bg-blue-50 transition-colors"
                                            style={{ borderColor: '#BFDBFE', color: '#1D4ED8' }}>
                                            <Icon name="Eye" size={13} color="#1D4ED8" /> Ver
                                        </button>
                                        {isAdmin && (
                                            <>
                                                <button onClick={() => setModal({ mode: 'edit', data: r })}
                                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border hover:bg-blue-50 transition-colors"
                                                    style={{ borderColor: '#BFDBFE', color: '#1D4ED8' }}>
                                                    <Icon name="Pencil" size={13} color="#1D4ED8" /> Editar
                                                </button>
                                                <button onClick={() => handleDelete(r.id)}
                                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border hover:bg-red-50 transition-colors"
                                                    style={{ borderColor: '#FECACA', color: '#DC2626' }}>
                                                    <Icon name="Trash2" size={13} color="#DC2626" /> Excluir
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* ── Rodapé: dados em grid responsivo ── */}
                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 border-t text-xs"
                                    style={{ borderColor: 'var(--color-border)' }}>
                                    {[
                                        { l: 'Motorista',   v: r.motorista?.name || '—' },
                                        { l: 'Placa',       v: r.veiculo?.placa  || '—', mono: true },
                                        { l: 'Empresa',     v: r.empresa          || '—' },
                                        { l: 'Destino',     v: r.destino          || '—' },
                                        { l: 'NF / Pedido', v: [r.numero_nf, r.numero_pedido].filter(Boolean).join(' / ') || '—' },
                                        { l: 'Data Saída',  v: FMT_DATE(r.data_saida) },
                                        { l: 'Peso Total',  v: pesoItens > 0 ? `${pesoItens.toLocaleString('pt-BR')} kg` : '—', mono: true },
                                        { l: 'Valor Carga', v: r.valor_carga ? BRL(r.valor_carga) : '—', color: '#065F46', mono: true },
                                        { l: 'Frete',       v: r.valor_frete  ? BRL(r.valor_frete)  : '—', color: '#7C3AED', mono: true },
                                        { l: 'Materiais',   v: materiais_nomes || '—', span: true },
                                    ].map(({ l, v, mono, color, span }) => (
                                        <div key={l}
                                            className={`px-4 py-2.5 border-r border-b last:border-r-0 ${span ? 'col-span-2 sm:col-span-3 lg:col-span-3' : ''}`}
                                            style={{ borderColor: 'var(--color-border)' }}>
                                            <p className="mb-0.5 font-medium" style={{ color: 'var(--color-muted-foreground)' }}>{l}</p>
                                            <p className={`truncate ${mono ? 'font-data' : 'font-medium'}`}
                                                style={{ color: color || 'var(--color-text-primary)' }}>
                                                {v}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {modal && (
                <RomaneioFormModal
                    modal={modal}
                    onClose={() => setModal(null)}
                    onSaved={load}
                    motoristas={motoristas}
                    veiculos={veiculos}
                    empresas={empresas}
                    materiais={materiais}
                />
            )}

            {detailModal && (
                <RomaneioDetailModal
                    romaneio={detailModal}
                    onClose={() => setDetailModal(null)}
                />
            )}

            <Toast toast={toast} />
            {ConfirmDialog}
        </div>
    );
}
