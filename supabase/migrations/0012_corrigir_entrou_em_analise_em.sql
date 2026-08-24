-- O backfill da migration anterior copiou entrou_em_analise_em = criado_em
-- pra todo mundo, mas a Trojan já tinha sido reenviada (devolvido +
-- resubmissão) antes desse backfill rodar, então ficou com a data antiga
-- errada. Como o reenvio apaga e reinsere os documentos, a data real do
-- reenvio está em documento.enviado_em (o mais recente por credenciamento).
-- Isso corrige os casos já existentes; envios novos já gravam a data
-- certa direto na Server Action.

update credenciamento c
set entrou_em_analise_em = ultimo_documento.enviado_em
from (
  select credenciamento_id, max(enviado_em) as enviado_em
  from documento
  group by credenciamento_id
) as ultimo_documento
where c.id = ultimo_documento.credenciamento_id
  and c.status = 'EM_ANALISE'
  and ultimo_documento.enviado_em > c.entrou_em_analise_em;
