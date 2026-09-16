-- ----------------------------------------------------------------------------
-- 010 · `organizacoes.atualizado_por_pessoa_id` — item 46 · 47
--
-- **Supera o comentário da migração `001`** que diz, sobre `logo_caminho`,
-- "não existe PATCH /organizacao na primeira entrega". A partir daqui existe:
-- `PATCH /organizacoes`, com `{ nome? }`. A `001` NÃO é editada — migração
-- aplicada é artefato de histórico, e reescrever o conteúdo de uma que já rodou
-- é como se cria divergência de checksum. A correção mora aqui.
--
-- **O que continua verdadeiro na 001:** nada escreve `logo_caminho`. O `PATCH`
-- não aceita esse campo, e o caminho da logo segue decidido — vira uma linha em
-- `anexos` (modelo §6.3).
--
-- **Por que a coluna existe** (modelo §7.7, "Auditoria de configuração"):
-- `categorias` e `areas` já gravam `criado_por`/`atualizado_por`, na forma
-- "última escrita". `organizacoes` é a terceira tabela de configuração, e
-- responder diferente para ela criaria exceção a uma decisão declarada.
-- `atualizado_em` já existia e não tinha escritor; gravar *quando* sem *quem*
-- responderia metade da pergunta.
--
-- **Não é tabela de histórico**, que já foi rejeitada com argumento em
-- modelo §7.7: o RNF9 é sobre a trilha da ocorrência, não sobre configuração.
-- Renomear não é transição de status e não encosta na ADR-0001.
-- ----------------------------------------------------------------------------

alter table organizacoes
  add column atualizado_por_pessoa_id uuid;

comment on column organizacoes.atualizado_por_pessoa_id is
  'Quem escreveu por último nesta linha — a auditoria de configuração da modelo §7.7, na forma "última '
  'escrita". Nula enquanto ninguém corrigiu: na criação ninguém alterou nada, e quem criou está em '
  'criada_por_pessoa_id.';

-- ----------------------------------------------------------------------------
-- **NÃO é `deferrable`, e a diferença é real.**
--
-- A FK de `criada_por_pessoa_id` é diferida porque a organização entra ANTES do
-- vínculo, na mesma transação da POL-01 (modelo §6.3). Aqui o vínculo já existe
-- há tempo: quem corrige tem `organizacao.configurar`, e essa permissão só
-- existe sobre vínculo vivo.
--
-- Consequência declarada: esta é a NONA tabela cuja chave para `vinculos` erra
-- no próprio `delete` — e a primeira chave `on delete restrict` em
-- `organizacoes`, que até aqui só tinha a diferida. O Gestor que corrigiu o nome
-- passa a não poder ser removido por `DELETE /vinculos/{pessoaId}`, e a razão
-- devolvida continua sendo o valor único `historico`. É o mesmo regime que quem
-- renomeia uma categoria já paga. `impedimentosDeRemocao` cobre o caso na mesma
-- entrega.
-- ----------------------------------------------------------------------------

alter table organizacoes
  add constraint organizacoes_atualizado_por_fk
    foreign key (atualizado_por_pessoa_id, id)
    references vinculos (pessoa_id, organizacao_id) on delete restrict;
