import { TIPOS } from './constants';

// ─── Helpers ──────────────────────────────────────────────────────────────────
export const FMT = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—';

export const BRL = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const fmtNum = v => Number(v || 0).toLocaleString('pt-BR');

export function parseTipo(row) {
    const raw = row.empresa_origem || '';
    if (raw.includes('|')) {
        const [tipo, nome] = raw.split('|');
        return { tipo: tipo.trim(), nome: nome.trim() };
    }
    if (TIPOS[raw.trim()]) return { tipo: raw.trim(), nome: '' };
    return { tipo: null, nome: raw };
}

// Calcula a divisão captação × distribuição de UM carregamento (frota própria).
// Se o destino da viagem for o Estoque, o frete inteiro é captação (MOC → Estoque).
// Caso contrário (entrega direta numa cidade da região), o frete cobre as duas
// pernas: uma parcela fixa de captação (sacos × valor de captação) e o restante
// é a distribuição daquela cidade.
export function calcCaptacaoDistribuicao(r, captacaoPorSaco) {
    const total = Number(r.valor_frete_calculado) || 0;
    if (total <= 0) return null;
    const destinoNorm = (r.destino || '').trim().toLowerCase();
    if (destinoNorm === 'estoque') {
        return { captacao: total, distribuicao: 0, pctDistribuicao: 0, isEstoque: true };
    }
    const captacao = Math.min(total, (Number(r.quantidade) || 0) * Number(captacaoPorSaco || 0));
    const distribuicao = Math.max(0, total - captacao);
    const pctDistribuicao = total > 0 ? (distribuicao / total) * 100 : 0;
    return { captacao, distribuicao, pctDistribuicao, isEstoque: false };
}

// Normaliza nome de cidade p/ comparar "Candiba, BA" com "Candiba" da tabela de fretes
export const _normCidadeFrete = t => String(t || '')
    .replace(/\([^)]*\)/g, ' ')
    .split(',')[0]
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').trim();

// Acha a linha da tabela de fretes correspondente ao destino (tolerante a UF/acento/caixa)
export function buscarFretePorDestino(destino, fretes) {
    const alvo = _normCidadeFrete(destino);
    if (!alvo) return null;
    return (fretes || []).find(f => _normCidadeFrete(f.cidade) === alvo) || null;
}
