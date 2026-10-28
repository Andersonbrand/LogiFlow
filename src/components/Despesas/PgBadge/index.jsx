import React from 'react';

// ─── Badge de pagamento ───────────────────────────────────────────────────────
export default function PgBadge({ d }) {
    if (!d) return null;
    if (d.forma_pagamento === 'a_prazo') {
        const map = { boleto: 'Boleto', cartao_prazo: '💳 Cartão Parc.', permuta: 'Permuta', cheque: 'Cheque' };
        const isCard = d.tipo_pagamento === 'cartao_prazo';
        return <span className={`px-2 py-0.5 rounded text-xs font-medium ${isCard ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-700'}`}>{map[d.tipo_pagamento] || 'A Prazo'}</span>;
    }
    const map = { pix: 'PIX', dinheiro: 'Dinheiro', transferencia_m: 'Transf.', cartao: '💳 Cartão' };
    const isCard = d.tipo_pagamento === 'cartao';
    return <span className={`px-2 py-0.5 rounded text-xs font-medium ${isCard ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'}`}>{map[d.tipo_pagamento] || 'À Vista'}</span>;
}
