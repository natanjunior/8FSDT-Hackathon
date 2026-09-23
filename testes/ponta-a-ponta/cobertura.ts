import type { TestDetails, TestInfo } from "@playwright/test";

/**
 * ============================================================================
 *  Declarar o que uma asserção prova, em campo que a máquina lê
 * ============================================================================
 *
 * **A citação em comentário não serve, e isso foi medido.** Os sete arquivos desta pasta citam critério
 * em 155 linhas de prosa, e extrair aquilo por expressão regular traz `0.1` e `127.0` junto de `14.3` —
 * endereço e número de linha entram como se fossem critério. O mapa de cobertura precisa de declaração,
 * não de texto.
 *
 * **A anotação do Playwright é o campo, e o relatório `json` a devolve inteira.** Ela aparece também no
 * relatório em HTML, ao lado do teste, o que faz dela documentação para gente no mesmo gesto.
 *
 * ---------------------------------------------------------------------------
 *  Como se usa
 * ---------------------------------------------------------------------------
 *
 * Ao lado da asserção que prova a coisa, e não no topo do arquivo:
 *
 *     await expect(pagina.getByRole("cell", { name: TITULO })).toBeVisible();
 *     cobre(test.info(), "4.2 · 10", { criterio: "14.1" });
 *
 * Quando a asserção prova **parte** do que o passo pede, o que ficou de fora vai junto, e o item entra
 * no mapa como parcial:
 *
 *     cobre(test.info(), "4.1 · 5", { falta: "as três frases transitórias do envio" });
 *
 * **Declarar a mais é pior que declarar a menos.** Um item que o mapa dá como provado sai da fila de
 * quem valida à mão; se a asserção não o provava, ninguém olha aquilo nunca mais. Na dúvida, `falta`.
 *
 * ---------------------------------------------------------------------------
 *  O que não se declara
 * ---------------------------------------------------------------------------
 *
 * **Prova pendente.** Um teste em `test.fixme` guarda defeito conhecido, e o relatório já o devolve como
 * pulado. O mapa deriva dali, para que marcar um teste não exija lembrar de uma segunda coisa.
 *
 * **O que só o olho confere.** Isso mora no `roteiro-de-validacao.md`, com o marcador `[olho]` e a razão.
 * Um teste não é o lugar de afirmar o que nenhum teste alcança.
 */
export function cobre(
  info: TestInfo,
  roteiro: string,
  detalhe: { criterio?: string; falta?: string } = {},
): void {
  info.annotations.push(anotar(roteiro, detalhe));
}

/**
 * ---------------------------------------------------------------------------
 *  O teste que não roda declara de outro jeito, e a diferença é obrigatória
 * ---------------------------------------------------------------------------
 *
 * **`cobre` não funciona dentro de um `test.fixme`**, e isso foi medido: o corpo de um teste marcado
 * nunca executa, então a anotação nunca é empurrada e o relatório o devolve sem declaração nenhuma. Uma
 * chamada de `cobre` ali é código morto com cara de documentação.
 *
 * O Playwright resolve isso com o parâmetro do meio, que é lido **na coleta** e não na execução:
 *
 *     test.fixme(
 *       "a recusa do nome repetido aparece no campo",
 *       cobertura([{ roteiro: "3 · 1", criterio: "4a.1" }]),
 *       async ({ browser }) => { … },
 *     );
 *
 * **É assim que prova pendente chega ao mapa.** Um defeito conhecido com teste escrito vale mais do que
 * um buraco: quem for validar aquilo à mão precisa saber que o defeito já tem dono e medição, em vez de
 * descobri-lo de novo.
 */
export function cobertura(
  itens: ReadonlyArray<{ roteiro: string; criterio?: string; falta?: string }>,
): TestDetails {
  return { annotation: itens.map(({ roteiro, ...detalhe }) => anotar(roteiro, detalhe)) };
}

function anotar(
  roteiro: string,
  detalhe: { criterio?: string; falta?: string },
): { type: string; description: string } {
  const partes = [`roteiro=${roteiro}`];
  if (detalhe.criterio !== undefined) partes.push(`criterio=${detalhe.criterio}`);
  if (detalhe.falta !== undefined) partes.push(`falta=${detalhe.falta}`);

  return {
    type: detalhe.falta === undefined ? "cobre" : "cobre-parcial",
    description: partes.join(" "),
  };
}
