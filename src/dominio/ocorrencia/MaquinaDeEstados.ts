import { COMANDOS, COMANDOS_IMPLEMENTADOS, type Comando } from "./Comando";
import { type StatusOcorrencia } from "./StatusOcorrencia";

/**
 * ============================================================================
 *  A tabela de transições — `arquitetura.md` Parte I, §4
 * ============================================================================
 *
 * **Nenhuma outra transição existe.** A máquina tem dois poços e nenhum caminho de volta: de `resolvida`
 * e de `cancelada` não se sai, e `pausada` é o único desvio que retorna — sempre para o estado de onde
 * saiu, lido do registro da pausa (invariante 6), e por isso `retomar` não tem destino fixo aqui.
 */
const TRANSICOES: Readonly<Record<StatusOcorrencia, readonly Comando[]>> = {
  aberta: ["analisar", "cancelar"],
  em_analise: ["iniciar-atendimento", "pausar", "cancelar"],
  em_atendimento: ["pausar", "resolver", "cancelar"],
  pausada: ["retomar", "cancelar"],
  resolvida: [],
  cancelada: [],
};

/**
 * A **tabela companheira** — os comandos que **não** transicionam e mesmo assim recusam por estado
 * (`arquitetura.md` §4, quadro de 22/08/2026, e `contrato-de-api.md` §8.4).
 *
 * **Não transicionar não é poder ser chamado de qualquer estado**, e a tabela acima não responde por eles
 * porque ela tem uma coluna `Para`.
 */
const SEM_TRANSICAO: Readonly<Record<Comando, readonly StatusOcorrencia[]>> = {
  // invariante 7 (D6): o dashboard tem de ser reproduzível, então o passado não muda
  "alterar-prioridade": ["aberta", "em_analise", "em_atendimento", "pausada"],
  // decidido em 22/08/2026: atribuir não é triar — é dizer de quem é
  "atribuir-responsavel": ["aberta", "em_analise", "em_atendimento", "pausada"],
  // solução aplicada descreve trabalho feito; antes do atendimento não há trabalho a descrever
  "registrar-solucao-aplicada": ["em_atendimento", "pausada"],
  // invariante 8 (D1): avaliar age sobre `resolvida` sem mudar o status
  avaliar: ["resolvida"],
  analisar: [],
  "iniciar-atendimento": [],
  pausar: [],
  retomar: [],
  resolver: [],
  cancelar: [],
};

/** A permissão que cada comando exige (contrato §4.5). `cancelar` tem duas, e é o único. */
const PERMISSAO_DO_COMANDO: Readonly<Record<Comando, readonly string[]>> = {
  analisar: ["ocorrencia.analisar"],
  "atribuir-responsavel": ["ocorrencia.atribuir"],
  "iniciar-atendimento": ["ocorrencia.iniciar_atendimento"],
  pausar: ["ocorrencia.pausar"],
  retomar: ["ocorrencia.retomar"],
  "registrar-solucao-aplicada": ["ocorrencia.registrar_solucao"],
  resolver: ["ocorrencia.resolver"],
  avaliar: ["ocorrencia.avaliar"],
  "alterar-prioridade": ["ocorrencia.alterar_prioridade"],
  cancelar: ["ocorrencia.cancelar_propria", "ocorrencia.cancelar_qualquer"],
};

/** `true` se o par (status, comando) está na tabela de transições. */
export function transicaoPermitida(status: StatusOcorrencia, comando: Comando): boolean {
  return TRANSICOES[status].includes(comando);
}

export type PerguntaDeAcoes = {
  status: StatusOcorrencia;
  /** As permissões de quem pergunta — `Vinculo.permissoes`. */
  permissoes: readonly string[];
  /** Se quem pergunta é o autor da ocorrência. Decide `cancelar_propria` e `avaliar`. */
  ehAutor: boolean;
  /** A metade *"uma vez só"* da invariante 8. */
  jaAvaliada?: boolean;
  /**
   * A lista de comandos construídos. **`undefined` usa `COMANDOS_IMPLEMENTADOS`**, que é o que a
   * produção faz; `null` desliga o filtro, e existe para o teste provar que a derivação é real.
   */
  filtro?: readonly Comando[] | null;
};

/**
 * ============================================================================
 *  `acoesDisponiveis` — as três fontes da §8.5, e o filtro
 * ============================================================================
 *
 * O contrato descreve a derivação em três fontes, e todas as três estão aqui:
 *
 * 1. **A tabela de transições** — de onde sai cada comando que transiciona.
 * 2. **A tabela companheira** — de onde saem os quatro que não transicionam e têm endpoint.
 * 3. **O que não é status nem permissão** — a metade *"uma vez só"* da invariante 8, e as checagens de
 *    **relação** com o recurso (ser o autor, em `avaliar` e em `cancelar`). *(A invariante 9 —
 *    `iniciarAtendimento` exige responsável atribuído — é do **comando de aplicação** e entra no item 22,
 *    que é quando `atribuicoes` existe.)*
 *
 * Se a lista não aplicasse as três, o cliente ou ofereceria um botão que falha sempre, ou
 * reimplementaria a regra — que é **exatamente a segunda cópia da máquina de estados** que este campo
 * existe para impedir.
 *
 * **A saída sai na ordem de `COMANDOS`**, e é o que dispensa o cliente de ter uma segunda lista só para
 * ordenar a barra.
 */
export function comandosDisponiveis(pergunta: PerguntaDeAcoes): readonly Comando[] {
  const permitidos = COMANDOS.filter((comando) => {
    // 1 e 2 — status
    const porEstado = TRANSICOES[pergunta.status].includes(comando)
      ? true
      : SEM_TRANSICAO[comando].includes(pergunta.status);
    if (!porEstado) return false;

    // permissão
    if (!PERMISSAO_DO_COMANDO[comando].some((p) => pergunta.permissoes.includes(p))) return false;

    // 3 — relação com o recurso, e a metade "uma vez só"
    if (comando === "avaliar") {
      if (!pergunta.ehAutor) return false;
      if (pergunta.jaAvaliada === true) return false;
    }
    if (comando === "cancelar" && !pergunta.permissoes.includes("ocorrencia.cancelar_qualquer")) {
      if (!pergunta.ehAutor) return false;
    }

    return true;
  });

  const filtro = pergunta.filtro === undefined ? COMANDOS_IMPLEMENTADOS : pergunta.filtro;
  return filtro === null ? permitidos : permitidos.filter((comando) => filtro.includes(comando));
}
