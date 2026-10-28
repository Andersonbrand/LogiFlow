import { useState } from 'react';
import { parseParadas } from 'components';
import { updateCarregamento, createCarregamento, deleteCarregamento, marcarFreteCarregamentoPago, marcarFretesCarregamentoPagoEmMassa } from 'services/carretas';
import { parseTipo } from '../utils/helpers';

/** Estado e ações extraídos da tela — ver o componente que usa este hook. */
export function useCarregamentosTerceiro({ confirm, load, showToast }) {
// Modal carregamento terceiro
    const emptyFormTerceiro = () => ({
        data_carregamento: new Date().toISOString().slice(0, 10),
        quantidade: '', unidade_quantidade: 'saco',
        empresa_origem: '', destino: '', numero_pedido: '', numero_nota_fiscal: '', observacoes: '',
        tipo: '', motorista_id: '', veiculo_id: '', empresa_id: '',
        tipo_calculo_frete: 'por_saco', valor_base_frete: '',
    });
    const [modalTerceiro, setModalTerceiro] = useState(null);
    const [formTerceiro, setFormTerceiro] = useState(emptyFormTerceiro());
    const [paradasFormTerceiro, setParadasFormTerceiro] = useState([]); // cidades adicionais além do destino (terceiros)
    const [savingTerceiro, setSavingTerceiro] = useState(false);
    // ── Handlers carregamento terceiro ───────────────────────────────────────
    const openCreateTerceiro = () => { setFormTerceiro(emptyFormTerceiro()); setParadasFormTerceiro([]); setModalTerceiro({ mode: 'create' }); };
    const openEditTerceiro = r => {
        const { tipo, nome } = parseTipo(r);
        setFormTerceiro({
            tipo: tipo || '',
            data_carregamento: r.data_carregamento || new Date().toISOString().slice(0, 10),
            quantidade: r.quantidade || '',
            unidade_quantidade: r.unidade_quantidade || 'saco',
            empresa_origem: nome || '',
            numero_pedido: r.numero_pedido || '',
            numero_nota_fiscal: r.numero_nota_fiscal || '',
            destino: r.destino || '',
            observacoes: r.observacoes || '',
            motorista_id: r.motorista_id || '',
            veiculo_id: r.veiculo_id || '',
            empresa_id: r.empresa_id || '',
            tipo_calculo_frete: r.tipo_calculo_frete || 'por_saco',
            valor_base_frete: r.valor_base_frete || '',
        });
        setParadasFormTerceiro(parseParadas(r.paradas));
        setModalTerceiro({ mode: 'edit', id: r.id });
    };
    const handleSaveTerceiro = async () => {
        if (!formTerceiro.tipo) { showToast('Selecione o tipo de carregamento.', 'error'); return; }
        if (!formTerceiro.data_carregamento) { showToast('Informe a data.', 'error'); return; }
        if (!formTerceiro.quantidade || isNaN(formTerceiro.quantidade)) { showToast('Informe a quantidade.', 'error'); return; }
        // Terceiros: todos os campos do registro são obrigatórios (só Observações e Cidades adicionais são opcionais).
        if (!formTerceiro.empresa_origem) { showToast('Informe o fornecedor / origem.', 'error'); return; }
        if (!formTerceiro.motorista_id) { showToast('Selecione o motorista terceirizado.', 'error'); return; }
        if (!formTerceiro.veiculo_id) { showToast('Selecione a placa do veículo terceirizado.', 'error'); return; }
        if (!formTerceiro.empresa_id) { showToast('Selecione a empresa (frete).', 'error'); return; }
        if (!formTerceiro.tipo_calculo_frete) { showToast('Selecione o tipo de cálculo do frete.', 'error'); return; }
        if (formTerceiro.valor_base_frete === '' || formTerceiro.valor_base_frete == null || isNaN(formTerceiro.valor_base_frete)) { showToast('Informe o valor base do frete.', 'error'); return; }
        if (!formTerceiro.destino) { showToast('Informe o destino.', 'error'); return; }
        if (!String(formTerceiro.numero_pedido || '').trim()) { showToast('Informe o nº do pedido.', 'error'); return; }
        if (!String(formTerceiro.numero_nota_fiscal || '').trim()) { showToast('Informe a nota fiscal.', 'error'); return; }
        const empresaOrigem = formTerceiro.empresa_origem ? `${formTerceiro.tipo}|${formTerceiro.empresa_origem}` : formTerceiro.tipo;
        const payload = {
            empresa_origem: empresaOrigem,
            data_carregamento: formTerceiro.data_carregamento,
            quantidade: Number(formTerceiro.quantidade),
            unidade_quantidade: formTerceiro.unidade_quantidade || 'saco',
            numero_pedido: formTerceiro.numero_pedido || null,
            numero_nota_fiscal: formTerceiro.numero_nota_fiscal || null,
            destino: formTerceiro.destino || '',
            observacoes: formTerceiro.observacoes || null,
            is_terceiro: true,
            motorista_id: formTerceiro.motorista_id || null,
            empresa_id: formTerceiro.empresa_id || null,
            veiculo_id: formTerceiro.veiculo_id || null,
            tipo_calculo_frete: formTerceiro.tipo_calculo_frete || null,
            valor_base_frete: formTerceiro.valor_base_frete ? Number(formTerceiro.valor_base_frete) : null,
            _consumoVeiculo: null,
            paradas: paradasFormTerceiro.filter(p => p && p.trim()),
        };
        setSavingTerceiro(true);
        try {
            if (modalTerceiro.mode === 'edit') {
                await updateCarregamento(modalTerceiro.id, payload);
                showToast('Carregamento atualizado!', 'success');
            } else {
                await createCarregamento(payload);
                showToast('Carregamento de terceiro registrado!', 'success');
            }
            setModalTerceiro(null);
            load();
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
        finally { setSavingTerceiro(false); }
    };
    const handleDeleteTerceiro = async id => {
        const ok = await confirm({ title: 'Excluir carregamento?', message: 'Esta ação não pode ser desfeita.', confirmLabel: 'Excluir', variant: 'danger' });
        if (!ok) return;
        try { await deleteCarregamento(id); showToast('Excluído!', 'success'); load(); }
        catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };
    const handleTogglePagoTerceiro = async (row) => {
        const marcarComoPago = !row.frete_pago;
        if (marcarComoPago) {
            const ok = await confirm({
                title: 'Marcar frete como pago?',
                message: `Confirma o pagamento do frete de ${row.motorista?.name || 'terceiro'}?`,
                confirmLabel: 'Marcar como pago', variant: 'info',
            });
            if (!ok) return;
        }
        try {
            await marcarFreteCarregamentoPago(row.id, marcarComoPago);
            showToast(marcarComoPago ? 'Frete marcado como pago!' : 'Frete marcado como pendente.', 'success');
            load();
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };
    // Baixa em massa — dá baixa (ou desfaz) em vários fretes selecionados de
    // uma vez, sem precisar clicar linha por linha e esperar recarregar a cada vez.
    const handleTogglePagoEmMassaTerceiro = async (ids, pago = true) => {
        if (!ids || ids.length === 0) return;
        const ok = await confirm({
            title: pago ? `Marcar ${ids.length} frete(s) como pago(s)?` : `Desfazer pagamento de ${ids.length} frete(s)?`,
            message: pago
                ? `Confirma o pagamento de ${ids.length} frete(s) de terceiros selecionado(s)?`
                : `Isso vai marcar ${ids.length} frete(s) selecionado(s) de volta como pendente.`,
            confirmLabel: pago ? 'Marcar como pago' : 'Desfazer pagamento', variant: 'info',
        });
        if (!ok) return;
        try {
            const { sucesso } = await marcarFretesCarregamentoPagoEmMassa(ids, pago);
            showToast(`${sucesso} frete(s) ${pago ? 'marcado(s) como pago' : 'marcado(s) como pendente'}!`, 'success');
            load();
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };

    return { modalTerceiro, setModalTerceiro, formTerceiro, setFormTerceiro, paradasFormTerceiro, setParadasFormTerceiro, savingTerceiro, openCreateTerceiro, openEditTerceiro, handleSaveTerceiro, handleDeleteTerceiro, handleTogglePagoTerceiro, handleTogglePagoEmMassaTerceiro };
}
