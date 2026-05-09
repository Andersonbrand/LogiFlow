import React, { useState, useEffect, useCallback } from 'react';
import Icon from 'components/AppIcon';
import Button from 'components/ui/Button';
import Toast from 'components/ui/Toast';
import { useToast } from 'utils/useToast';
import { useConfirm } from 'components/ui/ConfirmDialog';
import { supabase } from 'utils/supabaseClient';

// ─── Dados iniciais — Frota Própria (Tabela_Frete.pdf — coluna "Frete por saco") ──
const FROTA_INICIAL = [
    { cidade: 'Urandi',                             km: 616,  frete_por_saco: 5.62 },
    { cidade: 'Pindai',                             km: 680,  frete_por_saco: 6.10 },
    { cidade: 'Pilões',                             km: 712,  frete_por_saco: 6.34 },
    { cidade: 'Candiba',                            km: 736,  frete_por_saco: 6.52 },
    { cidade: 'Mutans',                             km: 804,  frete_por_saco: 7.02 },
    { cidade: 'Morrinhos',                          km: 806,  frete_por_saco: 7.04 },
    { cidade: 'Matina',                             km: 834,  frete_por_saco: 7.25 },
    { cidade: 'Caetité',                            km: 826,  frete_por_saco: 7.19 },
    { cidade: 'Tanque Novo',                        km: 964,  frete_por_saco: 8.22 },
    { cidade: 'Igaporã',                            km: 904,  frete_por_saco: 7.77 },
    { cidade: 'Riacho de Santana (Por Matina)',     km: 912,  frete_por_saco: 7.83 },
    { cidade: 'Palmas de M. Alto',                  km: 834,  frete_por_saco: 7.25 },
    { cidade: 'Sebastião Laranjeiras',              km: 944,  frete_por_saco: 8.07 },
    { cidade: 'Julião',                             km: 940,  frete_por_saco: 8.04 },
    { cidade: 'Iuiú',                               km: 948,  frete_por_saco: 8.10 },
    { cidade: 'Malhada',                            km: 966,  frete_por_saco: 8.24 },
    { cidade: 'Carinhanha',                         km: 972,  frete_por_saco: 8.28 },
    { cidade: 'Agrovila 14,15,16, Marrequeiro',    km: 1120, frete_por_saco: 9.39 },
    { cidade: 'Agrovila 2, 4, 6, 8, 10, 11',       km: 1180, frete_por_saco: 9.84 },
    { cidade: 'Serra do Ramalho',                   km: 1186, frete_por_saco: 9.89 },
    { cidade: 'Cocôs (Por Feira da Mata)',          km: 1160, frete_por_saco: 10.11 },
    { cidade: 'Feira da Mata',                      km: 1050, frete_por_saco: 9.24 },
    { cidade: 'Malhada de Pedra',                   km: 1014, frete_por_saco: 8.28 },
    { cidade: 'Guajeru',                            km: 1062, frete_por_saco: 8.96 },
    { cidade: 'Rio do Antonio',                     km: 990,  frete_por_saco: 8.42 },
    { cidade: 'Brumado',                            km: 1030, frete_por_saco: 8.72 },
    { cidade: 'Aracatu',                            km: 1096, frete_por_saco: 9.47 },
    { cidade: 'Dom Basilio',                        km: 1136, frete_por_saco: 9.15 },
    { cidade: 'Livramento',                         km: 1162, frete_por_saco: 9.71 },
    { cidade: 'Rio de Contas',                      km: 1186, frete_por_saco: 9.89 },
    { cidade: 'Arapiranga, Rio de Contas',          km: 1230, frete_por_saco: 10.22 },
    { cidade: 'Marcolino Moura, Rio de Contas',     km: 1224, frete_por_saco: 10.25 },
    { cidade: 'Jussiape',                           km: 1270, frete_por_saco: 10.52 },
    { cidade: 'Caraguataí, Jussiape',               km: 1294, frete_por_saco: 10.70 },
    { cidade: 'Botuporã',                           km: 1004, frete_por_saco: 8.52 },
    { cidade: 'Caturama',                           km: 1064, frete_por_saco: 8.97 },
    { cidade: 'Paramirim',                          km: 1088, frete_por_saco: 9.15 },
    { cidade: 'Caraibas de Paramirim',              km: 1134, frete_por_saco: 9.50 },
    { cidade: 'Erico Cardoso',                      km: 1122, frete_por_saco: 9.41 },
    { cidade: 'Rio do Pires',                       km: 1128, frete_por_saco: 9.45 },
    { cidade: 'Ibipitanga',                         km: 1202, frete_por_saco: 10.01 },
    { cidade: 'Macaubas',                           km: 1166, frete_por_saco: 9.74 },
    { cidade: 'Boquira',                            km: 1212, frete_por_saco: 10.08 },
    { cidade: 'Lagoa Real',                         km: 942,  frete_por_saco: 8.06 },
    { cidade: 'Ibitira',                            km: 922,  frete_por_saco: 7.91 },
    { cidade: 'Ibiassucê',                          km: 918,  frete_por_saco: 7.88 },
    { cidade: 'Caculé',                             km: 970,  frete_por_saco: 8.27 },
    { cidade: 'Bom Jesus da Lapa (Por Matina)',     km: 1046, frete_por_saco: 8.84 },
    { cidade: 'Sitio do Mato',                      km: 1184, frete_por_saco: 9.87 },
    { cidade: 'Paratinga',                          km: 1232, frete_por_saco: 10.23 },
    { cidade: 'Santa Maria da Vitória',             km: 1274, frete_por_saco: 10.55 },
    { cidade: 'Oliveira dos Brejinhos',             km: 1324, frete_por_saco: 10.92 },
    { cidade: 'Novo Horizonte',                     km: 1572, frete_por_saco: 12.78 },
    { cidade: 'Boninal',                            km: 1630, frete_por_saco: 13.21 },
    { cidade: 'Seabra',                             km: 1594, frete_por_saco: 12.94 },
    { cidade: 'Ibitiara',                           km: 1320, frete_por_saco: 10.89 },
    { cidade: 'Ibotirama',                          km: 1362, frete_por_saco: 11.21 },
    { cidade: 'Morpará',                            km: 1538, frete_por_saco: 12.53 },
    { cidade: 'Coribe',                             km: 1402, frete_por_saco: 11.51 },
    { cidade: 'Vila Mariana',                       km: 1132, frete_por_saco: 9.48 },
    { cidade: 'Presidente Jânio Quadros',           km: 1168, frete_por_saco: 9.75 },
    { cidade: 'Maetinga',                           km: 1214, frete_por_saco: 10.10 },
    { cidade: 'Condeúba',                           km: 1100, frete_por_saco: 9.24 },
    { cidade: 'Sussuarana',                         km: 1130, frete_por_saco: 9.47 },
    { cidade: 'Tanhaçu',                            km: 1168, frete_por_saco: 9.75 },
    { cidade: 'Ituaçu',                             km: 1220, frete_por_saco: 10.14 },
    { cidade: 'Barra da Estiva',                    km: 1268, frete_por_saco: 10.50 },
    { cidade: 'Barreiras',                          km: 1808, frete_por_saco: 14.55 },
    { cidade: 'Tauape (entrada de Urandi)',          km: 698,  frete_por_saco: 6.28 },
    { cidade: 'Licinio de Almeida (entr. Urandi)',  km: 670,  frete_por_saco: 6.10 },
    { cidade: 'Jacaraci (entrada de Urandi)',        km: 694,  frete_por_saco: 6.26 },
    { cidade: 'Mortugaba (entrada de Urandi)',       km: 742,  frete_por_saco: 6.58 },
];

// ─── Dados iniciais — Terceiros (FRETE_TERCEIROS_2026.pdf — coluna "Frete por Saco") ─
const TERCEIROS_INICIAL = [
    { cidade: 'Urandi',                             km: 616,  frete_por_saco: 5.18 },
    { cidade: 'Pindai',                             km: 680,  frete_por_saco: 5.65 },
    { cidade: 'Pilões',                             km: 712,  frete_por_saco: 5.88 },
    { cidade: 'Candiba',                            km: 736,  frete_por_saco: 6.06 },
    { cidade: 'Guanambi',                           km: 748,  frete_por_saco: 6.14 },
    { cidade: 'Mutans',                             km: 804,  frete_por_saco: 6.55 },
    { cidade: 'Morrinhos',                          km: 806,  frete_por_saco: 6.57 },
    { cidade: 'Matina',                             km: 834,  frete_por_saco: 6.77 },
    { cidade: 'Caetité',                            km: 826,  frete_por_saco: 6.71 },
    { cidade: 'Tanque Novo',                        km: 964,  frete_por_saco: 7.72 },
    { cidade: 'Igaporã',                            km: 904,  frete_por_saco: 7.28 },
    { cidade: 'Riacho de Santana (Por Matina)',     km: 912,  frete_por_saco: 7.34 },
    { cidade: 'Palmas de M. Alto',                  km: 834,  frete_por_saco: 6.77 },
    { cidade: 'Sebastião Laranjeiras',              km: 944,  frete_por_saco: 7.57 },
    { cidade: 'Julião',                             km: 940,  frete_por_saco: 7.54 },
    { cidade: 'Iuiú',                               km: 948,  frete_por_saco: 7.60 },
    { cidade: 'Malhada',                            km: 966,  frete_por_saco: 7.73 },
    { cidade: 'Carinhanha',                         km: 972,  frete_por_saco: 7.77 },
    { cidade: 'Serra do Ramalho',                   km: 1186, frete_por_saco: 9.33 },
    { cidade: 'Cocôs (por Feira da Mata)',           km: 1160, frete_por_saco: 9.55 },
    { cidade: 'Feira da Mata',                      km: null, frete_por_saco: 8.70 },
    { cidade: 'Malhada de Pedra',                   km: 1014, frete_por_saco: 7.77 },
    { cidade: 'Guajeru',                            km: 1062, frete_por_saco: 8.43 },
    { cidade: 'Rio do Antonio',                     km: 990,  frete_por_saco: 7.90 },
    { cidade: 'Brumado',                            km: 1030, frete_por_saco: 8.20 },
    { cidade: 'Aracatu',                            km: 1096, frete_por_saco: 8.92 },
    { cidade: 'Dom Basilio',                        km: 1136, frete_por_saco: 8.62 },
    { cidade: 'Livramento',                         km: 1162, frete_por_saco: 9.16 },
    { cidade: 'Rio de Contas',                      km: 1186, frete_por_saco: 9.33 },
    { cidade: 'Arapiranga, Rio de Contas',          km: 1230, frete_por_saco: 9.65 },
    { cidade: 'Marcolino Moura, Rio de Contas',     km: 1224, frete_por_saco: 9.68 },
    { cidade: 'Jussiape',                           km: 1270, frete_por_saco: 9.94 },
    { cidade: 'Caraguataí, Jussiape',               km: 1294, frete_por_saco: 10.12 },
    { cidade: 'Botuporã',                           km: 1004, frete_por_saco: 8.01 },
    { cidade: 'Caturama',                           km: 1064, frete_por_saco: 8.44 },
    { cidade: 'Paramirim',                          km: 1088, frete_por_saco: 8.62 },
    { cidade: 'Caraibas de Paramirim',              km: 1134, frete_por_saco: 8.95 },
    { cidade: 'Erico Cardoso',                      km: 1122, frete_por_saco: 8.87 },
    { cidade: 'Rio do Pires',                       km: 1128, frete_por_saco: 8.91 },
    { cidade: 'Ibipitanga',                         km: 1202, frete_por_saco: 9.45 },
    { cidade: 'Macaubas',                           km: 1166, frete_por_saco: 9.19 },
    { cidade: 'Boquira',                            km: 1212, frete_por_saco: 9.52 },
    { cidade: 'Lagoa Real',                         km: 942,  frete_por_saco: 7.56 },
    { cidade: 'Ibitira',                            km: 922,  frete_por_saco: 7.41 },
    { cidade: 'Ibiassucê',                          km: 918,  frete_por_saco: 7.38 },
    { cidade: 'Caculé',                             km: 970,  frete_por_saco: 7.76 },
    { cidade: 'Bom Jesus da Lapa (Por Matina)',     km: 1046, frete_por_saco: 8.31 },
    { cidade: 'Sitio do Mato',                      km: 1184, frete_por_saco: 9.32 },
    { cidade: 'Paratinga',                          km: 1232, frete_por_saco: 9.67 },
    { cidade: 'Santa Maria da Vitória',             km: 1274, frete_por_saco: 9.97 },
    { cidade: 'Ibotirama',                          km: 1362, frete_por_saco: 10.61 },
    { cidade: 'Presidente Jânio Quadros',           km: 1168, frete_por_saco: 9.20 },
    { cidade: 'Maetinga',                           km: 1214, frete_por_saco: 9.53 },
    { cidade: 'Condeúba',                           km: 1100, frete_por_saco: 8.71 },
    { cidade: 'Sussuarana',                         km: 1130, frete_por_saco: 8.92 },
    { cidade: 'Tanhaçu',                            km: 1168, frete_por_saco: 9.20 },
    { cidade: 'Ituaçu',                             km: 1220, frete_por_saco: 9.58 },
    { cidade: 'Barra da Estiva',                    km: 1268, frete_por_saco: 9.93 },
    { cidade: 'Barreiras',                          km: 1808, frete_por_saco: 13.86 },
];

const BRL = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const inputCls = 'w-full px-3 py-1.5 rounded-lg border text-sm outline-none transition-all focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500';
const inputStyle = { borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' };

// ─── Hook para buscar/salvar fretes no Supabase ───────────────────────────────
function useFretes(tipo) {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const table = 'carretas_fretes';

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from(table)
                .select('*')
                .eq('tipo', tipo)
                .order('cidade', { ascending: true });
            if (error) throw error;
            // Se não há dados, semear com os valores iniciais
            if (!data || data.length === 0) {
                const seed = tipo === 'frota' ? FROTA_INICIAL : TERCEIROS_INICIAL;
                const { data: inserted, error: insErr } = await supabase
                    .from(table)
                    .insert(seed.map(r => ({ ...r, tipo })))
                    .select();
                if (insErr) throw insErr;
                setRows(inserted || []);
            } else {
                setRows(data);
            }
        } catch (e) {
            console.error('Erro ao carregar fretes:', e);
            // Fallback local se tabela não existir ainda
            const seed = tipo === 'frota' ? FROTA_INICIAL : TERCEIROS_INICIAL;
            setRows(seed.map((r, i) => ({ ...r, id: `local_${i}`, tipo })));
        } finally {
            setLoading(false);
        }
    }, [tipo]);

    useEffect(() => { load(); }, [load]);

    return { rows, setRows, loading, reload: load };
}

// ─── Tabela de fretes (reutilizada para frota e terceiros) ────────────────────
function TabelaFretes({ tipo, label, cor }) {
    const { rows, setRows, loading, reload } = useFretes(tipo);
    const { toast, showToast } = useToast();
    const { confirm, ConfirmDialog } = useConfirm();
    const [busca, setBusca] = useState('');
    const [editId, setEditId] = useState(null);
    const [editData, setEditData] = useState({});
    const [saving, setSaving] = useState(false);
    const [addMode, setAddMode] = useState(false);
    const [newRow, setNewRow] = useState({ cidade: '', km: '', frete_por_saco: '' });

    const filtered = rows.filter(r => r.cidade?.toLowerCase().includes(busca.toLowerCase()));

    const startEdit = row => { setEditId(row.id); setEditData({ cidade: row.cidade, km: row.km ?? '', frete_por_saco: row.frete_por_saco ?? '' }); };
    const cancelEdit = () => { setEditId(null); setEditData({}); };

    const saveEdit = async () => {
        if (!editData.cidade?.trim()) { showToast('Informe o nome da cidade.', 'error'); return; }
        if (!editData.frete_por_saco || isNaN(editData.frete_por_saco)) { showToast('Informe o frete por saco.', 'error'); return; }
        setSaving(true);
        try {
            const isLocal = String(editId).startsWith('local_');
            const payload = {
                cidade: editData.cidade.trim(),
                km: editData.km ? Number(editData.km) : null,
                frete_por_saco: Number(editData.frete_por_saco),
                tipo,
            };
            if (isLocal) {
                const { data, error } = await supabase.from('carretas_fretes').insert(payload).select().single();
                if (error) throw error;
                setRows(prev => prev.map(r => r.id === editId ? data : r));
            } else {
                const { error } = await supabase.from('carretas_fretes').update(payload).eq('id', editId);
                if (error) throw error;
                setRows(prev => prev.map(r => r.id === editId ? { ...r, ...payload } : r));
            }
            showToast('Frete atualizado!', 'success');
            setEditId(null);
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
        finally { setSaving(false); }
    };

    const deleteRow = async row => {
        const ok = await confirm({ title: 'Excluir cidade?', message: `Remover "${row.cidade}" da tabela de fretes?`, confirmLabel: 'Excluir', variant: 'danger' });
        if (!ok) return;
        try {
            const isLocal = String(row.id).startsWith('local_');
            if (!isLocal) {
                const { error } = await supabase.from('carretas_fretes').delete().eq('id', row.id);
                if (error) throw error;
            }
            setRows(prev => prev.filter(r => r.id !== row.id));
            showToast('Cidade removida.', 'success');
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };

    const saveNew = async () => {
        if (!newRow.cidade?.trim()) { showToast('Informe o nome da cidade.', 'error'); return; }
        if (!newRow.frete_por_saco || isNaN(newRow.frete_por_saco)) { showToast('Informe o frete por saco.', 'error'); return; }
        setSaving(true);
        try {
            const payload = {
                cidade: newRow.cidade.trim(),
                km: newRow.km ? Number(newRow.km) : null,
                frete_por_saco: Number(newRow.frete_por_saco),
                tipo,
            };
            const { data, error } = await supabase.from('carretas_fretes').insert(payload).select().single();
            if (error) throw error;
            setRows(prev => [...prev, data].sort((a, b) => a.cidade.localeCompare(b.cidade)));
            setNewRow({ cidade: '', km: '', frete_por_saco: '' });
            setAddMode(false);
            showToast('Cidade adicionada!', 'success');
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
        finally { setSaving(false); }
    };

    if (loading) return (
        <div className="flex justify-center py-16">
            <div className="animate-spin h-7 w-7 rounded-full border-4" style={{ borderColor: cor, borderTopColor: 'transparent' }} />
        </div>
    );

    return (
        <div className="flex flex-col gap-4">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Icon name="Search" size={14} color="var(--color-muted-foreground)" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
                        <input
                            value={busca} onChange={e => setBusca(e.target.value)}
                            placeholder="Buscar cidade..."
                            className="pl-8 pr-3 py-2 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                            style={{ borderColor: 'var(--color-border)', width: 220 }}
                        />
                    </div>
                    <span className="text-xs px-2 py-1 rounded-full font-semibold" style={{ backgroundColor: cor + '20', color: cor }}>
                        {filtered.length} cidades
                    </span>
                </div>
                <Button size="sm" iconName="Plus" onClick={() => { setAddMode(true); setEditId(null); }}>
                    Adicionar Cidade
                </Button>
            </div>

            {/* Tabela */}
            <div className="bg-white rounded-xl border shadow-sm overflow-x-auto" style={{ borderColor: 'var(--color-border)' }}>
                <table className="w-full text-sm min-w-[500px]">
                    <thead className="text-xs border-b" style={{ backgroundColor: cor + '15', borderColor: 'var(--color-border)' }}>
                        <tr>
                            <th className="px-4 py-3 text-left font-semibold" style={{ color: cor }}>Cidade / Destino</th>
                            <th className="px-4 py-3 text-right font-semibold w-24" style={{ color: cor }}>KM</th>
                            <th className="px-4 py-3 text-right font-semibold w-36" style={{ color: cor }}>Frete por Saco</th>
                            <th className="px-4 py-3 text-center font-semibold w-24" style={{ color: cor }}>Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {/* Linha de adicionar nova cidade */}
                        {addMode && (
                            <tr className="border-b" style={{ borderColor: cor + '40', backgroundColor: cor + '08' }}>
                                <td className="px-3 py-2">
                                    <input autoFocus value={newRow.cidade} onChange={e => setNewRow(r => ({ ...r, cidade: e.target.value }))}
                                        className={inputCls} style={inputStyle} placeholder="Nome da cidade..." />
                                </td>
                                <td className="px-3 py-2">
                                    <input type="number" value={newRow.km} onChange={e => setNewRow(r => ({ ...r, km: e.target.value }))}
                                        className={inputCls} style={{ ...inputStyle, textAlign: 'right' }} placeholder="—" />
                                </td>
                                <td className="px-3 py-2">
                                    <input type="number" step="0.01" value={newRow.frete_por_saco} onChange={e => setNewRow(r => ({ ...r, frete_por_saco: e.target.value }))}
                                        className={inputCls} style={{ ...inputStyle, textAlign: 'right' }} placeholder="0,00" />
                                </td>
                                <td className="px-3 py-2">
                                    <div className="flex items-center justify-center gap-1">
                                        <button onClick={saveNew} disabled={saving} title="Salvar" className="p-1.5 rounded-lg hover:bg-green-100 transition-colors">
                                            <Icon name="Check" size={14} color="#059669" />
                                        </button>
                                        <button onClick={() => { setAddMode(false); setNewRow({ cidade: '', km: '', frete_por_saco: '' }); }} title="Cancelar" className="p-1.5 rounded-lg hover:bg-red-100 transition-colors">
                                            <Icon name="X" size={14} color="#DC2626" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        )}

                        {filtered.length === 0 && !addMode ? (
                            <tr><td colSpan={4} className="text-center py-10 text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
                                {busca ? `Nenhuma cidade encontrada para "${busca}"` : 'Nenhuma cidade cadastrada.'}
                            </td></tr>
                        ) : filtered.map((row, i) => (
                            <tr key={row.id} className="border-t hover:bg-gray-50 transition-colors"
                                style={{ borderColor: 'var(--color-border)', backgroundColor: editId === row.id ? cor + '06' : i % 2 === 0 ? '#fff' : '#F8FAFC' }}>
                                {editId === row.id ? (
                                    <>
                                        <td className="px-3 py-2">
                                            <input autoFocus value={editData.cidade} onChange={e => setEditData(d => ({ ...d, cidade: e.target.value }))}
                                                className={inputCls} style={inputStyle} />
                                        </td>
                                        <td className="px-3 py-2">
                                            <input type="number" value={editData.km} onChange={e => setEditData(d => ({ ...d, km: e.target.value }))}
                                                className={inputCls} style={{ ...inputStyle, textAlign: 'right' }} placeholder="—" />
                                        </td>
                                        <td className="px-3 py-2">
                                            <input type="number" step="0.01" value={editData.frete_por_saco} onChange={e => setEditData(d => ({ ...d, frete_por_saco: e.target.value }))}
                                                className={inputCls} style={{ ...inputStyle, textAlign: 'right' }} />
                                        </td>
                                        <td className="px-3 py-2">
                                            <div className="flex items-center justify-center gap-1">
                                                <button onClick={saveEdit} disabled={saving} title="Salvar" className="p-1.5 rounded-lg hover:bg-green-100 transition-colors">
                                                    <Icon name="Check" size={14} color="#059669" />
                                                </button>
                                                <button onClick={cancelEdit} title="Cancelar" className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors">
                                                    <Icon name="X" size={14} color="#6B7280" />
                                                </button>
                                            </div>
                                        </td>
                                    </>
                                ) : (
                                    <>
                                        <td className="px-4 py-3 font-medium" style={{ color: 'var(--color-text-primary)' }}>{row.cidade}</td>
                                        <td className="px-4 py-3 text-right font-mono text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                                            {row.km ? row.km.toLocaleString('pt-BR') + ' km' : '—'}
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono font-semibold" style={{ color: cor }}>
                                            {BRL(row.frete_por_saco)}<span className="text-xs font-normal ml-1" style={{ color: 'var(--color-muted-foreground)' }}>/saco</span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center justify-center gap-1">
                                                <button onClick={() => startEdit(row)} title="Editar" className="p-1.5 rounded-lg hover:bg-blue-100 transition-colors">
                                                    <Icon name="Pencil" size={13} color="#2563EB" />
                                                </button>
                                                <button onClick={() => deleteRow(row)} title="Excluir" className="p-1.5 rounded-lg hover:bg-red-100 transition-colors">
                                                    <Icon name="Trash2" size={13} color="#DC2626" />
                                                </button>
                                            </div>
                                        </td>
                                    </>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <Toast toast={toast} />
            {ConfirmDialog}
        </div>
    );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function TabFretes({ isAdmin }) {
    const [guia, setGuia] = useState('frota');

    return (
        <div className="flex flex-col gap-5">
            {/* Header */}
            <div>
                <h2 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Tabela de Fretes</h2>
                <p className="text-sm mt-0.5" style={{ color: 'var(--color-muted-foreground)' }}>
                    Valores de referência por saco para cada destino — atualização: 06/05/2026
                </p>
            </div>

            {/* Sub-guias */}
            <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ backgroundColor: 'var(--color-muted)' }}>
                {[
                    { id: 'frota',      label: 'Fretes da Frota',      icon: 'Truck',  cor: '#2563EB' },
                    { id: 'terceiros',  label: 'Fretes de Terceiros',   icon: 'Users',  cor: '#D97706' },
                ].map(g => (
                    <button key={g.id} onClick={() => setGuia(g.id)}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
                        style={guia === g.id
                            ? { backgroundColor: '#fff', color: g.cor, boxShadow: '0 1px 3px rgba(0,0,0,0.10)' }
                            : { color: 'var(--color-muted-foreground)' }}>
                        <Icon name={g.icon} size={14} color={guia === g.id ? g.cor : 'var(--color-muted-foreground)'} />
                        {g.label}
                    </button>
                ))}
            </div>

            {/* Aviso readonly para não-admin */}
            {!isAdmin && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs" style={{ backgroundColor: '#FEF3C7', border: '1px solid #FDE68A', color: '#92400E' }}>
                    <Icon name="Info" size={13} color="#D97706" />
                    Visualização apenas. Somente administradores podem editar os valores.
                </div>
            )}

            {/* Conteúdo da guia */}
            {guia === 'frota' && (
                <TabelaFretes
                    tipo="frota"
                    label="Fretes da Frota"
                    cor="#2563EB"
                    isAdmin={isAdmin}
                />
            )}
            {guia === 'terceiros' && (
                <TabelaFretes
                    tipo="terceiros"
                    label="Fretes de Terceiros"
                    cor="#D97706"
                    isAdmin={isAdmin}
                />
            )}
        </div>
    );
}
