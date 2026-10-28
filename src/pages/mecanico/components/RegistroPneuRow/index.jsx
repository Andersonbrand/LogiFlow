import React from 'react';

import { AppIcon as Icon } from 'components';

// Uma linha de registro de pneu na lista "Meus Últimos Registros". `indent`
// é usado quando ela aparece dentro de um lote expandido (troca em várias
// posições registrada de uma vez).
export default function RegistroPneuRow({ p, editando, onVer, onEditar, onExcluir, indent = false }) {
    return (
        <div className={`px-4 py-3 flex items-start gap-3 ${indent ? 'pl-9' : ''}`}
            style={editando ? { backgroundColor: '#EFF6FF' } : undefined}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: p.tipo_pneu === 'recapado' ? '#FEF3C7' : '#D1FAE5' }}>
                <Icon name="CircleDot" size={14} color={p.tipo_pneu === 'recapado' ? '#B45309' : '#059669'} />
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold font-data" style={{ color: 'var(--color-text-primary)' }}>
                    {p.numero_sequencial || '—'} · {p.veiculo?.placa || p.veiculo_caminhao_placa || 'Sem placa'}
                </p>
                <p className="text-xs truncate" style={{ color: 'var(--color-muted-foreground)' }}>
                    {p.marca} {p.medida} — {p.eixo_trocado || '—'}
                </p>
            </div>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0"
                style={{ backgroundColor: p.tipo_pneu === 'recapado' ? '#FEF3C7' : '#D1FAE5', color: p.tipo_pneu === 'recapado' ? '#B45309' : '#059669' }}>
                {p.tipo_pneu === 'recapado' ? 'Recapado' : 'Novo'}
            </span>
            <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => onVer(p)} title="Ver detalhes"
                    className="w-6 h-6 rounded-md flex items-center justify-center hover:bg-slate-100">
                    <Icon name="Eye" size={13} color="var(--color-muted-foreground)" />
                </button>
                <button onClick={() => onEditar(p)} title="Editar"
                    className="w-6 h-6 rounded-md flex items-center justify-center hover:bg-blue-50">
                    <Icon name="Pencil" size={13} color="#1D4ED8" />
                </button>
                <button onClick={() => onExcluir(p)} title="Excluir"
                    className="w-6 h-6 rounded-md flex items-center justify-center hover:bg-red-50">
                    <Icon name="Trash2" size={13} color="#DC2626" />
                </button>
            </div>
        </div>
    );
}
