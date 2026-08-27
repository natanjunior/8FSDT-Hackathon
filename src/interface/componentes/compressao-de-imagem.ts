/**
 * ============================================================================
 *  A compressão, no aparelho — RNF8
 * ============================================================================
 *
 * *"Imagem comprimida no próprio aparelho para ~400 KB, aceite de até 10 MB no seletor."* A API **não pode
 * forçar** a compressão — só recusar o que não couber. Quem comprime é isto.
 *
 * **A saída é sempre JPEG, e essa única decisão resolve quatro problemas.** O que sobe é a saída do canvas,
 * nunca o arquivo escolhido:
 *
 *  · **HEIC do iPhone** — se o navegador não decodificar, a mensagem é de decodificação, não um erro do
 *    storage no meio do upload;
 *  · **PNG de captura de tela** — vira JPEG. `image/png` continua no enum do contrato, e este cliente
 *    nunca o envia;
 *  · **EXIF, e o GPS dentro dele** — a re-codificação descarta os metadados. É ganho de privacidade de
 *    graça, da mesma família do PA-05;
 *  · **orientação** — resolvida na decodificação, antes de desenhar.
 *
 * **A escada é curta de propósito.** Cada codificação custa segundos num aparelho médio, e o orçamento do
 * RNF6 fecha em 53 s de 60. Quatro tentativas no pior caso; se a quarta ainda estourar, não há foto.
 *
 * **O teto vem do schema de entrada, e não é repetido aqui.** `TETO_DE_BYTES_DO_ANEXO` é onde o contrato
 * o declara; duas constantes de 524288 divergiriam no dia em que uma delas mudasse.
 */
import { TETO_DE_BYTES_DO_ANEXO } from "@/interface/schemas";

/** O que o seletor aceita antes de decodificar qualquer coisa (RNF8). */
export const LIMITE_DO_SELETOR_EM_BYTES = 10 * 1024 * 1024;

/** ~200 px e ~15 KB, do mesmo passe de canvas. É conveniência de listagem, não evidência. */
const LADO_DA_MINIATURA = 200;
const QUALIDADE_DA_MINIATURA = 0.7;

export type Tentativa = { lado: number; qualidade: number };

/**
 * Qualidade primeiro, tamanho depois — nesta ordem porque perder nitidez de compressão é menos visível,
 * numa foto de ocorrência, que perder resolução.
 */
export const TENTATIVAS: readonly Tentativa[] = [
  { lado: 1600, qualidade: 0.8 },
  { lado: 1600, qualidade: 0.6 },
  { lado: 1600, qualidade: 0.45 },
  { lado: 1200, qualidade: 0.6 },
];

/** O maior lado vai para `lado`, a proporção se mantém, e **nunca amplia**. */
export function dimensoes(
  larguraOriginal: number,
  alturaOriginal: number,
  lado: number,
): { largura: number; altura: number } {
  const maior = Math.max(larguraOriginal, alturaOriginal);
  if (maior <= lado) return { largura: larguraOriginal, altura: alturaOriginal };

  const fator = lado / maior;
  return {
    largura: Math.round(larguraOriginal * fator),
    altura: Math.round(alturaOriginal * fator),
  };
}

export type Comprimida = {
  arquivo: Blob;
  /** `null` quando o navegador não codifica WebP — caso normal, e sem mensagem (critério 13a.5). */
  miniatura: Blob | null;
};

export class ImagemIlegivel extends Error {
  constructor() {
    super("Não foi possível ler esta imagem.");
    this.name = "ImagemIlegivel";
  }
}

export class ImagemGrandeDemais extends Error {
  constructor() {
    super("A foto ficou grande demais depois da compressão.");
    this.name = "ImagemGrandeDemais";
  }
}

async function desenhar(bitmap: ImageBitmap, lado: number): Promise<HTMLCanvasElement> {
  const { largura, altura } = dimensoes(bitmap.width, bitmap.height, lado);

  const tela = document.createElement("canvas");
  tela.width = largura;
  tela.height = altura;

  const pincel = tela.getContext("2d");
  if (pincel === null) throw new ImagemIlegivel();

  pincel.drawImage(bitmap, 0, 0, largura, altura);
  return tela;
}

function codificar(tela: HTMLCanvasElement, tipo: string, qualidade: number): Promise<Blob | null> {
  return new Promise((resolver) => tela.toBlob(resolver, tipo, qualidade));
}

/**
 * Comprime o arquivo escolhido e, quando o navegador deixa, gera a miniatura no mesmo passe.
 *
 * @throws ImagemIlegivel quando o navegador não decodifica o arquivo (HEIC em navegador antigo, arquivo
 *         corrompido, arquivo que não é imagem).
 * @throws ImagemGrandeDemais quando a escada inteira termina acima do teto.
 */
export async function comprimir(arquivo: File): Promise<Comprimida> {
  let bitmap: ImageBitmap;
  try {
    // `imageOrientation: "from-image"` é o que resolve a foto deitada antes de desenhar.
    bitmap = await createImageBitmap(arquivo, { imageOrientation: "from-image" });
  } catch {
    throw new ImagemIlegivel();
  }

  try {
    for (const tentativa of TENTATIVAS) {
      const tela = await desenhar(bitmap, tentativa.lado);
      const saida = await codificar(tela, "image/jpeg", tentativa.qualidade);

      if (saida !== null && saida.size <= TETO_DE_BYTES_DO_ANEXO) {
        const telaPequena = await desenhar(bitmap, LADO_DA_MINIATURA);
        const miniatura = await codificar(telaPequena, "image/webp", QUALIDADE_DA_MINIATURA);

        return {
          arquivo: saida,
          // Navegador sem WebP devolve PNG com o `type` trocado. Sem miniatura é caso normal e previsto.
          miniatura: miniatura !== null && miniatura.type === "image/webp" ? miniatura : null,
        };
      }
    }

    throw new ImagemGrandeDemais();
  } finally {
    bitmap.close();
  }
}
