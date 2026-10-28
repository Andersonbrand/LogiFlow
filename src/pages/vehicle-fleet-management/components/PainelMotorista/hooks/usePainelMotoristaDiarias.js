import { useState, useMemo } from 'react';
import { assinarDiariaRomaneio, desassinarDiariaRomaneio, deleteRomaneio } from 'services/romaneio';
import { assinarDiaria, desassinarDiaria, createDiaria, updateDiaria, deleteDiaria } from 'services/carretas';

/** Estado e ações extraídos da tela — ver o componente que usa este hook. */
export function usePainelMotoristaDiarias({ adminProfile, confirm, load, mes, motorista, periodoCustom, setDiarias, setMes, setRomaneiosDiarias, setUsarPeriodo, showToast, usarPeriodo }) {
const [modalDiaria, setModalDiaria] = useState(null);

const [viewDiaria, setViewDiaria] = useState(null);

const [assinando, setAssinando] = useState(false);

const canSign = adminProfile?.role === 'admin' || adminProfile?.role === 'operador';

// Assina a diária em exibição no setor do usuário logado (operador -> logística,
    // admin -> transporte). Cobre tanto diárias avulsas (carretas_diarias) quanto
    // as geradas por romaneio. Cada setor assina de forma independente.
    const meuCampoAssinatura = adminProfile?.role === 'admin' ? 'transporte' : adminProfile?.role === 'operador' ? 'logistica' : null;

const handleAssinarDiaria = async () => {
        if (!viewDiaria || !canSign || !adminProfile?.assinatura_digital || !meuCampoAssinatura) return;
        setAssinando(true);
        try {
            const texto = adminProfile.assinatura_digital;
            const campo = meuCampoAssinatura;
            if (viewDiaria._romaneioId) {
                await assinarDiariaRomaneio(viewDiaria._romaneioId, campo, texto, adminProfile.id);
                setRomaneiosDiarias(rs => rs.map(r => r.id === viewDiaria._romaneioId
                    ? { ...r, [`assinatura_diaria_${campo}`]: texto, [`assinatura_diaria_${campo}_at`]: new Date().toISOString() } : r));
            } else if (viewDiaria.id) {
                await assinarDiaria(viewDiaria.id, campo, texto, adminProfile.id);
                setDiarias(ds => ds.map(d => d.id === viewDiaria.id
                    ? { ...d, [`assinatura_${campo}`]: texto, [`assinatura_${campo}_at`]: new Date().toISOString() } : d));
            }
            setViewDiaria(v => ({ ...v, [`assinatura_${campo}`]: texto, [`assinatura_${campo}_at`]: new Date().toISOString() }));
            showToast('Diária assinada digitalmente!', 'success');
        } catch (e) { showToast('Erro ao assinar: ' + e.message, 'error'); }
        finally { setAssinando(false); }
    };

// Remove a assinatura de um setor específico (ação reservada a administradores na UI).
    const isAdminUser = adminProfile?.role === 'admin';

const handleDesassinarDiaria = async (campo) => {
        if (!viewDiaria || !isAdminUser || !campo) return;
        setAssinando(true);
        try {
            if (viewDiaria._romaneioId) {
                await desassinarDiariaRomaneio(viewDiaria._romaneioId, campo);
                setRomaneiosDiarias(rs => rs.map(r => r.id === viewDiaria._romaneioId
                    ? { ...r, [`assinatura_diaria_${campo}`]: null, [`assinatura_diaria_${campo}_at`]: null } : r));
            } else if (viewDiaria.id) {
                await desassinarDiaria(viewDiaria.id, campo);
                setDiarias(ds => ds.map(d => d.id === viewDiaria.id
                    ? { ...d, [`assinatura_${campo}`]: null, [`assinatura_${campo}_at`]: null } : d));
            }
            setViewDiaria(v => ({ ...v, [`assinatura_${campo}`]: null, [`assinatura_${campo}_at`]: null }));
            showToast('Assinatura removida.', 'success');
        } catch (e) { showToast('Erro ao remover assinatura: ' + e.message, 'error'); }
        finally { setAssinando(false); }
    };

const [formDiaria, setFormDiaria] = useState({
        data_inicio: new Date().toISOString().split('T')[0],
        quantidade_dias: '1', valor_dia: '', placa: '', descricao: '',
    });

const previewDiaria = useMemo(() => Number(formDiaria.quantidade_dias||0) * Number(formDiaria.valor_dia||0), [formDiaria]);

// Diárias handlers
    const handleSaveDiaria = async () => {
        if (!formDiaria.valor_dia || !formDiaria.data_inicio) {
            showToast('Data e valor/dia são obrigatórios', 'error'); return;
        }
        try {
            const payload = { ...formDiaria, motorista_id: motorista.id };
            if (modalDiaria.mode === 'create') await createDiaria(payload);
            else await updateDiaria(modalDiaria.data.id, payload);
            setModalDiaria(null);

            // A diária foi gravada com sucesso. Se a data dela cair fora do
            // período atualmente filtrado (ex: usuário revisando um mês
            // anterior e a data padrão do formulário é "hoje"), o load()
            // não vai trazê-la de volta e ela parece ter "sumido" mesmo
            // tendo sido salva. Nesse caso, ajusta o filtro para o mês da
            // diária recém-salva antes de recarregar, para ela aparecer.
            const dataSalva = formDiaria.data_inicio;
            const dentroDoIntervaloAtual = usarPeriodo
                ? (!periodoCustom.inicio || dataSalva >= periodoCustom.inicio) && (!periodoCustom.fim || dataSalva <= periodoCustom.fim)
                : dataSalva.slice(0, 7) === mes;

            if (!dentroDoIntervaloAtual) {
                setUsarPeriodo(false);
                setMes(dataSalva.slice(0, 7));
                showToast(`Diária salva! Exibindo ${dataSalva.slice(0, 7).split('-').reverse().join('/')} para mostrá-la.`, 'success');
            } else {
                showToast('Diária salva!', 'success');
                load();
            }
        } catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };

const handleDeleteDiaria = async (id) => {
        const ok = await confirm({ title: 'Excluir diária?', message: 'Esta ação não pode ser desfeita.', confirmLabel: 'Excluir', variant: 'danger' });
        if (!ok) return;
        try { await deleteDiaria(id); showToast('Excluída!', 'success'); load(); }
        catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };

const handleDeleteRomaneio = async (id) => {
        const ok = await confirm({ title: 'Excluir romaneio?', message: 'O romaneio e todos os seus dados serão removidos permanentemente da tela do motorista.', confirmLabel: 'Excluir', variant: 'danger' });
        if (!ok) return;
        try { await deleteRomaneio(id); showToast('Romaneio excluído.', 'success'); load(); }
        catch (e) { showToast('Erro: ' + e.message, 'error'); }
    };

const openCreateDiaria = () => {
        // Usa a data de hoje como padrão apenas se ela cair dentro do
        // período/mês que está sendo exibido no momento; caso contrário,
        // parte do início do período filtrado — evita que a diária seja
        // salva "fora da tela" e pareça não ter sido gravada.
        const hoje = new Date().toISOString().split('T')[0];
        const hojeDentroDoIntervalo = usarPeriodo
            ? (!periodoCustom.inicio || hoje >= periodoCustom.inicio) && (!periodoCustom.fim || hoje <= periodoCustom.fim)
            : hoje.slice(0, 7) === mes;
        const dataPadrao = hojeDentroDoIntervalo ? hoje : (usarPeriodo ? (periodoCustom.inicio || hoje) : mes + '-01');
        setFormDiaria({ data_inicio: dataPadrao, quantidade_dias: '1', valor_dia: '', placa: '', descricao: '' });
        setModalDiaria({ mode: 'create' });
    };

const openEditDiaria = (d) => {
        setFormDiaria({ data_inicio: d.data_inicio, quantidade_dias: d.quantidade_dias, valor_dia: d.valor_dia, placa: d.placa || '', descricao: d.descricao || '' });
        setModalDiaria({ mode: 'edit', data: d });
    };

    return { modalDiaria, setModalDiaria, viewDiaria, setViewDiaria, assinando, canSign, meuCampoAssinatura, handleAssinarDiaria, isAdminUser, handleDesassinarDiaria, formDiaria, setFormDiaria, previewDiaria, handleSaveDiaria, handleDeleteDiaria, handleDeleteRomaneio, openCreateDiaria, openEditDiaria };
}
