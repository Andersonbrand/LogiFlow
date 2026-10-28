import React from 'react';

import { AppIcon as Icon } from 'components';
import { fmtPct } from 'config/freteConfig';

import { brl, n } from '../../utils/helpers';

function MoneyInput({ label, name, value, onChange, prefix='R$' }) {
    return (
        <div>
            <label className="block text-xs font-medium font-caption mb-1.5" style={{ color:'var(--color-text-primary)' }}>{label}</label>
            <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-caption" style={{ color:'var(--color-muted-foreground)' }}>{prefix}</span>
                <input type="number" name={name} value={value} onChange={onChange} min="0" step="0.01" placeholder="0,00"
                    className="w-full h-10 pl-8 pr-3 rounded-lg border border-gray-200 text-sm font-data focus:outline-none bg-white" />
            </div>
        </div>
    );
}

function FinRow({ label, value, icon, green }) {
    return (
        <div className="flex justify-between items-center">
            <span className="text-xs font-caption flex items-center gap-1.5" style={{ color:'var(--color-muted-foreground)' }}>
                <Icon name={icon} size={12} color="currentColor" />{label}
            </span>
            <span className={`text-xs font-data font-medium ${value < 0 ? 'text-red-500' : green ? 'text-green-600' : 'text-gray-700'}`}>
                {value < 0 ? '-':''}{Math.abs(value).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
            </span>
        </div>
    );
}

// ─── tab === 'financeiro' ───
export default function TabFinanceiro({ calcularRotaIA, form, freteBreakdown, rotaInfo, setF, totais, vehicles }) {
    return (
        <div className="flex flex-col gap-4">
                            {/* Frete calculado */}
                            <div className="rounded-xl border-2 p-4" style={{ borderColor:'#059669', backgroundColor:'#F0FDF4' }}>
                                <div className="flex items-center gap-2 mb-3">
                                    <Icon name="Calculator" size={16} color="#059669" />
                                    <span className="text-sm font-semibold" style={{ color:'#065F46' }}>Frete Calculado Automaticamente</span>
                                </div>
                                {freteBreakdown.length === 0 ? (
                                    <p className="text-xs font-caption" style={{ color:'#065F46' }}>
                                        Adicione pedidos com valor para calcular o frete automaticamente.
                                    </p>
                                ) : (
                                    <div className="space-y-2">
                                        {freteBreakdown.map(({ cat, valor, pedidos: qtd, cfg }) => (
                                            <div key={cat} className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs px-2 py-0.5 rounded font-caption"
                                                        style={{ backgroundColor:cfg.bg, color:cfg.cor }}>
                                                        {cat}
                                                    </span>
                                                    <span className="text-xs font-caption" style={{ color:'var(--color-muted-foreground)' }}>
                                                        {qtd} pedido(s) · {fmtPct(cfg.percentual)}
                                                    </span>
                                                </div>
                                                <span className="text-sm font-data font-semibold" style={{ color:cfg.cor }}>{brl(valor)}</span>
                                            </div>
                                        ))}
                                        <div className="border-t pt-2 flex justify-between items-center" style={{ borderColor:'#BBF7D0' }}>
                                            <span className="text-sm font-semibold" style={{ color:'#065F46' }}>Total Frete</span>
                                            <span className="text-lg font-bold font-data" style={{ color:'#059669' }}>{brl(totais.freteCalculado)}</span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Custo operacional */}
                            <div>
                                <p className="text-xs font-caption font-semibold uppercase tracking-wider mb-3" style={{ color:'var(--color-muted-foreground)' }}>
                                    Custos Operacionais da Viagem
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div className="sm:col-span-2">
                                        <MoneyInput label="Distância total ida+volta (km)" name="distancia_km" value={form.distancia_km}
                                            onChange={e => setF(e.target.name, e.target.value)} prefix="km" />
                                    </div>

                                    {/* Resumo combustível */}
                                    {form._litros_estimados > 0 && (
                                        <div className="sm:col-span-2 flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-caption" style={{ backgroundColor: '#EFF6FF', color: '#1D4ED8' }}>
                                            <Icon name="Fuel" size={13} color="#1D4ED8" />
                                            <span>
                                                {vehicles.find(v => String(v.id) === String(form.vehicle_id))?.consumo_km} km/l
                                                · <strong>{form._litros_estimados} litros estimados</strong>
                                                {(rotaInfo?.precoDieselS10 || rotaInfo?.['preçoDieselS10']) && <> · Diesel S10: <strong>R$ {Number(rotaInfo.precoDieselS10 || rotaInfo['preçoDieselS10']).toFixed(2)}/l</strong> (Guanambi-BA)</>}
                                            </span>
                                        </div>
                                    )}

                                    {/* Combustível — badge "auto" se foi preenchido pela IA */}
                                    <div>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <label className="text-xs font-medium font-caption" style={{ color:'var(--color-text-primary)' }}>Combustível (R$)</label>
                                            {form._litros_estimados > 0 && form.custo_combustivel && (
                                                <span className="text-xs px-1.5 py-0.5 rounded font-caption" style={{ backgroundColor: '#D1FAE5', color: '#065F46' }}>
                                                    ✓ Auto
                                                </span>
                                            )}
                                        </div>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-caption" style={{ color:'var(--color-muted-foreground)' }}>R$</span>
                                            <input type="number" name="custo_combustivel" value={form.custo_combustivel}
                                                onChange={e => setF(e.target.name, e.target.value)} min="0" step="0.01" placeholder="0,00"
                                                className="w-full h-10 pl-8 pr-3 rounded-lg border text-sm font-data focus:outline-none bg-white"
                                                style={{ borderColor: form._litros_estimados > 0 && form.custo_combustivel ? '#6EE7B7' : '#E5E7EB' }} />
                                        </div>
                                    </div>

                                    {/* Pedágio — badge "auto" se foi preenchido pela IA */}
                                    <div>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <label className="text-xs font-medium font-caption" style={{ color:'var(--color-text-primary)' }}>Pedágios (R$)</label>
                                            {rotaInfo?.pedagioEstimado > 0 && form.custo_pedagio && (
                                                <span className="text-xs px-1.5 py-0.5 rounded font-caption" style={{ backgroundColor: '#D1FAE5', color: '#065F46' }}>
                                                    ✓ Auto
                                                </span>
                                            )}
                                        </div>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-caption" style={{ color:'var(--color-muted-foreground)' }}>R$</span>
                                            <input type="number" name="custo_pedagio" value={form.custo_pedagio}
                                                onChange={e => setF(e.target.name, e.target.value)} min="0" step="0.01" placeholder="0,00"
                                                className="w-full h-10 pl-8 pr-3 rounded-lg border text-sm font-data focus:outline-none bg-white"
                                                style={{ borderColor: rotaInfo?.pedagioEstimado > 0 && form.custo_pedagio ? '#6EE7B7' : '#E5E7EB' }} />
                                        </div>
                                    </div>

                                    <div className="sm:col-span-2 rounded-lg border p-3" style={{ borderColor:'#E5E7EB', backgroundColor:'#F9FAFB' }}>
                                        <label className="text-xs font-medium font-caption mb-2 block" style={{ color:'var(--color-text-primary)' }}>
                                            Diária do Motorista
                                        </label>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-[11px] font-caption mb-1" style={{ color:'var(--color-muted-foreground)' }}>Quantidade de dias</label>
                                                <input type="number" name="dias_diaria" value={form.dias_diaria} min="0" step="0.5"
                                                    onChange={e => setF(e.target.name, e.target.value)}
                                                    className="w-full h-10 px-3 rounded-lg border text-sm font-data focus:outline-none bg-white"
                                                    style={{ borderColor:'#E5E7EB' }} />
                                            </div>
                                            <MoneyInput label="Valor por dia (R$)" name="valor_diaria_dia" value={form.valor_diaria_dia}
                                                onChange={e => setF(e.target.name, e.target.value)} />
                                        </div>
                                        <div className="mt-3">
                                            <label className="block text-[11px] font-caption mb-1" style={{ color:'var(--color-muted-foreground)' }}>Descrição / Motivo</label>
                                            <input type="text" name="diaria_descricao" value={form.diaria_descricao}
                                                placeholder={form.destino ? `Ex: viagem até ${form.destino}` : 'Ex: 13/07 a 17/07'}
                                                onChange={e => setF(e.target.name, e.target.value)}
                                                className="w-full h-10 px-3 rounded-lg border text-sm focus:outline-none bg-white"
                                                style={{ borderColor:'#E5E7EB' }} />
                                        </div>
                                        {n(form.dias_diaria) > 0 && n(form.valor_diaria_dia) > 0 && (
                                            <>
                                                <p className="text-xs mt-2 font-caption" style={{ color:'#059669' }}>
                                                    Total da diária: <strong>{brl(n(form.dias_diaria) * n(form.valor_diaria_dia))}</strong> — essa diária será preenchida automaticamente na ficha do motorista, sem precisar de lançamento manual.
                                                </p>
                                                <div className="mt-3">
                                                    <label className="block text-[11px] font-caption mb-1" style={{ color:'var(--color-muted-foreground)' }}>
                                                        Mês de referência da diária (opcional)
                                                    </label>
                                                    <input type="date" name="diaria_mes_referencia" value={form.diaria_mes_referencia}
                                                        onChange={e => setF(e.target.name, e.target.value)}
                                                        className="w-full h-10 px-3 rounded-lg border text-sm font-data focus:outline-none bg-white"
                                                        style={{ borderColor:'#E5E7EB' }} />
                                                    <p className="text-[11px] mt-1" style={{ color:'var(--color-muted-foreground)' }}>
                                                        Se deixar em branco, o sistema classifica automaticamente pela data do lançamento. Preencha aqui só se precisar forçar em qual mês essa diária deve contar.
                                                    </p>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Lembrete se não calculou ainda */}
                                {!rotaInfo && form.destino && (
                                    <button type="button" onClick={() => { calcularRotaIA(); }}
                                        className="w-full mt-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-colors"
                                        style={{ backgroundColor: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE' }}>
                                        <Icon name="Sparkles" size={12} color="#1D4ED8" />
                                        Calcular combustível e pedágios automaticamente
                                    </button>
                                )}
                            </div>

                            {/* Resumo final */}
                            <div className="rounded-xl border p-4" style={{ backgroundColor:'var(--color-muted)', borderColor:'var(--color-border)' }}>
                                <p className="text-xs font-caption font-semibold mb-3" style={{ color:'var(--color-muted-foreground)' }}>RESULTADO DA VIAGEM</p>
                                <div className="space-y-2">
                                    <FinRow label="Valor Total da Carga"    value={totais.valorTotalCarga}  icon="Package" />
                                    <FinRow label="(+) Frete Calculado"     value={totais.freteCalculado}   icon="TrendingUp" green />
                                    <FinRow label="(-) Combustível"         value={-n(form.custo_combustivel)} icon="Fuel" />
                                    <FinRow label="(-) Pedágios"            value={-n(form.custo_pedagio)}  icon="Navigation" />
                                    <FinRow label="(-) Motorista"           value={-n(form.custo_motorista)}icon="User" />
                                    <div className="border-t pt-2 flex justify-between items-center" style={{ borderColor:'var(--color-border)' }}>
                                        <span className="font-semibold text-sm" style={{ color:'var(--color-text-primary)' }}>Margem da Viagem</span>
                                        <div className="text-right">
                                            <span className={`text-lg font-bold font-data ${totais.margem >= 0 ? 'text-green-600':'text-red-500'}`}>
                                                {totais.margem >= 0 ? '+':''}{brl(totais.margem)}
                                            </span>
                                            {totais.freteCalculado > 0 && (
                                                <p className={`text-xs font-caption ${totais.margem >= 0 ? 'text-green-600':'text-red-500'}`}>
                                                    {((totais.margem / totais.freteCalculado)*100).toFixed(1)}% sobre o frete
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
    );
}
