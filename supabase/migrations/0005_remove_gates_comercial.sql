-- Simplificação: parte relacionada/conselho e política concorrencial não
-- são mais avaliadas pelo Comercial na abertura da solicitação — o
-- Validador Cadastral de Compliance (handoff da Dani) já cobre esses
-- riscos na Fase 2. Remove os campos correspondentes.

alter table credenciamento
  drop column parte_relacionada,
  drop column aprovado_conselho,
  drop column segue_politica_concorrencial;
