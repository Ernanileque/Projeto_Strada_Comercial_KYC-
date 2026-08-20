-- A página do portal passou a buscar o CNPJ do cliente (join com
-- credenciamento) pra comparar com o CNPJ preenchido na ficha KYC.
-- Igual às outras tabelas na migration 0006, o service_role também
-- precisa de GRANT de leitura em cliente.

grant select on cliente to service_role;
