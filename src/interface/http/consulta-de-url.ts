import { ehSituacaoDoPedido, type SituacaoDoPedido } from "@/dominio/organizacao";

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
