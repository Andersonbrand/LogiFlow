import React from 'react';

import { AppIcon as Icon, Button } from 'components';
import paths from 'constants/paths';

import { COR_CORREDOR } from '../../utils/constants';

// ─── abaAtiva === 'corredores' ───
export default function TabCorredores({ corredoresLista, expandidos, isAdmin, loading, navigate, setExpandidos }) {
    return (
        <div className="flex flex-col gap-5">
                            <div className="flex items-center justify-between flex-wrap gap-3">
                                <div>
                                    <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                                        <Icon name="Map" size={17} color="var(--color-primary)" />
                                        Corredores de Rota Cadastrados
                                    </h2>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        Base: <strong>Guanambi, BA</strong> — cidades agrupadas por direção de rota
                                    </p>
                                </div>
                                {isAdmin() && (
                                    <Button variant="default" iconName="Pencil" iconSize={14}
                                        onClick={() => navigate(paths.Admin)}>
                                        Editar no Painel Admin
                                    </Button>
                                )}
                            </div>

                            {loading ? (
                                <div className="flex justify-center py-12">
                                    <div className="animate-spin h-7 w-7 rounded-full border-4 border-slate-200" style={{ borderTopColor: 'var(--color-primary)' }} />
                                </div>
                            ) : corredoresLista.length === 0 ? (
                                <div className="text-center py-12 text-slate-400">
                                    <Icon name="MapPin" size={36} color="#CBD5E1" />
                                    <p className="mt-2 text-sm">Nenhum corredor cadastrado</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {corredoresLista.map(corredor => {
                                        const cor = COR_CORREDOR[corredor.nome] || { bg: '#F8FAFC', border: '#CBD5E1', text: '#475569', icon: 'MapPin' };
                                        const isExp = expandidos[corredor.nome];
                                        const cidades = corredor.cidades || [];
                                        return (
                                            <div key={corredor.nome}
                                                className="bg-white rounded-xl border shadow-sm overflow-hidden"
                                                style={{ borderColor: 'var(--color-border)' }}>
                                                <div className="flex items-center gap-3 px-4 py-3 border-b"
                                                    style={{ backgroundColor: cor.bg, borderColor: cor.border }}>
                                                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                                                        style={{ backgroundColor: cor.border }}>
                                                        <Icon name={corredor.icone || cor.icon} size={15} color={cor.text} />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-semibold" style={{ color: cor.text }}>{corredor.label}</p>
                                                    </div>
                                                    <span className="text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0"
                                                        style={{ backgroundColor: cor.border, color: cor.text }}>
                                                        {cidades.length} {cidades.length === 1 ? 'cidade' : 'cidades'}
                                                    </span>
                                                </div>
                                                <div className="px-4 py-3">
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {(isExp ? cidades : cidades.slice(0, 12)).map((cidade, i) => (
                                                            <span key={i}
                                                                className="inline-block px-2 py-0.5 rounded-full text-xs border capitalize"
                                                                style={{ backgroundColor: cor.bg, borderColor: cor.border, color: cor.text }}>
                                                                {cidade}
                                                            </span>
                                                        ))}
                                                        {cidades.length === 0 && (
                                                            <span className="text-xs text-slate-400 italic">Sem cidades cadastradas</span>
                                                        )}
                                                    </div>
                                                    {cidades.length > 12 && (
                                                        <button
                                                            onClick={() => setExpandidos(p => ({ ...p, [corredor.nome]: !p[corredor.nome] }))}
                                                            className="mt-2 text-xs font-medium flex items-center gap-1 transition-colors hover:opacity-70"
                                                            style={{ color: cor.text }}>
                                                            <Icon name={isExp ? 'ChevronUp' : 'ChevronDown'} size={13} color="currentColor" />
                                                            {isExp ? 'Mostrar menos' : `Ver todas as ${cidades.length} cidades`}
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {!isAdmin() && (
                                <p className="text-xs text-center mt-2" style={{ color: 'var(--color-muted-foreground)' }}>
                                    Para solicitar alterações nos corredores, entre em contato com o administrador do sistema.
                                </p>
                            )}
                        </div>
    );
}
