import * as XLSX from 'xlsx';
import { brl, today } from './shared';

// ── EXPORTAR BONIFICAÇÕES DOS MOTORISTAS (Admin) ─────────────────────────────
export function exportBonificacoesAdminExcel(bonifs) {
    const rows = bonifs.map(b => ({
        'Motorista': b.motorista, 'Viagens': b.total_viagens,
        'Peso Total (kg)': Number(b.peso_total || 0),
        'Romaneios (R$)': brl(b.bonificacao_romaneios ?? b.bonificacao_total), 'Extras (R$)': brl(b.bonificacao_extras || 0),
        'Bonificação (R$)': brl(b.bonificacao_total),
    }));
    rows.push({
        'Motorista': 'TOTAL',
        'Viagens': bonifs.reduce((s, b) => s + Number(b.total_viagens || 0), 0),
        'Peso Total (kg)': bonifs.reduce((s, b) => s + Number(b.peso_total || 0), 0),
        'Romaneios (R$)': brl(bonifs.reduce((s, b) => s + Number(b.bonificacao_romaneios ?? b.bonificacao_total ?? 0), 0)),
        'Extras (R$)': brl(bonifs.reduce((s, b) => s + Number(b.bonificacao_extras || 0), 0)),
        'Bonificação (R$)': brl(bonifs.reduce((s, b) => s + Number(b.bonificacao_total || 0), 0)),
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch:24 },{ wch:10 },{ wch:16 },{ wch:16 },{ wch:14 },{ wch:16 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Bonificações');
    XLSX.writeFile(wb, `bonificacoes_motoristas_${today()}.xlsx`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Relatório de Bonificações por Período — exporta por motorista com detalhes
// Chame com: exportRelatorioBonificacoes(romaneios, '01/01/2026', '31/03/2026')
// ─────────────────────────────────────────────────────────────────────────────
export function exportRelatorioBonificacoes(romaneios, dataInicio, dataFim) {
    if (!romaneios || romaneios.length === 0) return;

    const TAXA_FERRAGEM = 0.009;
    const BONUS_CIMENTO = 40.00;
    const n = v => Number(v) || 0;

    const wb = XLSX.utils.book_new();

    // ── Aba 1: Resumo por motorista ────────────────────────────────────────
    const porMotorista = {};
    const detalhes = [];

    romaneios.forEach(r => {
        const itens = r.romaneio_itens || [];
        let kgFerragem = 0, temCimento = false;
        itens.forEach(it => {
            const cat = (it.materials?.categoria_frete || '').toLowerCase();
            if (cat.includes('cimento')) temCimento = true;
            else kgFerragem += n(it.peso_total);
        });
        const valorFerragem = kgFerragem * TAXA_FERRAGEM;
        const valorCimento  = temCimento ? BONUS_CIMENTO : 0;
        const valorTotal    = valorFerragem + valorCimento;
        const motorista     = r.motorista || 'Sem nome';
        const saida         = r.saida ? new Date(r.saida).toLocaleDateString('pt-BR') : '';

        if (!porMotorista[motorista]) {
            porMotorista[motorista] = { viagens: 0, kgFerragem: 0, valorFerragem: 0, viasComCimento: 0, valorCimento: 0, valorTotal: 0 };
        }
        porMotorista[motorista].viagens++;
        porMotorista[motorista].kgFerragem    += kgFerragem;
        porMotorista[motorista].valorFerragem += valorFerragem;
        if (temCimento) { porMotorista[motorista].viasComCimento++; porMotorista[motorista].valorCimento += valorCimento; }
        porMotorista[motorista].valorTotal    += valorTotal;

        detalhes.push({
            'Motorista':         motorista,
            'Romaneio / NF':     r.numero || '',
            'Destino':           r.destino || '',
            'Saída':             saida,
            'Status':            r.status || '',
            'Kg Ferragem':       kgFerragem.toFixed(0),
            'Ton. Ferragem':     (kgFerragem / 1000).toFixed(3),
            'Bônus Ferragem (R$)': valorFerragem.toFixed(2),
            'Tem Cimento':       temCimento ? 'Sim' : 'Não',
            'Bônus Cimento (R$)': valorCimento.toFixed(2),
            'Total Bônus (R$)':  valorTotal.toFixed(2),
        });
    });

    // Agrupa os detalhes por motorista (todas as viagens de cada motorista juntas,
    // ordenadas pelo maior total de bônus), inserindo uma linha de subtotal ao
    // final de cada grupo — assim cada motorista mostra suas viagens + total.
    const motoristasOrdenados = Object.entries(porMotorista).sort((a, b) => b[1].valorTotal - a[1].valorTotal).map(([nome]) => nome);
    const detalhesAgrupados = [];
    motoristasOrdenados.forEach(nome => {
        const viagensDoMotorista = detalhes.filter(d => d.Motorista === nome);
        detalhesAgrupados.push(...viagensDoMotorista);
        const d = porMotorista[nome];
        detalhesAgrupados.push({
            'Motorista':         `TOTAL — ${nome}`,
            'Romaneio / NF':     '',
            'Destino':           '',
            'Saída':             '',
            'Status':            `${d.viagens} viagem(ns)`,
            'Kg Ferragem':       d.kgFerragem.toFixed(0),
            'Ton. Ferragem':     (d.kgFerragem / 1000).toFixed(3),
            'Bônus Ferragem (R$)': d.valorFerragem.toFixed(2),
            'Tem Cimento':       '',
            'Bônus Cimento (R$)': d.valorCimento.toFixed(2),
            'Total Bônus (R$)':  d.valorTotal.toFixed(2),
        });
        detalhesAgrupados.push({}); // linha em branco separando motoristas
    });

    const rowsResumo = Object.entries(porMotorista)
        .sort((a, b) => b[1].valorTotal - a[1].valorTotal)
        .map(([nome, d]) => ({
            'Motorista':              nome,
            'Total Viagens':          d.viagens,
            'Kg Total Ferragem':      d.kgFerragem.toFixed(0),
            'Ton. Total Ferragem':    (d.kgFerragem / 1000).toFixed(3),
            'Bônus Ferragem (R$)':    d.valorFerragem.toFixed(2),
            'Viagens c/ Cimento':     d.viasComCimento,
            'Bônus Cimento (R$)':     d.valorCimento.toFixed(2),
            'TOTAL BÔNUS (R$)':       d.valorTotal.toFixed(2),
        }));

    // Linha de total
    const totViagens  = Object.values(porMotorista).reduce((s, d) => s + d.viagens, 0);
    const totFerragem = Object.values(porMotorista).reduce((s, d) => s + d.valorFerragem, 0);
    const totCimento  = Object.values(porMotorista).reduce((s, d) => s + d.valorCimento, 0);
    const totGeral    = Object.values(porMotorista).reduce((s, d) => s + d.valorTotal, 0);
    rowsResumo.push({
        'Motorista': 'TOTAL GERAL',
        'Total Viagens': totViagens,
        'Kg Total Ferragem': '',
        'Ton. Total Ferragem': '',
        'Bônus Ferragem (R$)': totFerragem.toFixed(2),
        'Viagens c/ Cimento': '',
        'Bônus Cimento (R$)': totCimento.toFixed(2),
        'TOTAL BÔNUS (R$)': totGeral.toFixed(2),
    });

    const wsResumo = XLSX.utils.json_to_sheet(rowsResumo);
    wsResumo['!cols'] = Object.keys(rowsResumo[0] || {}).map(() => ({ wch: 20 }));
    XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo por Motorista');

    // ── Aba 2: Detalhes por viagem, agrupados por motorista com subtotal ────
    const wsDetalhes = XLSX.utils.json_to_sheet(detalhesAgrupados);
    wsDetalhes['!cols'] = Object.keys(detalhes[0] || {}).map(() => ({ wch: 18 }));
    XLSX.utils.book_append_sheet(wb, wsDetalhes, 'Detalhes por Motorista');

    const periodo = dataInicio && dataFim ? `_${dataInicio.replace(/\//g,'-')}_a_${dataFim.replace(/\//g,'-')}` : '';
    XLSX.writeFile(wb, `relatorio_bonificacoes${periodo}.xlsx`);
}
