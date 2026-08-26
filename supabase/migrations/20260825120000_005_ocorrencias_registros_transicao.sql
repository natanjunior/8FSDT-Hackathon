-- ============================================================================
--  Migração 005 — o agregado `Ocorrência` e a trilha imutável
--
--  Fonte: `docs/modelo-de-dados.md` §5 (tipos), §6.7, §6.8 e §7.5.
--
--  **As duas tabelas nascem inteiras, e isso é decisão.** Colunas que só serão
--  exercidas por itens futuros — `solucao_aplicada`, as três da avaliação,
--  `ocorrencia_origem_id` + `vinculo_origem` — entram agora porque os `CHECK`
--  são interligados: o da avaliação cruza `status` na mesma linha, e
--  `((sequencia = 1) = (status_anterior is null))` é a premissa P1 no banco,
--  nos dois sentidos. Coluna adiada aqui é uma migração a mais sem ganho.
--
--  **Não há gatilho de `atualizada_em` em `ocorrencias`**, e é a §5.8 da
--  `arquitetura.md`: este é o único carimbo do esquema com significado de
--  DOMÍNIO — "houve atividade nesta ocorrência", o que inclui `insert` em
--  `mensagens` — e por isso é a exceção nominal à regra do gatilho. Quem o
--  escreve é o agregado.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Tipos (modelo §5)
-- ----------------------------------------------------------------------------

create type status_ocorrencia as enum
  ('aberta', 'em_analise', 'em_atendimento', 'pausada', 'resolvida', 'cancelada');

comment on type status_ocorrencia is
  'Os cinco estados do enunciado (F1) mais `pausada`, que e NOSSO (D8). Escrito SOMENTE pelos comandos do '
  'agregado (ADR-0001, invariante 1): nao existe PATCH e nao pode existir.';

create type prioridade_ocorrencia as enum ('baixa', 'normal', 'alta');

comment on type prioridade_ocorrencia is
  'Tres niveis (D6). Nasce `normal`, escrita pelo servidor: nao ha campo de urgencia em T-04, porque campo '
  'de urgencia sofre inflacao e vira ruido (D7).';

create type motivo_pausa as enum
  ('aguardando_informacao_solicitante', 'aguardando_peca', 'aguardando_autorizacao', 'aguardando_terceiro');

create type motivo_cancelamento as enum
  ('desistencia', 'resolvido_por_conta_propria', 'aberta_por_engano', 'duplicada',
   'improcedente', 'fora_de_escopo', 'sem_informacao_suficiente');

comment on type motivo_cancelamento is
  'UM conjunto, nao dois (modelo §5): as listas da D5 sao por papel, `duplicada` esta nas duas, e a divisao '
  'e AUTORIZACAO, nao dominio de valor. Quem pode escolher qual e checagem da camada de aplicacao.';

create type vinculo_ocorrencia as enum ('duplicada', 'recorrencia');

-- ----------------------------------------------------------------------------
-- `ocorrencias` — a raiz do agregado (modelo §6.7)
-- ----------------------------------------------------------------------------

create table ocorrencias (
  id                       uuid                  primary key default gen_random_uuid(),
  organizacao_id           uuid                  not null,
  titulo                   varchar(150)          not null,
  descricao                varchar(5000)         not null,
  categoria_id             uuid                  not null,
  area_id                  uuid                  not null,

  -- A visibilidade congelada (modelo §7.5). Copia de `areas.tipo` no INSTANTE
  -- do registro, escrita UMA vez e NUNCA atualizada — nem quando a Area muda
  -- de tipo. Nao e cache: e registro historico de uma condicao no momento do
  -- fato, da mesma familia do `status_anterior` da trilha. Nao ha FK composta
  -- para garanti-la, e isso e deliberado: ela congelaria a Area.
  area_tipo                tipo_area             not null,

  localizacao_complemento  varchar(200),
  prioridade               prioridade_ocorrencia not null default 'normal',
  status                   status_ocorrencia     not null default 'aberta',
  autor_pessoa_id          uuid                  not null,
  solucao_aplicada         varchar(4000),
  avaliacao_nota           smallint,
  avaliacao_comentario     varchar(1000),
  avaliada_em              timestamptz,
  ocorrencia_origem_id     uuid,
  vinculo_origem           vinculo_ocorrencia,
  registrada_em            timestamptz           not null default now(),
  atualizada_em            timestamptz           not null default now(),

  constraint ocorrencias_id_organizacao_uk unique (id, organizacao_id),

  constraint ocorrencias_organizacao_fk
    foreign key (organizacao_id) references organizacoes (id) on delete restrict,
  constraint ocorrencias_categoria_fk
    foreign key (categoria_id, organizacao_id)
    references categorias (id, organizacao_id) on delete restrict,
  constraint ocorrencias_area_fk
    foreign key (area_id, organizacao_id)
    references areas (id, organizacao_id) on delete restrict,
  -- Aponta para `vinculos`, nao para `pessoas`: o autor e o VINCULO daquela
  -- pessoa NESTA organizacao. E o que faz `DELETE /vinculos` recusar com
  -- `409 VINCULO_COM_HISTORICO` quando alguem ja registrou (item 10).
  constraint ocorrencias_autor_fk
    foreign key (autor_pessoa_id, organizacao_id)
    references vinculos (pessoa_id, organizacao_id) on delete restrict,
  constraint ocorrencias_origem_fk
    foreign key (ocorrencia_origem_id, organizacao_id)
    references ocorrencias (id, organizacao_id) on delete restrict,

  -- Os tres campos do S4 sao ENUNCIADO literal; `not null` sozinho aceitaria
  -- string vazia.
  constraint ocorrencias_texto_ck
    check (length(trim(titulo)) > 0 and length(trim(descricao)) > 0),
  constraint ocorrencias_origem_distinta_ck
    check (ocorrencia_origem_id is distinct from id),
  constraint ocorrencias_vinculo_origem_ck
    check ((ocorrencia_origem_id is null) = (vinculo_origem is null)),
  constraint ocorrencias_avaliada_em_ck
    check (avaliada_em is null or avaliada_em >= registrada_em),

  -- A invariante 8 verificavel pelo banco, e e por isso que a avaliacao mora
  -- aqui e nao em tabela propria: so aqui `status` esta na mesma linha.
  -- `avaliacao_comentario` ENTRA na condicao: objeto de valor 0..1 so e
  -- garantido se TODAS as colunas que o compoem entrarem na mesma condicao.
  constraint ocorrencias_avaliacao_ck check (
    (avaliacao_nota is null and avaliada_em is null and avaliacao_comentario is null)
    or (avaliacao_nota between 1 and 5 and avaliada_em is not null and status = 'resolvida')
  )
);

comment on table ocorrencias is
  'A raiz do agregado Ocorrencia (arquitetura.md Parte I §4). `status` NUNCA e escrito de fora: a unica '
  'porta sao os comandos, e cada um grava um registro em `registros_transicao` na MESMA transacao.';

create index ocorrencias_organizacao_registrada_ix
  on ocorrencias (organizacao_id, registrada_em desc);
create index ocorrencias_organizacao_status_ix
  on ocorrencias (organizacao_id, status);
create index ocorrencias_organizacao_autor_ix
  on ocorrencias (organizacao_id, autor_pessoa_id);

-- ----------------------------------------------------------------------------
-- `registros_transicao` — a trilha (modelo §6.8)
--
-- **A tabela que satisfaz o requisito central do desafio**, e a razao de a
-- ADR-0001 existir. Os cinco campos do enunciado, um por coluna, sem
-- serializacao em JSON.
-- ----------------------------------------------------------------------------

create table registros_transicao (
  id                   uuid              primary key default gen_random_uuid(),
  organizacao_id       uuid              not null,
  ocorrencia_id        uuid              not null,

  -- 2 bytes que compram ordem TOTAL e deterministica. `ocorreu_em` tem
  -- `default now()`, que no Postgres e o instante do INICIO DA TRANSACAO: dois
  -- registros gravados juntos recebem o mesmo valor, e ai a ordem da trilha
  -- fica indefinida. Numa trilha de auditoria, ordem indefinida e defeito.
  sequencia            smallint          not null,

  status_anterior      status_ocorrencia,
  status_novo          status_ocorrencia not null,
  ocorreu_em           timestamptz       not null default now(),
  -- **`autor_pessoa_id`, e nao `usuario_responsavel`**: a colisao n. 2 do
  -- glossario quebrou "responsavel" em tres termos, e o campo F5 virou AUTOR
  -- DA TRANSICAO. Aponta para Pessoa via vinculo, nunca para Usuario (D4).
  autor_pessoa_id      uuid              not null,
  observacao           varchar(1000),
  motivo_pausa         motivo_pausa,
  motivo_cancelamento  motivo_cancelamento,

  constraint registros_transicao_id_organizacao_uk unique (id, organizacao_id),
  constraint registros_transicao_sequencia_uk unique (ocorrencia_id, sequencia),

  constraint registros_transicao_ocorrencia_fk
    foreign key (ocorrencia_id, organizacao_id)
    references ocorrencias (id, organizacao_id) on delete restrict,
  constraint registros_transicao_autor_fk
    foreign key (autor_pessoa_id, organizacao_id)
    references vinculos (pessoa_id, organizacao_id) on delete restrict,

  constraint registros_transicao_sequencia_ck check (sequencia >= 1),
  -- Transicao que nao muda o status nao e transicao.
  constraint registros_transicao_mudanca_ck
    check (status_anterior is distinct from status_novo),
  -- **A premissa P1 no banco, nos dois sentidos**: o primeiro registro nao tem
  -- status anterior, e SO o primeiro nao tem.
  constraint registros_transicao_p1_ck
    check ((sequencia = 1) = (status_anterior is null)),
  -- E a criacao nasce `aberta`.
  constraint registros_transicao_origem_ck
    check (status_anterior is not null or status_novo = 'aberta'),
  -- A D23 verificavel pelo banco: motivo codificado obrigatorio e exclusivo de
  -- cada comando, e observacao obrigatoria onde ha decisao a justificar.
  constraint registros_transicao_motivo_ck check (
        (status_novo = 'pausada')   = (motivo_pausa is not null)
    and (status_novo = 'cancelada') = (motivo_cancelamento is not null)
    and (status_novo not in ('pausada', 'cancelada')
         or (observacao is not null and length(trim(observacao)) > 0))
  )
);

comment on table registros_transicao is
  'A trilha imutavel (ADR-0001). Append-only: o repositorio nao expoe update nem delete, e o gatilho '
  'abaixo e a defesa em profundidade. Registro de auditoria que pode ser editado nao e auditoria.';

create index registros_transicao_organizacao_ocorreu_ix
  on registros_transicao (organizacao_id, ocorreu_em desc);
-- Encontra a ORIGEM da trilha — a data de registro — sem varrer nada.
-- Seletividade maxima: uma linha por ocorrencia.
create index registros_transicao_origem_ix
  on registros_transicao (ocorrencia_id) where sequencia = 1;

-- ----------------------------------------------------------------------------
-- A imutabilidade, em duas camadas (modelo §6.8)
--
-- O mecanismo primario e o agregado: o repositorio nao expoe update nem delete
-- nesta tabela. Isto aqui e a defesa em profundidade, e a propria ADR-0001 a
-- preve. **Nao contradiz a ADR**: ela rejeita o gatilho como MECANISMO DE
-- CAPTURA do historico — porque diff de linha nao produz a `observacao`. Este
-- gatilho nao captura nada: ele apenas PROIBE.
-- ----------------------------------------------------------------------------

create function registros_transicao_append_only() returns trigger as $$
begin
  raise exception 'registros_transicao e append-only (ADR-0001): % recusado', tg_op;
end;
$$ language plpgsql;

create trigger registros_transicao_append_only_tg
  before update or delete on registros_transicao
  for each statement execute function registros_transicao_append_only();
