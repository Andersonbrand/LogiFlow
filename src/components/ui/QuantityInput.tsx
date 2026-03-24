'use client';

import React, { useRef } from 'react';
import AppIcon from '@/components/ui/AppIcon';

interface QuantityInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  size?: 'sm' | 'md';
}

export default function QuantityInput({
  value,
  onChange,
  min = 1,
  max = 9999,
  size = 'md',
}: QuantityInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const clamp = (n: number) => Math.min(max, Math.max(min, n));

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    // Permite campo vazio temporariamente enquanto digita
    if (raw === '') { e.target.value = ''; return; }
    const parsed = parseInt(raw, 10);
    if (!isNaN(parsed)) onChange(clamp(parsed));
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    // Se sair do campo vazio ou inválido, restaura o mínimo
    const parsed = parseInt(e.target.value, 10);
    if (isNaN(parsed) || parsed < min) onChange(min);
    else onChange(clamp(parsed));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp')   { e.preventDefault(); onChange(clamp(value + 1)); }
    if (e.key === 'ArrowDown') { e.preventDefault(); onChange(clamp(value - 1)); }
    if (e.key === 'Enter')     inputRef.current?.blur();
  };

  const btnSm = 'w-7 h-7 rounded-lg';
  const btnMd = 'w-9 h-9 rounded-xl';
  const inputSm = 'w-10 text-sm';
  const inputMd = 'w-12 text-base';

  return (
    <div className="flex items-center gap-1 bg-white rounded-xl p-1 border border-border">
      <button
        type="button"
        onClick={() => onChange(clamp(value - 1))}
        disabled={value <= min}
        className={`${size === 'sm' ? btnSm : btnMd} flex items-center justify-center text-muted hover:text-foreground hover:bg-surface disabled:opacity-30 disabled:cursor-not-allowed transition-all`}
        aria-label="Diminuir quantidade"
      >
        <AppIcon name="MinusIcon" size={size === 'sm' ? 12 : 15} />
      </button>

      <input
        ref={inputRef}
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={handleInput}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        onClick={() => inputRef.current?.select()}
        className={`${size === 'sm' ? inputSm : inputMd} text-center font-bold text-foreground bg-transparent border-none outline-none select-all
          [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
        aria-label="Quantidade"
      />

      <button
        type="button"
        onClick={() => onChange(clamp(value + 1))}
        disabled={value >= max}
        className={`${size === 'sm' ? btnSm : btnMd} flex items-center justify-center text-muted hover:text-foreground hover:bg-surface disabled:opacity-30 disabled:cursor-not-allowed transition-all`}
        aria-label="Aumentar quantidade"
      >
        <AppIcon name="PlusIcon" size={size === 'sm' ? 12 : 15} />
      </button>
    </div>
  );
}
