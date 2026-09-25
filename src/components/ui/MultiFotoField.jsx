import React, { useRef, useState } from 'react';
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
 *
 * Correção (ago/2026): motoristas anexando 8 fotos tiradas direto da câmera
 * do celular só conseguiam enviar 1. Duas causas:
 *  1) O input tinha `capture="environment"` junto de `multiple` — em boa
 *     parte dos navegadores mobile (Safari iOS, Chrome Android) essa
 *     combinação abre a câmera em modo de captura única e ignora a seleção
 *     múltipla da galeria, mesmo com `multiple` presente.
 *  2) Fotos de câmera de celular costumam vir com vários MB (às vezes
 *     8-12MB), acima do limite de 5MB que existia aqui — a maioria das
 *     fotos era descartada silenciosamente (o toast de erro de uma foto
 *     sumia antes do usuário perceber que outras também tinham falhado).
 * Agora cada foto é redimensionada/comprimida no navegador (canvas) antes de
 * virar data-URL, então fica bem menor que o original e não esbarra em
 * limite nenhum — e o input deixa de forçar a câmera, permitindo escolher
 * várias fotos de uma vez na galeria.
 */

const MAX_DIMENSAO = 1600; // px no maior lado, suficiente para checklist
const QUALIDADE_JPEG = 0.75;

function comprimirImagem(file, maxDim = MAX_DIMENSAO, qualidade = QUALIDADE_JPEG) {
    return new Promise((resolve, reject) => {
        const leitor = new FileReader();
        leitor.onerror = () => reject(new Error('Falha ao ler o arquivo'));
        leitor.onload = (ev) => {
            const img = new Image();
            img.onerror = () => reject(new Error('Falha ao decodificar a imagem'));
            img.onload = () => {
                let { width, height } = img;
                if (width > maxDim || height > maxDim) {
                    if (width >= height) {
                        height = Math.round((height * maxDim) / width);
                        width = maxDim;
                    } else {
                        width = Math.round((width * maxDim) / height);
                        height = maxDim;
                    }
                }
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', qualidade));
            };
            img.src = ev.target.result;
        };
        leitor.readAsDataURL(file);
    });
}

export default function MultiFotoField({ fotos = [], onChange, max = 8, showToast }) {
    const inputCameraRef = useRef(null);
    const inputGaleriaRef = useRef(null);
    const [processando, setProcessando] = useState(false);

    const handleFiles = async (e) => {
        const files = Array.from(e.target.files || []);
        e.target.value = ''; // libera pra poder re-selecionar o mesmo arquivo depois
        if (!files.length) return;

        const espacoRestante = max - fotos.length;
        if (espacoRestante <= 0) {
            showToast?.(`Máximo de ${max} fotos por checklist.`, 'error');
            return;
        }

        const aProcessar = files.slice(0, espacoRestante);
        if (files.length > aProcessar.length) {
            showToast?.(`Só cabiam mais ${aProcessar.length} foto(s) (limite de ${max}); o restante foi ignorado.`, 'error');
        }

        setProcessando(true);
        // Processa uma foto de cada vez (evita picos de memória com várias
        // fotos grandes de câmera abertas ao mesmo tempo no navegador).
        const novas = [];
        const comFalha = [];
        for (const file of aProcessar) {
            if (!file.type || !file.type.startsWith('image/')) {
                comFalha.push(file.name);
                continue;
            }
            try {
                const dataUrl = await comprimirImagem(file);
                novas.push(dataUrl);
            } catch (err) {
                console.error('Falha ao processar foto do checklist:', file.name, err);
                comFalha.push(file.name);
            }
        }
        setProcessando(false);

        if (novas.length) onChange([...fotos, ...novas]);
        if (comFalha.length) {
            showToast?.(`Não foi possível processar ${comFalha.length} foto(s). Tente novamente.`, 'error');
        }
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
                    <>
                        <button type="button" onClick={() => inputCameraRef.current?.click()} disabled={processando}
                            className="w-20 h-20 rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-1 hover:bg-gray-50 transition-colors disabled:opacity-60"
                            style={{ borderColor: '#93C5FD' }} title="Tirar foto com a câmera">
                            {processando ? (
                                <div className="animate-spin h-4 w-4 rounded-full border-2" style={{ borderColor: '#1D4ED8', borderTopColor: 'transparent' }} />
                            ) : (
                                <Icon name="Camera" size={18} color="#1D4ED8" />
                            )}
                            <span className="text-[10px] font-medium" style={{ color: '#1D4ED8' }}>{processando ? 'Aguarde...' : 'Câmera'}</span>
                        </button>
                        <button type="button" onClick={() => inputGaleriaRef.current?.click()} disabled={processando}
                            className="w-20 h-20 rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-1 hover:bg-gray-50 transition-colors disabled:opacity-60"
                            style={{ borderColor: '#C4B5FD' }} title="Escolher fotos da galeria">
                            {processando ? (
                                <div className="animate-spin h-4 w-4 rounded-full border-2" style={{ borderColor: '#7C3AED', borderTopColor: 'transparent' }} />
                            ) : (
                                <Icon name="Image" size={18} color="#7C3AED" />
                            )}
                            <span className="text-[10px] font-medium" style={{ color: '#7C3AED' }}>{processando ? 'Aguarde...' : 'Galeria'}</span>
                        </button>
                    </>
                )}
            </div>
            {/* Dois inputs separados — em vez de um só e ambíguo:
                - Câmera: `capture="environment"` sem `multiple` (foto única,
                  abre a câmera direto e de forma confiável em qualquer
                  aparelho, já que não compete com a seleção múltipla).
                - Galeria: sem `capture`, com `multiple` (várias fotos de
                  uma vez, sem forçar/tentar a câmera).
                Antes havia um único input sem `capture` esperando que o
                próprio SO oferecesse a opção de câmera no seletor — mas em
                vários aparelhos/navegadores isso não acontece e só a
                galeria é aberta, sem alternativa de tirar foto na hora. */}
            <input ref={inputCameraRef} type="file" accept="image/*" capture="environment" onChange={handleFiles} className="hidden" />
            <input ref={inputGaleriaRef} type="file" accept="image/*" multiple onChange={handleFiles} className="hidden" />
        </div>
    );
}
