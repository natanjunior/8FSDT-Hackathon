/**
 * ============================================================================
 *  A leitura do ciclo do enunciado — o que a régua de T-05 mostra
 * ============================================================================
 *
 * **Módulo puro, sem um único `import`**, pela mesma razão de `linha-do-tempo.ts`: ele atravessa a
 * fronteira servidor/cliente sem arrastar nada, e é testável num projeto que roda em `environment:
 * "node"` e não renderiza componente.
 *
 * **`Aberta → Em análise → Em atendimento → Resolvida` é `ENUNCIADO · literal`.** Os outros dois
 * status **não são etapas do caminho**, e cada um sai da linha por uma razão diferente — é o critério
 * 44d.7:
 *
 * - **`pausada` é estado SOBRE o atendimento.** O ciclo não anda e não recua: o que foi alcançado
 *   continua alcançado, e o que falta continua faltando.
 * - **`cancelada` é SAÍDA.** O que não foi alcançado deixa de ser *por alcançar* e passa a
 *   **inalcançável** — prometer um passo a quem não vai chegar lá é a tela mentindo.
 *
 * **As datas vêm da linha do tempo, não do detalhe.** `OcorrenciaDetalhe` traz `registradaEm`,
 * `ultimaTransicao` e o `status` atual, e nada mais; a data de cada passo só existe na trilha. Quem
 * chama passa as transições já formatadas — esta função não formata data, e não sabe o que é fuso.
 */
export const CICLO = ["aberta", "em_analise", "em_atendimento", "resolvida"] as const;

/** Uma transição da linha do tempo, reduzida ao que a régua usa. `em` já vem em palavra. */
export type TransicaoDoCiclo = { status: string; em: string };

export type PassoDoCiclo = {
  status: string;
  /** `null` quando o passo não foi alcançado — e a ausência de data é o que diz isso. */
  em: string | null;
  estado: "alcancado" | "atual" | "por-alcancar" | "inalcancavel";
};

/** O que ficou fora da linha reta, e depois de qual passo ele aconteceu. */
export type SaidaDaLinha = { status: "pausada" | "cancelada"; depoisDe: string | null };

export type LeituraDoCiclo = {
  passos: readonly PassoDoCiclo[];
  foraDaLinha: SaidaDaLinha | null;
};

/**
 * **`transicoes` vem da mais antiga para a mais recente**, que é a ordem em que a linha do tempo chega.
 *
 * **A primeira passagem é a que conta.** Uma ocorrência pausada e retomada volta a `em_atendimento`, e a
 * data do passo continua sendo a da primeira vez: o ciclo registra quando se chegou, não quando se
 * voltou.
 */
export function lerOCiclo(
  transicoes: readonly TransicaoDoCiclo[],
  statusAtual: string,
): LeituraDoCiclo {
  const primeiraVez = new Map<string, string>();
  for (const transicao of transicoes) {
    if (!primeiraVez.has(transicao.status)) primeiraVez.set(transicao.status, transicao.em);
  }

  const cancelada = statusAtual === "cancelada";

  const passos = CICLO.map((status): PassoDoCiclo => {
    const em = primeiraVez.get(status) ?? null;

    if (em !== null) {
      return { status, em, estado: status === statusAtual ? "atual" : "alcancado" };
    }

    // **O `atual` sem data existe por honestidade, e não deve acontecer:** a premissa P1 faz o registro
    // da criação nascer com a ocorrência. Se acontecer, a régua marca onde a ocorrência está em vez de
    // dizer que o passo em que ela está ainda não veio.
    return {
      status,
      em: null,
      estado:
        status === statusAtual ? "atual" : cancelada ? "inalcancavel" : "por-alcancar",
    };
  });

  const alcancados = passos.filter((passo) => passo.em !== null);
  const depoisDe = alcancados[alcancados.length - 1]?.status ?? null;

  const foraDaLinha: SaidaDaLinha | null =
    statusAtual === "pausada" || statusAtual === "cancelada"
      ? { status: statusAtual, depoisDe }
      : null;

  return { passos, foraDaLinha };
}
