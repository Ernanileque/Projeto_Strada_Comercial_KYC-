-- O reenvio pós-devolução tenta apagar documento/socio/testemunha/ficha_kyc
-- antes de reinserir (migration 0010 deu o GRANT de delete pro service_role),
-- mas essas 4 tabelas têm RLS habilitado e nunca tiveram nenhuma policy de
-- delete — então o RLS barrava o delete mesmo com o GRANT, e o código não
-- verificava o erro, então falhava calado e duplicava os dados no reenvio.

create policy "service_role_apaga_documento" on documento
  for delete to service_role using (true);

create policy "service_role_apaga_socio" on socio
  for delete to service_role using (true);

create policy "service_role_apaga_testemunha" on testemunha
  for delete to service_role using (true);

create policy "service_role_apaga_ficha_kyc" on ficha_kyc
  for delete to service_role using (true);
