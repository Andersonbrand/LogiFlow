import { useState, useCallback } from 'react';
import { updateAbastecimento, createAbastecimento, deleteAbastecimento } from 'services/carretas';

/** Estado e ações extraídos da tela — ver o componente que usa este hook. */
export function useMotoristaAbastecimento({ abast, configAbast, confirm, load, postos, showToast, user, veiculos }) {
const [modalAbast, setModalAbast] = useState(false);

const [editingAbastId, setEditingAbastId] = useState(null);

const emptyAbast = () => ({
        veiculo_caminhao_id: '', posto_id: '',
        data_abastecimento: new Date().toISOString().split('T')[0],
        horario: '', litros_diesel: '', valor_diesel: '',
        litros_arla: '', valor_arla: '', cupom_fiscal: '', observacoes: '',
    });

const [formAbast, setFormAbast] = useState(emptyAbast());

const [savingAbast, setSavingAbast] = useState(false);

// ── Preços: posto tem prioridade, senão usa config global do admin ────────
    const getPreco = useCallback((postoId, tipo) => {
        const posto = postos.find(p => p.id === postoId);
        if (tipo === 'diesel') return Number(posto?.preco_diesel || configAbast?.preco_diesel || 0);
        if (tipo === 'arla')   return Number(posto?.preco_arla   || configAbast?.preco_arla   || 0);
        return 0;
    }, [postos, configAbast]);

const handlePostoChange = (postoId) => {
        const precoDiesel = getPreco(postoId, 'diesel');
        const precoArla   = getPreco(postoId, 'arla');
        setFormAbast(f => ({
            ...f, posto_id: postoId,
            valor_diesel: precoDiesel && f.litros_diesel
                ? (Number(f.litros_diesel) * precoDiesel).toFixed(2) : f.valor_diesel,
            valor_arla: precoArla && f.litros_arla
                ? (Number(f.litros_arla) * precoArla).toFixed(2) : f.valor_arla,
        }));
    };

const handleLitros = (campo, valor) => {
        const precoDiesel = getPreco(formAbast.posto_id, 'diesel');
        const precoArla   = getPreco(formAbast.posto_id, 'arla');
        setFormAbast(f => {
            const n = { ...f, [campo]: valor };
            if (campo === 'litros_diesel' && precoDiesel)
                n.valor_diesel = valor ? (Number(valor) * precoDiesel).toFixed(2) : '';
            if (campo === 'litros_arla' && precoArla)
                n.valor_arla = valor ? (Number(valor) * precoArla).toFixed(2) : '';
            return n;
        });
    };

// ── Handlers ─────────────────────────────────────────────────────────────
    const handleAbast = async () => {
        if (!formAbast.veiculo_caminhao_id || !formAbast.data_abastecimento) {
            showToast('Veículo e data são obrigatórios', 'error'); return;
        }
        if (!formAbast.cupom_fiscal?.trim()) {
            showToast('Informe o N° do cupom fiscal', 'error'); return;
        }
        if (!formAbast.posto_id) {
            showToast('Selecione o posto de abastecimento', 'error'); return;
        }
        setSavingAbast(true);
        try {
            const caminhao = veiculos.find(v => String(v.id) === String(formAbast.veiculo_caminhao_id));
            const abastOriginal = editingAbastId ? abast.find(a => a.id === editingAbastId) : null;
            const payload = {
                ...formAbast, motorista_id: user.id,
                // Campo deixado em branco (ex: só abasteceu Diesel, sem Arla)
                // chegava como string vazia '' e o Postgres rejeita isso numa
                // coluna numeric — precisa virar 0.
                litros_diesel: Number(formAbast.litros_diesel || 0),
                valor_diesel: Number(formAbast.valor_diesel || 0),
                litros_arla: Number(formAbast.litros_arla || 0),
                valor_arla: Number(formAbast.valor_arla || 0),
                veiculo_caminhao_placa: caminhao?.placa || abastOriginal?.veiculo_caminhao_placa || null,
                veiculo_caminhao_modelo: caminhao?.modelo || abastOriginal?.veiculo_caminhao_modelo || null,
            };
            if (!payload.posto_id) delete payload.posto_id;
            const posto = postos.find(p => p.id === formAbast.posto_id);
            if (posto) payload.posto = posto.nome;
            if (editingAbastId) {
                await updateAbastecimento(editingAbastId, payload);
                showToast('Abastecimento atualizado!', 'success');
            } else {
                await createAbastecimento(payload);
                showToast('Abastecimento registrado!', 'success');
            }
            setModalAbast(false); setFormAbast(emptyAbast()); setEditingAbastId(null); load();
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
        finally { setSavingAbast(false); }
    };

const abrirEdicaoAbast = (a) => {
        setEditingAbastId(a.id);
        setFormAbast({
            veiculo_caminhao_id: a.veiculo_caminhao_id != null ? String(a.veiculo_caminhao_id) : '',
            posto_id: a.posto_id || '',
            data_abastecimento: a.data_abastecimento || new Date().toISOString().split('T')[0],
            horario: a.horario || '',
            litros_diesel: a.litros_diesel ?? '', valor_diesel: a.valor_diesel ?? '',
            litros_arla: a.litros_arla ?? '', valor_arla: a.valor_arla ?? '',
            cupom_fiscal: a.cupom_fiscal || '', observacoes: a.observacoes || '',
        });
        setModalAbast(true);
    };

const excluirAbast = async (a) => {
        const ok = await confirm({
            title: 'Excluir abastecimento',
            message: `Excluir o abastecimento de ${a.veiculo?.placa || a.veiculo_caminhao_placa || 'veículo'} em ${a.data_abastecimento ? new Date(a.data_abastecimento + 'T00:00:00').toLocaleDateString('pt-BR') : ''}?`,
            confirmText: 'Excluir', variant: 'danger',
        });
        if (!ok) return;
        try {
            await deleteAbastecimento(a.id);
            showToast('Abastecimento excluído', 'success');
            load();
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };

    return { modalAbast, setModalAbast, editingAbastId, setEditingAbastId, emptyAbast, formAbast, setFormAbast, savingAbast, getPreco, handlePostoChange, handleLitros, handleAbast, abrirEdicaoAbast, excluirAbast };
}
