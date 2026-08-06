import React from 'react';
import Icon from 'components/AppIcon';

/**
 * ChecklistItemsField — edição dos itens de um checklist (motorista/carreteiro/admin).
 *
 * Para cada item mostra dois botões, "OK" e "Não OK" (inspirado no sistema
 * EXP Frota). Ao marcar "Não OK", abre automaticamente um campo de texto
 * para o motorista descrever o problema daquele item específico.
 *
 * `value` é o objeto `itens` do checklist, no formato:
 *   { [itemId]: { ok: boolean, obs: string, label: string } }
 * O `label` é gravado junto para o histórico continuar correto mesmo que
 * esse item seja depois renomeado/excluído pelo admin.
 *
 * Props:
 *  - itens: [{ id, label }]   lista de itens ativos (vinda do banco)
 *  - value: objeto itens do formulário
 *  - onChange(novoValue)
 */
export default function ChecklistItemsField({ itens = [], value = {}, onChange }) {
    const setItem = (item, patch) => {
        const atual = value[item.id] && typeof value[item.id] === 'object' ? value[item.id] : { ok: !!value[item.id], obs: '' };
        onChange({ ...value, [item.id]: { ...atual, label: item.label, ...patch } });
    };

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-start">
            {itens.map(item => {
                const v = value[item.id];
                const marcado = v !== undefined && v !== null && v !== '';
                const ok = v && typeof v === 'object' ? v.ok : !!v;
                const obs = v && typeof v === 'object' ? (v.obs || '') : '';
                const corBorda = !marcado ? 'var(--color-border)' : ok ? '#A7F3D0' : '#FCA5A5';
                return (
                    <div key={item.id} className="rounded-lg border p-2.5 transition-colors"
                        style={{ borderColor: corBorda, backgroundColor: !marcado ? 'white' : ok ? '#F0FDF4' : '#FFF5F5' }}>
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium leading-tight" style={{ color: 'var(--color-text-primary)' }}>{item.label}</span>
                            <div className="flex items-center gap-1 flex-shrink-0">
                                <button type="button" onClick={() => setItem(item, { ok: true })} title="OK"
                                    className="flex items-center justify-center w-7 h-7 rounded-md border transition-colors"
                                    style={marcado && ok
                                        ? { backgroundColor: '#059669', borderColor: '#059669' }
                                        : { backgroundColor: 'white', borderColor: 'var(--color-border)' }}>
                                    <Icon name="Check" size={14} color={marcado && ok ? 'white' : 'var(--color-muted-foreground)'} />
                                </button>
                                <button type="button" onClick={() => setItem(item, { ok: false })} title="Não OK"
                                    className="flex items-center justify-center w-7 h-7 rounded-md border transition-colors"
                                    style={marcado && !ok
                                        ? { backgroundColor: '#DC2626', borderColor: '#DC2626' }
                                        : { backgroundColor: 'white', borderColor: 'var(--color-border)' }}>
                                    <Icon name="X" size={14} color={marcado && !ok ? 'white' : 'var(--color-muted-foreground)'} />
                                </button>
                            </div>
                        </div>
                        {marcado && !ok && (
                            <div className="mt-2">
                                <textarea
                                    value={obs}
                                    onChange={e => setItem(item, { obs: e.target.value })}
                                    placeholder="Descreva o problema (opcional)..."
                                    rows={2}
                                    className="w-full px-2.5 py-1.5 rounded-md border text-xs outline-none transition-all focus:ring-2 focus:ring-red-500/20 focus:border-red-400"
                                    style={{ borderColor: '#FCA5A5', color: 'var(--color-text-primary)', backgroundColor: 'white' }}
                                />
                            </div>
                        )}
                    </div>
                );
            })}
            {itens.length === 0 && (
                <div className="col-span-full p-4 text-center text-sm rounded-lg border" style={{ color: 'var(--color-muted-foreground)', borderColor: 'var(--color-border)' }}>
                    Nenhum item de checklist cadastrado.
                </div>
            )}
        </div>
    );
}
