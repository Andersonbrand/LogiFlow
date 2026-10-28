import React, { useState } from 'react';
import { usePagination, AppIcon as Icon, PaginationBar } from 'components';

// Card recolhível com o detalhe diário de horas extras — vem colapsado por padrão
// para não ocupar tela quando há muitos registros; paginado quando expandido.
export default function DetalhePorDiaCard({ dias, fmtHoras }) {
    const [expandido, setExpandido] = useState(false);
    const pag = usePagination(dias, 15, [dias.length]);
    return (
        <div className="rounded-xl border overflow-hidden shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
            <div className="px-4 py-3 border-b flex items-center justify-between cursor-pointer select-none" style={{ borderColor: 'var(--color-border)' }}
                onClick={() => setExpandido(v => !v)}>
                <h3 className="font-heading font-bold text-sm" style={{ color: 'var(--color-text-primary)' }}>Detalhe por dia</h3>
                <button title={expandido ? 'Recolher' : 'Expandir'}
                    className="w-6 h-6 rounded-md flex items-center justify-center hover:bg-gray-100 transition-colors flex-shrink-0">
                    <Icon name={expandido ? 'ChevronUp' : 'ChevronDown'} size={16} color="var(--color-muted-foreground)" />
                </button>
            </div>
            {expandido && (<>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b text-xs uppercase tracking-wide" style={{ borderColor: 'var(--color-border)', backgroundColor: '#F9FAFB', color: 'var(--color-muted-foreground)' }}>
                                <th className="px-4 py-2.5 text-left">Motorista</th>
                                <th className="px-4 py-2.5 text-left">Data</th>
                                <th className="px-4 py-2.5 text-right">Horas Brutas</th>
                                <th className="px-4 py-2.5 text-right">Após Almoço</th>
                                <th className="px-4 py-2.5 text-right">Hora Extra</th>
                            </tr>
                        </thead>
                        <tbody>
                            {pag.pageItems.map((d, idx) => (
                                <tr key={`${d.motoristaId}-${d.data}`} className="border-t" style={{ borderColor: 'var(--color-border)', backgroundColor: idx % 2 === 0 ? 'white' : '#F9FAFB' }}>
                                    <td className="px-4 py-2.5" style={{ color: 'var(--color-text-primary)' }}>{d.nome}</td>
                                    <td className="px-4 py-2.5 font-data" style={{ color: 'var(--color-muted-foreground)' }}>{new Date(d.data + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                                    <td className="px-4 py-2.5 text-right font-data" style={{ color: 'var(--color-muted-foreground)' }}>{fmtHoras(d.horasBrutas)}</td>
                                    <td className="px-4 py-2.5 text-right font-data" style={{ color: 'var(--color-muted-foreground)' }}>{fmtHoras(d.horasLiquidas)}</td>
                                    <td className="px-4 py-2.5 text-right font-data font-semibold" style={{ color: '#B45309' }}>{fmtHoras(d.horasExtras)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <PaginationBar page={pag.page} setPage={pag.setPage} totalPages={pag.totalPages}
                    totalItems={pag.totalItems} pageSize={pag.pageSize} itemLabel="registro" itemLabelPlural="registros" className="border-t" />
            </>)}
        </div>
    );
}
