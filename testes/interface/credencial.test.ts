import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it, vi } from "vitest";

// `@/interface/http` alcança `next/headers`, que não roda fora de uma requisição. Aqui o que está sob
// teste é a **regra de nomes** — pura —, então o módulo do framework é simulado, do mesmo jeito que o
// teste de infraestrutura simula o SDK do provedor. Sem isto, a importação derruba o arquivo inteiro.
vi.mock("next/headers", () => ({
  cookies: () => {
    throw new Error("cookies() não é usado neste teste");
  },
  headers: () => {
    throw new Error("headers() não é usado neste teste");
  },
}));

import {
  CAMINHO_DA_CONFIRMACAO,
  PREFIXO_DE_REDEFINICAO,
  destinoSeguro,
  montarDestinoDeConfirmacao,
  origemDoPedido,
  somenteDeRedefinicao,
} from "@/interface/http";
import {
  criarContaSchema,
  definirSenhaSchema,
  entrarSchema,
  pedirRedefinicaoSchema,
} from "@/interface/schemas";

/**
 * ============================================================================
 *  Unitário de INTERFACE — os schemas das telas de credencial (T-01, T-11)
 * ============================================================================
 *
 * **O que este arquivo prova, e é o critério 1 do item 6a:** que T-11 pede **três** campos, que o `nome` é
 * obrigatório e cabe em 120 — o `varchar(120)` de `pessoas.nome` (modelo §6.2) —, e que T-01 pede dois.
 *
 * O schema é o **mesmo objeto** no navegador e no servidor (ADR-0007), então o que se confere aqui é o que
 * a tela recusa antes de gastar uma ida ao provedor.
 */

describe("criarContaSchema — os três campos de T-11", () => {
  const valido = { nome: "Helena Rocha", email: "helena@exemplo.test", senha: "segredo" };

  it("aceita os três campos preenchidos", () => {
    const conferido = criarContaSchema.safeParse(valido);

    expect(conferido.success).toBe(true);
  });

  it("exige o nome — é ele que vira pessoas.nome, e a coluna é NOT NULL", () => {
    const conferido = criarContaSchema.safeParse({ ...valido, nome: "" });

    expect(conferido.success).toBe(false);
  });

  it("exige e-mail e senha", () => {
    expect(criarContaSchema.safeParse({ ...valido, email: "" }).success).toBe(false);
    expect(criarContaSchema.safeParse({ ...valido, senha: "" }).success).toBe(false);
  });

  it("recusa e-mail sem forma de e-mail", () => {
    const conferido = criarContaSchema.safeParse({ ...valido, email: "helena-arroba-exemplo" });

    expect(conferido.success).toBe(false);
  });

  it("aceita nome de 120 e recusa de 121 — é o limite que T-11 declara", () => {
    const cento_e_vinte = "a".repeat(120);

    expect(criarContaSchema.safeParse({ ...valido, nome: cento_e_vinte }).success).toBe(true);
    expect(criarContaSchema.safeParse({ ...valido, nome: `${cento_e_vinte}a` }).success).toBe(false);
  });

  it("apara o espaço em volta do nome antes de medir — 120 com espaços continua cabendo", () => {
    const conferido = criarContaSchema.safeParse({ ...valido, nome: "  Helena Rocha  " });

    expect(conferido.success).toBe(true);
    expect(conferido.success && conferido.data.nome).toBe("Helena Rocha");
  });

  it("nome só de espaço não passa — o aparo acontece antes da obrigatoriedade", () => {
    const conferido = criarContaSchema.safeParse({ ...valido, nome: "     " });

    expect(conferido.success).toBe(false);
  });
});

describe("entrarSchema — os dois campos de T-01", () => {
  it("pede e-mail e senha, e não pede nome", () => {
    const conferido = entrarSchema.safeParse({ email: "helena@exemplo.test", senha: "segredo" });

    expect(conferido.success).toBe(true);
    expect(conferido.success && Object.keys(conferido.data).sort()).toStrictEqual(["email", "senha"]);
  });

  it("recusa credencial vazia sem ir ao provedor", () => {
    expect(entrarSchema.safeParse({ email: "", senha: "" }).success).toBe(false);
  });
});

describe("pedirRedefinicaoSchema — o campo único de T-12", () => {
  it("pede e-mail, e só e-mail", () => {
    const conferido = pedirRedefinicaoSchema.safeParse({ email: "helena@exemplo.test" });

    expect(conferido.success).toBe(true);
    expect(conferido.success && Object.keys(conferido.data)).toStrictEqual(["email"]);
  });

  it("recusa e-mail malformado antes de gastar um envio do teto de dois por hora", () => {
    expect(pedirRedefinicaoSchema.safeParse({ email: "helena-arroba-exemplo" }).success).toBe(false);
  });

  it("recusa e-mail vazio sem ir ao provedor", () => {
    expect(pedirRedefinicaoSchema.safeParse({ email: "" }).success).toBe(false);
  });
});

describe("definirSenhaSchema — o campo único de T-13 (critério 2)", () => {
  it("pede a senha nova e NÃO pede a antiga", () => {
    const conferido = definirSenhaSchema.safeParse({ senha: "senha-nova-boa" });

    expect(conferido.success).toBe(true);
    expect(conferido.success && Object.keys(conferido.data)).toStrictEqual(["senha"]);
  });

  it("descarta um campo de senha antiga se alguém o mandar", () => {
    const conferido = definirSenhaSchema.safeParse({ senha: "nova", senhaAntiga: "velha" });

    expect(conferido.success && Object.keys(conferido.data)).toStrictEqual(["senha"]);
  });

  it("recusa senha vazia sem ir ao provedor", () => {
    expect(definirSenhaSchema.safeParse({ senha: "" }).success).toBe(false);
  });

  it("aceita senha de 6 e de 5 — a regra de força é do provedor, não deste schema", () => {
    // **Deliberado, e é a restrição G1.** O número 6 já vive na frase da tela e no `config.toml`; escrevê-lo
    // aqui criaria um terceiro lugar guardando o mesmo valor. Senha curta é recusada pelo provedor e volta
    // como SENHA_RECUSADA_PELO_PROVEDOR — que é a mesma mecânica de T-11.
    expect(definirSenhaSchema.safeParse({ senha: "123456" }).success).toBe(true);
    expect(definirSenhaSchema.safeParse({ senha: "12345" }).success).toBe(true);
  });
});

describe("somenteDeRedefinicao — a sessão de recuperação não é a sessão do produto", () => {
  it("não enxerga o cookie de sessão normal, e devolve o de recuperação sem o prefixo", () => {
    // É o mecanismo inteiro da decisão D-6b-2: `sessaoAtual()` lê o pote sem prefixo e não acha nada, então
    // abrir o link válido e digitar `/` **não entra no produto**.
    const pote = [
      { name: "sb-projeto-auth-token", value: "sessao-normal" },
      { name: `${PREFIXO_DE_REDEFINICAO}sb-projeto-auth-token`, value: "sessao-de-recuperacao" },
      { name: "resolveai_organizacao", value: "cookie-de-organizacao" },
    ];

    expect(somenteDeRedefinicao(pote)).toStrictEqual([
      { name: "sb-projeto-auth-token", value: "sessao-de-recuperacao" },
    ]);
  });

  it("sem cookie de recuperação o armazenamento é vazio — o SDK não encontra sessão nenhuma", () => {
    const pote = [{ name: "sb-projeto-auth-token", value: "sessao-normal" }];

    expect(somenteDeRedefinicao(pote)).toStrictEqual([]);
  });
});

describe("montarDestinoDeConfirmacao — o destino do link de confirmação (item 6c, critério 4)", () => {
  it("monta o destino a partir da origem recebida", () => {
    expect(montarDestinoDeConfirmacao("https://exemplo.test")).toBe(
      "https://exemplo.test/confirmar-conta",
    );
  });

  it("outra origem dá outro destino — é isto que prova que o host NÃO está no código", () => {
    // O par abaixo é o de verdade: a máquina de quem desenvolve e o Container App publicado. Uma
    // constante de host passaria no caso de cima e falharia neste.
    expect(montarDestinoDeConfirmacao("http://host.docker.internal:3000")).toBe(
      "http://host.docker.internal:3000/confirmar-conta",
    );
    expect(montarDestinoDeConfirmacao("https://ca-resolve-ai.exemplo.test")).toBe(
      "https://ca-resolve-ai.exemplo.test/confirmar-conta",
    );
  });

  it("origem com barra final não produz barra dobrada", () => {
    expect(montarDestinoDeConfirmacao("https://exemplo.test/")).toBe(
      "https://exemplo.test/confirmar-conta",
    );
  });

  it("o caminho é o MESMO literal que o verificador do Auth publicado declara em ROTAS", () => {
    // `ferramentas/verificadores/auth-publicado.mjs` declara `const ROTAS = ["/confirmar-conta"]` e é ele
    // quem confere a lista de permissão do provedor PUBLICADO. Se este literal mudar e aquele não, o
    // portão fica verde conferindo uma rota que a aplicação não usa mais. Nenhum verificador compara os
    // dois arquivos — esta linha é o que existe no lugar dele.
    //
    // **Aquele arquivo não existe nesta base** (`develop`, 82693ca): ele chegou com o item 40b. O
    // comentário recíproco lá é achado para o hub, e não deste item.
    const declaradoNoVerificadorDoAuthPublicado = "/confirmar-conta";

    expect(CAMINHO_DA_CONFIRMACAO).toBe(declaradoNoVerificadorDoAuthPublicado);
    expect(montarDestinoDeConfirmacao("https://exemplo.test")).toBe(
      `https://exemplo.test${declaradoNoVerificadorDoAuthPublicado}`,
    );
  });
});

describe("origemDoPedido — a precedência dos cabeçalhos (item 6c)", () => {
  it("prefere o `Origin`, que numa Server Action o framework já conferiu contra o Host", () => {
    const cabecalhos = new Headers({
      origin: "https://publicado.test",
      host: "interno-do-container:3000",
    });

    expect(origemDoPedido(cabecalhos)).toBe("https://publicado.test");
  });

  it("sem `Origin`, usa o par x-forwarded — e o PRIMEIRO valor da lista de saltos", () => {
    // Atrás do ingress do Container Apps o esquema que chega ao container é `http`, porque o TLS termina
    // antes dele. Só `x-forwarded-proto` sabe que a pessoa está em `https`.
    const umSalto = new Headers({
      "x-forwarded-proto": "https",
      "x-forwarded-host": "publicado.test",
      host: "interno-do-container:3000",
    });
    const doisSaltos = new Headers({
      "x-forwarded-proto": "https,http",
      "x-forwarded-host": "publicado.test",
    });

    expect(origemDoPedido(umSalto)).toBe("https://publicado.test");
    expect(origemDoPedido(doisSaltos)).toBe("https://publicado.test");
  });

  it("sem `Origin` e sem x-forwarded, cai no `host` — e o esquema é http", () => {
    expect(origemDoPedido(new Headers({ host: "host.docker.internal:3000" }))).toBe(
      "http://host.docker.internal:3000",
    );
  });

  it("`Origin: null` — a origem opaca — não é aceita, e o par x-forwarded resolve", () => {
    // `new URL("null")` lança. Um `origin ?? host` ingênuo devolveria a cadeia "null" como origem, e o
    // `emailRedirectTo` sairia inválido — que o provedor descartaria, voltando para a Site URL crua: o
    // defeito deste item, de volta por uma linha de conveniência.
    const cabecalhos = new Headers({
      origin: "null",
      "x-forwarded-proto": "https",
      "x-forwarded-host": "publicado.test",
    });

    expect(origemDoPedido(cabecalhos)).toBe("https://publicado.test");
  });

  it("sem cabeçalho nenhum, LANÇA — e a mensagem nomeia os três que faltaram", () => {
    // **Lança, e não omite.** Omitir o `emailRedirectTo` é literalmente o defeito deste item; um `?? ""`
    // aqui o reintroduziria no dia em que um cabeçalho mudasse de nome. Mesma doutrina do `escalar()` do
    // `auth-publicado.mjs`: campo que sumiu é falha, nunca omissão.
    expect(() => origemDoPedido(new Headers())).toThrow(/Origin/u);
    expect(() => origemDoPedido(new Headers())).toThrow(/Host/u);
  });
});

describe("destinoSeguro — a volta depois de entrar ou criar conta (critério 86.4)", () => {
  it.each([
    ["/convite/K7M4QX2P", "/convite/K7M4QX2P"],
    ["/ocorrencias/abc?aba=conversa", "/ocorrencias/abc?aba=conversa"],
    ["/", "/"],
  ])("aceita %s", (valor, esperado) => {
    expect(destinoSeguro(valor)).toBe(esperado);
  });

  it.each([
    ["//outro-dominio.com"],
    ["/\\outro-dominio.com"],
    ["/\t/outro-dominio.com"],
    ["/\n/outro-dominio.com"],
    ["https://outro-dominio.com"],
    ["convite/K7M4QX2P"],
    [""],
  ])("recusa %j", (valor) => {
    expect(destinoSeguro(valor)).toBeNull();
  });

  it("recusa o que não é texto", () => {
    expect(destinoSeguro(undefined)).toBeNull();
    expect(destinoSeguro(null)).toBeNull();
    expect(destinoSeguro(["/a"])).toBeNull();
  });
});

describe("o convite pessoal no cadastro (item 121)", () => {
  const valido = { nome: "Maria Souza", email: "maria@exemplo.test", senha: "segredo" };
  const TOKEN = "A".repeat(43);

  it("criarContaSchema aceita o convite no formato, e o descarta fora dele", () => {
    expect(criarContaSchema.parse({ ...valido, convite: TOKEN }).convite).toBe(TOKEN);
    const torto = criarContaSchema.safeParse({ ...valido, convite: "curto" });
    expect(torto.success).toBe(true);
    expect(torto.data?.convite).toBeUndefined();
    expect(criarContaSchema.safeParse({ ...valido, convite: null }).data?.convite).toBeUndefined();
  });

  it("a ação lê o convite do formulário, e o formulário navega pelo destino que a ação devolveu", () => {
    const raiz = fileURLToPath(new URL("../../", import.meta.url));
    const acoes = readFileSync(`${raiz}src/interface/acoes/index.ts`, "utf8");
    expect(acoes).toContain('convite: formulario.get("convite")');
    expect(acoes).toContain("ligarContaAoConvitePessoal(");
    const formulario = readFileSync(`${raiz}src/interface/componentes/formulario-de-cadastro.tsx`, "utf8");
    expect(formulario).toContain("router.replace(proximo.destino ?? destino");
    expect(formulario).toContain('<input type="hidden" name="convite"');
  });
});
