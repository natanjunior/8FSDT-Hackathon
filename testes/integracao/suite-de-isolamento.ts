import { expect, it } from "vitest";

/**
 * ============================================================================
 *  A suíte de isolamento — `arquitetura.md` §7.1
 * ============================================================================
 *
 * O item de Definition of Done *"organização A não vê dado de B"* é cobrado **toda vez que uma tarefa toca
 * consulta**, e são muitas. Se cumpri-lo custar remontar o cenário, ele passa a ser **marcado sem ser
 * cumprido** — que é pior do que não existir, porque é um portão que aparenta segurar.
 *
 * **A suíte é dona das pessoas e das organizações; cada entrada semeia apenas o seu próprio agregado.**
 * O critério **A4** explica por quê: *"seed com pessoas distintas por organização não detecta o erro"*,
 * porque o vazamento aparece justamente quando a Pessoa é global e a consulta parte dela. Aqui o mundo é
 * o do arquivo que chama, e a entrada só declara o que é seu.
 *
 * > **O terceiro caso é opcional, e a razão é boa.** A §7.1 pede *"toda linha devolvida carrega a
 * > organização pedida"* — e um modelo de leitura correto **não expõe `organizacao_id`**: `CategoriaLida`
 * > e `AreaLida` não o têm, de propósito. Onde ele não existe, os dois primeiros casos são a prova, e são
 * > mais fortes: comparam o resultado com as chaves realmente semeadas em cada organização, em vez de
 * > acreditar num campo que a própria consulta preencheu.
 */

export type MundoDeDuasOrganizacoes = {
  /** Lidos tarde: os identificadores só existem depois do `beforeAll` de quem chama. */
  a: () => string;
  b: () => string;
};

export type EntradaDeIsolamento<L> = {
  /** Aparece no nome de cada caso — use o da consulta, como `GET /categorias`. */
  nome: string;
  /** Como chamar a consulta **já escopada**. */
  consultar: (organizacaoId: string) => Promise<readonly L[]>;
  /** Como identificar uma linha do resultado: `id`, `nome`, o que for estável. */
  chaveDaLinha: (linha: L) => string;
  /** As chaves que a entrada semeou em cada organização. */
  esperadas: { emA: readonly string[]; emB: readonly string[] };
  /** Como ler a organização de uma linha — **só quando o modelo de leitura a expõe**. */
  organizacaoDaLinha?: (linha: L) => string;
};

export function casosDeIsolamento<L>(
  mundo: MundoDeDuasOrganizacoes,
  entrada: EntradaDeIsolamento<L>,
): void {
  it(`${entrada.nome}: escopada em A devolve exatamente o que foi semeado em A`, async () => {
    const linhas = await entrada.consultar(mundo.a());
    expect(new Set(linhas.map(entrada.chaveDaLinha))).toStrictEqual(new Set(entrada.esperadas.emA));
  });

  it(`${entrada.nome}: escopada em B não devolve nada de A`, async () => {
    const linhas = await entrada.consultar(mundo.b());
    const chaves = new Set(linhas.map(entrada.chaveDaLinha));

    for (const deA of entrada.esperadas.emA) expect(chaves.has(deA)).toBe(false);
    expect(chaves).toStrictEqual(new Set(entrada.esperadas.emB));
  });

  if (entrada.organizacaoDaLinha !== undefined) {
    const organizacaoDaLinha = entrada.organizacaoDaLinha;
    it(`${entrada.nome}: toda linha devolvida carrega a organização pedida`, async () => {
      const linhas = await entrada.consultar(mundo.a());
      expect(linhas.length).toBeGreaterThan(0);
      for (const linha of linhas) expect(organizacaoDaLinha(linha)).toBe(mundo.a());
    });
  }
}
