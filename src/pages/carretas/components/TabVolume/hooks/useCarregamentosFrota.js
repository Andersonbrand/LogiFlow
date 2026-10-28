import { useState } from 'react';
import { parseParadas } from 'components';
import { calcularFrete, updateCarregamento, createCarregamento, deleteCarregamento } from 'services/carretas';
import { useCaptacaoConfig } from 'services/settingsService';
import { parseTipo, buscarFretePorDestino } from '../utils/helpers';

/** Estado e ações extraídos da tela — ver o componente que usa este hook. */
export function useCarregamentosFrota({ confirm, fretesEstoque, load, showToast, veiculos }) {
// Modal carregamento
    const emptyForm = () => ({
        tipo: '', data_carregamento: new Date().toISOString().slice(0, 10),
        quantidade: '', unidade_quantidade: 'saco', empresa_origem: '',
        veiculo_id: '', motorista_id: '', empresa_id: '', numero_pedido: '', numero_nota_fiscal: '',
        destino: '', observacoes: '', tipo_cimento: '',
        tipo_calculo_frete: 'por_saco', valor_base_frete: '',
        origem_frota: 'carreta', // 'carreta' | 'caminhao' — carregamento avulso feito por um caminhão da frota
        placa_caminhao_avulso: '', // texto livre (não referencia carretas_veiculos) — só usado quando origem_frota='caminhao'
    });
    const [modal, setModal] = useState(null); // null | { mode: 'create'|'edit', id?: string }
    const [form, setForm] = useState(emptyForm());
    const [paradasForm, setParadasForm] = useState([]); // cidades adicionais além do destino (frota própria)
    const [saving, setSaving] = useState(false);

    // Frete preview
    const veiculoSelecionado = veiculos.find(v => v.id === form.veiculo_id);
    // Carregamento no ESTOQUE: o frete por saco vem SEMPRE da tabela "Frete Estoque" (pelo destino),
    // não depende de o usuário ter clicado na cidade na lista — vale também ao editar e ao digitar.
    const freteEstoqueRef = form.tipo === 'ESTOQUE' ? buscarFretePorDestino(form.destino, fretesEstoque) : null;
    const valorBaseEstoque = freteEstoqueRef ? Number(freteEstoqueRef.frete_por_saco) : Number(form.valor_base_frete || 0);
    const previewFrete = calcularFrete(form.tipo_calculo_frete, form.quantidade, form.valor_base_frete, veiculoSelecionado?.media_consumo);
    // Captação (MOC → Estoque) x Distribuição — apenas informativo, frota própria
    const { captacaoConfig } = useCaptacaoConfig();
    const previewCaptacaoTotal = form.tipo === 'ESTOQUE' ? 0 : Number(captacaoConfig.valorPorSaco || 0) * Number(form.quantidade || 0);
    const previewDistribuicao = Math.max(0, previewFrete - previewCaptacaoTotal);
    const previewPctDistribuicao = previewFrete > 0 ? (previewDistribuicao / previewFrete) * 100 : 0;

    // ── Handlers carregamento ─────────────────────────────────────────────────
    const openCreate = () => { setForm(emptyForm()); setParadasForm([]); setModal({ mode: 'create' }); };
    const openEdit = r => {
        const { tipo, nome } = parseTipo(r);
        const isCaminhaoAvulso = !r.veiculo_id && !!r.placa_terceiro;
        setForm({
            tipo: tipo || '',
            data_carregamento: r.data_carregamento || new Date().toISOString().slice(0, 10),
            quantidade: r.quantidade || '',
            unidade_quantidade: r.unidade_quantidade || 'saco',
            empresa_origem: nome || '',
            empresa_id: r.empresa_id || '',
            veiculo_id: r.veiculo_id || '',
            motorista_id: r.motorista_id || '',
            numero_pedido: r.numero_pedido || '',
            numero_nota_fiscal: r.numero_nota_fiscal || '',
            destino: r.destino || '',
            observacoes: r.observacoes || '',
            tipo_cimento: r.tipo_cimento || '',
            tipo_calculo_frete: r.tipo_calculo_frete || 'por_saco',
            valor_base_frete: r.valor_base_frete || '',
            origem_frota: isCaminhaoAvulso ? 'caminhao' : 'carreta',
            placa_caminhao_avulso: isCaminhaoAvulso ? (r.placa_terceiro || '') : '',
        });
        setParadasForm(parseParadas(r.paradas));
        setModal({ mode: 'edit', id: r.id });
    };

    const handleSave = async () => {
        const isEstoque = form.tipo === 'ESTOQUE';
        const isCaminhaoAvulsoCheck = form.origem_frota === 'caminhao' && !isEstoque;
        if (!form.tipo) { showToast('Selecione o tipo de carregamento.', 'error'); return; }
        if (!form.data_carregamento) { showToast('Informe a data.', 'error'); return; }
        // Carregamento no Estoque dispensa quantidade/frete/fornecedor, mas exige
        // destino, placa, motorista e tipo de cimento. Motorista é obrigatório aqui
        // porque o cálculo de bônus (calcularBonusCarreteiro, igual à aba
        // Bonificações) só considera carregamentos com motorista_id preenchido.
        // Por gerar bônus, o Estoque sempre usa veículo/motorista da frota de
        // carretas — a opção "caminhão avulso" (sem bônus) não se aplica aqui.
        if (isEstoque) {
            if (!form.destino) { showToast('Informe o destino.', 'error'); return; }
            if (!form.veiculo_id) { showToast('Selecione o veículo (placa).', 'error'); return; }
            if (!form.motorista_id) { showToast('Selecione o motorista (necessário para gerar o bônus da viagem).', 'error'); return; }
            if (!form.tipo_cimento) { showToast('Selecione o tipo de cimento.', 'error'); return; }
            if (modal?.mode !== 'edit' && (!form.quantidade || isNaN(form.quantidade))) { showToast('Informe a quantidade de sacos (necessária para calcular o frete).', 'error'); return; }
        } else if (!form.quantidade || isNaN(form.quantidade)) {
            showToast('Informe a quantidade.', 'error'); return;
        } else {
            // Frota (não-Estoque): todos os campos do registro são obrigatórios
            // (só Observações e Cidades adicionais continuam opcionais).
            if (!form.empresa_origem) { showToast('Informe o fornecedor / origem.', 'error'); return; }
            if (isCaminhaoAvulsoCheck) {
                if (!form.placa_caminhao_avulso.trim()) { showToast('Informe a placa do caminhão.', 'error'); return; }
            } else if (!form.veiculo_id) { showToast('Selecione o veículo (placa).', 'error'); return; }
            if (!form.motorista_id) { showToast('Selecione o motorista.', 'error'); return; }
            if (!String(form.numero_pedido || '').trim()) { showToast('Informe o nº do pedido.', 'error'); return; }
            if (!String(form.numero_nota_fiscal || '').trim()) { showToast('Informe a nota fiscal.', 'error'); return; }
            if (!form.destino) { showToast('Informe o destino.', 'error'); return; }
            if (!form.empresa_id) { showToast('Selecione a empresa (frete).', 'error'); return; }
            if (!form.tipo_calculo_frete) { showToast('Selecione o tipo de cálculo do frete.', 'error'); return; }
            if (form.valor_base_frete === '' || form.valor_base_frete == null || isNaN(form.valor_base_frete)) { showToast('Informe o valor base do frete.', 'error'); return; }
        }

        const empresaOrigem = isEstoque
            ? 'ESTOQUE'
            : (form.empresa_origem ? `${form.tipo}|${form.empresa_origem}` : form.tipo);
        const isCaminhaoAvulso = isCaminhaoAvulsoCheck;
        const payload = {
            empresa_origem: empresaOrigem,
            data_carregamento: form.data_carregamento,
            quantidade: isEstoque ? (form.quantidade ? Number(form.quantidade) : null) : Number(form.quantidade),
            unidade_quantidade: form.unidade_quantidade || 'saco',
            empresa_id: isEstoque ? null : (form.empresa_id || null),
            tipo_calculo_frete: isEstoque ? 'por_saco' : (form.tipo_calculo_frete || 'por_saco'),
            valor_base_frete: isEstoque
                ? (valorBaseEstoque > 0 ? valorBaseEstoque : null)
                : (form.valor_base_frete ? Number(form.valor_base_frete) : null),
            _consumoVeiculo: veiculoSelecionado?.media_consumo,
            // Carregamento avulso de caminhão (fora da frota de carretas): não
            // referencia carretas_veiculos (evita conflito de FK entre tabelas
            // diferentes) — a placa fica só como texto informativo. O motorista
            // continua vinculado normalmente (user_profiles é compartilhado
            // entre motoristas de carreta e de caminhão), então ele aparece no
            // volume de sacos do período — só não entra no cálculo de bônus de
            // carreteiro, que é calculado por outra lógica separada.
            veiculo_id: isCaminhaoAvulso ? null : (form.veiculo_id || null),
            placa_terceiro: isCaminhaoAvulso ? (form.placa_caminhao_avulso || null) : null,
            motorista_id: form.motorista_id || null,
            numero_pedido: isEstoque ? null : (form.numero_pedido || null),
            numero_nota_fiscal: isEstoque ? null : (form.numero_nota_fiscal || null),
            destino: form.destino || '',
            observacoes: form.observacoes || null,
            tipo_cimento: isEstoque ? form.tipo_cimento : null,
            paradas: paradasForm.filter(p => p && p.trim()),
        };

        setSaving(true);
        try {
            if (modal.mode === 'edit') {
                await updateCarregamento(modal.id, payload);
                showToast('Carregamento atualizado!', 'success');
            } else {
                await createCarregamento(payload);
                showToast('Carregamento registrado!', 'success');
            }
            setModal(null);
            load();
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
        finally { setSaving(false); }
    };

    const handleDelete = async id => {
        const ok = await confirm({ title: 'Excluir carregamento?', message: 'Esta ação não pode ser desfeita.', confirmLabel: 'Excluir', variant: 'danger' });
        if (!ok) return;
        try { await deleteCarregamento(id); showToast('Excluído!', 'success'); load(); }
        catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };

    return { modal, setModal, form, setForm, paradasForm, setParadasForm, saving, veiculoSelecionado, freteEstoqueRef, valorBaseEstoque, previewFrete, captacaoConfig, previewCaptacaoTotal, previewDistribuicao, previewPctDistribuicao, openCreate, openEdit, handleSave, handleDelete };
}
