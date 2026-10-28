import React from 'react';

import { PrettySelect, AppIcon as Icon } from 'components';

import { inputCls, inputStyle } from '../../utils/constants';

// ─── Linha de item do romaneio ─────────────────────────────────────────────────
export default function ItemRow({ item, index, materiais, onUpdate, onRemove }) {
    const mat = materiais.find(m => String(m.id) === String(item.material_id));

    // Peso unitário: prioriza o armazenado no item (confiável), fallback no cadastro do material
    const pesoUnit = item.peso_unit && Number(item.peso_unit) > 0
        ? Number(item.peso_unit)
        : (mat?.peso && Number(mat.peso) > 0 ? Number(mat.peso) : null);

    // Peso exibido no input — para modo auto: calcula direto do estado (não drift com pesoUnit)
    // Assim o input controlado sempre reflete o estado real
    const pesoExibido = item._pesoManual
        ? (item.peso_total || '')
        : (item.peso_total || '');  // estado sempre sincronizado (ver onUpdate abaixo)

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
                <PrettySelect
                    value={item.material_id || ''}
                    onChange={e => {
                        const mid = e.target.value;
                        const m = materiais.find(x => String(x.id) === String(mid));
                        const pu = m?.peso && Number(m.peso) > 0 ? Number(m.peso) : null;
                        const qtd = Number(item.quantidade || 1);
                        onUpdate(index, {
                            material_id: mid,
                            descricao:   m?.nome    || '',
                            unidade:     m?.unidade || item.unidade,
                            peso_unit:   pu ? String(pu) : '',
                            _pesoManual: false,
                            peso_total:  pu ? String(pu * qtd) : '',
                        });
                    }}
                    className={inputCls} style={inputStyle}>
                    <option value="">Selecione...</option>
                    {materiais.map(m => (
                        <option key={m.id} value={m.id}>{m.nome}</option>
                    ))}
                    {/* Material do item não está (mais) na lista carregada — ex.: removido/renomeado
                        no catálogo depois que este pedido foi salvo. Sem isso o select ficava em
                        branco mesmo com o item corretamente salvo (peso/qtd vêm direto do item,
                        não dependem desse lookup — só o nome pra exibição precisa desse fallback). */}
                    {item.material_id && !materiais.some(m => String(m.id) === String(item.material_id)) && (
                        <option value={item.material_id}>{item.descricao || 'Material não encontrado no catálogo'}</option>
                    )}
                </PrettySelect>
                {item.material_id && !mat && (
                    <p className="text-xs mt-1 font-medium text-amber-600">
                        ⚠ Este material não está mais no catálogo — o valor salvo é mantido, mas confira se ainda é o correto
                    </p>
                )}
                {mat && !pesoUnit && item.material_id && (
                    <p className="text-xs mt-1 font-medium text-amber-600">
                        ⚠ Peso não cadastrado em /materiais — preencha manualmente
                    </p>
                )}
                {pesoUnit && (
                    <p className="text-xs mt-1 font-medium" style={{ color: '#059669' }}>
                        {pesoUnit.toLocaleString('pt-BR')} kg/un
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
                        const newPeso = pesoUnit && !item._pesoManual
                            ? String(pesoUnit * Number(newQtd))
                            : item.peso_total;
                        onUpdate(index, { quantidade: newQtd, peso_total: newPeso });
                    }}
                    className={inputCls} style={inputStyle} placeholder="0" />
            </div>

            {/* Unidade */}
            <div className="col-span-7 sm:col-span-2">
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Unidade</label>
                <PrettySelect value={item.unidade} onChange={e => onUpdate(index, { unidade: e.target.value })}
                    className={inputCls} style={inputStyle}>
                    {['sc', 'ton', 'kg', 'un', 'cx', 'm³', 'pallet', 'br', 'mt'].map(u => <option key={u} value={u}>{u}</option>)}
                </PrettySelect>
            </div>

            {/* Peso */}
            <div className="col-span-10 sm:col-span-2">
                <div className="flex items-center gap-1 mb-1">
                    <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>Peso (kg)</label>
                    {pesoUnit && !item._pesoManual
                        ? <span className="px-1 py-0.5 rounded text-xs font-semibold" style={{ backgroundColor: '#D1FAE5', color: '#065F46' }}>auto</span>
                        : pesoUnit
                            ? <button type="button" onClick={() => onUpdate(index, { _pesoManual: false, peso_total: String(pesoUnit * Number(item.quantidade || 0)) })}
                                className="px-1 py-0.5 rounded text-xs" style={{ backgroundColor: '#FEF9C3', color: '#B45309' }}>↻ auto</button>
                            : null
                    }
                </div>
                <input type="number" step="0.01" min="0"
                    value={pesoExibido}
                    onChange={e => onUpdate(index, { peso_total: e.target.value, _pesoManual: true })}
                    className={inputCls}
                    style={{
                        ...inputStyle,
                        borderColor: pesoUnit && !item._pesoManual ? '#6EE7B7' : 'var(--color-border)',
                        backgroundColor: pesoUnit && !item._pesoManual ? '#F0FDF4' : undefined,
                    }}
                    placeholder={pesoUnit ? '—' : 'Digite o peso'} />
                {pesoUnit && !item._pesoManual && item.quantidade && (
                    <p className="text-xs mt-0.5" style={{ color: '#059669' }}>
                        {Number(item.quantidade).toLocaleString('pt-BR')} × {pesoUnit.toLocaleString('pt-BR')}
                    </p>
                )}
            </div>

            {/* Remove */}
            <div className="col-span-2 sm:col-span-1 flex items-end pb-0.5 pt-6">
                <button onClick={() => onRemove(index)}
                    className="w-full flex items-center justify-center h-9 rounded-lg border border-red-200 hover:bg-red-50 transition-colors">
                    <Icon name="Trash2" size={16} color="#DC2626" />
                </button>
            </div>
        </div>
    );
}
