import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import NavigationBar from 'components/ui/NavigationBar';
import BreadcrumbTrail from 'components/ui/BreadcrumbTrail';
import Button from 'components/ui/Button';
import Icon from 'components/AppIcon';
import Toast from 'components/ui/Toast';
import { useToast } from 'utils/useToast';
import { useAuth } from 'utils/AuthContext';
import { fetchRomaneios, createRomaneio, deleteRomaneio } from 'utils/romaneioService';
import { fetchVehicles } from 'utils/vehicleService';
import { calcularGruposConsolidacao, getCorredorDaCidade, getLabelCorredor, getIconeCorredor, carregarCorredores, getAllCorredores } from 'utils/rotaGeo';

const BRL = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const COR_CORREDOR = {
    norte:       { bg: '#EFF6FF', border: '#93C5FD', text: '#1D4ED8', icon: 'ArrowUp' },
    nordeste:    { bg: '#F0FDF4', border: '#86EFAC', text: '#15803D', icon: 'ArrowUpRight' },
    leste_norte: { bg: '#FFF7ED', border: '#FDC974', text: '#B45309', icon: 'ArrowRight' },
    leste_sul:   { bg: '#FEF9C3', border: '#FDE047', text: '#92400E', icon: 'ArrowRight' },
    sul:         { bg: '#FEF2F2', border: '#FCA5A5', text: '#B91C1C', icon: 'ArrowDown' },
    oeste:       { bg: '#F5F3FF', border: '#C4B5FD', text: '#7C3AED', icon: 'ArrowLeft' },
    sul_proximo: { bg: '#FFF1F2', border: '#FDA4AF', text: '#BE123C', icon: 'ArrowDown' },
};

export default function Consolidacao() {
    const navigate = useNavigate();
    const { isAdmin } = useAuth();
    const [romaneios, setRomaneios] = useState([]);
    const [vehicles, setVehicles]   = useState([]);
    const [allVehicles, setAllVehicles] = useState([]);
    const [loading, setLoading]     = useState(true);
    const [selected, setSelected]   = useState([]);
    const [step, setStep]           = useState('select');
    const [abaAtiva, setAbaAtiva]   = useState('consolidar'); // 'consolidar' | 'corredores'
    const [corredoresLista, setCorredoresLista] = useState([]);
    const [expandidos, setExpandidos] = useState({});
    const [result, setResult]       = useState(null);
    const [vehicleId, setVehicleId] = useState('');
    const [saving, setSaving]       = useState(false);
    const { toast, showToast }      = useToast();

    useEffect(() => {
        (async () => {
            try {
                setLoading(true);
                await carregarCorredores();
                setCorredoresLista(getAllCorredores());
                const [rom, veh] = await Promise.all([fetchRomaneios(), fetchVehicles()]);
                const ativos = rom.filter(r => r.status === 'Aguardando' || r.status === 'Carregando');
                setRomaneios(ativos);
                setAllVehicles(veh);
                setVehicles(veh.filter(v => v.status === 'Disponível'));
            } catch (err) { showToast('Erro: ' + err.message, 'error'); }
            finally { setLoading(false); }
        })();
    }, []);

    // Grupos sugeridos com lógica geográfica + utilização < 40%
    const grupos = useMemo(() =>
        calcularGruposConsolidacao(romaneios, allVehicles),
    [romaneios, allVehicles]);

    // Grupo de destinos iguais (lógica simples, sempre mostrar)
    const gruposDestino = useMemo(() => {
        const m = {};
        romaneios.forEach(r => {
            const key = (r.destino || '').toLowerCase().split(',')[0].trim();
            if (!key) return;
            if (!m[key]) m[key] = { dest: r.destino || '', items: [] };
            m[key].items.push(r);
        });
        return Object.values(m).filter(g => g.items.length >= 2);
    }, [romaneios]);

    const selectedRoms = romaneios.filter(r => selected.includes(r.id));
    const totalPeso    = selectedRoms.reduce((a, r) => a + (Number(r.peso_total) || 0), 0);
    const selectedVeh  = allVehicles.find(v => String(v.id) === vehicleId);
    const overCapacity = selectedVeh && totalPeso > (selectedVeh.capacidadePeso || Infinity);
    const freteTotalEstim = selectedRoms.reduce((a, r) => a + (Number(r.valor_frete) || 0), 0);

    const toggle = (id) => setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    const selectGroup = (items) => setSelected(items.map(i => i.id));

    // Utilização de cada veículo com romaneio ativo
    const getUtilizacao = (rom) => {
        if (!rom.vehicle_id) return null;
        const v = allVehicles.find(v2 => String(v2.id) === String(rom.vehicle_id));
        const cap = Number(v?.capacidade_peso || v?.capacidadePeso || 0);
        if (!cap) return null;
        const peso = Number(rom.peso_total || 0);
        return Math.min(100, Math.round((peso / cap) * 100));
    };

    const handleConsolidate = async () => {
        if (selected.length < 2) { showToast('Selecione ao menos 2 romaneios', 'warning'); return; }
        setSaving(true);
        try {
            const allItens = selectedRoms.flatMap(r =>
                (r.romaneio_itens || []).map(i => ({
                    material_id: i.material_id, quantidade: i.quantidade, peso_total: i.peso_total,
                }))
            );
            const destinos   = [...new Set(selectedRoms.map(r => r.destino).filter(Boolean))];
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
            for (const r of selectedRoms) { try { await deleteRomaneio(r.id); } catch (_) {} }
            setResult(novo);
            setStep('done');
            showToast(`Consolidação concluída! ${novo.numero} criado.`);
        } catch (err) {
            showToast('Erro ao consolidar: ' + err.message, 'error');
        } finally { setSaving(false); }
    };

    const reset = () => { setSelected([]); setStep('select'); setResult(null); setVehicleId(''); };

    return (
        <div className="min-h-screen" style={{ backgroundColor: 'var(--color-background)' }}>
            <NavigationBar />
            <main className="main-content">
                <div className="max-w-screen-xl mx-auto px-4 md:px-6 lg:px-8 py-6">
                    <BreadcrumbTrail className="mb-4" />
                    <div className="flex items-center gap-3 mb-4">
                        <div className="flex items-center justify-center rounded-xl" style={{ width: 44, height: 44, backgroundColor: '#FEF3C7' }}>
                            <Icon name="GitMerge" size={22} color="#D97706" />
                        </div>
                        <div className="flex-1">
                            <h1 className="font-heading font-bold text-2xl" style={{ color: 'var(--color-text-primary)' }}>Consolidação de Cargas</h1>
                            <p className="text-sm font-caption" style={{ color: 'var(--color-muted-foreground)' }}>
                                Combine romaneios com mesma rota para reduzir custos
                            </p>
                        </div>
                    </div>

                    {/* Abas */}
                    <div className="flex gap-1 p-1 rounded-xl mb-6 overflow-x-auto" style={{ backgroundColor: 'var(--color-muted)' }}>
                        {[
                            { id: 'consolidar', label: 'Consolidar Cargas', icon: 'GitMerge' },
                            { id: 'corredores', label: 'Corredores de Rota', icon: 'Map' },
                        ].map(aba => (
                            <button key={aba.id}
                                onClick={() => setAbaAtiva(aba.id)}
                                className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 ${abaAtiva === aba.id ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>
                                <Icon name={aba.icon} size={14} color={abaAtiva === aba.id ? 'var(--color-primary)' : 'currentColor'} />
                                {aba.label}
                            </button>
                        ))}
                    </div>

                    {/* ── ABA CONSOLIDAR ── */}
                    {abaAtiva === 'consolidar' && (loading ? (
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
                                Novo romaneio: <span className="font-bold font-data" style={{ color: 'var(--color-primary)' }}>{result?.numero}</span>
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
                        <div className="grid grid-cols-1 tab:grid-cols-3 gap-6">
                            <div className="tab:col-span-2 flex flex-col gap-4">
                                <div className="bg-white rounded-xl border shadow-card p-5" style={{ borderColor: 'var(--color-border)' }}>
                                    <h3 className="font-heading font-semibold text-sm mb-4" style={{ color: 'var(--color-text-primary)' }}>Romaneios Selecionados</h3>
                                    <div className="space-y-2">
                                        {selectedRoms.map(r => {
                                            const util = getUtilizacao(r);
                                            return (
                                                <div key={r.id} className="flex items-center gap-3 p-3 rounded-lg border" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-muted)' }}>
                                                    <Icon name="FileText" size={16} color="var(--color-primary)" />
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-data font-medium" style={{ color: 'var(--color-text-primary)' }}>{r.numero}</p>
                                                        <p className="text-xs font-caption" style={{ color: 'var(--color-muted-foreground)' }}>
                                                            {r.motorista} · {r.destino} · {Number(r.peso_total||0).toLocaleString('pt-BR')} kg
                                                            {util !== null && (
                                                                <span className={`ml-2 px-1.5 py-0.5 rounded font-medium ${util < 40 ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-600'}`}>
                                                                    {util}% cap.
                                                                </span>
                                                            )}
                                                        </p>
                                                    </div>
                                                    <button onClick={() => toggle(r.id)} className="p-1 rounded hover:bg-red-50">
                                                        <Icon name="X" size={13} color="var(--color-destructive)" />
                                                    </button>
                                                </div>
                                            );
                                        })}
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
                                            Peso total ({Number(totalPeso).toLocaleString('pt-BR')} kg) excede capacidade ({Number(selectedVeh.capacidadePeso||0).toLocaleString('pt-BR')} kg)
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="flex flex-col gap-4">
                                <div className="bg-amber-50 rounded-xl border border-amber-200 p-5">
                                    <h3 className="font-heading font-semibold text-sm mb-3 text-amber-900">Resumo</h3>
                                    <div className="space-y-2">
                                        {[
                                            { l: 'Romaneios',    v: selectedRoms.length },
                                            { l: 'Peso Total',   v: `${Number(totalPeso).toLocaleString('pt-BR')} kg` },
                                            { l: 'Destinos',     v: [...new Set(selectedRoms.map(r => r.destino).filter(Boolean))].join(' / ') || '—' },
                                            { l: 'Frete Estim.', v: BRL(freteTotalEstim) },
                                        ].map(k => (
                                            <div key={k.l} className="flex justify-between text-sm">
                                                <span className="font-caption text-amber-700">{k.l}</span>
                                                <span className="font-data font-medium text-amber-900">{k.v}</span>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="mt-4 pt-3 border-t border-amber-200">
                                        <p className="text-xs text-amber-700 font-caption">
                                            Os {selectedRoms.length} romaneios originais serão removidos e substituídos por 1 consolidado.
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
                        /* ── SELECT STEP ── */
                        <div className="grid grid-cols-1 tab:grid-cols-3 gap-6">
                            {/* Sugestões */}
                            <div className="flex flex-col gap-4">

                                {/* Sugestões por corredor geográfico */}
                                {grupos.length > 0 && (
                                    <div className="bg-white rounded-xl border shadow-card p-4" style={{ borderColor: 'var(--color-border)' }}>
                                        <h3 className="font-heading font-semibold text-sm mb-1 flex items-center gap-1.5" style={{ color: 'var(--color-text-primary)' }}>
                                            <Icon name="Navigation" size={15} color="#D97706" /> Mesma Rota
                                        </h3>
                                        <p className="text-xs font-caption mb-3" style={{ color: 'var(--color-muted-foreground)' }}>
                                            Romaneios no mesmo corredor com veículo &lt;40% da capacidade
                                        </p>
                                        <div className="flex flex-col gap-2">
                                            {grupos.map((g, i) => {
                                                const cor = COR_CORREDOR[g.corredor] || COR_CORREDOR.norte;
                                                return (
                                                    <div key={i}
                                                        className="p-3 rounded-lg border cursor-pointer transition-all hover:shadow-sm"
                                                        style={{ borderColor: cor.border, backgroundColor: cor.bg }}
                                                        onClick={() => selectGroup(g.items)}>
                                                        <div className="flex items-center justify-between mb-1">
                                                            <div className="flex items-center gap-1.5">
                                                                <Icon name={cor.icon} size={13} color={cor.text} />
                                                                <span className="text-xs font-semibold" style={{ color: cor.text }}>{g.label}</span>
                                                            </div>
                                                            <span className="text-xs px-2 py-0.5 rounded-full font-caption font-medium"
                                                                style={{ backgroundColor: cor.border, color: cor.text }}>
                                                                {g.items.length} rom.
                                                            </span>
                                                        </div>
                                                        <p className="text-xs font-caption" style={{ color: cor.text, opacity: 0.8 }}>
                                                            {g.destinos.join(' → ')}
                                                        </p>
                                                        <p className="text-xs font-data mt-0.5" style={{ color: cor.text, opacity: 0.7 }}>
                                                            Peso combinado: {Number(g.pesoCombinado).toLocaleString('pt-BR')} kg
                                                        </p>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Sugestões por destino exato */}
                                {gruposDestino.length > 0 && (
                                    <div className="bg-white rounded-xl border shadow-card p-4" style={{ borderColor: 'var(--color-border)' }}>
                                        <h3 className="font-heading font-semibold text-sm mb-1 flex items-center gap-1.5" style={{ color: 'var(--color-text-primary)' }}>
                                            <Icon name="MapPin" size={15} color="#7C3AED" /> Mesmo Destino
                                        </h3>
                                        <p className="text-xs font-caption mb-3" style={{ color: 'var(--color-muted-foreground)' }}>
                                            Romaneios com destino idêntico
                                        </p>
                                        <div className="flex flex-col gap-2">
                                            {gruposDestino.map((g, i) => (
                                                <div key={i}
                                                    className="p-3 rounded-lg border cursor-pointer hover:border-purple-300 hover:bg-purple-50 transition-all"
                                                    style={{ borderColor: 'var(--color-border)' }}
                                                    onClick={() => selectGroup(g.items)}>
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{g.dest}</span>
                                                        <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-caption">{g.items.length} rom.</span>
                                                    </div>
                                                    <p className="text-xs mt-0.5 font-caption" style={{ color: 'var(--color-muted-foreground)' }}>
                                                        {g.items.map(r => r.numero).join(', ')}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {grupos.length === 0 && gruposDestino.length === 0 && (
                                    <div className="bg-white rounded-xl border shadow-card p-4 text-center" style={{ borderColor: 'var(--color-border)' }}>
                                        <Icon name="MapPin" size={28} color="var(--color-muted-foreground)" />
                                        <p className="text-xs font-caption mt-2" style={{ color: 'var(--color-muted-foreground)' }}>
                                            Nenhuma sugestão de consolidação identificada
                                        </p>
                                        <p className="text-xs mt-1" style={{ color: 'var(--color-muted-foreground)', opacity: 0.7 }}>
                                            Sugestões aparecem quando há romaneios na mesma rota com veículo abaixo de 40% de capacidade
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Tabela principal */}
                            <div className="tab:col-span-2 flex flex-col gap-4">
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
                                        <p className="text-sm mt-1" style={{ color: 'var(--color-muted-foreground)' }}>
                                            Apenas romaneios "Aguardando" ou "Carregando" podem ser consolidados
                                        </p>
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
                                                    <th className="px-4 py-3 text-center font-medium hidden lg:table-cell">Corredor</th>
                                                    <th className="px-4 py-3 text-center font-medium">Cap.</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {romaneios.map(r => {
                                                    const isSel = selected.includes(r.id);
                                                    const util = getUtilizacao(r);
                                                    const corredor = getCorredorDaCidade(r.destino);
                                                    const labelCor = corredor ? getLabelCorredor(corredor) : null;
                                                    return (
                                                        <tr key={r.id}
                                                            className={`border-t cursor-pointer transition-colors ${isSel ? 'bg-amber-50' : 'hover:bg-gray-50'}`}
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
                                                            <td className="px-4 py-3 text-center hidden lg:table-cell">
                                                                {labelCor ? (
                                                                    <span className="text-xs px-2 py-0.5 rounded-full font-caption"
                                                                        style={{ backgroundColor: COR_CORREDOR[corredor]?.bg || '#F1F5F9', color: COR_CORREDOR[corredor]?.text || '#475569' }}>
                                                                        {labelCor.split(' ')[0]}
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-xs text-slate-400">—</span>
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-3 text-center">
                                                                {util !== null ? (
                                                                    <span className={`text-xs font-data px-2 py-0.5 rounded-full font-medium ${util < 40 ? 'bg-orange-100 text-orange-700' : util < 75 ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                                                                        {util}%
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-xs text-slate-400">—</span>
                                                                )}
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
                    ))}

                    {/* ── ABA CORREDORES ── visível para operadores (só leitura) e admin */}
                    {abaAtiva === 'corredores' && (
                        <div className="flex flex-col gap-5">
                            <div className="flex items-center justify-between flex-wrap gap-3">
                                <div>
                                    <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                                        <Icon name="Map" size={17} color="var(--color-primary)" />
                                        Corredores de Rota Cadastrados
                                    </h2>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        Base: <strong>Guanambi, BA</strong> — cidades agrupadas por direção de rota
                                    </p>
                                </div>
                                {isAdmin() && (
                                    <Button variant="default" iconName="Pencil" iconSize={14}
                                        onClick={() => navigate('/admin')}>
                                        Editar no Painel Admin
                                    </Button>
                                )}
                            </div>

                            {loading ? (
                                <div className="flex justify-center py-12">
                                    <div className="animate-spin h-7 w-7 rounded-full border-4 border-slate-200" style={{ borderTopColor: 'var(--color-primary)' }} />
                                </div>
                            ) : corredoresLista.length === 0 ? (
                                <div className="text-center py-12 text-slate-400">
                                    <Icon name="MapPin" size={36} color="#CBD5E1" />
                                    <p className="mt-2 text-sm">Nenhum corredor cadastrado</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {corredoresLista.map(corredor => {
                                        const cor = COR_CORREDOR[corredor.nome] || { bg: '#F8FAFC', border: '#CBD5E1', text: '#475569', icon: 'MapPin' };
                                        const isExp = expandidos[corredor.nome];
                                        const cidades = corredor.cidades || [];
                                        return (
                                            <div key={corredor.nome}
                                                className="bg-white rounded-xl border shadow-sm overflow-hidden"
                                                style={{ borderColor: 'var(--color-border)' }}>
                                                <div className="flex items-center gap-3 px-4 py-3 border-b"
                                                    style={{ backgroundColor: cor.bg, borderColor: cor.border }}>
                                                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                                                        style={{ backgroundColor: cor.border }}>
                                                        <Icon name={corredor.icone || cor.icon} size={15} color={cor.text} />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-semibold" style={{ color: cor.text }}>{corredor.label}</p>
                                                    </div>
                                                    <span className="text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0"
                                                        style={{ backgroundColor: cor.border, color: cor.text }}>
                                                        {cidades.length} {cidades.length === 1 ? 'cidade' : 'cidades'}
                                                    </span>
                                                </div>
                                                <div className="px-4 py-3">
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {(isExp ? cidades : cidades.slice(0, 12)).map((cidade, i) => (
                                                            <span key={i}
                                                                className="inline-block px-2 py-0.5 rounded-full text-xs border capitalize"
                                                                style={{ backgroundColor: cor.bg, borderColor: cor.border, color: cor.text }}>
                                                                {cidade}
                                                            </span>
                                                        ))}
                                                        {cidades.length === 0 && (
                                                            <span className="text-xs text-slate-400 italic">Sem cidades cadastradas</span>
                                                        )}
                                                    </div>
                                                    {cidades.length > 12 && (
                                                        <button
                                                            onClick={() => setExpandidos(p => ({ ...p, [corredor.nome]: !p[corredor.nome] }))}
                                                            className="mt-2 text-xs font-medium flex items-center gap-1 transition-colors hover:opacity-70"
                                                            style={{ color: cor.text }}>
                                                            <Icon name={isExp ? 'ChevronUp' : 'ChevronDown'} size={13} color="currentColor" />
                                                            {isExp ? 'Mostrar menos' : `Ver todas as ${cidades.length} cidades`}
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {!isAdmin() && (
                                <p className="text-xs text-center mt-2" style={{ color: 'var(--color-muted-foreground)' }}>
                                    Para solicitar alterações nos corredores, entre em contato com o administrador do sistema.
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </main>
            <Toast toast={toast} />
        </div>
    );
}
