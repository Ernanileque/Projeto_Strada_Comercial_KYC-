-- Fase Comercial: geração e envio automático da Proposta Comercial junto
-- com o link do portal, no momento da abertura do credenciamento.

alter table credenciamento add column condicoes_comerciais jsonb;

create table proposta (
  id uuid primary key default gen_random_uuid(),
  credenciamento_id uuid not null references credenciamento (id) on delete cascade,
  arquivo_url text,
  gerada_em timestamptz,
  enviada_em timestamptz,
  enviada_para text,
  criado_por uuid references usuario (id)
);

alter table proposta enable row level security;

create policy "interno_le_tudo_proposta" on proposta
  for select using (auth.uid() in (select id from usuario where ativo));

create policy "comercial_insere_proposta" on proposta
  for insert
  with check (auth.uid() in (select id from usuario where area = 'comercial' and ativo));

grant select, insert on proposta to authenticated;
grant select, insert on proposta to service_role;
