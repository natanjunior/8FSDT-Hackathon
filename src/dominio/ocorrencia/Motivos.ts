/**
 * Os motivos estruturados de `pausar` e `cancelar` — a invariante 5 (D8, D12, D23).
 *
 * **`MOTIVOS_DE_PAUSA` passou a ser exercido no item 23**, que é o comando `pausar`: ele é o domínio de
 * valor do `pausaSchema` e o campo obrigatório de `RegistroDeTransicao.pausa`.
 * **`MOTIVOS_DE_CANCELAMENTO` passou a ser exercido no item 18**, que é o comando `cancelar`: ele é o
 * domínio de valor do `cancelamentoSchema` e o campo obrigatório de `RegistroDeTransicao.cancelamento`.
 */
export const MOTIVOS_DE_PAUSA = [
  "aguardando_informacao_solicitante",
  "aguardando_peca",
  "aguardando_autorizacao",
  "aguardando_terceiro",
] as const;

export type MotivoPausa = (typeof MOTIVOS_DE_PAUSA)[number];

/**
 * **Um conjunto só, não dois** (`modelo-de-dados.md` §5). As listas da D5 são por papel, `duplicada` está
 * nas duas, e a divisão é **autorização, não domínio de valor**.
 */
export const MOTIVOS_DE_CANCELAMENTO = [
  "desistencia",
  "resolvido_por_conta_propria",
  "aberta_por_engano",
  "duplicada",
  "improcedente",
  "fora_de_escopo",
  "sem_informacao_suficiente",
] as const;

export type MotivoCancelamento = (typeof MOTIVOS_DE_CANCELAMENTO)[number];

/**
 * **Os quatro motivos que o Solicitante autor pode escolher** (D5, `contrato-de-api.md` §8.4 e
 * `openapi.yaml:1972-1973`). O Gestor usa os sete.
 *
 * **Lista literal, e não `MOTIVOS_DE_CANCELAMENTO.slice(0, 4)`.** O `slice` daria o mesmo resultado
 * **hoje**, por coincidência da ordem em que o enum `motivo_cancelamento` foi escrito na migração 005 —
 * e ninguém vai lembrar de conferi-lo ao inserir o oitavo motivo no meio. O tipo `MotivoCancelamento`
 * faz o compilador cobrar que os quatro sejam membros; a **intenção** é o que só a lista literal escreve.
 */
export const MOTIVOS_DO_AUTOR: readonly MotivoCancelamento[] = [
  "desistencia",
  "resolvido_por_conta_propria",
  "aberta_por_engano",
  "duplicada",
];

/**
 * **O conjunto de motivos que estas permissões alcançam.**
 *
 * **Por que o CONJUNTO mora no Domínio e a CHECAGEM não.** O `modelo-de-dados.md:703-707` diz que os
 * motivos são *"um conjunto só, não dois … quem pode escolher qual valor é **checagem da camada de
 * aplicação**"* — e as duas frases convivem: o Domínio sabe **quais** valores existem e **como** eles se
 * repartem por permissão (é vocabulário do negócio, e é estável); quem **recusa** a requisição de quem
 * mandou o valor errado é o comando de aplicação, que é onde a identidade de quem chama existe. É o
 * precedente de `PERMISSAO_DO_COMANDO`, no mesmo anel: o mapa é do Domínio, a recusa é da Aplicação.
 * *(Achado **A-2** da spec do item 18: a frase do modelo lê como se o conjunto também fosse da
 * Aplicação. É emenda de documento, não contradição de código.)*
 *
 * **Recebe `permissoes`, e não um booleano `ehGestor`** — é a forma de `PerguntaDeAcoes.permissoes` e de
 * `ContextoDoComando.permissoes`: *"permissão é lista, nunca papel"* (contrato §4.5).
 *
 * **Uma fonte, dois consumidores:** o comando de aplicação (que lança o `422`) e a projeção que monta as
 * opções do modal. Duas listas divergiriam, e a divergência seria um motivo oferecido em tela que o
 * servidor recusa no clique.
 */
export function motivosPermitidos(permissoes: readonly string[]): readonly MotivoCancelamento[] {
  return permissoes.includes("ocorrencia.cancelar_qualquer")
    ? MOTIVOS_DE_CANCELAMENTO
    : MOTIVOS_DO_AUTOR;
}
