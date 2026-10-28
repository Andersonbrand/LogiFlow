import React from 'react';

import { AppIcon as Icon } from 'components';

/* ── Painel esquerdo — branding ─────────────── */
export default function BrandPanel() {
    return (
        <div className="hidden lg:flex flex-col justify-between p-12 relative overflow-hidden"
            style={{ background: 'linear-gradient(145deg, #0F1E35 0%, #1E3A5F 60%, #0D2137 100%)' }}>

            {/* Grid decorativo de fundo */}
            <div className="absolute inset-0 opacity-10"
                style={{
                    backgroundImage: `
                        linear-gradient(rgba(255,255,255,0.15) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(255,255,255,0.15) 1px, transparent 1px)
                    `,
                    backgroundSize: '44px 44px',
                }} />

            {/* Brilho laranja inferior */}
            <div className="absolute -bottom-32 -right-32 w-[480px] h-[480px] rounded-full opacity-15"
                style={{ background: 'radial-gradient(circle, #F97316 0%, transparent 65%)' }} />
            <div className="absolute top-1/4 -left-20 w-72 h-72 rounded-full opacity-5"
                style={{ background: 'radial-gradient(circle, #60A5FA 0%, transparent 70%)' }} />

            {/* Logo */}
            <div className="relative z-10 flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg"
                    style={{ backgroundColor: '#F97316' }}>
                    <Icon name="Truck" size={24} color="#fff" />
                </div>
                <div>
                    <p className="font-black text-2xl text-white tracking-tight leading-none mb-2">LogiFlow</p>
                    <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: '#7DD3FC' }}>
                        Gestão Logística
                    </p>
                </div>
            </div>

            {/* Conteúdo central */}
            <div className="relative z-10 flex-1 flex flex-col justify-center py-16">
                <h2 className="text-4xl font-black text-white leading-snug mb-4">
                    Controle total<br />
                    <span style={{ color: '#FB923C' }}>da sua operação.</span>
                </h2>
                <p className="text-base leading-relaxed mb-10 max-w-xs" style={{ color: '#BAE6FD' }}>
                    Gerencie romaneios, frota e motoristas em tempo real — do carregamento à entrega final.
                </p>

                <div className="flex flex-col gap-3">
                    {[
                        { icon: 'FileText', text: 'Romaneios digitais com aprovação em tempo real' },
                        { icon: 'Truck', text: 'Rastreamento de frota e utilização por veículo' },
                        { icon: 'Award', text: 'Bonificações automáticas por performance' },
                        { icon: 'Map', text: 'Consolidação inteligente de cargas por corredor' },
                    ].map((f, i) => (
                        <div key={i} className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                                style={{
                                    backgroundColor: 'rgba(249,115,22,0.15)',
                                    border: '1px solid rgba(249,115,22,0.4)',
                                }}>
                                <Icon name={f.icon} size={14} color="#FB923C" />
                            </div>
                            <p className="text-sm" style={{ color: '#E0F2FE' }}>{f.text}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Rodapé */}
            <p className="relative z-10 text-xs" style={{ color: '#475569' }}>
                © {new Date().getFullYear()} LogiFlow — Todos os direitos reservados.
            </p>
        </div>
    );
}
