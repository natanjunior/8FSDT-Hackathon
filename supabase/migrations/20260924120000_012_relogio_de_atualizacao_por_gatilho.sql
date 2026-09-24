-- ----------------------------------------------------------------------------
-- 012 · O relógio de `atualizado_em` passa a ser do banco — item 68b
--
-- **Fecha a questão que a `001` abriu e que a `002` e a `003` repetiram.** As
-- três registraram, em três redações, que nenhum documento decidia se o relógio
-- de atualização era mantido pelo banco ou pela aplicação, e deixaram a decisão
-- em aberto. Ela foi tomada, e está na ADR-0016: é do banco.
--
-- **`vinculos` ganha `atualizado_em` ANULÁVEL, sem `default`.** Nulo quer dizer
-- "nenhuma alteração registrada". Preencher as linhas de hoje com `criado_em`
-- seria a data de entrada disfarçada de atualização, e a coluna de tela existe
-- para não mostrar isso.
--
-- **Uma função, seis gatilhos.** As seis tabelas que carregam o par
-- `criado_em`/`atualizado_em`: `pessoas`, `organizacoes`, `vinculos`,
-- `categorias`, `areas` e `contatos`. Deixar de fora as tabelas que a aplicação
-- já carimbava à mão manteria dois regimes no mesmo esquema, sem nada que
-- dissesse qual vale onde — que é como o próximo escritor esquece. `contatos`
-- entra mesmo sem receber UPDATE hoje (a lista é substituída por DELETE e
-- INSERT): custa uma linha, e o próximo escritor não precisa lembrar.
--
-- **`ocorrencias.atualizada_em` fica de fora, por nome.** A `005` já a declarou
-- exceção. Ela responde outra pergunta — houve atividade nesta ocorrência, o
-- que inclui INSERT em `mensagens` — e quem a escreve é o agregado, com o
-- instante do comando. A semente de demonstração depende disso para ter datas
-- antigas; um `now()` de gatilho apagaria o mundo demonstrado.
--
-- **`create or replace`, e não `create`.** O ajudante de integração
-- (`testes/integracao/esquema.ts`) derruba as tabelas e reaplica todas as
-- migrações no mesmo banco. `drop table ... cascade` leva os gatilhos junto,
-- porque eles dependem das tabelas, mas NÃO leva a função, que não depende de
-- nada. Um `create` puro falharia na segunda execução — foi por isso que a
-- `005` precisou de uma linha de `drop function` naquele arquivo. Esta não
-- precisa.
--
-- **Só `pessoas` leva guarda `when`, e a razão é medida.**
-- `repositorioDePessoas.garantirParaUsuario` resolve o primeiro login com
-- `on conflict (usuario_id) do update set usuario_id = excluded.usuario_id`:
-- um UPDATE no-op cujo único papel é fazer o `returning` devolver a linha que
-- já existia. Sem a guarda, TODO LOGIN carimbaria a pessoa, e a coluna de
-- última atualização da tela viraria "último login" para quem tem conta.
--
-- **As outras cinco NÃO levam guarda, e isso também é decisão.** A tela de
-- editar participante salva contato mandando `areaId` junto sempre
-- (`corpoDaCorrecao`), então o UPDATE em `vinculos` chega com o MESMO
-- `area_id`: com guarda, o relógio do vínculo ficaria parado logo depois de uma
-- edição de verdade. Quem garante que não há carimbo à toa é a tela — Salvar
-- sem mudança nenhuma não manda requisição (`edicaoMudou`), e isso tem teste.
-- A divisão: a aplicação decide SE houve mudança, o banco decide QUANDO foi.
-- ----------------------------------------------------------------------------

alter table vinculos
  add column atualizado_em timestamptz;

comment on column vinculos.atualizado_em is
  'Quando esta linha de vínculo mudou pela última vez, escrito pelo gatilho. Nulo quer dizer nenhuma '
  'alteração registrada desde a migração 012: a tela mostra um traço, e nunca a data de entrada. A '
  'última atualização de um participante é a MAIOR entre este relógio e o de pessoas, e o de pessoas é '
  'global — quem troca o próprio nome move a data em toda organização onde participa, e nenhuma tela '
  'diz quem mexeu. A premissa está na ADR-0016.';

create or replace function carimbar_atualizado_em() returns trigger as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$ language plpgsql;

comment on function carimbar_atualizado_em() is
  'O relógio de atualização, mantido pelo banco (ADR-0016). Uma função para as seis tabelas que '
  'carregam o par criado_em/atualizado_em. NÃO vale para ocorrencias.atualizada_em, que é carimbo de '
  'domínio escrito pelo agregado com o instante do comando (migração 005).';

-- `pessoas` é a única com guarda, e o cabeçalho diz por quê.
create trigger pessoas_atualizado_em_tg
  before update on pessoas
  for each row when (old.* is distinct from new.*)
  execute function carimbar_atualizado_em();

create trigger organizacoes_atualizado_em_tg
  before update on organizacoes
  for each row execute function carimbar_atualizado_em();

create trigger vinculos_atualizado_em_tg
  before update on vinculos
  for each row execute function carimbar_atualizado_em();

create trigger categorias_atualizado_em_tg
  before update on categorias
  for each row execute function carimbar_atualizado_em();

create trigger areas_atualizado_em_tg
  before update on areas
  for each row execute function carimbar_atualizado_em();

create trigger contatos_atualizado_em_tg
  before update on contatos
  for each row execute function carimbar_atualizado_em();
