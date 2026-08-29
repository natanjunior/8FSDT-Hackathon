/**
 * ============================================================================
 *  O plano da demonstração — PURO, e é o que torna o item conferível sem banco
 * ============================================================================
 *
 * Este arquivo devolve **o mundo inteiro como dado**: quem existe, onde, e uma lista de ocorrências com
 * data de registro, roteiro de transições e desfecho. Ele não conhece porta, não conhece banco e não lê
 * relógio — quem lhe dá o `hoje` é a linha de comando.
 *
 * **Ele importa `type`, e só `type`** (decisão D-1 do plano). A §3.2 da spec previa "nada"; um
 * `"aguardando_peça"` com cedilha no roteiro, porém, só falharia contra o banco, no meio de uma
 * semeadura. Com os tipos do Domínio o compilador cobra os motivos, os papéis e os tipos de área — e
 * `import type` é apagado na compilação, então o arquivo continua puro e continua rodando no laço curto.
 */

import type {
  MotivoCancelamento,
  MotivoPausa,
  Prioridade,
  StatusOcorrencia,
} from "@/dominio/ocorrencia";
import type { Papel, TipoArea } from "@/dominio/organizacao";

export const UM_MINUTO = 60 * 1000;
export const UM_DIA = 24 * 60 * UM_MINUTO;

/**
 * Um mês da série.
 *
 * **`ultimoDia` é o último dia que o balde pode carimbar** — o fim do mês, exceto no mês corrente, onde é
 * **ontem**: a semente nunca escreve no futuro, e "hoje de manhã" seria futuro para metade das
 * transições que ela grava.
 */
export type Balde = {
  /** `0` é o mês corrente; `4` é quatro meses atrás. */
  readonly distancia: number;
  /** `2026-04` — o rótulo da série mensal, e a chave do resumo impresso. */
  readonly rotulo: string;
  /** Dia 1 do mês, 00:00 UTC. */
  readonly inicio: Date;
  /** O último dia utilizável, 00:00 UTC. */
  readonly ultimoDia: Date;
  /** Quantos dias o balde tem, contando o primeiro e o último. Nunca menor que 1. */
  readonly dias: number;
};

/**
 * Os cinco baldes mensais: `M-4` a `M-0`.
 *
 * **Cinco e não três**, embora o critério 43.1 peça "pelo menos três": com três, o mês sem resolução do
 * critério 43.2 seria um terço da série e leria como defeito. Com cinco, ele lê como o que é.
 *
 * **Tudo em UTC** (decisão D-2). Fuso do sistema não pode decidir em qual mês uma ocorrência cai — o mesmo
 * plano rodado em duas máquinas produziria séries diferentes.
 */
export function baldesDaDemonstracao(hoje: Date): readonly Balde[] {
  const ano = hoje.getUTCFullYear();
  const mes = hoje.getUTCMonth();
  const diaDeHoje = hoje.getUTCDate();

  const baldes: Balde[] = [];

  for (let distancia = 4; distancia >= 0; distancia -= 1) {
    const inicio = new Date(Date.UTC(ano, mes - distancia, 1));
    // `Date.UTC(ano, m + 1, 0)` é o último dia do mês `m`. No mês corrente o teto é ONTEM.
    const ultimoDia =
      distancia === 0
        ? new Date(Date.UTC(ano, mes, diaDeHoje - 1))
        : new Date(Date.UTC(ano, mes - distancia + 1, 0));

    const dias = Math.round((ultimoDia.getTime() - inicio.getTime()) / UM_DIA) + 1;

    // **A semente rodada no dia 1**: o mês corrente não tem um único dia no passado, e o balde não nasce.
    // Sobram quatro — ainda acima do mínimo de três do critério 43.1. Não é erro, e o teste o prova.
    if (dias < 1) continue;

    baldes.push({ distancia, rotulo: rotuloDoMes(inicio), inicio, ultimoDia, dias });
  }

  return baldes;
}

function rotuloDoMes(inicio: Date): string {
  const mes = String(inicio.getUTCMonth() + 1).padStart(2, "0");
  return `${String(inicio.getUTCFullYear())}-${mes}`;
}
