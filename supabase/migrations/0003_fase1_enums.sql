-- Fase 1: novos valores de enum. Precisam ser aplicados (e committed)
-- ANTES da migration 0004, que já usa esses valores — o Postgres não
-- permite usar um valor de enum recém-criado na mesma transação.

alter type area_usuario add value 'diretoria_comercial';

alter type status_credenciamento add value 'AGUARDANDO_APROVACAO_DIRETORIA' after 'AGUARDANDO_CLIENTE';
alter type status_credenciamento add value 'REPROVADO' after 'DEVOLVIDO';

alter type tipo_documento add value 'rg_cnh_representante';

create type tipo_contrato as enum ('strada_pay', 'strada_log');
