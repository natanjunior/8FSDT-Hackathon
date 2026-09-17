-- ----------------------------------------------------------------------------
-- 011 · `areas.tipo_alterado_em` e `areas.tipo_alterado_por_pessoa_id` — item 50
--
-- **Supera o comentário de coluna da migração `002`** que diz que
-- `areas.atualizado_por_pessoa_id` responde "quem tornou esta Área comum, e
-- quando?". Ela não responde: é a última escrita, e `PATCH /areas/{id}` a
-- carimba em qualquer campo desde o item 5. Quem renomeia uma Área depois de
-- outra pessoa a ter tornado comum passava a ser a resposta. Com a reordenação
-- (item 50), um arrasto trocaria o nome em todas as linhas de uma vez.
--
-- A `002` NÃO é editada: migração aplicada é artefato de histórico, e
-- reescrever uma que já rodou cria divergência de checksum. A correção mora
-- aqui, como na `010`.
--
-- **O par é escrito só por `PATCH /areas/{id}`, e só quando `tipo` muda de
-- valor.** Nenhuma outra escrita o toca: nem `nome`, nem `ativa`, nem `ordem`,
-- nem a reordenação.
--
-- **As linhas que já existem ficam com o par nulo.** Não há de onde tirar o
-- valor: a última escrita delas pode ter sido qualquer campo. Nulo quer dizer
-- "nenhuma reclassificação registrada desde a 011".
-- ----------------------------------------------------------------------------

alter table areas
  add column tipo_alterado_em timestamptz,
  add column tipo_alterado_por_pessoa_id uuid;

-- O par vem inteiro: "quando" sem "quem", ou o contrário, é meia resposta.
alter table areas
  add constraint areas_tipo_alterado_par_ck
    check ((tipo_alterado_em is null) = (tipo_alterado_por_pessoa_id is null));

-- ----------------------------------------------------------------------------
-- **NÃO é `deferrable`**, pelo mesmo argumento da `010`: quem reclassifica tem
-- `organizacao.configurar`, e essa permissão só existe sobre vínculo vivo.
--
-- Consequência declarada: quem reclassificou uma Área deixa de poder ser
-- removido por `DELETE /vinculos/{pessoaId}`, no mesmo regime de quem a
-- renomeou. `impedimentosDeRemocao` cobre o caso na mesma entrega.
-- ----------------------------------------------------------------------------

alter table areas
  add constraint areas_tipo_alterado_por_fk
    foreign key (tipo_alterado_por_pessoa_id, organizacao_id)
    references vinculos (pessoa_id, organizacao_id) on delete restrict;

comment on column areas.tipo_alterado_em is
  'Quando o TIPO desta Área mudou de valor pela última vez. Nulo enquanto nenhuma reclassificação foi '
  'registrada desde a migração 011.';

comment on column areas.tipo_alterado_por_pessoa_id is
  'Quem mudou o TIPO desta Área pela última vez: a pergunta de privacidade da modelo §6.6, "quem tornou '
  'esta Área comum, e quando?". Com o par nulo, nenhuma reclassificação foi registrada desde a 011: se a '
  'Área nasceu comum, a resposta é criado_por_pessoa_id (nulo nas sementes da POL-01); se é anterior à '
  '011, uma reclassificação antiga não deixou registro.';

comment on column areas.atualizado_por_pessoa_id is
  'Quem escreveu por último nesta linha, em qualquer campo, inclusive a posição na lista: a auditoria de '
  'configuração da modelo §7.7, na forma "última escrita", a mesma de categorias e organizacoes. A '
  'pergunta de privacidade mora em tipo_alterado_por_pessoa_id.';
