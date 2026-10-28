import React, { useState, useCallback, useEffect } from 'react';
import { useToast } from 'hooks/useToast';
import { useConfirm, AppIcon as Icon, Toast } from 'components';
import { fetchPneus, fetchComprasPneus, fetchDespesasAdmPneus, fetchCatalogoPneus, addItemCatalogoPneus } from 'services/pneusService';
import { fetchVeiculosProprios, fetchMotoristasProprios } from 'services/carretas';
import { fetchCaminhoesPlacas } from 'services/vehicleService';
import PneusBanner from './components/PneusBanner';
import PainelPneus from './components/PainelPneus';
import PainelCompras from './components/PainelCompras';
import PainelDashboard from './components/PainelDashboard';

export default function TabPneus({ isAdmin }) {
    const [subAba, setSubAba] = useState('pneus'); // 'pneus' | 'compras' | 'dashboard'
    const { toast, showToast } = useToast();
    const { confirm, ConfirmDialog } = useConfirm();

    const [pneus, setPneus] = useState([]);
    const [compras, setCompras] = useState([]);
    const [despesasPneus, setDespesasPneus] = useState([]);
    const [veiculos, setVeiculos] = useState([]);
    const [caminhoes, setCaminhoes] = useState([]);
    const [motoristas, setMotoristas] = useState([]);
    const [catalogo, setCatalogo] = useState({ marca: [], modelo: [], medida: [], eixo: [] });
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [p, c, d, v, ca, m, cat] = await Promise.all([
                fetchPneus(), fetchComprasPneus(), fetchDespesasAdmPneus(),
                fetchVeiculosProprios(), fetchCaminhoesPlacas(), fetchMotoristasProprios(), fetchCatalogoPneus(),
            ]);
            setPneus(p); setCompras(c); setDespesasPneus(d); setVeiculos(v); setCaminhoes(ca); setMotoristas(m); setCatalogo(cat);
        } catch (e) { showToast('Erro ao carregar pneus: ' + e.message, 'error'); }
        finally { setLoading(false); }
    }, [showToast]);

    useEffect(() => { load(); }, [load]);

    const handleAddCatalogo = async (tipo, valor) => {
        if (!valor?.trim()) return;
        try {
            await addItemCatalogoPneus(tipo, valor);
            const cat = await fetchCatalogoPneus();
            setCatalogo(cat);
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };

    const SUBTABS = [
        { id: 'pneus',     label: 'Pneus',    icon: 'Disc' },
        { id: 'compras',   label: 'Compras',  icon: 'ShoppingCart' },
        { id: 'dashboard', label: 'Dashboard', icon: 'BarChart3' },
    ];

    return (
        <div className="flex flex-col gap-4">
            <PneusBanner />

            <div className="flex gap-2 flex-wrap">
                {SUBTABS.map(t => (
                    <button key={t.id} onClick={() => setSubAba(t.id)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                        style={subAba === t.id
                            ? { backgroundColor: 'var(--color-primary)', color: '#fff' }
                            : { backgroundColor: '#F1F5F9', color: 'var(--color-text-secondary)' }}>
                        <Icon name={t.icon} size={14} color={subAba === t.id ? '#fff' : 'var(--color-muted-foreground)'} />
                        {t.label}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="flex justify-center py-16">
                    <div className="animate-spin h-7 w-7 rounded-full border-4" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
                </div>
            ) : subAba === 'pneus' ? (
                <PainelPneus {...{ pneus, compras, veiculos, caminhoes, motoristas, catalogo, isAdmin, showToast, confirm, load, handleAddCatalogo }} />
            ) : subAba === 'compras' ? (
                <PainelCompras {...{ compras, despesasPneus, catalogo, isAdmin, showToast, confirm, load, handleAddCatalogo, pneus }} />
            ) : (
                <PainelDashboard {...{ pneus, compras }} />
            )}

            <Toast toast={toast} />
            {ConfirmDialog}
        </div>
    );
}
