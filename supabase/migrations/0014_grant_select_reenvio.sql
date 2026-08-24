-- Um DELETE com WHERE precisa de SELECT na tabela pra avaliar a condição,
-- além do próprio DELETE pra remover a linha. As migrations 0006/0010
-- deram INSERT e DELETE pro service_role nessas 4 tabelas, mas nunca
-- SELECT — por isso o delete-antes-de-reinserir do reenvio pós-devolução
-- falhava com "permission denied for table documento".

grant select on documento to service_role;
grant select on socio to service_role;
grant select on testemunha to service_role;
grant select on ficha_kyc to service_role;
