import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { redirect } from "next/navigation";
import { describe, expect, it, vi } from "vitest";
import { toast } from "sonner";

import { chamarAcaoDeCredencial } from "@/interface/componentes/acao-de-credencial";
import {
  avisarAtencao,
  avisarConclusao,
  avisarErro,
  avisarSucesso,
  MENSAGEM_GENERICA,
  mensagemDoProblema,
} from "@/interface/componentes/retorno-de-acao";
import { cicloDoModal, MODAL_FECHADO } from "@/interface/ganchos/use-envio-do-modal";
import {
  erroVisivel,
  interagir,
  primeiroComProblema,
  SEM_INTERACAO,
  type EstadoDeInteracao,
  type EventoDeInteracao,
} from "@/interface/ganchos/use-formulario-tocado";
import { entrarSchema, errosDoSchema, mensagensPorCampo } from "@/interface/schemas";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

/**
 * ============================================================================
 *  Item 44g — o formulário avisa e o salvamento responde
 * ============================================================================
 *
 * **O produto não tem biblioteca de teste de componente React**, e o `vitest.config.mts` roda esta pasta
 * com `environment: "node"`. Então o que decide mora em função pura, e é ela que se testa aqui: o estado
 * de formulário tocado, o ciclo do modal e a escolha da mensagem de um erro. **O que é regra de texto e de
 * forma vira guarda sobre o código-fonte**, no precedente de `vinculo.test.ts` (o único `DELETE`).
 */

const RAIZ = fileURLToPath(new URL("../../", import.meta.url));

function ler(relativo: string): string {
  return readFileSync(RAIZ + relativo, "utf8");
}

/** Os `.ts` e `.tsx` de uma pasta, com o caminho lógico a partir da raiz e separador `/`. */
function arquivosDe(pasta: string): string[] {
  return readdirSync(RAIZ + pasta, { recursive: true, encoding: "utf8" })
    .map((caminho) => `${pasta}/${caminho.replace(/\\/gu, "/")}`)
    .filter((caminho) => /\.tsx?$/u.test(caminho))
    .sort();
}

describe("o Toaster — critério 1", () => {
  it("é montado uma vez, e no layout raiz", () => {
    const comToaster = arquivosDe("app").filter((caminho) => ler(caminho).includes("<Toaster"));
    expect(comToaster).toStrictEqual(["app/layout.tsx"]);
  });

  it("o sonner entra fixado, e o next-themes que o catálogo pede não entra", () => {
    const pacote = JSON.parse(ler("package.json")) as {
      dependencies: Record<string, string | undefined>;
    };
    expect(pacote.dependencies["sonner"]).toBe("2.0.8");
    expect(pacote.dependencies["next-themes"]).toBeUndefined();
    // O CLI do shadcn já instalou um pacote homônimo `cn` duas vezes (R-05 do 44b, A-44e-11 do 44e).
    expect(pacote.dependencies["cn"]).toBeUndefined();
  });

  it("o toque no aviso não fecha o modal que ficou aberto depois de um erro (R-1 da revisão)", () => {
    // Um novo `shadcn add dialog` desfaria a linha em silêncio; este caso é o alarme.
    expect(ler("src/interface/componentes/ui/dialog.tsx")).toContain("manterAbertoAoTocarNoAviso(evento)");
  });
});

describe("mensagemDoProblema — a regra da §4.3 da spec, em três passos", () => {
  it("a frase da tela para aquele código ganha do detail do servidor", () => {
    const corpo = { codigo: "CODIGO_PUBLICO_NAO_ENCONTRADO", detail: "Código não encontrado." };
    expect(
      mensagemDoProblema(corpo, { CODIGO_PUBLICO_NAO_ENCONTRADO: "Nenhuma organização usa este código." }),
    ).toBe("Nenhuma organização usa este código.");
  });

  it("com código e detail, e sem frase da tela, o texto é o do servidor", () => {
    expect(mensagemDoProblema({ codigo: "PEDIDO_JA_DECIDIDO", detail: "Este pedido já foi decidido." })).toBe(
      "Este pedido já foi decidido.",
    );
  });

  it("detail sem código não conta: é a frase genérica", () => {
    expect(mensagemDoProblema({ detail: "Algo aconteceu." })).toBe(MENSAGEM_GENERICA);
  });

  it("ERRO_INTERNO chega sem detail, e é a frase genérica", () => {
    expect(mensagemDoProblema({ codigo: "ERRO_INTERNO", traceId: "abc" })).toBe(MENSAGEM_GENERICA);
  });

  it("corpo vazio, nulo ou que não é objeto é a frase genérica", () => {
    expect(mensagemDoProblema({})).toBe(MENSAGEM_GENERICA);
    expect(mensagemDoProblema(null)).toBe(MENSAGEM_GENERICA);
    expect(mensagemDoProblema("<html>")).toBe(MENSAGEM_GENERICA);
    expect(mensagemDoProblema({ codigo: "X", detail: "   " })).toBe(MENSAGEM_GENERICA);
  });

  it("a frase genérica é a do guia, palavra por palavra", () => {
    expect(MENSAGEM_GENERICA).toBe("Não foi possível realizar a ação.");
  });
});

describe("as três formas do aviso — guia §7", () => {
  it("sucesso e erro usam a duração do pacote, e só levam descrição quando há uma", () => {
    avisarSucesso("Conta criada");
    avisarErro("Não foi possível entrar");
    avisarSucesso("Senha alterada", "Entre com ela.");
    expect(vi.mocked(toast.success)).toHaveBeenCalledWith("Conta criada", {});
    expect(vi.mocked(toast.error)).toHaveBeenCalledWith("Não foi possível entrar", {});
    expect(vi.mocked(toast.success)).toHaveBeenCalledWith("Senha alterada", { description: "Entre com ela." });
  });

  it("a atenção fica até ser fechada, porque existe para ser lida", () => {
    avisarAtencao("Vaga 12 passou a ser Unidade privativa");
    expect(vi.mocked(toast.warning)).toHaveBeenCalledWith("Vaga 12 passou a ser Unidade privativa", {
      duration: Number.POSITIVE_INFINITY,
    });
  });

  it("avisarConclusao escolhe a forma pelo campo, e o padrão é sucesso", () => {
    avisarConclusao({ titulo: "Responsável atribuído" });
    avisarConclusao({ forma: "atencao", titulo: "Tipo mudou", descricao: "2 ocorrências mantêm o anterior." });
    expect(vi.mocked(toast.success)).toHaveBeenCalledWith("Responsável atribuído", {});
    expect(vi.mocked(toast.warning)).toHaveBeenCalledWith("Tipo mudou", {
      description: "2 ocorrências mantêm o anterior.",
      duration: Number.POSITIVE_INFINITY,
    });
  });
});

describe("o formulário tocado — critério 2", () => {
  const CAMPOS = ["email", "senha"];
  const ERROS = { email: "Informe o seu e-mail.", senha: "Informe a senha." };

  function depois(...eventos: EventoDeInteracao[]): EstadoDeInteracao {
    return eventos.reduce((estado, evento) => interagir(estado, evento, CAMPOS), SEM_INTERACAO);
  }

  it("antes da primeira interação, nenhum campo mostra erro", () => {
    expect(erroVisivel(SEM_INTERACAO, "formulario", "email", ERROS)).toBeUndefined();
    expect(erroVisivel(SEM_INTERACAO, "formulario", "senha", ERROS)).toBeUndefined();
  });

  it("mudar um campo revela todos os campos com problema, no modo formulario", () => {
    const estado = depois({ tipo: "mudou", campo: "email" });
    expect(erroVisivel(estado, "formulario", "email", ERROS)).toBe("Informe o seu e-mail.");
    expect(erroVisivel(estado, "formulario", "senha", ERROS)).toBe("Informe a senha.");
  });

  it("passar o foco por um campo sem mudar nada não conta como interação", () => {
    const estado = depois({ tipo: "saiu", campo: "email" });
    expect(estado.interagiu).toBe(false);
    expect(erroVisivel(estado, "formulario", "email", ERROS)).toBeUndefined();
  });

  it("mudar um controle que não é campo do formulário não conta (a busca do modal de atribuição)", () => {
    const estado = depois({ tipo: "mudou", campo: "busca" });
    expect(estado).toStrictEqual(SEM_INTERACAO);
  });

  it("no modo campo, só o campo que perdeu o foco mostra o erro (a exceção de T-04)", () => {
    const estado = depois({ tipo: "mudou", campo: "email" }, { tipo: "saiu", campo: "email" });
    expect(erroVisivel(estado, "campo", "email", ERROS)).toBe("Informe o seu e-mail.");
    expect(erroVisivel(estado, "campo", "senha", ERROS)).toBeUndefined();
  });

  it("tentar enviar revela todos, nos dois modos", () => {
    const estado = depois({ tipo: "tentou-enviar" });
    for (const modo of ["formulario", "campo"] as const) {
      expect(erroVisivel(estado, modo, "email", ERROS)).toBe("Informe o seu e-mail.");
      expect(erroVisivel(estado, modo, "senha", ERROS)).toBe("Informe a senha.");
    }
  });

  it("recomeçar volta ao estado sem interação", () => {
    const estado = depois({ tipo: "mudou", campo: "email" }, { tipo: "tentou-enviar" }, { tipo: "recomecou" });
    expect(estado).toStrictEqual(SEM_INTERACAO);
  });

  it("o erro do servidor aparece sem interação, e some quando aquele campo muda", () => {
    const doServidor = { email: "Confira o e-mail." };
    expect(erroVisivel(SEM_INTERACAO, "formulario", "email", {}, doServidor)).toBe("Confira o e-mail.");
    const estado = depois({ tipo: "mudou", campo: "email" });
    expect(erroVisivel(estado, "formulario", "email", {}, doServidor)).toBeUndefined();
  });

  it("o erro do cliente, quando visível, ganha do erro do servidor", () => {
    const estado = depois({ tipo: "tentou-enviar" });
    expect(erroVisivel(estado, "formulario", "email", ERROS, { email: "Confira o e-mail." })).toBe(
      "Informe o seu e-mail.",
    );
  });

  it("o primeiro campo com problema segue a ordem dos campos, que é a do documento", () => {
    expect(primeiroComProblema(CAMPOS, { senha: "Informe a senha." })).toBe("senha");
    expect(primeiroComProblema(CAMPOS, ERROS)).toBe("email");
    expect(primeiroComProblema(CAMPOS, { email: undefined })).toBeNull();
  });
});

describe("a tradução de violação em mensagem por campo existe uma vez só", () => {
  it("errosDoSchema usa o mesmo schema que a ação, e fica com a primeira mensagem de cada campo", () => {
    expect(errosDoSchema(entrarSchema, { email: "", senha: "" })).toStrictEqual({
      email: "Informe o seu e-mail.",
      senha: "Informe a senha.",
    });
    expect(errosDoSchema(entrarSchema, { email: "helena@example.com", senha: "x" })).toStrictEqual({});
  });

  it("mensagensPorCampo junta o caminho com ponto", () => {
    expect(
      mensagensPorCampo([
        { path: ["contatos", 0, "valor"], message: "Confira o número." },
        { path: ["contatos", 0, "valor"], message: "Outra." },
      ]),
    ).toStrictEqual({ "contatos.0.valor": "Confira o número." });
  });
});

describe("cicloDoModal — a sequência de modal do guia §7", () => {
  const aberto = cicloDoModal(MODAL_FECHADO, { tipo: "abriu" }).estado;
  const enviando = cicloDoModal(aberto, { tipo: "enviou" }).estado;

  it("abrir começa limpo, e pede para limpar os campos", () => {
    expect(cicloDoModal(MODAL_FECHADO, { tipo: "abriu" })).toStrictEqual({
      estado: { aberto: true, enviando: false, aviso: null, precisaAtualizar: false },
      efeitos: ["limpar-campos"],
    });
  });

  it("enviar trava o modal e apaga a mensagem anterior", () => {
    const comMensagem = { ...aberto, aviso: "Algo" };
    expect(cicloDoModal(comMensagem, { tipo: "enviou" }).estado).toStrictEqual({
      aberto: true,
      enviando: true,
      aviso: null,
      precisaAtualizar: false,
    });
  });

  it("durante o envio, pedir para fechar não fecha (Esc, clique fora, X ou Fechar)", () => {
    expect(cicloDoModal(enviando, { tipo: "pediu-fechar" })).toStrictEqual({ estado: enviando, efeitos: [] });
  });

  it("um segundo envio durante o envio é ignorado", () => {
    expect(cicloDoModal(enviando, { tipo: "enviou" })).toStrictEqual({ estado: enviando, efeitos: [] });
  });

  it("sucesso: o aviso sai, o modal fecha e a página se atualiza", () => {
    expect(cicloDoModal(enviando, { tipo: "deu-certo" })).toStrictEqual({
      estado: MODAL_FECHADO,
      efeitos: ["avisar-sucesso", "atualizar-pagina"],
    });
  });

  it("falha: o aviso sai, a mensagem fica no modal aberto, e só o fechamento atualiza a página", () => {
    const falhou = cicloDoModal(enviando, { tipo: "falhou", aviso: "Este pedido já foi decidido." });
    expect(falhou).toStrictEqual({
      estado: { aberto: true, enviando: false, aviso: "Este pedido já foi decidido.", precisaAtualizar: true },
      efeitos: ["avisar-falha"],
    });
    expect(cicloDoModal(falhou.estado, { tipo: "pediu-fechar" })).toStrictEqual({
      estado: MODAL_FECHADO,
      efeitos: ["atualizar-pagina"],
    });
  });

  it("abrir e fechar sem enviar não custa ida ao servidor", () => {
    expect(cicloDoModal(aberto, { tipo: "pediu-fechar" })).toStrictEqual({ estado: MODAL_FECHADO, efeitos: [] });
  });
});

describe("chamarAcaoDeCredencial — a ação que não chega ao servidor", () => {
  it("devolve o estado que a ação devolveu", async () => {
    const recusada = async () => ({ recusa: "CREDENCIAL_INVALIDA" as const });
    expect(await chamarAcaoDeCredencial(recusada, {}, new FormData())).toStrictEqual({
      recusa: "CREDENCIAL_INVALIDA",
    });
  });

  it("sem rede, vira a falha que a tela escreve com a frase genérica, em vez de derrubar a tela", async () => {
    const semRede = async () => {
      throw new TypeError("Failed to fetch");
    };
    expect(await chamarAcaoDeCredencial(semRede, {}, new FormData())).toStrictEqual({
      recusa: "FALHA_DO_PROVEDOR",
    });
  });

  it("o redirecionamento do servidor atravessa: engoli-lo prenderia a pessoa em T-01", async () => {
    const entrou = async () => redirect("/");
    await expect(chamarAcaoDeCredencial(entrou, {}, new FormData())).rejects.toMatchObject({
      digest: expect.stringContaining("NEXT_REDIRECT") as unknown,
    });
  });
});

describe("texto de tela — critério 7", () => {
  /** Linha de comentário: `*`, `//`, `/*` ou `{/*` no começo. É a mesma poda do `grep` da spec §3.3. */
  const COMENTARIO = /^\s*(?:\*|\/\/|\/\*|\{\/\*)/u;

  it("nenhuma palavra do projeto em texto de tela, em app e src", () => {
    const achados = [...arquivosDe("app"), ...arquivosDe("src")].flatMap((caminho) =>
      ler(caminho)
        .split(/\r?\n/u)
        .map((linha, indice) => ({ caminho, numero: indice + 1, linha }))
        .filter(({ linha }) => /[Nn]esta (?:entrega|versão)/u.test(linha) && !COMENTARIO.test(linha))
        .map(({ caminho, numero }) => `${caminho}:${numero}`),
    );
    expect(achados).toStrictEqual([]);
  });
});
