-- ============================================================================
--  Migração 007 — `anexos`, a evidência da ocorrência
--
--  Fonte: `docs/modelo-de-dados.md` §5 (tipos) e §6.16.
--
--  **A tabela nasce inteira**, como a 005 fez com `ocorrencias`: `titulo` e
--  `nome_arquivo` entram agora, embora nenhuma tela desta entrega os exiba.
--  Coluna anulável adiada é uma migração a mais sem ganho nenhum.
--
--  **É a primeira tabela FILHA do agregado `Ocorrência`.** Ela nasce no mesmo
--  `COMMIT` que a raiz e o primeiro registro da trilha (contrato §10.2, passo
--  3), e nunca existe antes dele — que é o que a separa de uma "tabela de
--  uploads pendentes" e o que preserva a suposição S-A13.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Tipos (modelo §5)
-- ----------------------------------------------------------------------------

create type tipo_anexo as enum ('imagem');

comment on type tipo_anexo is
  'O tipo de EVIDENCIA. UM valor hoje, deliberadamente (modelo §7.8): o escopo da primeira entrega e '
  '"anexar uma imagem". E enum de SAIDA — o cliente nunca o envia: o servidor o deriva do tipoConteudo '
  'que autorizou. Acrescentar um valor e ALTER TYPE mais uma linha em dominio/anexo, sem tocar schema '
  'de entrada nem cliente.';

create type fonte_anexo as enum ('azure_blob');

comment on type fonte_anexo is
  'QUAL provedor resolve a chave opaca. Um valor hoje, e o motivo de existir e justamente admitir o '
  'segundo: este projeto JA trocou de provedor uma vez (ADR-0004), e a coluna e o que transforma a '
  'proxima troca de big-bang em incremental.';

-- ----------------------------------------------------------------------------
-- `anexos` (modelo §6.16)
-- ----------------------------------------------------------------------------

create table anexos (
  id                      uuid          primary key default gen_random_uuid(),
  organizacao_id          uuid          not null,
  ocorrencia_id           uuid          not null,
  tipo                    tipo_anexo    not null,
  fonte                   fonte_anexo   not null default 'azure_blob',
  chave                   text          not null,
  thumbnail_chave         text,
  nome_arquivo            varchar(255),
  titulo                  varchar(150),
  tipo_conteudo           varchar(100)  not null,
  tamanho_bytes           integer       not null,
  anexado_por_pessoa_id   uuid          not null,
  anexado_em              timestamptz   not null default now(),

  -- O padrão da §4.2: o banco recusa um anexo cujo `organizacao_id` não bata
  -- com o da ocorrência. É o par `(id, organizacao_id)` da 005 sendo alvo.
  constraint anexos_ocorrencia_fk
    foreign key (ocorrencia_id, organizacao_id)
    references ocorrencias (id, organizacao_id) on delete restrict,

  constraint anexos_anexado_por_fk
    foreign key (anexado_por_pessoa_id, organizacao_id)
    references vinculos (pessoa_id, organizacao_id) on delete restrict,

  -- **GLOBAL, e é o que faz "reivindicar" significar alguma coisa.** O
  -- contêiner de storage é UM SO: duas organizações não podem reivindicar a
  -- mesma chave, e um único por organização não impediria isso. É também o que
  -- faz `confirmado` querer dizer "reivindicado exatamente uma vez", e é de
  -- onde sai o `409 ANEXO_JA_REIVINDICADO` (contrato §10.3).
  constraint anexos_chave_uk unique (chave),
  -- Pelo mesmo motivo, e os NULL são distintos entre si em Postgres.
  constraint anexos_thumbnail_chave_uk unique (thumbnail_chave),

  constraint anexos_tamanho_ck check (tamanho_bytes > 0),

  -- A §2.8 escrita como constraint: **chave opaca nunca é URL**. É forma do
  -- dado (classe A da §8 do modelo), não regra de negócio.
  constraint anexos_chave_opaca_ck
    check (length(trim(chave)) > 0 and chave not like '%://%'),

  -- A miniatura é OUTRO objeto, e a chave dela é opaca pela mesma regra.
  constraint anexos_thumbnail_ck
    check (
      thumbnail_chave is null
      or (thumbnail_chave <> chave and thumbnail_chave not like '%://%')
    )
);

comment on table anexos is
  'A evidencia anexada a uma ocorrencia — a chave do objeto no storage, o tipo e o que basta para le-lo. '
  'Substitui a coluna ocorrencias.imagem_caminho (modelo §7.8). NAO HA restricao de quantidade aqui, e '
  'isso e a decisao, nao esquecimento: proibir o segundo anexo no banco devolveria a migracao que a '
  'tabela veio evitar. O teto de UM mora no maxItems do schema de entrada.';

comment on column anexos.chave is
  'Chave OPACA do objeto (modelo §2.8): nunca URL, nunca com nome de conteiner embutido. O CHECK acima '
  'recusa "://". Ela NUNCA sai em payload nenhum — o cliente recebe /ocorrencias/{id}/anexos/{anexoId}.';

comment on column anexos.thumbnail_chave is
  'A miniatura, gerada NO APARELHO no mesmo passe de compressao do RNF8. Anulavel de proposito: anexo '
  'sem miniatura e caso normal, e a listagem so perde a previa (contrato §10.2).';

comment on column anexos.tipo_conteudo is
  'O tipo MIME REAL, lido do HEAD no objeto na hora de reivindicar — nunca o que o cliente declarou. '
  'Limitacao declarada: o HEAD devolve o cabecalho que o PUT do cliente escreveu, nao uma leitura dos '
  'bytes. O produto NAO fareja bytes (contrato §10.1).';

comment on column anexos.tamanho_bytes is
  'O tamanho REAL do objeto, tambem do HEAD.';

comment on column anexos.nome_arquivo is
  'Anulavel, e sempre nulo pelo nosso cliente: o arquivo e recomprimido no aparelho, entao o nome '
  'original e residuo de outro arquivo. PODE conter dado pessoal escrito por quem enviou, e a '
  'anonimizacao nao o alcanca — entra na lista de texto livre nao varrido do PA-05.';

comment on column anexos.titulo is
  'O rotulo que a pessoa escreve para a evidencia. E aceito pelo contrato e gravado; T-04 nao oferece '
  'onde escreve-lo nesta entrega (decisao do item 13a). Volta no dia do segundo anexo, sem tocar '
  'esquema nem contrato.';

-- ----------------------------------------------------------------------------
-- Um índice, e ele serve as DUAS únicas leituras que existem: os anexos de uma
-- ocorrência no detalhe, e a contagem por ocorrência na listagem. Começa por
-- `organizacao_id` pela §2.9.
--
-- **Nenhum índice em `tipo` nem em `fonte`:** com um valor em cada enum a
-- seletividade é zero. Entram no dia em que houver mais de um valor E uma
-- consulta que filtre por ele — as duas coisas.
-- ----------------------------------------------------------------------------
create index anexos_organizacao_ocorrencia_ix
  on anexos (organizacao_id, ocorrencia_id);
