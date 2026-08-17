-- Mesmo problema que já tínhamos visto com o papel `authenticated` na
-- migration 0001: RLS só filtra QUAIS linhas uma role vê; sem o GRANT
-- de base, o Postgres nega o acesso à tabela inteira antes mesmo de
-- avaliar as políticas (ou o bypass de RLS do service_role). O portal
-- do cliente usa o cliente admin (service_role) a partir de rotas de
-- servidor, e ele também precisa desses GRANTs explícitos.

grant select, update on credenciamento to service_role;
grant insert on documento to service_role;
grant insert on socio to service_role;
grant insert on testemunha to service_role;
grant insert on ficha_kyc to service_role;
