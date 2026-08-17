-- Remove a etapa "Diretoria Comercial" do fluxo: o Comercial agora cria
-- o credenciamento e já recebe o link do portal do cliente na hora,
-- sem aprovação intermediária. As colunas e a policy que existiam só
-- para essa etapa deixam de ser necessárias.

drop policy if exists "diretoria_atualiza_credenciamento" on credenciamento;

alter table credenciamento
  drop column aprovado_diretoria,
  drop column motivo_reprovacao;
