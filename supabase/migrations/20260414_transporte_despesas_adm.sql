-- Tabela: Despesas Administrativas do Transporte
create table if not exists public.transporte_despesas_adm (
    id                  uuid primary key default gen_random_uuid(),
    categoria           text not null,
    descricao           text,
    valor               numeric(12,2) not null default 0,
    data_despesa        date not null,
    nota_fiscal         text,
    fornecedor          text,
    empresa             text,
    observacoes         text,
    notas_fiscais       jsonb default '[]'::jsonb,
    nf_itens            jsonb default '[]'::jsonb,
    forma_pagamento     text not null default 'a_vista',
    tipo_pagamento      text not null default 'pix',
    comprovante_url     text,
    boletos             jsonb default '[]'::jsonb,
    parcelas_cartao     jsonb default '[]'::jsonb,
    cheques             jsonb default '[]'::jsonb,
    permuta_obs         text,
    permuta_doc_url     text,
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now()
);

alter table public.transporte_despesas_adm enable row level security;

create policy "Staff pode ver despesas adm transporte"
    on public.transporte_despesas_adm for select
    using (
        exists (
            select 1 from public.user_profiles
            where id = auth.uid()
            and role in ('admin', 'operador')
        )
    );

create policy "Admin pode inserir despesas adm transporte"
    on public.transporte_despesas_adm for insert
    with check (
        exists (
            select 1 from public.user_profiles
            where id = auth.uid()
            and role = 'admin'
        )
    );

create policy "Admin pode atualizar despesas adm transporte"
    on public.transporte_despesas_adm for update
    using (
        exists (
            select 1 from public.user_profiles
            where id = auth.uid()
            and role = 'admin'
        )
    );

create policy "Admin pode excluir despesas adm transporte"
    on public.transporte_despesas_adm for delete
    using (
        exists (
            select 1 from public.user_profiles
            where id = auth.uid()
            and role = 'admin'
        )
    );

create index if not exists idx_transporte_despesas_adm_data      on public.transporte_despesas_adm(data_despesa desc);
create index if not exists idx_transporte_despesas_adm_categoria  on public.transporte_despesas_adm(categoria);