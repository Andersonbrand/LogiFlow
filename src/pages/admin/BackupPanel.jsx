import React, { useState, useMemo, useRef } from 'react';
import Icon from 'components/AppIcon';
import Button from 'components/ui/Button';
import { useToast } from 'utils/useToast';
import Toast from 'components/ui/Toast';
import {
    BACKUP_MODULES, exportBackup, nomeArquivoBackup, baixarBlob,
    lerArquivoBackup, importarBackup,
} from 'utils/backupService';

const todasAsTabelas = BACKUP_MODULES.flatMap(m => m.tables.map(t => t.name));

export default function BackupPanel() {
    const { toast, showToast } = useToast();

    // ── Estado — Exportação ────────────────────────────────────────────────
    const [selecaoExport, setSelecaoExport] = useState(() => new Set(todasAsTabelas));
    const [exportando, setExportando] = useState(false);
    const [logExport, setLogExport] = useState([]);

    // ── Estado — Importação ────────────────────────────────────────────────
    const [arquivo, setArquivo] = useState(null);
    const [backupLido, setBackupLido] = useState(null); // { manifest, getRows, tabelasDisponiveis }
    const [selecaoImport, setSelecaoImport] = useState(new Set());
    const [modoImport, setModoImport] = useState('mesclar'); // 'mesclar' | 'substituir'
    const [importando, setImportando] = useState(false);
    const [logImport, setLogImport] = useState([]);
    const [resultadoImport, setResultadoImport] = useState(null);
    const [confirmarSubstituir, setConfirmarSubstituir] = useState(false);
    const inputRef = useRef(null);

    const totalSelecionadoExport = selecaoExport.size;

    // ── Helpers de seleção (checkbox tree) ─────────────────────────────────
    const toggleTabela = (set, setSet, nome) => {
        const novo = new Set(set);
        novo.has(nome) ? novo.delete(nome) : novo.add(nome);
        setSet(novo);
    };
    const toggleModulo = (set, setSet, modulo) => {
        const nomes = modulo.tables.map(t => t.name);
        const todasMarcadas = nomes.every(n => set.has(n));
        const novo = new Set(set);
        nomes.forEach(n => todasMarcadas ? novo.delete(n) : novo.add(n));
        setSet(novo);
    };
    const selecionarTudo = (setSet) => setSet(new Set(todasAsTabelas));
    const limparSelecao = (setSet) => setSet(new Set());

    // ── Exportar ────────────────────────────────────────────────────────────
    const executarExport = async () => {
        if (totalSelecionadoExport === 0) { showToast('Selecione ao menos uma tabela para exportar.', 'error'); return; }
        setExportando(true);
        setLogExport([]);
        try {
            const { blob, manifest } = await exportBackup([...selecaoExport], (msg) => setLogExport(l => [...l.slice(-6), msg]));
            baixarBlob(blob, nomeArquivoBackup());
            const totalLinhas = Object.values(manifest.tabelas).reduce((s, t) => s + t.linhas, 0);
            showToast(`Backup gerado com sucesso: ${Object.keys(manifest.tabelas).length} tabelas, ${totalLinhas} linhas.`, 'success');
        } catch (e) {
            showToast('Erro ao gerar backup: ' + e.message, 'error');
        } finally {
            setExportando(false);
        }
    };

    // ── Selecionar arquivo de importação ───────────────────────────────────
    const onSelecionarArquivo = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.name.toLowerCase().endsWith('.zip')) {
            showToast('Selecione um arquivo .zip gerado pelo backup do LogiFlow.', 'error');
            return;
        }
        setArquivo(file);
        setBackupLido(null);
        setResultadoImport(null);
        try {
            const lido = await lerArquivoBackup(file);
            setBackupLido(lido);
            setSelecaoImport(new Set(lido.tabelasDisponiveis));
        } catch (err) {
            showToast('Não foi possível ler o backup: ' + err.message, 'error');
            setArquivo(null);
        }
    };

    const executarImport = async () => {
        if (!backupLido || selecaoImport.size === 0) { showToast('Selecione ao menos uma tabela para importar.', 'error'); return; }
        if (modoImport === 'substituir' && !confirmarSubstituir) {
            showToast('Confirme que entendeu que o modo "Substituir" apaga os dados atuais.', 'error');
            return;
        }
        setImportando(true);
        setLogImport([]);
        setResultadoImport(null);
        try {
            const resultado = await importarBackup(backupLido, [...selecaoImport], modoImport, (msg) => setLogImport(l => [...l.slice(-6), msg]));
            setResultadoImport(resultado);
            if (resultado.erros.length === 0) {
                showToast(`Importação concluída: ${resultado.ok.length} tabelas restauradas.`, 'success');
            } else {
                showToast(`Importação concluída com ${resultado.erros.length} erro(s). Veja o resumo abaixo.`, 'error');
            }
        } catch (e) {
            showToast('Erro na importação: ' + e.message, 'error');
        } finally {
            setImportando(false);
        }
    };

    const manifestData = backupLido?.manifest;
    const geradoEm = useMemo(() => manifestData ? new Date(manifestData.gerado_em).toLocaleString('pt-BR') : null, [manifestData]);

    return (
        <div className="space-y-6">
            <Toast toast={toast} />

            {/* ═══ EXPORTAR ═══ */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2 flex-wrap">
                    <Icon name="Download" size={18} color="#1D4ED8" />
                    <h2 className="text-base font-semibold text-slate-800">Exportar backup</h2>
                    <span className="ml-auto text-xs text-slate-400">{totalSelecionadoExport} de {todasAsTabelas.length} tabelas selecionadas</span>
                </div>

                <div className="px-6 py-4 space-y-4">
                    <div className="flex gap-2">
                        <button onClick={() => selecionarTudo(setSelecaoExport)} className="text-xs font-medium text-blue-600 hover:underline">Selecionar tudo</button>
                        <span className="text-slate-300">·</span>
                        <button onClick={() => limparSelecao(setSelecaoExport)} className="text-xs font-medium text-slate-500 hover:underline">Limpar seleção</button>
                    </div>

                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {BACKUP_MODULES.map(modulo => {
                            const nomes = modulo.tables.map(t => t.name);
                            const todasMarcadas = nomes.every(n => selecaoExport.has(n));
                            const algumaMarcada = nomes.some(n => selecaoExport.has(n));
                            return (
                                <div key={modulo.id} className="border border-slate-200 rounded-lg p-3">
                                    <label className="flex items-center gap-2 font-medium text-sm text-slate-700 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={todasMarcadas}
                                            ref={el => { if (el) el.indeterminate = !todasMarcadas && algumaMarcada; }}
                                            onChange={() => toggleModulo(selecaoExport, setSelecaoExport, modulo)}
                                            className="rounded"
                                        />
                                        <Icon name={modulo.icon} size={14} color="#475569" />
                                        {modulo.label}
                                    </label>
                                    <div className="mt-2 pl-6 space-y-1">
                                        {modulo.tables.map(t => (
                                            <label key={t.name} className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={selecaoExport.has(t.name)}
                                                    onChange={() => toggleTabela(selecaoExport, setSelecaoExport, t.name)}
                                                    className="rounded"
                                                />
                                                {t.nice}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {logExport.length > 0 && (
                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs font-mono text-slate-500 space-y-0.5 max-h-32 overflow-y-auto">
                            {logExport.map((l, i) => <p key={i}>{l}</p>)}
                        </div>
                    )}

                    <Button onClick={executarExport} disabled={exportando || totalSelecionadoExport === 0} iconName="Archive" iconSize={16}>
                        {exportando ? 'Gerando backup…' : 'Gerar backup (.zip)'}
                    </Button>
                    <p className="text-xs text-slate-400">O arquivo baixado é um .zip organizado por módulo — cada tabela vira um arquivo .json dentro da pasta do módulo correspondente.</p>
                </div>
            </div>

            {/* ═══ IMPORTAR ═══ */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
                    <Icon name="Upload" size={18} color="#059669" />
                    <h2 className="text-base font-semibold text-slate-800">Importar backup</h2>
                </div>

                <div className="px-6 py-4 space-y-4">
                    <div>
                        <input ref={inputRef} type="file" accept=".zip" onChange={onSelecionarArquivo} className="hidden" />
                        <Button variant="outline" iconName="FileUp" iconSize={16} onClick={() => inputRef.current?.click()}>
                            {arquivo ? arquivo.name : 'Selecionar arquivo .zip'}
                        </Button>
                    </div>

                    {manifestData && (
                        <>
                            <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 text-xs text-blue-800 flex flex-wrap gap-x-6 gap-y-1">
                                <span>Gerado em: <strong>{geradoEm}</strong></span>
                                <span>Tabelas no arquivo: <strong>{Object.keys(manifestData.tabelas).length}</strong></span>
                                <span>Linhas totais: <strong>{Object.values(manifestData.tabelas).reduce((s, t) => s + t.linhas, 0)}</strong></span>
                            </div>

                            <div className="flex gap-2">
                                <button onClick={() => setSelecaoImport(new Set(backupLido.tabelasDisponiveis))} className="text-xs font-medium text-blue-600 hover:underline">Selecionar tudo</button>
                                <span className="text-slate-300">·</span>
                                <button onClick={() => setSelecaoImport(new Set())} className="text-xs font-medium text-slate-500 hover:underline">Limpar seleção</button>
                            </div>

                            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {BACKUP_MODULES.filter(m => m.tables.some(t => backupLido.tabelasDisponiveis.includes(t.name))).map(modulo => (
                                    <div key={modulo.id} className="border border-slate-200 rounded-lg p-3">
                                        <p className="flex items-center gap-2 font-medium text-sm text-slate-700 mb-2">
                                            <Icon name={modulo.icon} size={14} color="#475569" />
                                            {modulo.label}
                                        </p>
                                        <div className="pl-6 space-y-1">
                                            {modulo.tables.filter(t => backupLido.tabelasDisponiveis.includes(t.name)).map(t => (
                                                <label key={t.name} className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={selecaoImport.has(t.name)}
                                                        onChange={() => toggleTabela(selecaoImport, setSelecaoImport, t.name)}
                                                        className="rounded"
                                                    />
                                                    {t.nice} <span className="text-slate-400">({manifestData.tabelas[t.name]?.linhas ?? 0})</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="border border-slate-200 rounded-lg p-3 space-y-2">
                                <p className="text-xs font-semibold text-slate-600">Modo de importação</p>
                                <label className="flex items-start gap-2 text-xs text-slate-600 cursor-pointer">
                                    <input type="radio" name="modo" checked={modoImport === 'mesclar'} onChange={() => setModoImport('mesclar')} className="mt-0.5" />
                                    <span><strong>Mesclar (recomendado)</strong> — atualiza os registros existentes (mesmo ID) e adiciona os novos. Não apaga nada.</span>
                                </label>
                                <label className="flex items-start gap-2 text-xs text-slate-600 cursor-pointer">
                                    <input type="radio" name="modo" checked={modoImport === 'substituir'} onChange={() => setModoImport('substituir')} className="mt-0.5" />
                                    <span><strong>Substituir</strong> — apaga todos os dados atuais das tabelas selecionadas antes de importar. Use com cuidado.</span>
                                </label>
                                {modoImport === 'substituir' && (
                                    <label className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-2 py-1.5 mt-1 cursor-pointer">
                                        <input type="checkbox" checked={confirmarSubstituir} onChange={e => setConfirmarSubstituir(e.target.checked)} />
                                        Entendo que os dados atuais dessas tabelas serão apagados permanentemente.
                                    </label>
                                )}
                            </div>

                            {logImport.length > 0 && (
                                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs font-mono text-slate-500 space-y-0.5 max-h-32 overflow-y-auto">
                                    {logImport.map((l, i) => <p key={i}>{l}</p>)}
                                </div>
                            )}

                            {resultadoImport && (
                                <div className="space-y-1">
                                    {resultadoImport.ok.map(r => (
                                        <p key={r.table} className="text-xs text-emerald-600 flex items-center gap-1">
                                            <Icon name="CheckCircle2" size={13} /> {TABLE_NICE(r.table)}: {r.linhas} linhas importadas
                                        </p>
                                    ))}
                                    {resultadoImport.erros.map((r, i) => (
                                        <p key={i} className="text-xs text-red-600 flex items-center gap-1">
                                            <Icon name="XCircle" size={13} /> {TABLE_NICE(r.table)} ({r.etapa}): {r.erro}
                                        </p>
                                    ))}
                                </div>
                            )}

                            <Button
                                onClick={executarImport}
                                disabled={importando || selecaoImport.size === 0}
                                iconName="UploadCloud" iconSize={16}
                                variant={modoImport === 'substituir' ? 'danger' : 'default'}
                            >
                                {importando ? 'Importando…' : modoImport === 'substituir' ? 'Substituir dados selecionados' : 'Importar (mesclar)'}
                            </Button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

function TABLE_NICE(name) {
    for (const m of BACKUP_MODULES) {
        const t = m.tables.find(t => t.name === name);
        if (t) return t.nice;
    }
    return name;
}
