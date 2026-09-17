import { describe, expect, it } from "vitest";

import {
  EDICAO_DE_NOME,
  erroDoNome,
  errosDoNomeNoCorpo,
  nomeDaResposta,
  NOME_SEM_MUDANCA,
  TETO_DO_NOME,
} from "@/interface/componentes/regras-do-nome";
import { correcaoDePessoaSchema } from "@/interface/schemas";

/**
 * O corpo de `PATCH /contexto/pessoa` (item 49).
 *
 * **Cinco casos, e o último é o que guarda a decisão da §3.3:** o campo é opcional, o corpo vazio passa
 * pelo schema, e quem o recusa é a rota. Um schema que o recusasse aqui responderia com a mensagem
 * errada e fecharia a porta para `contatos[]`.
 */
describe("correcaoDePessoaSchema — o corpo de PATCH /contexto/pessoa", () => {
  it("apara o nome", () => {
    expect(correcaoDePessoaSchema.parse({ nome: "  Helena Rocha  " }).nome).toBe("Helena Rocha");
  });

  it("recusa nome só de espaços", () => {
    expect(correcaoDePessoaSchema.safeParse({ nome: "   " }).success).toBe(false);
  });

  it("recusa acima de 120 e aceita exatamente 120 — o varchar(120) de pessoas.nome", () => {
    expect(correcaoDePessoaSchema.safeParse({ nome: "a".repeat(121) }).success).toBe(false);
    expect(correcaoDePessoaSchema.safeParse({ nome: "a".repeat(120) }).success).toBe(true);
  });

  it("aceita o corpo vazio — quem o recusa é a rota, com a frase do endpoint", () => {
    expect(correcaoDePessoaSchema.parse({})).toEqual({});
  });

  it("descarta chave desconhecida em vez de recusar", () => {
    expect(correcaoDePessoaSchema.parse({ nome: "Helena", email: "outro@exemplo.com" })).toEqual({
      nome: "Helena",
    });
  });
});

/**
 * ============================================================================
 *  O modal do nome — item 44i
 * ============================================================================
 *
 * **Os dois modais são o mesmo formulário**, e o que muda entre eles é a tabela `EDICAO_DE_NOME`. Os
 * casos que valem para os dois alvos moram aqui, com os da pessoa.
 */
describe("erroDoNome — o campo do modal Editar nome (critérios 44i.5 e 44i.8)", () => {
  const ATUAL = "Helena Rocha";

  it("vazio e só espaços pedem o nome, com a frase do schema da rota", () => {
    expect(erroDoNome("pessoa", "", ATUAL)).toBe("Diga como você quer ser chamado.");
    expect(erroDoNome("pessoa", "   ", ATUAL)).toBe("Diga como você quer ser chamado.");
  });

  it("igual ao atual, mesmo com espaços em volta, pede para alterar", () => {
    expect(erroDoNome("pessoa", ` ${ATUAL} `, ATUAL)).toBe(NOME_SEM_MUDANCA);
  });

  it("outro nome não tem erro", () => {
    expect(erroDoNome("pessoa", "Helena Rocha Martins", ATUAL)).toBeUndefined();
  });

  it("o teto do campo é o da coluna e dos dois schemas", () => {
    expect(TETO_DO_NOME).toBe(120);
    expect(erroDoNome("pessoa", "a".repeat(TETO_DO_NOME + 1), ATUAL)).toBe("O nome cabe em 120 caracteres.");
  });
});

describe("os textos do modal do nome — critérios 44i.2, 44i.5 e 44i.8", () => {
  it("em T-15, o aviso de sucesso é a frase da faixa que saiu", () => {
    expect(EDICAO_DE_NOME.organizacao.sucesso("Residencial Aurora")).toStrictEqual({
      titulo: "Organização renomeada",
      descricao: "A organização passou a se chamar Residencial Aurora.",
    });
  });

  it("em T-16, o aviso de sucesso diz o alcance", () => {
    expect(EDICAO_DE_NOME.pessoa.sucesso("Helena Rocha Martins")).toStrictEqual({
      titulo: "Nome salvo",
      descricao: "Você passou a aparecer como Helena Rocha Martins em todas as suas organizações.",
    });
  });

  it("os títulos do modal e da falha, e cada alvo no endpoint dele", () => {
    expect(EDICAO_DE_NOME.organizacao.titulo).toBe("Editar organização");
    expect(EDICAO_DE_NOME.pessoa.titulo).toBe("Editar nome");
    expect(EDICAO_DE_NOME.organizacao.falha).toBe("Não foi possível renomear a organização");
    expect(EDICAO_DE_NOME.pessoa.falha).toBe("Não foi possível salvar o seu nome");
    expect(EDICAO_DE_NOME.organizacao.endpoint).toBe("/api/organizacoes");
    expect(EDICAO_DE_NOME.pessoa.endpoint).toBe("/api/contexto/pessoa");
  });

  it("nenhum texto do modal usa palavra do projeto", () => {
    for (const alvo of [EDICAO_DE_NOME.organizacao, EDICAO_DE_NOME.pessoa]) {
      for (const texto of [alvo.titulo, alvo.descricao, alvo.rotulo, alvo.ajuda, alvo.falha]) {
        expect(texto).not.toMatch(/entrega|vers[aã]o|etapa/iu);
      }
    }
  });
});

describe("a resposta do servidor no modal do nome — C-5 do plano", () => {
  it("o 400 com erro em nome vira mensagem do campo; erro de outro campo não", () => {
    const corpo = {
      codigo: "FORMATO_INVALIDO",
      detail: "Um ou mais campos estão inválidos.",
      erros: [
        { campo: "corpo", codigo: "OBRIGATORIO", mensagem: "Informe ao menos um campo para alterar." },
        { campo: "nome", codigo: "MUITO_CURTO", mensagem: "Diga como você quer ser chamado." },
      ],
    };
    expect(errosDoNomeNoCorpo(corpo)).toStrictEqual({ nome: "Diga como você quer ser chamado." });
    expect(
      errosDoNomeNoCorpo({ codigo: "FORMATO_INVALIDO", erros: [{ campo: "corpo", codigo: "OBRIGATORIO" }] }),
    ).toStrictEqual({});
  });

  it("corpo sem erros[], nulo, que não é objeto, ou com mensagem vazia não dá erro de campo", () => {
    expect(errosDoNomeNoCorpo({ codigo: "ORGANIZACAO_DIVERGENTE", detail: "Recarregue." })).toStrictEqual({});
    expect(errosDoNomeNoCorpo(null)).toStrictEqual({});
    expect(errosDoNomeNoCorpo("<html>")).toStrictEqual({});
    expect(errosDoNomeNoCorpo({ erros: [null, { campo: "nome", mensagem: "  " }] })).toStrictEqual({});
  });

  it("o nome do aviso é o que a resposta devolveu", () => {
    expect(nomeDaResposta({ pessoaId: "p", nome: "Helena Rocha Martins" })).toBe("Helena Rocha Martins");
    expect(nomeDaResposta({ id: "o", nome: "Residencial Aurora", codigoPublico: "K7RQ4MZP" })).toBe(
      "Residencial Aurora",
    );
    expect(nomeDaResposta({ nome: "" })).toBeNull();
    expect(nomeDaResposta(null)).toBeNull();
  });
});
