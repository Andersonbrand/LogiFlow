import { useState } from 'react';
import { deletePontoParada } from 'services/carretas';

/** Estado e ações extraídos da tela — ver o componente que usa este hook. */
export function usePontosCarreteiro({ confirm, load, showToast }) {
// cidades adicionais além do destino, quando a viagem passa por mais de uma
    const [modalPonto, setModalPonto] = useState(false);

const [pontoDetalhe, setPontoDetalhe] = useState(null);

// resumo mobile → abre modal com todos os dados do registro
    const [editandoPontoId, setEditandoPontoId] = useState(null);

const [formPonto, setFormPonto] = useState({
        tipo_local: 'Fábrica', local: '', veiculo_id: '',
        data_saida: new Date().toISOString().split('T')[0], horario_saida: '', km_saida: '',
        tipo_local_chegada: 'Fábrica', local_chegada: '',
        data_chegada: '', horario_chegada: '', km_chegada: '',
        cupom_fiscal: '', observacoes: '',
        horarios_extras: [],
    });

const abrirEditarPonto = (p) => {
        setEditandoPontoId(p.id);
        setFormPonto({
            tipo_local: p.tipo_local || 'Fábrica', local: p.local || '',
            veiculo_id: p.veiculo_id || '',
            data_saida: p.data_saida || '',
            horario_saida: p.horario_saida || '', km_saida: p.km_saida ?? '',
            tipo_local_chegada: p.tipo_local_chegada || 'Fábrica', local_chegada: p.local_chegada || '',
            data_chegada: p.data_chegada || '',
            horario_chegada: p.horario_chegada || '', km_chegada: p.km_chegada ?? '',
            cupom_fiscal: p.cupom_fiscal || '', observacoes: p.observacoes || '',
            horarios_extras: p.horarios_extras || [],
        });
        setModalPonto(true);
    };

const excluirPonto = async (p) => {
        const ok = await confirm({ title: 'Excluir registro?', message: 'Esta ação não pode ser desfeita.', confirmLabel: 'Excluir', variant: 'danger' });
        if (!ok) return;
        try { await deletePontoParada(p.id); showToast('Registro excluído.', 'success'); setPontoDetalhe(null); load(); }
        catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };

    return { modalPonto, setModalPonto, pontoDetalhe, setPontoDetalhe, editandoPontoId, setEditandoPontoId, formPonto, setFormPonto, abrirEditarPonto, excluirPonto };
}
