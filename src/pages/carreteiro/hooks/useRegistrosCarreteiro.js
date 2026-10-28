import { useState } from 'react';
import { parseParadas } from 'components';
import { deleteRegistroViagem } from 'services/carretas';

/** Estado e ações extraídos da tela — ver o componente que usa este hook. */
export function useRegistrosCarreteiro({ confirm, load, showToast }) {
const [modalRegistro, setModalRegistro] = useState(false);

const [editandoRegistroId, setEditandoRegistroId] = useState(null);

const [salvandoRegistro, setSalvandoRegistro] = useState(false);

const emptyRegistro = () => ({
        data_carregamento: new Date().toISOString().split('T')[0],
        numero_nota_fiscal: '', veiculo_id: '', destino: '', data_descarga: '', observacoes: '',
        local_carregamento: '', // '' = viagem normal (fábrica) | 'Estoque' = carregamento no estoque
        tipo_cimento: '',       // só usado quando local_carregamento === 'Estoque': 'Montes Claros' | 'Liz' | 'Ambas'
    });

const [formRegistro, setFormRegistro] = useState(emptyRegistro());

const [paradasRegistro, setParadasRegistro] = useState([]);

const handleDeleteRegistro = async (id) => {
        const ok = await confirm({ title: 'Excluir registro de viagem?', message: 'Esta ação não pode ser desfeita.', confirmLabel: 'Excluir', variant: 'danger' });
        if (!ok) return;
        try { await deleteRegistroViagem(id); showToast('Registro excluído.', 'success'); load(); }
        catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };

const handleEditRegistro = (r) => {
        setEditandoRegistroId(r.id);
        setFormRegistro({
            data_carregamento: r.data_carregamento || new Date().toISOString().split('T')[0],
            numero_nota_fiscal: r.numero_nota_fiscal || '',
            veiculo_id: r.veiculo_id || '',
            destino: r.destino || '',
            data_descarga: r.data_descarga || '',
            observacoes: r.observacoes || '',
            local_carregamento: r.local_carregamento || '',
            tipo_cimento: r.tipo_cimento || '',
        });
        setParadasRegistro(parseParadas(r.paradas));
        setModalRegistro(true);
    };

    return { modalRegistro, setModalRegistro, editandoRegistroId, setEditandoRegistroId, salvandoRegistro, setSalvandoRegistro, emptyRegistro, formRegistro, setFormRegistro, paradasRegistro, setParadasRegistro, handleDeleteRegistro, handleEditRegistro };
}
