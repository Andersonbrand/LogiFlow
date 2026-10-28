import React, { useState, useCallback, useEffect } from 'react';
import { fetchDriverProfiles, deleteDriverUser, updateUserProfile, createDriverUser } from 'services/userService';
import { uploadArquivoPublico } from 'services/storageService';
import { supabase } from 'services/supabaseClient';
import { AppIcon as Icon, Button } from 'components';
import { ROLE_CONFIG } from '../../utils/constants';
import { FORM_VAZIO } from './utils/constants';
import ShowForm from './components/ShowForm';
import Detalhe from './components/Detalhe';
import Editando from './components/Editando';
import ConfirmDelete from './components/ConfirmDelete';

export default function MotoristasManager({ showToast }) {
    const [motoristas, setMotoristas] = useState([]);
    const [loading, setLoading]       = useState(true);
    const [showForm, setShowForm]     = useState(false);
    const [saving, setSaving]         = useState(false);
    const [form, setForm]             = useState(FORM_VAZIO);
    const [cnhFile, setCnhFile]       = useState(null);
    const [showSenha, setShowSenha]       = useState(false);
    const [detalhe, setDetalhe]           = useState(null); // motorista selecionado para ver detalhe
    const [lightbox, setLightbox]         = useState(false); // lightbox da foto CNH
    const [confirmDelete, setConfirmDelete] = useState(null); // motorista a excluir
    const [deleting, setDeleting]         = useState(false);
    const [editando, setEditando]         = useState(null); // motorista sendo editado
    const [editForm, setEditForm]         = useState({});
    const [editSaving, setEditSaving]     = useState(false);
    const [editCnhFile, setEditCnhFile]   = useState(null); // novo arquivo CNH no modo edição

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const data = await fetchDriverProfiles();
            setMotoristas(data);
        } catch (err) {
            showToast('Erro ao carregar motoristas: ' + err.message, 'error');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, []);

    const setField = (k, v) => setForm(p => ({ ...p, [k]: v }));

    const handleDeleteDriver = async () => {
        if (!confirmDelete) return;
        setDeleting(true);
        try {
            await deleteDriverUser(confirmDelete.id);
            showToast(`Motorista ${confirmDelete.name} removido com sucesso.`, 'success');
            setConfirmDelete(null);
            await load();
        } catch (err) {
            showToast('Erro ao excluir: ' + err.message, 'error');
        } finally {
            setDeleting(false);
        }
    };

    const handleAbrirEdicao = (m) => {
        setEditando(m);
        setEditCnhFile(null);
        setEditForm({
            nome:           m.name             || '',
            role:           (m.role === 'motorista' && m.tipo_veiculo === 'carreta') ? 'motorista_carreta' : (m.role || 'motorista'),
            cnhNumero:      m.cnh_numero       || '',
            cnhCategoria:   m.cnh_categoria    || 'C',
            cnhVencimento:  m.cnh_vencimento   || '',
            dataNascimento: m.data_nascimento  || '',
            is_terceiro:    m.is_terceiro      || false,
        });
    };

    const handleSalvarEdicao = async () => {
        if (!editForm.nome.trim()) { showToast('Informe o nome do motorista.', 'error'); return; }
        setEditSaving(true);
        try {
            const realRole = editForm.role === 'motorista_carreta' ? 'motorista' : editForm.role;
            const tipoVeiculo = editForm.role === 'motorista_carreta' ? 'carreta'
                              : editForm.role === 'motorista'          ? 'caminhao' : null;

            // Faz upload do novo arquivo CNH, se selecionado
            let cnhFotoUrl = undefined; // undefined = não altera; null = remove; string = nova URL
            if (editCnhFile) {
                const ext = editCnhFile.name.split('.').pop().toLowerCase();
                const safeName = `cnh_${editando.id}_${Date.now()}.${ext}`;
                const { url: uploadUrl, error: uploadErr } = await uploadArquivoPublico('cnh-documents', safeName, editCnhFile);
                if (uploadErr) {
                    showToast(`Aviso: não foi possível salvar o novo arquivo da CNH (${uploadErr.message}). Os demais dados serão atualizados normalmente.`, 'error');
                } else {
                    cnhFotoUrl = uploadUrl;
                }
            }

            const updates = {
                name:            editForm.nome.trim(),
                role:            realRole,
                ...(tipoVeiculo ? { tipo_veiculo: tipoVeiculo } : {}),
                cnh_numero:      editForm.cnhNumero      || null,
                cnh_categoria:   editForm.cnhCategoria   || null,
                cnh_vencimento:  editForm.cnhVencimento  || null,
                data_nascimento: editForm.dataNascimento || null,
                is_terceiro:     editForm.is_terceiro    || false,
                ...(cnhFotoUrl !== undefined ? { cnh_foto_url: cnhFotoUrl } : {}),
            };
            await updateUserProfile(editando.id, updates);
            showToast(`Motorista ${editForm.nome} atualizado com sucesso!`, 'success');
            setEditando(null);
            setEditCnhFile(null);
            await load();
        } catch (err) {
            showToast('Erro ao salvar: ' + err.message, 'error');
        } finally {
            setEditSaving(false);
        }
    };

    const handleSubmit = async () => {
        if (!form.nome.trim())  { showToast('Informe o nome do motorista.', 'error');  return; }
        if (!form.email.trim()) { showToast('Informe o e-mail.', 'error');             return; }
        if (!form.email.includes('@')) { showToast('E-mail inválido.', 'error');       return; }
        if (form.senha.length < 6)     { showToast('Senha deve ter ao menos 6 caracteres.', 'error'); return; }

        setSaving(true);
        try {
            // Faz upload da CNH se houver arquivo
            let cnhFotoUrl = null;
            if (cnhFile) {
                // Sanitiza o nome do arquivo (remove espaços e caracteres especiais)
                const ext = cnhFile.name.split('.').pop().toLowerCase();
                const safeName = `cnh_${Date.now()}.${ext}`;
                const { url: uploadUrl, error: uploadErr } = await uploadArquivoPublico('cnh-documents', safeName, cnhFile);
                if (uploadErr) {
                    // Avisa mas não bloqueia o cadastro
                    showToast(`Aviso: foto da CNH não foi salva (${uploadErr.message}). O motorista será cadastrado sem a imagem.`, 'error');
                } else {
                    cnhFotoUrl = uploadUrl;
                }
            }

            await createDriverUser(supabase, { ...form, cnhFotoUrl });
            showToast(`Motorista ${form.nome} cadastrado com sucesso!`, 'success');
            setForm(FORM_VAZIO);
            setCnhFile(null);
            setShowForm(false);
            await load();
        } catch (err) {
            const msg = err.message || '';
            if (msg.toLowerCase().includes('already registered') || msg.toLowerCase().includes('already been registered') || msg.toLowerCase().includes('user already')) {
                showToast('Este e-mail já está cadastrado no sistema. Use outro e-mail ou exclua o usuário existente primeiro.', 'error');
            } else if (msg.toLowerCase().includes('invalid email')) {
                showToast('Endereço de e-mail inválido.', 'error');
            } else if (msg.toLowerCase().includes('weak password') || msg.toLowerCase().includes('password')) {
                showToast('Senha muito fraca. Use ao menos 6 caracteres.', 'error');
            } else {
                showToast('Erro ao cadastrar: ' + msg, 'error');
            }
        } finally {
            setSaving(false);
        }
    };

    const inputCls2 = 'w-full h-9 px-3 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-200';

    if (loading) return (
        <div className="flex justify-center py-16">
            <div className="animate-spin h-7 w-7 rounded-full border-4 border-slate-300" style={{ borderTopColor: 'var(--color-primary)' }} />
        </div>
    );

    return (
        <div className="flex flex-col gap-5">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
                        <Icon name="Truck" size={18} color="var(--color-primary)" />
                        Motoristas Cadastrados
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                        Gerencie os motoristas, mecânicos e dados de CNH da frota.
                    </p>
                </div>
                <Button variant="default" iconName="UserPlus" iconSize={14} onClick={() => { setShowForm(true); setDetalhe(null); }}>
                    Novo Motorista
                </Button>
            </div>

            {/* Formulário de cadastro */}
            {showForm && (
                <ShowForm
                    cnhFile={cnhFile}
                    form={form}
                    handleSubmit={handleSubmit}
                    inputCls2={inputCls2}
                    saving={saving}
                    setCnhFile={setCnhFile}
                    setField={setField}
                    setForm={setForm}
                    setShowForm={setShowForm}
                    setShowSenha={setShowSenha}
                    showSenha={showSenha}
                />
            )}

            {/* Detalhe do motorista */}
            {/* Lightbox da foto CNH */}
            {lightbox && detalhe?.cnh_foto_url && (
                <div className="fixed inset-0 z-[400] flex items-center justify-center"
                    style={{ backgroundColor: 'rgba(0,0,0,0.92)' }}
                    onClick={() => setLightbox(false)}>
                    <button
                        onClick={() => setLightbox(false)}
                        className="absolute top-4 right-4 flex items-center gap-2 px-3 py-2 rounded-xl text-white text-sm font-medium"
                        style={{ backgroundColor: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(4px)' }}>
                        <Icon name="ArrowLeft" size={16} color="#fff" />
                        Voltar
                    </button>
                    <img
                        src={detalhe.cnh_foto_url}
                        alt="CNH"
                        className="max-w-[92vw] max-h-[88vh] object-contain rounded-xl shadow-2xl"
                        onClick={e => e.stopPropagation()}
                    />
                </div>
            )}

            {detalhe && (
                <Detalhe detalhe={detalhe} setDetalhe={setDetalhe} setLightbox={setLightbox} />
            )}

            {/* Modal de edição */}
            {editando && (
                <Editando
                    editCnhFile={editCnhFile}
                    editForm={editForm}
                    editSaving={editSaving}
                    editando={editando}
                    handleSalvarEdicao={handleSalvarEdicao}
                    inputCls2={inputCls2}
                    setEditCnhFile={setEditCnhFile}
                    setEditForm={setEditForm}
                    setEditando={setEditando}
                />
            )}

            {/* Modal de confirmação de exclusão */}
            {confirmDelete && (
                <ConfirmDelete confirmDelete={confirmDelete} deleting={deleting} handleDeleteDriver={handleDeleteDriver} setConfirmDelete={setConfirmDelete} />
            )}

            {/* Lista de motoristas */}
            {motoristas.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                    <Icon name="Truck" size={36} color="#CBD5E1" />
                    <p className="mt-2 text-sm">Nenhum motorista cadastrado</p>
                    <p className="text-xs mt-1">Clique em "Novo Motorista" para começar</p>
                </div>
            ) : (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
                        <Icon name="Truck" size={18} color="var(--color-primary)" />
                        <h2 className="text-base font-semibold text-slate-800">Motoristas e Mecânicos</h2>
                        <span className="ml-auto text-xs text-slate-400">{motoristas.length} cadastrados</span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Nome</th>
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden sm:table-cell">Função</th>
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">CNH</th>
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden lg:table-cell">Vencimento</th>
                                    <th className="px-4 py-3"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {motoristas.map(m => {
                                    const rkey = m.role === 'motorista' && m.tipo_veiculo === 'carreta' ? 'motorista_carreta' : m.role;
                                    const rc   = ROLE_CONFIG[rkey] || ROLE_CONFIG['operador'];
                                    const venc = m.cnh_vencimento ? new Date(m.cnh_vencimento + 'T12:00:00') : null;
                                    const vencendo = venc && (venc - Date.now()) / 86400000 < 30;
                                    return (
                                        <tr key={m.id} className="hover:bg-slate-50">
                                            <td className="px-4 py-3">
                                                <p className="font-medium text-slate-800 text-xs">{m.name || '—'}</p>
                                                <p className="text-slate-400 text-xs">{m.email || ''}</p>
                                                {m.is_terceiro && <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded text-xs font-bold" style={{ backgroundColor: '#FEF3C7', color: '#D97706' }}>Terceirizado</span>}
                                            </td>
                                            <td className="px-4 py-3 hidden sm:table-cell">
                                                <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                                                    style={{ color: rc.color, backgroundColor: rc.bg }}>
                                                    {rc.label}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-slate-600 text-xs hidden md:table-cell">
                                                {m.cnh_numero ? (
                                                    <span>{m.cnh_numero} <span className="text-slate-400">Cat. {m.cnh_categoria || '—'}</span></span>
                                                ) : '—'}
                                            </td>
                                            <td className="px-4 py-3 text-xs hidden lg:table-cell">
                                                {venc ? (
                                                    <span className={vencendo ? 'text-red-600 font-semibold' : 'text-slate-600'}>
                                                        {venc.toLocaleDateString('pt-BR')}
                                                        {vencendo && ' ⚠'}
                                                    </span>
                                                ) : <span className="text-slate-400">—</span>}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                <button onClick={() => { setDetalhe(m); setShowForm(false); }}
                                                    className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600 transition-colors"
                                                    title="Ver motorista">
                                                    <Icon name="Eye" size={14} color="currentColor" />
                                                </button>
                                                <button onClick={() => { handleAbrirEdicao(m); setDetalhe(null); setShowForm(false); }}
                                                    className="p-1.5 rounded-lg hover:bg-amber-50 text-slate-400 hover:text-amber-600 transition-colors"
                                                    title="Editar motorista">
                                                    <Icon name="Pencil" size={16} color="currentColor" />
                                                </button>
                                                <button
                                                    onClick={() => setConfirmDelete(m)}
                                                    className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"
                                                    title="Excluir motorista">
                                                    <Icon name="Trash2" size={16} color="currentColor" />
                                                </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
