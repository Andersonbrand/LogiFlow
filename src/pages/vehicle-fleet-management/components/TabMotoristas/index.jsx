import React, { useState, useEffect, useMemo } from 'react';

import { useToast } from 'hooks/useToast';
import { fetchMotoristasCaminhao } from 'services/carretas';
import { AppIcon as Icon, Toast } from 'components';

import { inputStyle } from '../../utils/constants';
import PainelMotorista from '../PainelMotorista';

// ─── Aba Motoristas ───────────────────────────────────────────────────────────
export default function TabMotoristas({ adminProfile }) {
    const { toast, showToast } = useToast();
    const [motoristas, setMotoristas] = useState([]);
    const [loading, setLoading]       = useState(true);
    const [selecionado, setSelecionado] = useState(null);
    const [busca, setBusca]           = useState('');

    useEffect(() => {
        (async () => {
            try {
                const m = await fetchMotoristasCaminhao();
                setMotoristas(m);
            } catch (e) { showToast('Erro ao carregar motoristas: ' + e.message, 'error'); }
            finally { setLoading(false); }
        })();
    }, []); // eslint-disable-line

    const filtrados = useMemo(() =>
        motoristas.filter(m => m.name?.toLowerCase().includes(busca.toLowerCase()))
    , [motoristas, busca]);

    if (loading) return (
        <div className="flex justify-center py-16">
            <div className="animate-spin h-8 w-8 rounded-full border-4" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
        </div>
    );

    return (
        <div>
            {/* Busca */}
            <div className="flex items-center gap-3 mb-5">
                <div className="flex-1 relative">
                    <Icon name="Search" size={15} color="var(--color-muted-foreground)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                    <input value={busca} onChange={e => setBusca(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 rounded-lg border text-sm outline-none" style={inputStyle}
                        placeholder="Buscar motorista..." />
                </div>
                <span className="text-xs px-2 py-1 rounded-lg" style={{ backgroundColor: '#F1F5F9', color: 'var(--color-muted-foreground)' }}>
                    {filtrados.length} motorista{filtrados.length !== 1 ? 's' : ''}
                </span>
            </div>

            {filtrados.length === 0 ? (
                <div className="bg-white rounded-xl border flex flex-col items-center justify-center py-16 px-6 text-center" style={{ borderColor: 'var(--color-border)' }}>
                    <Icon name="Users" size={40} color="var(--color-muted-foreground)" />
                    <p className="text-sm mt-3 font-medium" style={{ color: 'var(--color-muted-foreground)' }}>
                        {busca ? 'Nenhum motorista encontrado' : 'Nenhum motorista de caminhão cadastrado'}
                    </p>
                    <p className="text-xs mt-1" style={{ color: 'var(--color-muted-foreground)' }}>
                        Cadastre motoristas no painel de Admin para visualizá-los aqui
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {filtrados.map(m => (
                        <button key={m.id} onClick={() => setSelecionado(m)}
                            className="flex items-center gap-4 p-4 bg-white rounded-xl border shadow-sm hover:shadow-md hover:border-blue-200 transition-all text-left"
                            style={{ borderColor: 'var(--color-border)' }}>
                            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
                                style={{ background: 'linear-gradient(135deg, #1D4ED8, #7C3AED)' }}>
                                {m.name[0]?.toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold text-sm truncate" style={{ color: 'var(--color-text-primary)' }}>{m.name}</p>
                                <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted-foreground)' }}>Motorista · Caminhão</p>
                            </div>
                            <Icon name="ChevronRight" size={16} color="var(--color-muted-foreground)" />
                        </button>
                    ))}
                </div>
            )}

            {/* Painel do motorista selecionado */}
            {selecionado && (
                <PainelMotorista
                    motorista={selecionado}
                    adminProfile={adminProfile}
                    onClose={() => setSelecionado(null)}
                />
            )}
            <Toast toast={toast} />
        </div>
    );
}
