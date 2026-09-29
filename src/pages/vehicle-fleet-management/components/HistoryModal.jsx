import React, { useState, useEffect } from "react";
import Icon from "components/AppIcon";
import Button from "components/ui/Button";
import StatusBadge from "./StatusBadge";
import { supabase } from "utils/supabaseClient";
import * as XLSX from "xlsx";

const STATUS_COLORS = {
    'Finalizado':  { bg: '#F0FDF4', text: '#166534', border: '#BBF7D0' },
    'Em Trânsito': { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' },
    'Carregando':  { bg: '#FFFBEB', text: '#B45309', border: '#FDE68A' },
    'Aguardando':  { bg: '#F5F3FF', text: '#6D28D9', border: '#DDD6FE' },
    'Cancelado':   { bg: '#FEF2F2', text: '#991B1B', border: '#FECACA' },
};

const mesAtual = () => new Date().toISOString().slice(0, 7);

// Intervalo [início, início do mês seguinte) para um valor "YYYY-MM"
function intervaloDoMes(mes) {
    const [y, m] = mes.split('-').map(Number);
    const prox = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
    return { ini: `${mes}-01`, fim: `${prox}-01` };
}

export default function HistoryModal({ isOpen, vehicle, onClose }) {
    const [romaneios, setRomaneios] = useState([]);
    const [loading, setLoading]     = useState(false);
    const [mes, setMes]             = useState(mesAtual()); // '' = todos os meses

    // Ao abrir outro veículo, volta pro mês atual
    useEffect(() => { if (isOpen) setMes(mesAtual()); }, [isOpen, vehicle?.id]);

    useEffect(() => {
        if (!isOpen || !vehicle) return;
        (async () => {
            setLoading(true);
            const cols = 'id, numero, motorista, destino, status, saida, peso_total, valor_frete';
            const aplicaMes = (q) => {
                if (!mes) return q.limit(200);
                const { ini, fim } = intervaloDoMes(mes);
                return q.gte('saida', ini).lt('saida', fim);
            };
            try {
                // Tenta primeiro por vehicle_id
                if (vehicle.id) {
                    const { data: byId } = await aplicaMes(
                        supabase.from('romaneios').select(cols).eq('vehicle_id', vehicle.id)
                    ).order('saida', { ascending: false });

                    if (byId && byId.length > 0) {
                        setRomaneios(byId);
                        setLoading(false);
                        return;
                    }
                }
                // Fallback: busca por placa (case-insensitive)
                if (vehicle.placa) {
                    const { data: byPlaca } = await aplicaMes(
                        supabase.from('romaneios').select(cols).ilike('placa', vehicle.placa.trim())
                    ).order('saida', { ascending: false });
                    setRomaneios(byPlaca || []);
                } else {
                    setRomaneios([]);
                }
            } catch {
                setRomaneios([]);
            } finally {
                setLoading(false);
            }
        })();
    }, [isOpen, vehicle, mes]);

    const exportar = () => {
        if (!romaneios.length) return;
        const rows = romaneios.map(r => ({
            'Romaneio': r.numero,
            'Data de saída': r.saida ? new Date(r.saida).toLocaleDateString('pt-BR') : '—',
            'Status': r.status,
            'Motorista': r.motorista || '—',
            'Destino': r.destino || '—',
            'Peso (kg)': Number(r.peso_total) || 0,
            'Frete (R$)': Number(r.valor_frete) || 0,
        }));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Romaneios');
        XLSX.writeFile(wb, `romaneios_${(vehicle.placa || 'veiculo').replace(/\s+/g, '')}_${mes || 'todos'}.xlsx`);
    };

    if (!isOpen || !vehicle) return null;

    const totalViagens     = romaneios.length;
    const totalFinalizadas = romaneios.filter(r => r.status === 'Finalizado').length;
    const pesoTotal        = romaneios.filter(r => r.status === 'Finalizado').reduce((s, r) => s + (r.peso_total || 0), 0);

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)' }}>
            <div className="w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden"
                style={{ backgroundColor: "var(--color-card)" }}>

                {/* Header — padrão da aplicação */}
                <div className="flex items-center justify-between px-5 py-4 border-b"
                    style={{ borderColor: 'var(--color-border)', backgroundColor: '#F8FAFC' }}>
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#EFF6FF' }}>
                            <Icon name="History" size={16} color="#1D4ED8" strokeWidth={2} />
                        </div>
                        <div>
                            <h3 className="text-sm font-heading font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                                Histórico de Romaneios
                            </h3>
                            <p className="text-xs font-data font-bold" style={{ color: 'var(--color-primary)' }}>
                                {vehicle?.placa}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors">
                        <Icon name="X" size={16} color="var(--color-muted-foreground)" strokeWidth={2} />
                    </button>
                </div>

                <div className="p-5 max-h-[72vh] overflow-y-auto">
                    {/* Info do veículo */}
                    <div className="flex items-center gap-4 mb-4 p-3 rounded-xl" style={{ backgroundColor: "var(--color-muted)" }}>
                        <div>
                            <p className="text-xs font-caption" style={{ color: "var(--color-muted-foreground)" }}>Tipo</p>
                            <p className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>{vehicle?.tipo}</p>
                        </div>
                        <div>
                            <p className="text-xs font-caption" style={{ color: "var(--color-muted-foreground)" }}>Cap. Peso</p>
                            <p className="text-sm font-data font-medium" style={{ color: "var(--color-text-primary)" }}>
                                {vehicle?.capacidadePeso?.toLocaleString("pt-BR")} kg
                            </p>
                        </div>
                        <div>
                            <p className="text-xs font-caption" style={{ color: "var(--color-muted-foreground)" }}>Status Atual</p>
                            <StatusBadge status={vehicle?.status} />
                        </div>
                    </div>

                    {/* KPIs resumidos */}
                    {!loading && romaneios.length > 0 && (
                        <div className="grid grid-cols-3 gap-2 mb-4">
                            {[
                                { label: 'Total',       value: totalViagens,                             color: '#1D4ED8', bg: '#EFF6FF' },
                                { label: 'Finalizados', value: totalFinalizadas,                         color: '#059669', bg: '#F0FDF4' },
                                { label: 'Peso (t)',    value: (pesoTotal / 1000).toFixed(1) + ' t',     color: '#7C3AED', bg: '#F5F3FF' },
                            ].map(k => (
                                <div key={k.label} className="rounded-xl p-2.5 text-center" style={{ backgroundColor: k.bg }}>
                                    <p className="text-xs font-caption" style={{ color: k.color, opacity: 0.75 }}>{k.label}</p>
                                    <p className="text-base font-bold font-data" style={{ color: k.color }}>{k.value}</p>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
                        <h4 className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--color-muted-foreground)" }}>
                            {mes ? 'Romaneios do mês' : 'Últimos romaneios'}
                        </h4>
                        <div className="flex items-center gap-2">
                            <input type="month" value={mes} onChange={e => setMes(e.target.value)}
                                className="px-2.5 py-1.5 rounded-lg border text-xs outline-none"
                                style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-card)' }} />
                            {mes && (
                                <button onClick={() => setMes('')} className="px-2 py-1.5 rounded-lg border text-xs font-medium hover:bg-gray-50"
                                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                                    Todos
                                </button>
                            )}
                            <button onClick={exportar} disabled={!romaneios.length}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                style={{ borderColor: 'var(--color-border)' }}>
                                <Icon name="FileDown" size={13} /> Exportar
                            </button>
                        </div>
                    </div>

                    <div className="space-y-2">
                        {loading ? (
                            <div className="flex justify-center py-8">
                                <div className="animate-spin h-6 w-6 rounded-full border-2" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
                            </div>
                        ) : romaneios.length === 0 ? (
                            <div className="flex flex-col items-center gap-2 py-8 text-center">
                                <Icon name="FileX" size={28} color="var(--color-muted-foreground)" />
                                <p className="text-sm" style={{ color: "var(--color-muted-foreground)" }}>
                                    {mes ? 'Nenhum romaneio deste veículo no mês selecionado.' : 'Nenhum romaneio encontrado para este veículo.'}
                                </p>
                            </div>
                        ) : romaneios.map((r) => {
                            const sc = STATUS_COLORS[r.status] || STATUS_COLORS['Aguardando'];
                            return (
                                <div key={r.id} className="flex items-center justify-between p-3 rounded-xl border"
                                    style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-card)' }}>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <span className="text-sm font-data font-bold" style={{ color: 'var(--color-primary)' }}>
                                                {r.numero}
                                            </span>
                                            <span className="px-1.5 py-0.5 rounded-full text-xs font-medium"
                                                style={{ backgroundColor: sc.bg, color: sc.text, border: `1px solid ${sc.border}` }}>
                                                {r.status}
                                            </span>
                                        </div>
                                        <p className="text-xs truncate" style={{ color: 'var(--color-muted-foreground)' }}>
                                            {r.destino || '—'}{r.motorista ? ` · ${r.motorista}` : ''}
                                        </p>
                                    </div>
                                    <div className="text-right ml-3 flex-shrink-0">
                                        {r.peso_total > 0 && (
                                            <p className="text-xs font-data font-medium" style={{ color: 'var(--color-text-primary)' }}>
                                                {Number(r.peso_total).toLocaleString('pt-BR')} kg
                                            </p>
                                        )}
                                        {r.saida && (
                                            <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                                                {new Date(r.saida).toLocaleDateString('pt-BR')}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="px-5 py-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
                    <Button variant="outline" fullWidth onClick={onClose}>Fechar</Button>
                </div>
            </div>
        </div>
    );
}
