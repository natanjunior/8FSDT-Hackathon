/**
 * O que um Papel autoriza.
 *
 * **A checagem pergunta `vinculo.pode(X)`, nunca `vinculo.papel == GESTOR`** (arquitetura.md, Parte II,
 * tópico 5; contrato §4.5). Não é preferência de estilo: a `PRIMARY KEY (pessoa_id, organizacao_id)` de
 * `vinculos` depende disso (modelo-de-dados.md §6.4) — se a checagem fosse por papel, o Gestor que mora no
 * prédio precisaria de um segundo vínculo, que é exatamente o que a chave proíbe.
 *
 * O mapa `papel → permissões` é constante em código, e é a tabela de contrato §4.5 transcrita.
 */
export const PERMISSOES = [
  "ocorrencia.registrar",
  "ocorrencia.ler_propria",
  "ocorrencia.ler_todas",
  "ocorrencia.comentar",
  "ocorrencia.analisar",
  "ocorrencia.alterar_prioridade",
  "ocorrencia.atribuir",
  "ocorrencia.iniciar_atendimento",
  "ocorrencia.pausar",
  "ocorrencia.retomar",
  "ocorrencia.registrar_solucao",
  "ocorrencia.resolver",
  "ocorrencia.cancelar_propria",
  "ocorrencia.cancelar_qualquer",
  "ocorrencia.avaliar",
  "organizacao.configurar",
  "vinculo.gerir",
  "dashboard.ler",
] as const;

export type Permissao = (typeof PERMISSOES)[number];

/**
 * As permissões do Solicitante. O Gestor **acumula** todas elas (contrato §4.5): *"o papel define a visão
 * padrão e o conjunto de permissões; não retira capacidade que o enunciado concede"*.
 */
const DO_SOLICITANTE: readonly Permissao[] = [
  "ocorrencia.registrar",
  "ocorrencia.ler_propria",
  "ocorrencia.comentar",
  "ocorrencia.cancelar_propria",
  "ocorrencia.avaliar",
];

/** O que o Gestor tem **além** do que o Solicitante tem. */
const SO_DO_GESTOR: readonly Permissao[] = [
  "ocorrencia.ler_todas",
  "ocorrencia.analisar",
  "ocorrencia.alterar_prioridade",
  "ocorrencia.atribuir",
  "ocorrencia.iniciar_atendimento",
  "ocorrencia.pausar",
  "ocorrencia.retomar",
  "ocorrencia.registrar_solucao",
  "ocorrencia.resolver",
  "ocorrencia.cancelar_qualquer",
  "organizacao.configurar",
  "vinculo.gerir",
  "dashboard.ler",
];

/**
 * O mapa, por papel.
 *
 * **O Encarregado tem lista vazia, e não é esquecimento** (contrato §4.5): as cinco capacidades do acesso
 * próprio dele são evolução prevista. Um vínculo `encarregado` autentica, recebe `permissoes: []` e leva
 * `403 PERMISSAO_INSUFICIENTE` em qualquer endpoint de negócio. O contrato **declara** esse estado.
 */
export const PERMISSOES_POR_PAPEL = {
  solicitante: DO_SOLICITANTE,
  gestor: [...DO_SOLICITANTE, ...SO_DO_GESTOR],
  encarregado: [] as readonly Permissao[],
} as const;
