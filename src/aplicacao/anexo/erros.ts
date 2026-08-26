import { ErroDeDominio } from "@/dominio/erros";

/**
 * `429 LIMITE_DE_AUTORIZACOES_DE_UPLOAD` — **o único limite de chamadas do contrato** (§10.3).
 *
 * Existe porque este é o único endpoint que permite a uma pessoa autenticada consumir armazenamento
 * externo **sem criar registro de domínio nenhum**; todos os outros criam linha em tabela e já esbarram
 * nas regras do próprio domínio.
 *
 * **`segundosAteLiberar` não vai para o corpo.** Ele entra em `extensoes` porque é onde um erro carrega
 * dado, e a camada de Interface o converte no cabeçalho `Retry-After` — que é o que o `openapi.yaml`
 * declara nesta resposta. O Domínio continua sem conhecer HTTP (arquitetura.md, Parte I §5).
 */
export class LimiteDeAutorizacoesDeUpload extends ErroDeDominio {
  constructor(segundosAteLiberar: number) {
    super(
      "LIMITE_DE_AUTORIZACOES_DE_UPLOAD",
      "Muitos envios em pouco tempo",
      "Aguarde alguns minutos para enviar outra imagem.",
      { segundosAteLiberar },
    );
  }
}
