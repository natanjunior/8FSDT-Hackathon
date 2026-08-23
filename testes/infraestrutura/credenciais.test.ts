import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ============================================================================
 *  Unitário de INFRAESTRUTURA — o ACL do provedor de credencial
 * ============================================================================
 *
 * **A `PortaDeCredenciais` é porta, e a ADR-0008 diz que o grupo 2 da suíte cresce com porta nova.** Ela
 * chegou com o esqueleto de deploy e não tinha nenhuma prova; este arquivo é a dívida sendo paga.
 *
 * **O que está sob teste é a tradução, não o provedor.** O SDK é simulado: o que se confere é que a falha
 * do provedor vira **recusa nomeada nossa**, e que o `signUp` recebe o `nome` no metadado. Nada aqui toca
 * rede nem banco.
 *
 * **Não é um segundo teste de ponta a ponta**, e a distinção é da ADR-0008: um segundo E2E só entra se
 * provar *"outro transporte, não outro fluxo"*.
 */

const { signInWithPassword, signUp } = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: { signInWithPassword, signUp } }),
}));

// `vi.mock` é içado acima deste `import` pelo próprio Vitest — por isso o módulo real nunca é carregado,
// mesmo com importação estática.
import { criarCredenciais } from "@/infraestrutura/clientes";

/** O armazenamento que a camada de Interface entrega. Aqui não há requisição, então não há cookie. */
const cookiesVazios = { todos: () => [], definir: () => {} };

beforeEach(() => {
  vi.clearAllMocks();
  // `cliente()` recusa subir sem as duas — é a guarda da ADR-0004, e ela vale também no teste.
  vi.stubEnv("SUPABASE_URL", "http://provedor.test");
  vi.stubEnv("SUPABASE_CHAVE_ANONIMA", "chave-publicavel-de-teste");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// ---------------------------------------------------------------------------

describe("entrar — a doutrina do não-confirmar (critério 3)", () => {
  it("e-mail inexistente e senha errada produzem a MESMA recusa", async () => {
    // O provedor devolve o mesmo código nos dois casos, e o ACL não o desdobra. Distinguir transformaria
    // T-01 num verificador de quem tem conta no produto.
    signInWithPassword.mockResolvedValue({
      error: { code: "invalid_credentials", message: "Invalid login credentials" },
    });

    const credenciais = criarCredenciais(cookiesVazios);
    const naoExiste = await credenciais.entrar("ninguem@exemplo.test", "seja-o-que-for");
    const senhaErrada = await credenciais.entrar("helena@exemplo.test", "errada");

    expect(naoExiste).toStrictEqual({ ok: false, recusa: "CREDENCIAL_INVALIDA" });
    expect(senhaErrada).toStrictEqual(naoExiste);
  });

  it("reconhece a credencial inválida pela mensagem quando o provedor não manda código", async () => {
    signInWithPassword.mockResolvedValue({
      error: { code: undefined, message: "Invalid login credentials" },
    });

    const resultado = await criarCredenciais(cookiesVazios).entrar("helena@exemplo.test", "errada");

    expect(resultado).toStrictEqual({ ok: false, recusa: "CREDENCIAL_INVALIDA" });
  });

  it("falha que o ACL não reconhece vira FALHA_DO_PROVEDOR, nunca credencial inválida", async () => {
    // Traduzir o desconhecido como "senha errada" faria a tela mandar a pessoa corrigir o que estava certo.
    signInWithPassword.mockResolvedValue({
      error: { code: "over_request_rate_limit", message: "Request rate limit reached" },
    });

    const resultado = await criarCredenciais(cookiesVazios).entrar("helena@exemplo.test", "segredo");

    expect(resultado).toStrictEqual({ ok: false, recusa: "FALHA_DO_PROVEDOR" });
  });

  it("credencial aceita não devolve token, sessão nem objeto do provedor — só ok", async () => {
    // Contrato §4.1: *o domínio nunca vê token*. É o que faz o ACL ser ACL.
    signInWithPassword.mockResolvedValue({ error: null });

    const resultado = await criarCredenciais(cookiesVazios).entrar("helena@exemplo.test", "segredo");

    expect(resultado).toStrictEqual({ ok: true });
  });
});

describe("criarConta — onde a doutrina do não-confirmar cede (critério 4)", () => {
  it("e-mail já cadastrado vira CONTA_JA_EXISTE", async () => {
    signUp.mockResolvedValue({
      data: { session: null, user: null },
      error: { code: "user_already_exists", message: "User already registered" },
    });

    const resultado = await criarCredenciais(cookiesVazios).criarConta(
      "Helena Rocha",
      "helena@exemplo.test",
      "segredo",
    );

    expect(resultado).toStrictEqual({ ok: false, recusa: "CONTA_JA_EXISTE" });
  });

  it("reconhece o e-mail repetido pela mensagem quando não vem código", async () => {
    signUp.mockResolvedValue({
      data: { session: null, user: null },
      error: { code: undefined, message: "User already registered" },
    });

    const resultado = await criarCredenciais(cookiesVazios).criarConta(
      "Helena Rocha",
      "helena@exemplo.test",
      "segredo",
    );

    expect(resultado).toStrictEqual({ ok: false, recusa: "CONTA_JA_EXISTE" });
  });

  it("senha curta vira SENHA_RECUSADA_PELO_PROVEDOR — a regra de força é dele", async () => {
    signUp.mockResolvedValue({
      data: { session: null, user: null },
      error: { code: "weak_password", message: "Password should be at least 6 characters" },
    });

    const resultado = await criarCredenciais(cookiesVazios).criarConta(
      "Helena Rocha",
      "helena@exemplo.test",
      "curta",
    );

    expect(resultado).toStrictEqual({ ok: false, recusa: "SENHA_RECUSADA_PELO_PROVEDOR" });
  });
});

describe("criarConta — o nome no metadado (critério 2)", () => {
  it("manda o nome em options.data.nome, e é de lá que o ACL semeia pessoas.nome", async () => {
    signUp.mockResolvedValue({
      data: { session: { access_token: "fingido" }, user: { id: "usuario-novo" } },
      error: null,
    });

    await criarCredenciais(cookiesVazios).criarConta(
      "Helena Rocha",
      "helena@exemplo.test",
      "segredo",
    );

    expect(signUp).toHaveBeenCalledWith({
      email: "helena@exemplo.test",
      password: "segredo",
      options: { data: { nome: "Helena Rocha" } },
    });
  });

  it("com sessão na resposta, não pede confirmação — é a Q-T9 fechada em 22/08/2026", async () => {
    signUp.mockResolvedValue({
      data: { session: { access_token: "fingido" }, user: { id: "usuario-novo" } },
      error: null,
    });

    const resultado = await criarCredenciais(cookiesVazios).criarConta(
      "Helena Rocha",
      "helena@exemplo.test",
      "segredo",
    );

    expect(resultado).toStrictEqual({ ok: true, precisaConfirmarEmail: false });
  });
});
