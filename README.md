# Plataforma de Credenciamento & KYC — Strada Log

Next.js (App Router) + Supabase (Postgres/Auth/Storage) + Vercel. Veja o plano de fases e o contexto completo do projeto na conversa com o Claude Code; este README cobre apenas o setup técnico.

## Passo a passo — Supabase

1. Crie uma conta em [supabase.com](https://supabase.com) e um novo projeto (região `South America (São Paulo)`).
2. No painel do projeto, vá em **SQL Editor**, cole o conteúdo de `supabase/migrations/0001_init.sql` e execute (`Run`). Isso cria todas as tabelas, enums, o trigger de eventos e o RLS.
3. Vá em **Authentication > Users** e crie manualmente o primeiro usuário interno (e-mail + senha) para testar o login.
4. No **SQL Editor**, rode um insert para vincular esse usuário à tabela `usuario` (troque o UUID pelo `id` do usuário criado no passo 3 e a área desejada):
   ```sql
   insert into usuario (id, nome, email, area)
   values ('COLE-O-UUID-AQUI', 'Seu Nome', 'seu@email.com', 'comercial');
   ```
   Áreas válidas: `comercial`, `compliance`, `juridico`, `implantacao`, `gestao`.
5. Em **Project Settings > API**, copie a **Project URL**, a **anon public key** e a **service_role key**.

## Variáveis de ambiente

Copie `.env.example` para `.env.local` e preencha com os valores do Supabase (passo 5 acima):

```bash
cp .env.example .env.local
```

`DOCUSIGN_*` e `ANTHROPIC_API_KEY` podem ficar vazias por enquanto — os módulos correspondentes (assinatura digital e IA) operam em modo simulado/manual até serem configurados, nas fases em que entram em uso.

## Rodando localmente

```bash
npm install
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000) — você será redirecionado para `/login`.

## Deploy na Vercel

1. Crie uma conta em [vercel.com](https://vercel.com) e conecte-a ao repositório GitHub do projeto.
2. Ao importar o projeto, configure a branch de produção (ou faça deploy da branch `claude/new-session-4niudj` como *preview*).
3. Em **Settings > Environment Variables**, adicione as mesmas variáveis de `.env.local`.
4. Deploy. O build falha se as variáveis do Supabase não estiverem configuradas — isso é esperado até esse passo ser feito.

## Estrutura

- `src/app/(interno)/` — áreas internas (Comercial, Compliance, Jurídico, Implantação, Gestão), atrás de login.
- `src/app/login/` — login interno por e-mail/senha (Supabase Auth).
- `src/app/portal/[token]/` — portal externo do cliente, sem login, acessado via link com token (implementação real na Fase 1).
- `src/lib/supabase/` — clientes Supabase (browser, server, admin/service-role, middleware de sessão).
- `src/lib/areas.ts`, `src/lib/estados.ts` — RBAC (áreas) e máquina de estados/SLA do credenciamento.
- `supabase/migrations/` — schema SQL versionado.
- `docs/validador-cadastral-handoff.md` — especificação técnica do Validador Cadastral de Compliance/KYC (motor de risco da estação de Compliance, Fase 2).
