import { describe, expect, it } from "vitest";

import { CodigoPublicoEmUso, criarOrganizacao } from "@/aplicacao/organizacao";
import { AREAS_SEMENTE, CATEGORIAS_SEMENTE, FORMATO_DO_CODIGO } from "@/dominio/organizacao";

import { duploDeOrganizacoes } from "./duplos";

/**
 * **A POL-01 do lado da Aplicação.** O que está sob teste é o que ela decide: sortear o código, mandar as
 * duas sementes junto, e repetir o sorteio quando o banco recusar por colisão.
 *
 * O que ela **não** decide, e por isso não está aqui: se as escritas acontecem juntas. Isso é promessa da
 * porta, e a prova é `testes/integracao/politica-de-semente.test.ts`.
 */

describe("criarOrganizacao — critérios 1.1, 2.2 e 3.2", () => {
  it("manda o nome, a Pessoa que chamou, e as duas sementes do domínio", async () => {
    const duplo = duploDeOrganizacoes();

    await criarOrganizacao(duplo.porta, { nome: "Condomínio Recanto Azul", criadaPorPessoaId: "pessoa-1" });

    expect(duplo.recebidas).toHaveLength(1);
    const nova = duplo.recebidas[0]!;
    expect(nova.nome).toBe("Condomínio Recanto Azul");
    expect(nova.criadaPorPessoaId).toBe("pessoa-1");
    expect(nova.categorias).toStrictEqual(CATEGORIAS_SEMENTE);
    expect(nova.areas).toStrictEqual(AREAS_SEMENTE);
  });

  /**
   * O código **não é entrada**: não há como enviá-lo, porque não há parâmetro para ele. É a forma mais
   * forte do critério 1.1 — *"enviar `codigoPublico` no corpo não o define"* —, porque o corpo nem chega
   * até aqui com ele: o schema da Interface descarta chave desconhecida.
   */
  it("sorteia o código do servidor, no formato do contrato", async () => {
    const duplo = duploDeOrganizacoes();

    await criarOrganizacao(duplo.porta, { nome: "Edifício Aurora", criadaPorPessoaId: "pessoa-1" });

    expect(duplo.recebidas[0]!.codigoPublico).toMatch(FORMATO_DO_CODIGO);
  });

  /**
   * As duas contagens são **do repositório**, não do tamanho da lista enviada. O duplo conta o que
   * recebeu — se algum dia a Aplicação passar a inventar o número, este teste continua verde e o de
   * integração cai, que é a divisão certa.
   */
  it("devolve as duas contagens, e elas valem 7 e 2", async () => {
    const duplo = duploDeOrganizacoes();

    const criada = await criarOrganizacao(duplo.porta, { nome: "Recanto", criadaPorPessoaId: "pessoa-1" });

    expect(criada.categoriasSemeadas).toBe(7);
    expect(criada.areasSemeadas).toBe(2);
  });
});

describe("criarOrganizacao — a colisão de código", () => {
  it("sorteia de novo quando o banco recusa, e o segundo código é outro", async () => {
    const duplo = duploDeOrganizacoes({ recusarAsPrimeiras: 2 });

    const criada = await criarOrganizacao(duplo.porta, { nome: "Recanto", criadaPorPessoaId: "pessoa-1" });

    expect(duplo.recebidas).toHaveLength(3);
    const codigos = new Set(duplo.recebidas.map((n) => n.codigoPublico));
    expect(codigos.size).toBe(3);
    expect(criada.codigoPublico).toBe(duplo.recebidas[2]!.codigoPublico);
  });

  it("desiste depois de cinco tentativas, em vez de girar para sempre", async () => {
    const duplo = duploDeOrganizacoes({ recusarAsPrimeiras: Number.POSITIVE_INFINITY });

    await expect(
      criarOrganizacao(duplo.porta, { nome: "Recanto", criadaPorPessoaId: "pessoa-1" }),
    ).rejects.toBeInstanceOf(CodigoPublicoEmUso);

    expect(duplo.recebidas).toHaveLength(5);
  });

  it("não repete a tentativa quando o erro é outro — só a colisão é retentável", async () => {
    const duplo = duploDeOrganizacoes({ falharCom: new Error("conexão perdida") });

    await expect(
      criarOrganizacao(duplo.porta, { nome: "Recanto", criadaPorPessoaId: "pessoa-1" }),
    ).rejects.toThrow("conexão perdida");

    expect(duplo.recebidas).toHaveLength(1);
  });
});
