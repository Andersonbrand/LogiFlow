import { useState } from 'react';
import { updateChecklist, createChecklist, deleteChecklist } from 'services/carretas';

/** Estado e ações extraídos da tela — ver o componente que usa este hook. */
export function useMotoristaChecklist({ checklists, confirm, load, showToast, user, veiculos }) {
const [modalCheck, setModalCheck] = useState(false);

const [editingCheckId, setEditingCheckId] = useState(null);

const emptyCheck = () => ({
        veiculo_caminhao_id: '', odometro: '', itens: {}, problemas: '', necessidades: '',
        observacoes_livres: '', foto_url: '', fotos_urls: [],
    });

const [formCheck, setFormCheck] = useState(emptyCheck());

const [savingCheck, setSavingCheck] = useState(false);

const [progressoFotosCheck, setProgressoFotosCheck] = useState(null);

const handleCheck = async () => {
        if (!formCheck.veiculo_caminhao_id) { showToast('Selecione o veículo', 'error'); return; }
        if (formCheck.odometro === '' || formCheck.odometro == null) { showToast('Informe o odômetro do veículo', 'error'); return; }
        const semana = new Date(); semana.setDate(semana.getDate() - semana.getDay() + 1);
        setSavingCheck(true);
        try {
            const caminhao = veiculos.find(v => String(v.id) === String(formCheck.veiculo_caminhao_id));
            const checkOriginal = editingCheckId ? checklists.find(c => c.id === editingCheckId) : null;
            const payload = {
                ...formCheck, foto_url: formCheck.fotos_urls[0] || '', motorista_id: user.id,
                odometro: formCheck.odometro !== '' && formCheck.odometro != null ? Number(formCheck.odometro) : null,
                veiculo_caminhao_placa: caminhao?.placa || checkOriginal?.veiculo_caminhao_placa || null,
                veiculo_caminhao_modelo: caminhao?.modelo || checkOriginal?.veiculo_caminhao_modelo || null,
            };
            let salvo;
            const onProgressoFotos = (atual, total) => setProgressoFotosCheck(total > 0 ? { atual, total } : null);
            if (editingCheckId) {
                salvo = await updateChecklist(editingCheckId, payload, onProgressoFotos);
                showToast('Checklist atualizado!', 'success');
            } else {
                payload.semana_ref = semana.toISOString().split('T')[0];
                salvo = await createChecklist(payload, onProgressoFotos);
                showToast('Checklist enviado!', 'success');
            }
            if (salvo?._fotosFalhas) {
                setTimeout(() => showToast(`Atenção: ${salvo._fotosFalhas} foto(s) não foram enviadas. Edite o checklist para tentar novamente.`, 'error'), 1400);
            }
            setModalCheck(false); setFormCheck(emptyCheck()); setEditingCheckId(null); load();
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
        finally { setSavingCheck(false); setProgressoFotosCheck(null); }
    };

const abrirEdicaoCheck = (c) => {
        setEditingCheckId(c.id);
        setFormCheck({
            veiculo_caminhao_id: c.veiculo_caminhao_id != null ? String(c.veiculo_caminhao_id) : '',
            odometro: c.odometro != null ? String(c.odometro) : '',
            itens: c.itens || {},
            problemas: c.problemas || '', necessidades: c.necessidades || '',
            observacoes_livres: c.observacoes_livres || '', foto_url: c.foto_url || '',
            fotos_urls: (c.fotos_urls && c.fotos_urls.length) ? c.fotos_urls : (c.foto_url ? [c.foto_url] : []),
        });
        setModalCheck(true);
    };

const excluirCheck = async (c) => {
        const ok = await confirm({
            title: 'Excluir checklist',
            message: `Excluir o checklist de ${c.veiculo?.placa || c.veiculo_caminhao_placa || 'veículo'}?`,
            confirmText: 'Excluir', variant: 'danger',
        });
        if (!ok) return;
        try {
            await deleteChecklist(c.id);
            showToast('Checklist excluído', 'success');
            load();
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };

    return { modalCheck, setModalCheck, editingCheckId, setEditingCheckId, emptyCheck, formCheck, setFormCheck, savingCheck, progressoFotosCheck, handleCheck, abrirEdicaoCheck, excluirCheck };
}
