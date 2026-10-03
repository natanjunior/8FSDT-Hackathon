-- ----------------------------------------------------------------------------
-- 021 · Leituras de ocorrência — item 117
--
-- **O sino não grava destinatário; grava até onde cada pessoa leu.** A lista do
-- sino é uma consulta sobre as quatro fontes que já existem (trilha, mensagens,
-- atribuições, compartilhamentos). O que não se deriva é a leitura: uma linha
-- por pessoa e ocorrência, com o instante.
--
-- **Fora do agregado `Ocorrencia`** (ADR-0001): não muda status, não grava
-- histórico. Abrir, agir e marcar à mão fazem upsert; marcar como não lida
-- apaga a linha.
--
-- **As duas chaves compostas carregam `organizacao_id`** (banco-de-dados.md, O
-- escopo): a linha cuja ocorrência é de outra organização não grava. A do
-- vínculo apaga em cascata, como `compartilhamentos.com_pessoa_id`: leitura não
-- é rastro, e não pode fazer a remoção de um vínculo ser recusada.
--
-- **`compartilhamentos.aberto_em` sai.** Era a segunda marca de leitura do
-- produto; o selo *Não vista* passa a ser derivado daqui (`lido_ate >=
-- compartilhado_em`), com o mesmo sentido. As aberturas já gravadas viram
-- leitura antes de a coluna sair.
--
-- **O índice da trilha por ocorrência** serve o `LATERAL` do sino. Os que
-- existiam eram por organização e o parcial da origem (005).
-- ----------------------------------------------------------------------------

create table leituras_de_ocorrencia (
  organizacao_id  uuid        not null,
  ocorrencia_id   uuid        not null,
  pessoa_id       uuid        not null,
  lido_ate        timestamptz not null default now(),

  constraint leituras_de_ocorrencia_pk primary key (ocorrencia_id, pessoa_id),

  constraint leituras_de_ocorrencia_ocorrencia_fk
    foreign key (ocorrencia_id, organizacao_id)
    references ocorrencias (id, organizacao_id) on delete restrict,

  constraint leituras_de_ocorrencia_pessoa_fk
    foreign key (pessoa_id, organizacao_id)
    references vinculos (pessoa_id, organizacao_id) on delete cascade
);

comment on table leituras_de_ocorrencia is
  'Até onde cada Pessoa leu cada ocorrência (item 117). Não lida = há novidade de outra pessoa depois de '
  'lido_ate, ou não há linha. Não guarda destinatário: quem recebe aviso é derivado na leitura.';

create index registros_transicao_ocorrencia_ocorreu_ix
  on registros_transicao (ocorrencia_id, ocorreu_em desc);

insert into leituras_de_ocorrencia (organizacao_id, ocorrencia_id, pessoa_id, lido_ate)
select organizacao_id, ocorrencia_id, com_pessoa_id, aberto_em
  from compartilhamentos
 where aberto_em is not null
on conflict (ocorrencia_id, pessoa_id) do nothing;

alter table compartilhamentos drop column aberto_em;

-- Como toda tabela do esquema (banco-de-dados.md, Só o servidor fala com o banco): RLS ligada e nenhuma
-- política, que no PostgreSQL é negação para quem não é o servidor.
alter table leituras_de_ocorrencia enable row level security;
