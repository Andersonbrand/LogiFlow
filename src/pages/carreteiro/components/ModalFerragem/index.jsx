import React from 'react';

import { AppIcon as Icon, PrettySelect, SearchableSelect, CidadesAdicionaisField, Button, Field, ModalHeader } from 'components';
import { updateRomaneio, createRomaneioFerragem } from 'services/carretas';

import { inputCls, inputStyle } from '../../utils/constants';

function ModalOverlay({ children, onClose }) {
    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 m-modal-overlay"
            style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)' }}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-y-auto m-modal-panel">
                {children}
            </div>
        </div>
    );
}

// ─── modalFerragem ───
export default function ModalFerragem({ cidadesFrete, editandoFerragemId, empresas, formFerragem, load, paradasFerragem, romsAbertos, salvandoFerragem, setEditandoFerragemId, setFormFerragem, setModalFerragem, setParadasFerragem, setRomaneiosFerragem, setSalvandoFerragem, showToast, user, veiculosProprios }) {
    return (
        <ModalOverlay onClose={() => { setModalFerragem(false); setEditandoFerragemId(null); }}>
                    <ModalHeader title={editandoFerragemId ? 'Editar Romaneio de Ferragens' : 'Novo Romaneio de Ferragens'} icon="FileText" onClose={() => { setModalFerragem(false); setEditandoFerragemId(null); }} />
                    <div className="p-5 space-y-4 overflow-y-auto">
                        <div className="flex items-center gap-2 p-3 rounded-xl border" style={{ backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }}>
                            <Icon name="Info" size={14} color="#065F46" />
                            <p className="text-xs" style={{ color: '#065F46' }}>Este romaneio ficará visível para conferência do administrador.</p>
                        </div>
                        {/* Vincular a ROM existente do admin */}
                        <Field label="Nº do Romaneio (opcional)">
                            <SearchableSelect
                                value={formFerragem.numero_romaneio}
                                allowCustom
                                placeholder="Deixar em branco (gera número automático)"
                                emptyLabel="Nenhum romaneio encontrado — digite o número para usar"
                                options={[...romsAbertos]
                                    .sort((x, y) => (parseInt(String(y.numero).replace(/\D/g, ''), 10) || 0) - (parseInt(String(x.numero).replace(/\D/g, ''), 10) || 0))
                                    .map(r => ({
                                        value: r.numero,
                                        label: `${r.numero} — ${r.destino || 'Sem destino'}`,
                                        sublabel: [r.empresa, r.numero_nf && `NF ${r.numero_nf}`, r.data_saida && new Date(r.data_saida + 'T00:00:00').toLocaleDateString('pt-BR'), r.status].filter(Boolean).join(' · '),
                                    }))}
                                onChange={num => {
                                    const rom = romsAbertos.find(r => r.numero === num);
                                    setFormFerragem(f => ({
                                        ...f,
                                        numero_romaneio: num,
                                        destino: rom?.destino || f.destino,
                                        empresa: rom?.empresa || f.empresa,
                                    }));
                                }}
                            />
                            <p className="text-xs mt-1" style={{ color: 'var(--color-muted-foreground)' }}>
                                Se o administrador já criou o romaneio, busque pelo número, destino, empresa ou NF e selecione para vincular. Caso contrário, será gerado automaticamente.
                            </p>
                        </Field>
                        <div className="grid grid-cols-2 gap-4">
                            <Field label="Nº da Nota Fiscal" required>
                                <input value={formFerragem.numero_nf} onChange={e => setFormFerragem(f => ({ ...f, numero_nf: e.target.value }))}
                                    className={inputCls} style={inputStyle} placeholder="Ex: 395240" />
                            </Field>
                            <Field label="Data de Saída" required>
                                <input type="date" value={formFerragem.data_saida} onChange={e => setFormFerragem(f => ({ ...f, data_saida: e.target.value }))}
                                    className={inputCls} style={inputStyle} />
                            </Field>
                        </div>
                        <Field label="Veículo / Placa" required>
                            <PrettySelect value={formFerragem.veiculo_id} onChange={e => setFormFerragem(f => ({ ...f, veiculo_id: e.target.value }))}
                                className={inputCls} style={inputStyle}>
                                <option value="">Selecione...</option>
                                {veiculosProprios.map(v => <option key={v.id} value={v.id}>{v.placa} — {v.modelo}</option>)}
                            </PrettySelect>
                        </Field>
                        <div className="grid grid-cols-2 gap-4">
                            <Field label="Destino" required>
                                <PrettySelect value={formFerragem.destino} onChange={e => setFormFerragem(f => ({ ...f, destino: e.target.value }))}
                                    className={inputCls} style={inputStyle}>
                                    <option value="">Cidade ou estoque</option>
                                    <option value="Estoque">Estoque</option>
                                    {cidadesFrete.map(c => <option key={c.id} value={c.cidade}>{c.cidade}</option>)}
                                </PrettySelect>
                            </Field>
                            <Field label="Peso (ton)">
                                <input type="number" step="0.001" value={formFerragem.toneladas} onChange={e => setFormFerragem(f => ({ ...f, toneladas: e.target.value }))}
                                    className={inputCls} style={inputStyle} placeholder="Ex: 5.920" />
                            </Field>
                        </div>
                        <CidadesAdicionaisField
                            cidades={[...new Set((cidadesFrete || []).map(c => c.cidade).filter(Boolean))]}
                            value={paradasFerragem}
                            onChange={setParadasFerragem}
                            label="Essa viagem passa por mais de uma cidade?"
                        />
                        <Field label="Empresa / Fornecedor">
                            <PrettySelect value={formFerragem.empresa} onChange={e => setFormFerragem(f => ({ ...f, empresa: e.target.value }))}
                                className={inputCls} style={inputStyle}>
                                <option value="">Selecione...</option>
                                {empresas.map(e => <option key={e.id} value={e.nome}>{e.nome}</option>)}
                            </PrettySelect>
                        </Field>
                        <Field label="Observações">
                            <textarea value={formFerragem.observacoes} onChange={e => setFormFerragem(f => ({ ...f, observacoes: e.target.value }))}
                                className={inputCls} style={{ ...inputStyle, resize: 'vertical' }} rows={2} placeholder="Informações adicionais..." />
                        </Field>
                    </div>
                    <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 p-5 border-t flex-shrink-0 sm:justify-end" style={{ borderColor: 'var(--color-border)' }}>
                        <button onClick={() => { setModalFerragem(false); setEditandoFerragemId(null); }} className="px-4 py-2.5 rounded-lg border text-sm font-medium hover:bg-gray-50 w-full sm:w-auto" style={{ borderColor: 'var(--color-border)' }}>Cancelar</button>
                        <Button disabled={salvandoFerragem} onClick={async () => {
                            if (!formFerragem.numero_nf?.trim() || !formFerragem.data_saida || !formFerragem.destino?.trim() || !formFerragem.veiculo_id) {
                                showToast('NF, data, veículo e destino são obrigatórios', 'error'); return;
                            }
                            setSalvandoFerragem(true);
                            try {
                                if (editandoFerragemId) {
                                    await updateRomaneio(editandoFerragemId, {
                                        numero_nf:   formFerragem.numero_nf,
                                        data_saida:  formFerragem.data_saida,
                                        veiculo_id:  formFerragem.veiculo_id,
                                        destino:     formFerragem.destino,
                                        toneladas:   formFerragem.toneladas ? Number(formFerragem.toneladas) : null,
                                        empresa:     formFerragem.empresa || null,
                                        observacoes: formFerragem.observacoes || null,
                                        paradas:     paradasFerragem.filter(p => p && p.trim()),
                                    });
                                    showToast('Romaneio atualizado!', 'success');
                                    setRomaneiosFerragem(prev => prev.map(r =>
                                        r.id === editandoFerragemId
                                            ? { ...r, ...formFerragem, toneladas: formFerragem.toneladas ? Number(formFerragem.toneladas) : null }
                                            : r
                                    ));
                                } else {
                                    await createRomaneioFerragem({
                                        numero_romaneio: formFerragem.numero_romaneio?.trim() || null,
                                        numero_nf:    formFerragem.numero_nf,
                                        data_saida:   formFerragem.data_saida,
                                        veiculo_id:   formFerragem.veiculo_id,
                                        destino:      formFerragem.destino,
                                        toneladas:    formFerragem.toneladas ? Number(formFerragem.toneladas) : null,
                                        empresa:      formFerragem.empresa || null,
                                        observacoes:  formFerragem.observacoes || null,
                                        motorista_id: user.id,
                                        paradas:      paradasFerragem.filter(p => p && p.trim()),
                                    });
                                    showToast('Romaneio de ferragens registrado!', 'success');
                                }
                                setEditandoFerragemId(null);
                                setModalFerragem(false);
                                load();
                            } catch (e) { showToast('Erro: ' + e.message, 'error'); }
                            finally { setSalvandoFerragem(false); }
                        }} size="sm" iconName="Check" className="w-full sm:w-auto">
                            {salvandoFerragem ? 'Salvando...' : editandoFerragemId ? 'Salvar' : 'Registrar'}
                        </Button>
                    </div>
                </ModalOverlay>
    );
}
