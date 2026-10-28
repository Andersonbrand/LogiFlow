import React, { useState, useEffect } from 'react';

import { useToast } from 'hooks/useToast';
import { useCaptacaoConfig, saveCaptacaoConfig } from 'services/settingsService';
import { AppIcon as Icon, Toast } from 'components';

import { inputCls, inputStyle } from '../../utils/constants';
import { BRL } from '../../utils/helpers';

// ─── Painel: Valor de Captação (MOC → Estoque) — apenas frota própria ─────────
// Captação = frete usado para buscar o cimento em MOC (Montes Claros) e trazer
// até o Estoque próprio. Distribuição = Frete total da cidade − Captação, ou
// seja, a parcela do frete que remunera efetivamente a entrega até a região.
export default function PainelCaptacao({ isAdmin, onChange }) {
    const { toast, showToast } = useToast();
    const { captacaoConfig, loadingCaptacaoConfig, reloadCaptacaoConfig } = useCaptacaoConfig();
    const [editando, setEditando] = useState(false);
    const [valor, setValor] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => { onChange && onChange(captacaoConfig.valorPorSaco); }, [captacaoConfig.valorPorSaco]); // eslint-disable-line

    const abrirEdicao = () => { setValor(String(captacaoConfig.valorPorSaco || '')); setEditando(true); };

    const salvar = async () => {
        if (valor === '' || isNaN(valor) || Number(valor) < 0) { showToast('Informe um valor válido.', 'error'); return; }
        setSaving(true);
        try {
            await saveCaptacaoConfig({ valorPorSaco: Number(valor) });
            showToast('Valor de captação atualizado!', 'success');
            setEditando(false);
            reloadCaptacaoConfig();
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
        finally { setSaving(false); }
    };

    if (loadingCaptacaoConfig) return null;

    return (
        <div className="rounded-xl border p-4 flex flex-wrap items-center gap-4 justify-between" style={{ backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }}>
            <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg" style={{ backgroundColor: '#DBEAFE' }}>
                    <Icon name="Truck" size={18} color="#1D4ED8" />
                </div>
                <div>
                    <p className="text-sm font-semibold" style={{ color: '#1D4ED8' }}>Valor de Captação (MOC → Estoque)</p>
                    <p className="text-xs mt-0.5 max-w-md" style={{ color: '#3B5A99' }}>
                        Frete usado para buscar o cimento em MOC e trazer até o Estoque próprio. É abatido do frete
                        total de cada cidade abaixo para revelar o valor (e %) de distribuição sobre o frete da região.
                    </p>
                </div>
            </div>
            {editando ? (
                <div className="flex items-center gap-2">
                    <span className="text-xs font-medium" style={{ color: '#1D4ED8' }}>R$</span>
                    <input type="number" min="0" step="0.01" autoFocus value={valor} onChange={e => setValor(e.target.value)}
                        className={inputCls} style={{ ...inputStyle, width: 110 }} placeholder="0,00" />
                    <span className="text-xs" style={{ color: '#3B5A99' }}>/saco</span>
                    <button onClick={salvar} disabled={saving} className="p-1.5 rounded-lg hover:bg-blue-100 transition-colors" title="Salvar">
                        <Icon name="Check" size={16} color="#059669" />
                    </button>
                    <button onClick={() => setEditando(false)} className="p-1.5 rounded-lg hover:bg-blue-100 transition-colors" title="Cancelar">
                        <Icon name="X" size={16} color="#6B7280" />
                    </button>
                </div>
            ) : (
                <div className="flex items-center gap-3">
                    <span className="text-2xl font-black font-data" style={{ color: '#1D4ED8' }}>{BRL(captacaoConfig.valorPorSaco)}</span>
                    <span className="text-xs" style={{ color: '#3B5A99' }}>/saco</span>
                    {isAdmin && (
                        <button onClick={abrirEdicao} className="p-1.5 rounded-lg hover:bg-blue-100 transition-colors" title="Editar valor de captação">
                            <Icon name="Pencil" size={16} color="#1D4ED8" />
                        </button>
                    )}
                </div>
            )}
            <Toast toast={toast} />
        </div>
    );
}
