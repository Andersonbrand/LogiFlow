import React from 'react';
import Icon from 'components/AppIcon';
import SelectBusca from 'components/ui/SelectBusca';

/**
 * CidadesAdicionaisField — mesma ideia das "Paradas intermediárias" que já
 * existem no romaneio de caminhões: permite adicionar mais de uma cidade além
 * da cidade/destino principal do registro, quando fizer sentido (ex.: uma
 * mesma viagem de carreta que passa por mais de uma cidade de entrega).
 *
 * Opcional por natureza — começa vazio ("[]") e não muda nada no
 * comportamento de quem só usa uma cidade.
 *
 * `cidades`: lista de nomes de cidade já cadastradas, pra sugestão no combo
 * `value`: array de strings (cidades adicionais já escolhidas)
 * `onChange(novoArray)`
 */
export default function CidadesAdicionaisField({ cidades = [], value = [], onChange, label = 'Cidades adicionais' }) {
    const paradas = Array.isArray(value) ? value : [];

    const addCidade = () => onChange([...paradas, '']);
    const setCidade = (idx, v) => onChange(paradas.map((c, i) => i === idx ? v : c));
    const removeCidade = (idx) => onChange(paradas.filter((_, i) => i !== idx));

    return (
        <div className="rounded-lg border p-3 flex flex-col gap-2" style={{ borderColor: 'var(--color-border)' }}>
            <div className="flex items-center justify-between">
                <span className="text-xs font-semibold font-caption" style={{ color: 'var(--color-text-primary)' }}>
                    {label} ({paradas.length})
                </span>
                <button type="button"
                    onClick={addCidade}
                    className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-colors"
                    style={{ backgroundColor: 'var(--color-primary)', color: '#fff' }}>
                    <Icon name="Plus" size={12} color="#fff" /> Adicionar cidade
                </button>
            </div>
            {paradas.length === 0 && (
                <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                    Só precisa preencher se essa viagem/registro envolver mais de uma cidade.
                </p>
            )}
            {paradas.map((p, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                    <span className="text-xs text-gray-400 w-4">{idx + 1}.</span>
                    <div className="flex-1">
                        <SelectBusca
                            options={
                                p && !cidades.includes(p)
                                    ? [{ value: p, label: p, sublabel: 'valor atual' }, ...cidades.map(c => ({ value: c, label: c }))]
                                    : cidades.map(c => ({ value: c, label: c }))
                            }
                            value={p}
                            placeholder="Selecione a cidade"
                            allowCustom
                            customValue={p}
                            customPlaceholder="Cidade, UF"
                            onCustomSubmit={v => setCidade(idx, v)}
                            onSelect={opt => setCidade(idx, opt.value)}
                        />
                    </div>
                    <button type="button" onClick={() => removeCidade(idx)}>
                        <Icon name="X" size={14} color="#DC2626" />
                    </button>
                </div>
            ))}
        </div>
    );
}

/** Helpers de (de)serialização — paradas fica salvo como jsonb no banco, mas
 * alguns pontos do app ainda podem receber/enviar como string JSON (mesmo
 * padrão tolerante já usado pro campo `paradas` de romaneios de caminhão). */
export function parseParadas(raw) {
    if (Array.isArray(raw)) return raw.filter(Boolean);
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
    } catch { return []; }
}
