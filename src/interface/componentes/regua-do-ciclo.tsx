import { Check } from "lucide-react";
import { Fragment } from "react";

import { lerOCiclo, type PassoDoCiclo, type TransicaoDoCiclo } from "@/interface/componentes/ciclo";

/**
 * **O ciclo do enunciado, visível como caminho pela primeira vez.**
 *
 * A leitura — quem foi alcançado, quando, e o que pausada e cancelada fazem — mora em `ciclo.ts`, que é
 * puro e tem teste. Aqui fica só a forma.
 *
 * **A cor da marca NÃO entra**, nem no marcador do passo atual: o guia §2 a reserva para a ação
 * principal da tela, e a ação principal de T-05 é o comando do momento. O passo atual se distingue por
 * **peso, preenchimento e a data ao lado** — três coisas, nenhuma delas só cor —, e para quem lê por
 * leitor de tela o estado atual é publicado também por `aria-current="step"`.
 *
 * **Os nomes são os de quem lê.** Quem chama passa `nomeDoStatus` já com a lente aplicada (item 31):
 * para o Gestor o terceiro passo é *"Em atendimento"*, para o Solicitante é *"Em execução"*. Passar a
 * coluna do Gestor a todo mundo seria desfazer o item 31 dentro de um item de forma.
 */
const MARCADOR: Readonly<Record<PassoDoCiclo["estado"], string>> = {
  alcancado: "bg-tinta-suave border-tinta-suave",
  atual: "bg-tinta border-tinta ring-tinta/20 ring-4",
  "por-alcancar": "border-linha bg-transparent",
  inalcancavel: "border-linha-suave bg-transparent",
};

const PALAVRA: Readonly<Record<PassoDoCiclo["estado"], string>> = {
  alcancado: "text-tinta-suave",
  atual: "text-tinta font-medium",
  "por-alcancar": "text-tinta-fraca",
  inalcancavel: "text-tinta-fraca line-through",
};

export function ReguaDoCiclo({
  transicoes,
  statusAtual,
  nomeDoStatus,
  notaDaSaida = null,
  rotuloDaSaida,
}: {
  /** Da mais antiga para a mais recente, com o instante já em palavra. */
  transicoes: readonly TransicaoDoCiclo[];
  statusAtual: string;
  nomeDoStatus: (status: string) => string;
  /** O motivo da pausa, quando há — a mesma frase que o bloco 1a mostra. */
  notaDaSaida?: string | null;
  /**
   * **O rótulo do selo do bloco 1a, e não `nomeDoStatus(foraDaLinha.status)`.** Para o Solicitante em
   * `pausada`, `nomeDoStatus` devolve um rótulo seco — *"Parada"* — porque `rotulosDeStatus` chama
   * `rotuloDeStatus(status, null, lente)`; o selo imprime um dos quatro rótulos por motivo, como *"Parada
   * — esperando material chegar"*. Sem esta prop a régua e o selo diriam duas coisas diferentes do mesmo
   * estado, dois blocos de distância.
   *
   * **É sempre o rótulo certo**, e a razão é de tipo: `foraDaLinha` só é não nulo quando `statusAtual` é
   * `pausada` ou `cancelada` (`lerOCiclo`), e `foraDaLinha.status` **é** o `statusAtual` — nunca outro
   * status. O rótulo da saída é sempre o rótulo do status atual, que é exatamente o que o selo já mostra.
   */
  rotuloDaSaida: string;
}) {
  const { passos, foraDaLinha } = lerOCiclo(transicoes, statusAtual);

  /**
   * **A saída da linha, e ela é ANCORADA — não vai para o fim da lista.** `depoisDe` existe para dizer
   * depois de qual passo ela aconteceu: numa cancelada vinda de `aberta`, a marca fica logo abaixo de
   * *Aberta*, e os três passos inalcançáveis vêm depois dela. Pendurá-la no fim do `<ol>` a poria
   * debaixo de *Resolvida*, que é o passo que aquela ocorrência nunca teve.
   *
   * **Marcador quadrado e tracejado, nunca um quinto círculo:** ela não é etapa, e a forma diz isso antes
   * da palavra — que vem junto de qualquer jeito, pelo compromisso de nada só por cor.
   */
  const marcaDaSaida =
    foraDaLinha === null ? null : (
      <li className="flex gap-3 pb-4 pl-6">
        <span
          aria-hidden
          className="border-tinta-suave mt-1.5 size-[11px] shrink-0 rounded-[2px] border border-dashed"
        />
        <span className="flex min-w-0 flex-col">
          <span className="text-interface text-tinta font-medium">{rotuloDaSaida}</span>
          <span className="text-tinta-suave text-meta">
            {foraDaLinha.status === "pausada"
              ? (notaDaSaida ?? "O atendimento está parado; o ciclo não recua.")
              : "O ciclo não continua."}
          </span>
        </span>
      </li>
    );

  return (
    <ol className="flex flex-col">
      {/* **Nada alcançado ainda: a marca vem antes dos passos.** Não acontece com a premissa P1 — a
          criação grava o primeiro registro —, e existe para o esqueleto, que desenha o trilho sem datas. */}
      {foraDaLinha !== null && foraDaLinha.depoisDe === null && marcaDaSaida}

      {passos.map((passo, indice) => (
        <Fragment key={passo.status}>
          <li
            className="relative flex gap-3 pb-4 last:pb-0"
            aria-current={passo.estado === "atual" ? "step" : undefined}
          >
            {/* **O trilho, e ele não desce do último.** `aria-hidden` porque é o desenho da relação que
                a ordem do `<ol>` já publica para quem lê por leitor de tela. */}
            {indice < passos.length - 1 && (
              <span aria-hidden className="bg-linha-suave absolute top-4 bottom-0 left-[5px] w-px" />
            )}

            {/* **O visto dentro do marcador cumprido** (critério 44q.6). É a terceira pista, nunca a
                primeira, como o ícone do marcador de T-06: a data e a ordem já dizem que o passo passou. */}
            <span
              aria-hidden
              className={`mt-1.5 flex size-[11px] shrink-0 items-center justify-center rounded-full border ${MARCADOR[passo.estado]}`}
            >
              {passo.estado === "alcancado" && (
                <Check aria-hidden className="text-superficie size-2" strokeWidth={4} />
              )}
            </span>

            <span className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-3">
              <span className={`text-interface ${PALAVRA[passo.estado]}`}>
                {nomeDoStatus(passo.status)}
                {/* **O quarto estado, publicado em palavra.** `alcancado`, `atual` e `por-alcancar` já
                    têm pista textual própria — a data ao lado, ou `aria-current` — e `inalcancavel` não
                    tinha nenhuma fora do `line-through` visual. */}
                {passo.estado === "inalcancavel" && <span className="sr-only"> (não alcançada)</span>}
              </span>
              {/* **A data à direita, e o `agora` ao lado dela no passo atual** (critério 44q.6). Abaixo de
                  `sm`, sem largura, ela quebra para baixo em vez de espremer o nome. **Em monoespaçada**,
                  guia §3: a mono é para dado temporal, e o formato é o de `dataEHora`. */}
              {passo.em !== null && (
                <span className="text-tinta-fraca text-meta flex items-baseline gap-2">
                  <span className="font-mono tabular-nums">{passo.em}</span>
                  {passo.estado === "atual" && <span className="text-tinta-suave">agora</span>}
                </span>
              )}
            </span>
          </li>

          {/* **Ancorada no último passo alcançado**, que é para isso que `depoisDe` existe. */}
          {foraDaLinha !== null && foraDaLinha.depoisDe === passo.status && marcaDaSaida}
        </Fragment>
      ))}
    </ol>
  );
}
