-- A análise reputacional (rodada em paralelo, separada da cadastral/
-- compliance) atualiza a linha de validacao já salva, usando o
-- service_role pra contornar RLS. Faltava o GRANT de UPDATE — só
-- tinha SELECT (migration 0010) — causando "permission denied for
-- table validacao" mesmo com o service_role bypassando RLS.

grant update on validacao to service_role;
