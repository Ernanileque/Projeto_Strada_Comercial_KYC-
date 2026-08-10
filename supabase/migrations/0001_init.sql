-- Plataforma de Credenciamento & KYC — Strada Log
-- Migration inicial: enums, tabelas e RLS básico.

-- ============================================================
-- ENUMS
-- ============================================================

create type area_usuario as enum (
  'comercial',
  'compliance',
  'juridico',
  'implantacao',
  'gestao'
);

create type status_credenciamento as enum (
  'PROPOSTA_ACEITA',
  'AGUARDANDO_CLIENTE',
  'EM_ANALISE',
  'VALIDADO',
  'DEVOLVIDO',
  'EM_CONTRATO',
  'AGUARDANDO_ASSINATURA',
  'ASSINADO',
  'EM_IMPLANTACAO',
  'OPERANDO'
);

create type tipo_documento as enum (
  'ficha_cadastral',
  'cartao_cnpj_qsa',
  'contrato_social',
  'estatuto_social',
  'ata_eleicao',
  'comprovante_bancario',
  'comprovante_endereco',
  'rg_cpf_socio',
  'outro'
);

create type resultado_validacao as enum (
  'APTO',
  'NAO_APTO',
  'EM_ANALISE'
);

-- ============================================================
-- TABELAS
-- ============================================================

-- usuario: espelha auth.users, define RBAC via "area"
create table usuario (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text not null,
  email text not null unique,
  area area_usuario not null,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create table cliente (
  id uuid primary key default gen_random_uuid(),
  razao_social text not null,
  cnpj text not null,
  contato_nome text,
  contato_email text,
  contato_fone text,
  criado_em timestamptz not null default now()
);

create table credenciamento (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references cliente (id) on delete restrict,
  status status_credenciamento not null default 'PROPOSTA_ACEITA',
  proposta_url text,
  token uuid not null default gen_random_uuid(),
  expira_em timestamptz,
  criado_por uuid references usuario (id),
  criado_em timestamptz not null default now()
);

create unique index credenciamento_token_idx on credenciamento (token);

create table socio (
  id uuid primary key default gen_random_uuid(),
  credenciamento_id uuid not null references credenciamento (id) on delete cascade,
  nome text not null,
  cpf text,
  participacao numeric(5, 2),
  pep_flag boolean not null default false,
  criado_em timestamptz not null default now()
);

create table documento (
  id uuid primary key default gen_random_uuid(),
  credenciamento_id uuid not null references credenciamento (id) on delete cascade,
  tipo tipo_documento not null,
  arquivo_url text not null,
  enviado_em timestamptz not null default now()
);

create table ficha_kyc (
  id uuid primary key default gen_random_uuid(),
  credenciamento_id uuid not null references credenciamento (id) on delete cascade,
  pdf_url text,
  dados_json jsonb not null default '{}'::jsonb,
  gerada_em timestamptz not null default now()
);

create table validacao (
  id uuid primary key default gen_random_uuid(),
  credenciamento_id uuid not null references credenciamento (id) on delete cascade,
  validador text not null,
  resultado resultado_validacao not null,
  alertas_json jsonb not null default '{}'::jsonb,
  validado_em timestamptz not null default now(),
  validado_por uuid references usuario (id)
);

create table contrato (
  id uuid primary key default gen_random_uuid(),
  credenciamento_id uuid not null references credenciamento (id) on delete cascade,
  arquivo_url text,
  gerado_em timestamptz,
  assinado_em timestamptz
);

create table implantacao (
  id uuid primary key default gen_random_uuid(),
  credenciamento_id uuid not null references credenciamento (id) on delete cascade,
  iniciada_em timestamptz,
  operando_em timestamptz,
  primeira_viagem timestamptz
);

create table evento (
  id uuid primary key default gen_random_uuid(),
  credenciamento_id uuid not null references credenciamento (id) on delete cascade,
  de_status status_credenciamento,
  para_status status_credenciamento not null,
  usuario_id uuid references usuario (id),
  em timestamptz not null default now()
);

create index evento_credenciamento_idx on evento (credenciamento_id, em);

-- ============================================================
-- TRIGGER: toda mudança de status em credenciamento gera evento
-- ============================================================

create function registrar_evento_status() returns trigger as $$
begin
  if (tg_op = 'INSERT') then
    insert into evento (credenciamento_id, de_status, para_status, em)
    values (new.id, null, new.status, now());
  elsif (tg_op = 'UPDATE' and old.status is distinct from new.status) then
    insert into evento (credenciamento_id, de_status, para_status, em)
    values (new.id, old.status, new.status, now());
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger trg_credenciamento_evento
  after insert or update on credenciamento
  for each row execute function registrar_evento_status();

-- ============================================================
-- RLS
-- Regra: todo usuário interno autenticado enxerga a jornada inteira
-- (leitura). Escrita por estação é refinada fase a fase, conforme
-- cada área é implementada. O portal do cliente (sem login) usa a
-- service role a partir de rotas de servidor validadas por token,
-- nunca acesso direto do browser.
-- ============================================================

alter table usuario enable row level security;
alter table cliente enable row level security;
alter table credenciamento enable row level security;
alter table socio enable row level security;
alter table documento enable row level security;
alter table ficha_kyc enable row level security;
alter table validacao enable row level security;
alter table contrato enable row level security;
alter table implantacao enable row level security;
alter table evento enable row level security;

create policy "usuario_le_a_si_mesmo" on usuario
  for select using (auth.uid() = id);

create policy "interno_le_tudo_cliente" on cliente
  for select using (auth.uid() in (select id from usuario where ativo));

create policy "interno_le_tudo_credenciamento" on credenciamento
  for select using (auth.uid() in (select id from usuario where ativo));

create policy "interno_le_tudo_socio" on socio
  for select using (auth.uid() in (select id from usuario where ativo));

create policy "interno_le_tudo_documento" on documento
  for select using (auth.uid() in (select id from usuario where ativo));

create policy "interno_le_tudo_ficha_kyc" on ficha_kyc
  for select using (auth.uid() in (select id from usuario where ativo));

create policy "interno_le_tudo_validacao" on validacao
  for select using (auth.uid() in (select id from usuario where ativo));

create policy "interno_le_tudo_contrato" on contrato
  for select using (auth.uid() in (select id from usuario where ativo));

create policy "interno_le_tudo_implantacao" on implantacao
  for select using (auth.uid() in (select id from usuario where ativo));

create policy "interno_le_tudo_evento" on evento
  for select using (auth.uid() in (select id from usuario where ativo));
