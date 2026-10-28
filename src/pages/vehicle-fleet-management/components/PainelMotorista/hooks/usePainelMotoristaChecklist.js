import { useState } from 'react';
import { deleteChecklist, updateChecklist } from 'services/carretas';

/** Estado e ações extraídos da tela — ver o componente que usa este hook. */
export function usePainelMotoristaChecklist({ confirm, load, showToast, veiculosCaminhao }) {
const [modalFoto, setModalFoto]   = useState(null);

// { fotos: string[], index: number } | null
    const [expandidosChecklist, setExpandidosChecklist] = useState(() => new Set());

const toggleExpandidoChecklist = (id) => {
        setExpandidosChecklist(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

const [modalEditChecklist, setModalEditChecklist] = useState(null);

// id do checklist sendo editado
    const [formEditChecklist, setFormEditChecklist] = useState(null);

const [savingEditChecklist, setSavingEditChecklist] = useState(false);

const handleDeleteChecklist = async (id) => {
        const ok = await confirm({ title: 'Excluir checklist?', message: 'O checklist será removido permanentemente da tela do motorista.', confirmLabel: 'Excluir', variant: 'danger' });
        if (!ok) return;
        try { await deleteChecklist(id); showToast('Checklist excluído.', 'success'); load(); }
        catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };

const openEditChecklist = (c) => {
        setFormEditChecklist({
            veiculo_caminhao_id: c.veiculo_caminhao_id != null ? String(c.veiculo_caminhao_id) : '',
            odometro: c.odometro ?? '',
            itens: c.itens || {},
            problemas: c.problemas || '',
            necessidades: c.necessidades || '',
            observacoes_livres: c.observacoes_livres || '',
            fotos_urls: c.fotos_urls || (c.foto_url ? [c.foto_url] : []),
        });
        setModalEditChecklist(c.id);
    };

const handleSalvarEditChecklist = async () => {
        if (!formEditChecklist.veiculo_caminhao_id) { showToast('Selecione o veículo', 'error'); return; }
        if (formEditChecklist.odometro === '' || formEditChecklist.odometro == null) { showToast('Informe o odômetro', 'error'); return; }
        setSavingEditChecklist(true);
        try {
            const caminhao = veiculosCaminhao.find(v => String(v.id) === String(formEditChecklist.veiculo_caminhao_id));
            await updateChecklist(modalEditChecklist, {
                veiculo_caminhao_id: formEditChecklist.veiculo_caminhao_id,
                veiculo_caminhao_placa: caminhao?.placa || null,
                odometro: Number(formEditChecklist.odometro),
                itens: formEditChecklist.itens,
                problemas: formEditChecklist.problemas,
                necessidades: formEditChecklist.necessidades,
                observacoes_livres: formEditChecklist.observacoes_livres,
                fotos_urls: formEditChecklist.fotos_urls,
            });
            showToast('Checklist atualizado!', 'success');
            setModalEditChecklist(null); setFormEditChecklist(null); load();
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
        finally { setSavingEditChecklist(false); }
    };

    return { modalFoto, setModalFoto, expandidosChecklist, toggleExpandidoChecklist, modalEditChecklist, setModalEditChecklist, formEditChecklist, setFormEditChecklist, savingEditChecklist, handleDeleteChecklist, openEditChecklist, handleSalvarEditChecklist };
}
