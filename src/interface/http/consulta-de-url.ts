import {
  LIMITE_MAXIMO,
  type CursorDeListagem,
  type VarianteDoAnexo,
} from "@/aplicacao/ocorrencia";
import { ehSituacaoDoPedido, type SituacaoDoPedido } from "@/dominio/organizacao";
import { decodificarCursor } from "@/interface/projecoes";

import { FormatoInvalido } from "./problema";

/**
 * Lê um parâmetro booleano da *query string* — `undefined` quando ausente.
 *
 * **Traduzir HTTP é a única coisa que esta camada faz** (arquitetura.md §5), e "ausente" é diferente de
 * `false`: quem decide o que acontece quando ninguém pede nada é a camada de Aplicação, que é onde o
 * padrão *"só as ativas"* mora.
 *
 * Valor fora de `true`/`false` é **recusado**, e não tratado como `false`: `?ativa=sim` respondendo a
 * lista das ativas seria o cliente pedindo uma coisa e recebendo outra, em silêncio.
 */
export function lerBooleanoDaUrl(requisicao: Request, nome: string): boolean | undefined {
  const bruto = new URL(requisicao.url).searchParams.get(nome);
  if (bruto === null || bruto === "") return undefined;
  if (bruto === "true") return true;
  if (bruto === "false") return false;

  throw new FormatoInvalido([
    { campo: nome, codigo: "VALOR_INVALIDO", mensagem: 'Use "true" ou "false".' },
  ]);
}

/**
 * Lê o parâmetro `situacao` de `GET /pedidos-de-entrada` — `undefined` quando ausente.
 *
 * O contrato o declara como `style: form, explode: false`, ou seja **lista separada por vírgula**, com
 * `default: [pendente]`. O padrão **não** é aplicado aqui: quem sabe o que acontece quando ninguém pede
 * nada é a Aplicação (`listarPedidosDeEntrada`), pela mesma razão do `?ativa=`.
 *
 * Valor fora das três situações é **recusado**, não ignorado: `?situacao=todos` devolvendo os pendentes
 * seria o cliente pedindo uma coisa e recebendo outra, em silêncio.
 */
export function lerSituacoesDaUrl(requisicao: Request): readonly SituacaoDoPedido[] | undefined {
  const bruto = new URL(requisicao.url).searchParams.get("situacao");
  if (bruto === null || bruto === "") return undefined;

  const pedidas = bruto.split(",").map((valor) => valor.trim());
  const invalida = pedidas.find((valor) => !ehSituacaoDoPedido(valor));
  if (invalida !== undefined) {
    throw new FormatoInvalido([
      {
        campo: "situacao",
        codigo: "VALOR_INVALIDO",
        mensagem: 'Use "pendente", "aprovado" ou "recusado", separados por vírgula.',
      },
    ]);
  }

  return pedidas as readonly SituacaoDoPedido[];
}

/**
 * Lê `?limite=` — `undefined` quando ausente.
 *
 * **O padrão de 20 não mora aqui**, pela mesma razão do `?ativa=` e do `?situacao=` acima: *"quem decide
 * o que acontece quando ninguém pede nada é a camada de Aplicação"*. Aqui só se traduz e se recusa.
 *
 * **A faixa é a do contrato** (`openapi.yaml`, parâmetro `Limite`: `minimum: 1, maximum: 100`). Valor
 * fora dela é `400` — e não um valor "ajustado" em silêncio, que devolveria uma página de tamanho
 * diferente do pedido sem dizer nada.
 */
export function lerLimiteDaUrl(requisicao: Request): number | undefined {
  const bruto = new URL(requisicao.url).searchParams.get("limite");
  if (bruto === null || bruto === "") return undefined;

  const numero = Number(bruto);
  // `Number("20.5")` é 20.5 e `Number("1e2")` é 100 — os dois passam num `Number.isFinite`, e nenhum é
  // o que a pessoa escreveu. `/^\d+$/` é o que separa "o inteiro 20" de "algo que vira 20".
  if (!/^\d+$/u.test(bruto) || !Number.isInteger(numero) || numero < 1 || numero > LIMITE_MAXIMO) {
    throw new FormatoInvalido([
      { campo: "limite", codigo: "VALOR_INVALIDO", mensagem: "Use um inteiro de 1 a 100." },
    ]);
  }

  return numero;
}

/**
 * Lê `?cursor=` — `null` quando ausente.
 *
 * **Cursor ilegível é `400`, nunca a primeira página.** Responder o começo da lista a quem pediu a
 * terceira página é o cliente pedindo uma coisa e recebendo outra em silêncio — e num *"Carregar mais"*
 * isso vira a lista repetindo os mesmos vinte itens para sempre, sem nenhum sinal de erro.
 */
export function lerCursorDaUrl(requisicao: Request): CursorDeListagem | null {
  const bruto = new URL(requisicao.url).searchParams.get("cursor");
  if (bruto === null || bruto === "") return null;

  const cursor = decodificarCursor(bruto);
  if (cursor === null) {
    throw new FormatoInvalido([
      {
        campo: "cursor",
        codigo: "VALOR_INVALIDO",
        mensagem: "Cursor inválido — use o proximoCursor devolvido pela página anterior.",
      },
    ]);
  }

  return cursor;
}

/**
 * Lê `?variante=` de `GET /ocorrencias/{id}/anexos/{anexoId}` — ausente é o objeto principal.
 *
 * **Valor fora da lista é recusado, não tratado como ausente**, pela mesma razão do `?ativa=` e do
 * `?situacao=`: `?variante=xpto` devolvendo a foto em tamanho real seria o cliente pedindo uma coisa e
 * recebendo outra, em silêncio. O `openapi.yaml` declara `enum: [miniatura]`, e esta é a recusa que o faz
 * verdadeiro.
 */
export function lerVarianteDaUrl(requisicao: Request): VarianteDoAnexo {
  const bruto = new URL(requisicao.url).searchParams.get("variante");
  if (bruto === null || bruto === "") return "original";
  if (bruto === "miniatura") return "miniatura";

  throw new FormatoInvalido([
    { campo: "variante", codigo: "VALOR_INVALIDO", mensagem: 'O único valor aceito é "miniatura".' },
  ]);
}
