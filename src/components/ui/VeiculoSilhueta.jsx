import React from 'react';

/**
 * VeiculoSilhueta — esboço lateral simplificado do veículo (cabine + eixos),
 * no mesmo espírito da coluna "Esboço do Veículo" da referência que o
 * Anderson enviou. Serve só de apoio visual acima do diagrama de posições
 * (vista de cima) — não é clicável.
 *
 * tipo: 'caminhao_leve' | 'truck' | 'bitruck' | 'rodotrem'
 */
export default function VeiculoSilhueta({ tipo, className = '' }) {
    const roda = (cx, filled = true) => (
        <circle cx={cx} cy="40" r="5.5" fill={filled ? '#334155' : '#fff'} stroke="#334155" strokeWidth="1.6" />
    );
    const cabine = (x) => (
        <path d={`M${x} 34 L${x} 18 Q${x} 14 ${x + 4} 14 L${x + 14} 14 L${x + 14} 34 Z`} fill="#CBD5E1" stroke="#64748B" strokeWidth="1.2" />
    );
    const carroceria = (x, w) => (
        <rect x={x} y="18" width={w} height="16" fill="#E2E8F0" stroke="#94A3B8" strokeWidth="1.2" />
    );

    let content;
    if (tipo === 'caminhao_leve') {
        content = (
            <>
                {cabine(6)}
                {carroceria(22, 58)}
                {roda(16)} {roda(72)}
            </>
        );
    } else if (tipo === 'truck') {
        content = (
            <>
                {cabine(6)}
                {carroceria(22, 68)}
                {roda(16)} {roda(78)} {roda(90)}
            </>
        );
    } else if (tipo === 'bitruck') {
        content = (
            <>
                {cabine(4)}
                {carroceria(20, 96)}
                {roda(14)} {roda(28)} {roda(94)} {roda(108)}
            </>
        );
    } else { // rodotrem / bitrem — cavalo + dois reboques
        content = (
            <>
                {cabine(4)}
                {carroceria(20, 54)}
                {roda(14)} {roda(58)} {roda(70)}
                <rect x="80" y="18" width="60" height="16" fill="#E2E8F0" stroke="#94A3B8" strokeWidth="1.2" />
                {roda(120)} {roda(132)} {roda(144)}
                <rect x="146" y="18" width="60" height="16" fill="#E2E8F0" stroke="#94A3B8" strokeWidth="1.2" />
                {roda(186)} {roda(198)} {roda(210)}
            </>
        );
    }

    const viewBoxW = tipo === 'rodotrem' ? 220 : tipo === 'bitruck' ? 130 : 110;

    return (
        <svg viewBox={`0 0 ${viewBoxW} 50`} className={className} style={{ width: '100%', height: 'auto', maxHeight: 60 }}>
            <line x1="0" y1="40" x2={viewBoxW} y2="40" stroke="#E2E8F0" strokeWidth="1.5" />
            {content}
        </svg>
    );
}
