import { existsSync, readdirSync, readFileSync } from "node:fs";
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
import { cicloDoModal, estadoInicialDoModal, MODAL_FECHADO } from "@/interface/ganchos/use-envio-do-modal";
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

  it("o toque no aviso não fecha o modal que ficou aberto depois de um erro (R-1 do 44g; o sheet no 44i)", () => {
    // Um novo `shadcn add dialog` ou `shadcn add sheet` desfaria a linha em silêncio; este caso é o alarme.
    for (const arquivo of ["src/interface/componentes/ui/dialog.tsx", "src/interface/componentes/ui/sheet.tsx"]) {
      expect(ler(arquivo), arquivo).toContain("manterAbertoAoTocarNoAviso(evento)");
    }
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

  it("o modal pode nascer aberto, sem envio nem aviso (item 66, ?acao=avaliar)", () => {
    expect(estadoInicialDoModal(false)).toStrictEqual(MODAL_FECHADO);
    expect(estadoInicialDoModal(true)).toStrictEqual({
      aberto: true,
      enviando: false,
      aviso: null,
      precisaAtualizar: false,
    });
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

/** Os arquivos em que este item aplica o guia (spec §1.1). */
const ALCANCE = [
  "src/interface/componentes/formulario-de-entrada.tsx",
  "src/interface/componentes/formulario-de-cadastro.tsx",
  "src/interface/componentes/formulario-de-redefinicao.tsx",
  "src/interface/componentes/formulario-de-nova-senha.tsx",
  "src/interface/componentes/formulario-de-pedido-de-entrada.tsx",
  "src/interface/componentes/formulario-de-nova-organizacao.tsx",
  "src/interface/componentes/troca-de-organizacao.ts",
  "src/interface/componentes/modal-de-observacao.tsx",
  "src/interface/componentes/modal-de-resolucao.tsx",
  "src/interface/componentes/modal-de-motivo.tsx",
  "src/interface/componentes/modal-de-atribuicao.tsx",
  "src/interface/componentes/modal-de-avaliacao.tsx",
  "src/interface/componentes/barra-de-acoes.tsx",
  "src/interface/componentes/campo-de-solucao-aplicada.tsx",
  "src/interface/componentes/conversa-da-ocorrencia.tsx",
  "src/interface/componentes/comando-de-ocorrencia.ts",
];

describe("o alcance do 44g — critérios 6 e 9", () => {
  it("nenhum botão fica desabilitado por campo inválido (o grep do critério, ampliado)", () => {
    const achados = ALCANCE.flatMap((caminho) =>
      [...ler(caminho).matchAll(/disabled=\{[^}]*(?:=== null|!pode|!valido)[^}]*\}/gu)].map(
        (achado) => `${caminho}: ${achado[0]}`,
      ),
    );
    expect(achados).toStrictEqual([]);
  });

  it("nenhuma frase genérica própria: a única que sobra é a da leitura da conversa", () => {
    // "Carregar mais" é leitura, e a regra do guia é de envio (spec §3.2).
    const achados = ALCANCE.flatMap((caminho) =>
      [...ler(caminho).matchAll(/"Não foi possível [^"]*agora[^"]*"/gu)].map(
        (achado) => `${caminho}: ${achado[0]}`,
      ),
    );
    expect(achados).toStrictEqual([
      'src/interface/componentes/conversa-da-ocorrencia.tsx: "Não foi possível carregar mais agora. Tente de novo."',
    ]);
  });

  it("a frase genérica existe uma vez só no produto", () => {
    const comAFrase = [...arquivosDe("app"), ...arquivosDe("src")].filter((caminho) =>
      ler(caminho).includes('"Não foi possível realizar a ação."'),
    );
    expect(comAFrase).toStrictEqual(["src/interface/componentes/retorno-de-acao.ts"]);
  });
});

/** Os arquivos das duas telas e das peças do 44i (spec §1.1): as guardas de forma leem estes. */
const ALCANCE_DO_44I = [
  "app/(casca)/configuracao/page.tsx",
  "app/(casca)/configuracao/loading.tsx",
  "app/(casca)/meus-dados/page.tsx",
  "src/interface/componentes/codigo-da-organizacao.tsx",
  "src/interface/componentes/edicao-de-nome.tsx",
  "src/interface/componentes/modal.tsx",
  "src/interface/componentes/cartao.tsx",
  "src/interface/componentes/cabecalho-da-pagina.tsx",
  "src/interface/componentes/campo.tsx",
  "src/interface/componentes/casca/menu-de-pessoa.tsx",
];

/** As três páginas das duas telas: as que o critério 44i.9 limpa. */
const TELAS_DO_44I = ALCANCE_DO_44I.filter((caminho) => caminho.startsWith("app/"));

describe("o alcance do 44i — o cartão mostra, o modal edita", () => {
  it("o modal rola só no corpo: cabeçalho e rodapé ficam fixos, sem scroll-area (item 68a)", () => {
    const fonte = ler("src/interface/componentes/modal.tsx");
    // A guarda lê as classes, não a ordem delas: `flex max-h-[85dvh] flex-col` não contém "flex flex-col".
    const classes = (nome: string) =>
      (fonte.match(new RegExp(`const ${nome} =\\s*"([^"]*)"`, "u"))?.[1] ?? "").split(/\s+/u);
    for (const nome of ["CONTEUDO_DO_DIALOG", "CONTEUDO_DO_SHEET"]) {
      expect(classes(nome), nome).toEqual(expect.arrayContaining(["flex", "flex-col", "overflow-hidden"]));
      expect(classes(nome), nome).not.toContain("overflow-y-auto");
    }
    // O corpo: uma cadeia com as três classes que o fazem rolar dentro da coluna, em qualquer ordem entre outras.
    expect(fonte).toMatch(/"[^"]*\bmin-h-0\b[^"]*\bflex-1\b[^"]*\boverflow-y-auto\b[^"]*"/u);
    // O docblock escreve a palavra para explicar a ausência; a guarda olha o import.
    expect(fonte).not.toMatch(/ui\/scroll-area/u);
  });

  it("o modal é uma raiz com as duas peças do catálogo, a gaveta vem de baixo, e sem pacote novo", () => {
    const fonte = ler("src/interface/componentes/modal.tsx");
    expect(fonte).toContain("useIsMobile()");
    expect(fonte).toContain("<DialogContent");
    expect(fonte).toContain('<SheetContent side="bottom"');
    expect(fonte).toContain("duration-(--tempo-gaveta)");
    expect(fonte).toContain("ease-(--curva-gaveta)");
    expect(fonte).not.toMatch(/from "(?:vaul|@\/interface\/componentes\/ui\/drawer)"/u);
    // O principal veste a marca por padrão; a variante destrutiva entrou no 44j, para *Recusar pedido*.
    expect(fonte).toContain('variante = "marca"');
    expect(fonte).toContain('variant={variante === "destrutiva" ? "destructive" : "marca"}');
  });

  it("T-16 edita o nome no modal do nome, e o formulário de campo aberto da pessoa saiu", () => {
    const fonte = ler("app/(casca)/meus-dados/page.tsx");
    expect(fonte).toMatch(/<EdicaoDeNome\s+alvo="pessoa"/u);
    expect(fonte).not.toContain("searchParams");
    expect(existsSync(RAIZ + "src/interface/componentes/formulario-de-pessoa.tsx")).toBe(false);
  });

  it("nenhum botão fica desabilitado por campo inválido (critério 44g.9, no alcance do 44i)", () => {
    const achados = ALCANCE_DO_44I.flatMap((caminho) =>
      [...ler(caminho).matchAll(/disabled=\{[^}]*(?:=== null|!pode|!valido)[^}]*\}/gu)].map(
        (achado) => `${caminho}: ${achado[0]}`,
      ),
    );
    expect(achados).toStrictEqual([]);
  });

  it("o desfecho por endereço saiu do produto, com os dois formulários de campo aberto (critério 44i.8)", () => {
    expect(existsSync(RAIZ + "src/interface/componentes/formulario-de-organizacao.tsx")).toBe(false);
    const achados = [...arquivosDe("app"), ...arquivosDe("src")].flatMap((caminho) =>
      ler(caminho)
        .split(/\r?\n/u)
        .map((linha, indice) => ({ linha, numero: indice + 1 }))
        // **O parâmetro, e não a palavra** (R-1 da revisão): `"Organização renomeada"` é o título do aviso.
        .filter(({ linha }) => /\?renomead[ao]=|\["renomead[ao]"\]/u.test(linha))
        .map(({ numero }) => `${caminho}:${numero}`),
    );
    expect(achados).toStrictEqual([]);
  });

  it("nenhum tamanho fora dos sete papéis (critério 44i.9)", () => {
    const achados = ALCANCE_DO_44I.flatMap((caminho) =>
      [...ler(caminho).matchAll(/\btext-(?:xs|sm|base|lg|xl|2xl)\b/gu)].map(
        (achado) => `${caminho}: ${achado[0]}`,
      ),
    );
    expect(achados).toStrictEqual([]);
  });

  it("as duas telas não repetem a marca e não têm Voltar no conteúdo (critério 44i.9)", () => {
    for (const caminho of TELAS_DO_44I) {
      const fonte = ler(caminho);
      expect(fonte, caminho).not.toContain("Resolve Aí");
      expect(fonte, caminho).not.toMatch(/^\s*Voltar\s*$/mu);
    }
  });

  it("T-15 edita o nome no modal, e as duas caixas e a frase do apagar saíram (critérios 44i.2 e 44i.4)", () => {
    const fonte = ler("app/(casca)/configuracao/page.tsx");
    expect(fonte).toMatch(/<EdicaoDeNome\s+alvo="organizacao"/u);
    expect(fonte).not.toContain("searchParams");
    expect(fonte).not.toContain("Não há como apagar");
    expect(fonte).not.toContain("function Destino(");
  });
});

/** Os arquivos em que o 44j aplica o guia: as guardas de forma leem estes. */
const ALCANCE_DO_44J = [
  "app/(casca)/vinculos/page.tsx",
  "app/(casca)/vinculos/loading.tsx",
  "app/(casca)/vinculos/nova/page.tsx",
  "app/(casca)/vinculos/nova/loading.tsx",
  "app/(casca)/vinculos/[pessoaId]/editar/page.tsx",
  "app/(casca)/vinculos/[pessoaId]/editar/loading.tsx",
  "src/interface/componentes/tabela-de-participantes.tsx",
  "src/interface/componentes/linhas-de-participantes.ts",
  "src/interface/componentes/ordenacao-em-tres-estados.ts",
  "src/interface/componentes/contato-por-icone.tsx",
  "src/interface/componentes/frases-de-participantes.ts",
  "src/interface/componentes/regras-do-vinculo.ts",
  "src/interface/componentes/escolhas-do-vinculo.tsx",
  "src/interface/componentes/decisao-de-pedido-de-entrada.tsx",
  "src/interface/componentes/remocao-de-vinculo.tsx",
  "src/interface/componentes/frases-da-remocao.ts",
  "src/interface/componentes/formulario-de-vinculo.tsx",
  "src/interface/componentes/sub-formulario-de-contatos.tsx",
  "src/interface/componentes/ordem-manual.ts",
  "src/interface/componentes/controles-de-ordem.tsx",
  "src/interface/componentes/botao-de-icone.tsx",
  "src/interface/componentes/caminho-da-pagina.tsx",
  "src/interface/componentes/ficha-de-pessoa.tsx",
  "src/interface/ganchos/use-arrasto-de-linha.ts",
];

/** As quatro páginas e os dois esqueletos: as que o critério 44j.12 limpa. */
const PAGINAS_DO_44J = ALCANCE_DO_44J.filter((caminho) => caminho.startsWith("app/"));

describe("o alcance do 44j — as peças da tabela e da ordem manual", () => {
  it("os quatro componentes do catálogo entraram (critério 44j.11)", () => {
    for (const peca of ["alert-dialog", "breadcrumb", "radio-group", "switch"]) {
      expect(existsSync(`${RAIZ}src/interface/componentes/ui/${peca}.tsx`), peca).toBe(true);
    }
  });

  it("o arrastar é o nativo do HTML, sem pacote novo (critério 44j.9)", () => {
    const fonte = ler("src/interface/ganchos/use-arrasto-de-linha.ts");
    expect(fonte).toContain("dataTransfer");
    expect(fonte).toContain("setDragImage");
    const importados = [...fonte.matchAll(/from "([^"]+)"/gu)].map((achado) => achado[1] ?? "");
    expect(importados.filter((modulo) => modulo !== "react" && !modulo.startsWith("@/"))).toStrictEqual([]);
  });

  it("a alça só existe onde há ponteiro fino, e sem tocar a folha de estilo global", () => {
    expect(ler("src/interface/componentes/controles-de-ordem.tsx")).toContain(
      "[@media(hover:hover)_and_(pointer:fine)]:",
    );
  });

  it("remover usa a confirmação do catálogo, e quem fecha é o ciclo (critérios 44j.4 e 44j.11)", () => {
    const fonte = ler("src/interface/componentes/remocao-de-vinculo.tsx");
    expect(fonte).toContain("<AlertDialog");
    expect(fonte).toContain("useEnvioDoModal");
    // `AlertDialogAction` fecha no clique, e o envio precisa do modal aberto até a resposta chegar. A
    // guarda olha o `import` e o uso, porque o docblock escreve o nome para explicar a ausência.
    expect(fonte).not.toMatch(/^\s*AlertDialogAction,$/mu);
    expect(fonte).not.toMatch(/<AlertDialogAction\b/u);
    expect(fonte).not.toContain("<dialog");
    expect(fonte).not.toContain("showModal");
  });

  it("responder é um modal de duas faces, e o botão diz o papel (critérios 44j.6 e 44j.7)", () => {
    const fonte = ler("src/interface/componentes/decisao-de-pedido-de-entrada.tsx");
    expect(fonte).toContain("<Modal");
    expect(fonte).toContain("rotuloDeAprovar(papel)");
    expect(fonte).toContain('variante="destrutiva"');
    expect(fonte).not.toContain("<dialog");
    expect(fonte).not.toContain("showModal");
    // O botão nunca fica indisponível por falta de papel (critério 44g.9).
    expect(fonte).not.toMatch(/disabled=\{[^}]*papel[^}]*\}/u);
  });

  it("a tabela substitui as duas listas, e a página não lê o endereço no servidor (critérios 44j.1 e 44j.3)", () => {
    const pagina = ler("app/(casca)/vinculos/page.tsx");
    expect(pagina).toContain("<TabelaDeParticipantes");
    expect(pagina).not.toContain("searchParams");
    expect(pagina).not.toContain("FaixaDoDesfecho");
    expect(existsSync(`${RAIZ}src/interface/componentes/lista-de-vinculos.tsx`)).toBe(false);
    // O estado da tabela vive no navegador, e nenhum clique de filtro vai ao servidor.
    const tabela = ler("src/interface/componentes/tabela-de-participantes.tsx");
    expect(tabela).toContain("useSearchParams()");
    expect(tabela).toContain("window.history.pushState");
    expect(tabela).toContain("window.history.replaceState");
  });

  it("nenhum botão fica desabilitado por campo inválido (critério 44g.9, no alcance do 44j)", () => {
    const achados = ALCANCE_DO_44J.flatMap((caminho) =>
      [...ler(caminho).matchAll(/disabled=\{[^}]*(?:=== null|!pode|!valido)[^}]*\}/gu)].map(
        (achado) => `${caminho}: ${achado[0]}`,
      ),
    );
    expect(achados).toStrictEqual([]);
  });

  it("nenhum tamanho fora dos sete papéis (critério 44j.12)", () => {
    const achados = ALCANCE_DO_44J.flatMap((caminho) =>
      [...ler(caminho).matchAll(/\btext-(?:xs|sm|base|lg|xl|2xl)\b/gu)].map(
        (achado) => `${caminho}: ${achado[0]}`,
      ),
    );
    expect(achados).toStrictEqual([]);
  });

  it("as páginas não repetem a marca e não têm Voltar no conteúdo (critério 44j.12)", () => {
    for (const caminho of PAGINAS_DO_44J) {
      const fonte = ler(caminho);
      expect(fonte, caminho).not.toContain("Resolve Aí");
      expect(fonte, caminho).not.toMatch(/^\s*Voltar\s*$/mu);
    }
  });

  it("nenhum diálogo nativo sobra em T-08 (critério 44j.11)", () => {
    for (const caminho of ALCANCE_DO_44J) {
      expect(ler(caminho), caminho).not.toContain("<dialog");
      expect(ler(caminho), caminho).not.toContain("showModal");
    }
  });

  it("os quatro desfechos por endereço saíram do produto (critério 44j.10)", () => {
    const achados = [...arquivosDe("app"), ...arquivosDe("src")].flatMap((caminho) =>
      ler(caminho)
        .split(/\r?\n/u)
        .map((linha, indice) => ({ linha, numero: indice + 1 }))
        .filter(({ linha }) => /(?:cadastrado|corrigido|removido|decidido)=/u.test(linha))
        .map(({ numero }) => `${caminho}:${String(numero)}`),
    );
    expect(achados).toStrictEqual([]);
  });

  it("nenhuma frase genérica própria em T-08 (critério 44g.6)", () => {
    const achados = ALCANCE_DO_44J.flatMap((caminho) =>
      [...ler(caminho).matchAll(/"Não foi possível [^"]*agora[^"]*"/gu)].map(
        (achado) => `${caminho}: ${achado[0]}`,
      ),
    );
    expect(achados).toStrictEqual([]);
  });

  it("na edição, o cartão Pessoa é Nome, Unidade e Papel, em três colunas a partir de md (item 68a)", () => {
    const fonte = ler("src/interface/componentes/formulario-de-vinculo.tsx");
    const inicio = fonte.indexOf('<div className="grid md:grid-cols-3">');
    expect(inicio).toBeGreaterThan(-1);
    const edicao = fonte.slice(inicio);
    const posicao = (trecho: string) => edicao.indexOf(trecho);
    expect(posicao("campoDoNome")).toBeLessThan(posicao("{campoDaUnidade}"));
    expect(posicao("{campoDaUnidade}")).toBeLessThan(posicao("TEXTOS_DO_FORMULARIO.papel"));
    expect(fonte).not.toContain('<div className="grid lg:grid-cols-3">');
  });

  it("o contato é botão que abre popover, sem hover-card e sem +N (item 68a, critério 68.4)", () => {
    const peca = ler("src/interface/componentes/contato-por-icone.tsx");
    expect(peca).toContain("<Popover");
    expect(peca).toContain("rotuloDoContato(");
    expect(peca).toContain('role="status"');
    // O docblock escreve a palavra para explicar a ausência; a guarda olha o import.
    expect(peca).not.toMatch(/ui\/hover-card/u);
    const tabela = ler("src/interface/componentes/tabela-de-participantes.tsx");
    expect(tabela).toContain("<ContatoPorIcone");
    expect(tabela).not.toContain("maisContatos");
  });
});

/**
 * Os arquivos vivos do alcance do 44k: as duas páginas, os dois esqueletos, os seis componentes novos, o
 * gancho, as duas regras puras e o seletor de ícone. **São quatorze, e não os onze que a spec mediu** —
 * onze era o número dos arquivos de **antes**, seis dos quais morreram.
 */
const ALCANCE_DO_44K = [
  "app/(casca)/configuracao/categorias/page.tsx",
  "app/(casca)/configuracao/categorias/loading.tsx",
  "app/(casca)/configuracao/areas/page.tsx",
  "app/(casca)/configuracao/areas/loading.tsx",
  "src/interface/componentes/lista-de-ordem-manual.tsx",
  "src/interface/componentes/tabela-de-categorias.tsx",
  "src/interface/componentes/tabela-de-areas.tsx",
  "src/interface/componentes/modal-de-categoria.tsx",
  "src/interface/componentes/modal-de-area.tsx",
  "src/interface/componentes/situacao-do-item.tsx",
  "src/interface/componentes/ordem-da-lista.ts",
  "src/interface/componentes/frases-da-configuracao.ts",
  "src/interface/componentes/icone-de-categoria.tsx",
  "src/interface/ganchos/use-ordem-gravada.ts",
];

/** As duas páginas e os dois esqueletos: as que o critério 44k.10 limpa. */
const PAGINAS_DO_44K = ALCANCE_DO_44K.filter((caminho) => caminho.startsWith("app/"));

/** As seis rotas e componentes que o critério 44k.6 remove. */
const MORREU_NO_44K = [
  "app/(casca)/configuracao/categorias/nova/page.tsx",
  "app/(casca)/configuracao/categorias/[categoriaId]/editar/page.tsx",
  "app/(casca)/configuracao/areas/nova/page.tsx",
  "app/(casca)/configuracao/areas/[areaId]/editar/page.tsx",
  "src/interface/componentes/formulario-de-categoria.tsx",
  "src/interface/componentes/formulario-de-area.tsx",
];

describe("o alcance do 44k — as duas listas de ordem manual", () => {
  it("as quatro rotas de criar e editar e os dois formulários não existem (critério 44k.6)", () => {
    for (const caminho of MORREU_NO_44K) {
      expect(existsSync(RAIZ + caminho), caminho).toBe(false);
    }
  });

  /**
   * **A guarda é ancorada em `configuracao/`, e o `/editar"` da spec não serviria:** os dois links de
   * editar de antes eram literais de gabarito (`` `${…}/editar` ``), então `grep '/editar"'` já devolvia
   * vazio antes deste item. Abrir para `/editar` sozinho pegaria `/vinculos/{pessoaId}/editar`, que fica.
   */
  it("nenhum link para as quatro rotas sobrou no produto (critério 44k.6)", () => {
    const achados = [...arquivosDe("app"), ...arquivosDe("src")].flatMap((caminho) =>
      ler(caminho)
        .split(/\r?\n/u)
        .map((linha, indice) => ({ linha, numero: indice + 1 }))
        .filter(({ linha }) => !/^\s*(?:\*|\/\/)/u.test(linha))
        .filter(({ linha }) =>
          /configuracao\/(?:categorias|areas)\/(?:nova|[^"'`]*\/editar)/u.test(linha),
        )
        .map(({ numero }) => `${caminho}:${String(numero)}`),
    );
    expect(achados).toStrictEqual([]);
  });

  it("nenhum diálogo nativo sobra no produto inteiro (critério 44k.5)", () => {
    const achados = [...arquivosDe("app"), ...arquivosDe("src")].filter((caminho) => {
      const fonte = ler(caminho);
      return fonte.includes("<dialog") || fonte.includes("showModal");
    });
    expect(achados).toStrictEqual([]);
  });

  it("nenhum botão fica desabilitado por campo inválido (critério 44g.9, no alcance do 44k)", () => {
    const achados = ALCANCE_DO_44K.flatMap((caminho) =>
      [...ler(caminho).matchAll(/disabled=\{[^}]*(?:=== null|!pode|!valido)[^}]*\}/gu)].map(
        (achado) => `${caminho}: ${achado[0]}`,
      ),
    );
    expect(achados).toStrictEqual([]);
  });

  it("nenhum tamanho fora dos sete papéis (critério 44k.10)", () => {
    const achados = ALCANCE_DO_44K.flatMap((caminho) =>
      [...ler(caminho).matchAll(/\btext-(?:xs|sm|base|lg|xl|2xl)\b/gu)].map(
        (achado) => `${caminho}: ${achado[0]}`,
      ),
    );
    expect(achados).toStrictEqual([]);
  });

  it("nenhuma frase genérica própria (critério 44g.6)", () => {
    const achados = ALCANCE_DO_44K.flatMap((caminho) =>
      [...ler(caminho).matchAll(/"Não foi possível [^"]*agora[^"]*"/gu)].map(
        (achado) => `${caminho}: ${achado[0]}`,
      ),
    );
    expect(achados).toStrictEqual([]);
  });

  it("as páginas não repetem a marca e não têm Voltar no conteúdo (critério 44k.10)", () => {
    for (const caminho of PAGINAS_DO_44K) {
      const fonte = ler(caminho);
      expect(fonte, caminho).not.toContain("Resolve Aí");
      expect(fonte, caminho).not.toMatch(/^\s*Voltar\s*$/mu);
    }
  });

  it("os desfechos por endereço de T-09 e T-14 saíram do produto (critério 44k.10)", () => {
    const achados = [...arquivosDe("app"), ...arquivosDe("src")].flatMap((caminho) =>
      ler(caminho)
        .split(/\r?\n/u)
        .map((linha, indice) => ({ linha, numero: indice + 1 }))
        .filter(({ linha }) => /(?:criada|alterada|mantem)=/u.test(linha))
        .map(({ numero }) => `${caminho}:${String(numero)}`),
    );
    expect(achados).toStrictEqual([]);
  });

  it("as duas páginas não leem o endereço e não têm faixa de desfecho (critérios 44k.1 e 44k.10)", () => {
    for (const caminho of PAGINAS_DO_44K.filter((arquivo) => arquivo.endsWith("/page.tsx"))) {
      const fonte = ler(caminho);
      expect(fonte, caminho).not.toContain("searchParams");
      expect(fonte, caminho).not.toContain("FaixaDoDesfecho");
      expect(fonte, caminho).not.toContain("Não há como apagar");
    }
  });

  it("criar e editar são modal, e o corpo não manda ordem nem ativa (critério 44k.5)", () => {
    for (const caminho of [
      "src/interface/componentes/modal-de-categoria.tsx",
      "src/interface/componentes/modal-de-area.tsx",
    ]) {
      const fonte = ler(caminho);
      expect(fonte, caminho).toContain("<Modal");
      // **A guarda olha codigo, e nao a palavra:** o docblock destes arquivos explica por que `ordem`
      // e `ativa` nao estao aqui, e uma guarda de substring falharia no proprio comentario.
      expect(fonte, caminho).not.toMatch(/\bordem:/u);
      expect(fonte, caminho).not.toMatch(/\bativa:/u);
    }
  });

  it("a confirmação de situação usa o alert-dialog, e quem fecha é o ciclo (critério 44k.7)", () => {
    const fonte = ler("src/interface/componentes/situacao-do-item.tsx");
    expect(fonte).toContain("<AlertDialog");
    expect(fonte).toContain("useEnvioDoModal");
    // `AlertDialogAction` fecha no clique, e o envio precisa do modal aberto até a resposta chegar. A
    // guarda olha o `import` e o uso, porque o docblock escreve o nome para explicar a ausência.
    expect(fonte).not.toMatch(/^\s*AlertDialogAction,$/mu);
    expect(fonte).not.toMatch(/<AlertDialogAction\b/u);
    expect(fonte).toContain('variant={textos.destrutiva ? "destructive" : "marca"}');
  });

  it("a vaga da tabela é uma linha, e reusa a classe do 44j (achado A-05 da spec)", () => {
    const fonte = ler("src/interface/componentes/lista-de-ordem-manual.tsx");
    expect(fonte).toContain("CLASSE_DA_VAGA");
    expect(fonte).toContain("<td colSpan=");
    // `VagaDeArrasto` desenha uma `<div>`, e dentro de `<tbody>` só cabe `<tr>`. A guarda olha o
    // `import` e o uso: o docblock escreve o nome para explicar por que ele não serve aqui.
    expect(fonte).not.toMatch(/^\s*VagaDeArrasto,$/mu);
    expect(fonte).not.toMatch(/<VagaDeArrasto\b/u);
  });

  it("a ordem manual não trouxe dependência nova (critério 44k.2)", () => {
    for (const caminho of [
      "src/interface/componentes/lista-de-ordem-manual.tsx",
      "src/interface/ganchos/use-ordem-gravada.ts",
    ]) {
      const importados = [...ler(caminho).matchAll(/from "([^"]+)"/gu)].map((achado) => achado[1] ?? "");
      const externos = importados.filter(
        (modulo) => !modulo.startsWith("@/") && modulo !== "react" && !modulo.startsWith("next/"),
      );
      expect(externos, caminho).toStrictEqual(caminho.endsWith(".tsx") ? ["lucide-react"] : []);
    }
  });

  it("a legenda dos dois tipos fica no cartão, nunca em dica de ponteiro (critério 44k.9)", () => {
    const fonte = ler("src/interface/componentes/tabela-de-areas.tsx");
    expect(fonte).toContain("LEGENDA_DOS_TIPOS");
    expect(fonte).not.toContain("Tooltip");
    expect(fonte).not.toContain("HoverCard");
  });

  it("nenhum controle cru fora de ui/, fora o rádio da grade de ícones (G7 do guia)", () => {
    const achados = ALCANCE_DO_44K.flatMap((caminho) =>
      [...ler(caminho).matchAll(/<(?:select|textarea|button)(?:\s|>|$)/gu)].map(
        (achado) => `${caminho}: ${achado[0]}`,
      ),
    );
    expect(achados).toStrictEqual([]);
    // A exceção declarada: o catálogo não tem peça para escolher entre 25 desenhos.
    const crus = ALCANCE_DO_44K.filter((caminho) => /<input/u.test(ler(caminho)));
    expect(crus).toStrictEqual(["src/interface/componentes/icone-de-categoria.tsx"]);
  });
});

const ALCANCE_DO_44L = [
  "app/(foco)/ocorrencias/nova/page.tsx",
  "src/interface/componentes/formulario-de-ocorrencia.tsx",
  "src/interface/componentes/controle-de-foto.tsx",
  "src/interface/componentes/seletor-de-area.tsx",
  "src/interface/componentes/depois-de-registrar.tsx",
  "src/interface/componentes/registro-de-ocorrencia.ts",
  "src/interface/componentes/areas-usadas.ts",
];

describe("o alcance do 44l — T-04 com a área que se busca", () => {
  it("as duas peças do catálogo entraram, e o cmdk é o único pacote novo (critério 44l.3)", () => {
    expect(existsSync(RAIZ + "src/interface/componentes/ui/command.tsx")).toBe(true);
    expect(existsSync(RAIZ + "src/interface/componentes/ui/popover.tsx")).toBe(true);
    const pacote = JSON.parse(ler("package.json")) as { dependencies: Record<string, string> };
    // Fixado, sem acento circunflexo: a ADR-0011 faz da atualização uma decisão.
    expect(pacote.dependencies.cmdk).toBe("1.1.1");
    // O `popover` usa o guarda-chuva que já está instalado; nenhum `@radix-ui/*` avulso entrou com ele.
    const avulsos = Object.keys(pacote.dependencies).filter((nome) => nome.startsWith("@radix-ui/"));
    expect(avulsos).toStrictEqual([]);
  });

  it("nenhum controle cru em T-04, fora o de arquivo (critério 44l.6, e o G7 do guia)", () => {
    const achados = ALCANCE_DO_44L.flatMap((caminho) =>
      [...ler(caminho).matchAll(/<(?:select|textarea|button)(?:\s|>|$)/gu)].map(
        (achado) => `${caminho}: ${achado[0]}`,
      ),
    );
    expect(achados).toStrictEqual([]);
    // A exceção declarada: o catálogo não tem peça para entrada de arquivo, e o G7 não conta entrada.
    const crus = ALCANCE_DO_44L.filter((caminho) => /<input/u.test(ler(caminho)));
    expect(crus).toStrictEqual(["src/interface/componentes/controle-de-foto.tsx"]);
  });

  it("nenhum tamanho fora dos sete papéis (critério 44l.14)", () => {
    const achados = ALCANCE_DO_44L.flatMap((caminho) =>
      [...ler(caminho).matchAll(/\btext-(?:xs|sm|base|lg|xl|2xl|3xl)\b/gu)].map(
        (achado) => `${caminho}: ${achado[0]}`,
      ),
    );
    expect(achados).toStrictEqual([]);
  });

  // **A guarda do 44l.14 que vivia aqui foi absorvida pela do 44m.2**, que afirma a mesma coisa com a
  // lista de hoje: T-04 saiu da moldura no 44l, e as quatro telas de credencial saíram no 44m.

  it("a busca do cmdk fica desligada, e o casamento é o mesmo do 44j (critério 44l.3)", () => {
    const fonte = ler("src/interface/componentes/seletor-de-area.tsx");
    // Sem isto, o filtro de fábrica do `cmdk` — pontuação aproximada — acharia *Garagem* digitando "gm",
    // e o produto teria duas buscas com regras diferentes.
    expect(fonte).toContain("shouldFilter={false}");
    expect(fonte).toContain("filtrarPeloNome");
  });

  it("o confirm() do navegador saiu, e o descarte é o alert-dialog do catálogo (critério 44l.9)", () => {
    const fonte = ler("src/interface/componentes/formulario-de-ocorrencia.tsx");
    expect(fonte).not.toMatch(/\bconfirm\(/u);
    expect(fonte).toContain("<AlertDialog");
    // Nenhum `confirm(` sobra em app e src: era o único do produto.
    const sobras = [...arquivosDe("app"), ...arquivosDe("src")].filter((caminho) =>
      /(?:^|[^.\w])confirm\(/u.test(ler(caminho)),
    );
    expect(sobras).toStrictEqual([]);
  });

  it("o erro de campo de T-04 usa o modo campo, e o resto do produto não (critério 44l.7)", () => {
    const comModoCampo = [...arquivosDe("app"), ...arquivosDe("src")].filter((caminho) =>
      ler(caminho).includes('modo: "campo"'),
    );
    expect(comModoCampo).toStrictEqual(["src/interface/componentes/formulario-de-ocorrencia.tsx"]);
  });

  it("a foto mantém a palavra junto da barra — compromisso A-5 (critério 44l.2)", () => {
    const fonte = ler("src/interface/componentes/controle-de-foto.tsx");
    expect(fonte).toContain('role="status"');
    expect(ler("src/interface/componentes/registro-de-ocorrencia.ts")).toContain(
      "Você pode continuar escrevendo.",
    );
    // A barra é decoração: quem carrega o estado para o leitor de tela é a frase.
    expect(fonte).toContain('aria-hidden="true"');
    // E ela para sob preferência por movimento reduzido (guia §6).
    expect(fonte).toContain("motion-safe:animate-pulse");
  });

  it("o botão de ícone fora da casca monta o próprio TooltipProvider (C-6)", () => {
    // O `BotaoDeIcone` envolve o botão numa dica do Radix, e o Radix **lança** sem provedor acima — o
    // contexto dele não tem valor padrão. Nas telas da casca o provedor vem do `SidebarProvider`; T-04
    // está na moldura focada, que não tem barra lateral. Sem esta linha a tela quebra ao escolher a
    // primeira foto, e **nenhum outro verificador pega**: não há teste de componente (ADR-0008).
    expect(ler("src/interface/componentes/controle-de-foto.tsx")).toContain("<TooltipProvider>");
  });

  it("a área lê o armazenamento no manipulador, e não num efeito (C-8)", () => {
    const fonte = ler("src/interface/componentes/seletor-de-area.tsx");
    expect(fonte).toContain("lerAreasUsadas");
    // `react-hooks/set-state-in-effect` reprova `setState` no corpo de um efeito, e este projeto não tem
    // `eslint-disable` para gastar. Abrir é um evento; ler a preferência do aparelho é a resposta a ele.
    expect(fonte).not.toContain("useEffect");
  });

  it("a ordem dos campos é foto → título → descrição → categoria → área → referência", () => {
    // **É a guarda mais importante deste bloco**, porque a ordem é o que faz o RNF6 caber e nada mais a
    // protege: ela economiza duas trocas de teclado, cobre o cold start com os dois campos de rede por
    // último, e põe a foto primeiro para o envio correr em paralelo (protótipo §2.3 e §2.5, DG-5).
    const fonte = ler("src/interface/componentes/formulario-de-ocorrencia.tsx");
    const posicoes = [
      "<ControleDeFoto",
      'id="titulo"',
      'id="descricao"',
      'id="categoriaId"',
      'id="areaId"',
      'id="localizacaoComplemento"',
    ].map((marca) => fonte.indexOf(marca));
    expect(posicoes.every((posicao) => posicao !== -1)).toBe(true);
    expect([...posicoes].sort((a, b) => a - b)).toStrictEqual(posicoes);
  });

  it("a tela não repete a marca e não diz que outros moradores veem a ocorrência (critério 44l.12)", () => {
    for (const caminho of ALCANCE_DO_44L) {
      const fonte = ler(caminho);
      expect(fonte, caminho).not.toContain("Resolve Aí");
    }
    // A D10 diz isso de área comum, mas a capacidade está ⬜ no escopo: hoje o Solicitante vê só as
    // próprias. E o "do condomínio" da prancheta sai — pela D3, a organização pode ser empresa ou bairro.
    const painel = ler("src/interface/componentes/registro-de-ocorrencia.ts");
    expect(painel).toContain("Quem acompanha: você e os Gestores.");
    expect(painel).not.toContain("do condomínio");
    expect(painel).not.toContain("moradores");
  });

  it("as usadas por você são preferência no aparelho, e não cache de resposta (critério 44l.4)", () => {
    const fonte = ler("src/interface/componentes/areas-usadas.ts");
    // A S-T6 do inventário proíbe guardar o corpo de uma resposta. O que se guarda é uma lista de `areaId`.
    expect(fonte).toContain("resolve-ai.areas-usadas.");
    expect(fonte).not.toContain("fetch(");
    // A chave é por organização: uma só misturaria os locais de quem tem dois vínculos.
    expect(fonte).toContain("PREFIXO + organizacaoId");
    // Falha de leitura ou escrita é engolida: `localStorage` lança em janela privada, e uma lista de
    // conveniência nunca pode impedir o registro na tela que o RNF6 cronometra.
    expect([...fonte.matchAll(/catch\s*\{/gu)]).toHaveLength(2);
  });
});

const ALCANCE_DO_44M = [
  "app/entrar/page.tsx",
  "app/criar-conta/page.tsx",
  "app/redefinir-senha/page.tsx",
  "app/definir-senha/page.tsx",
  "src/interface/componentes/formulario-de-entrada.tsx",
  "src/interface/componentes/formulario-de-cadastro.tsx",
  "src/interface/componentes/formulario-de-redefinicao.tsx",
  "src/interface/componentes/formulario-de-nova-senha.tsx",
  "src/interface/componentes/moldura-de-conta.tsx",
  "src/interface/componentes/campo-de-senha.tsx",
  "src/interface/componentes/marca.tsx",
];

describe("o alcance do 44m — as telas de conta na moldura nova", () => {
  it("nenhum tamanho fora dos sete papéis (critério 44m.3)", () => {
    const achados = ALCANCE_DO_44M.flatMap((caminho) =>
      [...ler(caminho).matchAll(/\btext-(?:xs|sm|base|lg|xl|2xl|3xl)\b/gu)].map(
        (achado) => `${caminho}: ${achado[0]}`,
      ),
    );
    expect(achados).toStrictEqual([]);
  });

  it("nenhum controle cru nas telas de conta (critério 44m.4, e o G7 do guia)", () => {
    // O botão de mostrar a senha é o `Button` do catálogo. Um controle cru aqui passaria no olho e
    // derrubaria o G7, que é o único portão que o alcança.
    const achados = ALCANCE_DO_44M.flatMap((caminho) =>
      [...ler(caminho).matchAll(/<(?:select|textarea|button)(?:\s|>|$)/gu)].map(
        (achado) => `${caminho}: ${achado[0]}`,
      ),
    );
    expect(achados).toStrictEqual([]);
  });

  it("a nota do rodapé sai das quatro, e o asterisco fica (critério 44m.5)", () => {
    const formularios = ALCANCE_DO_44M.filter((caminho) => caminho.includes("formulario-de-"));
    expect(formularios).toHaveLength(4);
    for (const caminho of formularios) {
      const fonte = ler(caminho);
      expect(fonte).toContain("todosObrigatorios");
      // O `obrigatorio` de cada campo continua, que é quem desenha o `*`.
      expect(fonte).toContain("obrigatorio");
    }
  });

  it("o campo de senha entra em T-01, T-11 e T-13, e não em T-12 (critério 44m.4)", () => {
    const comEntradaDeSenha = [...arquivosDe("app"), ...arquivosDe("src")].filter((caminho) =>
      ler(caminho).includes("EntradaDeSenha"),
    );
    expect(comEntradaDeSenha).toStrictEqual([
      "src/interface/componentes/campo-de-senha.tsx",
      "src/interface/componentes/formulario-de-cadastro.tsx",
      "src/interface/componentes/formulario-de-entrada.tsx",
      "src/interface/componentes/formulario-de-nova-senha.tsx",
    ]);
  });

  it("o EyeOff continua significando Desativar, e só isso", () => {
    // O par do botão de senha é `Eye`/`EyeClosed`. Se alguém trocar por `EyeOff`, o mesmo ícone passa a
    // ter dois sentidos no produto — o avesso da regra do guia §7.
    expect(ler("src/interface/componentes/campo-de-senha.tsx")).not.toContain("EyeOff");
    const comEyeOff = [...arquivosDe("src")].filter((caminho) => ler(caminho).includes("EyeOff"));
    expect(comEyeOff).toStrictEqual(["src/interface/componentes/situacao-do-item.tsx"]);
  });

  it("a marca do alcance vem da peça, e nenhum arquivo dele a escreve (critério 44m.1)", () => {
    // **A guarda é escopada ao alcance de propósito.** Quatro arquivos desenhavam a marca à mão, no
    // estilo anterior ao 44b — é o achado R-1 da revisão —, e os quatro já saíram: as duas telas de
    // auditoria no 44n, a espera de T-02 e a moldura antiga no 44o. A guarda continua escopada porque
    // "Resolve Aí" em `app` e `src` também é texto legítimo — o `metadata`, a documentação e a pergunta
    // da face A de T-02, que cita o produto pelo nome.
    for (const caminho of [
      "src/interface/componentes/casca/barra-superior.tsx",
      "src/interface/componentes/moldura-de-conta.tsx",
    ]) {
      expect(ler(caminho)).toContain("MarcaDoProduto");
      expect(ler(caminho)).not.toContain("Resolve Aí");
    }
    expect(ler("src/interface/componentes/marca.tsx")).toContain("Resolve Aí");
  });

  it("o localizador de senha do teste de ponta a ponta é ancorado (critério 44m.10)", () => {
    const fonte = ler("testes/ponta-a-ponta/caminho-critico.spec.ts");
    // **Por trecho, "Senha" casaria também com o "Mostrar a senha" do botão** — o `getByLabel` do
    // Playwright alcança qualquer elemento com `aria-label`, e o `fill` quebraria por modo estrito. E o
    // modo exato **também** não serve: o rótulo do campo é "Senha *", porque o asterisco é um `<span>`
    // dentro do `<label>` e o motor do localizador não pula `aria-hidden`.
    expect(fonte).toContain("getByLabel(/^Senha/u)");
    expect(fonte).toContain('getByLabel("E-mail")');
    expect(fonte).toContain('getByRole("button", { name: "Entrar" })');
  });
});

describe("o alcance do 44n — a trilha vira linha do tempo", () => {
  it("os seis status têm ícone e marcador, e as três chaves batem (critério 44n.6)", () => {
    const fonte = ler("src/interface/componentes/selo-de-status.tsx");

    // **O `tsc` não pega isto, e é o custo declarado da ADR-0006**: `FORMA_DO_SELO` é
    // `Record<string, string>` porque `app/` não importa o Domínio, então um sétimo status entraria em
    // silêncio no contorno. Esta guarda é o que sobra no lugar da exaustividade.
    const chavesDe = (mapa: string): string[] => {
      const bloco = new RegExp(`const ${mapa}[^=]*=\\s*\\{([^}]*)\\}`, "u").exec(fonte);
      if (bloco === null) throw new Error(`mapa ${mapa} não encontrado`);
      return [...bloco[1]!.matchAll(/^\s*(\w+):/gmu)].map((achado) => achado[1]!).sort();
    };

    const SEIS = [
      "aberta",
      "cancelada",
      "em_analise",
      "em_atendimento",
      "pausada",
      "resolvida",
    ];

    expect(chavesDe("FORMA_DO_SELO")).toStrictEqual(SEIS);
    expect(chavesDe("ICONE_DO_STATUS")).toStrictEqual(SEIS);
    expect(chavesDe("FORMA_DO_MARCADOR")).toStrictEqual(SEIS);
  });

  it("o ícone do marcador é mudo para o leitor de tela (critério 44n.6)", () => {
    // A palavra está no selo e a forma está no marcador. Um rótulo acessível aqui faria o leitor de tela
    // dizer "Em análise" duas vezes por registro.
    //
    // **O corte é na FORMA DE ATRIBUTO, e é de propósito.** O docblock do marcador explica por escrito
    // por que o rótulo acessível não entra, e o nome dele aparece na frase. Uma expressão sem o `=`
    // reprovaria o comentário que existe para defender a regra.
    const fonte = ler("src/interface/componentes/selo-de-status.tsx");
    expect(fonte).toContain('aria-hidden="true"');
    expect(fonte).not.toMatch(/aria-label\s*=/u);
  });

  const TELA_DO_44N = [
    "app/(casca)/ocorrencias/[ocorrenciaId]/auditoria/page.tsx",
    "app/(casca)/ocorrencias/[ocorrenciaId]/auditoria/loading.tsx",
  ];

  it("a trilha não é mais tabela, nas duas faces (critério 44n.1)", () => {
    const achados = TELA_DO_44N.flatMap((caminho) =>
      [...ler(caminho).matchAll(/<(?:table|tbody|thead|caption)(?:\s|>|$)/gu)].map(
        (achado) => `${caminho}: ${achado[0]}`,
      ),
    );
    expect(achados).toStrictEqual([]);
  });

  it("nenhum valor cru de status na tela (critério 44n.5)", () => {
    // O comentário que dizia "o Solicitante lê `em_analise`" saiu com a tabela. A tela não tem chave de
    // mapa nem tipo — os dois mapas moram em `selo-de-status.tsx` —, então aqui o corte é seco.
    const achados = TELA_DO_44N.flatMap((caminho) =>
      [...ler(caminho).matchAll(/\b(?:em_analise|em_atendimento|aguardando_\w+)\b/gu)].map(
        (achado) => `${caminho}: ${achado[0]}`,
      ),
    );
    expect(achados).toStrictEqual([]);
  });

  it("o RESOLVE AÍ repetido sai de T-06, e some da casca (A-12 do 44i)", () => {
    for (const caminho of TELA_DO_44N) expect(ler(caminho)).not.toContain("Resolve Aí");
    // **A guarda é escopada a `app/(casca)`, e é de propósito** — pelo mesmo argumento que o 44m já
    // escreveu ao lado da dele: a busca por "Resolve Aí" em `app` inteiro devolve sete linhas, e cinco
    // não são deste item (o `metadata` do layout raiz, as duas da documentação e as duas de
    // `app/organizacao/`: a marca à mão da espera saiu no 44o, e a pergunta da face A cita o produto pelo
    // nome, e fica). Uma guarda global falharia por defeito que o 44n não criou nem tem mandato para
    // consertar.
    //
    // **Dentro da casca, estas duas eram as últimas.** A barra superior é quem carrega a marca.
    const sobras = arquivosDe("app/(casca)").filter((caminho) => ler(caminho).includes("Resolve Aí"));
    expect(sobras).toStrictEqual([]);
  });

  it("nenhum tamanho fora dos sete papéis, nas duas faces (guia §3)", () => {
    const achados = TELA_DO_44N.flatMap((caminho) =>
      [...ler(caminho).matchAll(/\btext-(?:xs|sm|base|lg|xl|2xl|3xl)\b/gu)].map(
        (achado) => `${caminho}: ${achado[0]}`,
      ),
    );
    expect(achados).toStrictEqual([]);
  });
});

/**
 * ============================================================================
 *  Item 44o — T-02, T-10 e a tela de criar, na moldura das telas fora da casca
 * ============================================================================
 *
 * **Cada tarefa do plano acrescenta as guardas dela a este bloco**, e as do alcance inteiro — tamanhos,
 * controles crus, a moldura declarada fora dela — chegam por último, quando todos os arquivos existem.
 */
const MOLDURA_DE_CONTA = "src/interface/componentes/moldura-de-conta.tsx";
const ESCOLHA_DE_ORGANIZACAO = "src/interface/componentes/escolha-de-organizacao.tsx";
const NOVA_ORGANIZACAO = "src/interface/componentes/formulario-de-nova-organizacao.tsx";
const PEDIDO_DE_ENTRADA = "src/interface/componentes/formulario-de-pedido-de-entrada.tsx";

/** Os arquivos em que o 44o aplica o guia: as guardas do alcance inteiro leem estes. */
const ALCANCE_DO_44O = [
  "app/organizacao/page.tsx",
  "app/organizacao/loading.tsx",
  "app/organizacao/criar/page.tsx",
  "app/page.tsx",
  MOLDURA_DE_CONTA,
  "src/interface/componentes/lista-de-organizacoes.tsx",
  ESCOLHA_DE_ORGANIZACAO,
  NOVA_ORGANIZACAO,
  PEDIDO_DE_ENTRADA,
];

describe("o alcance do 44o — T-02, T-10 e a tela de criar", () => {
  it("a página e a coluna da moldura são escritas uma vez, e a espera as usa (critério 44o.1)", () => {
    const fonte = ler(MOLDURA_DE_CONTA);
    // A moldura e a espera desenham a mesma página e a mesma coluna. Se uma delas voltar a escrever as
    // classes à mão, o esqueleto passa a pintar numa forma e a tela em outra.
    expect([...fonte.matchAll(/className=\{PAGINA\}/gu)]).toHaveLength(2);
    expect([...fonte.matchAll(/className=\{COLUNA\}/gu)]).toHaveLength(2);
    expect(fonte).toContain("export function EsperaDaMolduraDeConta");
  });

  it("o caminho tem o piso de 44 px, e o Sair é o Button do catálogo num formulário (critério 44o.15)", () => {
    const fonte = ler(MOLDURA_DE_CONTA);
    const classe = /export const CLASSE_DO_CAMINHO =\s*"([^"]+)"/u.exec(fonte)?.[1] ?? "";
    expect(classe.split(" ")).toContain("min-h-11");
    expect(fonte).toContain("<form action={acaoDeSair}>");
    expect(fonte).toMatch(/<Button\s+type="submit"\s+variant="link"/u);
  });

  it("a linha de fato aceita nó, e o corpo do cartão é opcional (critérios 44o.7 e 44o.9)", () => {
    const fonte = ler(MOLDURA_DE_CONTA);
    expect(fonte).toContain("contexto?: ReactNode;");
    expect(fonte).toContain("children?: ReactNode;");
    expect(fonte).toContain("{temCorpo && (");
  });

  it("a lista é de servidor, e só a escolha é de cliente (critério 44o.10)", () => {
    // **Dois arquivos, e não um:** com `"use client"` no topo, toda exportação vira componente de
    // cliente, e a lista de pedidos da face E — que não tem estado — iria para o navegador.
    expect(ler("src/interface/componentes/lista-de-organizacoes.tsx")).not.toContain('"use client"');
    expect(ler(ESCOLHA_DE_ORGANIZACAO)).toMatch(/^"use client";/u);
  });

  it("a linha que troca de organização é o Button do catálogo, com a seta (critérios 44o.10 e 44o.15)", () => {
    const fonte = ler(ESCOLHA_DE_ORGANIZACAO);
    expect(fonte).toMatch(/<Button\s[^>]*variant="ghost"/u);
    expect(fonte).toMatch(/<LinhaDeOrganizacao\s[^>]*\sseta\s*\/>/u);
    expect([...fonte.matchAll(/<(?:select|textarea|button)(?:\s|>|$)/gu)]).toStrictEqual([]);
  });

  it("o papel em palavra vem do mapa compartilhado, e a cópia local saiu", () => {
    const fonte = ler(ESCOLHA_DE_ORGANIZACAO);
    expect(fonte).toContain('from "@/interface/componentes/frases-de-participantes"');
    expect(fonte).not.toContain("function rotuloDoPapel");
  });

  it("o menu de organização saiu do produto (critérios 44o.9 e 44o.10)", () => {
    const comMenu = [...arquivosDe("app"), ...arquivosDe("src")].filter((caminho) =>
      ler(caminho).includes("MenuDeOrganizacao"),
    );
    expect(comMenu).toStrictEqual([]);
    expect(existsSync(RAIZ + "src/interface/componentes/menu-de-organizacao.tsx")).toBe(false);
  });

  it("T-10 diz o papel e a organização, e não fala de contrato (critério 44o.8)", () => {
    const fonte = ler("app/page.tsx");
    expect(fonte).not.toContain("evolução prevista");
    expect(fonte).not.toContain("o contrato declara");
    expect(fonte).toMatch(/ainda não abre nenhuma tela\.\s+Quando abrir, ela aparece aqui\./u);
    // A tela existe pela **ausência de permissão**, e não pelo nome do papel: a palavra é lida do contexto.
    expect(fonte).toContain("rotuloDoPapel(contexto.papel)");
  });

  it("T-10 mantém o título, lista as outras organizações e leva à face E (critérios 44o.7, 44o.9 e 44o.14)", () => {
    const fonte = ler("app/page.tsx");
    expect(fonte).toContain("titulo={`Olá, ${primeiroNome(contexto.pessoa.nome)}.`}");
    expect(fonte).toMatch(
      /outras\.length > 0 &&\s*<EscolhaDeOrganizacao\s[^>]*rotulo="Você também participa de"/u,
    );
    expect(fonte).toContain("vinculo.organizacaoId !== ativa.id");
    expect(fonte).toContain('href="/organizacao?entrar-em-outra=true"');
    expect(fonte).toContain("<CaminhoDeSair />");
  });

  it("a face E tem duas portas, e nenhuma é o seletor de organização (critério 44o.14)", () => {
    // **O achado A3 da spec:** desde o 44b o único produtor deste endereço era o menu de organização de
    // T-10, e só o Encarregado cai em T-10. Esta guarda impede que ele volte a ter uma porta só — ou
    // nenhuma.
    const produtores = [...arquivosDe("app"), ...arquivosDe("src")].filter((caminho) =>
      ler(caminho).includes("entrar-em-outra=true"),
    );
    expect(produtores).toStrictEqual([
      "app/page.tsx",
      "src/interface/componentes/casca/menu-de-pessoa.tsx",
    ]);
    // O seletor é `select` pelo critério 44b.4, e uma opção que não é um valor desfaria aquela decisão.
    expect(ler("src/interface/componentes/casca/seletor-de-organizacao.tsx")).not.toContain(
      "Entrar em outra organização",
    );
    expect(ler("src/interface/componentes/casca/menu-de-pessoa.tsx")).toContain("<Building2");
  });

  it("criar organização é uma tela, com a guarda das outras e sem recusar quem tem organização (critérios 44o.4 e 44o.5)", () => {
    const fonte = ler("app/organizacao/criar/page.tsx");
    expect(fonte).toContain("<FormularioDeNovaOrganizacao />");
    expect(fonte).toContain('titulo="Criar uma organização"');
    expect(fonte).toContain('href="/organizacao"');
    expect(fonte).toContain('redirect("/entrar?destino=%2Forganizacao%2Fcriar")');
    expect(fonte).toContain('export const dynamic = "force-dynamic"');
    // A rota **não recusa** quem tem organização ativa, porque o caso de uso não recusa.
    expect(fonte).not.toContain("organizacaoAtiva");
  });

  it("o botão de criar é o principal, e a nota do rodapé sai (critérios 44o.4 e 44o.11)", () => {
    const fonte = ler(NOVA_ORGANIZACAO);
    expect(fonte).not.toContain('variant="outline"');
    // **Principal é a cor da marca** (guia §2), e a variante padrão do catálogo é `bg-primary`, azul.
    expect(fonte).toMatch(/<Button\s+type="submit"\s+variant="marca"/u);
    expect(fonte).toContain("<RodapeDoFormulario obrigatorios={1} todosObrigatorios>");
  });

  it("o comentário que defendia o campo registra a decisão nova (critério 44o.6)", () => {
    const fonte = ler(NOVA_ORGANIZACAO);
    expect(fonte).not.toContain("o inventário diz por que não é uma tela");
    expect(fonte).toContain("20/09/2026");
    expect(fonte).toContain("dois formulários");
  });

  it("as cinco faces de T-02 estão na moldura, com os títulos e as linhas do critério (critérios 44o.1 e 44o.7)", () => {
    const fonte = ler("app/organizacao/page.tsx");
    expect([...fonte.matchAll(/<MolduraDeConta\b/gu)]).toHaveLength(5);
    for (const trecho of [
      'titulo="Entrar em uma organização"',
      "Você ainda não participa de nenhuma. Use o código que recebeu para pedir entrada.",
      'titulo="Pedido enviado"',
      "Um Gestor decide, e a resposta aparece aqui.",
      'titulo="Pedido não aprovado"',
      'titulo="Em qual organização você quer trabalhar?"',
      "Dá para trocar depois, pelo nome no alto da tela.",
      'titulo="Entrar em outra organização"',
    ]) {
      expect(fonte, trecho).toContain(trecho);
    }
  });

  it("entrar e criar são duas telas, e o caminho de criar sai só da face A (critérios 44o.4 e 44o.5)", () => {
    const fonte = ler("app/organizacao/page.tsx");
    expect(fonte).not.toContain("FormularioDeNovaOrganizacao");
    expect([...fonte.matchAll(/href="\/organizacao\/criar"/gu)]).toHaveLength(1);
  });

  it("a face E lista os pedidos na forma da lista, sem seta (critério 44o.10)", () => {
    const fonte = ler("app/organizacao/page.tsx");
    expect(fonte).toContain('<ListaDeOrganizacoes rotulo="Seus pedidos">');
    expect(fonte).toContain("<LinhaDeOrganizacao");
    // O `seta` como propriedade de JSX — e não a palavra num comentário.
    expect(fonte).not.toMatch(/\sseta(?:\s*\/?>|=\{)/u);
  });

  it("as datas de T-02 são as do guia, e o formatador local saiu (guia §7)", () => {
    const fonte = ler("app/organizacao/page.tsx");
    expect(fonte).not.toContain("Intl.DateTimeFormat");
    expect(fonte).toContain("dataEHora(");
  });

  it("a nota do pedido de entrada sai só onde todo campo é obrigatório (critério 44o.11)", () => {
    expect(ler(PEDIDO_DE_ENTRADA)).toContain("todosObrigatorios={!primeiraEntrada}");
  });

  it("a espera de T-02 é a da moldura, com a mesma frase (critério 44o.1)", () => {
    const fonte = ler("app/organizacao/loading.tsx");
    expect(fonte).toContain("<EsperaDaMolduraDeConta>");
    expect(fonte).toContain("Acordando o servidor — a primeira abertura do dia é mais lenta.");
  });

  it("a moldura antiga saiu do produto, nem em comentário (critério 44o.2)", () => {
    // **Absorve a guarda do critério 44m.2**, que afirmava os arquivos com a moldura antiga — T-02, T-10
    // e ela mesma. Os três saíram neste item. O caminho entra na busca porque um comentário que cite o
    // arquivo apagado mente a quem o procurar.
    expect(existsSync(RAIZ + "src/interface/componentes/moldura-de-tela.tsx")).toBe(false);
    const comMoldura = [...arquivosDe("app"), ...arquivosDe("src")].filter((caminho) => {
      const fonte = ler(caminho);
      return fonte.includes("MolduraDeTela") || fonte.includes("moldura-de-tela");
    });
    expect(comMoldura).toStrictEqual([]);
  });

  it("nenhum tamanho fora dos sete papéis (critério 44o.3)", () => {
    const achados = ALCANCE_DO_44O.flatMap((caminho) =>
      [...ler(caminho).matchAll(/\btext-(?:xs|sm|base|lg|xl|2xl|3xl)\b/gu)].map(
        (achado) => `${caminho}: ${achado[0]}`,
      ),
    );
    expect(achados).toStrictEqual([]);
  });

  it("nenhum controle cru, fora os dois botões de texto do pedido de entrada (critério 44o.15)", () => {
    const crus = (caminho: string) => [...ler(caminho).matchAll(/<(?:select|textarea|button)(?:\s|>|$)/gu)];
    const achados = ALCANCE_DO_44O.filter((caminho) => caminho !== PEDIDO_DE_ENTRADA).flatMap((caminho) =>
      crus(caminho).map((achado) => `${caminho}: ${achado[0]}`),
    );
    expect(achados).toStrictEqual([]);
    // A exceção que o critério 44p.5 declara por escrito: "Entrar nela" e "Atualizar esta tela".
    expect(crus(PEDIDO_DE_ENTRADA)).toHaveLength(2);
  });

  it("nenhuma das telas declara a própria moldura nem desenha a marca à mão (critério 44o.1, e o G1 do guia)", () => {
    for (const caminho of ALCANCE_DO_44O.filter((caminho) => caminho.startsWith("app/"))) {
      const fonte = ler(caminho);
      expect(fonte, caminho).not.toContain("min-h-dvh");
      // A marca à mão era `<p …>Resolve Aí</p>`. A frase da face A cita o produto no meio de uma
      // pergunta, e por isso a guarda procura o nome sozinho entre tags, e não a palavra.
      expect(fonte, caminho).not.toMatch(/>\s*Resolve Aí\s*</u);
    }
  });

  it("o teste de ponta a ponta acha o que procura na face D (critério 44o.12)", () => {
    // **Conferido por leitura, e não por execução:** o teste não roda na pilha que o critério dele
    // autoriza (achado A-10). O relatório não afirma execução verde.
    const e2e = ler("testes/ponta-a-ponta/caminho-critico.spec.ts");
    expect(e2e).toContain('getByRole("heading", { name: "Em qual organização você quer trabalhar?" })');
    expect(e2e).toContain('getByRole("button", { name: AURORA })');
    // O título é o `<h1>` da moldura, e a linha é o `Button` do catálogo, que renderiza `<button>`.
    expect(ler("app/organizacao/page.tsx")).toContain('titulo="Em qual organização você quer trabalhar?"');
    expect(ler(MOLDURA_DE_CONTA)).toContain("<h1 id={ID_DO_TITULO}");
    expect(ler(ESCOLHA_DE_ORGANIZACAO)).toContain("<Button");
  });
});

describe("o alcance do 44p — a validação do lote 11", () => {
  it("a animação de pressão usa a forma que o Tailwind 4 emite como var() (critério 44p.1)", () => {
    const fonte = ler("src/interface/componentes/ui/button.tsx");

    // `duration-[--tempo-pressao]` gera `transition-duration: --tempo-pressao`, declaração inválida que o
    // navegador descarta: o `active:scale-[0.97]` acontecia sem duração e sem curva. A forma com
    // parênteses é a que emite `var()`, e é a que `modal.tsx` já usa em CONTEUDO_DO_SHEET.
    expect(fonte).toContain("duration-(--tempo-pressao)");
    expect(fonte).toContain("ease-(--curva-pressao)");

    // **`transition-all` sai junto.** Ele e `transition-transform` conviviam no mesmo `cva`, e a segunda
    // vencia pela ordem. Com a duração passando a valer, `transition-all` voltaria a animar cor e sombra
    // em todo botão do produto — contra o guia §6, que concede só `transform` e `opacity`.
    expect(fonte).not.toContain("transition-all");
  });

  it("nenhuma classe arbitrária de duração sobrou em `src` nem em `app` (critério 44p.1)", () => {
    const achados = [...arquivosDe("src"), ...arquivosDe("app")].filter((caminho) =>
      ler(caminho).includes("duration-["),
    );
    expect(achados).toStrictEqual([]);
  });

  it("o `Sair` do menu de pessoa é `Button` do catálogo (critério 44p.5)", () => {
    const fonte = ler("src/interface/componentes/casca/menu-de-pessoa.tsx");

    // O critério diz "fica dentro de `DropdownMenuItem asChild`" — e já estava. O que era cru é o
    // ELEMENTO. `asChild` continua funcionando porque o `Button` renderiza um `<button>`, que é quem
    // recebe `role="menuitem"` e o foco do menu.
    expect(/<button(\s|>)/u.test(fonte)).toBe(false);
    expect(fonte).toContain('<form action={acaoDeSair}>');
    expect(fonte).toContain('variant="ghost"');
  });

  it("nenhum tamanho fora dos sete papéis, fora do catálogo (critério 44p.2)", () => {
    // **O 44o é quem limpa o resto.** `app/organizacao/`, `app/page.tsx`, `menu-de-organizacao`,
    // `formulario-de-pedido-de-entrada`, `formulario-de-nova-organizacao` e `moldura-de-tela` — que o
    // plano dele APAGA — somam trinta ocorrências que não são deste item. Enquanto ele não mesclar, esta
    // guarda seria vermelha por defeito alheio; por isso ela exclui o que é dele, por caminho, e o
    // critério 44p.2 só fecha de verdade depois do merge do 44o.
    const DO_44O = [
      "app/organizacao/",
      "app/page.tsx",
      "src/interface/componentes/menu-de-organizacao.tsx",
      "src/interface/componentes/formulario-de-pedido-de-entrada.tsx",
      "src/interface/componentes/formulario-de-nova-organizacao.tsx",
      "src/interface/componentes/moldura-de-tela.tsx",
    ];

    // **`utilitarios.ts` sai da conta, e é o único que sai por mérito próprio.** `arquivosDe` lê `.ts`
    // junto de `.tsx`, e as quatro ocorrências dele são o comentário que explica por que o `cn` estendido
    // existe: *"o `text-sm` do catálogo — que está fora da escala — sobrevive"*. É o arquivo que declara a
    // escala; reescrever a frase para não escrever a classe apagaria a explicação, ao contrário do
    // comentário de `navegacao.tsx`, que continua dizendo a mesma coisa sem ela.
    const achados = [...arquivosDe("app"), ...arquivosDe("src/interface/componentes")]
      .filter((caminho) => !caminho.startsWith("src/interface/componentes/ui/"))
      .filter((caminho) => caminho !== "src/interface/componentes/utilitarios.ts")
      .filter((caminho) => !DO_44O.some((dele) => caminho.startsWith(dele)))
      .flatMap((caminho) =>
        [...ler(caminho).matchAll(/\btext-(?:xs|sm|base|lg|xl|2xl|3xl)\b/gu)].map(
          (achado) => `${caminho}: ${achado[0]}`,
        ),
      );

    expect(achados).toStrictEqual([]);
  });

  it("os vazios de T-03 usam o catálogo, e o `+` literal virou ícone (critério 44p.3)", () => {
    const fonte = ler("app/(casca)/ocorrencias/page.tsx");

    // A mesma tela já usava `buttonVariants` em duas linhas e montava botão à mão em três. O que sobra é
    // uma forma só.
    expect(fonte).not.toContain("inline-flex min-h-11 items-center rounded-sm border px-4");
    expect(fonte).not.toContain('"+ Registrar');
    expect(fonte).toContain("<Plus aria-hidden");
  });

  it("o estado vazio não manda conferir se as áreas descrevem o prédio (critério 44p.14)", () => {
    // D3: a organização é condomínio, empresa **ou bairro**. É a terceira vez que a mesma correção se
    // aplica — a prancheta de Áreas e a coluna esquerda de T-01 do 44m foram as outras duas.
    //
    // **A guarda é sobre a FRASE, e não sobre a palavra**, e isso está medido: "prédio" aparece em SETE
    // lugares do repositório e **cinco estão certos** — `Permissao.ts:7`, `Semente.ts:63`,
    // `lista-de-ocorrencias.tsx:295` e as duas de `app/organizacao/` usam a palavra como EXEMPLO de um
    // tipo de organização, que é justamente o que a D3 diz que ela pode ser. O defeito é a tela mandar a
    // pessoa conferir se as áreas descrevem "o seu prédio", o que exclui bairro e empresa.
    expect(ler("src/interface/componentes/vazio-da-lista.ts")).not.toContain("o seu prédio");
    expect(ler("app/(casca)/ocorrencias/page.tsx")).not.toContain("que não descreve o");
  });

  it("o seletor de prioridade é o `select` do catálogo (critério 44p.4)", () => {
    const fonte = ler("src/interface/componentes/seletor-de-prioridade.tsx");

    // **A guarda lê comentário igual a código**, e este arquivo escrevia `<select>` em prosa em TRÊS
    // linhas — 19, 30 e 53. As três passam a dizer "o `select` nativo", sem os sinais de maior e menor:
    // é o mesmo tratamento que `navegacao.tsx` recebeu no critério 44p.2, e é mais honesto que abrir
    // exceção na guarda.
    expect(/<select(\s|>)/u.test(fonte)).toBe(false);
    expect(fonte).toContain("<SelectTrigger");
    expect(fonte).toContain("<SelectItem");
  });

  it("a prioridade tem uma forma só, com e sem o controle (critério 44p.20)", () => {
    const fonte = ler("app/(casca)/ocorrencias/[ocorrenciaId]/page.tsx");

    // Aberta, a linha é rótulo à esquerda e controle à direita. Resolvida, era texto corrido — "Prioridade:
    // Normal" — enquanto as outras cinco linhas do mesmo cartão continuavam rótulo e valor. Fica a mesma
    // linha, só sem o seletor: o invólucro e o rótulo passam a ser da página.
    expect(fonte).not.toContain("Prioridade:</span>");
    expect(fonte).toContain("LINHA_DA_PRIORIDADE");
  });

  it("os cinco modais de T-05 usam a moldura compartilhada (critérios 44p.15 e 44p.16)", () => {
    const CINCO = [
      "src/interface/componentes/modal-de-atribuicao.tsx",
      "src/interface/componentes/modal-de-avaliacao.tsx",
      "src/interface/componentes/modal-de-motivo.tsx",
      "src/interface/componentes/modal-de-observacao.tsx",
      "src/interface/componentes/modal-de-resolucao.tsx",
    ];

    for (const caminho of CINCO) {
      const fonte = ler(caminho);
      // A moldura: nenhum dos cinco monta o `Dialog` direto.
      expect(fonte).not.toContain("ui/dialog");
      expect(fonte).toContain("<Modal");
      // A cor: o `BotaoDeConfirmar` é `variant="marca"` por padrão, então o critério 15 vem junto.
      expect(fonte).toContain("<BotaoDeConfirmar");
      expect(fonte).toContain("<BotaoDeCancelar");
      // E "Fechar" some: o secundário do rodapé compartilhado escreve "Cancelar".
      expect(fonte).not.toContain("Fechar");
    }
  });

  it("a nota de obrigatório só aparece onde há campo opcional (critério 44p.11)", () => {
    const COM_TODOS = [
      "src/interface/componentes/conversa-da-ocorrencia.tsx",
      "src/interface/componentes/modal-de-motivo.tsx",
      "src/interface/componentes/modal-de-atribuicao.tsx",
      "src/interface/componentes/modal-de-categoria.tsx",
      "src/interface/componentes/modal-de-area.tsx",
      "src/interface/componentes/edicao-de-nome.tsx",
    ];
    for (const caminho of COM_TODOS) expect(ler(caminho)).toContain("todosObrigatorios");

    // O `Modal` precisa deixar a propriedade atravessar: três dos seis só o alcançam por ele.
    expect(ler("src/interface/componentes/modal.tsx")).toContain("todosObrigatorios");

    // E onde há campo opcional a nota FICA — a avaliação tem "Comentário (opcional)".
    expect(ler("src/interface/componentes/modal-de-avaliacao.tsx")).not.toContain("todosObrigatorios");
  });

  it("a solução aplicada tem um nome só, e ele é o do glossário (critério 44p.19)", () => {
    const pagina = ler("src/interface/componentes/campo-de-solucao-aplicada.tsx");
    const modal = ler("src/interface/componentes/modal-de-resolucao.tsx");

    // `docs/glossario.md:46` registra "Solução aplicada" como o termo da linguagem ubíqua. O modal dizia
    // "O que foi feito (opcional)" para o MESMO dado — ele abre preenchido com o que está na página, pela
    // D22 —, e quem lia a página entendia que resolver exige a solução.
    expect(pagina).toContain('rotulo="Solução aplicada"');
    expect(modal).toContain('rotulo="Solução aplicada"');
    expect(modal).not.toContain("O que foi feito");

    // A marca de obrigatório sai do campo da página: ele salva quando se tem o que salvar. A propriedade
    // vive na MESMA linha do `Campo`, entre o rótulo e o `erro` — é essa vizinhança que a guarda lê.
    expect(pagina).not.toContain("obrigatorio erro=");
    expect(pagina).toContain("obrigatorios={0}");
  });

  it("a coluna TEMPO não repete o mesmo valor, e o símbolo tem nome (critério 44p.12)", () => {
    const fonte = ler("src/interface/componentes/lista-de-ocorrencias.tsx");

    // A comparação é sobre o INSTANTE, não sobre o texto de `tempoCurto`: comparar o texto esconderia uma
    // atualização de meia hora atrás sempre que as duas caíssem no mesmo "3 d" — e é numa ocorrência
    // tocada há pouco que a coluna tem o que dizer.
    //
    // **O item 67 mudou de lugar, não de regra**: o par virou uma peça só, usada nos três recortes, e a
    // comparação mora dentro dela — por isso a guarda casa o par de campos, e não o `item.` na frente.
    expect(fonte).toContain("registradaEm !== atualizadaEm");

    // Os DOIS valores ganham nome. Nomear só o segundo faz o leitor de tela ler "5 d, atualizada 2 h",
    // com o primeiro número solto.
    expect(fonte).toContain("sr-only");
    expect(fonte).toContain("registrada");
    expect(fonte).toContain("atualizada");
  });

  it("T-16 e T-04 têm espera, e o produto ganha as duas que faltavam (critério 44p.6)", () => {
    expect(existsSync(RAIZ + "app/(casca)/meus-dados/loading.tsx")).toBe(true);
    expect(existsSync(RAIZ + "app/(foco)/ocorrencias/nova/loading.tsx")).toBe(true);

    // **A guarda conta as esperas e NÃO fixa o número de páginas**, e isso é medido: o critério fala de
    // *"10 das 19 rotas"*, que é `develop` hoje, e o **44o cria a vigésima** — `app/organizacao/criar/`,
    // que é a tela nova de criar organização. Como este item mescla DEPOIS dele, um `toHaveLength(19)`
    // aqui ficaria vermelho por página alheia. Esperas: 10 hoje, 12 depois deste item, nas duas ordens.
    const esperas = arquivosDe("app").filter((caminho) => caminho.endsWith("/loading.tsx"));
    expect(esperas).toHaveLength(12);
  });

  it("seis estados, seis selos, e a marca veste só a Aberta (critério 44q.10, que desfaz o 44p.21)", () => {
    const fonte = ler("src/interface/componentes/selo-de-status.tsx");
    // **O 44p.21 decidiu no lugar do dono**, e disse que a decisão cairia se a prancheta tivesse
    // argumento. A validação de 22/09 é o dono lendo a prancheta: seis tratamentos, um por estado.
    expect(fonte).toContain('aberta: "bg-marca text-marca-foreground border-transparent"');
    expect(fonte).toContain('pausada: "bg-atencao text-marca-foreground border-transparent"');
    // Desde o item 64 os dois estados de contorno são sólidos: o status é a peça cheia da linha, e a
    // prioridade, ao lado, é contorno. A tinta é `--surface`, porque `--marca-foreground` mede 3:1 no claro.
    expect(fonte).toContain('em_analise: "bg-tinta-suave text-superficie border-transparent"');
    expect(fonte).toContain('em_atendimento: "bg-info text-superficie border-transparent"');
    expect(fonte).toContain('resolvida: "bg-muted text-ok border-transparent"');
    expect(fonte).toContain('cancelada: "bg-muted text-tinta-suave border-transparent"');
    // A tinta fraca reprova no apagado (2,57:1 no escuro) — desvio D1.
    expect(fonte).not.toContain("text-tinta-fraca");
    // O `text-meta` no ponto de uso derrubaria o oitavo papel que a peça passou a ter.
    expect(fonte).not.toContain("text-meta rounded-sm");
  });

  it("o `Ativa` volta a ser selo de sucesso com o ponto, e o `Inativa` é apagado (critério 44q.11)", () => {
    const fonte = ler("src/interface/componentes/lista-de-ordem-manual.tsx");
    // Contorno cheio, e não os 55% da prancheta: a 55% a borda mede 2,34:1 (desvio D6).
    expect(fonte).toContain('"border-ok text-ok gap-1.5"');
    expect(fonte).not.toContain("border-ok/");
    expect(fonte).toContain("bg-ok size-1.5 rounded-full");
    expect(fonte).toContain("bg-muted text-tinta-suave border-transparent");
    // O ponto era um caractere, e agora é desenho: o `•` saiu.
    expect(fonte).not.toContain('PONTO_DE_ATIVA = "•"');
  });
});

describe("o alcance do 44q — a estilização da prancheta", () => {
  /** Telas e componentes próprios, fora do catálogo — o alcance do critério 2. */
  const PROPRIOS = [...arquivosDe("app"), ...arquivosDe("src/interface/componentes")].filter(
    (caminho) => !caminho.startsWith("src/interface/componentes/ui/") && caminho.endsWith(".tsx"),
  );

  it("nenhuma entrelinha improvisada fora do catálogo (critério 44q.2)", () => {
    // **Sobra só `leading-none`**, que não é correção de papel: é o que se põe em ícone e em número
    // isolado para a caixa não crescer. O resto era remendo de papel que o token passou a carregar.
    const achados = PROPRIOS.flatMap((caminho) =>
      [...ler(caminho).matchAll(/\bleading-(?!none\b)[\w.[\]-]+/gu)].map((achado) => `${caminho}: ${achado[0]}`),
    );
    expect(achados).toStrictEqual([]);
  });

  it("título de página e de bloco não repetem o peso que o token já traz (critério 44q.2)", () => {
    const achados = PROPRIOS.flatMap((caminho) =>
      [...ler(caminho).matchAll(/"[^"]*\btext-titulo-(?:pagina|bloco)\b[^"]*\bfont-semibold\b[^"]*"/gu)].map(
        (achado) => `${caminho}: ${achado[0]}`,
      ),
    );
    expect(achados).toStrictEqual([]);
  });

  it("a entreletra do rótulo vem do token, e não se repete na chamada (critério 44q.2)", () => {
    const achados = PROPRIOS.filter((caminho) => ler(caminho).includes("tracking-[0.11em]"));
    expect(achados).toStrictEqual([]);
  });

  it("os grupos do modal de atribuição estão no papel de rótulo, e a busca é a nossa (critérios 44q.12 e 66)", () => {
    const fonte = ler("src/interface/componentes/modal-de-atribuicao.tsx");
    expect(fonte).toContain("[&_[cmdk-group-heading]]:text-rotulo-coluna");
    expect(fonte).toContain("[&_[cmdk-group-heading]]:font-mono");
    expect(fonte).toContain("shouldFilter={false}");
    expect(fonte).toContain("aria-checked={escolhida}");
    expect(fonte).not.toContain("tracking-wide");
  });

  it("o raio de 6 px voltou às seis peças (critério 44q.4)", () => {
    // `rounded-md` é `--radius-md`, 8 px; `rounded-sm` é `--radius-sm`, 6 px (`globals.css:271-272`).
    for (const peca of ["button", "input", "textarea", "toggle", "tooltip"]) {
      expect(ler(`src/interface/componentes/ui/${peca}.tsx`), peca).not.toMatch(/\brounded-md\b/u);
    }
    expect(ler("src/interface/componentes/ui/sidebar.tsx")).toMatch(
      /const sidebarMenuButtonVariants = cva\(\s*"[^"]*\brounded-sm\b/u,
    );
  });

  it("o alvo de toque vem da peça: botão, campo, item de menu e botão de ícone (critério 44q.14a)", () => {
    const botao = ler("src/interface/componentes/ui/button.tsx");
    expect(botao).toMatch(/default: "min-h-11 /u);
    expect(botao).toMatch(/icon: "size-11"/u);
    expect(ler("src/interface/componentes/ui/input.tsx")).toMatch(/"h-11 /u);
    expect(ler("src/interface/componentes/ui/sidebar.tsx")).toMatch(/default: "min-h-11 text-interface\/\[17px\]"/u);
    // A entrelinha de 17 do item de menu viaja COLADA ao tamanho, e não num `leading-*` solto: o
    // `tailwind-merge` apaga o `leading-*` que vem antes de qualquer tamanho de texto (grupo em conflito),
    // e a navegação passa `text-interface` por cima. Conferido com o pacote do repositório na revisão.
    expect(ler("src/interface/componentes/casca/navegacao.tsx")).toContain('"text-interface/[17px] h-auto min-h-11');
  });

  it("o selo, a contagem e o avatar estão no oitavo papel (critério 44q.3)", () => {
    expect(ler("src/interface/componentes/ui/badge.tsx")).toMatch(/rounded-sm [^"]*px-2\.25 [^"]*text-rotulo-peca/u);
    // A tinta do avatar é a da marca desde o item 64; o papel da escala é o que esta guarda afirma.
    expect(ler("src/interface/componentes/ui/avatar.tsx")).toContain("text-rotulo-peca text-marca-foreground");
    expect(ler("src/interface/componentes/filtro-rapido.ts")).toMatch(/CONTAGEM_DO_FILTRO =[^;]*text-rotulo-peca/u);
  });

  it("a contagem, a caixa e a opção do filtro rápido existem uma vez só (desvio D4 do plano)", () => {
    for (const caminho of [
      "src/interface/componentes/recorte-da-lista.tsx",
      "src/interface/componentes/lista-de-ordem-manual.tsx",
      "src/interface/componentes/tabela-de-participantes.tsx",
    ]) {
      const fonte = ler(caminho);
      expect(fonte, caminho).toContain("CONTAGEM_DO_FILTRO");
      expect(fonte, caminho).not.toContain("rounded-full px-1.5 font-mono");
    }
  });

  it("o cabeçalho de coluna e a célula existem uma vez só, com o fundo e os 11 px (critério 44q.3)", () => {
    const pecas = ler("src/interface/componentes/pecas-da-tabela.ts");
    expect(pecas).toMatch(/ROTULO_DE_COLUNA =[^;]*bg-background[^;]*py-2\.75/u);
    expect(pecas).toMatch(/CELULA =[^;]*py-2\.75/u);
    const copias = [
      "lista-de-ocorrencias.tsx",
      "lista-de-ordem-manual.tsx",
      "tabela-de-areas.tsx",
      "tabela-de-participantes.tsx",
    ].filter((nome) => /const ROTULO_DE_COLUNA =/u.test(ler(`src/interface/componentes/${nome}`)));
    expect(copias).toStrictEqual([]);
  });

  it("dica, erro de campo e rodapé de modal (critério 44q.3)", () => {
    expect(ler("src/interface/componentes/ui/tooltip.tsx")).toMatch(/CLASSE_DA_DICA =[^;]*rounded-sm[^;]*px-2\.25 py-1\.25[^;]*font-medium/u);
    expect(ler("src/interface/componentes/campo.tsx")).toContain(
      'className="text-destructive text-meta flex items-center gap-1.5"',
    );
    expect(ler("src/interface/componentes/modal.tsx")).toMatch(/RODAPE_DO_MODAL =[^;]*bg-background[^;]*border-t[^;]*px-6 py-3\.5/u);
    expect(ler("src/interface/componentes/campo.tsx")).toContain('"flex flex-col-reverse gap-2.5 sm:flex-row"');
  });

  it("a faixa do cartão é uma variante da cabeça, com o título em h2 no papel de rótulo (critério 44q.5)", () => {
    const fonte = ler("src/interface/componentes/cartao.tsx");
    expect(fonte).toContain('export const TITULO_DA_FAIXA = "text-rotulo-coluna text-tinta-fraca font-mono uppercase"');
    expect(fonte).toContain("export function FaixaDoCartao");
    expect(fonte).toContain("export function CorpoDoCartao");
  });

  it("os blocos de T-05 são cartões com faixa, e os títulos não mudaram de texto (critérios 44q.5 e 44q.16)", () => {
    const pagina = ler("app/(casca)/ocorrencias/[ocorrenciaId]/page.tsx");
    for (const titulo of ["O que foi relatado", "Solução aplicada", "Linha do tempo", "Detalhes"]) {
      expect(pagina, titulo).toMatch(new RegExp(`className=\\{TITULO_DA_FAIXA\\}[^>]*>\\s*${titulo}`, "u"));
    }
    // O título da avaliação continua o que o teste de ponta a ponta afirma (desvio D3).
    expect(pagina).toContain('{ehAutor ? "Sua avaliação" : "Avaliação do solicitante"}');
    // `0 fotos` não se escreve — e sem foto o `dado` é `undefined`, não `false`, para a faixa não montar
    // o invólucro da direita vazio.
    expect(pagina).toMatch(/detalhe\.anexos\.length > 0\s*\?/u);

    const conversa = ler("src/interface/componentes/conversa-da-ocorrencia.tsx");
    // **"Mensagens N" é o nome que o teste afirma** (`interrupcoes-da-ocorrencia.spec.ts:320`). O
    // separador entra mudo, e a contagem continua sumindo enquanto há cursor.
    expect(conversa).toMatch(/Mensagens\{" "\}\s*\{cursor === null && \(/u);
    expect(conversa).toContain('<span aria-hidden="true">· </span>');
  });

  it("o estado atual mora num grupo nomeado que só contém o selo (item 66, a emenda de teste)", () => {
    // `mundo.ts` e `caminho-critico.spec.ts` escopam a situação por `getByRole("group", { name: "Situação" })`.
    // Se o grupo alcançasse o título, um título com "resolvida" faria a asserção passar pela razão errada.
    const cabecalho = ler("src/interface/componentes/cabecalho-da-ocorrencia.tsx");
    const inicio = cabecalho.indexOf('role="group"');
    const grupo = cabecalho.slice(inicio, cabecalho.indexOf("</div>", inicio));
    expect(grupo).toContain('aria-label="Situação"');
    expect(grupo).toContain("<SeloDeStatus");
    expect(grupo).not.toContain("{titulo}");
    expect(grupo).not.toContain("{acoes}");
    const pagina = ler("app/(casca)/ocorrencias/[ocorrenciaId]/page.tsx");
    expect(pagina).toContain("<CabecalhoDaOcorrencia");
    expect(pagina).toContain("<CaminhoDaPagina");
    expect(pagina).not.toMatch(/>\s*Situação\s*</u);
  });

  it("as ações moram no cabeçalho: nada preso ao pé, primário na ponta direita e em cima no celular (item 66)", () => {
    const barra = ler("src/interface/componentes/barra-de-acoes.tsx");
    expect(barra).not.toContain("fixed inset-x-0 bottom-0");
    expect(barra).not.toContain("flex-[2]");
    expect(barra).not.toMatch(/<section/u);
    expect(barra).toContain("md:contents");
    expect(barra).toContain("md:flex-row-reverse");
    const pagina = ler("app/(casca)/ocorrencias/[ocorrenciaId]/page.tsx");
    expect(pagina).not.toContain("pb-24");
    // O título trunca só onde divide a linha com as ações; no celular ele quebra (spec §3.1).
    expect(ler("src/interface/componentes/cabecalho-da-ocorrencia.tsx")).toContain("break-words md:truncate");
  });

  it("o rótulo do campo da solução some da vista e fica no nome (critério 44q.5)", () => {
    expect(ler("src/interface/componentes/campo.tsx")).toContain('rotuloOculto && "sr-only"');
    expect(ler("src/interface/componentes/campo-de-solucao-aplicada.tsx")).toContain(
      '<Campo id={campoId} rotulo="Solução aplicada" rotuloOculto',
    );
  });

  it("a régua ganha o visto, a marca de agora e a data à direita (critério 44q.6)", () => {
    const regua = ler("src/interface/componentes/regua-do-ciclo.tsx");
    expect(regua).toMatch(/passo\.estado === "alcancado" && \(\s*<Check aria-hidden/u);
    expect(regua).toMatch(/passo\.estado === "atual" && <span[^>]*>agora<\/span>/u);
    expect(regua).toContain("justify-between");
    // Os três marcadores e a ligação não mudaram (critério 44q.6).
    expect(regua).toContain('alcancado: "bg-tinta-suave border-tinta-suave"');
  });

  it("a linha do tempo e as mensagens têm avatar, e o primeiro evento veste a cor da Aberta (critério 44q.7)", () => {
    const pagina = ler("app/(casca)/ocorrencias/[ocorrenciaId]/page.tsx");
    expect(pagina).toContain("<AvatarDePessoa");
    expect(pagina).toMatch(/indice === 0 && evento\.tipo === "transicao"/u);
    expect(pagina).toContain("bg-marca border-marca");
    const conversa = ler("src/interface/componentes/conversa-da-ocorrencia.tsx");
    expect(conversa).toContain("<AvatarDePessoa");
    // A bolha (item 66): fundo `--chrome`, exposto como `bg-secondary`; autoria fora dela; 60 caracteres.
    expect(conversa).toContain("bg-secondary text-tinta text-corpo");
    expect(conversa).toContain("max-w-[60ch]");
    expect(conversa).not.toContain("bg-background rounded-lg");
  });

  it("a barra de filtros é a primeira faixa do cartão da lista, fora do recuo da espera (critério 44q.9)", () => {
    const cartao = ler("src/interface/componentes/cartao-da-lista.tsx");
    expect(cartao).toMatch(/\{faixa\}\s*\n\s*<div\s+className=\{\s*pendente/u);
    const pagina = ler("app/(casca)/ocorrencias/page.tsx");
    expect(pagina).toContain('<CartaoDaLista faixa={estado !== "organizacao" ? barra : undefined}>');
  });

  it("as encerradas descem um degrau de tinta por grupo, e o selo e o convite não descem (critério 44q.9)", () => {
    const lista = ler("src/interface/componentes/lista-de-ocorrencias.tsx");
    expect(lista).toContain('data-recuada={encerrada(item.status) ? "" : undefined}');
    expect(lista).toContain("group-data-[recuada]/linha:text-tinta-suave");
    expect(lista).toContain("group-data-[recuada]/linha:text-tinta-fraca");
    // Recuo por tinta nomeada, nunca `opacity` na linha: a opacidade apagaria o selo e o convite.
    expect(lista).not.toMatch(/group-data-\[recuada\]\/linha:opacity/u);
    // A meta da linha de apoio segue a prancheta, `--ink-soft` (exceção c do critério 44q.14).
    expect(lista).not.toContain('"text-tinta-fraca text-meta flex flex-wrap items-center gap-1.5"');
  });

  it("o sublinhado da ficha só existe onde existe o cartão de ponteiro (critério 44q.9, crítica C1)", () => {
    for (const caminho of ["src/interface/componentes/ficha-de-local.tsx", "src/interface/componentes/ficha-de-pessoa.tsx"]) {
      const fonte = ler(caminho);
      expect(fonte, caminho).toContain(
        "[@media(hover:hover)_and_(pointer:fine)]:underline [@media(hover:hover)_and_(pointer:fine)]:decoration-linha [@media(hover:hover)_and_(pointer:fine)]:underline-offset-3",
      );
    }
  });
});

/**
 * ============================================================================
 *  Item 64 — a varredura de botão, ícone e rótulo
 * ============================================================================
 *
 * Guardas sobre a fonte, no precedente dos itens 44g a 44q: cada troca da validação de 23/09/2026 no
 * componente que a serve. **Principal é a cor da marca** (guia §2), e a variante padrão do catálogo é
 * `bg-primary`, tinta escura.
 */
describe("o alcance do 64 — a varredura de botão, ícone e rótulo", () => {
  it("Entrar, Criar conta e Pedir entrada são o botão principal (trocas 1, 2 e 4)", () => {
    for (const caminho of [
      "src/interface/componentes/formulario-de-entrada.tsx",
      "src/interface/componentes/formulario-de-cadastro.tsx",
      "src/interface/componentes/formulario-de-pedido-de-entrada.tsx",
    ]) {
      expect(ler(caminho), caminho).toMatch(/<Button\s+type="submit"\s+variant="marca"/u);
    }
  });

  it("Entrar e Criar conta ocupam a largura do cartão, e Pedir entrada não (troca 3)", () => {
    for (const caminho of [
      "src/interface/componentes/formulario-de-entrada.tsx",
      "src/interface/componentes/formulario-de-cadastro.tsx",
    ]) {
      expect(ler(caminho), caminho).toMatch(/<RodapeDoFormulario[^>]*\blarguraCheia\b/u);
    }
    expect(ler("src/interface/componentes/formulario-de-pedido-de-entrada.tsx")).not.toContain("larguraCheia");

    const campo = ler("src/interface/componentes/campo.tsx");
    // O ramo de sempre fica como estava (critério 44q.3 afirma a cadeia dele).
    expect(campo).toContain('"flex flex-col-reverse gap-2.5 sm:flex-row"');
    expect(campo).toContain('"flex flex-col gap-2.5"');
  });

  it("Editar de /meus-dados e de /configuracao é o botão principal, e é um componente só (troca 5)", () => {
    const fonte = ler("src/interface/componentes/edicao-de-nome.tsx");
    const gatilho = fonte.slice(fonte.indexOf("gatilho={"), fonte.indexOf("rodape={"));
    expect(gatilho).toContain('variant="marca"');
    expect(gatilho).not.toContain('variant="outline"');
    for (const tela of ["app/(casca)/meus-dados/page.tsx", "app/(casca)/configuracao/page.tsx"]) {
      expect(ler(tela), tela).toContain("<EdicaoDeNome");
    }
  });

  it("Descartar pede destructive pela variante, que é o que o AlertDialogAction lê (troca 6)", () => {
    const fonte = ler("src/interface/componentes/formulario-de-ocorrencia.tsx");
    const acao = fonte.slice(fonte.indexOf("<AlertDialogAction"), fonte.indexOf("</AlertDialogAction>"));
    expect(acao).toContain('variant="destructive"');
    expect(acao).not.toContain("buttonVariants");
  });

  it("nenhum AlertDialogAction ou AlertDialogCancel recebe cor por className (Review Focus 3)", () => {
    // O `AlertDialogAction` embrulha a si mesmo num `<Button variant asChild>`, e o `Slot` concatena as
    // classes sem `tailwind-merge`: a cor que chega por `className` disputa com a variante, e perde.
    // Cada elemento é lido da abertura ao fechamento: um `[^>]*` pararia no `=>` do `onClick`, que vem
    // antes do `className` no Descartar, e a guarda passaria sobre o próprio defeito.
    const comCorPorClasse = [...arquivosDe("src"), ...arquivosDe("app")].filter((caminho) =>
      [...ler(caminho).matchAll(/<AlertDialog(Action|Cancel)\b[\s\S]*?<\/AlertDialog\1>/gu)].some((elemento) =>
        elemento[0].includes("buttonVariants"),
      ),
    );
    expect(comCorPorClasse).toStrictEqual([]);
  });

  it("nos vazios de /ocorrencias, registrar é principal e vem primeiro; o outro é contorno (trocas 7 e 8)", () => {
    const fonte = ler("app/(casca)/ocorrencias/page.tsx");
    const vazio = fonte.slice(fonte.indexOf("function Vazio("), fonte.indexOf("function AlemDoFim("));
    const conteudo = vazio.slice(vazio.indexOf("<EmptyContent"), vazio.indexOf("</EmptyContent>"));

    const registrar = conteudo.indexOf('href="/ocorrencias/nova"');
    const conferir = conteudo.indexOf('href="/configuracao/areas"');
    // **O destino de *Limpar filtros* virou expressão no item 67**: ele mantém a ordem escolhida, então
    // o endereço carrega a consulta sem os sete recortes, em vez do caminho limpo.
    const limpar = conteudo.search(/href=\{`\/ocorrencias\?\$\{semFiltros/u);
    expect(registrar).toBeGreaterThan(-1);
    expect(registrar).toBeLessThan(conferir);
    expect(registrar).toBeLessThan(limpar);

    // A cor de cada um: o bloco de registrar em marca, os dois outros em contorno.
    expect(conteudo.slice(registrar, conferir)).toContain('variant: "marca"');
    expect(conteudo.slice(conferir)).toContain('variant: "outline"');
    expect(conteudo).not.toContain("underline underline-offset-4");

    // Abaixo de `sm` empilham, na largura cheia; a partir de `sm`, lado a lado com 12 px.
    expect(conteudo).toContain('"flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:justify-center"');
  });

  it("a trilha de auditoria é botão de contorno, e continua <a> (troca 9)", () => {
    const fonte = ler("app/(casca)/ocorrencias/[ocorrenciaId]/page.tsx");
    const inicio = fonte.indexOf("href={`/ocorrencias/${detalhe.id}/auditoria`}");
    const link = fonte.slice(fonte.lastIndexOf("<a", inicio), fonte.indexOf("</a>", inicio));
    expect(link).toContain('variant: "outline"');
    expect(link).toContain("Ver a trilha de auditoria");
    expect(link).not.toContain("→");
    expect(link).not.toContain("text-marca");
  });

  it("o status é a única peça cheia da linha, e a prioridade é contorno nos três níveis (troca 10, critério 4)", () => {
    const selo = ler("src/interface/componentes/selo-de-status.tsx");
    const inicioDoSelo = selo.indexOf("const FORMA_DO_SELO");
    const formas = selo.slice(inicioDoSelo, selo.indexOf("};", inicioDoSelo));
    // Nenhum selo de status é transparente: todos têm fundo.
    expect(formas).not.toContain("bg-transparent");

    const lista = ler("src/interface/componentes/lista-de-ocorrencias.tsx");
    const inicio = lista.indexOf("const FORMA_DA_PRIORIDADE");
    const prioridade = lista.slice(inicio, lista.indexOf("};", inicio));
    expect(prioridade).toContain('alta: "border-destructive text-destructive bg-transparent"');
    expect(prioridade).toContain('normal: "border-linha text-tinta-suave bg-transparent"');
    expect(prioridade).toContain('baixa: "border-linha text-tinta-suave bg-transparent"');
    // A palavra continua dentro do selo (guia §2), e os três desenhos chamam a mesma peça.
    expect(lista).toMatch(
      /<Badge variant="outline" className=\{FORMA_DA_PRIORIDADE\[prioridade\]\}>\s*\{rotuloDePrioridade\(prioridade\)\}/u,
    );
    expect(lista.match(/<PalavraDePrioridade /gu)).toHaveLength(3);
  });

  it("o local leva MapPin, e nenhum emoji de local sobra no produto (troca 11)", () => {
    const ficha = ler("src/interface/componentes/ficha-de-local.tsx");
    expect(ficha).toContain('<MapPin aria-hidden="true" strokeWidth={1.9} className="text-tinta-fraca size-[15px] shrink-0" />');
    expect(ficha).toContain("inline-flex items-center gap-1.5");
    const comEmoji = [...arquivosDe("src"), ...arquivosDe("app")].filter((caminho) => ler(caminho).includes("📍"));
    expect(comEmoji).toStrictEqual([]);
    // A recusa do 44f fica, com o alcance que ela de fato decidiu: o item Áreas da barra.
    expect(ler("src/interface/componentes/casca/navegacao.tsx")).toContain("LayoutGrid");
  });

  it("todo avatar é laranja, pela peça base, e ninguém a repinta de neutro (troca 12)", () => {
    const base = ler("src/interface/componentes/ui/avatar.tsx");
    expect(base).toContain("rounded-full bg-marca text-rotulo-peca text-marca-foreground");
    expect(base).not.toContain("bg-muted text-rotulo-peca text-tinta");
    // Nenhum chamador devolve o avatar ao neutro por classe. A página do grupo (item 70) é a exceção
    // declarada: fica fora da casca, e a cor de cada integrante é decisão do 70, não repintura.
    const repintados = [...arquivosDe("src"), ...arquivosDe("app")].filter(
      (caminho) =>
        !caminho.endsWith("cartao-de-integrante.tsx") && /<AvatarFallback[^>]*className=/u.test(ler(caminho)),
    );
    expect(repintados).toStrictEqual([]);
    // O portão de estilo mede a mesma tinta.
    expect(ler("ferramentas/conferir-estilo.mjs")).toMatch(/id: "avatar"[\s\S]*?color: "token\(--marca-foreground\)"/u);
  });

  it("a tela de áreas monta o fato a partir da frase que o teste protege (troca 15)", () => {
    const pagina = ler("app/(casca)/configuracao/areas/page.tsx");
    expect(pagina).toContain("FRASE_DAS_AREAS");
    expect(pagina).not.toContain("Onde, dentro da organização");
  });

  it("o slogan de /entrar (troca 14)", () => {
    const moldura = ler("src/interface/componentes/moldura-de-conta.tsx");
    expect(moldura).toContain("O livro de ocorrências da sua organização, aberto para quem cuida.");
    expect(moldura).not.toContain("fica registrado, com data e autor");
  });
});

/**
 * ============================================================================
 *  Item 66 — a página da ocorrência, remontada
 * ============================================================================
 *
 * O cabeçalho, o caminho, a faixa de avaliação, a foto em diálogo e o escopo do teste de situação. Como no
 * resto deste arquivo, o que é regra de forma vira guarda sobre o código-fonte.
 */
describe("o item 66 — a página da ocorrência, remontada", () => {
  it("a trilha tem o caminho de três níveis e perde o voltar (critério 66.3)", () => {
    const trilha = ler("app/(casca)/ocorrencias/[ocorrenciaId]/auditoria/page.tsx");
    expect(trilha).toContain("<CaminhoDaPagina");
    expect(trilha).toContain('atual="Trilha de auditoria"');
    expect(trilha).not.toContain("voltar à ocorrência");
    // As duas telas de participante continuam com a forma de um nível só.
    expect(ler("app/(casca)/vinculos/nova/page.tsx")).toContain(
      'anterior={{ rotulo: "Participantes", href: "/vinculos" }}',
    );
  });

  it("o aviso de avaliação é a faixa do catálogo, e avaliar sai da barra (critérios 66.4 e 66.5)", () => {
    expect(existsSync(`${RAIZ}src/interface/componentes/ui/alert.tsx`)).toBe(true);
    const aviso = ler("src/interface/componentes/aviso-de-avaliacao.tsx");
    expect(aviso).toContain("<Alert");
    expect(aviso).toContain("AVISO_DE_AVALIACAO");
    const pagina = ler("app/(casca)/ocorrencias/[ocorrenciaId]/page.tsx");
    expect(pagina).not.toContain("Resolvida. Conte como foi.");
    expect(pagina).toContain('acao.comando !== "avaliar"');
    expect(pagina).toContain("abreAvaliacaoPeloEndereco(");
    // O parâmetro sai da URL ao abrir, por `replaceState`, sem ida ao servidor (desvio D1 do plano).
    expect(ler("src/interface/componentes/modal-de-avaliacao.tsx")).toContain("history.replaceState");
  });

  it("a última mudança é a última linha de Detalhes, e não um bloco (item 66)", () => {
    const pagina = ler("app/(casca)/ocorrencias/[ocorrenciaId]/page.tsx");
    expect(pagina).not.toMatch(/<h2[^>]*>\s*Última mudança/u);
    expect(pagina).toMatch(/<dt className="font-medium">Última mudança<\/dt>/u);
    // É a última linha: entre ela e o `</dl>` não entra outro `<dt`. **`indexOf` devolve `-1` quando não
    // há mais nenhum `<dt` no arquivo**, que é o caso hoje e satisfaz a exigência com folga — comparar
    // `-1` com a posição do `</dl>` diria o contrário.
    const inicio = pagina.indexOf("Última mudança</dt>");
    const fimDaLista = pagina.indexOf("</dl>", inicio);
    const proximoDt = pagina.indexOf("<dt", inicio);
    expect(fimDaLista).toBeGreaterThan(inicio);
    expect(proximoDt === -1 || proximoDt > fimDaLista).toBe(true);
  });

  it("a foto abre em diálogo, sem aba nova e sem <img> (critério 66.2)", () => {
    const pagina = ler("app/(casca)/ocorrencias/[ocorrenciaId]/page.tsx");
    expect(pagina).not.toContain('target="_blank"');
    expect(pagina).not.toContain("Abrir a foto");
    expect(pagina).toContain("<FotoAmpliavel");
    const foto = ler("src/interface/componentes/foto-ampliavel.tsx");
    expect(foto).toContain("<DialogTrigger asChild>");
    expect(foto).toContain("Ampliar");
    expect(foto).toContain("bg-contain");
    expect(foto).not.toMatch(/<img[\s>]/u);
    // G7 do guia: nenhum controle cru fora de `ui/` — o gatilho é o `Button` do catálogo.
    expect(foto).not.toMatch(/<button(\s|>|$)/mu);
  });

  const ARQUIVOS_DO_66 = [
    "src/interface/componentes/cabecalho-da-ocorrencia.tsx",
    "src/interface/componentes/aviso-de-avaliacao.tsx",
    "src/interface/componentes/foto-ampliavel.tsx",
    "src/interface/componentes/caminho-da-pagina.tsx",
    "src/interface/componentes/modal-de-atribuicao.tsx",
    "src/interface/componentes/conversa-da-ocorrencia.tsx",
    "src/interface/componentes/barra-de-acoes.tsx",
  ];

  it("nenhum tamanho fora dos sete papéis, e nenhuma primitiva de outra biblioteca (critério 66.4)", () => {
    const tamanhos = ARQUIVOS_DO_66.flatMap((caminho) =>
      [...ler(caminho).matchAll(/text-(?:xs|sm|base|lg|xl|2xl)/gu)].map(
        (achado) => `${caminho}: ${achado[0]}`,
      ),
    );
    expect(tamanhos).toStrictEqual([]);

    const importados = ARQUIVOS_DO_66.flatMap((caminho) =>
      [...ler(caminho).matchAll(/from "([^"]+)"/gu)].map((achado) => achado[1] ?? ""),
    );
    const deFora = importados.filter(
      (modulo) =>
        !modulo.startsWith("@/") &&
        !["react", "next/link", "next/navigation", "lucide-react"].includes(modulo),
    );
    expect(deFora).toStrictEqual([]);
  });
});

/**
 * ============================================================================
 *  Item 65 — as duas portas de entrada, e o código em casas
 * ============================================================================
 */
const CAMPO_DE_CODIGO = "src/interface/componentes/campo-de-codigo.tsx";
const CONVITE = "src/interface/componentes/convite-da-outra-porta.tsx";

describe("o alcance do 65 — as duas portas de entrada", () => {
  it("o input-otp entra fixado, e é o único pacote novo (ADR-0014)", () => {
    expect(existsSync(RAIZ + "src/interface/componentes/ui/input-otp.tsx")).toBe(true);
    const pacote = JSON.parse(ler("package.json")) as { dependencies: Record<string, string | undefined> };
    // Fixado, sem acento circunflexo: a ADR-0011 faz da atualização uma decisão.
    expect(pacote.dependencies["input-otp"]).toBe("1.5.0");
    expect(pacote.dependencies["cn"]).toBeUndefined();
    expect(Object.keys(pacote.dependencies).filter((nome) => nome.startsWith("@radix-ui/"))).toStrictEqual([]);
  });

  it("o campo de código é o input-otp, com o padrão, a colagem e o teclado domados (critério 65.2)", () => {
    const fonte = ler(CAMPO_DE_CODIGO);
    expect(fonte).toMatch(/^"use client";/u);
    expect(fonte).toContain("pattern={PADRAO_DA_DIGITACAO}");
    expect(fonte).toContain("pasteTransformer={limparCodigo}");
    expect(fonte).toContain("onChange={(novo) => setValor(novo.toUpperCase())}");
    expect(fonte).toContain('autoCapitalize="characters"');
    expect(fonte).toContain('autoComplete="off"');
    expect(fonte).toContain("spellCheck={false}");
    // A tela não pode importar o arquivo do Domínio que importa `node:crypto`.
    expect(fonte).not.toContain("@/dominio");
  });

  it("as oito casas cabem num celular de 360 px (F2 do plano)", () => {
    const fonte = ler(CAMPO_DE_CODIGO);
    const casa = /const CASA_DA_ENTRADA =\s*"([^"]+)"/u.exec(fonte)?.[1]?.split(" ") ?? [];
    // Abaixo de `sm` a casa divide a largura; a partir de `sm` ela tem os 40 px do design, e 48 a partir de `md`.
    expect(casa).toEqual(expect.arrayContaining(["min-w-0", "flex-1", "sm:w-10", "sm:flex-none", "md:w-12", "md:h-14"]));
  });

  it("o pedido de entrada usa o campo novo, com a ajuda e a conferência de oito", () => {
    const fonte = ler(PEDIDO_DE_ENTRADA);
    expect(fonte).toContain("<EntradaDeCodigo");
    expect(fonte).toContain("erroDoCodigo(codigoDigitado(dados))");
    expect(fonte).toContain('ajuda="Está no cartaz do elevador ou na mensagem do grupo."');
    expect(fonte).not.toContain("Seis a doze");
    expect(fonte).not.toContain("maxLength={12}");
    expect(fonte).not.toContain("codigoPublico.safeParse");
  });

  it("nenhum tamanho fora dos sete papéis e nenhum controle cru nos arquivos novos do 65", () => {
    for (const caminho of [CAMPO_DE_CODIGO]) {
      const fonte = ler(caminho);
      expect([...fonte.matchAll(/\btext-(?:xs|sm|base|lg|xl|2xl|3xl)\b/gu)], caminho).toStrictEqual([]);
      expect([...fonte.matchAll(/<(?:select|textarea|button)(?:\s|>|$)/gu)], caminho).toStrictEqual([]);
    }
  });
});
