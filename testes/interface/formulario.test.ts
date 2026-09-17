import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it, vi } from "vitest";
import { toast } from "sonner";

import {
  avisarAtencao,
  avisarConclusao,
  avisarErro,
  avisarSucesso,
  MENSAGEM_GENERICA,
  mensagemDoProblema,
} from "@/interface/componentes/retorno-de-acao";

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
