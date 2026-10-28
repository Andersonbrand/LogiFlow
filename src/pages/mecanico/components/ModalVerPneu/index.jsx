import React from 'react';

import { AppIcon as Icon } from 'components';

import ModalOverlay from '../ModalOverlay';

// Modal somente-leitura com todos os dados de um registro de pneu — pra
// consultar rapidamente sem precisar entrar no modo de edição.
export default function ModalVerPneu({ p, onClose }) {
    if (!p) return null;
    const linha = (label, valor) => (
        <div className="flex items-center justify-between gap-3 py-1.5">
            <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>{label}</span>
            <span className="text-xs font-medium text-right" style={{ color: 'var(--color-text-primary)' }}>{valor || '—'}</span>
        </div>
    );
    return (
        <ModalOverlay onClose={onClose}>
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
                <div className="flex items-center gap-2">
                    <Icon name="Eye" size={18} color="var(--color-primary)" />
                    <h3 className="font-bold text-base" style={{ color: 'var(--color-text-primary)' }}>Detalhes do Registro</h3>
                </div>
                <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
                    <Icon name="X" size={16} color="var(--color-muted-foreground)" />
                </button>
            </div>
            <div className="p-5 divide-y" style={{ borderColor: 'var(--color-border)' }}>
                {linha('Nº do registro', p.numero_sequencial)}
                {linha('Veículo / Placa', p.veiculo?.placa || p.veiculo_caminhao_placa)}
                {linha('Eixo / Posição', p.eixo_trocado)}
                {linha('Tipo do pneu', p.tipo_pneu === 'recapado' ? 'Recapado' : 'Novo')}
                {linha('Marca', p.marca)}
                {linha('Medida', p.medida)}
                {linha('Bandagem', p.categoria_bandagem)}
                {linha('Motorista que solicitou', p.motorista?.name)}
                {linha('Km do veículo no momento', p.km_atual != null ? Number(p.km_atual).toLocaleString('pt-BR') : null)}
                {linha('Data da instalação', p.data_instalacao ? new Date(p.data_instalacao + 'T00:00:00').toLocaleDateString('pt-BR') : null)}
                {linha('Observações', p.observacoes)}
            </div>
            <div className="flex justify-end px-5 py-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
                <button onClick={onClose} className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50" style={{ borderColor: 'var(--color-border)' }}>Fechar</button>
            </div>
        </ModalOverlay>
    );
}
