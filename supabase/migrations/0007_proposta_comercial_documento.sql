-- A proposta comercial aceita pelo cliente passa a ser um anexo
-- obrigatório na ficha KYC: é com base nela que Compliance faz a
-- validação concorrencial e o Jurídico monta o contrato pra assinatura.
-- Precisa de um tipo próprio (em vez de cair em "outro") pra essas
-- áreas conseguirem identificar o documento.

alter type tipo_documento add value 'proposta_comercial';
