-- ----------------------------------------------------------------------------
-- 017 · As regras da organizacao, e a trilha das mudancas delas — item 99
--
-- **Duas regras, uma coluna cada.** A primeira existe desde a 001 e ninguem a
-- lia: `exigir_solucao_ao_resolver`. A segunda nasce aqui: ate onde o
-- Solicitante autor cancela a propria ocorrencia. O valor gravado e o ESTADO
-- ate o qual ele cancela, e o `check` aceita os dois de hoje; um terceiro valor
-- futuro e so o `check`.
--
-- **A trilha supera o comentario da 010**, que dizia que tabela de historico
-- de configuracao "ja foi rejeitada". Foi, e o argumento era que o RNF9 e sobre
-- a trilha da ocorrencia. Ele continua certo sobre o RNF9. O que mudou e a
-- razao de produto: uma configuracao que muda o comportamento das transicoes
-- sem deixar rastro seria a unica parte do sistema que nao pratica o que ele
-- prega. A decisao e a D30. A 010 nao e editada.
--
-- **Quem escreve a trilha e um gatilho, e nao contradiz a ADR-0001.** Ela
-- recusou gatilho como captura do historico da OCORRENCIA porque a diferenca
-- entre duas linhas nao produz a observacao. Aqui nao ha observacao: a mudanca
-- e o par de valores, e o `update` ja trava a linha, entao a segunda escrita de
-- dois Gestores le como OLD o que a primeira gravou (criterio 6).
--
-- **O autor e `atualizado_por_pessoa_id` da propria instrucao.** Mudanca de
-- regra sem autor e recusada. A remocao da demonstracao anula essa coluna
-- (`semente/remocao.ts`), mas nao toca regra, e o `when` do gatilho nao dispara.
--
-- **Sem indice**: dezenas de linhas por organizacao, e a leitura filtra por
-- `organizacao_id` (a regra das tabelas pequenas, migracao 001).
-- ----------------------------------------------------------------------------

alter table organizacoes
  add column limite_cancelamento_solicitante status_ocorrencia not null default 'em_analise',
  add constraint organizacoes_limite_cancelamento_ck
    check (limite_cancelamento_solicitante in ('em_analise', 'em_atendimento'));

comment on column organizacoes.limite_cancelamento_solicitante is
  'Ate qual estado o Solicitante autor cancela a propria ocorrencia (D29). Em em_atendimento, inclui '
  'pausada. O Gestor cancela em qualquer estado nao terminal, qualquer que seja o valor.';

create table mudancas_de_configuracao (
  id               uuid         primary key default gen_random_uuid(),
  organizacao_id   uuid         not null,
  chave            text         not null,
  valor_anterior   text         not null,
  valor_novo       text         not null,
  autor_pessoa_id  uuid         not null,
  ocorrida_em      timestamptz  not null default now(),

  constraint mudancas_de_configuracao_organizacao_fk
    foreign key (organizacao_id) references organizacoes (id) on delete restrict,
  constraint mudancas_de_configuracao_autor_fk
    foreign key (autor_pessoa_id, organizacao_id)
    references vinculos (pessoa_id, organizacao_id) on delete restrict,
  constraint mudancas_de_configuracao_chave_ck
    check (chave in ('exigir_solucao_ao_resolver', 'limite_cancelamento_solicitante')),
  constraint mudancas_de_configuracao_valores_ck
    check (valor_anterior <> valor_novo)
);

comment on table mudancas_de_configuracao is
  'Uma linha por mudanca de regra da organizacao (D30). Escrita pelo gatilho de organizacoes, nunca '
  'pela aplicacao; append-only, com a porta nomeada da remocao da demonstracao (013).';

create function organizacoes_registra_mudanca_de_configuracao() returns trigger as $$
begin
  if new.atualizado_por_pessoa_id is null then
    raise exception 'mudanca de configuracao sem autor: atualizado_por_pessoa_id vai na mesma instrucao';
  end if;

  if new.exigir_solucao_ao_resolver is distinct from old.exigir_solucao_ao_resolver then
    insert into mudancas_de_configuracao
      (organizacao_id, chave, valor_anterior, valor_novo, autor_pessoa_id)
    values
      (new.id, 'exigir_solucao_ao_resolver', old.exigir_solucao_ao_resolver::text,
       new.exigir_solucao_ao_resolver::text, new.atualizado_por_pessoa_id);
  end if;

  if new.limite_cancelamento_solicitante is distinct from old.limite_cancelamento_solicitante then
    insert into mudancas_de_configuracao
      (organizacao_id, chave, valor_anterior, valor_novo, autor_pessoa_id)
    values
      (new.id, 'limite_cancelamento_solicitante', old.limite_cancelamento_solicitante::text,
       new.limite_cancelamento_solicitante::text, new.atualizado_por_pessoa_id);
  end if;

  return null;
end;
$$ language plpgsql;

comment on function organizacoes_registra_mudanca_de_configuracao() is
  'Grava uma linha em mudancas_de_configuracao por regra que mudou de valor, com o OLD da linha travada '
  'pelo update. Migracao 017, item 99.';

create trigger organizacoes_mudanca_de_configuracao_tg
  after update of exigir_solucao_ao_resolver, limite_cancelamento_solicitante on organizacoes
  for each row
  when (old.exigir_solucao_ao_resolver is distinct from new.exigir_solucao_ao_resolver
        or old.limite_cancelamento_solicitante is distinct from new.limite_cancelamento_solicitante)
  execute function organizacoes_registra_mudanca_de_configuracao();

-- A imutabilidade, com a mesma porta nomeada da 013: `update` recusado sempre,
-- `delete` so na transacao que se declarou remocao da demonstracao.
create function mudancas_de_configuracao_append_only() returns trigger as $$
begin
  if tg_op = 'DELETE'
     and current_setting('resolveai.remocao_da_demonstracao', true) = 'sim' then
    return null;
  end if;

  raise exception 'mudancas_de_configuracao e append-only (D30): % recusado', tg_op;
end;
$$ language plpgsql;

comment on function mudancas_de_configuracao_append_only() is
  'Recusa update sempre, e delete fora da transacao que ligou resolveai.remocao_da_demonstracao = sim '
  '(semente/remocao.ts). Migracao 017, item 99.';

create trigger mudancas_de_configuracao_append_only_tg
  before update or delete on mudancas_de_configuracao
  for each statement execute function mudancas_de_configuracao_append_only();
