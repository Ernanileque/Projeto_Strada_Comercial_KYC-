-- A fila do Compliance calculava "Recebido em" e o SLA a partir de
-- credenciamento.criado_em, que nunca muda. Depois de um "devolvido ao
-- cliente" seguido de reenvio, o card voltava pra fila mostrando o mesmo
-- SLA estourado de dias atrás, sem nenhum sinal de que era um reenvio
-- recém-chegado. Esta coluna guarda a data em que o credenciamento entrou
-- (ou reentrou) em EM_ANALISE, e é ela que passa a alimentar a fila.

alter table credenciamento add column entrou_em_analise_em timestamptz;

update credenciamento set entrou_em_analise_em = criado_em where status <> 'PROPOSTA_ACEITA' and status <> 'AGUARDANDO_CLIENTE';
