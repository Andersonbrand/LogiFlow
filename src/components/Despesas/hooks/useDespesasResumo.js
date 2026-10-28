import { useMemo } from 'react';

const mesKey = (dt) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;

/** Totais, busca, parcelas futuras, relatório pago/em aberto e alertas de vencimento — tudo derivado das despesas. */
export function useDespesasResumo({ despesas, busca, relatorioPeriodo }) {
    const despesasFiltradas = useMemo(() => {
        if (!busca.trim()) return despesas;
        const q = busca.trim().toLowerCase();
        return despesas.filter(d =>
            (d.categoria || '').toLowerCase().includes(q) ||
            (d.descricao || '').toLowerCase().includes(q) ||
            (d.fornecedor || '').toLowerCase().includes(q) ||
            (d.empresa || '').toLowerCase().includes(q) ||
            (d.veiculo?.placa || '').toLowerCase().includes(q) ||
            (d.nota_fiscal || '').toLowerCase().includes(q) ||
            (d.boletos || []).some(b => (b.numero_boleto || '').toLowerCase().includes(q)) ||
            (d.parcelas_cartao || []).some(p => (p.cartao || '').toLowerCase().includes(q))
        );
    }, [despesas, busca]);

    const totalPeriodo = useMemo(() => despesas.reduce((s, d) => s + Number(d.valor || 0), 0), [despesas]);
    const totalPorCategoria = useMemo(() => {
        const acc = {};
        despesas.forEach(d => { acc[d.categoria] = (acc[d.categoria] || 0) + Number(d.valor || 0); });
        return Object.entries(acc).sort((a, b) => b[1] - a[1]);
    }, [despesas]);

    const parcelasFuturas = useMemo(() => {
        const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
        const porMes = {};
        const add = (d, tipo, valor, venc, cartao, numeroBoleto) => {
            if (!venc) return; const dt = new Date(venc + 'T00:00:00'); if (dt < hoje) return;
            const k = mesKey(dt);
            if (!porMes[k]) porMes[k] = { total: 0, itens: [] };
            porMes[k].total += Number(valor) || 0;
            porMes[k].itens.push({ despesa: d, tipo, valor: Number(valor) || 0, vencimento: venc, cartao, numeroBoleto });
        };
        despesasFiltradas.forEach(d => {
            (d.boletos || []).forEach(b => { if (!b.pago) add(d, 'Boleto', b.valor, b.vencimento, null, b.numero_boleto); });
            (d.parcelas_cartao || []).forEach(p => { if (!p.pago) add(d, 'Cartão', p.valor, p.vencimento, p.cartao); });
            (d.cheques || []).forEach(c => { if (!c.pago) add(d, 'Cheque', c.valor, c.vencimento); });
        });
        return Object.entries(porMes).sort(([a], [b]) => a.localeCompare(b)).map(([mes, dados]) => ({ mes, ...dados, itens: dados.itens.sort((a, b) => a.vencimento.localeCompare(b.vencimento)) }));
    }, [despesasFiltradas]);

    const relatorioStatus = useMemo(() => {
        const { inicio, fim } = relatorioPeriodo; if (!inicio || !fim) return null;
        const pagos = [], abertos = [];
        despesasFiltradas.forEach(d => {
            if (d.forma_pagamento === 'a_prazo') {
                (d.boletos || []).forEach(b => { const v = b.vencimento || d.data_despesa; if (v < inicio || v > fim) return; const it = { despesa: d, tipo: 'Boleto', valor: Number(b.valor) || 0, vencimento: v, pago: b.pago, numeroBoleto: b.numero_boleto }; b.pago ? pagos.push(it) : abertos.push(it); });
                (d.parcelas_cartao || []).forEach(p => { const v = p.vencimento || d.data_despesa; if (v < inicio || v > fim) return; const it = { despesa: d, tipo: 'Cartão', valor: Number(p.valor) || 0, vencimento: v, pago: p.pago, cartao: p.cartao }; p.pago ? pagos.push(it) : abertos.push(it); });
            } else if (d.data_despesa >= inicio && d.data_despesa <= fim) { pagos.push({ despesa: d, tipo: d.tipo_pagamento || 'À vista', valor: Number(d.valor) || 0, vencimento: d.data_despesa, pago: true }); }
        });
        return { pagos: pagos.sort((a, b) => a.vencimento.localeCompare(b.vencimento)), abertos: abertos.sort((a, b) => a.vencimento.localeCompare(b.vencimento)), totalPago: pagos.reduce((s, i) => s + i.valor, 0), totalAberto: abertos.reduce((s, i) => s + i.valor, 0) };
    }, [despesasFiltradas, relatorioPeriodo]);

    const boletosVencendo = useMemo(() => {
        const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
        const em7 = new Date(hoje); em7.setDate(em7.getDate() + 7);
        const alertas = [];
        despesas.forEach(d => {
            (d.boletos || []).forEach((b, idx) => {
                if (!b.pago && b.vencimento) {
                    const venc = new Date(b.vencimento + 'T00:00:00');
                    if (venc <= em7) alertas.push({ despesa: d, boletoIdx: idx, boleto: b, venc, atrasado: venc < hoje });
                }
            });
            (d.parcelas_cartao || []).forEach((p, idx) => {
                if (!p.pago && p.vencimento) {
                    const venc = new Date(p.vencimento + 'T00:00:00');
                    if (venc <= em7) alertas.push({ despesa: d, parcelaIdx: idx, parcela: p, venc, atrasado: venc < hoje });
                }
            });
        });
        return alertas;
    }, [despesas]);

    return { despesasFiltradas, totalPeriodo, totalPorCategoria, parcelasFuturas, relatorioStatus, boletosVencendo };
}
