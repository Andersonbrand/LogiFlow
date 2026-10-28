import React from 'react';
import { AppIcon as Icon } from 'components';

// ─── Indicador de boletos pendentes ──────────────────────────────────────────
export default function BoletosPendentes({ despesa }) {
    const boletos = despesa.boletos || [];
    const parcelas = despesa.parcelas_cartao || [];
    const pendBoletos = boletos.filter(b => !b.pago);
    const pendParcelas = parcelas.filter(p => !p.pago);
    const naoEntregues = boletos.filter(b => !b.entregue_financeiro);
    if (!pendBoletos.length && !pendParcelas.length) return null;
    const numeros = boletos.map(b => b.numero_boleto).filter(Boolean);
    return (
        <div className="mt-1 flex items-center gap-1 flex-wrap">
            {pendBoletos.length > 0 && (
                <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-xs font-medium" title={numeros.length ? `Nº: ${numeros.join(', ')}` : ''}>
                    {pendBoletos.length} boleto{pendBoletos.length > 1 ? 's' : ''} pendente{pendBoletos.length > 1 ? 's' : ''}
                    {numeros.length > 0 && <span className="font-data ml-1 text-amber-500">({numeros.join(', ')})</span>}
                </span>
            )}
            {pendParcelas.length > 0 && (
                <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 text-xs font-medium">
                    {pendParcelas.length} parcela{pendParcelas.length > 1 ? 's' : ''} pendente{pendParcelas.length > 1 ? 's' : ''}
                </span>
            )}
            {boletos.length > 0 && naoEntregues.length > 0 && (
                <span className="px-1.5 py-0.5 rounded bg-red-50 text-red-600 text-xs font-medium flex items-center gap-1">
                    <Icon name="AlertCircle" size={10} /> {naoEntregues.length} boleto{naoEntregues.length > 1 ? 's' : ''} não entregue{naoEntregues.length > 1 ? 's' : ''} ao financeiro
                </span>
            )}
        </div>
    );
}

