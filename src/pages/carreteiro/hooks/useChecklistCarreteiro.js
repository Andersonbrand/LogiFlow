import { useState } from 'react';
import { updateChecklist, createChecklist, deleteChecklist } from 'services/carretas';

/** Estado e ações extraídos da tela — ver o componente que usa este hook. */
export function useChecklistCarreteiro({ confirm, load, showToast, user }) {
const [modalCheck, setModalCheck]   = useState(false);

const [editandoCheckId, setEditandoCheckId] = useState(null);

const [salvandoCheck, setSalvandoCheck] = useState(false);

const [progressoFotosCheck, setProgressoFotosCheck] = useState(null);

const [formCheck, setFormCheck]     = useState({ veiculo_id: '', odometro: '', itens: {}, problemas: '', necessidades: '', observacoes_livres: '', foto_url: '', fotos_urls: [] });

const handleCheck = async () => {
        if (salvandoCheck) return;
        if (!formCheck.veiculo_id) { showToast('Selecione o veículo', 'error'); return; }
        if (formCheck.odometro === '' || formCheck.odometro == null) { showToast('Informe o odômetro do veículo', 'error'); return; }
        const semana = new Date(); semana.setDate(semana.getDate() - semana.getDay() + 1);
        setSalvandoCheck(true);
        try {
            const payload = { ...formCheck, foto_url: formCheck.fotos_urls[0] || '', odometro: formCheck.odometro !== '' && formCheck.odometro != null ? Number(formCheck.odometro) : null };
            const onProgressoFotos = (atual, total) => setProgressoFotosCheck(total > 0 ? { atual, total } : null);
            let salvo;
            if (editandoCheckId) {
                salvo = await updateChecklist(editandoCheckId, payload, onProgressoFotos);
                showToast('Checklist atualizado!', 'success');
                setEditandoCheckId(null);
            } else {
                salvo = await createChecklist({ ...payload, motorista_id: user.id, semana_ref: semana.toISOString().split('T')[0] }, onProgressoFotos);
                showToast('Checklist enviado para análise!', 'success');
            }
            if (salvo?._fotosFalhas) {
                setTimeout(() => showToast(`Atenção: ${salvo._fotosFalhas} foto(s) não foram enviadas. Edite o checklist para tentar novamente.`, 'error'), 1400);
            }
            setModalCheck(false);
            setFormCheck({ veiculo_id: '', odometro: '', itens: {}, problemas: '', necessidades: '', observacoes_livres: '', foto_url: '', fotos_urls: [] });
            load();
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
        finally { setSalvandoCheck(false); setProgressoFotosCheck(null); }
    };

const handleEditCheck = (c) => {
        setEditandoCheckId(c.id);
        setFormCheck({
            veiculo_id: c.veiculo_id || '',
            odometro: c.odometro != null ? String(c.odometro) : '',
            itens: c.itens || {},
            problemas: c.problemas || '',
            necessidades: c.necessidades || '',
            observacoes_livres: c.observacoes_livres || '',
            foto_url: c.foto_url || '',
            fotos_urls: (c.fotos_urls && c.fotos_urls.length) ? c.fotos_urls : (c.foto_url ? [c.foto_url] : []),
        });
        setModalCheck(true);
    };

const handleDeleteChecklist = async (id) => {
        const ok = await confirm({ title: 'Excluir checklist?', message: 'Esta ação não pode ser desfeita.', confirmLabel: 'Excluir', variant: 'danger' });
        if (!ok) return;
        try { await deleteChecklist(id); showToast('Checklist excluído.', 'success'); load(); }
        catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };

    return { modalCheck, setModalCheck, editandoCheckId, setEditandoCheckId, salvandoCheck, progressoFotosCheck, formCheck, setFormCheck, handleCheck, handleEditCheck, handleDeleteChecklist };
}
