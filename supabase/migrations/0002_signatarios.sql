-- Suporte a assinatura digital (Fase 4): a ficha KYC real da Strada já
-- coleta e-mail do(s) sócio(s)/representante(s) assinantes e dados de
-- testemunha (nome, CPF, e-mail) — precisamos disso para rotear os
-- signatários no envelope DocuSign.

alter table socio add column email text;

create table testemunha (
  id uuid primary key default gen_random_uuid(),
  credenciamento_id uuid not null references credenciamento (id) on delete cascade,
  nome text not null,
  cpf text,
  email text,
  criado_em timestamptz not null default now()
);

alter table testemunha enable row level security;

create policy "interno_le_tudo_testemunha" on testemunha
  for select using (auth.uid() in (select id from usuario where ativo));

grant select on testemunha to authenticated;
