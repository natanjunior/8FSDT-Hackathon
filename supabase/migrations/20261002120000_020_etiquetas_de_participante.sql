-- ----------------------------------------------------------------------------
-- 020 · Etiquetas dos participantes — item 115
--
-- **Rótulo livre do Gestor sobre um participante**: eletricista, contratado,
-- prestador de serviço. Não é Papel, que é permissão e tem três valores fixos;
-- não é Categoria, que tipifica a ocorrência. A lista é POR RECURSO: esta é a
-- dos participantes, e o nome deixa livre o lugar da lista das ocorrências.
--
-- **A etiqueta é do vínculo, porque a chave é do vínculo.** `vinculos` não tem
-- `id`: a chave primária é `(pessoa_id, organizacao_id)`, e a junção a carrega
-- inteira, pelo padrão de chave composta do esquema.
--
-- **Quem recebe apaga em cascata, quem atribuiu não** — as duas pontas de
-- `compartilhamentos` (015). Receber não é rastro; atribuir é, e é o que
-- sustenta "a responsabilidade é de quem atribuiu". Quem atribuiu não sai por
-- remoção: sai por revogação, que é `update`.
--
-- **Revogar apaga as etiquetas da pessoa**, no comando, e não aqui: a linha de
-- `vinculos` sobrevive à revogação, e o vínculo refeito tem de nascer limpo.
--
-- **A unicidade é por `lower` em ICU, e não no locale do banco.** Em `C`, o
-- `lower()` não desce caixa fora do ASCII, e "ÉLETRICISTA" e "életricista"
-- seriam duas. Acento continua contando: ICU muda a caixa, não tira o acento.
-- ----------------------------------------------------------------------------

create table etiquetas_participante (
  id              uuid        not null default gen_random_uuid(),
  organizacao_id  uuid        not null references organizacoes (id) on delete restrict,
  nome            text        not null,
  criado_em       timestamptz not null default now(),

  constraint etiquetas_participante_pk primary key (id),
  -- Alvo da chave composta da junção (banco-de-dados.md, O escopo).
  constraint etiquetas_participante_escopo_uq unique (id, organizacao_id),
  constraint etiquetas_participante_nome_ck check (char_length(nome) between 1 and 30),
  -- A aplicação apara antes de gravar; o banco recusa o que chegar sem aparar.
  constraint etiquetas_participante_aparado_ck check (nome = btrim(nome))
);

create unique index etiquetas_participante_nome_uq
  on etiquetas_participante (organizacao_id, lower(nome collate "und-x-icu"));

comment on table etiquetas_participante is
  'Rótulo livre que o Gestor dá a um participante. Uma lista por organização. Item 115.';

create table vinculos_etiquetas (
  pessoa_id                uuid        not null,
  organizacao_id           uuid        not null,
  etiqueta_id              uuid        not null,
  atribuido_por_pessoa_id  uuid        not null,
  atribuido_em             timestamptz not null default now(),

  -- Atribuir de novo o que a pessoa já tem é `on conflict do nothing`, e não
  -- reescreve quem atribuiu nem quando.
  constraint vinculos_etiquetas_pk primary key (pessoa_id, organizacao_id, etiqueta_id),

  constraint vinculos_etiquetas_vinculo_fk
    foreign key (pessoa_id, organizacao_id)
    references vinculos (pessoa_id, organizacao_id) on delete cascade,

  constraint vinculos_etiquetas_etiqueta_fk
    foreign key (etiqueta_id, organizacao_id)
    references etiquetas_participante (id, organizacao_id) on delete cascade,

  constraint vinculos_etiquetas_atribuido_por_fk
    foreign key (atribuido_por_pessoa_id, organizacao_id)
    references vinculos (pessoa_id, organizacao_id) on delete restrict
);

comment on table vinculos_etiquetas is
  'Quais etiquetas cada participante tem, quem atribuiu e quando. Item 115.';

alter table etiquetas_participante enable row level security;
alter table vinculos_etiquetas enable row level security;
