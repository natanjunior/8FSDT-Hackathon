/**
 * A porta do provedor de credencial.
 *
 * `Criar conta` e `Autenticar-se` (S1, S2) **não são endpoints deste contrato** (contrato §4.1): são o
 * subdomínio **Genérico** comprado no Supabase Auth, integrado como **Conformista + ACL**. Esta porta é o
 * ACL: ela expõe as três operações em vocabulário nosso e traduz a falha do provedor em recusa nomeada.
 *
 * **O domínio nunca vê token.** Nada aqui devolve sessão, JWT ou claim — só sucesso ou uma recusa nomeada.
 */

export type ResultadoDeCredencial =
  | { readonly ok: true }
  /** A conta foi criada e o provedor exige confirmação por e-mail antes do primeiro login. */
  | { readonly ok: true; readonly precisaConfirmarEmail: boolean }
  | { readonly ok: false; readonly recusa: RecusaDeCredencial };

/**
 * As recusas possíveis.
 *
 * > **Achado.** O catálogo de códigos do contrato (§6.4) **não tem código para falha de credencial**, e
 * > está certo: autenticação não é endpoint do contrato. Mas as telas T-01 e T-11 precisam de um, então
 * > este conjunto é nosso e fica declarado aqui. Não vaza para `problem+json`: as telas de credencial não
 * > passam pelo `openapi.yaml`.
 */
export type RecusaDeCredencial =
  /** T-01: **não distingue** e-mail inexistente de senha errada, senão o login vira um verificador de contas. */
  | "CREDENCIAL_INVALIDA"
  /** T-11: aqui a doutrina do não-confirmar **cede** — negar produz alguém preso tentando criar o que já existe. */
  | "CONTA_JA_EXISTE"
  | "SENHA_RECUSADA_PELO_PROVEDOR"
  /**
   * **DORMENTE.** Com a Q-T9 fechada em 22/08/2026 — confirmação de e-mail **não** obrigatória —, o
   * provedor nunca recusa uma entrada por conta não confirmada. Fica pelo dia em que o interruptor virar.
   */
  | "EMAIL_NAO_CONFIRMADO"
  /** T-01, estado 6: o link do e-mail venceu ou já foi usado. */
  | "LINK_INVALIDO_OU_EXPIRADO"
  /**
   * T-12: o provedor recusou o envio por limite — por endereço (`over_email_send_rate_limit`) ou por IP
   * (`over_request_rate_limit`). É o único erro desta tela que a pessoa conserta esperando.
   */
  | "LIMITE_DE_ENVIOS"
  /**
   * T-13: a senha nova é igual à atual. **Não é regra de força**, e por isso não pode cair em
   * `SENHA_RECUSADA_PELO_PROVEDOR`: *"escolha uma senha mais longa"* mandaria consertar o que está certo.
   */
  | "SENHA_IGUAL_A_ANTERIOR"
  | "FALHA_DO_PROVEDOR";

export interface PortaDeCredenciais {
  entrar(email: string, senha: string): Promise<ResultadoDeCredencial>;

  /**
   * @param nome  **obrigatório** — é o metadado de onde o ACL semeia `pessoas.nome` (contrato §4.1). É o
   *              conserto do F6: o metadado passa a existir porque nós o escrevemos.
   * @param destino  para onde o link do e-mail de confirmação deve apontar — **item 6c, critério 1**.
   *
   * **Vem pronto, e esta porta não o monta.** Descobrir onde a aplicação está publicada é ler a
   * requisição, e **ler a URL é traduzir HTTP**: é a camada de Interface quem o faz — a mesma forma de
   * `confirmarPorCodigo` e de `iniciarRedefinicao`, logo abaixo.
   *
   * **É obrigatório de propósito.** Sem ele o provedor manda o link para a *Site URL* **crua** — a raiz,
   * que não troca código por sessão —, e foi o defeito de 31/08/2026 (`/?code=…` em vez de
   * `/confirmar-conta?code=…`). Opcional, o compilador deixaria de acusar quem esquecesse: é justamente
   * a cegueira que este item existe para tirar.
   *
   * **Quatro parâmetros é o limite desta porta. O quinto vira objeto** — o gatilho fica escrito aqui para
   * que a decisão não se perca.
   */
  criarConta(
    nome: string,
    email: string,
    senha: string,
    destino: string,
  ): Promise<ResultadoDeCredencial>;

  /**
   * **DORMENTE** — em regime nenhum e-mail de confirmação é enviado (Q-T9, 22/08/2026), e o que a mantém
   * assim é **só o interruptor *Confirm email* do painel**, não a ausência de destino: desde o item 6c o
   * `signUp` manda o link para a rota que esta operação serve.
   *
   * Troca o código que o link de confirmação de e-mail carrega por uma sessão.
   *
   * É o que faz **os estados 5 e 6 de T-01** existirem — *"Conta confirmada. Entre para continuar."* e
   * *"Este link expirou."* (protótipo, T-01). Sem isso, o link do e-mail não tem onde aterrissar, e o
   * inventário registra esse buraco como o erro que partiu T-01 em quatro telas.
   */
  confirmarPorCodigo(codigo: string): Promise<ResultadoDeCredencial>;

  /**
   * T-12 · pede o e-mail com o link de redefinição.
   *
   * **Nunca informa se a conta existe** — nem por resultado, nem por recusa: conta inexistente devolve
   * `{ ok: true }`, igual a conta existente. É a doutrina do não-confirmar do contrato §6.3 aplicada à
   * credencial, e é o critério 1 do item 6b.
   */
  pedirRedefinicaoDeSenha(email: string): Promise<ResultadoDeCredencial>;

  /**
   * A aterrissagem do link de T-13: troca o `token_hash` do e-mail por sessão de recuperação.
   *
   * **Recebe o token porque ler a URL é traduzir HTTP**, e é a camada de Interface quem o faz — a mesma
   * forma de `confirmarPorCodigo`. Deste passo em diante nenhum token atravessa a fronteira.
   */
  iniciarRedefinicao(tokenHash: string): Promise<ResultadoDeCredencial>;

  /**
   * T-13 · grava a senha nova e encerra a sessão de recuperação.
   *
   * **Não recebe token:** a sessão já está no armazenamento de cookies que a Interface entregou ao montar
   * a porta. É o que mantém verdadeira a frase do contrato §4.1 — *o domínio nunca vê token*.
   */
  definirSenha(senhaNova: string): Promise<ResultadoDeCredencial>;

  sair(): Promise<void>;
}
