import { useState } from 'react';
import { createFornecedor as createFornecedorCarretas, } from 'services/fornecedoresService';

/** Estado e ações extraídos da tela — ver o componente que usa este hook. */
export function useFornecedoresVolume({ confirm, load, showToast }) {
// Modal fornecedor
    const [modalFornec, setModalFornec] = useState(false);
    const [formFornec, setFormFornec] = useState({ nome: '', cnpj: '', observacoes: '' });
    const [savingFornec, setSavingFornec] = useState(false);

    // ── Handlers fornecedor ───────────────────────────────────────────────────
    const handleSaveFornec = async () => {
        if (!formFornec.nome.trim()) { showToast('Nome é obrigatório.', 'error'); return; }
        setSavingFornec(true);
        try {
            await createFornecedorCarretas({ nome: formFornec.nome.trim(), cnpj: formFornec.cnpj.trim() || null, observacoes: formFornec.observacoes.trim() || null });
            showToast('Fornecedor salvo!', 'success');
            setModalFornec(false);
            setFormFornec({ nome: '', cnpj: '', observacoes: '' });
            load();
        } catch (e) {
            const msg = e.code === '23505' || /duplicate key|unique constraint/i.test(e.message)
                ? 'Já existe um fornecedor cadastrado com este CNPJ.'
                : 'Erro: ' + e.message;
            showToast(msg, 'error');
        }
        finally { setSavingFornec(false); }
    };

    

    return { modalFornec, setModalFornec, formFornec, setFormFornec, savingFornec, handleSaveFornec };
}
