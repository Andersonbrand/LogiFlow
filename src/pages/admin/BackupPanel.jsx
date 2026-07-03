import React, { useState, useMemo, useRef } from 'react';
import Icon from 'components/AppIcon';
import Button from 'components/ui/Button';
import { useToast } from 'utils/useToast';
import Toast from 'components/ui/Toast';
import {
    BACKUP_MODULES, BACKUP_BUCKETS, exportBackup, nomeArquivoBackup, baixarBlob,
    lerArquivoBackup, importarBackup,
} from 'utils/backupService';

// Buckets recebem uma chave prefixada dentro do mesmo Set de seleção,
// pra não colidir com nomes de tabela: "bucket:cnh-documents"
const chaveBucket = (id) => `bucket:${id}`;
const ehBucket = (chave) => chave.startsWith('bucket:');
const idDoBucket = (chave) => chave.slice('bucket:'.length);

const todasAsTabelas = BACKUP_MODULES.flatMap(m => m.tables.map(t => t.name));
const todosOsItensExport = [...todasAsTabelas, ...BACKUP_BUCKETS.map(b => chaveBucket(b.id))];

function separarSelecao(set) {
    const tables = [], buckets = [];
    for (const chave of set) {
        if (ehBucket(chave)) buckets.push(idDoBucket(chave));
        else tables.push(chave);
    }
    return { tables, buckets };
}

function nomeAmigavel(chave) {
    if (ehBucket(chave)) return BACKUP_BUCKETS.find(b => b.id === idDoBucket(chave))?.nice || chave;
    for (const m of BACKUP_MODULES) {
        const t = m.tables.find(t => t.name === chave);
        if (t) return t.nice;
    }
    return chave;
}

export default function BackupPanel() {
    const { toast, showToast } = useToast();

    // ── Estado — Exportação ────────────────────────────────────────────────
    const [selecaoExport, setSelecaoExport] = useState(() => new Set(todosOsItensExport));
    const [exportando, setExportando] = useState(false);
    const [logExport, setLogExport] = useState([]);
    const [puladasExport, setPuladasExport] = useState([]);

    // ── Estado — Importação ────────────────────────────────────────────────
    const [arquivo, setArquivo] = useState(null);
    const [backupLido, setBackupLido] = useState(null); // { manifest, getRows, getArquivosBucket, tabelasDisponiveis, bucketsDisponiveis }
    const [selecaoImport, setSelecaoImport] = useState(new Set());
    const [modoImport, setModoImport] = useState('mesclar'); // 'mesclar' | 'substituir'
    const [importando, setImportando] = useState(false);
    const [logImport, setLogImport] = useState([]);
    const [resultadoImport, setResultadoImport] = useState(null);
    const [confirmarSubstituir, setConfirmarSubstituir] = useState(false);
    const inputRef = useRef(null);

    const totalSelecionadoExport = selecaoExport.size;

    // ── Helpers de seleção (checkbox tree) ─────────────────────────────────
    const toggleItem = (set, setSet, chave) => {
        const novo = new Set(set);
        novo.has(chave) ? novo.delete(chave) : novo.add(chave);
        setSet(novo);
    };
    const chavesDoModulo = (modulo) => [...modulo.tables.map(t => t.name), ...(modulo.buckets || []).map(chaveBucket)];
    const toggleModulo = (set, setSet, modulo) => {
        const chaves = chavesDoModulo(modulo);
        const todasMarcadas = chaves.every(c => set.has(c));
        const novo = new Set(set);
        chaves.forEach(c => todasMarcadas ? novo.delete(c) : novo.add(c));
        setSet(novo);
    };
    const selecionarTudo = (setSet, universo) => setSet(new Set(universo));
    const limparSelecao = (setSet) => setSet(new Set());

    // ── Exportar ────────────────────────────────────────────────────────────
    const executarExport = async () => {
        if (totalSelecionadoExport === 0) { showToast('Selecione ao menos um item para exportar.', 'error'); return; }
        setExportando(true);
        setLogExport([]);
        setPuladasExport([]);
        try {
            const { tables, buckets } = separarSelecao(selecaoExport);
            const { blob, manifest, puladas } = await exportBackup({ tables, buckets }, (msg) => setLogExport(l => [...l.slice(-6), msg]));
            setPuladasExport(puladas);
            const totalLinhas = Object.values(manifest.tabelas).reduce((s, t) => s + t.linhas, 0);
            const totalArquivos = Object.values(manifest.buckets).reduce((s, b) => s + b.arquivos, 0);
            if (Object.keys(manifest.tabelas).length === 0 && Object.keys(manifest.buckets).length === 0) {
                showToast('Nada foi exportado — todos os itens selecionados falharam. Veja os avisos abaixo.', 'error');
                return;
            }
            baixarBlob(blob, nomeArquivoBackup());
            const aviso = puladas.length ? ` (${puladas.length} item(ns) pulado(s), veja os avisos abaixo)` : '';
            showToast(`Backup gerado: ${Object.keys(manifest.tabelas).length} tabelas (${totalLinhas} linhas) e ${totalArquivos} arquivo(s) anexado(s)${aviso}.`, 'success');
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
            setSelecaoImport(new Set([...lido.tabelasDisponiveis, ...lido.bucketsDisponiveis.map(chaveBucket)]));
        } catch (err) {
            showToast('Não foi possível ler o backup: ' + err.message, 'error');
            setArquivo(null);
        }
    };

    const executarImport = async () => {
        if (!backupLido || selecaoImport.size === 0) { showToast('Selecione ao menos um item para importar.', 'error'); return; }
        if (modoImport === 'substituir' && !confirmarSubstituir) {
            showToast('Confirme que entendeu que o modo "Substituir" apaga os dados atuais.', 'error');
            return;
        }
        setImportando(true);
        setLogImport([]);
        setResultadoImport(null);
        try {
            const { tables, buckets } = separarSelecao(selecaoImport);
            const resultado = await importarBackup(backupLido, { tables, buckets }, modoImport, (msg) => setLogImport(l => [...l.slice(-6), msg]));
            setResultadoImport(resultado);
            if (resultado.erros.length === 0) {
                showToast(`Importação concluída: ${resultado.ok.length} item(ns) restaurado(s).`, 'success');
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
                    <span className="ml-auto text-xs text-slate-400">{totalSelecionadoExport} de {todosOsItensExport.length} itens selecionados</span>
                </div>

                <div className="px-6 py-4 space-y-4">
                    <div className="flex gap-2">
                        <button onClick={() => selecionarTudo(setSelecaoExport, todosOsItensExport)} className="text-xs font-medium text-blue-600 hover:underline">Selecionar tudo</button>
                        <span className="text-slate-300">·</span>
                        <button onClick={() => limparSelecao(setSelecaoExport)} className="text-xs font-medium text-slate-500 hover:underline">Limpar seleção</button>
                    </div>

                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {BACKUP_MODULES.map(modulo => {
                            const chaves = chavesDoModulo(modulo);
                            const todasMarcadas = chaves.every(c => selecaoExport.has(c));
                            const algumaMarcada = chaves.some(c => selecaoExport.has(c));
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
                                                    onChange={() => toggleItem(selecaoExport, setSelecaoExport, t.name)}
                                                    className="rounded"
                                                />
                                                {t.nice}
                                            </label>
                                        ))}
                                        {(modulo.buckets || []).map(bucketId => {
                                            const b = BACKUP_BUCKETS.find(bb => bb.id === bucketId);
                                            const chave = chaveBucket(bucketId);
                                            return (
                                                <label key={chave} className="flex items-center gap-2 text-xs text-indigo-500 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={selecaoExport.has(chave)}
                                                        onChange={() => toggleItem(selecaoExport, setSelecaoExport, chave)}
                                                        className="rounded"
                                                    />
                                                    <Icon name="Paperclip" size={11} />
                                                    {b?.nice || bucketId}
                                                </label>
                                            );
                                        })}
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

                    {puladasExport.length > 0 && (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700 space-y-1">
                            <p className="font-semibold flex items-center gap-1"><Icon name="AlertTriangle" size={13} /> {puladasExport.length} item(ns) não incluído(s) no backup:</p>
                            {puladasExport.map((p, i) => <p key={i} className="pl-4">• <strong>{p.item}</strong> — {p.motivo}</p>)}
                        </div>
                    )}

                    <Button onClick={executarExport} disabled={exportando || totalSelecionadoExport === 0} iconName="Archive" iconSize={16}>
                        {exportando ? 'Gerando backup…' : 'Gerar backup (.zip)'}
                    </Button>
                    <p className="text-xs text-slate-400">O arquivo baixado é um .zip organizado por módulo: cada tabela vira um <code>.json</code> (usado na reimportação) e um <code>.xlsx</code> (para abrir direto no Excel), e os anexos (📎) ficam em <code>storage/</code>, tudo dentro da pasta do módulo correspondente.</p>
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
                                <span>Tabelas no arquivo: <strong>{backupLido.tabelasDisponiveis.length}</strong></span>
                                <span>Linhas totais: <strong>{Object.values(manifestData.tabelas).reduce((s, t) => s + t.linhas, 0)}</strong></span>
                                {backupLido.bucketsDisponiveis.length > 0 && (
                                    <span>Anexos: <strong>{Object.values(manifestData.buckets).reduce((s, b) => s + b.arquivos, 0)} arquivo(s)</strong></span>
                                )}
                            </div>

                            {manifestData.puladas?.length > 0 && (
                                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700 space-y-1">
                                    <p className="font-semibold flex items-center gap-1"><Icon name="AlertTriangle" size={13} /> Este backup foi gerado com {manifestData.puladas.length} item(ns) pulado(s) na origem:</p>
                                    {manifestData.puladas.map((p, i) => <p key={i} className="pl-4">• <strong>{p.item}</strong> — {p.motivo}</p>)}
                                </div>
                            )}

                            <div className="flex gap-2">
                                <button onClick={() => setSelecaoImport(new Set([...backupLido.tabelasDisponiveis, ...backupLido.bucketsDisponiveis.map(chaveBucket)]))} className="text-xs font-medium text-blue-600 hover:underline">Selecionar tudo</button>
                                <span className="text-slate-300">·</span>
                                <button onClick={() => setSelecaoImport(new Set())} className="text-xs font-medium text-slate-500 hover:underline">Limpar seleção</button>
                            </div>

                            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {BACKUP_MODULES.filter(m =>
                                    m.tables.some(t => backupLido.tabelasDisponiveis.includes(t.name)) ||
                                    (m.buckets || []).some(b => backupLido.bucketsDisponiveis.includes(b))
                                ).map(modulo => (
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
                                                        onChange={() => toggleItem(selecaoImport, setSelecaoImport, t.name)}
                                                        className="rounded"
                                                    />
                                                    {t.nice} <span className="text-slate-400">({manifestData.tabelas[t.name]?.linhas ?? 0})</span>
                                                </label>
                                            ))}
                                            {(modulo.buckets || []).filter(b => backupLido.bucketsDisponiveis.includes(b)).map(bucketId => {
                                                const b = BACKUP_BUCKETS.find(bb => bb.id === bucketId);
                                                const chave = chaveBucket(bucketId);
                                                return (
                                                    <label key={chave} className="flex items-center gap-2 text-xs text-indigo-500 cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={selecaoImport.has(chave)}
                                                            onChange={() => toggleItem(selecaoImport, setSelecaoImport, chave)}
                                                            className="rounded"
                                                        />
                                                        <Icon name="Paperclip" size={11} />
                                                        {b?.nice || bucketId} <span className="text-slate-400">({manifestData.buckets[bucketId]?.arquivos ?? 0})</span>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="border border-slate-200 rounded-lg p-3 space-y-2">
                                <p className="text-xs font-semibold text-slate-600">Modo de importação</p>
                                <label className="flex items-start gap-2 text-xs text-slate-600 cursor-pointer">
                                    <input type="radio" name="modo" checked={modoImport === 'mesclar'} onChange={() => setModoImport('mesclar')} className="mt-0.5" />
                                    <span><strong>Mesclar (recomendado)</strong> — atualiza os registros/arquivos existentes (mesmo ID/nome) e adiciona os novos. Não apaga nada.</span>
                                </label>
                                <label className="flex items-start gap-2 text-xs text-slate-600 cursor-pointer">
                                    <input type="radio" name="modo" checked={modoImport === 'substituir'} onChange={() => setModoImport('substituir')} className="mt-0.5" />
                                    <span><strong>Substituir</strong> — apaga todos os dados/arquivos atuais dos itens selecionados antes de importar. Use com cuidado.</span>
                                </label>
                                {modoImport === 'substituir' && (
                                    <label className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-2 py-1.5 mt-1 cursor-pointer">
                                        <input type="checkbox" checked={confirmarSubstituir} onChange={e => setConfirmarSubstituir(e.target.checked)} />
                                        Entendo que os dados atuais desses itens serão apagados permanentemente.
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
                                            <Icon name="CheckCircle2" size={13} /> {nomeAmigavel(r.table)}: {r.linhas} linhas/arquivos importados
                                        </p>
                                    ))}
                                    {resultadoImport.erros.map((r, i) => (
                                        <p key={i} className="text-xs text-red-600 flex items-center gap-1">
                                            <Icon name="XCircle" size={13} /> {nomeAmigavel(r.table)} ({r.etapa}): {r.erro}
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
