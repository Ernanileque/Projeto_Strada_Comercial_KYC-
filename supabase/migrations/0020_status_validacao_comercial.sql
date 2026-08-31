-- Novo status intermediário: depois que o cliente envia a ficha KYC, o
-- Comercial passa a revisar (rodando o mesmo Validador IA do Compliance
-- e decidindo encaminhar ou devolver ao cliente) antes de virar
-- EM_ANALISE de fato. Precisa ser sua própria migration porque o
-- Postgres não permite usar um valor de enum recém-criado na mesma
-- transação em que ele foi adicionado (mesmo padrão de 0003_fase1_enums.sql).

alter type status_credenciamento add value if not exists 'EM_VALIDACAO_COMERCIAL' after 'AGUARDANDO_CLIENTE';
