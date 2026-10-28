import React from 'react';

// ─── Banner ilustrativo do módulo (SVG original, com pneu girando em CSS) ───
export default function PneusBanner() {
    return (
        <div className="relative overflow-hidden rounded-2xl" style={{ background: 'linear-gradient(120deg, #0F172A 0%, #1D4ED8 55%, #2563EB 100%)' }}>
            <style>{`
                @keyframes girarPneu { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                @keyframes girarPneuLento { from { transform: rotate(360deg); } to { transform: rotate(0deg); } }
                .pneu-banner-roda-grande { animation: girarPneu 9s linear infinite; transform-origin: center; }
                .pneu-banner-roda-pequena { animation: girarPneuLento 6s linear infinite; transform-origin: center; }
            `}</style>

            {/* Pontinhos decorativos de fundo */}
            <svg className="absolute inset-0 w-full h-full opacity-[0.08]" preserveAspectRatio="xMidYMid slice">
                <pattern id="pneusGridPattern" width="26" height="26" patternUnits="userSpaceOnUse">
                    <circle cx="2" cy="2" r="1.4" fill="#fff" />
                </pattern>
                <rect width="100%" height="100%" fill="url(#pneusGridPattern)" />
            </svg>

            <div className="relative flex items-center justify-between gap-4 px-6 py-6 sm:px-8 sm:py-7">
                <div>
                    <p className="text-[11px] font-bold uppercase tracking-widest mb-1" style={{ color: '#93C5FD' }}>Módulo · Frota</p>
                    <h2 className="text-xl sm:text-2xl font-black text-white mb-1">Gestão de Pneus</h2>
                    <p className="text-sm max-w-md" style={{ color: '#BFDBFE' }}>
                        Controle a vida útil, o rendimento por marca e o saldo de compras dos pneus da frota própria.
                    </p>
                </div>

                {/* Ilustração: pneu grande girando + dois pneus menores ao fundo */}
                <div className="relative hidden sm:flex items-center justify-center flex-shrink-0" style={{ width: 150, height: 110 }}>
                    <svg className="pneu-banner-roda-pequena absolute" style={{ left: -6, bottom: -4, opacity: 0.55 }} width="52" height="52" viewBox="0 0 52 52">
                        <PneuSVG />
                    </svg>
                    <svg className="pneu-banner-roda-pequena absolute" style={{ right: -10, top: -6, opacity: 0.4 }} width="40" height="40" viewBox="0 0 52 52">
                        <PneuSVG />
                    </svg>
                    <svg className="pneu-banner-roda-grande relative" width="104" height="104" viewBox="0 0 52 52">
                        <PneuSVG />
                    </svg>
                </div>
            </div>
        </div>
    );
}

// Ilustração original de um pneu (aro + carcaça + banda de rodagem), em SVG puro
function PneuSVG() {
    return (
        <g>
            <circle cx="26" cy="26" r="24" fill="#0B1220" stroke="#334155" strokeWidth="1.5" />
            {Array.from({ length: 16 }).map((_, i) => {
                const ang = (i * 360) / 16;
                return (
                    <rect key={i} x="25.1" y="2.5" width="1.8" height="6" rx="0.9" fill="#475569"
                        transform={`rotate(${ang} 26 26)`} />
                );
            })}
            <circle cx="26" cy="26" r="15.5" fill="#1E293B" stroke="#475569" strokeWidth="1" />
            <circle cx="26" cy="26" r="9.5" fill="#334155" stroke="#64748B" strokeWidth="1" />
            {Array.from({ length: 6 }).map((_, i) => {
                const ang = (i * 360) / 6;
                return <circle key={i} cx="26" cy="19" r="1.3" fill="#94A3B8" transform={`rotate(${ang} 26 26)`} />;
            })}
            <circle cx="26" cy="26" r="2.6" fill="#CBD5E1" />
        </g>
    );
}
