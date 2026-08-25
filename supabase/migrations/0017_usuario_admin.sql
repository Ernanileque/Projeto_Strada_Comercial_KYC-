-- Permite marcar um usuário como admin, que passa a valer para todas as
-- áreas nas políticas de RLS por área — evita ter que ficar trocando a
-- coluna "area" do usuário de teste toda vez que muda de aba (bug
-- recorrente de "new row violates row-level security policy" durante
-- os testes ponta a ponta).

alter table usuario add column is_admin boolean not null default false;

drop policy "comercial_insere_cliente" on cliente;
create policy "comercial_insere_cliente" on cliente
  for insert
  with check (auth.uid() in (select id from usuario where ativo and (area = 'comercial' or is_admin)));

drop policy "comercial_insere_credenciamento" on credenciamento;
create policy "comercial_insere_credenciamento" on credenciamento
  for insert
  with check (auth.uid() in (select id from usuario where ativo and (area = 'comercial' or is_admin)));

drop policy "diretoria_atualiza_credenciamento" on credenciamento;
create policy "diretoria_atualiza_credenciamento" on credenciamento
  for update
  using (
    status = 'AGUARDANDO_APROVACAO_DIRETORIA'
    and auth.uid() in (select id from usuario where ativo and (area = 'diretoria_comercial' or is_admin))
  )
  with check (
    auth.uid() in (select id from usuario where ativo and (area = 'diretoria_comercial' or is_admin))
  );

drop policy "compliance_insere_validacao" on validacao;
create policy "compliance_insere_validacao" on validacao
  for insert
  with check (auth.uid() in (select id from usuario where ativo and (area = 'compliance' or is_admin)));

drop policy "compliance_atualiza_credenciamento" on credenciamento;
create policy "compliance_atualiza_credenciamento" on credenciamento
  for update
  using (
    status = 'EM_ANALISE'
    and auth.uid() in (select id from usuario where ativo and (area = 'compliance' or is_admin))
  )
  with check (
    auth.uid() in (select id from usuario where ativo and (area = 'compliance' or is_admin))
  );

drop policy "juridico_insere_contrato" on contrato;
create policy "juridico_insere_contrato" on contrato
  for insert
  with check (auth.uid() in (select id from usuario where ativo and (area = 'juridico' or is_admin)));

drop policy "juridico_atualiza_contrato" on contrato;
create policy "juridico_atualiza_contrato" on contrato
  for update
  using (auth.uid() in (select id from usuario where ativo and (area = 'juridico' or is_admin)))
  with check (auth.uid() in (select id from usuario where ativo and (area = 'juridico' or is_admin)));

drop policy "juridico_atualiza_credenciamento" on credenciamento;
create policy "juridico_atualiza_credenciamento" on credenciamento
  for update
  using (
    status in ('VALIDADO', 'EM_CONTRATO', 'AGUARDANDO_ASSINATURA')
    and auth.uid() in (select id from usuario where ativo and (area = 'juridico' or is_admin))
  )
  with check (
    auth.uid() in (select id from usuario where ativo and (area = 'juridico' or is_admin))
  );

drop policy "comercial_insere_proposta" on proposta;
create policy "comercial_insere_proposta" on proposta
  for insert
  with check (auth.uid() in (select id from usuario where ativo and (area = 'comercial' or is_admin)));

update usuario set is_admin = true where email = 'ernani.leque@strada.log.br';
