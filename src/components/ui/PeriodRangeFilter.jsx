import React from 'react';

/**
 * PeriodRangeFilter — filtro de período padrão do LogiFlow (data inicial a data final).
 * Usado em todas as telas que precisam filtrar registros por data (despesas,
 * boletos, volume de carregamentos, fretes, etc).
 *
 * Uso:
 *   const [periodoPreset, setPeriodoPreset] = useState('todos');
 *   const [periodo, setPeriodo] = useState({ inicio: '', fim: '' });
 *   <PeriodRangeFilter preset={periodoPreset} onPresetChange={...} periodo={periodo} onPeriodoChange={...} />
 *
 * Ou, de forma mais simples, use o hook usePeriodRangeFilter abaixo.
 */
export default function PeriodRangeFilter({
    preset,
    onPresetChange,
    periodo,
    onPeriodoChange,
    label = null,
    className = '',
    presets = ['todos', 'hoje', 'mes', 'mes_passado', 'personalizado'],
}) {
    const inputCls = 'px-2.5 py-1.5 rounded-lg border text-xs outline-none transition-all focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500';
    const inputStyle = { borderColor: 'var(--color-border)', color: 'var(--color-text-primary)', backgroundColor: 'transparent' };

    const LABELS = {
        todos: 'Sem filtro de data',
        hoje: 'Hoje',
        mes: 'Este mês',
        mes_passado: 'Mês passado',
        personalizado: 'Período',
    };

    return (
        <div className={`flex flex-wrap items-end gap-2 ${className}`}>
            <div className="flex gap-1.5">
                {presets.map(p => (
                    <button key={p} type="button" onClick={() => onPresetChange(p)}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap"
                        style={preset === p
                            ? { backgroundColor: '#EFF6FF', color: '#1D4ED8', borderColor: '#BFDBFE' }
                            : { borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                        {LABELS[p] || p}
                    </button>
                ))}
            </div>
            {preset === 'personalizado' && (
                <div className="flex items-center gap-2">
                    <div>
                        <label className="text-[11px] block mb-0.5" style={{ color: 'var(--color-muted-foreground)' }}>{label ? `${label} de` : 'De'}</label>
                        <input type="date" value={periodo.inicio} onChange={e => onPeriodoChange({ ...periodo, inicio: e.target.value })} className={inputCls} style={inputStyle} />
                    </div>
                    <div>
                        <label className="text-[11px] block mb-0.5" style={{ color: 'var(--color-muted-foreground)' }}>até</label>
                        <input type="date" value={periodo.fim} onChange={e => onPeriodoChange({ ...periodo, fim: e.target.value })} className={inputCls} style={inputStyle} />
                    </div>
                </div>
            )}
        </div>
    );
}

/** Calcula { inicio, fim } (ISO yyyy-mm-dd) a partir de um preset. 'todos' e
 *  'personalizado' retornam o objeto de período informado (sem alteração
 *  automática — 'personalizado' é editado manualmente pelo usuário). */
export function calcularPeriodoPreset(preset, periodoAtual) {
    const h = new Date(); h.setHours(0, 0, 0, 0);
    const y = h.getFullYear(), m = h.getMonth();
    const pad = n => String(n).padStart(2, '0');
    if (preset === 'hoje') {
        const d = `${y}-${pad(m + 1)}-${pad(h.getDate())}`;
        return { inicio: d, fim: d };
    }
    if (preset === 'mes') {
        return { inicio: `${y}-${pad(m + 1)}-01`, fim: `${y}-${pad(m + 1)}-${pad(new Date(y, m + 1, 0).getDate())}` };
    }
    if (preset === 'mes_passado') {
        const mp = new Date(y, m - 1, 1);
        return { inicio: `${mp.getFullYear()}-${pad(mp.getMonth() + 1)}-01`, fim: `${mp.getFullYear()}-${pad(mp.getMonth() + 1)}-${pad(new Date(mp.getFullYear(), mp.getMonth() + 1, 0).getDate())}` };
    }
    if (preset === 'todos') return { inicio: '', fim: '' };
    return periodoAtual; // 'personalizado' — mantém o que o usuário digitou
}

/** Hook completo: estado de preset + período, pronto para plugar em qualquer tela. */
export function usePeriodRangeFilter(initialPreset = 'todos') {
    const [preset, setPreset] = React.useState(initialPreset);
    const [periodo, setPeriodo] = React.useState(() => calcularPeriodoPreset(initialPreset, { inicio: '', fim: '' }));

    const onPresetChange = React.useCallback((p) => {
        setPreset(p);
        setPeriodo(prev => calcularPeriodoPreset(p, prev));
    }, []);

    const reset = React.useCallback(() => { setPreset('todos'); setPeriodo({ inicio: '', fim: '' }); }, []);

    return { preset, periodo, setPeriodo, onPresetChange, reset };
}
