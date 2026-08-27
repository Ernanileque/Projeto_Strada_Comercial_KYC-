-- Fase 5: Implantação — ativação do cliente após o contrato assinado,
-- até o marco OPERANDO. A tabela implantacao e os status
-- EM_IMPLANTACAO/OPERANDO já existiam desde a migration 0001 (só
-- select); faltava a política de escrita pra área implantacao.

create policy "implantacao_insere_implantacao" on implantacao
  for insert
  with check (auth.uid() in (select id from usuario where ativo and (area = 'implantacao' or is_admin)));

create policy "implantacao_atualiza_implantacao" on implantacao
  for update
  using (auth.uid() in (select id from usuario where ativo and (area = 'implantacao' or is_admin)))
  with check (auth.uid() in (select id from usuario where ativo and (area = 'implantacao' or is_admin)));

grant insert, update on implantacao to authenticated;

-- Credenciamento já tem grant de insert/update pra authenticated
-- (migration 0004), só faltava a policy restringindo a transição
-- ASSINADO -> EM_IMPLANTACAO -> OPERANDO pra área implantacao.
create policy "implantacao_atualiza_credenciamento" on credenciamento
  for update
  using (
    status in ('ASSINADO', 'EM_IMPLANTACAO')
    and auth.uid() in (select id from usuario where ativo and (area = 'implantacao' or is_admin))
  )
  with check (
    auth.uid() in (select id from usuario where ativo and (area = 'implantacao' or is_admin))
  );
