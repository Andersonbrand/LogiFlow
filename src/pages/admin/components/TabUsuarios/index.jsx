import React from 'react';

import { AppIcon as Icon, PrettySelect } from 'components';

import { ROLE_CONFIG } from '../../utils/constants';

// Determina a chave de exibicao do usuario (trata role legado 'carreteiro')
function getRoleKey(u) {
    if (!u) return 'operador';
    if (u.role === 'carreteiro') return 'motorista_carreta';
    if (u.role === 'motorista' && u.tipo_veiculo === 'carreta') return 'motorista_carreta';
    if (u.role === 'mecanico') return 'mecanico';
    return ROLE_CONFIG[u.role] ? u.role : 'operador';
}

// ─── tab === 'usuarios' ───
export default function TabUsuarios({ NOVO_USUARIO_VAZIO, handleAbrirEdicaoUsuario, handleRoleChange, setConfirmarExclusaoUsuario, setCriandoUsuario, setNovoUsuarioForm, users }) {
    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
                                <Icon name="Users" size={18} color="#1D4ED8" />
                                <h2 className="text-base font-semibold text-slate-800">Usuários do Sistema</h2>
                                <span className="text-xs text-slate-400">{users.length} usuários</span>
                                <button onClick={() => { setNovoUsuarioForm(NOVO_USUARIO_VAZIO); setCriandoUsuario(true); }}
                                    className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors">
                                    <Icon name="UserPlus" size={14} />Criar Usuário
                                </button>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-50">
                                        <tr>
                                            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Nome</th>
                                            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden sm:table-cell">Email</th>
                                            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Perfil</th>
                                            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Alterar</th>
                                            <th className="px-4 py-3"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {users.length === 0 ? (
                                            <tr><td colSpan={5} className="text-center py-8 text-slate-400">Nenhum usuário encontrado</td></tr>
                                        ) : users.map(u => (
                                            <tr key={u.id} className="hover:bg-slate-50">
                                                <td className="px-4 py-3">
                                                    <p className="font-medium text-slate-800 text-xs">{u.name || '—'}</p>
                                                    {u.email && <p className="text-slate-400 text-xs sm:hidden truncate max-w-[160px]">{u.email}</p>}
                                                </td>
                                                <td className="px-4 py-3 hidden sm:table-cell">
                                                    {u.email
                                                        ? <span className="text-slate-600 text-xs">{u.email}</span>
                                                        : <span className="inline-flex items-center gap-1 text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                                                            ⚠ Execute a migration SQL
                                                          </span>
                                                    }
                                                </td>
                                                <td className="px-4 py-3">
                                                    {(() => {
                                                        const key = getRoleKey(u);
                                                        const cfg = ROLE_CONFIG[key];
                                                        return cfg
                                                            ? <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ color: cfg.color, backgroundColor: cfg.bg }}>{cfg.label}</span>
                                                            : <span className="text-slate-400 text-xs">{u.role}</span>;
                                                    })()}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <PrettySelect
                                                        value={getRoleKey(u)}
                                                        onChange={e => handleRoleChange(u.id, e.target.value)}
                                                        className="text-xs border border-slate-200 rounded px-2 py-1 bg-white text-slate-700">
                                                        <option value="admin">Admin</option>
                                                        <option value="operador">Operador</option>
                                                        <option value="motorista">Motorista (Caminhão)</option>
                                                        <option value="motorista_carreta">Motorista (Carreta)</option>
                                                        <option value="mecanico">Mecânico</option>
                                                    </PrettySelect>
                                                </td>
                                                <td className="px-4 py-3 text-right whitespace-nowrap">
                                                    <button onClick={() => handleAbrirEdicaoUsuario(u)}
                                                        className="p-1.5 rounded-lg hover:bg-amber-50 text-slate-400 hover:text-amber-600 transition-colors"
                                                        title="Editar usuário">
                                                        <Icon name="Pencil" size={16} color="currentColor" />
                                                    </button>
                                                    <button onClick={() => setConfirmarExclusaoUsuario(u)}
                                                        className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"
                                                        title="Excluir usuário">
                                                        <Icon name="Trash2" size={16} color="currentColor" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
    );
}
