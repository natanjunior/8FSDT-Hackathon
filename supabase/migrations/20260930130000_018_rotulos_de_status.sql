-- ----------------------------------------------------------------------------
-- 018 · Os rótulos de status por organização — item 100
--
-- **O texto que quem ABRIU lê**, e só ele. O Gestor, o Responsável, o painel e
-- o histórico oficial continuam com o nome do ciclo: se todo mundo visse o
-- rótulo da organização, o nome interno deixaria de existir e o vocabulário do
-- produto quebraria por organização. É a D19 — rótulo é apresentação, não
-- conceito.
--
-- **Linha só quando customizado.** Sem linha, vale o padrão, e nenhuma
-- organização nasce com seis linhas. É o que torna a pergunta *"esta
-- organização mexeu no texto?"* respondível pela existência da linha.
--
-- **Três colunas, e a ausência da quarta é decisão.** Não há coluna de autor
-- nem de instante: quem guarda *quem* e *quando* é `mudancas_de_configuracao`,
-- da 017. Uma coluna de autor aqui repetiria a última linha da trilha e traria
-- uma chave estrangeira nova para `vinculos`, que é rastro a mais no caminho de
-- remover vínculo.
--
-- **Quem restringe o estado é `status_ocorrencia`** (migração 005). Um `check`
-- com os seis nomes seria a segunda cópia da mesma lista, e é a segunda cópia
-- que diverge.
--
-- **Sem índice**: seis linhas no máximo por organização, e a leitura filtra pela
-- chave primária (a regra das tabelas pequenas, migração 001).
-- ----------------------------------------------------------------------------

create table rotulos_de_status (
  organizacao_id  uuid              not null,
  estado          status_ocorrencia not null,
  rotulo          text              not null,

  primary key (organizacao_id, estado),

  constraint rotulos_de_status_organizacao_fk
    foreign key (organizacao_id) references organizacoes (id) on delete restrict,

  -- Aparado e de 1 a 40. O vazio não é rótulo: vazio É o padrão, e o padrão se
  -- representa pela ausência da linha.
  constraint rotulos_de_status_rotulo_ck
    check (rotulo = btrim(rotulo) and char_length(rotulo) between 1 and 40)
);

comment on table rotulos_de_status is
  'O texto com que o Solicitante lê cada ponto do ciclo nesta organização (D19). Linha só quando '
  'customizado; sem linha, vale o padrão. Não muda o nome do ciclo, que é o que o Gestor lê.';

comment on column rotulos_de_status.rotulo is
  'Até 40 caracteres, aparado. Em pausada ele substitui as quatro frases por motivo, e o motivo passa a '
  'aparecer na segunda linha da lista e na nota da régua do ciclo.';

-- ----------------------------------------------------------------------------
-- A trilha da 017 passa a aceitar as seis chaves de rótulo.
--
-- **O padrão vai como texto vazio**, e não como a palavra "padrão": um Gestor
-- pode escrever `padrao` como rótulo, e o `check (valor_anterior <> valor_novo)`
-- recusaria "de padrão para padrão". Rótulo vazio nunca é gravado, então `''`
-- não colide com nada.
-- ----------------------------------------------------------------------------

alter table mudancas_de_configuracao
  drop constraint mudancas_de_configuracao_chave_ck;

alter table mudancas_de_configuracao
  add constraint mudancas_de_configuracao_chave_ck
    check (chave in (
      'exigir_solucao_ao_resolver',
      'limite_cancelamento_solicitante',
      'rotulo_aberta',
      'rotulo_em_analise',
      'rotulo_em_atendimento',
      'rotulo_pausada',
      'rotulo_resolvida',
      'rotulo_cancelada'
    ));

-- **O comentário da 017 deixou de ser verdadeiro, e este o substitui.** Ele
-- dizia que a trilha é escrita pelo gatilho, "nunca pela aplicação". As regras
-- continuam vindo do gatilho de `organizacoes`; os rótulos vêm da aplicação, na
-- mesma transação da escrita, porque um gatilho na tabela de rótulos não sabe
-- quem apagou uma linha — a linha apagada carrega o autor da escrita anterior.
comment on table mudancas_de_configuracao is
  'Uma linha por mudança de configuração da organização (D30). As regras são escritas pelo gatilho de '
  'organizacoes; os rótulos de status, pela aplicação, na mesma transação e com a linha da organização '
  'travada. Append-only, com a porta nomeada da remoção da demonstração (013).';
