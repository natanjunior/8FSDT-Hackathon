-- ============================================================================
--  O mínimo de `auth.users` para a migração 001 rodar contra um Postgres nu
--
--  **Por que este arquivo existe.** A migração 001 tem uma chave estrangeira
--  para `auth.users (id)`, que é a tabela do provedor (modelo §9.1). Em produção
--  e no Supabase local, ela é a tabela de verdade e este arquivo **não faz
--  nada**.
--
--  Ele existe para o **teste de integração no CI**, e a razão é tempo de
--  pipeline: subir a pilha inteira do provedor custa mais de um minuto em toda
--  execução, e o que o critério A4 mede é a consulta ao Postgres — não o
--  servidor de autenticação. Com este arquivo, o teste roda contra um Postgres
--  de serviço em segundos.
--
--  **O risco, declarado.** Uma migração pode passar aqui e falhar contra a
--  tabela real, porque este `auth.users` é uma sombra do contrato do provedor.
--  O que fecha isso é que a mesma migração é aplicada, no mesmo pipeline e antes
--  de qualquer deploy, ao projeto Supabase de verdade — e, no laço local, ao
--  `supabase db reset`. Se ela mentir aqui, a esteira para lá.
--
--  Do esquema do provedor dependemos de **exatamente duas colunas**: `id` (o
--  alvo da nossa FK) e `email` (a credencial). Nada mais do contrato dele
--  atravessa a fronteira (modelo §6.1).
--
--  ---------------------------------------------------------------------------
--  **Por que um bloco condicional em vez de `create ... if not exists`.**
--  No Supabase local o schema `auth` pertence ao `supabase_auth_admin`, e o
--  papel da aplicação **não tem CREATE nele** — `create table if not exists
--  auth.users` falha com *permission denied for schema auth* mesmo quando a
--  tabela já existe, porque a permissão é checada antes da existência. O bloco
--  abaixo só tenta criar quando não há o que reaproveitar.
-- ============================================================================

do $$
begin
  if to_regclass('auth.users') is null then
    create schema if not exists auth;
    create table auth.users (
      id    uuid primary key default gen_random_uuid(),
      email text
    );
    raise notice 'esquema de auth criado pelo shim (Postgres nu, provavelmente CI)';
  else
    raise notice 'auth.users já existe — o shim não fez nada (provedor de verdade)';
  end if;
end
$$;
