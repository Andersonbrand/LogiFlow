import { useState } from 'react';

/** Estado e ações extraídos da tela — ver o componente que usa este hook. */
export function useFerragemCarreteiro({  }) {
// Modal romaneio de ferragens (registrado pelo motorista)
    const [modalFerragem, setModalFerragem] = useState(false);

const [editandoFerragemId, setEditandoFerragemId] = useState(null);

// null = criar, string = editar
    const [formFerragem, setFormFerragem] = useState({
        numero_romaneio: '', numero_nf: '', veiculo_id: '',
        data_saida: new Date().toISOString().split('T')[0],
        destino: '', toneladas: '', empresa: '', observacoes: '',
    });

// ROMs do admin para vincular
    const [paradasFerragem, setParadasFerragem] = useState([]);

// cidades adicionais além do destino
    const [salvandoFerragem, setSalvandoFerragem] = useState(false);

    return { modalFerragem, setModalFerragem, editandoFerragemId, setEditandoFerragemId, formFerragem, setFormFerragem, paradasFerragem, setParadasFerragem, salvandoFerragem, setSalvandoFerragem };
}
