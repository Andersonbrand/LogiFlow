import { useState } from 'react';
import { updateCarregamento, createCarregamento, deleteCarregamento } from 'services/carretas';
import { parseTipo } from '../utils/helpers';

/** Estado e ações extraídos da tela — ver o componente que usa este hook. */
export function useCarregamentosRetira({ confirm, load, showToast }) {
// Modal retira
    const emptyFormRetira = () => ({
        data_carregamento: new Date().toISOString().slice(0, 10),
        quantidade: '', empresa_origem: '', numero_pedido: '', numero_nota_fiscal: '',
        pedido_venda: '', motorista_id: '', veiculo_id: '', observacoes: '', tipo: '',
        destino: 'Fábrica', nome_cliente: '', // Retira sempre ocorre na fábrica
    });
    const [modalRetira, setModalRetira] = useState(null);
    const [formRetira, setFormRetira] = useState(emptyFormRetira());
    const [savingRetira, setSavingRetira] = useState(false);

    // ── Handlers retira ───────────────────────────────────────────────────────
    const openCreateRetira = () => { setFormRetira(emptyFormRetira()); setModalRetira({ mode: 'create' }); };
    const openEditRetira = r => {
        const { tipo, nome } = parseTipo(r);
        setFormRetira({
            tipo: tipo || '',
            data_carregamento: r.data_carregamento || new Date().toISOString().slice(0, 10),
            quantidade: r.quantidade || '',
            nome_cliente: r.nome_cliente || '',
            empresa_origem: nome || '',
            numero_pedido: r.numero_pedido || '',
            numero_nota_fiscal: r.numero_nota_fiscal || '',
            pedido_venda: r.pedido_venda || '',
            motorista_id: r.motorista_id || '',
            veiculo_id: r.veiculo_id || '',
            observacoes: r.observacoes || '',
            destino: r.destino || 'Fábrica',
        });
        setModalRetira({ mode: 'edit', id: r.id });
    };
    const handleSaveRetira = async () => {
        if (!formRetira.data_carregamento) { showToast('Informe a data.', 'error'); return; }
        if (!formRetira.quantidade || isNaN(formRetira.quantidade)) { showToast('Informe a quantidade.', 'error'); return; }
        if (!formRetira.tipo) { showToast('Selecione o tipo de carregamento (FOB/CIF).', 'error'); return; }
        // Retira (clientes): todos os campos do registro são obrigatórios (só Observações é opcional).
        if (!formRetira.empresa_origem) { showToast('Informe o cliente / origem.', 'error'); return; }
        if (!formRetira.veiculo_id) { showToast('Selecione o veículo terceirizado.', 'error'); return; }
        if (!String(formRetira.nome_cliente || '').trim()) { showToast('Informe o nome do cliente.', 'error'); return; }
        if (!String(formRetira.numero_nota_fiscal || '').trim()) { showToast('Informe a nota fiscal.', 'error'); return; }
        if (!String(formRetira.numero_pedido || '').trim()) { showToast('Informe o nº do pedido.', 'error'); return; }
        const empresaOrigem = formRetira.empresa_origem ? `${formRetira.tipo}|${formRetira.empresa_origem}` : formRetira.tipo;
        const payload = {
            empresa_origem: empresaOrigem,
            data_carregamento: formRetira.data_carregamento,
            quantidade: Number(formRetira.quantidade),
            unidade_quantidade: 'saco',
            destino: formRetira.destino || 'Fábrica', // Retira: destino padrão = Fábrica
            numero_pedido: formRetira.numero_pedido || null,
            numero_nota_fiscal: formRetira.numero_nota_fiscal || null,
            pedido_venda: formRetira.pedido_venda || null,
            nome_cliente: formRetira.nome_cliente || null,
            motorista_id: formRetira.motorista_id || null,
            veiculo_id: formRetira.veiculo_id || null,
            observacoes: formRetira.observacoes || null,
            is_retira: true,
            is_terceiro: false,
            empresa_id: null,
            tipo_calculo_frete: null,
            valor_base_frete: null,
            _consumoVeiculo: null,
        };
        setSavingRetira(true);
        try {
            if (modalRetira.mode === 'edit') {
                await updateCarregamento(modalRetira.id, payload);
                showToast('Retira atualizada!', 'success');
            } else {
                await createCarregamento(payload);
                showToast('Retira registrada!', 'success');
            }
            setModalRetira(null);
            load();
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
        finally { setSavingRetira(false); }
    };
    const handleDeleteRetira = async id => {
        const ok = await confirm({ title: 'Excluir retira?', message: 'Esta ação não pode ser desfeita.', confirmLabel: 'Excluir', variant: 'danger' });
        if (!ok) return;
        try { await deleteCarregamento(id); showToast('Excluído!', 'success'); load(); }
        catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };

    return { modalRetira, setModalRetira, formRetira, setFormRetira, savingRetira, openCreateRetira, openEditRetira, handleSaveRetira, handleDeleteRetira };
}
