-- ============================================================================
--  Migração 004 — `pedidos_de_entrada.telefone_informado`
--
--  **O campo existia no contrato e não existia no banco.** O `openapi.yaml`
--  declara `PessoaDoPedido.telefoneInformado` com a razão escrita por extenso —
--  "o pedido carrega apenas o telefone que a própria pessoa informou nele — um
--  valor, não uma lista" —, e a §6.15 do modelo lista oito colunas, nenhuma
--  delas telefone. Registrado como achado A-8-1 ao hub; a coluna entra porque
--  o critério 5 do item 8 depende dela.
--
--  **Por que não derivar de `contatos`.** `contatos` é tabela GLOBAL: não há
--  como saber se um número dela veio DESTE pedido ou de outra organização.
--  Devolvê-lo ao Gestor seria o vazamento que o schema do contrato existe para
--  impedir — o achado A-04 do backlog, chegando por dentro.
--
--  **O contato continua sendo gravado, e não é duplicação:** um é dado da
--  Pessoa, global e permanente (§6.17); o outro é dado do pedido, congelado no
--  instante em que ela pediu, e é o que este Gestor tem direito de ver antes de
--  aprovar.
-- ============================================================================

alter table pedidos_de_entrada
  add column telefone_informado varchar(16);

-- A terceira barreira do mesmo formato: o schema de entrada confere, a tela
-- converte, e o banco recusa o que passou pelos dois. É o mesmo CHECK de
-- `contatos.valor` para `tipo = 'telefone'` (modelo §6.17), e `varchar(16)` é o
-- teto do E.164 — `+` mais 15 dígitos.
alter table pedidos_de_entrada
  add constraint pedidos_de_entrada_telefone_e164_ck
    check (telefone_informado is null or telefone_informado ~ '^\+[1-9][0-9]{7,14}$');

comment on column pedidos_de_entrada.telefone_informado is
  'O telefone que a própria pessoa informou NESTE pedido, em E.164. Nulo quando não informou. É o que o '
  'Gestor vê em T-08 antes de decidir — nunca contatos[], que é global e traria contato cadastrado em '
  'outra organização (contrato, schema PessoaDoPedido).';
