-- Fase 1: colunas de governança/proposta em credenciamento, bucket de
-- documentos e políticas de escrita para Comercial e Diretoria Comercial.
-- Requer que a migration 0003_fase1_enums.sql já tenha sido aplicada.

alter table credenciamento
  add column tipo_contrato tipo_contrato,
  add column produtos_log text[],
  add column taxa_frete numeric(5, 2),
  add column taxa_vpo numeric(5, 2),
  add column permanencia_minima_meses integer,
  add column parte_relacionada boolean not null default false,
  add column aprovado_conselho boolean,
  add column segue_politica_concorrencial boolean not null default true,
  add column aprovado_diretoria boolean,
  add column motivo_reprovacao text;

-- Bucket privado para os documentos do credenciamento. Todo acesso
-- (upload pelo portal do cliente, leitura pelas áreas internas) passa
-- pela service role em rotas de servidor — nunca acesso direto do
-- browser com a chave anônima — por isso não há políticas de storage
-- abertas para anon/authenticated aqui.
insert into storage.buckets (id, name, public)
values ('documentos', 'documentos', false)
on conflict (id) do nothing;

-- Comercial cria o cliente e abre o credenciamento.
create policy "comercial_insere_cliente" on cliente
  for insert
  with check (auth.uid() in (select id from usuario where area = 'comercial' and ativo));

create policy "comercial_insere_credenciamento" on credenciamento
  for insert
  with check (auth.uid() in (select id from usuario where area = 'comercial' and ativo));

-- Diretoria Comercial só pode atualizar credenciamentos que estejam
-- aguardando a aprovação dela.
create policy "diretoria_atualiza_credenciamento" on credenciamento
  for update
  using (
    status = 'AGUARDANDO_APROVACAO_DIRETORIA'
    and auth.uid() in (select id from usuario where area = 'diretoria_comercial' and ativo)
  )
  with check (
    auth.uid() in (select id from usuario where area = 'diretoria_comercial' and ativo)
  );

grant insert on cliente to authenticated;
grant insert, update on credenciamento to authenticated;
