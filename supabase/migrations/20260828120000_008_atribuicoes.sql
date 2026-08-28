-- ============================================================================
--  Migração 008 — `atribuicoes`, o responsável pela ocorrência
--
--  Fonte: `docs/modelo-de-dados.md` §5 (tipos) e §6.9.
--
--  **A tabela nasce inteira**, como a 005 e a 007 fizeram. Aqui o argumento é
--  mais forte que nas duas: `encerrada_em` e `motivo_encerramento` sao o par
--  de um CHECK, e o indice unico parcial DEPENDE de `encerrada_em` para
--  existir. Coluna adiada aqui e uma migracao a mais sem ganho.
--
--  **Por que uma tabela, e nao uma coluna `responsavel_pessoa_id` em
--  `ocorrencias`** (modelo §6.9): a linha do tempo e "transicoes MAIS
--  mensagens MAIS atribuicoes", e uma coluna guarda o responsavel atual, nao
--  a sequencia; a identidade do canal 3 e a ATRIBUICAO, nao a pessoa (D9); e
--  reatribuir e evento do Event Storming (POL-04), que com coluna nao deixa
--  rastro. A desnormalizacao "tambem uma coluna, para a listagem" esta
--  RECUSADA por escrito no modelo: seriam duas fontes de verdade.
--
--  **Nao ha gatilho aqui, e a ausencia e decisao.** A tabela RECEBE UPDATE de
--  proposito — e assim que a atribuicao se encerra. O gatilho append-only da
--  005 e da trilha de auditoria, que e outra coisa.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Tipo (modelo §5)
-- ----------------------------------------------------------------------------

create type motivo_encerramento_atribuicao as enum ('reatribuicao', 'recusa');

comment on type motivo_encerramento_atribuicao is
  'Por que a atribuicao terminou. `reatribuicao` e o unico produzido nesta entrega — pelo comando '
  '/atribuir-responsavel quando ja ha responsavel. `recusa` e da recusa de atribuicao pelo Encarregado, '
  'que e evolucao prevista (contrato §8.4): entra agora porque o enum e do TIPO, nao do endpoint.';

-- ----------------------------------------------------------------------------
-- `atribuicoes` (modelo §6.9)
-- ----------------------------------------------------------------------------

create table atribuicoes (
  id                       uuid        primary key default gen_random_uuid(),

  -- Desnormalizado (modelo §4.2): e o que permite ao repositorio escopado ter
  -- `where organizacao_id = $1` sem um unico join.
  organizacao_id           uuid        not null,

  ocorrencia_id            uuid        not null,
  responsavel_pessoa_id    uuid        not null,
  atribuido_por_pessoa_id  uuid        not null,
  atribuido_em             timestamptz not null default now(),
  encerrada_em             timestamptz,
  motivo_encerramento      motivo_encerramento_atribuicao,

  -- Alvo da FK composta de `canais_conversa` (evolucao prevista). Entra agora
  -- pela mesma razao que `ocorrencias_id_organizacao_uk` entrou na 005: o dia
  -- do canal 3 nao deve comecar por uma migracao de constraint.
  constraint atribuicoes_id_organizacao_uk unique (id, organizacao_id),

  -- O padrao da §4.2: o banco recusa uma atribuicao cujo `organizacao_id` nao
  -- bata com o da ocorrencia.
  constraint atribuicoes_ocorrencia_fk
    foreign key (ocorrencia_id, organizacao_id)
    references ocorrencias (id, organizacao_id) on delete restrict,

  -- **A D21 escrita como FK:** a atribuicao aponta para QUALQUER Pessoa com
  -- vinculo nesta organizacao — Encarregado OU Gestor —, e o papel nao entra
  -- na regra. Aponta para `vinculos`, nunca para `pessoas`, e e tambem o que
  -- faz `DELETE /vinculos` recusar com `409 VINCULO_COM_HISTORICO` (item 10).
  --
  -- **Ela NAO olha `revogado_em`**, e por isso nao basta: vinculo revogado
  -- passa na FK. Quem traduz "vinculo ATIVO" — a palavra do criterio 19.3 — e
  -- o `where exists` do INSERT, na camada de infraestrutura.
  constraint atribuicoes_responsavel_fk
    foreign key (responsavel_pessoa_id, organizacao_id)
    references vinculos (pessoa_id, organizacao_id) on delete restrict,

  constraint atribuicoes_atribuido_por_fk
    foreign key (atribuido_por_pessoa_id, organizacao_id)
    references vinculos (pessoa_id, organizacao_id) on delete restrict,

  -- O par, nos DOIS sentidos: nao ha encerramento sem motivo nem motivo sem
  -- encerramento.
  constraint atribuicoes_encerramento_ck
    check ((encerrada_em is null) = (motivo_encerramento is null)),

  -- Ordem temporal (modelo §8.1) — classe A: forma do dado, nao regra de
  -- negocio.
  constraint atribuicoes_ordem_temporal_ck
    check (encerrada_em is null or encerrada_em >= atribuido_em)
);

comment on table atribuicoes is
  'Qual Pessoa foi designada para resolver uma ocorrencia, e QUANDO essa designacao comecou e terminou. '
  'A duracao e o que da identidade ao canal 3 (D9). Recebe UPDATE de proposito: e assim que a atribuicao '
  'se encerra — o gatilho append-only da 005 e da trilha, nao daqui.';

comment on column atribuicoes.motivo_encerramento is
  'Nulo enquanto a atribuicao esta vigente. `reatribuicao` e escrito pelo proprio /atribuir-responsavel '
  'quando ja ha responsavel; `recusa` nao tem, nesta entrega, nenhum caminho que o produza.';

-- ----------------------------------------------------------------------------
-- O criterio 19.5 escrito como CONSTRAINT — e e a garantia, nao o alarme.
--
-- "Existe no maximo UM responsavel ativo por ocorrencia" e garantia de classe
-- B do modelo §8: regra sobre um CONJUNTO de linhas, que nenhum agregado
-- garante sozinho. O banco a opera; o dominio nao a garante. E e por isso que
-- a leitura do responsavel dispensa `limit 1`.
-- ----------------------------------------------------------------------------
create unique index atribuicoes_vigente_uk
  on atribuicoes (ocorrencia_id) where encerrada_em is null;

-- "So o que e meu" — a lista do Encarregado (evolucao prevista) e a
-- auto-atribuicao do Gestor (item 20). Parcial pela mesma razao do de cima:
-- so a vigente responde a pergunta.
create index atribuicoes_responsavel_vigente_ix
  on atribuicoes (responsavel_pessoa_id, organizacao_id) where encerrada_em is null;

-- A LINHA DO TEMPO (item 29), que intercala atribuicoes com transicoes e
-- mensagens. Entra agora pela mesma razao do LATERAL do `motivoPausa` no item
-- 14: indice adiado e divida que nenhum criterio do item seguinte nomeia.
create index atribuicoes_linha_do_tempo_ix
  on atribuicoes (ocorrencia_id, atribuido_em);
