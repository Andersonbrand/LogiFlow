import React, { useState, useRef } from 'react';
import Icon from 'components/AppIcon';
import Button from 'components/ui/Button';
import { parseRomaneioModelFile } from 'utils/romaneioImportService';
import { fetchMaterials, createMaterial } from 'utils/materialService';
import { createRomaneio } from 'utils/romaneioService';

const STEP = { UPLOAD: 'upload', REVIEW: 'review', IMPORTING: 'importing', DONE: 'done' };

export default function RomaneioImportModal({ isOpen, onClose, onImported }) {
    const [step, setStep]           = useState(STEP.UPLOAD);
    const [blocks, setBlocks]       = useState([]);
    const [selected, setSelected]   = useState([]);
    const [progress, setProgress]   = useState({ done: 0, total: 0, log: [] });
    const [error, setError]         = useState('');
    const [fileName, setFileName]   = useState('');
    const [loading, setLoading]     = useState(false);
    const fileRef                   = useRef();

    if (!isOpen) return null;

    const reset = () => {
        setStep(STEP.UPLOAD);
        setBlocks([]);
        setSelected([]);
        setProgress({ done: 0, total: 0, log: [] });
        setError('');
        setFileName('');
        setLoading(false);
    };

    const handleFile = async (file) => {
        if (!file) return;
        setLoading(true);
        setError('');
        setFileName(file.name);
        try {
            const { blocks: parsed } = await parseRomaneioModelFile(file);
            setBlocks(parsed);
            setSelected(parsed.map((_, i) => i)); // select all by default
            setStep(STEP.REVIEW);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
    };

    const handleImport = async () => {
        const toImport = blocks.filter((_, i) => selected.includes(i));
        if (!toImport.length) return;

        setStep(STEP.IMPORTING);
        setProgress({ done: 0, total: toImport.length, log: [] });

        // Load existing materials catalog once
        let materials = [];
        try { materials = await fetchMaterials(); } catch (_) {}
        const matMap = {}; // nome.upper -> material
        materials.forEach(m => { matMap[m.nome.toUpperCase()] = m; });

        const log = [];
        let done = 0;

        for (const block of toImport) {
            try {
                // Resolve/create materials
                const itens = [];
                for (const item of block.itens) {
                    const key = item.nome.toUpperCase();
                    let mat = matMap[key];
                    if (!mat) {
                        // Create material automatically
                        try {
                            mat = await createMaterial({
                                nome:      item.nome,
                                categoria: 'Importado',
                                unidade:   item.unidade || 'UN',
                                peso:      item.pesoUnit || 0,
                            });
                            matMap[key] = mat;
                        } catch (_) {
                            // skip unresolvable items
                            continue;
                        }
                    }
                    itens.push({
                        material_id: mat.id,
                        quantidade:  item.quantidade,
                        peso_total:  item.pesoTotal || item.quantidade * (mat.peso || 0),
                    });
                }

                const pesoTotal = itens.reduce((a, i) => a + (i.peso_total || 0), 0);
                const romaneio = await createRomaneio({
                    motorista:   block.motorista || '',
                    placa:       block.placa     || '',
                    destino:     block.destino   || '',
                    status:      'Aguardando',
                    saida:       block.saida     || null,
                    observacoes: `Importado do modelo Excel`,
                    peso_total:  pesoTotal,
                }, itens);

                done++;
                log.push({ ok: true, msg: `${romaneio.numero} — ${block.destino || 'Sem destino'} (${itens.length} itens, ${pesoTotal.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} kg)` });
            } catch (err) {
                log.push({ ok: false, msg: `Erro em "${block.destino || block.motorista}": ${err.message}` });
            }
            setProgress({ done, total: toImport.length, log: [...log] });
        }

        setStep(STEP.DONE);
        if (done > 0) onImported?.();
    };

    const toggleBlock = (i) => setSelected(prev =>
        prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]
    );

    return (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-4" style={ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)' } onClick={step === STEP.IMPORTING ? undefined : e => { if (e.target === e.currentTarget) { reset(); onClose(); } }}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-green-100">
                            <Icon name="FileSpreadsheet" size={18} color="#059669" />
                        </div>
                        <div>
                            <h2 className="font-heading font-bold text-lg" style={{ color: 'var(--color-text-primary)' }}>
                                Importar Romaneio do Excel
                            </h2>
                            <p className="text-xs font-caption" style={{ color: 'var(--color-muted-foreground)' }}>
                                Modelo Comercial Araguaia — detecta blocos por cidade automaticamente
                            </p>
                        </div>
                    </div>
                    {step !== STEP.IMPORTING && (
                        <button onClick={() => { reset(); onClose(); }} className="p-2 rounded-lg hover:bg-gray-100">
                            <Icon name="X" size={18} color="var(--color-muted-foreground)" />
                        </button>
                    )}
                </div>

                {/* Body */}
                <div className="overflow-y-auto flex-1 px-6 py-5">

                    {/* UPLOAD */}
                    {step === STEP.UPLOAD && (
                        <div className="flex flex-col gap-4">
                            <div
                                onDrop={handleDrop}
                                onDragOver={e => e.preventDefault()}
                                onClick={() => fileRef.current?.click()}
                                className="border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors hover:bg-green-50 hover:border-green-400"
                                style={{ borderColor: 'var(--color-border)' }}>
                                <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv"
                                    className="hidden"
                                    onChange={e => handleFile(e.target.files[0])} />
                                {loading ? (
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="animate-spin h-8 w-8 rounded-full border-4 border-green-500 border-t-transparent" />
                                        <p className="text-sm font-caption" style={{ color: 'var(--color-muted-foreground)' }}>Lendo arquivo…</p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
                                            <Icon name="Upload" size={26} color="#059669" />
                                        </div>
                                        <div>
                                            <p className="font-medium" style={{ color: 'var(--color-text-primary)' }}>
                                                Arraste o arquivo ou clique para selecionar
                                            </p>
                                            <p className="text-sm mt-1 font-caption" style={{ color: 'var(--color-muted-foreground)' }}>
                                                Suporta .xlsx e .xls no formato modelo da Araguaia
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {error && (
                                <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
                                    <Icon name="AlertCircle" size={16} color="#DC2626" />
                                    <p className="text-sm text-red-700">{error}</p>
                                </div>
                            )}

                            {/* Instructions */}
                            <div className="rounded-xl border p-4" style={{ backgroundColor: 'var(--color-muted)', borderColor: 'var(--color-border)' }}>
                                <p className="text-xs font-semibold font-caption mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                                    COMO USAR
                                </p>
                                <ul className="space-y-1.5">
                                    {[
                                        'Preencha as quantidades na coluna C do modelo Excel',
                                        'Informe Motorista, Placa e Cidade em cada bloco',
                                        'Salve o arquivo e importe aqui',
                                        'O app cria um romaneio separado por cada cidade do arquivo',
                                        'Materiais novos são criados automaticamente no catálogo',
                                    ].map((t, i) => (
                                        <li key={i} className="flex items-start gap-2 text-xs font-caption" style={{ color: 'var(--color-muted-foreground)' }}>
                                            <span className="flex-shrink-0 w-4 h-4 rounded-full bg-green-200 text-green-700 flex items-center justify-center text-[10px] font-bold mt-0.5">{i + 1}</span>
                                            {t}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    )}

                    {/* REVIEW */}
                    {step === STEP.REVIEW && (
                        <div className="flex flex-col gap-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Icon name="FileCheck" size={16} color="#059669" />
                                    <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                                        {blocks.length} bloco(s) detectado(s) em <strong>{fileName}</strong>
                                    </span>
                                </div>
                                <button className="text-xs font-caption hover:underline" style={{ color: 'var(--color-primary)' }}
                                    onClick={() => setSelected(selected.length === blocks.length ? [] : blocks.map((_, i) => i))}>
                                    {selected.length === blocks.length ? 'Desmarcar todos' : 'Selecionar todos'}
                                </button>
                            </div>

                            <div className="space-y-3">
                                {blocks.map((block, i) => {
                                    const isSel = selected.includes(i);
                                    const pesoTotal = block.itens.reduce((a, it) => a + (it.pesoTotal || 0), 0);
                                    return (
                                        <div key={i}
                                            onClick={() => toggleBlock(i)}
                                            className={`rounded-xl border p-4 cursor-pointer transition-all ${isSel ? 'border-green-400 bg-green-50' : 'border-gray-200 bg-white opacity-60'}`}>
                                            <div className="flex items-start gap-3">
                                                <div className={`mt-0.5 w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${isSel ? 'bg-green-500' : 'border-2 border-gray-300'}`}>
                                                    {isSel && <Icon name="Check" size={12} color="#fff" />}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="font-medium text-sm" style={{ color: 'var(--color-text-primary)' }}>
                                                            {block.destino || `Bloco ${i + 1}`}
                                                        </span>
                                                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-caption">
                                                            {block.itens.length} itens
                                                        </span>
                                                        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-caption font-data">
                                                            {pesoTotal.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} kg
                                                        </span>
                                                    </div>
                                                    <div className="flex gap-4 mt-1.5 flex-wrap">
                                                        {block.motorista && (
                                                            <span className="text-xs font-caption flex items-center gap-1" style={{ color: 'var(--color-muted-foreground)' }}>
                                                                <Icon name="User" size={11} color="currentColor" />
                                                                {block.motorista}
                                                            </span>
                                                        )}
                                                        {block.placa && (
                                                            <span className="text-xs font-caption flex items-center gap-1 font-data" style={{ color: 'var(--color-muted-foreground)' }}>
                                                                <Icon name="Truck" size={11} color="currentColor" />
                                                                {block.placa}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {block.itens.length > 0 && (
                                                        <div className="mt-2 flex flex-wrap gap-1">
                                                            {block.itens.slice(0, 4).map((it, j) => (
                                                                <span key={j} className="text-[11px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-caption">
                                                                    {it.nome} × {it.quantidade}
                                                                </span>
                                                            ))}
                                                            {block.itens.length > 4 && (
                                                                <span className="text-[11px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-caption">
                                                                    +{block.itens.length - 4} mais
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* IMPORTING */}
                    {step === STEP.IMPORTING && (
                        <div className="flex flex-col gap-4">
                            <div className="flex items-center gap-3 p-4 rounded-xl bg-blue-50 border border-blue-200">
                                <div className="animate-spin h-5 w-5 rounded-full border-4 border-blue-500 border-t-transparent flex-shrink-0" />
                                <div>
                                    <p className="text-sm font-medium text-blue-800">
                                        Importando romaneios… {progress.done}/{progress.total}
                                    </p>
                                    <div className="mt-1.5 w-full bg-blue-200 rounded-full h-1.5">
                                        <div className="bg-blue-500 h-1.5 rounded-full transition-all"
                                            style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }} />
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                {progress.log.map((l, i) => (
                                    <div key={i} className={`flex items-start gap-2 text-xs font-caption p-2 rounded-lg ${l.ok ? 'text-green-700 bg-green-50' : 'text-red-600 bg-red-50'}`}>
                                        <Icon name={l.ok ? 'Check' : 'X'} size={12} color="currentColor" className="flex-shrink-0 mt-0.5" />
                                        {l.msg}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* DONE */}
                    {step === STEP.DONE && (
                        <div className="flex flex-col gap-4">
                            <div className="text-center py-4">
                                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
                                    <Icon name="CheckCircle2" size={36} color="#059669" />
                                </div>
                                <p className="font-heading font-bold text-lg" style={{ color: 'var(--color-text-primary)' }}>
                                    Importação concluída!
                                </p>
                                <p className="text-sm mt-1 font-caption" style={{ color: 'var(--color-muted-foreground)' }}>
                                    {progress.log.filter(l => l.ok).length} romaneio(s) criado(s) com sucesso
                                </p>
                            </div>
                            <div className="space-y-1.5 max-h-56 overflow-y-auto">
                                {progress.log.map((l, i) => (
                                    <div key={i} className={`flex items-start gap-2 text-xs font-caption p-2 rounded-lg ${l.ok ? 'text-green-700 bg-green-50' : 'text-red-600 bg-red-50'}`}>
                                        <Icon name={l.ok ? 'CheckCircle2' : 'AlertCircle'} size={13} color="currentColor" className="flex-shrink-0 mt-0.5" />
                                        {l.msg}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t flex justify-between items-center gap-2" style={{ borderColor: 'var(--color-border)' }}>
                    {step === STEP.UPLOAD && (
                        <>
                            <span className="text-xs font-caption" style={{ color: 'var(--color-muted-foreground)' }}>
                                Arquivo .xlsx no formato modelo
                            </span>
                            <Button variant="outline" onClick={() => { reset(); onClose(); }}>Cancelar</Button>
                        </>
                    )}
                    {step === STEP.REVIEW && (
                        <>
                            <Button variant="outline" iconName="ArrowLeft" iconSize={14} onClick={() => setStep(STEP.UPLOAD)}>
                                Voltar
                            </Button>
                            <Button variant="default" iconName="Download" iconSize={15}
                                disabled={selected.length === 0}
                                onClick={handleImport}>
                                Importar {selected.length} romaneio(s)
                            </Button>
                        </>
                    )}
                    {step === STEP.IMPORTING && (
                        <span className="text-xs font-caption mx-auto" style={{ color: 'var(--color-muted-foreground)' }}>
                            Não feche esta janela…
                        </span>
                    )}
                    {step === STEP.DONE && (
                        <>
                            <Button variant="outline" onClick={() => reset()}>Nova Importação</Button>
                            <Button variant="default" iconName="FileText" onClick={() => { reset(); onClose(); }}>
                                Ver Romaneios
                            </Button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
