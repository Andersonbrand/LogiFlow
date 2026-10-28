import { useState, useCallback } from 'react';
import { updateAbastecimento, createAbastecimento, deleteAbastecimento } from 'services/carretas';

/** Estado e ações extraídos da tela — ver o componente que usa este hook. */
export function useAbastecimentoCarreteiro({ configAbast, confirm, load, postos, showToast, user }) {
const [modalAbast, setModalAbast]   = useState(false);

const [editandoAbastId, setEditandoAbastId] = useState(null);

const [salvandoAbast, setSalvandoAbast] = useState(false);

// { atual, total } | null
    const [formAbast, setFormAbast]     = useState({ veiculo_id: '', data_abastecimento: new Date().toISOString().split('T')[0], horario: '', posto_id: '', posto: '', litros_diesel: '', valor_diesel: '', litros_arla: '', valor_arla: '', cupom_fiscal: '', observacoes: '' });

// ── Preços: posto tem prioridade sobre config global ───────────────────────
    const getPrecoCarreteiro = useCallback((postoId, tipo) => {
        const posto = postos.find(p => p.id === postoId);
        if (tipo === 'diesel') return Number(posto?.preco_diesel || configAbast?.preco_diesel || 0);
        if (tipo === 'arla')   return Number(posto?.preco_arla   || configAbast?.preco_arla   || 0);
        return 0;
    }, [postos, configAbast]);

const handlePostoChangeCarreteiro = (postoId) => {
        const posto = postos.find(p => p.id === postoId);
        const precoDiesel = getPrecoCarreteiro(postoId, 'diesel');
        const precoArla   = getPrecoCarreteiro(postoId, 'arla');
        setFormAbast(f => ({
            ...f,
            posto_id: postoId,
            posto: posto?.nome || '',
            valor_diesel: precoDiesel && f.litros_diesel
                ? (Number(f.litros_diesel) * precoDiesel).toFixed(2) : f.valor_diesel,
            valor_arla: precoArla && f.litros_arla
                ? (Number(f.litros_arla) * precoArla).toFixed(2) : f.valor_arla,
        }));
    };

const handleLitrosCarreteiro = (campo, valor) => {
        setFormAbast(f => {
            const precoDiesel = getPrecoCarreteiro(f.posto_id, 'diesel');
            const precoArla   = getPrecoCarreteiro(f.posto_id, 'arla');
            const n = { ...f, [campo]: valor };
            if (campo === 'litros_diesel' && precoDiesel)
                n.valor_diesel = valor ? (Number(valor) * precoDiesel).toFixed(2) : '';
            if (campo === 'litros_arla' && precoArla)
                n.valor_arla = valor ? (Number(valor) * precoArla).toFixed(2) : '';
            return n;
        });
    };

const handleAbast = async () => {
        if (salvandoAbast) return;
        if (!formAbast.veiculo_id || !formAbast.data_abastecimento) { showToast('Veículo e data são obrigatórios', 'error'); return; }
        if (!formAbast.cupom_fiscal?.trim()) { showToast('Informe o N° do cupom fiscal', 'error'); return; }
        if (!formAbast.posto_id) { showToast('Selecione o posto de abastecimento', 'error'); return; }
        const precoDiesel = getPrecoCarreteiro(formAbast.posto_id, 'diesel');
        const precoArla   = getPrecoCarreteiro(formAbast.posto_id, 'arla');
        const valorDiesel = formAbast.valor_diesel
            ? Number(formAbast.valor_diesel)
            : Number(formAbast.litros_diesel || 0) * precoDiesel;
        const valorArla = formAbast.valor_arla
            ? Number(formAbast.valor_arla)
            : Number(formAbast.litros_arla || 0) * precoArla;
        const payload = {
            ...formAbast,
            motorista_id: user.id,
            litros_diesel: Number(formAbast.litros_diesel || 0),
            litros_arla:   Number(formAbast.litros_arla || 0),
            valor_diesel: valorDiesel.toFixed(2),
            valor_arla:   valorArla.toFixed(2),
        };
        if (!payload.posto_id) delete payload.posto_id;
        setSalvandoAbast(true);
        try {
            if (editandoAbastId) {
                await updateAbastecimento(editandoAbastId, payload);
                showToast('Abastecimento atualizado!', 'success');
            } else {
                await createAbastecimento(payload);
                showToast('Abastecimento registrado!', 'success');
            }
            setModalAbast(false);
            setEditandoAbastId(null);
            load();
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
        finally { setSalvandoAbast(false); }
    };

const handleEditAbast = (a) => {
        setEditandoAbastId(a.id);
        setFormAbast({
            veiculo_id: a.veiculo_id || '',
            data_abastecimento: a.data_abastecimento || new Date().toISOString().split('T')[0],
            horario: a.horario || '',
            posto_id: a.posto_id || '',
            posto: a.posto || '',
            litros_diesel: a.litros_diesel ?? '',
            valor_diesel: a.valor_diesel ?? '',
            litros_arla: a.litros_arla ?? '',
            valor_arla: a.valor_arla ?? '',
            cupom_fiscal: a.cupom_fiscal || '',
            observacoes: a.observacoes || '',
        });
        setModalAbast(true);
    };

const handleDeleteAbast = async (id) => {
        const ok = await confirm({ title: 'Excluir abastecimento?', message: 'Esta ação não pode ser desfeita.', confirmLabel: 'Excluir', variant: 'danger' });
        if (!ok) return;
        try { await deleteAbastecimento(id); showToast('Abastecimento excluído.', 'success'); load(); }
        catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };

    return { modalAbast, setModalAbast, editandoAbastId, setEditandoAbastId, salvandoAbast, formAbast, setFormAbast, getPrecoCarreteiro, handlePostoChangeCarreteiro, handleLitrosCarreteiro, handleAbast, handleEditAbast, handleDeleteAbast };
}
