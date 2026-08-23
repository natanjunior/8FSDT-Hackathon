-- ============================================================================
--  Migração 002 — `categorias`, `areas`, e a coluna que a 001 prometeu
--
--  Fonte: `docs/modelo-de-dados.md` §5 (tipos), §6.5, §6.6 e §14 (semente).
--
--  **Estas duas tabelas existem para a POL-01.** A migração 001 declarou a FK
--  `DEFERRABLE INITIALLY DEFERRED` de `organizacoes` para `vinculos` dizendo,
--  na própria justificativa, que *"a POL-01 cria organização, vínculo,
--  categorias-semente e áreas-semente juntas"*. Esta é a metade que faltava.
--
--  E cumpre a segunda promessa da 001: `vinculos.area_id`, que ela deixou de
--  fora por escrito — *"ela entra na migração que cria `areas`, junto com a
--  sua FK"*. A coluna nasce **dormente**: quem a escreve é o item 8, na
--  aprovação do pedido de entrada. Adiá-la custaria uma terceira migração
--  mexendo em `vinculos`.
--
--  **Não há gatilho de `atualizado_em`, pela mesma razão da 001:** nenhum
--  documento decide se o relógio é do banco ou da aplicação, e nesta fatia não
--  existe UPDATE em nenhuma das duas tabelas — o `PATCH` das duas é do lote 3.
--  A questão continua aberta, agora valendo para cinco tabelas.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Tipos (modelo §5)
-- ----------------------------------------------------------------------------

create type tipo_area as enum ('comum', 'privativa');

comment on type tipo_area is
  'Comum ou privativa. DERIVA A VISIBILIDADE da ocorrência (D10) — conforme o tipo vigente no momento do '
  'registro, nunca o atual: ocorrencias.area_tipo guarda a cópia congelada (modelo §7.5).';

-- ----------------------------------------------------------------------------
-- `categorias` — a `Categoria` (modelo §6.5)
--
-- Semente das sete do enunciado, enumeradas na §14.1. `criado_por_pessoa_id` é
-- anulável exatamente por isso: quem as cria é a política, não uma pessoa.
-- ----------------------------------------------------------------------------

create table categorias (
  id                        uuid        primary key default gen_random_uuid(),
  organizacao_id            uuid        not null,
  nome                      varchar(60) not null collate "pt-BR-x-icu",

  -- Nome de ícone do conjunto `lucide` — nunca emoji (renderiza diferente em
  -- cada aparelho) e nunca URL (URL seria objeto binário, e objeto binário
  -- passa pelo mecanismo do anexo, §6.2.1).
  --
  -- **NOT NULL desde o primeiro dia**, porque agora há dois escritores: a
  -- POL-01 e o Gestor (item 4b). O padrão `tag` é gravado pelo servidor quando
  -- o cliente não manda — o padrão mora no código, não aqui.
  --
  -- O CHECK confere **forma, nunca a lista**. A lista fechada de 25 nomes é da
  -- §14.5 e mora na Interface, pelo argumento que aquela seção faz por inteiro:
  -- o cliente não consegue renderizar uma string, então já existe
  -- obrigatoriamente um mapa nome → componente lá. Com a lista no banco seriam
  -- três cópias da mesma decisão de produto.
  icone                     varchar(40) not null,

  ativa                     boolean     not null default true,
  ordem                     smallint    not null default 0,

  criado_por_pessoa_id      uuid,
  atualizado_por_pessoa_id  uuid,
  criado_em                 timestamptz not null default now(),
  atualizado_em             timestamptz not null default now(),

  constraint categorias_icone_ck check (icone ~ '^[a-z0-9-]{1,40}$'),

  -- Alvo da FK composta que `ocorrencias` vai declarar (§4.2). A tabela ainda
  -- não existe; a restrição sim, porque criá-la depois seria ALTER.
  constraint categorias_id_organizacao_uk unique (id, organizacao_id),

  -- Duas categorias com o mesmo nome na mesma organização quebrariam o
  -- indicador de recorrência, que é o número mais importante do dashboard (D19).
  constraint categorias_organizacao_nome_uk unique (organizacao_id, nome),

  constraint categorias_organizacao_fk
    foreign key (organizacao_id) references organizacoes (id) on delete restrict,

  constraint categorias_criado_por_fk
    foreign key (criado_por_pessoa_id, organizacao_id)
    references vinculos (pessoa_id, organizacao_id) on delete restrict,

  constraint categorias_atualizado_por_fk
    foreign key (atualizado_por_pessoa_id, organizacao_id)
    references vinculos (pessoa_id, organizacao_id) on delete restrict
);

comment on table categorias is
  'A natureza da ocorrência, configurável por Organização (D18). Nasce com as sete do enunciado, pela '
  'POL-01 (modelo §14.1). Não há DELETE: categoria sai de uso com ativa = false, porque ocorrência antiga '
  'aponta para ela e a FK vinda de ocorrencias é RESTRICT.';

comment on column categorias.criado_por_pessoa_id is
  'Anulável de propósito: as sementes da POL-01 são criadas pela política, não por uma pessoa clicando '
  '(modelo §6.5). É "último a escrever", não histórico — histórico de configuração seria tabela própria.';

-- Índices: nenhum além dos acima. `UNIQUE (organizacao_id, nome)` já serve à
-- listagem por organização pelo prefixo (§2.9), e são ~7 a 15 linhas.

-- ----------------------------------------------------------------------------
-- `areas` — a `Área` (modelo §6.6)
--
-- É aqui que a auditoria de configuração deixa de ser boa prática e passa a ser
-- necessária: `areas.tipo` decide quem vê o quê, e reclassificar uma Área muda
-- a visibilidade de tudo que for registrado dali em diante.
-- ----------------------------------------------------------------------------

create table areas (
  id                        uuid        primary key default gen_random_uuid(),
  organizacao_id            uuid        not null,
  nome                      varchar(80) not null collate "pt-BR-x-icu",

  -- **Sem valor padrão, de propósito.** Toda Área nasce com um dos dois (D18),
  -- e um padrão implícito escolheria a visibilidade da ocorrência em silêncio —
  -- que é exatamente o que a D10 recusa ao dizer que a visibilidade é
  -- derivação, não configuração.
  tipo                      tipo_area   not null,

  ativa                     boolean     not null default true,

  -- Entrou por medição de tempo de interface, e é a única coluna deste esquema
  -- nessa condição: o campo de Área custa ~12 s do orçamento de 60 do RNF6, e
  -- `ordem` é o único conserto que atua no PRIMEIRO registro de cada pessoa.
  ordem                     smallint    not null default 0,

  criado_por_pessoa_id      uuid,
  atualizado_por_pessoa_id  uuid,
  criado_em                 timestamptz not null default now(),
  atualizado_em             timestamptz not null default now(),

  constraint areas_id_organizacao_uk unique (id, organizacao_id),
  constraint areas_organizacao_nome_uk unique (organizacao_id, nome),

  constraint areas_organizacao_fk
    foreign key (organizacao_id) references organizacoes (id) on delete restrict,

  constraint areas_criado_por_fk
    foreign key (criado_por_pessoa_id, organizacao_id)
    references vinculos (pessoa_id, organizacao_id) on delete restrict,

  constraint areas_atualizado_por_fk
    foreign key (atualizado_por_pessoa_id, organizacao_id)
    references vinculos (pessoa_id, organizacao_id) on delete restrict
);

comment on table areas is
  'A subdivisão configurada da Organização, cujo TIPO deriva a visibilidade de toda ocorrência ali '
  'registrada (D10). A semente é mínima e neutra por decisão de produto: o tenant pode ser condomínio, '
  'empresa ou bairro (D3), e semear o vocabulário de um só tipo de cliente contradiria o multi-tenant.';

comment on column areas.atualizado_por_pessoa_id is
  'Aqui a auditoria é de PRIVACIDADE, não de boa prática: reclassificar uma Área de privativa para comum '
  'muda a visibilidade de tudo que for registrado dali em diante, e a pergunta "quem tornou esta Área '
  'comum, e quando?" precisa de resposta (modelo §6.6).';

-- ----------------------------------------------------------------------------
-- A promessa da migração 001 — `vinculos.area_id` (modelo §6.4)
--
-- A unidade da pessoa nesta organização: o apartamento 302, a sala 14. Nasce
-- dormente — o único caminho que a escreve é
-- `POST /pedidos-de-entrada/{id}/aprovar`, que é o item 8.
--
-- A FK é composta porque a Área tem de ser DA MESMA organização do vínculo, e
-- é o `UNIQUE (id, organizacao_id)` acima que a torna possível (§4.2).
-- ----------------------------------------------------------------------------

alter table vinculos add column area_id uuid;

alter table vinculos
  add constraint vinculos_area_fk
    foreign key (area_id, organizacao_id)
    references areas (id, organizacao_id)
    on delete restrict;

comment on column vinculos.area_id is
  'A unidade da Pessoa nesta Organização. Informada UMA VEZ, na aprovação do pedido de entrada — o '
  'PATCH /vinculos/{pessoaId} a aceita, mas recusa Pessoa com conta (contrato §8.2). Anulável: o Gestor e '
  'o Encarregado terceirizado não têm unidade.';

-- ----------------------------------------------------------------------------
-- Row Level Security — a mesma divisão da 001 (ADR-0003)
--
-- Ligada e sem política nenhuma: no PostgreSQL isso é negação total para `anon`
-- e `authenticated`. Quem fala com estas tabelas é o servidor, e nele o
-- isolamento por organização é aplicado em código, no ponto único.
-- ----------------------------------------------------------------------------

alter table categorias enable row level security;
alter table areas      enable row level security;
