import React from 'react';

import { SelectBusca, AppIcon as Icon, PrettySelect } from 'components';

const STATUS_OPTIONS = ['Aguardando', 'Carregando', 'Em Trânsito', 'Finalizado', 'Cancelado'];

// ─── tab === 'dados' ───
export default function TabDados({ calcRota, calcularRotaIA, custoStatus, destinos, errors, form, getMapsUrl, loadingRefs, motoristasComId, paradas, pedagioPor100km, postoSelecionado, postos, precoDiesel, rotaInfo, setF, setForm, setParadas, setPedagioPor100km, setPostoSelecionado, setPrecoDiesel, setUsarPedagio, usarPedagio, vehicles }) {
    return (
        <div className="flex flex-col gap-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <SelectBusca label="Motorista" required
                                    options={
                                        form.motorista && !motoristasComId.some(m => m.id === form.motorista_id)
                                            ? [{ value: form.motorista_id || `__legacy__${form.motorista}`, label: form.motorista, sublabel: 'valor atual (sem vínculo cadastrado)' }, ...motoristasComId.map(m => ({ value: m.id, label: m.name }))]
                                            : motoristasComId.map(m => ({ value: m.id, label: m.name }))
                                    }
                                    value={form.motorista_id || (form.motorista ? `__legacy__${form.motorista}` : '')}
                                    placeholder="Selecione o motorista"
                                    error={errors.motorista}
                                    onSelect={opt => setForm(prev => ({ ...prev, motorista: opt.label, motorista_id: opt.value.startsWith?.('__legacy__') ? '' : opt.value }))}
                                />
                                <div className="flex flex-col gap-2">
                                    <SelectBusca label="Destino Final" required
                                        options={
                                            form.destino && !destinos.includes(form.destino)
                                                ? [{ value: form.destino, label: form.destino, sublabel: 'valor atual' }, ...destinos.map(d => ({ value: d, label: d }))]
                                                : destinos.map(d => ({ value: d, label: d }))
                                        }
                                        value={form.destino}
                                        placeholder="Selecione a cidade"
                                        error={errors.destino}
                                        allowCustom
                                        customValue={form.destino}
                                        customPlaceholder="Cidade, UF"
                                        onCustomSubmit={v => setF('destino', v)}
                                        onSelect={opt => setF('destino', opt.value)}
                                    />
                                </div>
                            </div>
                            {/* Paradas intermediárias */}
                            <div className="rounded-lg border p-3 flex flex-col gap-2" style={{ borderColor: 'var(--color-border)' }}>
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold font-caption" style={{ color: 'var(--color-text-primary)' }}>
                                        Paradas intermediárias ({paradas.length})
                                    </span>
                                    <button type="button"
                                        onClick={() => setParadas(prev => [...prev, ''])}
                                        className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-colors"
                                        style={{ backgroundColor: 'var(--color-primary)', color: '#fff' }}>
                                        <Icon name="Plus" size={12} color="#fff" /> Adicionar cidade
                                    </button>
                                </div>
                                {paradas.map((p, idx) => (
                                    <div key={idx} className="flex gap-2 items-center">
                                        <span className="text-xs text-gray-400 w-4">{idx + 1}.</span>
                                        <div className="flex-1">
                                            <SelectBusca
                                                options={
                                                    p && !destinos.includes(p)
                                                        ? [{ value: p, label: p, sublabel: 'valor atual' }, ...destinos.map(d => ({ value: d, label: d }))]
                                                        : destinos.map(d => ({ value: d, label: d }))
                                                }
                                                value={p}
                                                placeholder="Selecione a cidade"
                                                allowCustom
                                                customValue={p}
                                                customPlaceholder="Cidade, UF"
                                                onCustomSubmit={v => setParadas(prev => prev.map((c, i) => i === idx ? v : c))}
                                                onSelect={opt => setParadas(prev => prev.map((c, i) => i === idx ? opt.value : c))}
                                            />
                                        </div>
                                        <button type="button" onClick={() => setParadas(prev => prev.filter((_, i) => i !== idx))}>
                                            <Icon name="X" size={14} color="#DC2626" />
                                        </button>
                                    </div>
                                ))}
                                {/* Configurações de diesel e pedágio */}
                                <div className="rounded-lg border p-3 flex flex-col gap-2" style={{ borderColor: 'var(--color-border)', backgroundColor: '#FAFAFA' }}>
                                    <p className="text-xs font-semibold font-caption" style={{ color: 'var(--color-text-secondary)' }}>
                                        Configurações para cálculo automático
                                    </p>
                                    <div className="grid grid-cols-2 gap-2">
                                        {/* Seleção de posto — substitui input manual de preço */}
                                        <div className="col-span-2">
                                            <label className="block text-xs font-caption mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                                                Posto de Combustível
                                            </label>
                                            {postos.length > 0 ? (
                                                <PrettySelect
                                                    value={postoSelecionado}
                                                    onChange={e => {
                                                        const posto = postos.find(p => String(p.id) === e.target.value);
                                                        setPostoSelecionado(e.target.value);
                                                        if (posto?.preco_diesel) {
                                                            const novoPreco = String(posto.preco_diesel);
                                                            setPrecoDiesel(novoPreco);
                                                            // Recalcular custo se já tem veículo e distância
                                                            setForm(prev => {
                                                                const veh = vehicles.find(v => String(v.id) === String(prev.vehicle_id));
                                                                const dist = Number(prev.distancia_km);
                                                                if (veh?.consumo_km && dist > 0) {
                                                                    const litros = dist / Number(veh.consumo_km);
                                                                    return {
                                                                        ...prev,
                                                                        _litros_estimados: Math.round(litros),
                                                                        custo_combustivel: (litros * Number(posto.preco_diesel)).toFixed(2),
                                                                    };
                                                                }
                                                                return prev;
                                                            });
                                                        }
                                                    }}
                                                    className="w-full h-8 px-2 rounded border border-gray-200 text-xs bg-white">
                                                    <option value="">Selecione o posto...</option>
                                                    {postos.map(p => (
                                                        <option key={p.id} value={p.id}>
                                                            {p.nome}{p.cidade ? ` — ${p.cidade}` : ''} · R$ {Number(p.preco_diesel||0).toFixed(3)}/L
                                                        </option>
                                                    ))}
                                                </PrettySelect>
                                            ) : (
                                                <div className="flex items-center gap-2 h-8 px-2 rounded border border-dashed border-gray-200 text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                                                    <Icon name="AlertCircle" size={12} color="#D97706" />
                                                    Nenhum posto cadastrado — cadastre em Veículos &gt; Carretas
                                                </div>
                                            )}
                                            {postoSelecionado && (
                                                <p className="text-xs mt-1 font-medium" style={{ color: '#059669' }}>
                                                    ✓ Diesel: R$ {Number(precoDiesel).toFixed(3)}/L · Cálculo automático ativo
                                                </p>
                                            )}
                                        </div>
                                        <div>
                                            <label className="block text-xs font-caption mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                                                Pedágio por 100km (R$)
                                            </label>
                                            <div className="relative">
                                                <input type="number" min="0" step="0.50"
                                                    value={usarPedagio ? pedagioPor100km : ''}
                                                    onChange={e => setPedagioPor100km(e.target.value)}
                                                    disabled={!usarPedagio}
                                                    placeholder={usarPedagio ? '8.00' : 'Sem pedágio'}
                                                    className="w-full h-8 px-2 rounded border border-gray-200 text-xs font-data bg-white disabled:opacity-40 disabled:bg-gray-50" />
                                            </div>
                                        </div>
                                        <div className="flex items-end pb-1">
                                            <label className="flex items-center gap-2 cursor-pointer select-none">
                                                <div onClick={() => setUsarPedagio(p => !p)}
                                                    className="relative w-8 h-4 rounded-full transition-colors flex-shrink-0"
                                                    style={{ backgroundColor: usarPedagio ? 'var(--color-primary)' : '#D1D5DB' }}>
                                                    <div className="absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-all"
                                                        style={{ left: usarPedagio ? '17px' : '2px' }} />
                                                </div>
                                                <span className="text-xs font-caption" style={{ color: 'var(--color-text-secondary)' }}>
                                                    {usarPedagio ? 'Rota com pedágios' : 'Rota sem pedágios'}
                                                </span>
                                            </label>
                                        </div>
                                    </div>
                                </div>

                                <button type="button" onClick={calcularRotaIA} disabled={calcRota || (!form.destino)}
                                    className="mt-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                                    style={{ backgroundColor: calcRota ? '#E0E7FF' : '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE' }}>
                                    {calcRota
                                        ? <><span className="inline-block animate-spin mr-1">⟳</span> Calculando rota...</>
                                        : <><Icon name="Navigation" size={13} color="#1D4ED8" /> Calcular rota + combustível{usarPedagio ? ' + pedágios' : ''}</>
                                    }
                                </button>

                                {/* Resultado da rota */}
                                {rotaInfo && (
                                    <div className="rounded-lg p-3 text-xs flex flex-col gap-1.5"
                                        style={{ backgroundColor: rotaInfo.erro ? '#FFF7ED' : '#F0FDF4', border: `1px solid ${rotaInfo.erro ? '#FED7AA' : '#BBF7D0'}` }}>
                                        {rotaInfo.erro ? (
                                            <div className="flex items-center gap-2 font-semibold text-orange-600">
                                                <Icon name="AlertTriangle" size={13} color="#D97706" />
                                                Preencha a distância manualmente
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2 font-semibold text-green-700">
                                                <Icon name="CheckCircle2" size={13} color="#059669" />
                                                {rotaInfo.distanciaTotal} km (ida) · {rotaInfo.distanciaTotal * 2} km total (ida+volta) · {rotaInfo.tempoEstimado}
                                                {rotaInfo.rodoviasPrincipais && <span className="font-normal text-green-600">· {rotaInfo.rodoviasPrincipais}</span>}
                                            </div>
                                        )}
                                        {rotaInfo.rota && <p className="text-gray-500">{rotaInfo.rota.join(' → ')}</p>}
                                        {rotaInfo.observacao && <p className="text-gray-400 italic">{rotaInfo.observacao}</p>}

                                        {/* Status dos custos preenchidos */}
                                        {custoStatus && custoStatus.map((msg, i) => (
                                            <div key={i} className="flex items-start gap-1.5 text-gray-600 border-t pt-1.5" style={{ borderColor: rotaInfo.erro ? '#FED7AA' : '#BBF7D0' }}>
                                                <Icon name="Info" size={11} color={rotaInfo.erro ? '#D97706' : '#059669'} className="mt-0.5 flex-shrink-0" />
                                                <span>{msg}</span>
                                            </div>
                                        ))}

                                        {/* Link Google Maps */}
                                        <a href={getMapsUrl('Guanambi, BA', paradas, form.destino)}
                                            target="_blank" rel="noreferrer"
                                            className="flex items-center gap-1 text-blue-600 hover:underline font-medium border-t pt-1.5"
                                            style={{ borderColor: rotaInfo.erro ? '#FED7AA' : '#BBF7D0' }}>
                                            <Icon name="ExternalLink" size={11} color="#2563EB" />
                                            Ver rota completa no Google Maps
                                        </a>
                                    </div>
                                )}

                                {/* Botão direto Google Maps (sempre visível quando tiver destino) */}
                                {form.destino && !rotaInfo && (
                                    <a href={getMapsUrl('Guanambi, BA', paradas, form.destino)}
                                        target="_blank" rel="noreferrer"
                                        className="flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors hover:opacity-80"
                                        style={{ backgroundColor: '#F8FAFC', color: '#374151', border: '1px solid #E2E8F0' }}>
                                        <Icon name="Map" size={13} color="#374151" />
                                        Abrir no Google Maps (sem IA)
                                    </a>
                                )}
                            </div>

                                <div className="grid grid-cols-1 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium font-caption mb-1.5" style={{ color:'var(--color-text-primary)' }}>Veículo</label>
                                        <PrettySelect value={form.vehicle_id} onChange={e => {
                                            const v = vehicles.find(x => String(x.id) === e.target.value);
                                            setForm(prev => ({ ...prev, vehicle_id: e.target.value, placa: v?.placa || '' }));
                                        }}
                                            disabled={loadingRefs}
                                            className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm bg-white disabled:opacity-60">
                                            <option value="">{loadingRefs ? '⏳ Carregando veículos...' : vehicles.length === 0 ? 'Nenhum veículo cadastrado' : 'Selecione um veículo'}</option>
                                            {vehicles.map(v => <option key={v.id} value={v.id}>{v.placa} — {v.tipo}</option>)}
                                        </PrettySelect>
                                    </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium font-caption mb-1.5" style={{ color:'var(--color-text-primary)' }}>Data/Hora de Saída</label>
                                    <input type="datetime-local" value={form.saida} onChange={e => setF('saida', e.target.value)}
                                        className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm bg-white" />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium font-caption mb-1.5" style={{ color:'var(--color-text-primary)' }}>Data/Hora de Chegada</label>
                                    <input type="datetime-local" value={form.chegada} onChange={e => setF('chegada', e.target.value)}
                                        min={form.saida || undefined}
                                        className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm bg-white" />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium font-caption mb-1.5" style={{ color:'var(--color-text-primary)' }}>Status</label>
                                    <PrettySelect value={form.status} onChange={e => setF('status', e.target.value)}
                                        className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm bg-white">
                                        {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
                                    </PrettySelect>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium font-caption mb-1.5" style={{ color:'var(--color-text-primary)' }}>Observações</label>
                                <textarea value={form.observacoes} onChange={e => setF('observacoes', e.target.value)} rows={3}
                                    placeholder="Instruções especiais, restrições..."
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white resize-none" />
                            </div>
                        </div>
    );
}
