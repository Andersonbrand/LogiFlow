

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: último dia do mês (evita erro com fevereiro, abril, etc)
function ultimoDiaMes(anoMes) {
    // anoMes = "2026-02"
    const [ano, mes] = anoMes.split('-').map(Number);
    return new Date(ano, mes, 0).getDate(); // dia 0 do mês seguinte = último dia do mês atual
}
