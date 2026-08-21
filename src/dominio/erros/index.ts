/**
 * Erros nomeados, com código estável.
 *
 * O `codigo` é o contrato de verdade (contrato-de-api.md §6.1): estável, em SCREAMING_SNAKE_CASE, e é o
 * que o cliente compara. `titulo` e `detalhe` são texto para gente e podem mudar sem aviso.
 *
 * **Não há status HTTP aqui, e é de propósito.** O Domínio não conhece HTTP (arquitetura.md, Parte I §5).
 * O de-para código → status vive em `src/interface/http/problema.ts`, que é a camada a quem a tabela de
 * camadas permite traduzir HTTP.
 */

/** Um erro de domínio: uma recusa nomeada, com código estável e texto em pt-BR. */
export class ErroDeDominio extends Error {
  constructor(
    readonly codigo: string,
    readonly titulo: string,
    readonly detalhe: string,
    /** Extensões do corpo de erro — `statusAtual`, `acoesDisponiveis`, `organizacaoAtiva`… (§6.1). */
    readonly extensoes: Readonly<Record<string, unknown>> = {},
  ) {
    super(`${codigo}: ${detalhe}`);
    this.name = new.target.name;
  }
}

/** `403 PERMISSAO_INSUFICIENTE` — o papel não tem a permissão exigida pelo endpoint (§6.4). */
export class PermissaoInsuficiente extends ErroDeDominio {
  constructor(permissaoExigida: string) {
    super(
      "PERMISSAO_INSUFICIENTE",
      "Permissão insuficiente",
      "O seu papel nesta organização não permite esta ação.",
      { permissaoExigida },
    );
  }
}
