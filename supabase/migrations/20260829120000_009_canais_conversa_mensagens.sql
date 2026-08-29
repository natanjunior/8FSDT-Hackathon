-- ============================================================================
--  Migração 009 — `canais_conversa` e `mensagens`, o canal 1 (item 30)
--
--  Fonte: `docs/modelo-de-dados.md` §5 (tipos), §6.10 e §6.11. Esta migração
--  TRANSCREVE o modelo; ela nao redecide nada.
--
--  **As duas tabelas nascem inteiras**, como a 005, a 007 e a 008. O argumento
--  da 008 vale multiplicado: `arquivado_em` e metade de um CHECK de ordem
--  temporal (§8.1) e `atribuicao_id` e metade do CHECK que escreve a D9 — "a
--  identidade do canal 3 e a atribuicao". Coluna adiada aqui e uma migracao a
--  mais sem ganho.
--
--  **O `tipo_canal` entra com os TRES valores, e dois nao tem produtor nesta
--  entrega.** E o precedente literal de `motivo_encerramento_atribuicao` na
--  008: o enum e do TIPO, nao do endpoint. Nota interna (canal 2) e conversa
--  da atribuicao (canal 3) sao evolucao prevista (`escopo.md`), e a tabela nao
--  muda no dia em que chegarem.
--
--  **O alvo da FK ja estava pago:** a 008 criou
--  `atribuicoes_id_organizacao_uk` dizendo, no comentario, que ele e "alvo da
--  FK composta de canais_conversa (evolucao prevista)". Esta e a migracao que
--  o usa.
--
--  **Sem `ocorrencia_id` desnormalizado em `mensagens`, e a ausencia e
--  deliberada** (modelo §6.11): o caminho `canais_conversa (ocorrencia_id)` →
--  `mensagens (canal_id)` sao duas buscas indexadas sobre no maximo tres
--  canais. E o contraste declarado com a §7.3, onde a desnormalizacao paga.
--
--  **Nao ha gatilho aqui.** Mensagem nao e registro de transicao: o gatilho
--  append-only da 005 e da trilha, e a ausencia de edicao e exclusao aqui e
--  estrutural na API (nao ha PATCH nem DELETE), nao no banco.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Tipo (modelo §5)
-- ----------------------------------------------------------------------------

create type tipo_canal as enum ('comentario', 'nota_interna', 'atribuicao');

comment on type tipo_canal is
  'Os tres canais da D9. `comentario` e o canal 1 — Gestores + Solicitante autor — e o unico com '
  'produtor nesta entrega. `nota_interna` (canal 2) e `atribuicao` (canal 3) sao evolucao prevista e '
  'ganharao caminho proprio no contrato; entram agora porque o enum e do TIPO, nao do endpoint.';

-- ----------------------------------------------------------------------------
-- `canais_conversa` (modelo §6.10)
-- ----------------------------------------------------------------------------

create table canais_conversa (
  id              uuid        primary key default gen_random_uuid(),

  -- Desnormalizado (modelo §4.2): e o que permite ao repositorio escopado ter
  -- `where organizacao_id = $1` sem um unico join.
  organizacao_id  uuid        not null,

  ocorrencia_id   uuid        not null,
  tipo            tipo_canal  not null,
  atribuicao_id   uuid,
  arquivado_em    timestamptz,
  criado_em       timestamptz not null default now(),

  -- Alvo da FK composta de `mensagens`, pela mesma razao que
  -- `ocorrencias_id_organizacao_uk` entrou na 005: a tabela filha nasce na
  -- mesma migracao, e o par (id, organizacao_id) e o que amarra o escopo.
  constraint canais_conversa_id_organizacao_uk unique (id, organizacao_id),

  -- O padrao da §4.2: o banco recusa um canal cujo `organizacao_id` nao bata
  -- com o da ocorrencia. E a defesa do escopo — a aplicacao ja devolveu 404
  -- antes de chegar aqui, e nao ha `where exists` porque nao ha fato
  -- equivalente a "vinculo ATIVO" para traduzir.
  constraint canais_conversa_ocorrencia_fk
    foreign key (ocorrencia_id, organizacao_id)
    references ocorrencias (id, organizacao_id) on delete restrict,

  constraint canais_conversa_atribuicao_fk
    foreign key (atribuicao_id, organizacao_id)
    references atribuicoes (id, organizacao_id) on delete restrict,

  -- "Um canal por atribuicao" (modelo §6.10).
  constraint canais_conversa_atribuicao_uk unique (atribuicao_id),

  -- "A identidade do canal 3 e a atribuicao" (D9), escrita como constraint —
  -- nos DOIS sentidos.
  constraint canais_conversa_atribuicao_ck
    check ((tipo = 'atribuicao') = (atribuicao_id is not null)),

  -- Ordem temporal (modelo §8.1) — classe A: forma do dado, nao regra de
  -- negocio. Nao se arquiva um canal antes de ele existir.
  constraint canais_conversa_arquivado_ck
    check (arquivado_em is null or arquivado_em >= criado_em)
);

comment on table canais_conversa is
  'O espaco de mensagens escopado a uma Ocorrencia, nos tres tipos da D9. NENHUMA coluna de '
  'participantes: quem escreve em cada canal e DERIVADO — canal 1 = Gestores da organizacao + '
  'ocorrencias.autor_pessoa_id. Materializar a lista criaria uma copia que envelhece a cada vinculo novo.';

comment on column canais_conversa.arquivado_em is
  'Arquivar e coluna, nao exclusao de linha: fecha o canal para novas mensagens e mantem a visibilidade '
  'aos Gestores ("arquivado nunca e apagado", D9). Nesta entrega NENHUM caminho a escreve — quem a '
  'preencheria e a POL-04, que depende do canal 3.';

-- Canais 1 e 2 existem no maximo uma vez por ocorrencia; o canal 3 e regido
-- pelo UNIQUE (atribuicao_id) acima.
--
-- **E este indice que faz o canal nascer preguicoso sem `if`**: o `insert …
-- on conflict (ocorrencia_id, tipo) where tipo <> 'atribuicao' do nothing` do
-- item 30 infere ESTE indice, e o `select` seguinte devolve o mesmo `id` para
-- os dois lados de uma corrida. A repeticao do predicado no ON CONFLICT nao e
-- decoracao: sem ela o Postgres nao infere indice PARCIAL.
create unique index canais_conversa_tipo_uk
  on canais_conversa (ocorrencia_id, tipo) where tipo <> 'atribuicao';

-- Abrir a ocorrencia carrega seus canais. Sao no maximo tres ativos, entao
-- nada alem disso se justifica (modelo §6.10).
create index canais_conversa_da_ocorrencia_ix
  on canais_conversa (ocorrencia_id);

-- ----------------------------------------------------------------------------
-- `mensagens` (modelo §6.11)
-- ----------------------------------------------------------------------------

create table mensagens (
  id               uuid           primary key default gen_random_uuid(),
  organizacao_id   uuid           not null,
  canal_id         uuid           not null,
  autor_pessoa_id  uuid           not null,
  texto            varchar(4000)  not null,
  criado_em        timestamptz    not null default now(),

  constraint mensagens_canal_fk
    foreign key (canal_id, organizacao_id)
    references canais_conversa (id, organizacao_id) on delete restrict,

  -- Aponta para `vinculos`, NUNCA para `pessoas`: `pessoas` e global, e uma FK
  -- para ela deixaria uma mensagem sobreviver a quem nao tem vinculo nesta
  -- organizacao. E tambem o que faz `DELETE /vinculos` recusar com
  -- `409 VINCULO_COM_HISTORICO` (item 10).
  constraint mensagens_autor_fk
    foreign key (autor_pessoa_id, organizacao_id)
    references vinculos (pessoa_id, organizacao_id) on delete restrict,

  -- Texto so de espacos e vazio, e o NOT NULL nao o pega (modelo §6.11).
  constraint mensagens_texto_ck check (length(trim(texto)) > 0)
);

comment on table mensagens is
  'O texto trocado dentro de um canal. SEM edicao e SEM exclusao: o inventario do enunciado marca "quem '
  've, edicao, exclusao" como aberto em S8, e nada foi decidido. Se a edicao entrar, ela exige coluna '
  'propria e uma decisao sobre se a versao anterior e preservada — o que, pela ADR-0001, seria historico '
  'de outro recurso.';

-- Abrir um canal e `where canal_id = $1 order by criado_em`, com LIMIT para a
-- paginacao por cursor (modelo §6.11). E o mesmo indice que serve a leitura
-- SEM limite da linha do tempo (criterio 30.7).
create index mensagens_do_canal_ix
  on mensagens (canal_id, criado_em);
