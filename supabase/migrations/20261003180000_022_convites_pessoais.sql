-- ----------------------------------------------------------------------------
-- 022 · O convite pessoal — item 121
--
-- O link de uma pessoa que o Gestor cadastrou sem conta. Quem o abre liga a
-- própria conta ao vínculo que já existe, sem pedido de entrada: **o convite
-- não cria vínculo**, e é por isso que dispensa aprovação (D25, leitura do
-- item 121).
--
-- **O token fica em claro, e a razão é critério (121.9).** O Gestor recupera o
-- link já gerado, então ele não pode ser só resumo. Ele não concede acesso
-- novo: liga uma conta a um vínculo que o Gestor já aprovou ao cadastrar. A
-- janela fecha por quatro lados: gerar novo link carimba `invalidado_em`, o
-- aceite carimba `aceito_em`, revogar o vínculo invalida, e só quem tem
-- `vinculo.gerir` lê o token.
--
-- **Nenhuma linha é apagada pelo código.** Gerar novo link carimba a vigente e
-- insere outra. A chave para o vínculo é `cascade` só para que remover um
-- participante sem rastro (item 84) não seja recusado por um link.
-- ----------------------------------------------------------------------------

create table convites_pessoais (
  id                    uuid        not null default gen_random_uuid(),
  organizacao_id        uuid        not null,
  pessoa_id             uuid        not null,
  token                 text        not null,
  criado_por_pessoa_id  uuid        not null,
  criado_em             timestamptz not null default now(),
  invalidado_em         timestamptz,
  aceito_em             timestamptz,

  constraint convites_pessoais_pk primary key (id),
  constraint convites_pessoais_token_uk unique (token),

  constraint convites_pessoais_organizacao_fk
    foreign key (organizacao_id) references organizacoes (id) on delete restrict,

  -- O convite recebido não é rastro: apaga com o vínculo (item 84, remover).
  constraint convites_pessoais_vinculo_fk
    foreign key (pessoa_id, organizacao_id)
    references vinculos (pessoa_id, organizacao_id) on delete cascade,

  -- Quem gerou é rastro, como em toda coluna de quem fez.
  constraint convites_pessoais_criado_por_fk
    foreign key (criado_por_pessoa_id, organizacao_id)
    references vinculos (pessoa_id, organizacao_id) on delete restrict,

  -- Aceito e invalidado são desfechos exclusivos.
  constraint convites_pessoais_desfecho_ck
    check (invalidado_em is null or aceito_em is null)
);

comment on table convites_pessoais is
  'O Convite pessoal: o link que liga uma conta ao vínculo de uma pessoa cadastrada sem conta. O token '
  'fica em claro porque não concede acesso novo (item 121, ADR-0021).';

comment on column convites_pessoais.token is
  'Em claro de propósito: o Gestor recupera o link já gerado, e o token não concede acesso novo, só liga '
  'uma conta a um vínculo que o Gestor já aprovou ao cadastrar.';

-- Um convite vivo por vínculo. É o alvo do `on conflict` de `garantir`.
create unique index convites_pessoais_vivo_uk
  on convites_pessoais (organizacao_id, pessoa_id)
  where invalidado_em is null and aceito_em is null;

-- Como toda tabela do esquema (banco-de-dados.md, Só o servidor fala com o banco): RLS ligada e nenhuma
-- política, que no PostgreSQL é negação para quem não é o servidor.
alter table convites_pessoais enable row level security;
