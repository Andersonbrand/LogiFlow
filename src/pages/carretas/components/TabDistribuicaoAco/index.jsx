import React, { useState, useCallback, useEffect, useMemo } from 'react';

import { useToast } from 'hooks/useToast';
import { useConfirm, usePagination, AppIcon as Icon, ActionButtonsGroup, ViewButton, EditButton, DeleteButton, PaginationBar, Toast } from 'components';
import { useAuth } from 'context/AuthContext';
import { fetchCarreteirosPropriosOnly, fetchEnviosAco, fetchVeiculosProprios, fetchMotoristasProprios, fetchFretesCidades, atualizarEnvioAco, registrarEnvioAco, excluirEnvioAco, assinarEnvioAco, desassinarEnvioAco } from 'services/carretas';
import { fetchCaminhoesPlacas } from 'services/vehicleService';
import { useRecarregarAoVoltar } from 'hooks/useRecarregarAoVoltar';
import { printEnvioAco } from 'utils/excel';

import { PEDIDO_ACO_VAZIO } from './utils/helpers';
import FormModal from './components/FormModal';

const fmtDataAco = (d) => d ? new Date(String(d).slice(0, 10) + 'T00:00:00').toLocaleDateString('pt-BR') : '—';

// Registros antigos não têm "pedidos" (só o texto livre em "destino")
const pedidosDoEnvioAco = (e) => (Array.isArray(e?.pedidos) ? e.pedidos : []);

const resumoPedidosAco = (pedidos) => pedidos
    .map(p => [p.numero_pedido, p.cliente].filter(Boolean).join(' - ') + (p.cidade ? ` · ${p.cidade}` : '') + (p.data_entrega ? ` (${fmtDataAco(p.data_entrega).slice(0, 5)})` : ''))
    .join('; ');

export default function TabDistribuicaoAco() {
    const { toast, showToast } = useToast();
    const { confirm, ConfirmDialog } = useConfirm();
    const { profile } = useAuth();
    const [motoristas, setMotoristas] = useState([]);
    const [envios, setEnvios] = useState([]);
    const [veiculos, setVeiculos] = useState([]);   // carretas da frota própria (sem terceiros)
    const [caminhoes, setCaminhoes] = useState([]);  // caminhões da frota
    const [motoristasForm, setMotoristasForm] = useState([]); // carreteiros + motoristas de caminhão, sem terceiros
    const [cidadesFrete, setCidadesFrete] = useState([]);
    const [loading, setLoading] = useState(true);
    const [salvando, setSalvando] = useState(false);
    const [formModal, setFormModal] = useState(null); // null | { id, motoristaId, placa, observacoes, pedidos, destinoAntigo }
    const [erroForm, setErroForm] = useState('');
    const [viewEnvio, setViewEnvio] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [m, e, v, cam, mf, cLiz, cFrota] = await Promise.all([
                fetchCarreteirosPropriosOnly(),
                fetchEnviosAco(),
                fetchVeiculosProprios().catch(() => []),
                fetchCaminhoesPlacas().catch(() => []),
                fetchMotoristasProprios().catch(() => []),
                fetchFretesCidades('liz').catch(() => []),
                fetchFretesCidades('frota').catch(() => []),
            ]);
            setMotoristas(m || []);
            setEnvios(e || []);
            setVeiculos(v || []);
            setCaminhoes(cam || []);
            setMotoristasForm(mf || []);
            // Cidades das tabelas de frete (estoque + frota), sem repetir a mesma cidade
            const vistas = new Set();
            const norm = t => String(t || '').split(',')[0].normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
            setCidadesFrete([...(cLiz || []), ...(cFrota || [])].map(x => x.cidade).filter(n => { const k = norm(n); if (!k || vistas.has(k)) return false; vistas.add(k); return true; }));
        } catch (err) { showToast('Erro ao carregar: ' + err.message, 'error'); }
        finally { setLoading(false); }
    }, []); // eslint-disable-line
    useEffect(() => { load(); }, [load]);
    useRecarregarAoVoltar(load);

    const historicoPag = usePagination(envios, 10, [envios.length]);

    const fila = useMemo(() => {
        const ultimoPorMotorista = {};
        envios.forEach(e => {
            if (!e.motorista_id) return;
            const atual = ultimoPorMotorista[e.motorista_id];
            if (!atual || e.data_envio > atual) ultimoPorMotorista[e.motorista_id] = e.data_envio;
        });
        return motoristas
            .map(m => ({
                id: m.id,
                nome: m.name,
                ultimoEnvio: ultimoPorMotorista[m.id] || null,
                totalEnvios: envios.filter(e => e.motorista_id === m.id).length,
            }))
            .sort((a, b) => {
                if (!a.ultimoEnvio && !b.ultimoEnvio) return a.nome.localeCompare(b.nome);
                if (!a.ultimoEnvio) return -1; // nunca levou aço — prioridade máxima
                if (!b.ultimoEnvio) return 1;
                return a.ultimoEnvio.localeCompare(b.ultimoEnvio); // mais antigo primeiro
            });
    }, [motoristas, envios]);

    // Sugestões para autocompletar (reaproveita o que já foi digitado em envios anteriores)
    const clientesConhecidos = useMemo(() => [...new Set(envios.flatMap(e => pedidosDoEnvioAco(e).map(p => p.cliente)).filter(Boolean))].sort(), [envios]);
    const cidadesConhecidas = useMemo(() => [...new Set([...envios.flatMap(e => pedidosDoEnvioAco(e).map(p => p.cidade)), ...cidadesFrete].filter(Boolean))].sort(), [envios, cidadesFrete]);
    const placaOptions = useMemo(() => {
        const base = [
            ...veiculos.map(v => ({ value: String(v.placa || '').toUpperCase(), label: String(v.placa || '').toUpperCase(), sublabel: v.modelo ? `${v.modelo} · Carreta` : 'Carreta' })),
            ...caminhoes.map(v => ({ value: String(v.placa || '').toUpperCase(), label: String(v.placa || '').toUpperCase(), sublabel: v.modelo ? `${v.modelo} · Caminhão` : 'Caminhão' })),
        ].filter(o => o.value);
        const vistas = new Set();
        return base.filter(o => !vistas.has(o.value) && vistas.add(o.value)).sort((a, b) => a.label.localeCompare(b.label));
    }, [veiculos, caminhoes]);
    const motoristaOptions = useMemo(() => {
        const opts = motoristasForm.map(m => ({ value: m.id, label: m.name, sublabel: m.tipo_veiculo === 'carreta' || m.role === 'carreteiro' ? 'Carreta' : 'Caminhão' }));
        // registro antigo cujo motorista não está mais na lista (ex.: terceiro): mantém a opção para não perder o vínculo
        if (formModal?.motoristaId && formModal?.motoristaNome && !opts.some(o => o.value === formModal.motoristaId)) {
            opts.unshift({ value: formModal.motoristaId, label: formModal.motoristaNome, sublabel: 'fora da frota própria' });
        }
        return opts.sort((a, b) => a.label.localeCompare(b.label));
    }, [motoristasForm, formModal?.motoristaId, formModal?.motoristaNome]);
    const cidadeOptions = useMemo(() => cidadesConhecidas.map(c => ({ value: c, label: c })), [cidadesConhecidas]);
    const placaSugerida = (motoristaId) => envios.find(e => e.motorista_id === motoristaId && e.placa)?.placa || '';
    const nomeMotorista = (id) => motoristas.find(m => m.id === id)?.name || '';

    const abrirNovo = (motoristaId = '') => {
        setErroForm('');
        setFormModal({ id: null, motoristaId, placa: placaSugerida(motoristaId), observacoes: '', pedidos: [PEDIDO_ACO_VAZIO()], destinoAntigo: '', assinar: !!profile?.assinatura_digital, assinaturaAtual: '' });
    };
    const abrirEditar = (e) => {
        setErroForm('');
        const ped = pedidosDoEnvioAco(e);
        setViewEnvio(null);
        setFormModal({
            id: e.id, motoristaId: e.motorista_id || '', motoristaNome: e.motorista?.name || '', placa: e.placa || '', observacoes: e.observacoes || '',
            pedidos: ped.length ? ped.map(p => ({ cliente: p.cliente || '', numero_pedido: p.numero_pedido || '', cidade: p.cidade || '', data_entrega: p.data_entrega || '' })) : [PEDIDO_ACO_VAZIO()],
            destinoAntigo: ped.length ? '' : (e.destino || ''),
            assinar: !!e.assinatura_admin, assinaturaAtual: e.assinatura_admin || '',
        });
    };
    const setCampo = (campo, valor) => setFormModal(f => ({ ...f, [campo]: valor }));
    const setPedido = (idx, campo, valor) => setFormModal(f => ({ ...f, pedidos: f.pedidos.map((p, i) => i === idx ? { ...p, [campo]: valor } : p) }));
    const mudarMotorista = (id) => setFormModal(f => ({ ...f, motoristaId: id, placa: f.placa || placaSugerida(id) }));

    const salvar = async () => {
        const f = formModal;
        if (!f.motoristaId) return setErroForm('Selecione o motorista.');
        if (!f.placa.trim()) return setErroForm('Informe a placa do veículo.');
        for (let i = 0; i < f.pedidos.length; i++) {
            const p = f.pedidos[i];
            if (!p.cliente.trim() || !p.numero_pedido.trim() || !p.cidade.trim() || !p.data_entrega) {
                return setErroForm(`Pedido ${i + 1}: preencha cliente, número do pedido, cidade e data de entrega.`);
            }
        }
        setErroForm('');
        const pedidos = f.pedidos.map(p => ({ cliente: p.cliente.trim(), numero_pedido: p.numero_pedido.trim(), cidade: p.cidade.trim(), data_entrega: p.data_entrega }));
        const payload = {
            motoristaId: f.motoristaId,
            placa: f.placa.trim().toUpperCase(),
            observacoes: f.observacoes.trim() || null,
            pedidos,
            destino: resumoPedidosAco(pedidos),
            // Marcado: mantém a assinatura já existente (se houver) ou assina com a do usuário; desmarcado: remove.
            assinaturaAdmin: f.assinar ? (f.assinaturaAtual || profile?.assinatura_digital || null) : null,
        };
        setSalvando(true);
        try {
            if (f.id) {
                await atualizarEnvioAco(f.id, payload);
                showToast('Envio atualizado!', 'success');
            } else {
                await registrarEnvioAco({ ...payload, registradoPor: profile?.id || null });
                showToast('Envio de aço registrado!', 'success');
            }
            setFormModal(null);
            load();
        } catch (e) {
            const colunaFaltando = /column|schema cache|policy|row-level/i.test(e.message || '');
            showToast('Erro: ' + e.message + (colunaFaltando ? ' — rode a migration 20261002_envios_aco_formulario.sql no Supabase.' : ''), 'error');
        } finally { setSalvando(false); }
    };

    const excluir = async (id) => {
        const ok = await confirm({ title: 'Excluir este registro de envio?', message: 'Isso pode alterar a posição do motorista na fila de rodízio.', confirmLabel: 'Excluir', variant: 'danger' });
        if (!ok) return;
        try { await excluirEnvioAco(id); showToast('Registro excluído!', 'warning'); setViewEnvio(null); load(); }
        catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };

    const isAdminAco = profile?.role === 'admin';
    const [assinandoAco, setAssinandoAco] = useState(false);
    const aplicarAssinatura = (atualizado) => {
        setViewEnvio(v => v ? { ...v, assinatura_admin: atualizado.assinatura_admin, assinatura_admin_at: atualizado.assinatura_admin_at } : v);
        setEnvios(es => es.map(x => x.id === atualizado.id ? { ...x, assinatura_admin: atualizado.assinatura_admin, assinatura_admin_at: atualizado.assinatura_admin_at } : x));
    };
    const assinar = async (e) => {
        if (!profile?.assinatura_digital) return;
        setAssinandoAco(true);
        try {
            aplicarAssinatura(await assinarEnvioAco(e.id, profile.assinatura_digital));
            showToast('Envio assinado digitalmente!', 'success');
        } catch (err) { showToast('Erro ao assinar: ' + err.message, 'error'); }
        finally { setAssinandoAco(false); }
    };
    const desassinar = async (e) => {
        if (!isAdminAco) return;
        setAssinandoAco(true);
        try {
            aplicarAssinatura(await desassinarEnvioAco(e.id));
            showToast('Assinatura removida.', 'success');
        } catch (err) { showToast('Erro ao remover assinatura: ' + err.message, 'error'); }
        finally { setAssinandoAco(false); }
    };

    const inputCls = 'w-full px-3 py-2 rounded-lg border text-sm outline-none transition-all focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white';
    const inputStyle = { borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' };
    const labelCls = 'text-xs font-semibold block mb-1';
    const labelStyle = { color: 'var(--color-text-secondary)' };
    const FMT = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : 'Nunca levou';

    if (loading) {
        return (
            <div className="flex justify-center py-16">
                <div className="animate-spin h-7 w-7 rounded-full border-4" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
            </div>
        );
    }

    return (
        <div className="space-y-5">
            <div className="rounded-xl border p-4 flex items-start gap-3" style={{ backgroundColor: '#F0FDF4', borderColor: '#A7F3D0' }}>
                <Icon name="RefreshCw" size={18} color="#059669" className="flex-shrink-0 mt-0.5" />
                <div>
                    <p className="text-sm font-semibold" style={{ color: '#059669' }}>Fila de rodízio para envio de aço</p>
                    <p className="text-xs mt-0.5" style={{ color: '#065F46' }}>
                        Ordenada por quem está há mais tempo sem levar aço/ferro (topo da lista = próximo a enviar).
                        Ao fechar uma venda de aço, registre o envio do motorista escolhido para ele voltar ao fim da fila.
                    </p>
                </div>
            </div>

            <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
                <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-3 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide" style={{ backgroundColor: '#F9FAFB', color: 'var(--color-muted-foreground)' }}>
                    <span>#</span>
                    <span>Motorista</span>
                    <span>Último envio de aço</span>
                    <span>Total de envios</span>
                    <span></span>
                </div>
                {fila.length === 0 ? (
                    <p className="p-6 text-sm text-center" style={{ color: 'var(--color-muted-foreground)' }}>Nenhum motorista de carreta da frota própria encontrado.</p>
                ) : fila.map((f, idx) => (
                    <div key={f.id} className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-3 px-4 py-3 items-center border-t text-sm" style={{ borderColor: 'var(--color-border)' }}>
                        <span className="font-black text-base" style={{ color: idx === 0 ? '#059669' : 'var(--color-muted-foreground)' }}>{idx + 1}º</span>
                        <span className="font-medium truncate flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
                            {f.nome}
                            {idx === 0 && <span className="px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 text-[10px] font-semibold">Próximo</span>}
                        </span>
                        <span className={!f.ultimoEnvio ? 'text-green-700 font-semibold' : ''} style={f.ultimoEnvio ? { color: 'var(--color-text-primary)' } : {}}>{FMT(f.ultimoEnvio)}</span>
                        <span style={{ color: 'var(--color-muted-foreground)' }}>{f.totalEnvios}</span>
                        <span className="flex justify-end">
                            <button onClick={() => abrirNovo(f.id)}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-green-600 text-white hover:bg-green-700 transition-colors whitespace-nowrap">
                                <Icon name="Truck" size={12} /> Registrar envio hoje
                            </button>
                        </span>
                    </div>
                ))}
            </div>

            {envios.length > 0 && (
                <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
                    <div className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide" style={{ backgroundColor: '#F9FAFB', color: 'var(--color-muted-foreground)' }}>
                        Histórico de envios
                    </div>
                    {historicoPag.pageItems.map(e => {
                        const ped = pedidosDoEnvioAco(e);
                        return (
                            <div key={e.id} className="flex items-center justify-between gap-3 px-4 py-2.5 border-t text-sm" style={{ borderColor: 'var(--color-border)' }}>
                                <span className="min-w-0">
                                    <span className="font-medium">{e.motorista?.name || '—'}</span>
                                    {e.placa && <span className="ml-2 px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[11px] font-data">{e.placa}</span>}
                                    <span className="text-xs ml-2" style={{ color: 'var(--color-muted-foreground)' }}>
                                        {FMT(e.data_envio)}{(ped.length ? resumoPedidosAco(ped) : e.destino) ? ` · ${ped.length ? resumoPedidosAco(ped) : e.destino}` : ''}
                                    </span>
                                    {e.assinatura_admin && <span className="ml-2 text-[10px] font-semibold text-green-700">✓ assinado</span>}
                                </span>
                                <ActionButtonsGroup>
                                    <ViewButton onClick={() => setViewEnvio(e)} title="Visualizar" />
                                    <button type="button" onClick={() => printEnvioAco(e)} title="Imprimir comprovante" className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors flex-shrink-0">
                                        <Icon name="Printer" size={16} color="#475569" className="flex-shrink-0" />
                                    </button>
                                    <EditButton onClick={() => abrirEditar(e)} />
                                    <DeleteButton onClick={() => excluir(e.id)} title="Excluir registro" />
                                </ActionButtonsGroup>
                            </div>
                        );
                    })}
                    <div className="px-4 py-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
                        <PaginationBar page={historicoPag.page} setPage={historicoPag.setPage} totalPages={historicoPag.totalPages}
                            totalItems={historicoPag.totalItems} pageSize={historicoPag.pageSize} itemLabel="envio" />
                    </div>
                </div>
            )}
            <Toast toast={toast} />
            {/* display: contents evita que o space-y-5 aplique margin-top no overlay do diálogo */}
            <div style={{ display: 'contents' }}>{ConfirmDialog}</div>


            {/* ── Formulário (novo / edição) ── */}
            {formModal && (
                <FormModal
                    cidadeOptions={cidadeOptions}
                    clientesConhecidos={clientesConhecidos}
                    erroForm={erroForm}
                    formModal={formModal}
                    inputCls={inputCls}
                    inputStyle={inputStyle}
                    labelCls={labelCls}
                    labelStyle={labelStyle}
                    motoristaOptions={motoristaOptions}
                    mudarMotorista={mudarMotorista}
                    placaOptions={placaOptions}
                    profile={profile}
                    salvando={salvando}
                    salvar={salvar}
                    setCampo={setCampo}
                    setFormModal={setFormModal}
                    setPedido={setPedido}
                />
            )}

            {/* ── Visualização ── */}
            {viewEnvio && (() => {
                const ped = pedidosDoEnvioAco(viewEnvio);
                return (
                    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)', marginTop: 0 }}
                        onClick={() => setViewEnvio(null)}>
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[92vh] flex flex-col" onClick={e => e.stopPropagation()}>
                            <div className="px-5 pt-5 pb-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--color-border)' }}>
                                <h3 className="font-heading font-bold text-base" style={{ color: 'var(--color-text-primary)' }}>Envio de aço</h3>
                                <button onClick={() => setViewEnvio(null)} className="p-1 rounded-lg hover:bg-gray-100"><Icon name="X" size={18} /></button>
                            </div>
                            <div className="p-5 overflow-y-auto space-y-3 text-sm">
                                <div className="grid grid-cols-2 gap-3">
                                    <div><p className="text-[11px] uppercase text-slate-500">Motorista</p><p className="font-semibold">{viewEnvio.motorista?.name || '—'}</p></div>
                                    <div><p className="text-[11px] uppercase text-slate-500">Placa</p><p className="font-semibold font-data">{viewEnvio.placa || '—'}</p></div>
                                    <div><p className="text-[11px] uppercase text-slate-500">Data do envio</p><p className="font-semibold">{fmtDataAco(viewEnvio.data_envio)}</p></div>
                                </div>
                                {ped.length > 0 ? (
                                    <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
                                        {ped.map((p, i) => (
                                            <div key={i} className={`px-3 py-2 ${i > 0 ? 'border-t' : ''}`} style={{ borderColor: 'var(--color-border)' }}>
                                                <p className="font-semibold">Pedido {p.numero_pedido} — {p.cliente}</p>
                                                <p className="text-xs text-slate-500">{p.cidade} · entrega {fmtDataAco(p.data_entrega)}</p>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm"><span className="text-[11px] uppercase text-slate-500 block">Destino (registro antigo)</span>{viewEnvio.destino || '—'}</p>
                                )}
                                {viewEnvio.observacoes && <p><span className="text-[11px] uppercase text-slate-500 block">Observações</span>{viewEnvio.observacoes}</p>}
                                {(profile?.role === 'admin' || profile?.role === 'operador') && (viewEnvio.assinatura_admin ? (
                                    <label className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg ${isAdminAco ? 'cursor-pointer' : ''}`}
                                        style={{ backgroundColor: '#F5F3FF', border: '1px solid #C4B5FD' }}
                                        title={isAdminAco ? 'Desmarque para remover a assinatura' : undefined}>
                                        <input type="checkbox" checked readOnly={!isAdminAco} disabled={!isAdminAco || assinandoAco}
                                            onChange={() => isAdminAco && desassinar(viewEnvio)} className="w-4 h-4" />
                                        <Icon name="BadgeCheck" size={14} color="#7C3AED" />
                                        <span className="text-xs font-medium" style={{ color: '#7C3AED' }}>
                                            <strong>Transporte (admin):</strong> {viewEnvio.assinatura_admin}
                                            {viewEnvio.assinatura_admin_at && ` em ${new Date(viewEnvio.assinatura_admin_at).toLocaleDateString('pt-BR')}`}
                                            {isAdminAco && ' — desmarque para remover'}
                                        </span>
                                    </label>
                                ) : profile?.assinatura_digital ? (
                                    <label className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg cursor-pointer" style={{ backgroundColor: 'var(--color-muted)', border: '1px solid var(--color-border)' }}>
                                        <input type="checkbox" checked={false} disabled={assinandoAco} onChange={() => assinar(viewEnvio)} className="w-4 h-4" />
                                        <Icon name="PenTool" size={14} color="var(--color-muted-foreground)" />
                                        <span className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                                            {assinandoAco ? 'Assinando...' : `Assinar como Transporte (admin) (${profile.assinatura_digital})`}
                                        </span>
                                    </label>
                                ) : (
                                    <p className="text-xs flex items-center gap-1.5" style={{ color: 'var(--color-muted-foreground)' }}>
                                        <Icon name="Info" size={12} />
                                        Você ainda não tem uma assinatura digital cadastrada. Cadastre em Admin &gt; Configurações.
                                    </p>
                                ))}
                            </div>
                            <div className="flex flex-wrap gap-2 justify-end px-5 py-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
                                <button onClick={() => excluir(viewEnvio.id)} className="px-3 py-2 rounded-lg border text-sm font-medium text-red-600 hover:bg-red-50" style={{ borderColor: '#FECACA' }}>Excluir</button>
                                <button onClick={() => abrirEditar(viewEnvio)} className="px-3 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50" style={{ borderColor: 'var(--color-border)' }}>Editar</button>
                                <button onClick={() => printEnvioAco(viewEnvio)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-slate-800 text-white hover:bg-slate-900">
                                    <Icon name="Printer" size={14} /> Imprimir
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
}
