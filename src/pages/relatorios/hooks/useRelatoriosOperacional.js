import { useMemo } from 'react';

/** Estado e ações extraídos da tela — ver o componente que usa este hook. */
export function useRelatoriosOperacional({ diasPeriodo, periodo, romFiltrados, romFinalizados }) {
// ─── Operacional KPIs ──────────────────────────────────────
    const totalViagens = romFiltrados.length;
    const finalizados = romFinalizados.length;
    const pesoTotal = romFinalizados.reduce((s, r) => s + (r.peso_total || 0), 0);
    const mediaDia = (totalViagens / Math.max(diasPeriodo, 1)).toFixed(1);

    // Daily romaneios chart
    const porDia = useMemo(() => {
        const map = {};
        romFiltrados.forEach(r => {
            const d = r.saida?.slice(0, 10);
            if (d) map[d] = (map[d] || 0) + 1;
        });
        const dias = Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
        return (periodo === 'mes' ? dias : dias.slice(-14))
            .map(([date, count]) => ({ date: date.slice(5), count }));
    }, [romFiltrados, periodo]);

    // Status pie
    const porStatus = useMemo(() => {
        const map = {};
        romFiltrados.forEach(r => { map[r.status] = (map[r.status] || 0) + 1; });
        return Object.entries(map).map(([name, value]) => ({ name, value }));
    }, [romFiltrados]);

    // Top destinos
    const topDestinos = useMemo(() => {
        const map = {};
        romFiltrados.forEach(r => { if (r.destino) map[r.destino] = (map[r.destino] || 0) + 1; });
        return Object.entries(map).sort(([, a], [, b]) => b - a).slice(0, 6)
            .map(([destino, count]) => ({ destino: destino.split(',')[0].trim(), count }));
    }, [romFiltrados]);

    return { totalViagens, finalizados, pesoTotal, mediaDia, porDia, porStatus, topDestinos };
}
