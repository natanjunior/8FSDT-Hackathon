-- ----------------------------------------------------------------------------
-- 023 · Os envios do convite por e-mail — item 122
--
-- **A primeira tabela de mensagem que saiu.** Cada linha é um e-mail que o
-- provedor aceitou: o endereço daquele instante, o dia, e quem enviou. Envio
-- que falhou não fica gravado (a transação desfaz), então a tabela é o que
-- saiu, e não o que se tentou.
--
-- **Os dois limites são do banco.** Um por dia por endereço na organização é
-- o índice único sobre `lower(email)` e o dia de Brasília. Dez por
-- participante é contagem, feita com o convite vivo travado.
--
-- **A chave para o convite é `set null`.** Remover um participante sem rastro
-- apaga o convite dele (022, `cascade`); o envio fica, sem o elo, e o índice
-- do dia continua recusando o mesmo endereço. Quem enviou é rastro: `restrict`.
--
-- Nenhum caminho de código faz `update` nem `delete` nesta tabela.
-- ----------------------------------------------------------------------------

-- A chave composta abaixo precisa de um único sobre o par, como `areas` e
-- `categorias` (002).
alter table convites_pessoais
  add constraint convites_pessoais_id_organizacao_uk unique (id, organizacao_id);

create table envios_de_convite (
  id                     uuid         not null default gen_random_uuid(),
  organizacao_id         uuid         not null,
  -- Aceita nulo só pelo `set null`: o código sempre grava.
  convite_pessoal_id     uuid,
  email                  varchar(255) not null,
  -- Coluna com padrão, e não gerada: coluna gerada não aceita `now()`.
  dia                    date         not null default (now() at time zone 'America/Sao_Paulo')::date,
  enviado_por_pessoa_id  uuid         not null,
  enviado_em             timestamptz  not null default now(),

  constraint envios_de_convite_pk primary key (id),

  constraint envios_de_convite_organizacao_fk
    foreign key (organizacao_id) references organizacoes (id) on delete restrict,

  -- A lista de colunas é o que mantém a organização: sem ela, o `set null`
  -- anularia também `organizacao_id`, que é `not null`.
  constraint envios_de_convite_convite_fk
    foreign key (convite_pessoal_id, organizacao_id)
    references convites_pessoais (id, organizacao_id)
    on delete set null (convite_pessoal_id),

  constraint envios_de_convite_enviado_por_fk
    foreign key (enviado_por_pessoa_id, organizacao_id)
    references vinculos (pessoa_id, organizacao_id) on delete restrict
);

comment on table envios_de_convite is
  'Os convites pessoais que saíram por e-mail (item 122): um por linha, só os que o provedor aceitou. '
  'É o registro que o aviso por canal externo vai reusar: não se deriva uma mensagem que já saiu.';

create unique index envios_de_convite_dia_uk
  on envios_de_convite (organizacao_id, lower(email), dia);

-- A contagem de dez por participante junta pelo convite.
create index envios_de_convite_convite_ix
  on envios_de_convite (convite_pessoal_id);

-- Como toda tabela do esquema (banco-de-dados.md, Só o servidor fala com o banco): RLS ligada e nenhuma
-- política, que no PostgreSQL é negação para quem não é o servidor.
alter table envios_de_convite enable row level security;
