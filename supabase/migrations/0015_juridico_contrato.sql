-- Fase 3: geração de contrato + assinatura. O Comercial escolhe o produto
-- (Strada Pay, Strada Log ou os dois) ao criar o credenciamento, e o
-- Jurídico gera um contrato por produto a partir do modelo correspondente.

create type produto_credenciamento as enum (
  'STRADA_PAY',
  'STRADA_LOG',
  'AMBOS'
);

alter table credenciamento add column produto produto_credenciamento not null default 'STRADA_PAY';

create type status_contrato as enum (
  'RASCUNHO',
  'ENVIADO_PARA_ASSINATURA',
  'ASSINADO'
);

alter table contrato add column produto produto_credenciamento not null default 'STRADA_PAY';
alter table contrato add column status status_contrato not null default 'RASCUNHO';
alter table contrato add column docusign_envelope_id text;
alter table contrato alter column produto drop default;

grant select, insert, update on contrato to authenticated;
grant select, insert, update on contrato to service_role;

create policy "juridico_insere_contrato" on contrato
  for insert
  with check (auth.uid() in (select id from usuario where area = 'juridico' and ativo));

create policy "juridico_atualiza_contrato" on contrato
  for update
  using (auth.uid() in (select id from usuario where area = 'juridico' and ativo))
  with check (auth.uid() in (select id from usuario where area = 'juridico' and ativo));

create policy "juridico_atualiza_credenciamento" on credenciamento
  for update
  using (
    status in ('VALIDADO', 'EM_CONTRATO', 'AGUARDANDO_ASSINATURA')
    and auth.uid() in (select id from usuario where area = 'juridico' and ativo)
  )
  with check (
    auth.uid() in (select id from usuario where area = 'juridico' and ativo)
  );
