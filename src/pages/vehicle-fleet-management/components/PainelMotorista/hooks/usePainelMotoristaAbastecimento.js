import { useState, useCallback } from 'react';
import { updateAbastecimento, createAbastecimento, deleteAbastecimento } from 'services/carretas';
import { FMT } from '../utils/helpers';

/** Estado e ações extraídos da tela — ver o componente que usa este hook. */
export function usePainelMotoristaAbastecimento({ configAbast, confirm, load, motorista, postos, showToast, veiculosCaminhao }) {
const [modalAbastEdit, setModalAbastEdit] = useState(null);

// { id } quando editando
    const [formAbastEdit, setFormAbastEdit] = useState({
        veiculo_caminhao_id: '', data_abastecimento: '', posto_id: '', cupom_fiscal: '',
        litros_diesel: '', valor_diesel: '', litros_arla: '', valor_arla: '',
    });

const [savingAbastEdit, setSavingAbastEdit] = useState(false);

// Abastecimentos: edição e exclusão (admin) — usa a mesma comparação de
    // id "string-safe" (String(v.id) === String(...)) já corrigida na tela
    // do motorista, para não reintroduzir o bug de placa/modelo ficando null.
    // ── Preços: posto tem prioridade, senão usa config global (igual à tela do motorista) ──
    const getPrecoAbast = useCallback((postoId, tipo) => {
        const posto = postos.find(p => p.id === postoId);
        if (tipo === 'diesel') return Number(posto?.preco_diesel || configAbast?.preco_diesel || 0);
        if (tipo === 'arla')   return Number(posto?.preco_arla   || configAbast?.preco_arla   || 0);
        return 0;
    }, [postos, configAbast]);

const handlePostoAbastChange = (postoId) => {
        const precoDiesel = getPrecoAbast(postoId, 'diesel');
        const precoArla   = getPrecoAbast(postoId, 'arla');
        setFormAbastEdit(f => ({
            ...f, posto_id: postoId,
            valor_diesel: precoDiesel && f.litros_diesel ? (Number(f.litros_diesel) * precoDiesel).toFixed(2) : f.valor_diesel,
            valor_arla: precoArla && f.litros_arla ? (Number(f.litros_arla) * precoArla).toFixed(2) : f.valor_arla,
        }));
    };

const handleLitrosAbast = (campo, valor) => {
        const precoDiesel = getPrecoAbast(formAbastEdit.posto_id, 'diesel');
        const precoArla   = getPrecoAbast(formAbastEdit.posto_id, 'arla');
        setFormAbastEdit(f => {
            const n = { ...f, [campo]: valor };
            if (campo === 'litros_diesel' && precoDiesel) n.valor_diesel = valor ? (Number(valor) * precoDiesel).toFixed(2) : '';
            if (campo === 'litros_arla' && precoArla) n.valor_arla = valor ? (Number(valor) * precoArla).toFixed(2) : '';
            return n;
        });
    };

const openEditAbastecimento = (a) => {
        setFormAbastEdit({
            veiculo_caminhao_id: a.veiculo_caminhao_id != null ? String(a.veiculo_caminhao_id) : '',
            data_abastecimento: a.data_abastecimento || '',
            posto_id: a.posto_id || '', cupom_fiscal: a.cupom_fiscal || '',
            litros_diesel: a.litros_diesel ?? '', valor_diesel: a.valor_diesel ?? '',
            litros_arla: a.litros_arla ?? '', valor_arla: a.valor_arla ?? '',
        });
        setModalAbastEdit({ id: a.id });
    };

// Admin lança um abastecimento em nome do motorista (ex.: quando o
    // motorista não consegue lançar pelo próprio cadastro, ou pra corrigir
    // um lançamento que faltou).
    const openNovoAbastecimento = () => {
        setFormAbastEdit({
            veiculo_caminhao_id: '', data_abastecimento: new Date().toISOString().split('T')[0],
            posto_id: '', cupom_fiscal: '',
            litros_diesel: '', valor_diesel: '', litros_arla: '', valor_arla: '',
        });
        setModalAbastEdit({ id: null });
    };

const handleSaveAbastecimento = async () => {
        if (!formAbastEdit.data_abastecimento) { showToast('Data é obrigatória', 'error'); return; }
        if (!formAbastEdit.posto_id) { showToast('Selecione o posto de abastecimento', 'error'); return; }
        if (!formAbastEdit.cupom_fiscal?.trim()) { showToast('Informe o N° do cupom fiscal', 'error'); return; }
        setSavingAbastEdit(true);
        try {
            const caminhao = veiculosCaminhao.find(v => String(v.id) === String(formAbastEdit.veiculo_caminhao_id));
            const posto = postos.find(p => p.id === formAbastEdit.posto_id);
            const payload = {
                data_abastecimento: formAbastEdit.data_abastecimento,
                posto_id: formAbastEdit.posto_id,
                posto: posto?.nome || null,
                cupom_fiscal: formAbastEdit.cupom_fiscal.trim(),
                litros_diesel: Number(formAbastEdit.litros_diesel || 0),
                valor_diesel: Number(formAbastEdit.valor_diesel || 0),
                litros_arla: Number(formAbastEdit.litros_arla || 0),
                valor_arla: Number(formAbastEdit.valor_arla || 0),
                ...(formAbastEdit.veiculo_caminhao_id ? {
                    veiculo_caminhao_id: formAbastEdit.veiculo_caminhao_id,
                    veiculo_caminhao_placa: caminhao?.placa || null,
                } : {}),
            };
            if (modalAbastEdit.id) {
                await updateAbastecimento(modalAbastEdit.id, payload);
                showToast('Abastecimento atualizado!', 'success');
            } else {
                await createAbastecimento({ ...payload, motorista_id: motorista.id });
                showToast('Abastecimento lançado!', 'success');
            }
            setModalAbastEdit(null); load();
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
        finally { setSavingAbastEdit(false); }
    };

const handleDeleteAbastecimento = async (a) => {
        const ok = await confirm({
            title: 'Excluir abastecimento?',
            message: `Excluir o abastecimento de ${a.veiculo?.placa || a.veiculo_caminhao_placa || 'veículo'} em ${FMT(a.data_abastecimento)}? Esta ação não pode ser desfeita.`,
            confirmLabel: 'Excluir', variant: 'danger',
        });
        if (!ok) return;
        try { await deleteAbastecimento(a.id); showToast('Abastecimento excluído.', 'success'); load(); }
        catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };

    return { modalAbastEdit, setModalAbastEdit, formAbastEdit, setFormAbastEdit, savingAbastEdit, getPrecoAbast, handlePostoAbastChange, handleLitrosAbast, openEditAbastecimento, openNovoAbastecimento, handleSaveAbastecimento, handleDeleteAbastecimento };
}
