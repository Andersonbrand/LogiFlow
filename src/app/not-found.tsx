import React from 'react';
import Link from 'next/link';
import AppLogo from '@/components/ui/AppLogo';
import AppIcon from '@/components/ui/AppIcon';

export default function NotFound() {
    return (
        <main className="min-h-screen bg-white flex items-center justify-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px]" />
            <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-accent/4 rounded-full blur-[100px]" />

            <div className="relative z-10 text-center space-y-8 max-w-md mx-auto px-6">
                <div className="flex justify-center">
                    <AppLogo size={56} />
                </div>

                <div className="space-y-3">
                    <p className="text-[10px] uppercase tracking-[0.4em] font-bold text-accent">Erro 404</p>
                    <h1 className="text-6xl font-display font-bold text-gradient-blue">Ops!</h1>
                    <p className="text-xl font-bold text-foreground">Página não encontrada</p>
                    <p className="text-muted leading-relaxed">
                        A página que você está procurando não existe ou foi movida.
                    </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Link
                        href="/homepage"
                        className="px-8 py-3.5 rounded-xl bg-primary text-white text-[12px] font-bold uppercase tracking-widest hover:bg-primary-dark transition-all shadow-blue-lg"
                    >
                        Ir para o Início
                    </Link>
                    <Link
                        href="/products"
                        className="px-8 py-3.5 rounded-xl border border-border text-[12px] font-bold uppercase tracking-widest text-muted hover:text-foreground hover:border-foreground/30 transition-all flex items-center justify-center gap-2"
                    >
                        <AppIcon name="Squares2X2Icon" size={14} />
                        Ver Produtos
                    </Link>
                </div>
            </div>
        </main>
    );
}
