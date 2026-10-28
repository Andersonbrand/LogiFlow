import { useEffect, useState } from 'react';
import { getTier } from 'config/mobileDevices';

// Lê o tamanho da tela e publica a faixa no <html> (data-tier / data-orientation),
// para o CSS e o JSX reagirem ao aparelho. Atualiza ao girar o celular ou
// redimensionar. Leve: um listener, com throttle por animation frame.
//
// const { tier, isCompact, isLandscape } = useDeviceProfile();
function ler() {
    const largura = typeof window !== 'undefined' ? window.innerWidth : 1024;
    const altura  = typeof window !== 'undefined' ? window.innerHeight : 768;
    const tier = getTier(largura);
    return {
        largura, altura, tier,
        isLandscape: largura > altura,
        isCompact: tier === 'xxs' || tier === 'xs',       // telas de até 374px
        isPhone: tier !== 'tablet' && tier !== 'lg',      // até 479px
    };
}

export default function useDeviceProfile() {
    const [perfil, setPerfil] = useState(ler);

    useEffect(() => {
        let raf = 0;
        const aplicar = () => {
            const p = ler();
            document.documentElement.dataset.tier = p.tier;
            document.documentElement.dataset.orientation = p.isLandscape ? 'landscape' : 'portrait';
            setPerfil(prev => (prev.tier === p.tier && prev.isLandscape === p.isLandscape && prev.largura === p.largura ? prev : p));
        };
        const aoMudar = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(aplicar); };
        aplicar();
        window.addEventListener('resize', aoMudar);
        window.addEventListener('orientationchange', aoMudar);
        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener('resize', aoMudar);
            window.removeEventListener('orientationchange', aoMudar);
        };
    }, []);

    return perfil;
}
