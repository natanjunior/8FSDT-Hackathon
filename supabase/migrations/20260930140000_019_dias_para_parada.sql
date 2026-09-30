-- ---------------------------------------------------------------------------
-- 019 · Os dias sem atividade ate a ocorrencia contar como parada — item 101
--
-- **A terceira regra da organizacao**, no modelo que a 017 criou: coluna
-- tipada em `organizacoes`, e a mudanca dela na trilha do mesmo gatilho.
--
-- **Nao nasce relogio novo aqui, e e o ponto do item.** O que mede "sem
-- atividade" e `ocorrencias.atualizada_em`, carimbada pelo agregado com o
-- instante do comando (005), e mantida FORA do gatilho de relogio pela 012
-- justamente porque ela responde "houve atividade nesta ocorrencia" — o que
-- inclui INSERT em `mensagens`. A decisao e a ADR-0016. Esta migracao guarda
-- apenas QUANTOS DIAS a organizacao tolera; derivar de `registros_transicao`
-- seria um segundo relogio contradizendo o primeiro.
--
-- **A faixa e 1 a 90, e o `check` e a ultima linha.** A aplicacao recusa
-- antes, no schema de `PATCH /configuracao`; o `check` existe para quem chega
-- por fora dela — e a mesma divisao de trabalho da 017.
--
-- **A restricao da trilha e o gatilho sao REFEITOS, e as migracoes anteriores
-- nao sao editadas** — o precedente e a 010, que superou a 001 por escrito. A
-- lista de chaves abaixo e a que a 018 deixou (as duas regras da 017 mais as
-- seis de rotulo do item 100) MAIS `dias_para_parada`: reescreve-la com a
-- lista da 017 apagaria a trilha de rotulos. `create or replace function`
-- basta para o corpo; a lista de colunas do `after update of` e fixada na
-- criacao do gatilho, entao ele cai e nasce de novo na mesma transacao.
-- ---------------------------------------------------------------------------

alter table organizacoes
  add column dias_para_parada integer not null default 7,
  add constraint organizacoes_dias_para_parada_ck
    check (dias_para_parada between 1 and 90);

comment on column organizacoes.dias_para_parada is
  'Quantos dias sem atividade ate a ocorrencia contar como parada (D31). De 1 a 90, padrao 7. A '
  'atividade e ocorrencias.atualizada_em; os terminais e pausada nao contam.';

alter table mudancas_de_configuracao
  drop constraint mudancas_de_configuracao_chave_ck;

alter table mudancas_de_configuracao
  add constraint mudancas_de_configuracao_chave_ck
    check (chave in (
      'exigir_solucao_ao_resolver',
      'limite_cancelamento_solicitante',
      'dias_para_parada',
      'rotulo_aberta',
      'rotulo_em_analise',
      'rotulo_em_atendimento',
      'rotulo_pausada',
      'rotulo_resolvida',
      'rotulo_cancelada'
    ));

create or replace function organizacoes_registra_mudanca_de_configuracao() returns trigger as $$
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

  if new.dias_para_parada is distinct from old.dias_para_parada then
    insert into mudancas_de_configuracao
      (organizacao_id, chave, valor_anterior, valor_novo, autor_pessoa_id)
    values
      (new.id, 'dias_para_parada', old.dias_para_parada::text,
       new.dias_para_parada::text, new.atualizado_por_pessoa_id);
  end if;

  return null;
end;
$$ language plpgsql;

comment on function organizacoes_registra_mudanca_de_configuracao() is
  'Grava uma linha em mudancas_de_configuracao por regra que mudou de valor, com o OLD da linha travada '
  'pelo update. Migracao 017 (item 99), com dias_para_parada acrescentada pela 019 (item 101).';

drop trigger organizacoes_mudanca_de_configuracao_tg on organizacoes;

create trigger organizacoes_mudanca_de_configuracao_tg
  after update of exigir_solucao_ao_resolver, limite_cancelamento_solicitante, dias_para_parada
    on organizacoes
  for each row
  when (old.exigir_solucao_ao_resolver is distinct from new.exigir_solucao_ao_resolver
        or old.limite_cancelamento_solicitante is distinct from new.limite_cancelamento_solicitante
        or old.dias_para_parada is distinct from new.dias_para_parada)
  execute function organizacoes_registra_mudanca_de_configuracao();
