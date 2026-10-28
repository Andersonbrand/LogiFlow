import React, { useState, useEffect } from 'react';

import { useToast } from 'hooks/useToast';
import { useCustoConfig, saveCustoConfig } from 'services/settingsService';
import { AppIcon as Icon, Toast } from 'components';

import { inputCls, inputStyle } from '../../utils/constants';
import { BRL } from '../../utils/helpers';

// ─── Painel: Custo Médio do Produto + Custo Operacional — apenas frota própria ─
// Dois valores globais (R$/saco) usados junto ao preço de venda de cada cidade
// para revelar a margem de venda: Margem = Venda − (Custo do Produto + Custo Operacional).
export default function PainelCustos({ isAdmin, onChange }) {
    const { toast, showToast } = useToast();
    const { custoConfig, loadingCustoConfig, reloadCustoConfig } = useCustoConfig();
    const [editando, setEditando] = useState(false);
    const [produto, setProduto] = useState('');
    const [operacional, setOperacional] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => { onChange && onChange(custoConfig); }, [custoConfig.custoMedioProduto, custoConfig.custoOperacional]); // eslint-disable-line

    const abrirEdicao = () => {
        setProduto(String(custoConfig.custoMedioProduto || ''));
        setOperacional(String(custoConfig.custoOperacional || ''));
        setEditando(true);
    };

    const salvar = async () => {
        if (produto === '' || isNaN(produto) || Number(produto) < 0) { showToast('Informe um custo de produto válido.', 'error'); return; }
        if (operacional === '' || isNaN(operacional) || Number(operacional) < 0) { showToast('Informe um custo operacional válido.', 'error'); return; }
        setSaving(true);
        try {
            await saveCustoConfig({ custoMedioProduto: Number(produto), custoOperacional: Number(operacional) });
            showToast('Custos atualizados!', 'success');
            setEditando(false);
            reloadCustoConfig();
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
        finally { setSaving(false); }
    };

    if (loadingCustoConfig) return null;
    const custoTotal = Number(custoConfig.custoMedioProduto || 0) + Number(custoConfig.custoOperacional || 0);

    return (
        <div className="rounded-xl border p-4 flex flex-wrap items-center gap-4 justify-between" style={{ backgroundColor: '#FFF7ED', borderColor: '#FED7AA' }}>
            <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg" style={{ backgroundColor: '#FFEDD5' }}>
                    <Icon name="Package" size={18} color="#C2410C" />
                </div>
                <div>
                    <p className="text-sm font-semibold" style={{ color: '#C2410C' }}>Custo do Produto + Custo Operacional</p>
                    <p className="text-xs mt-0.5 max-w-md" style={{ color: '#9A5B3C' }}>
                        Preço médio do cimento e custo operacional rateado de toda a operação de transporte (por saco).
                        Somados ao frete de cada cidade, são usados para calcular a margem de venda abaixo.
                    </p>
                </div>
            </div>
            {editando ? (
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-1.5">
                        <span className="text-xs" style={{ color: '#C2410C' }}>Produto R$</span>
                        <input type="number" min="0" step="0.01" autoFocus value={produto} onChange={e => setProduto(e.target.value)}
                            className={inputCls} style={{ ...inputStyle, width: 95 }} placeholder="0,00" />
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="text-xs" style={{ color: '#C2410C' }}>Operacional R$</span>
                        <input type="number" min="0" step="0.01" value={operacional} onChange={e => setOperacional(e.target.value)}
                            className={inputCls} style={{ ...inputStyle, width: 95 }} placeholder="0,00" />
                    </div>
                    <span className="text-xs" style={{ color: '#9A5B3C' }}>/saco</span>
                    <button onClick={salvar} disabled={saving} className="p-1.5 rounded-lg hover:bg-orange-100 transition-colors" title="Salvar">
                        <Icon name="Check" size={16} color="#059669" />
                    </button>
                    <button onClick={() => setEditando(false)} className="p-1.5 rounded-lg hover:bg-orange-100 transition-colors" title="Cancelar">
                        <Icon name="X" size={16} color="#6B7280" />
                    </button>
                </div>
            ) : (
                <div className="flex items-center gap-4">
                    <div className="text-right">
                        <p className="text-[10px] uppercase font-semibold" style={{ color: '#9A5B3C' }}>Produto + Operacional</p>
                        <span className="text-2xl font-black font-data" style={{ color: '#C2410C' }}>{BRL(custoTotal)}<span className="text-xs font-normal ml-1">/saco</span></span>
                    </div>
                    {isAdmin && (
                        <button onClick={abrirEdicao} className="p-1.5 rounded-lg hover:bg-orange-100 transition-colors" title="Editar custos">
                            <Icon name="Pencil" size={16} color="#C2410C" />
                        </button>
                    )}
                </div>
            )}
            <Toast toast={toast} />
        </div>
    );
}
