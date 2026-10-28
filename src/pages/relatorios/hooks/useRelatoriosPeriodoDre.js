import { useMemo } from 'react';

/** Estado e ações extraídos da tela — ver o componente que usa este hook. */
export function useRelatoriosPeriodoDre({ dreMesFim, dreMesInicio, romaneios }) {
// ─── Período mensal do DRE de Caminhões (independente do filtro "Operacional") ───
    const dreInicioISO = `${dreMesInicio}-01`;
    const dreFimISO = useMemo(() => {
        const [ano, mes] = dreMesFim.split('-').map(Number);
        return new Date(Date.UTC(ano, mes, 0)).toISOString().slice(0, 10);
    }, [dreMesFim]);
    const romFinalizadosDre = useMemo(() =>
        romaneios.filter(r => r.status === 'Finalizado' && r.saida && r.saida.slice(0, 10) >= dreInicioISO && r.saida.slice(0, 10) <= dreFimISO),
        [romaneios, dreInicioISO, dreFimISO]);

    return { dreInicioISO, dreFimISO, romFinalizadosDre };
}
