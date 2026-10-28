import React from 'react';

import { AppIcon as Icon, SearchableSelect, PrettySelect, DiagramaPneuVeiculo, PaginationBar, PeriodRangeFilter } from 'components';
import { CONFIGURACOES_OPTIONS } from 'config/pneuDiagramaConfig';

import { inputCls, inputStyle } from '../../utils/constants';
import RegistroPneuRow from '../RegistroPneuRow';
import ModalVerPneu from '../ModalVerPneu';

const BANDAGEM_OPTIONS = [
    { value: 'mista', label: 'Mista' },
    { value: 'borrachudo', label: 'Borrachudo' },
    { value: 'liso', label: 'Liso' },
];

// ─── pageTab === 'pneus' ───
export default function TabPneus({ ConfirmDialogPneu, catalogoPneus, editandoPneuId, formPneu, handleCancelarEdicaoPneu, handleEditarPneu, handleExcluirLote, handleExcluirPneu, handleSalvarPneu, loadingPneus, lotesExpandidos, meusPneusAgrupados, paginaPneus, periodoPreset, periodo, setPeriodo, setPeriodoPreset, motoristasPneu, posicoesOcupadas, savingPneu, setFormPneu, setVerPneu, toggleLote, veiculoOptionsPneu, verPneu }) {
    return (
        <>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {/* Formulário de registro */}
                            <div className="bg-white rounded-xl border p-4 sm:p-5 space-y-4" style={{ borderColor: 'var(--color-border)' }}>
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                        <Icon name={editandoPneuId ? 'Pencil' : 'CircleDot'} size={16} color="var(--color-primary)" />
                                        <h2 className="font-heading font-bold text-sm" style={{ color: 'var(--color-text-primary)' }}>
                                            {editandoPneuId ? 'Editar Registro de Pneu' : 'Registrar Troca de Pneu'}
                                        </h2>
                                    </div>
                                    {editandoPneuId && (
                                        <button onClick={handleCancelarEdicaoPneu} className="text-xs font-medium px-2 py-1 rounded-lg border hover:bg-gray-50"
                                            style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                                            Cancelar edição
                                        </button>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Placa do veículo <span className="text-red-500">*</span></label>
                                    <SearchableSelect
                                        value={formPneu.veiculo_id}
                                        onChange={v => setFormPneu(f => ({ ...f, veiculo_id: v }))}
                                        options={veiculoOptionsPneu}
                                        placeholder="Selecione a placa..." emptyLabel="Nenhum veículo encontrado" />
                                </div>

                                <div>
                                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Motorista que realizou/solicitou a troca</label>
                                    <SearchableSelect
                                        value={formPneu.motorista_id}
                                        onChange={v => setFormPneu(f => ({ ...f, motorista_id: v }))}
                                        options={motoristasPneu.map(m => ({ value: m.id, label: m.name }))}
                                        placeholder="Selecione (opcional)..." emptyLabel="Nenhum motorista encontrado" />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Km atual do veículo <span className="text-red-500">*</span></label>
                                        <input type="number" inputMode="decimal" min="0" value={formPneu.km_atual}
                                            onChange={e => setFormPneu(f => ({ ...f, km_atual: e.target.value }))}
                                            className={inputCls} style={inputStyle} placeholder="Ex: 245000" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Tipo do pneu usado <span className="text-red-500">*</span></label>
                                        <div className="flex gap-1.5">
                                            {[{ v: 'novo', l: 'Novo', c: '#059669' }, { v: 'recapado', l: 'Recapado', c: '#B45309' }].map(op => (
                                                <button key={op.v} type="button" onClick={() => setFormPneu(f => ({ ...f, tipo_pneu: op.v }))}
                                                    className="flex-1 px-2 py-2 rounded-lg border text-xs font-semibold transition-colors"
                                                    style={formPneu.tipo_pneu === op.v
                                                        ? { backgroundColor: `${op.c}1A`, borderColor: op.c, color: op.c }
                                                        : { borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                                                    {op.l}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div>
                                        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Marca <span className="text-red-500">*</span></label>
                                        <PrettySelect value={formPneu.marca} onChange={e => setFormPneu(f => ({ ...f, marca: e.target.value }))} className={inputCls} style={inputStyle}>
                                            <option value="">Selecione...</option>
                                            {catalogoPneus.marca.map(m => <option key={m} value={m}>{m}</option>)}
                                        </PrettySelect>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Medida <span className="text-red-500">*</span></label>
                                        <PrettySelect value={formPneu.medida} onChange={e => setFormPneu(f => ({ ...f, medida: e.target.value }))} className={inputCls} style={inputStyle}>
                                            <option value="">Selecione...</option>
                                            {catalogoPneus.medida.map(m => <option key={m} value={m}>{m}</option>)}
                                        </PrettySelect>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Bandagem</label>
                                        <PrettySelect value={formPneu.categoria_bandagem} onChange={e => setFormPneu(f => ({ ...f, categoria_bandagem: e.target.value }))} className={inputCls} style={inputStyle}>
                                            {BANDAGEM_OPTIONS.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
                                        </PrettySelect>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Configuração do veículo (nº de eixos) <span className="text-red-500">*</span></label>
                                    <PrettySelect value={formPneu.configuracao_veiculo}
                                        onChange={e => setFormPneu(f => ({ ...f, configuracao_veiculo: e.target.value, posicoes_diagrama: [] }))}
                                        className={inputCls} style={inputStyle}>
                                        <option value="">Selecione...</option>
                                        {CONFIGURACOES_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                                    </PrettySelect>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                                        Posição(ões) do pneu trocado <span className="text-red-500">*</span>
                                        {!editandoPneuId && (
                                            <span className="ml-1 font-normal" style={{ color: 'var(--color-muted-foreground)' }}>
                                                — marque quantas trocou de uma vez
                                            </span>
                                        )}
                                    </label>
                                    <DiagramaPneuVeiculo
                                        configuracao={formPneu.configuracao_veiculo}
                                        value={formPneu.posicoes_diagrama}
                                        onChange={ids => setFormPneu(f => ({ ...f, posicoes_diagrama: ids }))}
                                        ocupadas={posicoesOcupadas}
                                        multi={!editandoPneuId}
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Observações</label>
                                    <textarea value={formPneu.observacoes} onChange={e => setFormPneu(f => ({ ...f, observacoes: e.target.value }))}
                                        className={inputCls} style={inputStyle} rows={2} placeholder="Detalhes adicionais (opcional)" />
                                </div>

                                <button onClick={handleSalvarPneu} disabled={savingPneu}
                                    className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
                                    style={{ backgroundColor: editandoPneuId ? '#1D4ED8' : '#059669' }}>
                                    <Icon name="Check" size={15} color="#fff" />
                                    {savingPneu
                                        ? 'Salvando...'
                                        : editandoPneuId
                                            ? 'Salvar Alterações'
                                            : formPneu.posicoes_diagrama.length > 1
                                                ? `Registrar ${formPneu.posicoes_diagrama.length} Trocas de Pneu`
                                                : 'Registrar Troca de Pneu'}
                                </button>
                            </div>

                            {/* Últimos registros feitos por este mecânico */}
                            <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
                                <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--color-border)' }}>
                                    <h2 className="font-heading font-bold text-sm" style={{ color: 'var(--color-text-primary)' }}>Meus Últimos Registros</h2>
                                    {loadingPneus && <Icon name="RefreshCw" size={13} color="var(--color-muted-foreground)" className="animate-spin" />}
                                </div>
                                <div className="px-4 py-2.5 border-b" style={{ borderColor: 'var(--color-border)' }}>
                                    <PeriodRangeFilter preset={periodoPreset} onPresetChange={setPeriodoPreset}
                                        periodo={periodo} onPeriodoChange={setPeriodo}
                                        presets={['mes', 'mes_passado', 'todos', 'personalizado']} />
                                </div>
                                {meusPneusAgrupados.length === 0 ? (
                                    <div className="py-10 flex flex-col items-center justify-center gap-2 text-slate-400">
                                        <Icon name="CircleDot" size={28} color="#CBD5E1" />
                                        <p className="text-xs">{periodoPreset === 'todos' ? 'Nenhum pneu registrado ainda' : 'Nenhum pneu registrado neste período'}</p>
                                    </div>
                                ) : (
                                    <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
                                        {paginaPneus.pageItems.map(item => item.grupo ? (
                                            <div key={item.lote_id}>
                                                <div className="w-full px-4 py-3 flex items-start gap-3 hover:bg-slate-50">
                                                    <button type="button" onClick={() => toggleLote(item.lote_id)} className="flex items-start gap-3 flex-1 min-w-0 text-left">
                                                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#DBEAFE' }}>
                                                            <Icon name="Layers" size={14} color="#1D4ED8" />
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-xs font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                                                                {item.itens.length} pneus trocados · {item.itens[0].veiculo?.placa || item.itens[0].veiculo_caminhao_placa || 'Sem placa'}
                                                            </p>
                                                            <p className="text-xs truncate" style={{ color: 'var(--color-muted-foreground)' }}>
                                                                {item.itens[0].marca} {item.itens[0].medida} · {new Date(item.itens[0].data_instalacao + 'T00:00:00').toLocaleDateString('pt-BR')}
                                                            </p>
                                                        </div>
                                                    </button>
                                                    <div className="flex items-center gap-1 flex-shrink-0">
                                                        <button onClick={() => handleExcluirLote(item)} title="Excluir lote inteiro"
                                                            className="w-6 h-6 rounded-md flex items-center justify-center hover:bg-red-50">
                                                            <Icon name="Trash2" size={13} color="#DC2626" />
                                                        </button>
                                                        <button onClick={() => toggleLote(item.lote_id)} className="w-6 h-6 rounded-md flex items-center justify-center">
                                                            <Icon name={lotesExpandidos[item.lote_id] ? 'ChevronUp' : 'ChevronDown'} size={16} color="var(--color-muted-foreground)" />
                                                        </button>
                                                    </div>
                                                </div>
                                                {lotesExpandidos[item.lote_id] && (
                                                    <div className="divide-y bg-slate-50/60" style={{ borderColor: 'var(--color-border)' }}>
                                                        {item.itens.map(p => (
                                                            <RegistroPneuRow key={p.id} p={p} editando={editandoPneuId === p.id}
                                                                onVer={setVerPneu} onEditar={handleEditarPneu} onExcluir={handleExcluirPneu} indent />
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <RegistroPneuRow key={item.pneu.id} p={item.pneu} editando={editandoPneuId === item.pneu.id}
                                                onVer={setVerPneu} onEditar={handleEditarPneu} onExcluir={handleExcluirPneu} />
                                        ))}
                                    </div>
                                )}
                                <PaginationBar {...paginaPneus} itemLabel="registro" />
                            </div>
                        </div>
                        {verPneu && <ModalVerPneu p={verPneu} onClose={() => setVerPneu(null)} />}
                        {ConfirmDialogPneu}
                        </>
    );
}
