-- ----------------------------------------------------------------------------
-- 013 · A trilha ganha uma porta nomeada para a remoção da demonstração — item 74
--
-- **O gatilho continua ligado, e continua o mesmo.** Muda só o corpo da função
-- que ele chama. `update` segue recusado sempre. `delete` passa a ser aceito
-- numa única condição: a transação corrente declarou, por nome, que é a remoção
-- da demonstração.
--
--     select set_config('resolveai.remocao_da_demonstracao', 'sim', true);
--
-- O terceiro argumento `true` faz o valor valer só até o fim da transação, no
-- `commit` e no `rollback`. Quem liga é `semente/remocao.ts`, e só ele.
--
-- **Por que uma variável e não `alter table ... disable trigger`.** Desligar o
-- gatilho exige ser dono da tabela e deixa a trilha sem defesa para TODAS as
-- sessões até o `enable`. A variável vale só para a transação que a liga, e a
-- exceção fica escrita aqui, onde quem lê o esquema a encontra.
--
-- **O que a exceção custa.** Qualquer código com acesso SQL pode ligar a
-- variável. O que o gatilho defende é o engano de código, um repositório que
-- emitisse `delete` na trilha, e esse engano não liga por acidente uma
-- variável com este nome. Quem tem o banco na mão já podia `drop trigger`.
--
-- **Compara com 'sim', nunca testa nulo.** Depois de uma transação que ligou a
-- variável, a mesma conexão devolve string vazia, e não nulo, porque o
-- parâmetro fica declarado na sessão.
--
-- **A mensagem de recusa não muda.** `testes/integracao/ocorrencia.test.ts`
-- casa com `append-only`.
--
-- **`create or replace`.** O gatilho da `005` aponta para a função pelo nome e
-- não precisa ser recriado. E o ajudante de integração, que reaplica todas as
-- migrações no mesmo banco, cria a função pela `005` e a substitui aqui.
--
-- Num gatilho `before ... for each statement`, o valor devolvido é ignorado: o
-- comando segue se a função não levantar exceção.
-- ----------------------------------------------------------------------------

create or replace function registros_transicao_append_only() returns trigger as $$
begin
  if tg_op = 'DELETE'
     and current_setting('resolveai.remocao_da_demonstracao', true) = 'sim' then
    return null;
  end if;

  raise exception 'registros_transicao e append-only (ADR-0001): % recusado', tg_op;
end;
$$ language plpgsql;

comment on function registros_transicao_append_only() is
  'Recusa update sempre, e delete fora da transacao que ligou resolveai.remocao_da_demonstracao = sim '
  '(semente/remocao.ts). Migracao 013, item 74.';
