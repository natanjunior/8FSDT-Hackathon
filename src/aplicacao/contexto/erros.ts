import { ErroDeDominio } from "@/dominio/erros";

/**
 * As recusas da resolução de contexto.
 *
 * Estendem `ErroDeDominio` porque o que a base carrega é o **código estável** do contrato (§6.4) — não
 * conhecimento de HTTP. O de-para código → status vive na camada de Interface.
 *
 * > **Achado registrado.** O catálogo da §6.4 mistura, num espaço de códigos só, recusa de domínio
 * > (`TRANSICAO_NAO_PERMITIDA`), de aplicação (`SEM_ORGANIZACAO_ATIVA`) e de transporte
 * > (`NAO_AUTENTICADO`, `CORPO_NAO_SUPORTADO`), e **nenhum documento diz de qual camada cada um é**. A
 * > divisão adotada aqui: o tipo-base e as recusas de domínio ficam em `dominio/erros/`; as da sessão
 * > ficam nesta camada, que é quem as produz; as de transporte nascem em `interface/http/`.
 */

/** `401 NAO_AUTENTICADO` — sessão ausente, inválida ou expirada. */
export class NaoAutenticado extends ErroDeDominio {
  constructor() {
    super("NAO_AUTENTICADO", "Não autenticado", "Sua sessão terminou. Recarregue a página e entre de novo.");
  }
}

/** `403 SEM_ORGANIZACAO_ATIVA` — autenticado, sem organização escolhida na sessão. */
export class SemOrganizacaoAtiva extends ErroDeDominio {
  constructor() {
    super(
      "SEM_ORGANIZACAO_ATIVA",
      "Sem organização ativa",
      "Escolha uma organização para continuar.",
    );
  }
}

/**
 * `403 SEM_VINCULO_NA_ORGANIZACAO` — não há vínculo **ativo** da Pessoa na organização pedida.
 *
 * A resposta é **idêntica** para organização inexistente e para organização real onde a Pessoa não tem
 * vínculo (contrato §4.3), para não confirmar existência.
 */
export class SemVinculoNaOrganizacao extends ErroDeDominio {
  constructor() {
    super(
      "SEM_VINCULO_NA_ORGANIZACAO",
      "Sem vínculo nesta organização",
      "Você não tem vínculo ativo nesta organização.",
    );
  }
}
