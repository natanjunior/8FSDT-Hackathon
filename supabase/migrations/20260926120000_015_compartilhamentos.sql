-- ----------------------------------------------------------------------------
-- 015 · Compartilhamentos — item 87
--
-- **O compartilhamento é dado, e não permissão.** Ninguém ganha papel nem
-- permissão: a linha diz que UMA ocorrência pode ser LIDA por UMA pessoa a
-- mais. Quem decide o que isso concede é `podeLerOcorrencia`, na Aplicação.
--
-- **Fora do agregado `Ocorrencia`.** Não muda status, não grava histórico, e
-- desfazer apaga a linha. Por isso também não toca `ocorrencias.atualizada_em`:
-- a lista não se reordena por compartilhar.
--
-- **As tres chaves compostas carregam `organizacao_id`** (banco-de-dados.md, O
-- escopo): uma linha que ligasse ocorrência de A a vínculo de B não grava.
--
-- **`com` apaga em cascata, `por` não.** Remover o vínculo sem histórico leva o
-- que a pessoa RECEBEU, que não é rastro. O que ela COMPARTILHOU aparece
-- nomeado na tela, é rastro, e conta como histórico: a remoção é recusada e o
-- caminho é revogar. Revogar é `update`, e não apaga linha nenhuma.
-- ----------------------------------------------------------------------------

create table compartilhamentos (
  organizacao_id    uuid        not null,
  ocorrencia_id     uuid        not null,
  com_pessoa_id     uuid        not null,
  por_pessoa_id     uuid        not null,
  compartilhado_em  timestamptz not null default now(),

  -- "Duas vezes não cria segunda linha" (critério 87.3). A escrita é
  -- `on conflict do nothing`, e duas abas terminam com uma linha e sem erro.
  constraint compartilhamentos_pk primary key (ocorrencia_id, com_pessoa_id),

  constraint compartilhamentos_ocorrencia_fk
    foreign key (ocorrencia_id, organizacao_id)
    references ocorrencias (id, organizacao_id) on delete restrict,

  constraint compartilhamentos_com_fk
    foreign key (com_pessoa_id, organizacao_id)
    references vinculos (pessoa_id, organizacao_id) on delete cascade,

  constraint compartilhamentos_por_fk
    foreign key (por_pessoa_id, organizacao_id)
    references vinculos (pessoa_id, organizacao_id) on delete restrict
);

comment on table compartilhamentos is
  'Uma ocorrência aberta, só para leitura, a uma pessoa da mesma organização. Dado, não permissão '
  '(item 87). Sem histórico: desfazer apaga a linha.';

-- A aba "Compartilhadas comigo": do lado de quem recebe, dentro da organização.
create index compartilhamentos_recebidos_ix
  on compartilhamentos (organizacao_id, com_pessoa_id);

-- Ligada e sem política, como as tabelas da 001 a 003: quem fala com o banco é
-- o servidor (banco-de-dados.md, Só o servidor fala com o banco).
alter table compartilhamentos enable row level security;
