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

const { signInWithPassword, signUp, resetPasswordForEmail, verifyOtp, updateUser, signOut } = vi.hoisted(
  () => ({
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
    resetPasswordForEmail: vi.fn(),
    verifyOtp: vi.fn(),
    updateUser: vi.fn(),
    signOut: vi.fn(),
  }),
);

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: { signInWithPassword, signUp, resetPasswordForEmail, verifyOtp, updateUser, signOut },
  }),
}));

// `vi.mock` é içado acima deste `import` pelo próprio Vitest — por isso o módulo real nunca é carregado,
// mesmo com importação estática.
import { criarCredenciais } from "@/infraestrutura/clientes";

/** O armazenamento que a camada de Interface entrega. Aqui não há requisição, então não há cookie. */
const cookiesVazios = { todos: () => [], definir: () => {} };

beforeEach(() => {
  vi.clearAllMocks();
  // `definirSenha` encerra a sessão de recuperação ao terminar; sem isto o duplo devolveria `undefined`.
  signOut.mockResolvedValue({ error: null });
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

describe("pedirRedefinicaoDeSenha — a doutrina do não-confirmar (critério 1)", () => {
  it("conta que existe e conta que não existe produzem o MESMO resultado", async () => {
    const credenciais = criarCredenciais(cookiesVazios);

    resetPasswordForEmail.mockResolvedValue({ error: null });
    const existe = await credenciais.pedirRedefinicaoDeSenha("helena@exemplo.test");

    // O provedor hoje não distingue os dois casos. "Hoje não distingue" é fato sobre uma dependência; o
    // critério 1 é requisito nosso, e é isto que o torna garantia em vez de sorte.
    resetPasswordForEmail.mockResolvedValue({
      error: { code: "user_not_found", message: "User not found" },
    });
    const naoExiste = await credenciais.pedirRedefinicaoDeSenha("ninguem@exemplo.test");

    expect(existe).toStrictEqual({ ok: true });
    expect(naoExiste).toStrictEqual(existe);
  });

  it("limite por endereço e limite por IP viram a MESMA recusa", async () => {
    const credenciais = criarCredenciais(cookiesVazios);

    resetPasswordForEmail.mockResolvedValue({
      error: { code: "over_email_send_rate_limit", message: "Email rate limit exceeded" },
    });
    const porEndereco = await credenciais.pedirRedefinicaoDeSenha("helena@exemplo.test");

    resetPasswordForEmail.mockResolvedValue({
      error: { code: "over_request_rate_limit", message: "Request rate limit reached" },
    });
    const porIp = await credenciais.pedirRedefinicaoDeSenha("helena@exemplo.test");

    expect(porEndereco).toStrictEqual({ ok: false, recusa: "LIMITE_DE_ENVIOS" });
    expect(porIp).toStrictEqual(porEndereco);
  });

  it("falha que o ACL não reconhece NÃO vira sucesso — a tela não pode dizer que enviou", async () => {
    resetPasswordForEmail.mockResolvedValue({
      error: { code: "unexpected_failure", message: "Internal error" },
    });

    const resultado = await criarCredenciais(cookiesVazios).pedirRedefinicaoDeSenha(
      "helena@exemplo.test",
    );

    expect(resultado).toStrictEqual({ ok: false, recusa: "FALHA_DO_PROVEDOR" });
  });
});

describe("pedirRedefinicaoDeSenha — o pedido não carrega destino (item 6d)", () => {
  it("chama o provedor com o e-mail e MAIS NADA — é isso que faz o link valer em outro aparelho", async () => {
    // **A ausência do segundo argumento é a garantia, e é por isso que ela tem teste.**
    //
    // `redirectTo` alimentaria `{{ .ConfirmationURL }}`, que o nosso template NÃO usa: ele monta o
    // endereço com `{{ .SiteURL }}` e `{{ .TokenHash }}` (`supabase/templates/recuperacao.html:6`),
    // apontando direto para `/redefinir-senha/link`. O token viaja no e-mail e é trocado por
    // `verifyOtp` **no servidor** — sem verificador PKCE, sem cookie do navegador que pediu. É o
    // contrário exato do `criarConta`, que desde o 6c passa `emailRedirectTo` e por isso só funciona
    // na mesma janela.
    //
    // **Sem esta afirmação, a decisão vivia só num comentário** (`autenticacao.ts:145-148`), e
    // comentário não reprova esteira. Um segundo argumento aqui quebra este teste, de propósito.
    resetPasswordForEmail.mockResolvedValue({ error: null });

    await criarCredenciais(cookiesVazios).pedirRedefinicaoDeSenha("helena@exemplo.test");

    // **A aridade vem primeiro de propósito.** No Vitest, o primeiro `expect` que falha aborta o `it` —
    // então a ordem das duas linhas decide qual mensagem a esteira mostra. A aridade é a coisa sob teste,
    // e `to have a length of 1 but got 2` diz o defeito; a outra ordem diria só "não foi chamado assim".
    expect(resetPasswordForEmail.mock.calls[0]).toHaveLength(1);
    expect(resetPasswordForEmail).toHaveBeenCalledWith("helena@exemplo.test");
  });
});

describe("iniciarRedefinicao — a aterrissagem do link (critério 3)", () => {
  it("troca o token como recovery, e não como confirmação de conta", async () => {
    verifyOtp.mockResolvedValue({ error: null });

    const resultado = await criarCredenciais(cookiesVazios).iniciarRedefinicao("token-do-email");

    expect(verifyOtp).toHaveBeenCalledWith({ token_hash: "token-do-email", type: "recovery" });
    expect(resultado).toStrictEqual({ ok: true });
  });

  it("token vencido vira LINK_INVALIDO_OU_EXPIRADO", async () => {
    verifyOtp.mockResolvedValue({ error: { code: "otp_expired", message: "Token has expired" } });

    const resultado = await criarCredenciais(cookiesVazios).iniciarRedefinicao("token-velho");

    expect(resultado).toStrictEqual({ ok: false, recusa: "LINK_INVALIDO_OU_EXPIRADO" });
  });
});

describe("definirSenha — a senha nova, e o que acontece depois", () => {
  it("grava a senha e encerra SÓ esta sessão", async () => {
    updateUser.mockResolvedValue({ error: null });

    const resultado = await criarCredenciais(cookiesVazios).definirSenha("senha-nova-boa");

    expect(updateUser).toHaveBeenCalledWith({ password: "senha-nova-boa" });
    // `scope: "global"` derrubaria as outras sessões da pessoa — inclusive a normal de quem trocou a
    // senha estando dentro do produto (spec, D-6b-5), que não foi o que se pediu.
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(resultado).toStrictEqual({ ok: true });
  });

  it("senha igual à anterior NÃO vira 'escolha uma senha mais longa'", async () => {
    // A mensagem do provedor traz a palavra `password`, e a regra de força a apanharia se viesse antes.
    updateUser.mockResolvedValue({
      error: {
        code: "same_password",
        message: "New password should be different from the old password.",
      },
    });

    const resultado = await criarCredenciais(cookiesVazios).definirSenha("a-mesma-de-antes");

    expect(resultado).toStrictEqual({ ok: false, recusa: "SENHA_IGUAL_A_ANTERIOR" });
  });

  it("senha curta vira SENHA_RECUSADA_PELO_PROVEDOR — a regra de força continua sendo dele", async () => {
    updateUser.mockResolvedValue({
      error: { code: "weak_password", message: "Password should be at least 6 characters" },
    });

    const resultado = await criarCredenciais(cookiesVazios).definirSenha("curta");

    expect(resultado).toStrictEqual({ ok: false, recusa: "SENHA_RECUSADA_PELO_PROVEDOR" });
  });

  it("sessão de recuperação perdida vira LINK_INVALIDO_OU_EXPIRADO, não falha genérica", async () => {
    updateUser.mockResolvedValue({
      error: { code: "session_not_found", message: "Session from session_id claim does not exist" },
    });

    const resultado = await criarCredenciais(cookiesVazios).definirSenha("senha-nova-boa");

    expect(resultado).toStrictEqual({ ok: false, recusa: "LINK_INVALIDO_OU_EXPIRADO" });
  });

  it("senha recusada não encerra sessão nenhuma — quem falhou continua podendo tentar", async () => {
    updateUser.mockResolvedValue({ error: { code: "weak_password", message: "Password is too weak" } });

    await criarCredenciais(cookiesVazios).definirSenha("curta");

    expect(signOut).not.toHaveBeenCalled();
  });
});
