import React, { useState } from 'react';
import { AppIcon as Icon, PrettySelect } from 'components';
import { inputCls, inputStyle } from '../../utils/constants';

// Select com opção de cadastrar um novo valor na hora (catálogo extensível)
export default function SelectComOpcaoNova({ value, onChange, opcoes, onAddNova, placeholder = 'Selecione...' }) {
    const [addMode, setAddMode] = useState(false);
    const [novo, setNovo] = useState('');
    if (addMode) {
        return (
            <div className="flex gap-1.5">
                <input autoFocus value={novo} onChange={e => setNovo(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { onAddNova(novo); setNovo(''); setAddMode(false); } if (e.key === 'Escape') setAddMode(false); }}
                    className={inputCls} style={inputStyle} placeholder="Novo valor..." />
                <button type="button" onClick={() => { if (novo.trim()) { onAddNova(novo); setNovo(''); } setAddMode(false); }}
                    className="px-2.5 rounded-lg text-white text-xs font-semibold" style={{ backgroundColor: '#059669' }}>
                    <Icon name="Check" size={14} color="#fff" />
                </button>
                <button type="button" onClick={() => setAddMode(false)}
                    className="px-2.5 rounded-lg border text-xs" style={{ borderColor: 'var(--color-border)' }}>
                    <Icon name="X" size={14} color="var(--color-muted-foreground)" />
                </button>
            </div>
        );
    }
    return (
        <div className="flex gap-1.5">
            <PrettySelect value={value} onChange={e => onChange(e.target.value)} className={inputCls} style={inputStyle}>
                <option value="">{placeholder}</option>
                {opcoes.map(o => <option key={o} value={o}>{o}</option>)}
            </PrettySelect>
            <button type="button" onClick={() => setAddMode(true)} title="Adicionar novo"
                className="px-2.5 rounded-lg border flex items-center justify-center" style={{ borderColor: 'var(--color-border)' }}>
                <Icon name="Plus" size={14} color="var(--color-primary)" />
            </button>
        </div>
    );
}
