import type { TipoDeAnexo } from "@/dominio/anexo";

/**
 * O que a reivindicação apurou sobre o objeto, e é o que o agregado recebe.
 *
 * **`tipoConteudo` e `tamanhoBytes` vêm do `HEAD`, não do que o cliente declarou** — critério 13b.1. O
 * `tipo` é derivado pelo servidor a partir do `tipoConteudo` que ele **autorizou**, e é o que mantém o
 * enum `tipo_anexo` fora de todo schema de entrada.
 */
export type DadosDeAnexo = {
  tipo: TipoDeAnexo;
  /** A chave **opaca** do objeto (modelo §2.8). Nunca uma URL, e nunca sai em payload. */
  chave: string;
  /** A prévia, quando ela existe **e** foi confirmada. `null` é caso normal. */
  thumbnailChave: string | null;
  nomeArquivo: string | null;
  titulo: string | null;
  tipoConteudo: string;
  tamanhoBytes: number;
  anexadoPorPessoaId: string;
  /** ISO 8601 — o mesmo instante do registro. O agregado não lê relógio. */
  anexadoEm: string;
};

/**
 * ============================================================================
 *  `AnexoDaOcorrencia` — objeto de valor **dentro** do limite do agregado
 * ============================================================================
 *
 * **A `Ocorrência` continua a raiz; `anexos` é filha dentro do mesmo limite** (modelo §7.8). Ele chega a
 * `Ocorrencia.registrar` como a trilha já chega, e o repositório o **transcreve** — não há
 * `repos.anexos.gravar(...)`, e não pode haver: seriam duas transações, a invariante 2 cairia, e o anexo
 * passaria a ser escrito por fora do agregado, que é o que a ADR-0001 recusa em uma frase.
 *
 * **`TipoDeAnexo` é importado, não repetido.** `TipoDeAreaCongelado` é repetido em `Ocorrencia.ts` porque
 * *aquilo* é cópia congelada — registro histórico deliberadamente desacoplado do tipo vivo da Área. Aqui
 * não há congelamento nenhum: é o mesmo conceito, e `TIPOS_DE_ANEXO` foi desenhado para crescer. Repetir
 * a união criaria a divergência que o `Record` de `TipoDeConteudo.ts` existe para impedir.
 */
export class AnexoDaOcorrencia {
  private constructor(
    readonly tipo: TipoDeAnexo,
    readonly chave: string,
    readonly thumbnailChave: string | null,
    readonly nomeArquivo: string | null,
    readonly titulo: string | null,
    readonly tipoConteudo: string,
    readonly tamanhoBytes: number,
    readonly anexadoPorPessoaId: string,
    readonly anexadoEm: string,
  ) {
    Object.freeze(this);
  }

  /** O único construtor: o anexo nasce **reivindicado**, nunca pendente (contrato §10.2). */
  static reivindicado(dados: DadosDeAnexo): AnexoDaOcorrencia {
    return new AnexoDaOcorrencia(
      dados.tipo,
      dados.chave,
      dados.thumbnailChave,
      dados.nomeArquivo,
      dados.titulo,
      dados.tipoConteudo,
      dados.tamanhoBytes,
      dados.anexadoPorPessoaId,
      dados.anexadoEm,
    );
  }
}
