import { useMemo } from 'react';
import { usePagination } from 'components';
import { calcularBonusCarreteiro } from 'services/carretas';

/** Estado e ações extraídos da tela — ver o componente que usa este hook. */
export function useCarreteiroBonus({ bonusConfig, bonusExtras, carregamentos, period, periodoCustom, viagens }) {
// publica a faixa do aparelho (data-tier) para o CSS mobile global

    // Bônus por carregamentos (nova fonte)
    const carregamentosComBonus = useMemo(() =>
        carregamentos.map(c => {
            const isCIF = (c.empresa_origem || '').toUpperCase().replace(/\|.*/, '').trim().startsWith('CIF');
            return { ...c, bonus: isCIF ? 0 : calcularBonusCarreteiro(c.destino, bonusConfig) };
        })
    , [carregamentos, bonusConfig]);

const carregamentosComBonusPag = usePagination(carregamentosComBonus, 10, [carregamentosComBonus.length, period, periodoCustom]);

const bonusExtrasPag = usePagination(bonusExtras, 10, [bonusExtras.length, period, periodoCustom]);

// Manter compatibilidade com viagens para checklist e registros
    const viagensComBonus = useMemo(() =>
        viagens.map(v => ({
            ...v,
            bonus: v.status === 'Entrega finalizada' ? calcularBonusCarreteiro(v.destino, bonusConfig) : 0,
        }))
    , [viagens, bonusConfig]);

const totalBonusViagens = useMemo(() =>
        carregamentosComBonus.reduce((s, c) => s + c.bonus, 0)
    , [carregamentosComBonus]);

const totalBonusExtras = useMemo(() =>
        bonusExtras.reduce((s, e) => s + Number(e.valor || 0), 0)
    , [bonusExtras]);

    return { carregamentosComBonus, carregamentosComBonusPag, bonusExtrasPag, viagensComBonus, totalBonusViagens, totalBonusExtras };
}
