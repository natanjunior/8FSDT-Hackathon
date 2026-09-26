-- ----------------------------------------------------------------------------
-- 014 · `pessoas` perde a coluna de anonimização e o CHECK dela — item 78
--
-- `anonimizada_em` existe desde a 001 e nunca recebeu uma linha: nenhum
-- comando, rota ou repositório a escreve. O CHECK que a acompanhava
-- (`pessoas_anonimizada_sem_conta_ck`) só restringia essa coluna, e sai antes
-- dela.
--
-- **O que fica, e é o que protege a trilha.** `pessoas_usuario_fk` continua
-- `on delete set null`: apagar a conta no provedor não apaga a Pessoa, e as
-- ocorrências e os registros de transição continuam apontando para ela.
--
-- **O comentário de `anexos.nome_arquivo` é regravado aqui** porque `comment
-- on` mora no banco: corrigir só o arquivo da 007 deixaria o banco hospedado
-- com o texto antigo. A 007 passa a ter o mesmo texto, e um banco novo chega
-- ao mesmo estado por qualquer caminho.
-- ----------------------------------------------------------------------------

alter table pessoas drop constraint pessoas_anonimizada_sem_conta_ck;

alter table pessoas drop column anonimizada_em;

comment on column anexos.nome_arquivo is
  'Anulavel, e sempre nulo pelo nosso cliente: o arquivo e recomprimido no aparelho, entao o nome '
  'original e residuo de outro arquivo. PODE conter dado pessoal escrito por quem enviou.';
