import React from 'react';

import { DespesasPage } from 'components/Despesas';

import { despesasCaminhoesConfig } from './config';

// Despesas de Caminhões — a tela é o módulo compartilhado components/Despesas, alimentado pela configuração desta pasta.
export default function DespesasCaminhoes() {
    return <DespesasPage config={despesasCaminhoesConfig} />;
}
