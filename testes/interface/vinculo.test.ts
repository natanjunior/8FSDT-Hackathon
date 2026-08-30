import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  razaoDoImpedimento,
  textoDaConfirmacao,
  textoDaRecusa,
} from "@/interface/componentes/frases-da-remocao";
import { cadastroDeVinculoSchema, correcaoDeVinculoSchema } from "@/interface/schemas";

/**
 * ============================================================================
 *  Unitário de INTERFACE — os corpos de `POST` e `PATCH /vinculos` (item 9b)
 * ============================================================================
 *
 * **O que este arquivo prova são os critérios 2 e 3**, e a decisão 2.1 da spec: que a forma é recusada
 * antes de o domínio existir, que `[]` e ausente são coisas diferentes, e que `ordem` divergente da
 * posição é `400` — não um campo aceito e jogado fora.
 *
 * **O que ele deliberadamente NÃO prova:** par repetido. Duplicata é `409 CONTATO_DUPLICADO`, do banco
 * (critério 4) — pegá-la aqui a transformaria em `400`, que é outro código e outro significado.
 */

const TELEFONE = {
  tipo: "telefone",
  valor: "+5511955217788",
  finalidade: "trabalho",
  temWhatsapp: true,
};

const CADASTRO_VALIDO = { nome: "Sebastião Alves de Moura", papel: "encarregado" };

describe("contatos — a forma, recusada antes do domínio", () => {
  it("aceita a lista e resolve os opcionais do contrato", () => {
    const conferido = cadastroDeVinculoSchema.safeParse({
      ...CADASTRO_VALIDO,
      contatos: [{ tipo: "email", valor: "zelador@exemplo.test" }],
    });

    expect(conferido.success).toBe(true);
    expect(conferido.data?.contatos).toStrictEqual([
      {
        tipo: "email",
        valor: "zelador@exemplo.test",
        finalidade: "pessoal",
        temWhatsapp: false,
        observacao: null,
      },
    ]);
  });

  it("omitir contatos no cadastro vira lista vazia — Pessoa nova sem contato é permitido", () => {
    const conferido = cadastroDeVinculoSchema.safeParse(CADASTRO_VALIDO);

    expect(conferido.success).toBe(true);
    expect(conferido.data?.contatos).toStrictEqual([]);
  });

  it("telefone fora de E.164 é recusado, e o campo culpado é apontado", () => {
    const conferido = cadastroDeVinculoSchema.safeParse({
      ...CADASTRO_VALIDO,
      contatos: [{ tipo: "telefone", valor: "(11) 95521-7788" }],
    });

    expect(conferido.success).toBe(false);
    expect(conferido.error?.issues[0]?.path).toStrictEqual(["contatos", 0, "valor"]);
  });

  it("temWhatsapp true num e-mail é recusado — WhatsApp é indicação sobre um NÚMERO", () => {
    const conferido = cadastroDeVinculoSchema.safeParse({
      ...CADASTRO_VALIDO,
      contatos: [{ tipo: "email", valor: "zelador@exemplo.test", temWhatsapp: true }],
    });

    expect(conferido.success).toBe(false);
  });

  it("e-mail malformado é recusado", () => {
    const conferido = cadastroDeVinculoSchema.safeParse({
      ...CADASTRO_VALIDO,
      contatos: [{ tipo: "email", valor: "zelador-arroba-exemplo" }],
    });

    expect(conferido.success).toBe(false);
  });

  it("observação vazia vira null — não uma observação em branco", () => {
    const conferido = cadastroDeVinculoSchema.safeParse({
      ...CADASTRO_VALIDO,
      contatos: [{ ...TELEFONE, observacao: "   " }],
    });

    expect(conferido.success).toBe(true);
    expect(conferido.data?.contatos[0]?.observacao).toBeNull();
  });
});

describe("ordem — a posição decide, e a divergente é recusada (decisão 2.1)", () => {
  it("sem ordem nenhuma é o caso BOM — é o corpo natural", () => {
    const conferido = cadastroDeVinculoSchema.safeParse({
      ...CADASTRO_VALIDO,
      contatos: [TELEFONE, { tipo: "email", valor: "zelador@exemplo.test" }],
    });

    expect(conferido.success).toBe(true);
  });

  it("ordem que bate com a posição é aceita — o exemplo do contrato continua válido", () => {
    const conferido = cadastroDeVinculoSchema.safeParse({
      ...CADASTRO_VALIDO,
      contatos: [
        { ...TELEFONE, ordem: 1 },
        { tipo: "email", valor: "zelador@exemplo.test", ordem: 2 },
      ],
    });

    expect(conferido.success).toBe(true);
  });

  it("ordem que NÃO bate é 400, no campo — nunca aceita e descartada em silêncio", () => {
    const conferido = cadastroDeVinculoSchema.safeParse({
      ...CADASTRO_VALIDO,
      contatos: [{ ...TELEFONE, ordem: 5 }],
    });

    expect(conferido.success).toBe(false);
    expect(conferido.error?.issues[0]?.path).toStrictEqual(["contatos", 0, "ordem"]);
  });

  it("ordem nunca chega à porta — quem a grava é o servidor, pela posição", () => {
    const conferido = cadastroDeVinculoSchema.safeParse({
      ...CADASTRO_VALIDO,
      contatos: [{ ...TELEFONE, ordem: 1 }],
    });

    expect(conferido.success).toBe(true);
    expect(Object.hasOwn(conferido.data?.contatos[0] ?? {}, "ordem")).toBe(false);
  });
});

describe("correcaoDeVinculoSchema — ausente e vazio são instruções diferentes", () => {
  it("lista vazia é um valor: remova todos", () => {
    const conferido = correcaoDeVinculoSchema.safeParse({ contatos: [] });

    expect(conferido.success).toBe(true);
    expect(conferido.data?.contatos).toStrictEqual([]);
  });

  it("omitir NÃO vira lista vazia — a chave não existe no resultado", () => {
    const conferido = correcaoDeVinculoSchema.safeParse({ nome: "Nome novo" });

    expect(conferido.success).toBe(true);
    expect(conferido.data?.contatos).toBeUndefined();
  });
});

/**
 * ============================================================================
 *  O critério 10.5 — é o ÚNICO `DELETE` do contrato
 * ============================================================================
 *
 * **Um critério de aceitação sem nada que o confira é um critério que ninguém confere.** O 10.5 afirma
 * que não há caminho que apague ocorrência, mensagem, categoria nem área — e o custo de conferir isso é
 * uma varredura de doze linhas.
 *
 * **Não é o mesmo que o portão do contrato:** aquele roda sobre o `openapi.yaml`, e este roda sobre o
 * **código**. O dia em que os dois discordarem é o dia em que alguém escreveu endpoint sem publicar.
 */
describe("o único DELETE do produto", () => {
  it("existe exatamente um export const DELETE em app/api/, e é o de vínculos", () => {
    const raiz = fileURLToPath(new URL("../../app/api/", import.meta.url));

    const rotas = readdirSync(raiz, { recursive: true, encoding: "utf8" })
      .filter((caminho) => caminho.endsWith("route.ts"))
      .filter((caminho) => /^export const DELETE\b/mu.test(readFileSync(`${raiz}${caminho}`, "utf8")))
      // O `readdirSync` recursivo devolve separador do sistema; a asserção é sobre o caminho lógico.
      .map((caminho) => caminho.replace(/\\/gu, "/"));

    expect(rotas).toStrictEqual(["vinculos/[pessoaId]/route.ts"]);
  });
});

/**
 * ============================================================================
 *  As frases da remoção — item 10, a metade conferível da tela
 * ============================================================================
 *
 * **O produto não tem biblioteca de teste de componente React** — `jsdom` está instalado, mas não há
 * `@testing-library`, e o `vitest.config.mts` roda as quatro pastas com `environment: "node"`. Então o
 * que fica dentro do `.tsx` **não tem teste nenhum**, e é por isso que a escolha de frase mora num módulo
 * puro. É o precedente literal de `busca-de-candidatos.ts` e de `vazio-da-lista.ts`.
 */
describe("textoDaConfirmacao — os dois ramos de temConta, e o aviso de auto-remoção", () => {
  it("com conta, a segunda oração é a verbatim do inventário", () => {
    const linhas = textoDaConfirmacao({
      nome: "Helena Rocha",
      temConta: true,
      ehMeuProprioVinculo: false,
    });

    expect(linhas).toStrictEqual([
      "Remover o vínculo de Helena Rocha. O cadastro da pessoa não é apagado, e ela pode pedir entrada de novo.",
    ]);
  });

  /**
   * **O achado A-2 da spec**: *"ela pode pedir entrada de novo"* é **falso** para quem não tem conta.
   * Pedir entrada exige sessão, e a Pessoa criada por `POST /vinculos` nasce sem conta e **nunca passa a
   * ter** — `repositorios/pessoa/index.ts` cria linha nova por usuário e não adota Pessoa nenhuma.
   */
  it("sem conta, a frase diz o que o Gestor precisa fazer — inclusive os contatos", () => {
    const linhas = textoDaConfirmacao({
      nome: "Sebastião Alves",
      temConta: false,
      ehMeuProprioVinculo: false,
    });

    expect(linhas).toStrictEqual([
      "Remover o vínculo de Sebastião Alves. O cadastro da pessoa não é apagado, mas ela não tem conta e não pode pedir entrada: para voltar, precisa ser cadastrada de novo, com os contatos.",
    ]);
  });

  /**
   * **O aviso da §3.8 só aparece sobre o ramo verbatim, e não é coincidência:** quem remove o próprio
   * vínculo está autenticado, então `temConta` é sempre `true` para si mesmo.
   */
  it("no próprio vínculo, uma segunda linha diz o que se perde", () => {
    const linhas = textoDaConfirmacao({
      nome: "Marina Gestora",
      temConta: true,
      ehMeuProprioVinculo: true,
    });

    expect(linhas).toHaveLength(2);
    expect(linhas[1]).toBe(
      "Este é o seu próprio vínculo. Ao remover, você perde o acesso a esta organização.",
    );
  });
});

describe("razaoDoImpedimento — a razão que substitui o botão", () => {
  /**
   * **O achado A-1 da spec, decidido em 30/08/2026.** A frase antiga nomeava três rastros; o esquema tem
   * **nove** tabelas dependentes, e o caso comum de um Gestor bloqueado não é nenhum dos três — é ter
   * decidido um pedido de entrada ou editado uma categoria. *"Rastro"* é a palavra do próprio glossário
   * (verbete **Remover vínculo**), e a frase é a negação literal da definição.
   */
  it("a razão do histórico COMEÇA PELO NOME, fala em rastro e enumera as cinco famílias — nunca só três", () => {
    const razao = razaoDoImpedimento("Helena Rocha", "historico");

    // O critério 10.4 emendado escreve `{nome} já deixou rastro…` — o nome é a primeira palavra.
    expect(razao.titulo.startsWith("Helena Rocha já deixou rastro nesta organização")).toBe(true);
    expect(razao.titulo).toContain(
      "ocorrência, mensagem, atribuição, decisão de entrada ou configuração",
    );
    expect(razao.titulo).not.toContain("registrou ocorrências");
    expect(razao.complemento).toBe(
      "Encerrar o acesso preservando o registro é uma função que ainda não existe.",
    );
  });

  it("a razão do último Gestor é a verbatim do inventário, não leva nome e não tem complemento", () => {
    expect(razaoDoImpedimento("Helena Rocha", "ultimo-gestor")).toStrictEqual({
      titulo:
        "Esta é a única pessoa com poder de gestão nesta organização. Removê-la deixaria a organização sem ninguém que possa aprovar entradas.",
      complemento: null,
    });
  });
});

describe("textoDaRecusa — o instante entre a tela saber e o Gestor clicar (spec §3.10)", () => {
  it("os dois 409 reusam a MESMA frase da razão — duas frases para o mesmo fato seriam duas coisas para manter", () => {
    expect(textoDaRecusa("VINCULO_COM_HISTORICO", "Helena Rocha")).toBe(
      razaoDoImpedimento("Helena Rocha", "historico").titulo,
    );
    expect(textoDaRecusa("ULTIMO_GESTOR", "Helena Rocha")).toBe(
      razaoDoImpedimento("Helena Rocha", "ultimo-gestor").titulo,
    );
  });

  it("o 404 é o caso de dois Gestores removendo o mesmo vínculo", () => {
    expect(textoDaRecusa("VINCULO_NAO_ENCONTRADO", "Helena Rocha")).toBe(
      "Este vínculo não existe mais.",
    );
  });

  it("código desconhecido e ausente caem na frase genérica", () => {
    expect(textoDaRecusa("QUALQUER_COISA", "Helena Rocha")).toBe(
      "Não foi possível remover agora. Tente de novo.",
    );
    expect(textoDaRecusa(undefined, "Helena Rocha")).toBe(
      "Não foi possível remover agora. Tente de novo.",
    );
  });
});
