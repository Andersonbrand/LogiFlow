import React, { useState } from 'react';

import { useToast } from 'hooks/useToast';
import { useHoraExtraConfig, saveHoraExtraConfig } from 'services/settingsService';
import { Toast, AppIcon as Icon } from 'components';
import { exportHorasExtrasExcel } from 'utils/excel';
import { ALMOCO_HORAS, LIMITE_HORAS_DIA } from 'services/desempenhoMotoristaService';

import DetalhePorDiaCard from '../DetalhePorDiaCard';

// ─── Sub-aba: Horas Extras (Pontos de Parada) ────────────────────────────────
// Usa os mesmos registros de Pontos de Parada já filtrados por motorista e
// período. Desconta 1h30 de almoço do total de horas do dia e considera
// hora extra tudo que passar do limite diário (8h) depois desse desconto.
// O valor da hora extra é global e editável (fica salvo em app_settings).
export default function PainelHorasExtras({ dados, loading }) {
    const { toast: toastHE, showToast: showToastHE } = useToast();
    const { horaExtraConfig, loadingHoraExtraConfig, reloadHoraExtraConfig } = useHoraExtraConfig();
    const [editandoValor, setEditandoValor] = useState(false);
    const [valorHoraInput, setValorHoraInput] = useState('');
    const [salvandoValor, setSalvandoValor] = useState(false);

    const BRL = v => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const fmtHoras = h => `${(Number(h) || 0).toFixed(2).replace('.', ',')}h`;

    const abrirEdicaoValor = () => { setValorHoraInput(String(horaExtraConfig.valorHora || '')); setEditandoValor(true); };
    const salvarValorHora = async () => {
        setSalvandoValor(true);
        try {
            await saveHoraExtraConfig({ valorHora: Number(valorHoraInput) || 0 });
            showToastHE('Valor da hora extra atualizado!', 'success');
            setEditandoValor(false);
            reloadHoraExtraConfig();
        } catch (e) { showToastHE('Erro ao salvar: ' + e.message, 'error'); }
        finally { setSalvandoValor(false); }
    };

    if (loading || loadingHoraExtraConfig) {
        return (
            <div className="flex justify-center py-16">
                <div className="animate-spin h-7 w-7 rounded-full border-4" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
            </div>
        );
    }

    const valorHora = Number(horaExtraConfig.valorHora) || 0;
    const totalHorasExtras = dados.porMotorista.reduce((s, m) => s + m.horasExtrasTotal, 0);
    const totalValor = totalHorasExtras * valorHora;

    return (
        <div>
            {toastHE?.show && <Toast message={toastHE.message} type={toastHE.type} />}

            <div className="flex justify-end mb-3">
                <button onClick={() => exportHorasExtrasExcel(dados, valorHora)}
                    disabled={!dados.porMotorista.length}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}>
                    <Icon name="Download" size={13} /> Exportar
                </button>
            </div>

            {/* Valor da hora extra (editável) */}
            <div className="rounded-xl border p-4 mb-5 flex flex-wrap items-center justify-between gap-3" style={{ borderColor: 'var(--color-border)', backgroundColor: '#F9FAFB' }}>
                <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#FEF3C7' }}>
                        <Icon name="Clock" size={16} color="#B45309" />
                    </div>
                    <div>
                        <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                            Valor da hora extra · desconta {ALMOCO_HORAS.toString().replace('.', ',')}h de almoço · limite {LIMITE_HORAS_DIA}h/dia
                        </p>
                        {editandoValor ? (
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-sm" style={{ color: 'var(--color-text-primary)' }}>R$</span>
                                <input type="number" step="0.01" min="0" autoFocus value={valorHoraInput}
                                    onChange={e => setValorHoraInput(e.target.value)}
                                    className="px-2 py-1 rounded-lg border text-sm w-28" style={{ borderColor: 'var(--color-border)' }} />
                                <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>/hora</span>
                            </div>
                        ) : (
                            <p className="text-lg font-bold font-data" style={{ color: 'var(--color-text-primary)' }}>{BRL(valorHora)} <span className="text-xs font-normal" style={{ color: 'var(--color-muted-foreground)' }}>/hora</span></p>
                        )}
                    </div>
                </div>
                {editandoValor ? (
                    <div className="flex gap-2">
                        <button onClick={salvarValorHora} disabled={salvandoValor}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-60" style={{ backgroundColor: '#059669' }}>
                            {salvandoValor ? 'Salvando...' : 'Salvar'}
                        </button>
                        <button onClick={() => setEditandoValor(false)}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium border" style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                            Cancelar
                        </button>
                    </div>
                ) : (
                    <button onClick={abrirEdicaoValor}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border hover:bg-white transition-colors"
                        style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}>
                        <Icon name="Pencil" size={12} /> Editar valor
                    </button>
                )}
            </div>

            {dados.porMotorista.length === 0 ? (
                <div className="bg-white rounded-xl border p-12 flex flex-col items-center gap-3" style={{ borderColor: 'var(--color-border)' }}>
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#F0FDF4' }}>
                        <Icon name="Check" size={28} color="#059669" />
                    </div>
                    <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>Nenhuma hora extra no período selecionado</p>
                    <p className="text-xs text-center" style={{ color: 'var(--color-muted-foreground)' }}>
                        Considera apenas dias em que, após descontar {ALMOCO_HORAS.toString().replace('.', ',')}h de almoço, o motorista ultrapassou {LIMITE_HORAS_DIA}h trabalhadas.
                    </p>
                </div>
            ) : (
                <>
                    {/* Ranking por motorista */}
                    <div className="rounded-xl border overflow-hidden shadow-sm mb-5" style={{ borderColor: 'var(--color-border)' }}>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b text-xs uppercase tracking-wide" style={{ borderColor: 'var(--color-border)', backgroundColor: '#F9FAFB', color: 'var(--color-muted-foreground)' }}>
                                        <th className="px-4 py-3 text-left">Motorista</th>
                                        <th className="px-4 py-3 text-right">Dias com Hora Extra</th>
                                        <th className="px-4 py-3 text-right">Total Horas Extras</th>
                                        <th className="px-4 py-3 text-right">Valor a Pagar</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {dados.porMotorista.map((m, idx) => (
                                        <tr key={m.motoristaId} className="border-t hover:bg-amber-50/30 transition-colors"
                                            style={{ borderColor: 'var(--color-border)', backgroundColor: idx % 2 === 0 ? 'white' : '#F9FAFB' }}>
                                            <td className="px-4 py-3 font-semibold" style={{ color: 'var(--color-text-primary)' }}>{m.nome}</td>
                                            <td className="px-4 py-3 text-right font-data" style={{ color: 'var(--color-muted-foreground)' }}>{m.diasComExtra}</td>
                                            <td className="px-4 py-3 text-right font-data font-semibold" style={{ color: '#B45309' }}>{fmtHoras(m.horasExtrasTotal)}</td>
                                            <td className="px-4 py-3 text-right font-data font-semibold" style={{ color: '#059669' }}>{BRL(m.horasExtrasTotal * valorHora)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="border-t-2" style={{ borderColor: 'var(--color-border)', backgroundColor: '#F9FAFB' }}>
                                        <td className="px-4 py-3 font-bold" style={{ color: 'var(--color-text-primary)' }}>Total</td>
                                        <td className="px-4 py-3 text-right font-data font-bold">{dados.dias.length}</td>
                                        <td className="px-4 py-3 text-right font-data font-bold" style={{ color: '#B45309' }}>{fmtHoras(totalHorasExtras)}</td>
                                        <td className="px-4 py-3 text-right font-data font-bold" style={{ color: '#059669' }}>{BRL(totalValor)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>

                    {/* Detalhe por dia */}
                    <DetalhePorDiaCard dias={dados.dias} fmtHoras={fmtHoras} />
                </>
            )}
        </div>
    );
}
