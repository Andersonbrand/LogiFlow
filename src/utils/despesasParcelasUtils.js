// ─────────────────────────────────────────────────────────────────────────────
// DESPESAS — abatimento por data de VENCIMENTO (não pela data de emissão da NF)
//
// Uma despesa "à vista" é contabilizada na própria data_despesa. Uma despesa
// "a prazo" pode ter vários boletos/parcelas de cartão/cheques, cada um com
// sua própria data de vencimento — o abatimento na DRE deve considerar cada
// parcela no mês em que ela vence, não o mês em que a NF foi emitida.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Expande uma despesa em uma lista de itens de pagamento { valor, vencimento, pago }.
 * - à vista: um único item na data_despesa.
 * - a prazo: um item por boleto + um item por parcela de cartão + um item por
 *   cheque, cada um na sua própria data de vencimento. Se a despesa estiver
 *   marcada como a_prazo mas não tiver nenhum boleto/parcela/cheque lançado
 *   (cadastro incompleto), cai no fallback do valor total na data_despesa.
 */
export function expandirDespesaParcelas(despesa) {
    const itens = [];
    if (despesa.forma_pagamento === 'a_prazo') {
        (despesa.boletos || []).forEach(b => {
            itens.push({ valor: Number(b.valor) || 0, vencimento: b.vencimento || despesa.data_despesa, pago: !!b.pago });
        });
        (despesa.parcelas_cartao || []).forEach(p => {
            itens.push({ valor: Number(p.valor) || 0, vencimento: p.vencimento || despesa.data_despesa, pago: !!p.pago });
        });
        (despesa.cheques || []).forEach(c => {
            itens.push({ valor: Number(c.valor) || 0, vencimento: c.vencimento || despesa.data_despesa, pago: !!c.pago });
        });
        if (!itens.length) itens.push({ valor: Number(despesa.valor) || 0, vencimento: despesa.data_despesa, pago: false });
    } else {
        itens.push({ valor: Number(despesa.valor) || 0, vencimento: despesa.data_despesa, pago: true });
    }
    return itens;
}

/** Verifica se qualquer parcela/boleto de uma despesa vence dentro do período informado. */
export function despesaTemVencimentoNoPeriodo(despesa, dataInicio, dataFim) {
    return expandirDespesaParcelas(despesa).some(item => item.vencimento && item.vencimento >= dataInicio && item.vencimento <= dataFim);
}

/** Soma o valor de todas as parcelas de uma lista de despesas cujo vencimento cai em [dataInicio, dataFim]. */
export function somarDespesasPorVencimento(despesas, dataInicio, dataFim) {
    let total = 0;
    (despesas || []).forEach(d => {
        expandirDespesaParcelas(d).forEach(item => {
            if (item.vencimento && item.vencimento >= dataInicio && item.vencimento <= dataFim) total += item.valor;
        });
    });
    return total;
}

/** Agrupa o valor de parcelas por mês (YYYY-MM) a partir do vencimento, para uma lista de despesas. */
export function agruparDespesasPorMesVencimento(despesas) {
    const map = {};
    (despesas || []).forEach(d => {
        expandirDespesaParcelas(d).forEach(item => {
            const m = item.vencimento?.slice(0, 7);
            if (!m) return;
            map[m] = (map[m] || 0) + item.valor;
        });
    });
    return map;
}

/** Agrupa o valor de parcelas por categoria da despesa, considerando apenas vencimentos em [dataInicio, dataFim]. */
export function agruparDespesasPorCategoriaVencimento(despesas, dataInicio, dataFim) {
    const map = {};
    (despesas || []).forEach(d => {
        const cat = d.categoria || 'Outros';
        expandirDespesaParcelas(d).forEach(item => {
            if (!item.vencimento || item.vencimento < dataInicio || item.vencimento > dataFim) return;
            map[cat] = (map[cat] || 0) + item.valor;
        });
    });
    return map;
}
