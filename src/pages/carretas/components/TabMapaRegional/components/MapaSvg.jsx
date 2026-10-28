import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MAPA_VIEWBOX, BAHIA_PATH, VIZINHOS_PATHS } from '../data/bahiaGeo';
import { POLOS } from '../utils/regioes';
import { fMetrica } from '../utils/format';

const COR_POLO = Object.fromEntries(POLOS.map(p => [p.id, p.cor]));
const corMargem = pct => (pct == null ? '#94A3B8' : pct >= 25 ? '#22C55E' : pct >= 10 ? '#EAB308' : pct >= 0 ? '#F97316' : '#EF4444');

function limitesFoco(cidades) {
    const pts = cidades.filter(c => c.atendida);
    const base = pts.length >= 2 ? pts : cidades;
    if (!base.length) return { x: 0, y: 0, w: MAPA_VIEWBOX.w, h: MAPA_VIEWBOX.h };
    const xs = base.map(c => c.x), ys = base.map(c => c.y);
    const pad = 140;
    let x = Math.min(...xs) - pad, y = Math.min(...ys) - pad;
    let w = Math.max(...xs) - Math.min(...xs) + pad * 2, h = Math.max(...ys) - Math.min(...ys) + pad * 2;
    const r = 1; // proporção alvo
    if (w / h < r) { const nw = h * r; x -= (nw - w) / 2; w = nw; } else { const nh = w / r; y -= (nh - h) / 2; h = nh; }
    return { x, y, w, h };
}

export default function MapaSvg({ cidades, metrica, modoCor, selecionada, onSelecionar, regiaoDestaque, foco }) {
    const [hover, setHover] = useState(null);
    const alvo = useMemo(() => (foco ? limitesFoco(cidades) : { x: 0, y: 0, w: MAPA_VIEWBOX.w, h: MAPA_VIEWBOX.h }), [foco, cidades]);
    const [vb, setVb] = useState(alvo);
    const vbRef = useRef(alvo);
    useEffect(() => {
        let raf; const ini = { ...vbRef.current }; const t0 = performance.now();
        const passo = now => {
            const t = Math.min(1, (now - t0) / 650), e = 1 - Math.pow(1 - t, 3);
            const v = { x: ini.x + (alvo.x - ini.x) * e, y: ini.y + (alvo.y - ini.y) * e, w: ini.w + (alvo.w - ini.w) * e, h: ini.h + (alvo.h - ini.h) * e };
            vbRef.current = v; setVb(v);
            if (t < 1) raf = requestAnimationFrame(passo);
        };
        raf = requestAnimationFrame(passo);
        return () => cancelAnimationFrame(raf);
    }, [alvo]);

    const escala = vb.w / MAPA_VIEWBOX.w; // mantém tamanhos visuais ao dar zoom
    const max = useMemo(() => Math.max(1, ...cidades.map(c => Number(c[metrica.campo]) || 0)), [cidades, metrica]);
    const atendidas = cidades.filter(c => c.atendida);
    const topo = useMemo(() => new Set([...atendidas].sort((a, b) => (b[metrica.campo] || 0) - (a[metrica.campo] || 0)).slice(0, 5).map(c => c.chave)), [atendidas, metrica]);
    const raio = c => (7 + Math.sqrt(Math.max(0, Number(c[metrica.campo]) || 0) / max) * 26) * Math.max(0.45, escala);
    const cor = c => (modoCor === 'margem' ? corMargem(c.margemRealPct) : COR_POLO[c.polo] || '#3B82F6');
    const ativa = hover || selecionada;
    const rotulos = (() => {
        const lim = 30 * Math.max(0.6, escala), out = [];
        const cand = cidades.filter(c => c.chave === ativa || topo.has(c.chave)).sort((a, b) => (b.chave === ativa) - (a.chave === ativa));
        cand.forEach(c => { if (!out.some(o => Math.abs(o.x - c.x) < lim * 3.2 && Math.abs(o.y - c.y) < lim)) out.push(c); });
        return out;
    })();
    const hoverCid = hover ? cidades.find(c => c.chave === hover) : null;

    // tooltip em coordenadas relativas ao svg
    const tip = hoverCid && {
        left: `${((hoverCid.x - vb.x) / vb.w) * 100}%`,
        top: `${((hoverCid.y - vb.y) / vb.h) * 100}%`,
    };

    return (
        <div className="relative w-full rounded-2xl overflow-hidden select-none"
            style={{ background: 'radial-gradient(120% 90% at 30% 20%, #16335f 0%, #0b1a33 55%, #070f1f 100%)', aspectRatio: '1 / 1' }}>
            <svg viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} className="absolute inset-0 w-full h-full" role="img" aria-label="Mapa regional da Bahia">
                <defs>
                    <linearGradient id="mrTerra" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#2b5ea8" /><stop offset="100%" stopColor="#14325f" />
                    </linearGradient>
                    <pattern id="mrGrade" width="40" height="40" patternUnits="userSpaceOnUse">
                        <path d="M40 0H0V40" fill="none" stroke="rgba(148,197,255,0.07)" strokeWidth="1" />
                    </pattern>
                    <filter id="mrGlow" x="-60%" y="-60%" width="220%" height="220%">
                        <feGaussianBlur stdDeviation="6" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                    </filter>
                    <filter id="mrSombra" x="-10%" y="-10%" width="120%" height="125%">
                        <feDropShadow dx="0" dy="10" stdDeviation="12" floodColor="#000" floodOpacity="0.55" />
                    </filter>
                    <style>{`
                        @keyframes mrPulso { 0% { r: var(--r0); opacity: .75 } 100% { r: var(--r1); opacity: 0 } }
                        .mr-pulso { animation: mrPulso 2.6s ease-out infinite; }
                            @media (prefers-reduced-motion: reduce) { .mr-pulso { animation: none } }
                    `}</style>
                </defs>
                <rect x={-400} y={-400} width={MAPA_VIEWBOX.w + 800} height={MAPA_VIEWBOX.h + 800} fill="url(#mrGrade)" />
                {(Array.isArray(VIZINHOS_PATHS) ? VIZINHOS_PATHS : Object.values(VIZINHOS_PATHS)).map((d, i) => (
                    <path key={i} d={typeof d === 'string' ? d : d.d} fill="#0f2447" stroke="rgba(148,197,255,0.12)" strokeWidth={1} />
                ))}
                <path d={BAHIA_PATH} fill="url(#mrTerra)" stroke="#7db4ff" strokeWidth={1.6 * Math.max(0.6, escala)} strokeLinejoin="round" filter="url(#mrSombra)" />
                <path d={BAHIA_PATH} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth={0.6} />

                {/* cidades sem atendimento */}
                {cidades.filter(c => !c.atendida).map(c => (
                    <g key={c.chave} onMouseEnter={() => setHover(c.chave)} onMouseLeave={() => setHover(null)} onClick={() => onSelecionar(c.chave)} style={{ cursor: 'pointer' }}>
                        <circle cx={c.x} cy={c.y} r={6 * Math.max(0.5, escala)} fill="rgba(15,36,71,.8)" stroke="#94A3B8" strokeWidth={1.2} strokeDasharray="3 3" opacity={regiaoDestaque && regiaoDestaque !== c.polo ? 0.25 : 0.9} />
                    </g>
                ))}

                {/* cidades atendidas */}
                {[...atendidas].sort((a, b) => raio(b) - raio(a)).map(c => {
                    const r = raio(c), k = cor(c);
                    const apagada = regiaoDestaque && regiaoDestaque !== c.polo;
                    return (
                        <g key={c.chave} opacity={apagada ? 0.22 : 1} style={{ cursor: 'pointer', transition: 'opacity .25s' }}
                            onMouseEnter={() => setHover(c.chave)} onMouseLeave={() => setHover(null)} onClick={() => onSelecionar(c.chave)}>
                            {topo.has(c.chave) && <circle className="mr-pulso" cx={c.x} cy={c.y} fill="none" stroke={k} strokeWidth={2} style={{ '--r0': `${r}px`, '--r1': `${r * 2.3}px` }} r={r} />}
                            <circle cx={c.x} cy={c.y} r={r * 1.25} fill={k} opacity={0.22} filter="url(#mrGlow)" />
                            <circle cx={c.x} cy={c.y} r={r} fill={k} fillOpacity={0.88} stroke="#fff" strokeWidth={(ativa === c.chave ? 3 : 1.4) * Math.max(0.6, escala)} />
                            <circle cx={c.x - r * 0.28} cy={c.y - r * 0.3} r={r * 0.32} fill="#fff" opacity={0.35} />
                        </g>
                    );
                })}

                {/* rótulos */}
                {rotulos.map(c => (
                    <text key={'t' + c.chave} x={c.x} y={c.y - raio(c) - 7 * Math.max(0.6, escala)} textAnchor="middle"
                        fontSize={13 * Math.max(0.6, escala)} fontWeight="700" fill="#fff" stroke="#07101f" strokeWidth={3.5 * Math.max(0.6, escala)} paintOrder="stroke" style={{ pointerEvents: 'none' }}>
                        {c.nome}
                    </text>
                ))}
            </svg>

            {hoverCid && (
                <div className="absolute z-10 pointer-events-none -translate-x-1/2 -translate-y-full px-3 py-2 rounded-xl text-xs shadow-2xl border"
                    style={{ ...tip, marginTop: -14, background: 'rgba(7,16,31,.94)', color: '#E2E8F0', borderColor: 'rgba(125,180,255,.35)', minWidth: 170 }}>
                    <p className="font-bold text-sm text-white">{hoverCid.nome}</p>
                    {hoverCid.atendida ? (
                        <>
                            <p>{hoverCid.viagens} viagens · {fMetrica('num', hoverCid.sacos)} sacos</p>
                            <p>Venda {fMetrica('brl', hoverCid.venda)} · Frete {fMetrica('brl', hoverCid.frete)}</p>
                            <p className="font-semibold" style={{ color: corMargem(hoverCid.margemRealPct) }}>Margem bruta {fMetrica('brl', hoverCid.margemReal)}</p>
                        </>
                    ) : <p style={{ color: '#FCA5A5' }}>Sem atendimento no período</p>}
                </div>
            )}
        </div>
    );
}
