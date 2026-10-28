import React, { useState } from 'react';
import { useAuth } from 'context/AuthContext';
import { exportRomaneioModelo1, exportListaVendedoresExcel } from 'utils/excel';
import { AppIcon as Icon, Button } from 'components';
import { n, brl } from './utils/helpers';
import TabInfo from './components/TabInfo';
import TabPedidos from './components/TabPedidos';
import TabMapa from './components/TabMapa';
import InfoCard from './components/InfoCard';

const STATUS_COLORS = {
    'Aguardando':  { bg:'#FEF9C3', text:'#B45309', border:'#FDE68A' },
    'Carregando':  { bg:'#DBEAFE', text:'#1D4ED8', border:'#BFDBFE' },
    'Em Trânsito': { bg:'#D1FAE5', text:'#065F46', border:'#A7F3D0' },
    'Finalizado':  { bg:'#F3F4F6', text:'#374151', border:'#E5E7EB' },
    'Cancelado':   { bg:'#FEE2E2', text:'#991B1B', border:'#FECACA' },
};

export default function RomaneioDetailModal({ isOpen, onClose, romaneio, onEdit, onDelete }) {
    const [tab, setTab] = useState('info');
    const [openPedidos, setOpenPedidos] = useState(new Set());
    const togglePedido = idx => setOpenPedidos(s => {
        const n = new Set(s);
        n.has(idx) ? n.delete(idx) : n.add(idx);
        return n;
    });
    const { isAdmin } = useAuth();
    if (!isOpen || !romaneio) return null;

    const aprovado = romaneio.aprovado === true;
    const podeExportar = aprovado || isAdmin();

    const s = STATUS_COLORS[romaneio.status] || STATUS_COLORS['Aguardando'];

    // Deduplicar pedidos para exibição (mesma lógica usada no modal de edição):
    // por id E por conteúdo (numero_pedido + valor_pedido + cidade_destino),
    // já que registros antigos podem ter ids diferentes mas serem duplicatas reais.
    const pedidosBrutos = romaneio.romaneio_pedidos || [];
    const seenIds = new Set();
    const seenContent = new Set();
    const pedidos = pedidosBrutos.filter(p => {
        if (p.id) {
            if (seenIds.has(p.id)) return false;
            seenIds.add(p.id);
        }
        const contentKey = `${(p.numero_pedido || '').trim()}|${p.valor_pedido}|${(p.cidade_destino || '').trim().toLowerCase()}`;
        if (contentKey !== '||' && seenContent.has(contentKey)) return false;
        seenContent.add(contentKey);
        return true;
    });

    const itens   = romaneio.romaneio_itens   || [];
    const pesoTotal = n(romaneio.peso_total) || itens.reduce((a,i)=>a+n(i.peso_total),0);

    const custoOp  = n(romaneio.custo_combustivel)+n(romaneio.custo_pedagio)+n(romaneio.custo_motorista);
    const frete    = n(romaneio.valor_frete_calculado || romaneio.valor_frete);
    const margem   = frete - custoOp;
    const valorCarga = n(romaneio.valor_total_carga) || pedidos.reduce((a,p)=>a+n(p.valor_pedido),0);

    // Reconstrói a lista de cidades da rota (origem fixa + paradas salvas + destino)
    const paradasSalvas = (() => {
        try { return JSON.parse(romaneio.paradas || '[]'); } catch { return []; }
    })();
    const todasCidadesRota = ['Guanambi, BA', ...paradasSalvas, romaneio.destino].filter(Boolean);

    // URL do Google Maps Directions com todos os waypoints
    // Título-caso + ", Brasil" no final: o embed sem chave de API (keyless)
    // do Google Maps é sensível a nomes ambíguos — cidades pequenas em CAIXA
    // ALTA ou sem o país no final às vezes caem numa tela de desambiguação
    // ("Mais opções") e o mapa fica mostrando o mundo inteiro em vez da rota,
    // mesmo quando o card de prévia já mostra o nome resolvido corretamente.
    const paraGeocode = (cidade) => {
        const bruto = String(cidade || '').trim();
        if (!bruto) return '';
        const partes = bruto.split(',').map(p => p.trim()).filter(Boolean);
        const tituloCaso = (s) => s.toLowerCase().replace(/(^|\s)([a-zà-ú])/g, (m, sep, letra) => sep + letra.toUpperCase());
        const ultima = partes[partes.length - 1];
        const ehUf = /^[A-Za-z]{2}$/.test(ultima);
        const partesFormatadas = partes.map((p, i) =>
            (ehUf && i === partes.length - 1) ? p.toUpperCase() : tituloCaso(p)
        );
        return `${partesFormatadas.join(', ')}, Brasil`;
    };
    const getMapsEmbedUrl = (cidades) => {
        if (cidades.length < 2) return null;
        const origem  = encodeURIComponent(paraGeocode(cidades[0]));
        const destino = encodeURIComponent(paraGeocode(cidades[cidades.length - 1]));
        const waypoints = cidades.slice(1, -1).map(c => encodeURIComponent(paraGeocode(c))).join('|');
        // Embed com directions API (sem chave) — funciona para visualização simples
        const base = `https://maps.google.com/maps?saddr=${origem}&daddr=${destino}`;
        const waypointStr = cidades.slice(1, -1).map(c => encodeURIComponent(paraGeocode(c))).join('+to:');
        const full = waypointStr
            ? `https://maps.google.com/maps?saddr=${origem}&daddr=${waypointStr}+to:${destino}&output=embed`
            : `https://maps.google.com/maps?saddr=${origem}&daddr=${destino}&output=embed`;
        return full;
    };
    const getMapsLinkUrl = (cidades) =>
        `https://www.google.com/maps/dir/${cidades.map(c => encodeURIComponent(paraGeocode(c))).join('/')}`;

    const mapsEmbedUrl = getMapsEmbedUrl(todasCidadesRota);
    const mapsLinkUrl  = getMapsLinkUrl(todasCidadesRota);

    const TABS = [
        ['info',      'Informações',  'FileText'],
        ['pedidos',   `Pedidos (${pedidos.length})`,'ShoppingCart'],
        ['mapa',      'Rota no Mapa', 'Map'],
        ['financeiro','Financeiro',   'DollarSign'],
    ];

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)' }}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0" style={{ borderColor:'var(--color-border)' }}>
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="font-heading font-bold text-lg" style={{ color:'var(--color-text-primary)' }}>{romaneio.numero}</span>
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium border font-caption"
                                style={{ backgroundColor:s.bg, color:s.text, borderColor:s.border }}>
                                {romaneio.status}
                            </span>
                        </div>
                        <p className="text-xs font-caption" style={{ color:'var(--color-muted-foreground)' }}>
                            Criado em {new Date(romaneio.created_at).toLocaleDateString('pt-BR')}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        {podeExportar ? (<>
                            <button
                                onClick={() => exportRomaneioModelo1(romaneio)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-caption font-medium border hover:bg-green-50 transition-colors"
                                style={{ borderColor:'var(--color-border)', color:'#059669' }}
                                title="Exportar no modelo Excel Araguaia">
                                <Icon name="FileSpreadsheet" size={14} color="#059669" />
                                Exportar Excel
                            </button>
                            {pedidos.length > 0 && (
                                <button
                                    onClick={() => exportListaVendedoresExcel(romaneio, pedidos)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-caption font-medium border hover:bg-blue-50 transition-colors"
                                    style={{ borderColor:'var(--color-border)', color:'#1D4ED8' }}
                                    title="Exportar lista de pedidos por vendedor (nº do pedido, cliente, vendedor)">
                                    <Icon name="Users" size={14} color="#1D4ED8" />
                                    Lista p/ Vendedores
                                </button>
                            )}
                        </>) : (
                            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-caption font-medium border cursor-not-allowed"
                                style={{ borderColor:'#FDE68A', color:'#B45309', backgroundColor:'#FEF9C3' }}
                                title="Aguardando aprovação do administrador">
                                <Icon name="Clock" size={14} color="#B45309" />
                                Aguard. Aprovação
                            </div>
                        )}
                        <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100">
                            <Icon name="X" size={18} color="var(--color-muted-foreground)" />
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b px-4 overflow-x-auto flex-shrink-0" style={{ borderColor:'var(--color-border)' }}>
                    {TABS.map(([key, label, icon]) => (
                        <button key={key} onClick={() => setTab(key)}
                            className={`flex items-center gap-1.5 px-3 py-3 text-sm font-medium font-caption border-b-2 transition-colors whitespace-nowrap
                                ${tab===key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                            <Icon name={icon} size={13} color="currentColor" />
                            {label}
                        </button>
                    ))}
                </div>

                <div className="overflow-y-auto flex-1 min-h-0 px-6 py-5">

                    {/* ── INFO ──────────────────────────────────────── */}
                    {tab === 'info' && (
                        <TabInfo itens={itens} pedidos={pedidos} pesoTotal={pesoTotal} romaneio={romaneio} />
                    )}

                    {/* ── PEDIDOS ───────────────────────────────────── */}
                    {tab === 'pedidos' && (
                        <TabPedidos
                    frete={frete}
                    itens={itens}
                    openPedidos={openPedidos}
                    pedidos={pedidos}
                    setOpenPedidos={setOpenPedidos}
                    togglePedido={togglePedido}
                    valorCarga={valorCarga}
                />
                    )}

                    {/* ── MAPA ──────────────────────────────────────── */}
                    {tab === 'mapa' && (
                        <TabMapa mapsEmbedUrl={mapsEmbedUrl} mapsLinkUrl={mapsLinkUrl} romaneio={romaneio} todasCidadesRota={todasCidadesRota} />
                    )}

                    {/* ── FINANCEIRO ────────────────────────────────── */}
                    {tab === 'financeiro' && (
                        <div className="flex flex-col gap-4">
                            {valorCarga > 0 && (
                                <InfoCard icon="Package" label="Valor Total da Carga" value={brl(valorCarga)} />
                            )}
                            <div className="grid grid-cols-2 gap-3">
                                <InfoCard icon="TrendingUp"  label="Frete Calculado"   value={brl(frete)}                           color="#059669" />
                                <InfoCard icon="Route"       label="Distância (ida+volta)" value={n(romaneio.distancia_km)>0 ? `${romaneio.distancia_km} km` : '—'} />
                                <InfoCard icon="Fuel"        label="Combustível"        value={brl(romaneio.custo_combustivel)}       color="#DC2626" />
                                <InfoCard icon="Navigation"  label="Pedágios"           value={brl(romaneio.custo_pedagio)}           color="#DC2626" />
                                <InfoCard icon="User"        label="Diária Motorista"   value={brl(romaneio.custo_motorista)}         color="#DC2626" />
                                <InfoCard icon="DollarSign"  label="Custo Operacional"  value={brl(custoOp)}                          color="#DC2626" />
                            </div>
                            <div className="rounded-xl p-4 border" style={{ backgroundColor: margem>=0 ? '#F0FDF4':'#FEF2F2', borderColor: margem>=0 ? '#BBF7D0':'#FECACA' }}>
                                <div className="flex items-center justify-between">
                                    <span className="font-heading font-semibold text-sm" style={{ color: margem>=0 ? '#065F46':'#991B1B' }}>
                                        Margem da Viagem
                                    </span>
                                    <span className="font-bold font-data text-xl" style={{ color: margem>=0 ? '#059669':'#DC2626' }}>
                                        {margem>=0 ? '+':''}{brl(margem)}
                                    </span>
                                </div>
                                {frete > 0 && (
                                    <p className="text-xs mt-1 font-caption" style={{ color: margem>=0 ? '#065F46':'#991B1B', opacity:.7 }}>
                                        {((margem/frete)*100).toFixed(1)}% de margem sobre o frete
                                    </p>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t flex justify-between gap-2 flex-shrink-0" style={{ borderColor:'var(--color-border)' }}>
                    <Button variant="danger" size="sm" iconName="Trash2" iconSize={14}
                        onClick={() => { onDelete(romaneio.id); onClose(); }}>
                        Excluir
                    </Button>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={onClose}>Fechar</Button>
                        <Button variant="default" iconName="Pencil" iconSize={14}
                            onClick={() => { onEdit(romaneio); onClose(); }}>
                            Editar
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
