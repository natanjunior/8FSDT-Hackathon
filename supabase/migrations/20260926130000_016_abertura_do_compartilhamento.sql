-- ----------------------------------------------------------------------------
-- 016 · A abertura do compartilhamento — item 88
--
-- **Uma coluna, e não uma tabela de leituras.** A abertura é um fato sobre o
-- par ocorrência e pessoa, que é exatamente a chave da linha
-- (`compartilhamentos_pk`). Uma tabela à parte teria de ser apagada junto com
-- o desfazer, e um dia esqueceria.
--
-- **É estado por item, e não marco d'água por pessoa.** Um instante único
-- "li até aqui" responderia a pergunta errada: a pessoa abre a terceira e o
-- contador teria de decidir o que fazer com a primeira e a segunda. Com a
-- coluna na linha, "quantas ainda não abri" é um `count` de nulos, e desfazer
-- e refazer devolve a ocorrência à contagem sem nenhum código. Se um dia o
-- sino derivado nascer, ele lê daqui — o produto fica com um modelo de
-- leitura, e não dois.
--
-- **Nulo é o padrão e é o estado inicial**: linha nova é linha não aberta.
-- Nada retroativo: as linhas que existirem na hora desta migração nascem
-- nulas, que é a verdade, porque ninguém as abriu por esta via.
--
-- **Sem índice.** A contagem filtra por `(organizacao_id, com_pessoa_id)`, que
-- o `compartilhamentos_recebidos_ix` da 015 já cobre, e o número de linhas por
-- pessoa é pequeno. Se algum dia crescer, o índice é parcial,
-- `where aberto_em is null`.
--
-- **O relógio é do banco** (`now()`), como o carimbo de atualização do item 68b
-- (ADR-0016): dois relógios produzem duas verdades.
-- ----------------------------------------------------------------------------

alter table compartilhamentos add column aberto_em timestamptz null;

comment on column compartilhamentos.aberto_em is
  'Quando quem recebeu abriu a ocorrência pela primeira vez, ou nulo. Estado de quem lê, invisível para '
  'quem compartilhou (item 88).';
