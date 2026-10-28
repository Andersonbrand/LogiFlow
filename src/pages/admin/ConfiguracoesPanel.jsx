import React, { useState, useEffect, useMemo } from 'react';
import { fetchBonusConfig, saveBonusConfig, BONUS_CONFIG_DEFAULT } from 'services/settingsService';
import { fetchAllUsers, updateUserProfile } from 'services/userService';
import { AppIcon as Icon, PrettySelect } from 'components';

const BRL = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function ConfiguracoesPanel({ showToast, profile }) {
    const [loading, setLoading] = useState(true);
    const [salvando, setSalvando] = useState(false);
    const [bonusBaixo, setBonusBaixo] = useState(String(BONUS_CONFIG_DEFAULT.bonusBaixo));
    const [bonusAlto, setBonusAlto]   = useState(String(BONUS_CONFIG_DEFAULT.bonusAlto));
    const [modoBonus, setModoBonus]   = useState('fixo'); // 'fixo' | 'km'
    const [faixasKm, setFaixasKm]     = useState(BONUS_CONFIG_DEFAULT.faixasKm.map(f => ({ ateKm: String(f.ateKm), valor: String(f.valor) })));
    const [valorAcimaKm, setValorAcimaKm] = useState(String(BONUS_CONFIG_DEFAULT.valorAcimaKm));

    // ── Assinaturas digitais (todos os usuários) ────────────────────────────
    const [usuarios, setUsuarios]           = useState([]);
    const [loadingAssinaturas, setLoadingAssinaturas] = useState(true);
    const [buscaAssinatura, setBuscaAssinatura] = useState('');
    const [filtroPapel, setFiltroPapel]     = useState('');
    const [valoresAssinatura, setValoresAssinatura] = useState({});
    const [savingAssinaturaId, setSavingAssinaturaId] = useState(null);

    // Motoristas (caminhão e carreta/carreteiro) não possuem assinatura digital
    // habilitada no sistema — essa função é exclusiva de admin, operador e mecânico.
    const ROLE_LABELS = {
        admin: 'Admin', operador: 'Operador', mecanico: 'Mecânico',
    };
    const papelDoUsuario = (u) => u.role || 'operador';
    const isMotoristaRole = (u) => u.role === 'carreteiro' || u.role === 'motorista';

    const loadUsuarios = async () => {
        setLoadingAssinaturas(true);
        try {
            const u = await fetchAllUsers();
            // Filtra motoristas fora da lista — nunca devem ter assinatura digital cadastrada
            const semMotoristas = (u || []).filter(x => !isMotoristaRole(x));
            setUsuarios(semMotoristas);
            setValoresAssinatura(Object.fromEntries(semMotoristas.map(x => [x.id, x.assinatura_digital || ''])));
        } catch (e) { showToast('Erro ao carregar usuários: ' + e.message, 'error'); }
        finally { setLoadingAssinaturas(false); }
    };
    useEffect(() => { loadUsuarios(); }, []); // eslint-disable-line

    const salvarAssinatura = async (userId) => {
        setSavingAssinaturaId(userId);
        try {
            await updateUserProfile(userId, { assinatura_digital: valoresAssinatura[userId]?.trim() || null });
            showToast('Assinatura salva!', 'success');
        } catch (e) { showToast('Erro ao salvar: ' + e.message, 'error'); }
        finally { setSavingAssinaturaId(null); }
    };

    const usuariosFiltrados = useMemo(() => {
        let lista = usuarios;
        if (filtroPapel) lista = lista.filter(u => papelDoUsuario(u) === filtroPapel);
        if (buscaAssinatura.trim()) {
            const q = buscaAssinatura.toLowerCase();
            lista = lista.filter(u => (u.name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q));
        }
        return lista;
    }, [usuarios, filtroPapel, buscaAssinatura]); // eslint-disable-line

    useEffect(() => {
        (async () => {
            try {
                const cfg = await fetchBonusConfig();
                setBonusBaixo(String(cfg.bonusBaixo));
                setBonusAlto(String(cfg.bonusAlto));
                setModoBonus(cfg.modo);
                setFaixasKm(cfg.faixasKm.map(f => ({ ateKm: String(f.ateKm), valor: String(f.valor) })));
                setValorAcimaKm(String(cfg.valorAcimaKm));
            } catch (e) { showToast('Erro ao carregar configurações: ' + e.message, 'error'); }
            finally { setLoading(false); }
        })();
    }, []); // eslint-disable-line

    const salvar = async () => {
        const b = Number(String(bonusBaixo).replace(',', '.'));
        const a = Number(String(bonusAlto).replace(',', '.'));
        if (isNaN(b) || b < 0 || isNaN(a) || a < 0) { showToast('Digite valores válidos (maiores ou iguais a zero)', 'error'); return; }
        const num = v => Number(String(v).replace(',', '.'));
        const faixas = faixasKm.map(f => ({ ateKm: num(f.ateKm), valor: num(f.valor) }));
        const acima = num(valorAcimaKm);
        if (modoBonus === 'km') {
            if (faixas.length === 0) { showToast('Cadastre ao menos uma faixa de km', 'error'); return; }
            if (faixas.some(f => isNaN(f.ateKm) || f.ateKm <= 0 || isNaN(f.valor) || f.valor < 0) || isNaN(acima) || acima < 0) {
                showToast('Confira as faixas: km maior que zero e valores maiores ou iguais a zero', 'error'); return;
            }
            if (new Set(faixas.map(f => f.ateKm)).size !== faixas.length) { showToast('Há duas faixas com o mesmo limite de km', 'error'); return; }
        }
        setSalvando(true);
        try {
            await saveBonusConfig({ bonusBaixo: b, bonusAlto: a, modo: modoBonus, faixasKm: faixas.filter(f => !isNaN(f.ateKm) && !isNaN(f.valor)), valorAcimaKm: isNaN(acima) ? 0 : acima }, profile?.id || null);
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
                    <div>
                        <label className="text-sm font-medium text-slate-700 block mb-1.5">Como o bônus é calculado</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {[
                                { v: 'fixo', t: 'Valor fixo por destino', d: 'Dois valores: cidades de rodízio/estoque e demais cidades.' },
                                { v: 'km',   t: 'Por KM rodado',          d: 'Valor por faixa de distância, usando o km da tabela de Fretes da Frota.' },
                            ].map(op => (
                                <button key={op.v} type="button" onClick={() => setModoBonus(op.v)}
                                    className="text-left p-3 rounded-lg border transition-colors"
                                    style={modoBonus === op.v ? { backgroundColor: '#EFF6FF', borderColor: '#93C5FD' } : { borderColor: '#CBD5E1' }}>
                                    <p className="text-sm font-semibold" style={{ color: modoBonus === op.v ? '#1D4ED8' : '#334155' }}>{op.t}</p>
                                    <p className="text-xs text-slate-500 mt-0.5">{op.d}</p>
                                </button>
                            ))}
                        </div>
                    </div>

                    {modoBonus === 'km' && (
                        <div className="space-y-3">
                            <p className="text-xs text-slate-500">
                                Cada destino usa o km cadastrado em Carretas → Fretes → Frota própria. Destino sem km cadastrado cai nos valores fixos abaixo.
                            </p>
                            {faixasKm.map((f, i) => (
                                <div key={i} className="flex items-end gap-2 flex-wrap">
                                    <div className="w-36">
                                        <label className="text-xs text-slate-500 block mb-1">{i === 0 ? 'Até (km)' : 'Acima da anterior, até (km)'}</label>
                                        <input value={f.ateKm} inputMode="decimal" className={inputCls} style={{ borderColor: '#CBD5E1' }}
                                            onChange={e => setFaixasKm(l => l.map((x, j) => j === i ? { ...x, ateKm: e.target.value } : x))} />
                                    </div>
                                    <div className="w-36">
                                        <label className="text-xs text-slate-500 block mb-1">Bônus (R$)</label>
                                        <input value={f.valor} inputMode="decimal" className={inputCls} style={{ borderColor: '#CBD5E1' }}
                                            onChange={e => setFaixasKm(l => l.map((x, j) => j === i ? { ...x, valor: e.target.value } : x))} />
                                    </div>
                                    <button type="button" onClick={() => setFaixasKm(l => l.filter((_, j) => j !== i))} disabled={faixasKm.length <= 1}
                                        className="p-2.5 rounded-lg hover:bg-red-50 disabled:opacity-30" title="Remover faixa">
                                        <Icon name="Trash2" size={15} color="#DC2626" />
                                    </button>
                                </div>
                            ))}
                            <button type="button" onClick={() => setFaixasKm(l => [...l, { ateKm: '', valor: '' }])}
                                className="text-xs font-medium flex items-center gap-1 text-blue-700 hover:underline">
                                <Icon name="Plus" size={13} color="#1D4ED8" /> Adicionar faixa
                            </button>
                            <div className="w-48">
                                <label className="text-xs text-slate-500 block mb-1">Acima da última faixa (R$)</label>
                                <input value={valorAcimaKm} onChange={e => setValorAcimaKm(e.target.value)} inputMode="decimal"
                                    className={inputCls} style={{ borderColor: '#CBD5E1' }} />
                            </div>
                        </div>
                    )}

                    <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                        {modoBonus === 'km' ? 'Valores fixos (reserva para destinos sem km)' : 'Valores fixos'}
                    </p>
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

                    {modoBonus === 'km' && (
                        <div className="rounded-lg p-3 text-xs" style={{ backgroundColor: '#EFF6FF', color: '#1E40AF' }}>
                            Pré-visualização: {[...faixasKm].map(f => ({ k: Number(String(f.ateKm).replace(',', '.')), v: Number(String(f.valor).replace(',', '.')) })).filter(f => !isNaN(f.k)).sort((a, b) => a.k - b.k).map((f, i, arr) => (
                                <span key={i}>{i === 0 ? 'até' : `de ${arr[i - 1].k} a`} <strong>{f.k} km</strong> = <strong>{BRL(f.v || 0)}</strong>; </span>
                            ))}
                            acima disso = <strong>{BRL(Number(String(valorAcimaKm).replace(',', '.')) || 0)}</strong>.
                        </div>
                    )}
                    {modoBonus === 'fixo' && (
                    <div className="rounded-lg p-3 text-xs" style={{ backgroundColor: '#EFF6FF', color: '#1E40AF' }}>
                        Pré-visualização: uma viagem para uma cidade de rodízio/estoque gera <strong>{BRL(Number(String(bonusBaixo).replace(',', '.')) || 0)}</strong> de
                        bônus; para as demais cidades, <strong>{BRL(Number(String(bonusAlto).replace(',', '.')) || 0)}</strong>.
                    </div>
                    )}

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

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
                    <Icon name="PenTool" size={18} color="#1D4ED8" />
                    <div>
                        <h2 className="font-semibold text-slate-800">Assinaturas Digitais</h2>
                        <p className="text-xs text-slate-500">
                            Cadastro da assinatura digital de admins, operadores e mecânicos — os únicos papéis com
                            essa função liberada. Motoristas não possuem assinatura digital no sistema. É essa
                            assinatura que aparece nas Ordens de Serviço (mecânico e responsável) e nos modelos de
                            impressão/exportação de diárias (assinatura do responsável), dentro e fora do módulo de Carretas.
                        </p>
                    </div>
                </div>
                <div className="p-6 space-y-4">
                    <div className="flex flex-wrap gap-2">
                        <input value={buscaAssinatura} onChange={e => setBuscaAssinatura(e.target.value)}
                            placeholder="Buscar por nome ou e-mail..."
                            className={inputCls} style={{ maxWidth: 260, borderColor: '#CBD5E1' }} />
                        <PrettySelect value={filtroPapel} onChange={e => setFiltroPapel(e.target.value)}
                            className="px-3 py-2.5 rounded-lg border text-sm outline-none" style={{ borderColor: '#CBD5E1' }}>
                            <option value="">Todos os papéis</option>
                            {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </PrettySelect>
                    </div>

                    {loadingAssinaturas ? (
                        <div className="flex justify-center py-10">
                            <div className="animate-spin h-6 w-6 rounded-full border-4 border-blue-600 border-t-transparent" />
                        </div>
                    ) : usuariosFiltrados.length === 0 ? (
                        <p className="text-xs text-center py-6 text-slate-400">Nenhum usuário encontrado.</p>
                    ) : (
                        <div className="flex flex-col gap-2 max-h-[520px] overflow-y-auto pr-1">
                            {usuariosFiltrados.map(u => (
                                <div key={u.id} className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-lg bg-slate-50">
                                    <div className="sm:w-56 flex-shrink-0">
                                        <p className="text-sm font-medium text-slate-800 truncate">{u.name || 'Sem nome'}</p>
                                        <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full"
                                            style={{
                                                color: u.id === profile?.id ? '#7C3AED' : '#475569',
                                                backgroundColor: u.id === profile?.id ? '#EDE9FE' : '#E2E8F0',
                                            }}>
                                            {ROLE_LABELS[papelDoUsuario(u)] || u.role}{u.id === profile?.id ? ' · você' : ''}
                                        </span>
                                    </div>
                                    <input value={valoresAssinatura[u.id] || ''}
                                        onChange={e => setValoresAssinatura(v => ({ ...v, [u.id]: e.target.value }))}
                                        placeholder="Ex.: João da Silva"
                                        className={`${inputCls} flex-1`} style={{ borderColor: '#CBD5E1' }} />
                                    <button onClick={() => salvarAssinatura(u.id)} disabled={savingAssinaturaId === u.id}
                                        className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-60 flex-shrink-0">
                                        <Icon name={savingAssinaturaId === u.id ? 'Loader' : 'Check'} size={13} />
                                        Salvar
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
