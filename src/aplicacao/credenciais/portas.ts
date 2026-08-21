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
  | "EMAIL_NAO_CONFIRMADO"
  /** T-01, estado 6: o link do e-mail venceu ou já foi usado. */
  | "LINK_INVALIDO_OU_EXPIRADO"
  | "FALHA_DO_PROVEDOR";

export interface PortaDeCredenciais {
  entrar(email: string, senha: string): Promise<ResultadoDeCredencial>;

  /**
   * @param nome  **obrigatório** — é o metadado de onde o ACL semeia `pessoas.nome` (contrato §4.1). É o
   *              conserto do F6: o metadado passa a existir porque nós o escrevemos.
   */
  criarConta(nome: string, email: string, senha: string): Promise<ResultadoDeCredencial>;

  /**
   * Troca o código que o link de confirmação de e-mail carrega por uma sessão.
   *
   * É o que faz **os estados 5 e 6 de T-01** existirem — *"Conta confirmada. Entre para continuar."* e
   * *"Este link expirou."* (protótipo, T-01). Sem isso, o link do e-mail não tem onde aterrissar, e o
   * inventário registra esse buraco como o erro que partiu T-01 em quatro telas.
   */
  confirmarPorCodigo(codigo: string): Promise<ResultadoDeCredencial>;

  sair(): Promise<void>;
}
