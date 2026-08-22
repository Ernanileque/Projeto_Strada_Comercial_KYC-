-- Compliance passa a poder registrar o resultado do Validador Cadastral
-- (tabela validacao) e avançar o status do credenciamento (Aprovar →
-- VALIDADO / Devolver → DEVOLVIDO), só enquanto ele está em EM_ANALISE.

create policy "compliance_insere_validacao" on validacao
  for insert
  with check (auth.uid() in (select id from usuario where area = 'compliance' and ativo));

create policy "compliance_atualiza_credenciamento" on credenciamento
  for update
  using (
    status = 'EM_ANALISE'
    and auth.uid() in (select id from usuario where area = 'compliance' and ativo)
  )
  with check (
    auth.uid() in (select id from usuario where area = 'compliance' and ativo)
  );

grant insert on validacao to authenticated;
