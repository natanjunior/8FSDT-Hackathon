import { describe, expect, it } from "vitest";

import {
  CABECALHO_DE_ORGANIZACAO,
  cabecalhosDeEscrita,
} from "@/interface/componentes/afirmacao-de-organizacao";

/**
 * ============================================================================
 *  Unitário de INTERFACE — a afirmação de organização (item 7b, critério 7b.6)
 * ============================================================================
 *
 * **O que este arquivo prova é o lado novo**, e só ele. A conferência mora no servidor desde a primeira
 * fatia (`com-contexto.ts:326-331`) e não muda nesta branch; o que o item 7b acrescenta é o cliente que
 * **afirma**, e é o que está aqui.
 *
 * **O segundo caso é o que carrega o item inteiro.** A trava da aba esquecida só funciona se o valor
 * afirmado for o da **renderização daquela aba** — nunca o do cookie na hora do clique, porque a outra aba
 * já o reescreveu e a afirmação bateria consigo mesma. Uma função que devolva o argumento, e nada de
 * módulo, é o que torna isso verdade por construção.
 *
 * **A metade *"nada é gravado"* do critério é estrutural, não testável aqui:** a conferência é o **passo 4**
 * de `comContexto` — antes de `lerCorpo` e antes de o manipulador ser chamado (`com-contexto.ts:174-186`).
 * O cenário de duas abas está nos passos manuais do plano, que é onde ele pode ser vivido.
 */
describe("cabecalhosDeEscrita — a afirmação da §4.3 do contrato", () => {
  it("monta os dois cabeçalhos, e o nome é exatamente o que o servidor lê", () => {
    const cabecalhos = cabecalhosDeEscrita("organizacao-a");

    expect(cabecalhos["content-type"]).toBe("application/json");
    // O servidor lê `(await headers()).get("x-organizacao-id")` (`com-contexto.ts:327`). Um nome diferente
    // não é erro para ninguém: o cabeçalho é **opcional** por contrato, e a proteção simplesmente sumiria.
    expect(cabecalhos["x-organizacao-id"]).toBe("organizacao-a");
    expect(CABECALHO_DE_ORGANIZACAO).toBe("x-organizacao-id");
  });

  it("o valor é o argumento, nunca um valor de módulo — duas abas não se contaminam", () => {
    const daAbaVelha = cabecalhosDeEscrita("organizacao-a");
    const daAbaNova = cabecalhosDeEscrita("organizacao-b");

    expect(daAbaVelha["x-organizacao-id"]).toBe("organizacao-a");
    expect(daAbaNova["x-organizacao-id"]).toBe("organizacao-b");
  });

  it("não devolve o mesmo objeto duas vezes — quem o recebe pode alterá-lo sem alcançar o vizinho", () => {
    expect(cabecalhosDeEscrita("organizacao-a")).not.toBe(cabecalhosDeEscrita("organizacao-a"));
  });
});
