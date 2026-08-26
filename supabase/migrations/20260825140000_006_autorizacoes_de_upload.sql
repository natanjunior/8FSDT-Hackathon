-- ============================================================================
--  Migração 006 — `autorizacoes_de_upload`, o livro-caixa de emissão
--
--  Fonte: spec do item 13a §3.1. **A tabela ainda NÃO está no
--  `modelo-de-dados.md`** — é o achado A-2 da spec, aprovado pelo hub e na fila
--  de documentação.
--
--  ## Por que uma tabela, e não memória de processo
--
--  O Container App sobe com `--min-replicas 0 --max-replicas 2`
--  (`trabalho/provisionamento.md`). Com duas réplicas, um contador em memória
--  concede **60 por hora em regime**, com a aplicação quente — e a segunda
--  réplica sobe exatamente sob carga, que é quando o limite importa. Não é
--  limitação declarável: é um controle que erra por 2x no único cenário em que
--  existe para agir.
--
--  ## Por que ela NÃO reabre a suposição S-A13 do contrato
--
--  A §10.2 recusou *"uma tabela de uploads pendentes"*. O teste que separa as
--  duas coisas, e ele é literal:
--
--      NADA NO CAMINHO DE REIVINDICAÇÃO LÊ ESTA TABELA.
--
--  O `ticket` continua sendo token assinado; a reivindicação (item 13b) confere
--  a assinatura e faz `HEAD` no objeto, e nunca consulta daqui. Esta tabela é
--  LIVRO-CAIXA DE EMISSÃO, com um único leitor —
--  `POST /anexos/autorizacoes`, para contar a última hora. Ela não guarda
--  `chave`, não guarda estado de objeto, e nenhuma consulta a liga a um anexo.
--
--  ## É a TERCEIRA tabela global do esquema, e sem `organizacao_id` de propósito
--
--  Depois de `pessoas` (§4.1) e `contatos` (§6.17 — o contrato a chama de "a
--  segunda tabela global do esquema" na §7). Aqui a razão é substantiva:
--
--   · o critério 13a.3 diz "a mesma PESSOA na mesma hora", e `pessoas` é global;
--   · o limite protege ARMAZENAMENTO, e a conta de armazenamento é UMA SÓ,
--     compartilhada por todas as organizações. Escopar daria 60/h a quem tem
--     dois vínculos — e transformaria "entrar em outra organização" num jeito
--     de dobrar a franquia.
--
--  Consequência declarada: a consulta do livro-caixa **não passa pelo
--  repositório escopado**. É a exceção, e o teste de integração do item 13a a
--  prova em vez de deixá-la parecer esquecimento.
-- ============================================================================

create table autorizacoes_de_upload (
  id          uuid        primary key default gen_random_uuid(),
  pessoa_id   uuid        not null references pessoas (id),
  emitida_em  timestamptz not null default now()
);

comment on table autorizacoes_de_upload is
  'Livro-caixa de emissão de autorizações de upload: uma linha por autorização concedida. Existe só para '
  'contar as 30 por Pessoa por hora do contrato §10.3. GLOBAL de propósito — sem organizacao_id, porque o '
  'limite protege a conta de armazenamento, que é uma só para todas as organizações. NADA NO CAMINHO DE '
  'REIVINDICAÇÃO LÊ ESTA TABELA: é o que preserva a suposição S-A13.';

comment on column autorizacoes_de_upload.pessoa_id is
  'Sem ON DELETE: `pessoas` nunca é apagada — o único DELETE do contrato é o de vínculo, e ele preserva a '
  'Pessoa (item 10). A FK existe pela integridade, não por um caminho de exclusão que não há.';

-- ----------------------------------------------------------------------------
-- Um índice, e só um.
--
-- Ele serve a ÚNICA leitura que existe: contar as emissões de uma Pessoa dentro
-- da janela. A limpeza oportunista (`emitida_em < now() - 1 hora`) varre a
-- tabela — e é o certo: ela nunca passa de (pessoas ativas na última hora x 30)
-- linhas, e um índice para ela seria um índice que nenhuma consulta usa. É o
-- mesmo critério com que a §6.16 do modelo recusou índices em `anexos`.
-- ----------------------------------------------------------------------------
create index autorizacoes_de_upload_janela
  on autorizacoes_de_upload (pessoa_id, emitida_em desc);
