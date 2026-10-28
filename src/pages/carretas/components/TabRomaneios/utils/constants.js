// Modos de cálculo do frete do romaneio inteiro — 'percentual_pedido' é o
// padrão de sempre (soma o percentual de cada pedido); os outros dois
// substituem esse cálculo por um valor único pro romaneio todo.
export const TIPOS_CALCULO_FRETE_ROMANEIO = [
    { value: 'percentual_pedido', label: 'Percentual por pedido (padrão)' },
    { value: 'percentual_fixo',   label: 'Percentual fixo sobre o valor total' },
    { value: 'valor_fixo',        label: 'Valor fixo em R$ (combinado com o transporte)' },
];

export const inputCls = 'w-full px-3 py-2 rounded-lg border text-sm outline-none transition-all focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500';

export const inputStyle = { borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' };
