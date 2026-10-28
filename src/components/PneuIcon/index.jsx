import React from 'react';

/**
 * PneuIcon — desenho de um pneu (visto de frente/lateral, "face do pneu"),
 * usado tanto no diagrama de posições (vista de cima do veículo, onde cada
 * roda é desenhada como um pneu individual) quanto na silhueta lateral do
 * veículo. Não é um componente <svg> completo — é um <g> pra ser colocado
 * dentro de um <svg> já existente, centrado em (cx, cy).
 *
 * props:
 *  - cx, cy: centro do pneu, nas coordenadas do SVG pai
 *  - r: raio externo do pneu (banda de rodagem)
 *  - corAnel: cor do contorno/aro — usada pro código de cores (tipo de
 *    eixo D/T/A, ou verde quando selecionado, âmbar quando já em uso)
 *  - corMiolo: cor de preenchimento do centro do aro
 *  - strokeWidth: espessura do contorno externo
 *  - detalhado: quando true (padrão), desenha blocos de banda de rodagem +
 *    parafusos do aro — usado no diagrama grande. Quando false, desenha uma
 *    versão simplificada (só tira + aro) — usada na silhueta lateral, onde
 *    o pneu aparece muito pequeno e o detalhe extra só poluiria o desenho.
 */
export default function PneuIcon({ cx, cy, r, corAnel = '#334155', corMiolo = '#94A3B8', strokeWidth = 1, detalhado = true }) {
    const nBlocos = detalhado ? 16 : 10;
    const rParedeIn = r * 0.78;
    const rParedeOut = r * 0.98;
    const rHub = r * (detalhado ? 0.46 : 0.5);

    return (
        <g>
            {/* Banda de rodagem — corpo de borracha escura do pneu */}
            <circle cx={cx} cy={cy} r={r} fill="#1C2128" stroke={corAnel} strokeWidth={strokeWidth} />

            {/* Blocos de desenho da banda de rodagem — pequenos traços grossos
                em ziguezague ao redor da borda, simulando os tacos do pneu */}
            {Array.from({ length: nBlocos }).map((_, i) => {
                const ang = (i / nBlocos) * Math.PI * 2 + (detalhado ? 0.06 : 0);
                const rIn = r * 0.66, rOut = r * 0.94;
                const x1 = cx + Math.cos(ang) * rIn, y1 = cy + Math.sin(ang) * rIn;
                const x2 = cx + Math.cos(ang) * rOut, y2 = cy + Math.sin(ang) * rOut;
                return (
                    <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
                        stroke="#4B5563" strokeWidth={r * 0.16} strokeLinecap="round" />
                );
            })}

            {/* Parede lateral (sidewall) — anel mais claro entre a banda de
                rodagem e o aro, dá profundidade/volume ao pneu */}
            <circle cx={cx} cy={cy} r={rParedeIn} fill="#2A313C" />
            {detalhado && (
                <circle cx={cx} cy={cy} r={rParedeOut * 0.86} fill="none" stroke="#374151" strokeWidth={r * 0.05} opacity={0.6} />
            )}

            {/* Aro/miolo — muda de cor conforme o status da posição (livre, selecionado, em uso) */}
            <circle cx={cx} cy={cy} r={rHub} fill={corMiolo} stroke={corAnel} strokeWidth={strokeWidth * 0.7} />

            {/* Parafusos do aro (só na versão detalhada, no diagrama grande) */}
            {detalhado && Array.from({ length: 5 }).map((_, i) => {
                const ang = (i / 5) * Math.PI * 2 - Math.PI / 2;
                const rp = rHub * 0.55;
                const x = cx + Math.cos(ang) * rp, y = cy + Math.sin(ang) * rp;
                return <circle key={i} cx={x} cy={y} r={rHub * 0.16} fill={corAnel} opacity={0.8} />;
            })}
        </g>
    );
}
