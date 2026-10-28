// ─── SUB-ABA: Distribuição de Aço (fila de rodízio) ──────────────────────────
// Fila de motoristas da frota própria ordenada por "há mais tempo sem levar
// aço/ferro" — quem nunca levou ou está há mais tempo sem levar aparece
// primeiro, servindo de ordem de envio para as próximas vendas de aço.
// ── Envio de aço: helpers (formulário, resumo e comprovante impresso) ──────────
export const PEDIDO_ACO_VAZIO = () => ({ cliente: '', numero_pedido: '', cidade: '', data_entrega: new Date().toISOString().slice(0, 10) });
