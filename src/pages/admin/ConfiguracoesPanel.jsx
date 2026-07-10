import React, { useState, useEffect } from 'react';
import Icon from 'components/AppIcon';
import { fetchBonusConfig, saveBonusConfig, BONUS_CONFIG_DEFAULT } from 'utils/settingsService';

const BRL = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function ConfiguracoesPanel({ showToast, profile }) {
    const [loading, setLoading] = useState(true);
    const [salvando, setSalvando] = useState(false);
    const [bonusBaixo, setBonusBaixo] = useState(String(BONUS_CONFIG_DEFAULT.bonusBaixo));
    const [bonusAlto, setBonusAlto]   = useState(String(BONUS_CONFIG_DEFAULT.bonusAlto));

    useEffect(() => {
        (async () => {
            try {
                const cfg = await fetchBonusConfig();
                setBonusBaixo(String(cfg.bonusBaixo));
                setBonusAlto(String(cfg.bonusAlto));
            } catch (e) { showToast('Erro ao carregar configurações: ' + e.message, 'error'); }
            finally { setLoading(false); }
        })();
    }, []); // eslint-disable-line

    const salvar = async () => {
        const b = Number(String(bonusBaixo).replace(',', '.'));
        const a = Number(String(bonusAlto).replace(',', '.'));
        if (isNaN(b) || b < 0 || isNaN(a) || a < 0) { showToast('Digite valores válidos (maiores ou iguais a zero)', 'error'); return; }
        setSalvando(true);
        try {
            await saveBonusConfig({ bonusBaixo: b, bonusAlto: a }, profile?.id || null);
            showToast('Configurações de bônus salvas! Já valem para todos os usuários.', 'success');
        } catch (e) { showToast('Erro ao salvar: ' + e.message, 'error'); }
        finally { setSalvando(false); }
    };

    const inputCls = 'w-full px-3 py-2.5 rounded-lg border text-sm outline-none transition-all focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500';

    if (loading) {
        return (
            <div className="flex justify-center py-16">
                <div className="animate-spin h-7 w-7 rounded-full border-4 border-blue-600 border-t-transparent" />
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-2xl">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
                    <Icon name="Award" size={18} color="#1D4ED8" />
                    <div>
                        <h2 className="font-semibold text-slate-800">Bônus dos motoristas de carreta</h2>
                        <p className="text-xs text-slate-500">Valores usados no cálculo automático do bônus por viagem, conforme o destino.</p>
                    </div>
                </div>
                <div className="p-6 space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm font-medium text-slate-700 block mb-1.5">
                                Bônus — cidades de rodízio / estoque
                            </label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">R$</span>
                                <input value={bonusBaixo} onChange={e => setBonusBaixo(e.target.value)}
                                    inputMode="decimal" className={inputCls} style={{ paddingLeft: 34, borderColor: '#CBD5E1' }} />
                            </div>
                            <p className="text-xs text-slate-500 mt-1">Aplicado às cidades cadastradas como de bônus reduzido.</p>
                        </div>
                        <div>
                            <label className="text-sm font-medium text-slate-700 block mb-1.5">
                                Bônus — demais cidades
                            </label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">R$</span>
                                <input value={bonusAlto} onChange={e => setBonusAlto(e.target.value)}
                                    inputMode="decimal" className={inputCls} style={{ paddingLeft: 34, borderColor: '#CBD5E1' }} />
                            </div>
                            <p className="text-xs text-slate-500 mt-1">Aplicado a todos os outros destinos.</p>
                        </div>
                    </div>

                    <div className="rounded-lg p-3 text-xs" style={{ backgroundColor: '#EFF6FF', color: '#1E40AF' }}>
                        Pré-visualização: uma viagem para uma cidade de rodízio/estoque gera <strong>{BRL(Number(String(bonusBaixo).replace(',', '.')) || 0)}</strong> de
                        bônus; para as demais cidades, <strong>{BRL(Number(String(bonusAlto).replace(',', '.')) || 0)}</strong>.
                    </div>

                    <button onClick={salvar} disabled={salvando}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-60">
                        <Icon name={salvando ? 'Loader' : 'Save'} size={15} />
                        {salvando ? 'Salvando...' : 'Salvar valores de bônus'}
                    </button>
                    <p className="text-xs text-slate-400">
                        Alterar aqui atualiza o cálculo em toda a plataforma (relatórios financeiros, bonificações, app do carreteiro) automaticamente, sem precisar mexer no código.
                    </p>
                </div>
            </div>
        </div>
    );
}
