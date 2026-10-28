import { useState } from 'react';
import { aprovarChecklistComNotificacao, reprovarChecklistComNotificacao, criarRascunhoOSDeChecklist } from 'services/carretas';

/** Estado e ações extraídos da tela — ver o componente que usa este hook. */
export function usePainelMotoristaManutencao({ adminProfile, checklists, load, showToast }) {
const [modalManut, setModalManut] = useState(null);

const [obsManut, setObsManut]     = useState('');

// Checklist handlers
    const handleAprovar = async (c) => {
        try {
            await aprovarChecklistComNotificacao(c.id, adminProfile?.id, c.motorista_id);
            showToast('Aprovado! Motorista notificado.', 'success'); load();
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };

const handleManutencao = async () => {
        if (!obsManut.trim()) { showToast('Descreva a manutenção', 'error'); return; }
        const chk = checklists.find(c => c.id === modalManut);
        try {
            await reprovarChecklistComNotificacao(modalManut, adminProfile?.id, chk?.motorista_id, obsManut);
            try {
                if (chk) await criarRascunhoOSDeChecklist({ ...chk, observacoes_livres: [chk.observacoes_livres, obsManut].filter(Boolean).join(' | ') }, adminProfile?.id);
                showToast('Manutenção registrada! Rascunho de OS criado no módulo Carretas > Ordens de Serviço.', 'success');
            } catch {
                showToast('Manutenção registrada! (Não foi possível gerar o rascunho de OS automaticamente.)', 'warning');
            }
            setModalManut(null); setObsManut(''); load();
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };

    return { modalManut, setModalManut, obsManut, setObsManut, handleAprovar, handleManutencao };
}
