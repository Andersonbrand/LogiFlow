import React, { useState, useEffect, useMemo } from 'react';
import NavigationBar from 'components/ui/NavigationBar';
import BreadcrumbTrail from 'components/ui/BreadcrumbTrail';
import Button from 'components/ui/Button';
import Icon from 'components/AppIcon';
import Toast from 'components/ui/Toast';
import { useToast } from 'utils/useToast';
import { fetchRomaneios, createRomaneio, deleteRomaneio } from 'utils/romaneioService';
import { fetchVehicles } from 'utils/vehicleService';

// Sprint 5: Cargo Consolidation Module
export default function Consolidacao() {
    const [romaneios, setRomaneios] = useState([]);
    const [vehicles, setVehicles]   = useState([]);
    const [loading, setLoading]     = useState(true);
    const [selected, setSelected]   = useState([]);
    const [step, setStep]           = useState('select'); // select | review | done
    const [result, setResult]       = useState(null);
    const [vehicleId, setVehicleId] = useState('');
    const [saving, setSaving]       = useState(false);
    const { toast, showToast }      = useToast();

    useEffect(() => {
        (async () => {
            try {
                setLoading(true);
                const [rom, veh] = await Promise.all([fetchRomaneios(), fetchVehicles()]);
                setRomaneios(rom.filter(r => r.status === 'Aguardando' || r.status === 'Carregando'));
                setVehicles(veh.filter(v => v.status === 'Disponível'));
            } catch (err) { showToast('Erro: ' + err.message, 'error'); }
            finally { setLoading(false); }
        })();
    }, []);

    // Group by destination (for suggestions)
    const groups = useMemo(() => {
        const m = {};
        romaneios.forEach(r => {
            const key = (r.destino || 'sem-destino').toLowerCase().split(',')[0].trim();
            if (!m[key]) m[key] = { dest: r.destino || 'Sem destino', items: [] };
            m[key].items.push(r);
        });
        return Object.values(m).filter(g => g.items.length >= 2).sort((a, b) => b.items.length - a.items.length);
    }, [romaneios]);

    const selectedRoms = romaneios.filter(r => selected.includes(r.id));
    const totalPeso    = selectedRoms.reduce((a, r) => a + (Number(r.peso_total) || 0), 0);
    const selectedVeh  = vehicles.find(v => String(v.id) === vehicleId);
    const overCapacity = selectedVeh && totalPeso > (selectedVeh.capacidadePeso || Infinity);
    const freteTotalEstim = selectedRoms.reduce((a, r) => a + (Number(r.valor_frete) || 0), 0);

    const toggle = (id) => setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    const selectGroup = (items) => setSelected(items.map(i => i.id));

    const handleConsolidate = async () => {
        if (selected.length < 2) { showToast('Selecione ao menos 2 romaneios para consolidar', 'warning'); return; }
        setSaving(true);
        try {
            // Merge all itens from selected romaneios
            const allItens = selectedRoms.flatMap(r =>
                (r.romaneio_itens || []).map(i => ({
                    material_id: i.material_id, quantidade: i.quantidade, peso_total: i.peso_total,
                }))
            );
            const destinos = [...new Set(selectedRoms.map(r => r.destino).filter(Boolean))];
            const motoristas = [...new Set(selectedRoms.map(r => r.motorista).filter(Boolean))];

            const payload = {
                motorista:   motoristas[0] || '',
                destino:     destinos.join(' / '),
                status:      'Carregando',
                observacoes: `Consolidação de: ${selectedRoms.map(r => r.numero).join(', ')}`,
                vehicle_id:  vehicleId || null,
                placa:       selectedVeh?.placa || '',
                valor_frete: freteTotalEstim,
            };

            const novo = await createRomaneio(payload, allItens);

            // Delete originals
            for (const r of selectedRoms) {
                try { await deleteRomaneio(r.id); } catch (_) {}
            }

            setResult(novo);
            setStep('done');
            showToast(`Consolidação concluída! ${novo.numero} criado.`);
        } catch (err) {
            showToast('Erro ao consolidar: ' + err.message, 'error');
        } finally {
            setSaving(false);
        }
    };

    const reset = () => { setSelected([]); setStep('select'); setResult(null); setVehicleId(''); };

    return (
        <div className="min-h-screen" style={{ backgroundColor: 'var(--color-background)' }}>
            <NavigationBar />
            <main className="main-content">
                <div className="max-w-screen-xl mx-auto px-4 md:px-6 lg:px-8 py-6">
                    <BreadcrumbTrail className="mb-4" />
                    <div className="flex items-center gap-3 mb-6">
                        <div className="flex items-center justify-center rounded-xl" style={{ width: 44, height: 44, backgroundColor: '#FEF3C7' }}>
                            <Icon name="GitMerge" size={22} color="#D97706" />
                        </div>
                        <div>
                            <h1 className="font-heading font-bold text-2xl" style={{ color: 'var(--color-text-primary)' }}>Consolidação de Cargas</h1>
                            <p className="text-sm font-caption" style={{ color: 'var(--color-muted-foreground)' }}>Combine romaneios com mesma rota para reduzir custos</p>
                        </div>
                    </div>

                    {loading ? (
                        <div className="flex justify-center py-20">
                            <div className="animate-spin h-8 w-8 rounded-full border-4" style={{ borderColor: '#D97706', borderTopColor: 'transparent' }} />
                        </div>
                    ) : step === 'done' ? (
                        <div className="bg-white rounded-2xl border shadow-card p-10 text-center max-w-lg mx-auto" style={{ borderColor: 'var(--color-border)' }}>
                            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                                <Icon name="CheckCircle2" size={36} color="#059669" />
                            </div>
                            <h2 className="font-heading font-bold text-xl mb-2" style={{ color: 'var(--color-text-primary)' }}>Consolidação Concluída!</h2>
                            <p className="text-sm font-caption mb-1" style={{ color: 'var(--color-muted-foreground)' }}>
                                Novo romaneio criado: <span className="font-bold font-data" style={{ color: 'var(--color-primary)' }}>{result?.numero}</span>
                            </p>
                            <p className="text-sm font-caption mb-6" style={{ color: 'var(--color-muted-foreground)' }}>
                                {selectedRoms.length} romaneios originais removidos · Destino: {result?.destino}
                            </p>
                            <div className="flex gap-3 justify-center">
                                <Button variant="outline" onClick={reset}>Nova Consolidação</Button>
                                <Button variant="default" iconName="FileText" onClick={() => window.location.href='/romaneios'}>Ver Romaneios</Button>
                            </div>
                        </div>
                    ) : step === 'review' ? (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Summary */}
                            <div className="lg:col-span-2 flex flex-col gap-4">
                                <div className="bg-white rounded-xl border shadow-card p-5" style={{ borderColor: 'var(--color-border)' }}>
                                    <h3 className="font-heading font-semibold text-sm mb-4" style={{ color: 'var(--color-text-primary)' }}>Romaneios Selecionados</h3>
                                    <div className="space-y-2">
                                        {selectedRoms.map(r => (
                                            <div key={r.id} className="flex items-center gap-3 p-3 rounded-lg border" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-muted)' }}>
                                                <Icon name="FileText" size={16} color="var(--color-primary)" />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-data font-medium" style={{ color: 'var(--color-text-primary)' }}>{r.numero}</p>
                                                    <p className="text-xs font-caption" style={{ color: 'var(--color-muted-foreground)' }}>
                                                        {r.motorista} · {r.destino} · {Number(r.peso_total||0).toLocaleString('pt-BR')} kg
                                                    </p>
                                                </div>
                                                <button onClick={() => toggle(r.id)} className="p-1 rounded hover:bg-red-50">
                                                    <Icon name="X" size={13} color="var(--color-destructive)" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="bg-white rounded-xl border shadow-card p-5" style={{ borderColor: 'var(--color-border)' }}>
                                    <h3 className="font-heading font-semibold text-sm mb-3" style={{ color: 'var(--color-text-primary)' }}>Selecionar Veículo</h3>
                                    <select value={vehicleId} onChange={e => setVehicleId(e.target.value)}
                                        className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none bg-white">
                                        <option value="">Selecionar veículo disponível...</option>
                                        {vehicles.map(v => (
                                            <option key={v.id} value={v.id}>{v.placa} — {v.tipo} — Cap: {Number(v.capacidadePeso||0).toLocaleString('pt-BR')} kg</option>
                                        ))}
                                    </select>
                                    {overCapacity && (
                                        <p className="text-xs mt-2 flex items-center gap-1.5" style={{ color: '#DC2626' }}>
                                            <Icon name="AlertTriangle" size={12} color="#DC2626" />
                                            Peso total ({Number(totalPeso).toLocaleString('pt-BR')} kg) excede capacidade do veículo ({Number(selectedVeh.capacidadePeso||0).toLocaleString('pt-BR')} kg)
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Sidebar */}
                            <div className="flex flex-col gap-4">
                                <div className="bg-amber-50 rounded-xl border border-amber-200 p-5">
                                    <h3 className="font-heading font-semibold text-sm mb-3 text-amber-900">Resumo da Consolidação</h3>
                                    <div className="space-y-2">
                                        {[
                                            { l: 'Romaneios',    v: selectedRoms.length },
                                            { l: 'Peso Total',   v: `${Number(totalPeso).toLocaleString('pt-BR')} kg` },
                                            { l: 'Destinos',     v: [...new Set(selectedRoms.map(r => r.destino).filter(Boolean))].join(', ') || '—' },
                                            { l: 'Frete Estim.', v: Number(freteTotalEstim).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) },
                                        ].map(k => (
                                            <div key={k.l} className="flex justify-between text-sm">
                                                <span className="font-caption text-amber-700">{k.l}</span>
                                                <span className="font-data font-medium text-amber-900">{k.v}</span>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="mt-4 pt-3 border-t border-amber-200">
                                        <p className="text-xs text-amber-700 font-caption">
                                            Os {selectedRoms.length} romaneios originais serão removidos e substituídos por 1 único romaneio consolidado.
                                        </p>
                                    </div>
                                </div>
                                <Button variant="outline" onClick={() => setStep('select')}>Voltar</Button>
                                <Button variant="default" onClick={handleConsolidate} loading={saving}
                                    disabled={overCapacity} iconName="GitMerge" iconSize={16}>
                                    Consolidar Agora
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Suggestions */}
                            <div className="flex flex-col gap-4">
                                <div className="bg-white rounded-xl border shadow-card p-4" style={{ borderColor: 'var(--color-border)' }}>
                                    <h3 className="font-heading font-semibold text-sm mb-3 flex items-center gap-1.5" style={{ color: 'var(--color-text-primary)' }}>
                                        <Icon name="Sparkles" size={15} color="#D97706" /> Sugestões Automáticas
                                    </h3>
                                    {groups.length === 0 ? (
                                        <p className="text-xs font-caption text-center py-4" style={{ color: 'var(--color-muted-foreground)' }}>
                                            Nenhum grupo de destino identificado
                                        </p>
                                    ) : groups.map((g, i) => (
                                        <div key={i} className="mb-2 last:mb-0 p-3 rounded-lg border cursor-pointer hover:border-amber-300 hover:bg-amber-50 transition-all"
                                            style={{ borderColor: 'var(--color-border)' }}
                                            onClick={() => selectGroup(g.items)}>
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{g.dest}</span>
                                                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-caption">{g.items.length} rom.</span>
                                            </div>
                                            <p className="text-xs mt-0.5 font-caption" style={{ color: 'var(--color-muted-foreground)' }}>
                                                {g.items.map(r => r.numero).join(', ')}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Main table */}
                            <div className="lg:col-span-2 flex flex-col gap-4">
                                <div className="flex items-center justify-between">
                                    <p className="text-sm font-caption" style={{ color: 'var(--color-muted-foreground)' }}>
                                        {selected.length} selecionado(s) de {romaneios.length} disponíveis
                                    </p>
                                    {selected.length >= 2 && (
                                        <Button variant="default" iconName="GitMerge" iconSize={15} onClick={() => setStep('review')}>
                                            Revisar Consolidação
                                        </Button>
                                    )}
                                </div>

                                {romaneios.length === 0 ? (
                                    <div className="bg-white rounded-xl border shadow-card p-12 text-center" style={{ borderColor: 'var(--color-border)' }}>
                                        <Icon name="FileSearch" size={40} color="var(--color-muted-foreground)" />
                                        <p className="mt-3 font-medium" style={{ color: 'var(--color-text-primary)' }}>Nenhum romaneio disponível</p>
                                        <p className="text-sm mt-1" style={{ color: 'var(--color-muted-foreground)' }}>Apenas romaneios "Aguardando" ou "Carregando" podem ser consolidados</p>
                                    </div>
                                ) : (
                                    <div className="bg-white rounded-xl border shadow-card overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
                                        <table className="w-full text-sm">
                                            <thead className="text-xs font-caption border-b" style={{ backgroundColor: 'var(--color-muted)', borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                                                <tr>
                                                    <th className="px-4 py-3 text-center w-10">
                                                        <input type="checkbox"
                                                            checked={selected.length === romaneios.length && romaneios.length > 0}
                                                            onChange={e => setSelected(e.target.checked ? romaneios.map(r => r.id) : [])}
                                                            className="rounded" />
                                                    </th>
                                                    <th className="px-4 py-3 text-left font-medium">Número</th>
                                                    <th className="px-4 py-3 text-left font-medium">Destino</th>
                                                    <th className="px-4 py-3 text-left font-medium hidden md:table-cell">Motorista</th>
                                                    <th className="px-4 py-3 text-right font-medium">Peso</th>
                                                    <th className="px-4 py-3 text-center font-medium">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {romaneios.map(r => {
                                                    const isSel = selected.includes(r.id);
                                                    return (
                                                        <tr key={r.id} className={`border-t cursor-pointer transition-colors ${isSel ? 'bg-amber-50' : 'hover:bg-gray-50'}`}
                                                            style={{ borderColor: 'var(--color-border)' }}
                                                            onClick={() => toggle(r.id)}>
                                                            <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                                                                <input type="checkbox" checked={isSel} onChange={() => toggle(r.id)} className="rounded" />
                                                            </td>
                                                            <td className="px-4 py-3 font-data text-xs font-semibold" style={{ color: 'var(--color-primary)' }}>{r.numero}</td>
                                                            <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-text-secondary)' }}>{r.destino || '—'}</td>
                                                            <td className="px-4 py-3 text-xs hidden md:table-cell" style={{ color: 'var(--color-text-secondary)' }}>{r.motorista || '—'}</td>
                                                            <td className="px-4 py-3 text-right text-xs font-data" style={{ color: 'var(--color-text-secondary)' }}>
                                                                {r.peso_total ? `${Number(r.peso_total).toLocaleString('pt-BR')} kg` : '—'}
                                                            </td>
                                                            <td className="px-4 py-3 text-center">
                                                                <span className="px-2 py-0.5 rounded-full text-xs font-caption font-medium"
                                                                    style={{ backgroundColor: r.status === 'Aguardando' ? '#FEF9C3' : '#DBEAFE', color: r.status === 'Aguardando' ? '#B45309' : '#1D4ED8' }}>
                                                                    {r.status}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                        {selected.length > 0 && (
                                            <div className="px-4 py-3 border-t flex items-center justify-between bg-amber-50" style={{ borderColor: 'var(--color-border)' }}>
                                                <span className="text-xs font-caption text-amber-700">
                                                    Peso combinado: <strong className="font-data">{Number(totalPeso).toLocaleString('pt-BR')} kg</strong>
                                                </span>
                                                <Button variant="default" size="sm" iconName="GitMerge" iconSize={14}
                                                    disabled={selected.length < 2} onClick={() => setStep('review')}>
                                                    Consolidar {selected.length} romaneios
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </main>
            <Toast toast={toast} />
        </div>
    );
}
