// ────────────────────────────────────────────────────────────────────────────
// Componente de gerenciamento de motoristas
// ────────────────────────────────────────────────────────────────────────────
export const CNH_CATEGORIAS = ['A', 'B', 'AB', 'C', 'D', 'E', 'ACC'];

export const DRIVER_ROLES = [
    { value: 'motorista',         label: 'Motorista (Caminhão)' },
    { value: 'motorista_carreta', label: 'Motorista (Carreta)'  },
    { value: 'mecanico',          label: 'Mecânico'             },
];

export const FORM_VAZIO = {
    nome: '', email: '', senha: '', role: 'motorista',
    cnhNumero: '', cnhCategoria: 'C', cnhVencimento: '', dataNascimento: '',
    is_terceiro: false,
};
