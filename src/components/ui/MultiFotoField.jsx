import React, { useRef } from 'react';
import Icon from 'components/AppIcon';

/**
 * MultiFotoField — permite anexar VÁRIAS fotos num checklist (antes só dava
 * pra anexar uma). Guarda cada foto como data-URL base64 num array, igual ao
 * que já era feito com uma foto só (coluna `fotos_urls` jsonb).
 *
 * Props:
 *  - fotos: string[]  (data-URLs ou URLs)
 *  - onChange(novoArray)
 *  - max: número máximo de fotos (default 8)
 */
export default function MultiFotoField({ fotos = [], onChange, max = 8, showToast }) {
    const inputRef = useRef(null);

    const handleFiles = (e) => {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;
        const espacoRestante = max - fotos.length;
        if (espacoRestante <= 0) {
            showToast?.(`Máximo de ${max} fotos por checklist.`, 'error');
            e.target.value = '';
            return;
        }
        const aProcessar = files.slice(0, espacoRestante);
        let pendentes = aProcessar.length;
        const novas = [];
        aProcessar.forEach(file => {
            if (file.size > 5 * 1024 * 1024) {
                showToast?.(`"${file.name}" é maior que 5MB e foi ignorada.`, 'error');
                pendentes -= 1;
                if (pendentes === 0 && novas.length) onChange([...fotos, ...novas]);
                return;
            }
            const reader = new FileReader();
            reader.onload = (ev) => {
                novas.push(ev.target.result);
                pendentes -= 1;
                if (pendentes === 0) onChange([...fotos, ...novas]);
            };
            reader.readAsDataURL(file);
        });
        e.target.value = '';
    };

    const remover = (idx) => onChange(fotos.filter((_, i) => i !== idx));

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <label className="block text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                    📷 Fotos <span className="text-gray-400 font-normal">(opcional, até {max})</span>
                </label>
                {fotos.length > 0 && <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>{fotos.length}/{max}</span>}
            </div>
            <div className="flex flex-wrap gap-2">
                {fotos.map((f, idx) => (
                    <div key={idx} className="relative">
                        <img src={f} alt={`Foto ${idx + 1}`} className="w-20 h-20 rounded-lg border object-cover" style={{ borderColor: 'var(--color-border)' }} />
                        <button type="button" onClick={() => remover(idx)}
                            className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-600 text-white flex items-center justify-center shadow"
                            title="Remover foto">
                            <Icon name="X" size={11} color="white" />
                        </button>
                    </div>
                ))}
                {fotos.length < max && (
                    <button type="button" onClick={() => inputRef.current?.click()}
                        className="w-20 h-20 rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-1 hover:bg-gray-50 transition-colors"
                        style={{ borderColor: '#93C5FD' }}>
                        <Icon name="Camera" size={18} color="#1D4ED8" />
                        <span className="text-[10px] font-medium" style={{ color: '#1D4ED8' }}>Adicionar</span>
                    </button>
                )}
            </div>
            <input ref={inputRef} type="file" accept="image/*" capture="environment" multiple onChange={handleFiles} className="hidden" />
        </div>
    );
}
