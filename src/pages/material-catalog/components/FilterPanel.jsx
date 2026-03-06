import React from 'react';
import Icon from 'components/AppIcon';
import Button from 'components/ui/Button';

const CATEGORIAS = ['Todas', 'Construção', 'Elétrico', 'Hidráulico', 'Ferramentas', 'Químico', 'Outros'];
const UNIDADES = ['Todas', 'kg', 'ton', 'm³', 'un', 'cx', 'pç'];

export default function FilterPanel({ filters, onChange, onReset, totalCount, filteredCount, mobileOpen, onMobileClose }) {
    const handleChange = (key, val) => onChange({ ...filters, [key]: val });

    const content = (
        <div className="space-y-4">
            <div>
                <label className="block text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide mb-1.5">
                    Categoria
                </label>
                <div className="flex flex-wrap gap-1.5">
                    {CATEGORIAS?.map((c) => (
                        <button
                            key={c}
                            onClick={() => handleChange('categoria', c)}
                            className={`px-3 py-1 rounded-full text-xs font-medium border transition-all duration-150 ${filters?.categoria === c
                                    ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]'
                                    : 'bg-white text-[var(--color-text-secondary)] border-border hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]'
                                }`}
                        >
                            {c}
                        </button>
                    ))}
                </div>
            </div>

            <div>
                <label className="block text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide mb-1.5">
                    Unidade
                </label>
                <div className="flex flex-wrap gap-1.5">
                    {UNIDADES?.map((u) => (
                        <button
                            key={u}
                            onClick={() => handleChange('unidade', u)}
                            className={`px-3 py-1 rounded-full text-xs font-medium border transition-all duration-150 ${filters?.unidade === u
                                    ? 'bg-[var(--color-secondary)] text-white border-[var(--color-secondary)]'
                                    : 'bg-white text-[var(--color-text-secondary)] border-border hover:border-[var(--color-secondary)] hover:text-[var(--color-secondary)]'
                                }`}
                        >
                            {u}
                        </button>
                    ))}
                </div>
            </div>

            <div>
                <label className="block text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide mb-1.5">
                    Peso máximo: <span className="font-data text-[var(--color-text-primary)]">{Number(filters?.pesoMax)?.toLocaleString('pt-BR')} kg</span>
                </label>
                <input
                    type="range"
                    min={0}
                    max={50000}
                    step={100}
                    value={filters?.pesoMax}
                    onChange={(e) => handleChange('pesoMax', Number(e?.target?.value))}
                    className="w-full accent-[var(--color-primary)]"
                />
                <div className="flex justify-between text-xs text-[var(--color-text-secondary)] mt-0.5">
                    <span>0 kg</span>
                    <span>50.000 kg</span>
                </div>
            </div>

            <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-[var(--color-text-secondary)]">
                    Exibindo <span className="font-semibold text-[var(--color-text-primary)]">{filteredCount}</span> de <span className="font-semibold">{totalCount}</span> materiais
                </span>
                <button
                    onClick={onReset}
                    className="text-xs text-[var(--color-primary)] hover:underline flex items-center gap-1"
                >
                    <Icon name="RotateCcw" size={12} color="currentColor" />
                    Limpar filtros
                </button>
            </div>
        </div>
    );

    // Mobile slide-out panel
    if (mobileOpen !== undefined) {
        return (
            <>
                {mobileOpen && (
                    <div className="fixed inset-0 z-[200] flex">
                        <div className="fixed inset-0 bg-black/40" onClick={onMobileClose} />
                        <div className="relative ml-auto w-80 max-w-full bg-[var(--color-card)] h-full shadow-modal flex flex-col z-10">
                            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                                <span className="font-semibold text-[var(--color-text-primary)]">Filtros</span>
                                <button onClick={onMobileClose} className="p-1.5 rounded-md hover:bg-[var(--color-muted)]">
                                    <Icon name="X" size={18} color="currentColor" />
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-4">{content}</div>
                            <div className="p-4 border-t border-border">
                                <Button variant="default" fullWidth onClick={onMobileClose}>Aplicar Filtros</Button>
                            </div>
                        </div>
                    </div>
                )}
            </>
        );
    }

    return (
        <div className="bg-[var(--color-card)] border border-border rounded-lg p-4 shadow-card">
            {content}
        </div>
    );
}