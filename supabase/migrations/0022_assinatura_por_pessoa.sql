-- Rastreio de assinatura por pessoa, não mais um botão único por
-- contrato inteiro. Ainda é simulação manual do Jurídico (não é
-- assinatura eletrônica real com link por assinante) — só ganha
-- granularidade: agora dá pra ver quem falta assinar.

create type papel_assinatura as enum (
  'strada_signatario',
  'strada_testemunha',
  'cliente_signatario',
  'cliente_testemunha'
);

create table assinatura (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references contrato (id) on delete cascade,
  papel papel_assinatura not null,
  nome text not null,
  cpf text,
  email text,
  assinado_em timestamptz,
  criado_em timestamptz not null default now()
);

alter table assinatura enable row level security;

create policy "interno_le_tudo_assinatura" on assinatura
  for select using (auth.uid() in (select id from usuario where ativo));

create policy "juridico_insere_assinatura" on assinatura
  for insert
  with check (auth.uid() in (select id from usuario where ativo and (area = 'juridico' or is_admin)));

create policy "juridico_atualiza_assinatura" on assinatura
  for update
  using (auth.uid() in (select id from usuario where ativo and (area = 'juridico' or is_admin)))
  with check (auth.uid() in (select id from usuario where ativo and (area = 'juridico' or is_admin)));

create policy "juridico_deleta_assinatura" on assinatura
  for delete
  using (auth.uid() in (select id from usuario where ativo and (area = 'juridico' or is_admin)));

grant select, insert, update, delete on assinatura to authenticated;
