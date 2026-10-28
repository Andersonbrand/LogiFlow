import React from 'react';

import { DespesasPage } from 'components/Despesas';

import { despesasAdmConfig } from './config';

// Despesas Administrativas (Transporte) — a tela é o módulo compartilhado components/Despesas, alimentado pela configuração desta pasta.
export default function DespesasAdmTransporte() {
    return <DespesasPage config={despesasAdmConfig} />;
}
