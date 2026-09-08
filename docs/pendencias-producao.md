# Pendências antes de ir para produção

Itens identificados durante a fase de testes (coberta pela carta de risco do
time de Segurança da Strada) que precisam ser avaliados/resolvidos antes de
uma virada real para produção.

## Consulta à Receita Federal via BrasilAPI

**O quê:** o Validador Cadastral (`src/lib/receita/consulta.ts`) consulta a
situação cadastral do CNPJ via [BrasilAPI](https://brasilapi.com.br)
(`/api/cnpj/v1/{cnpj}`).

**Por quê é uma pendência:** a BrasilAPI é um projeto open source/comunitário.
Os dados vêm, em última instância, das bases públicas da Receita Federal —
mas o serviço em si não é oficial, não tem SLA (garantia de disponibilidade)
nem suporte contratual. Adequado para prototipagem e testes, mas não é o
padrão esperado de uma dependência crítica de Compliance/KYC em produção.

**Recomendação:** antes de ir para produção, avaliar migrar essa consulta
para uma fonte com contrato e SLA, por exemplo:
- **Serpro** (API oficial de CNPJ, paga, com SLA).
- Provedores comerciais como **ReceitaWS Pro** ou **CNPJ.ws Pro**.

Levar para discussão com Compliance/Segurança antes da virada.
