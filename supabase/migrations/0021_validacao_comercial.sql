-- Etapa de "validação comercial": tabela de histórico de justificativas
-- (encaminhamento pro Compliance com evidência opcional, ou devolução
-- ao cliente) + policy de update em credenciamento pra área comercial
-- agir sobre EM_VALIDACAO_COMERCIAL (rodou a migration 0020 antes).

create table justificativa_comercial (
  id uuid primary key default gen_random_uuid(),
  credenciamento_id uuid not null references credenciamento (id) on delete cascade,
  tipo text not null, -- 'encaminhamento' | 'devolucao_cliente'
  texto text,
  evidencia_url text,
  criado_por uuid references usuario (id),
  criado_em timestamptz not null default now()
);

alter table justificativa_comercial enable row level security;

create policy "interno_le_tudo_justificativa_comercial" on justificativa_comercial
  for select using (auth.uid() in (select id from usuario where ativo));

create policy "comercial_insere_justificativa_comercial" on justificativa_comercial
  for insert
  with check (auth.uid() in (select id from usuario where ativo and (area = 'comercial' or is_admin)));

grant select, insert on justificativa_comercial to authenticated;

-- Credenciamento já tem grant de update pra authenticated (migration
-- 0004); só faltava a policy restringindo a transição
-- EM_VALIDACAO_COMERCIAL -> EM_ANALISE/DEVOLVIDO pra área comercial.
create policy "comercial_atualiza_credenciamento" on credenciamento
  for update
  using (
    status = 'EM_VALIDACAO_COMERCIAL'
    and auth.uid() in (select id from usuario where ativo and (area = 'comercial' or is_admin))
  )
  with check (
    auth.uid() in (select id from usuario where ativo and (area = 'comercial' or is_admin))
  );
