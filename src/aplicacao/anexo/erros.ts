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

/**
 * `422 ANEXO_NAO_RECONHECIDO` — **a recusa de cinco das seis conferências**.
 *
 * Assinatura inválida, portador diferente, ticket expirado, `chave` que não é a do ticket, objeto ausente
 * no storage, objeto **sem** a etiqueta `estado` ou com valor desconhecido, e tipo real diferente do
 * autorizado. **Uma resposta só para todas**, e é a §6.3 do contrato: separar os casos diria a quem
 * tentou exatamente onde ele errou.
 */
export class AnexoNaoReconhecido extends ErroDeDominio {
  constructor() {
    super(
      "ANEXO_NAO_RECONHECIDO",
      "Anexo não reconhecido",
      "A autorização expirou ou o arquivo não chegou ao storage.",
    );
  }
}

/**
 * `422 ANEXO_ACIMA_DO_LIMITE` — o objeto real é maior que o tamanho que a autorização carimbou.
 *
 * **O teto comparado é o do ticket, não os 512 KB.** Quem declara 100 KB e sobe 400 KB quebrou a promessa
 * que a autorização assinou; e o endpoint de autorização já recusou acima de 512 KB, então
 * `tamanhoMaximo ≤ 512 KB` está garantido pela própria assinatura.
 */
export class AnexoAcimaDoLimite extends ErroDeDominio {
  constructor() {
    super(
      "ANEXO_ACIMA_DO_LIMITE",
      "Anexo acima do limite",
      "O arquivo enviado é maior do que o tamanho autorizado.",
    );
  }
}

/**
 * `404 ANEXO_NAO_ENCONTRADO` — **três causas, uma resposta** (contrato §6.4): o anexo não existe, não é
 * desta ocorrência, ou existe e **não tem miniatura** quando se pediu `?variante=miniatura`.
 */
export class AnexoNaoEncontrado extends ErroDeDominio {
  constructor() {
    super("ANEXO_NAO_ENCONTRADO", "Anexo não encontrado", "Este anexo não existe nesta ocorrência.");
  }
}
