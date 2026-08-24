-- Quando o cliente reenvia a ficha depois de "devolvido", a Server
-- Action substitui a submissão anterior por completo (evita duplicar
-- documentos/sócios/ficha). Isso exige DELETE, que o service_role
-- ainda não tinha nessas tabelas.

grant delete on documento to service_role;
grant delete on socio to service_role;
grant delete on testemunha to service_role;
grant delete on ficha_kyc to service_role;

-- A página do portal também passou a ler o motivo da devolução (última
-- linha de validacao) pra mostrar ao cliente o que precisa corrigir.
grant select on validacao to service_role;
