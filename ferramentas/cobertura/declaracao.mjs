/**
 * ============================================================================
 *  O que um teste declara cobrir, lido do relatório do Playwright
 * ============================================================================
 *
 * Um teste de ponta a ponta atravessa dezenas de telas e afirma dezenas de coisas. Nada disso é legível
 * por máquina: a citação do critério mora em comentário, em prosa, e uma expressão regular sobre o fonte
 * confunde `14.3` com `127.0`. Este módulo lê **declaração**, e não prosa.
 *
 * ---------------------------------------------------------------------------
 *  A forma
 * ---------------------------------------------------------------------------
 *
 * Dentro do teste, ao lado da asserção que prova a coisa:
 *
 *     declararCobertura(test.info(), "4.2 · 13", { criterio: "14.3" });
 *     declararCobertura(test.info(), "4.1 · 5", { falta: "as três frases transitórias do envio" });
 *
 * Vira uma anotação `{ type: "cobre" | "cobre-parcial", description: "roteiro=… criterio=… falta=…" }`,
 * que o relatório `json` devolve inteira.
 *
 * **`falta` é o que separa provado de parcial**, e a escolha é do tipo. Um teste que toca o passo sem
 * afirmar tudo o que ele pede declara o que ficou de fora, com essas palavras — porque um mapa que
 * arredonda para cima convida a marcar validado o que ninguém exercitou.
 *
 * ---------------------------------------------------------------------------
 *  O que este módulo NÃO decide
 * ---------------------------------------------------------------------------
 *
 * **Prova pendente é derivada, e não declarada.** Um teste em `test.fixme` guarda um defeito conhecido:
 * ele existe, está escrito inteiro, e não roda. O relatório o devolve como `skipped`, e é dali que o
 * estado sai — ninguém precisa lembrar de anotar duas coisas ao marcar um teste.
 */

/** O prefixo que separa uma anotação nossa das que o próprio Playwright cria (`skip`, `fixme`, `fail`). */
export const TIPO_PROVADO = "cobre";
export const TIPO_PARCIAL = "cobre-parcial";

/**
 * Lê o relatório `json` do Playwright e devolve, por identidade do roteiro, quem a declara e como.
 *
 * O resultado é um `Map` de `id do roteiro` para a lista de declarações. Uma identidade pode ser
 * declarada por mais de um teste, e isso não é erro: dois percursos podem afirmar a mesma coisa por
 * caminhos diferentes, e o mais forte dos dois é o que vale.
 */
export function lerDeclaracoes(relatorio) {
  const porItem = new Map();
  const testes = [];

  const percorrer = (suite) => {
    for (const spec of suite.specs ?? []) {
      for (const teste of spec.tests ?? []) {
        const anotacoes = teste.annotations ?? [];
        // `status` é o veredito da execução: `expected`, `unexpected`, `skipped`, `flaky`.
        const pendente = teste.status === "skipped" || anotacoes.some((a) => a.type === "fixme");
        const verde = teste.status === "expected";

        testes.push({ titulo: spec.title, arquivo: suite.file ?? spec.file, verde, pendente });

        for (const anotacao of anotacoes) {
          if (anotacao.type !== TIPO_PROVADO && anotacao.type !== TIPO_PARCIAL) continue;

          const campos = interpretar(anotacao.description ?? "");
          if (campos.roteiro === null) continue;

          if (!porItem.has(campos.roteiro)) porItem.set(campos.roteiro, []);
          porItem.get(campos.roteiro).push({
            parcial: anotacao.type === TIPO_PARCIAL || campos.falta !== null,
            falta: campos.falta,
            criterio: campos.criterio,
            arquivo: (suite.file ?? spec.file ?? "").replaceAll("\\", "/").split("/").pop(),
            teste: spec.title,
            verde,
            pendente,
          });
        }
      }
    }
    for (const filha of suite.suites ?? []) percorrer(filha);
  };

  for (const suite of relatorio.suites ?? []) percorrer(suite);

  return { porItem, testes };
}

/** `roteiro=4.2 · 13 criterio=14.3 falta=o endereço não é conferido` → os três campos. */
function interpretar(descricao) {
  const pegar = (nome) => {
    const achado = new RegExp(`${nome}=([^]*?)(?=\\s+(?:roteiro|criterio|falta)=|$)`, "u").exec(descricao);
    return achado ? achado[1].trim() : null;
  };
  const roteiro = pegar("roteiro");
  return {
    roteiro: roteiro === null || roteiro === "" ? null : roteiro,
    criterio: pegar("criterio"),
    falta: pegar("falta"),
  };
}
