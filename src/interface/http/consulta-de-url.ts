import { z } from "zod";

import {
  LIMITE_MAXIMO,
  PAGINA_MAXIMA,
  type CursorDeConversa,
  type FiltroDeOcorrencias,
  type VarianteDoAnexo,
} from "@/aplicacao/ocorrencia";
import { ehPrioridade, ehStatusOcorrencia } from "@/dominio/ocorrencia";
import { ehSituacaoDoPedido, type SituacaoDoPedido } from "@/dominio/organizacao";
import { decodificarCursorDeConversa } from "@/interface/projecoes";

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
 * ============================================================================
 *  Os três parâmetros de paginação de `GET /ocorrencias` — item 14b
 * ============================================================================
 *
 * **Assina sobre `URLSearchParams` e não sobre `Request`**, pela mesma razão de
 * `lerFiltroDeOcorrenciasDaUrl`: tem dois chamadores de formas diferentes — o `route.ts` tem a requisição,
 * e T-03 tem os `searchParams` do App Router. Uma função só é o que faz a tela **validar antes de
 * consultar**, em vez de descobrir o parâmetro inválido por um `400` que ela mesma provocou.
 *
 * **Campo ausente é `undefined`, e os padrões NÃO moram aqui** — é a disciplina do arquivo inteiro:
 * *"quem decide o que acontece quando ninguém pede nada é a camada de Aplicação"*. Esta camada traduz e
 * recusa. É por isso que `ate` ausente não vira *"agora"* aqui: quem lê o relógio é `listarOcorrencias`,
 * e uma segunda leitura produziria dois cortes na mesma requisição.
 *
 * **`ate` ilegível é `400`, nunca "agora"** — é a regra que o `lerCursorDaUrl` aplicava e que morre com
 * ele: responder outra coisa em silêncio é o cliente pedir uma página e receber outra.
 *
 * **`ate` no futuro é LIMITADO a agora, e não recusado.** Relógio de celular adiantado por segundos é
 * rotina, e recusar quebraria o produto em aparelho torto. Limitar é seguro: o corte só pode estreitar.
 *
 * **`totalNoCorte` é dica, não autoridade** (§7.7 do contrato). Ele vem do cliente e precisa ser
 * inofensivo em qualquer valor: alto demais limita o deslocamento em zero e repete a página 1; baixo
 * demais desliga a compensação e devolve o deslocamento cru. **Nenhum valor produz salto além do que o
 * deslocamento cru já produziria** — e é isso que o torna aceitável como parâmetro público. O que se
 * recusa aqui é só o que não é um inteiro não negativo.
 *
 * **Os três NÃO entram em `FiltroDeOcorrencias`** — critério `14b.9`. Eles são paginação, não recorte:
 * quem lê o filtro de um endereço recebe só o recorte, e a página e o corte ficam com quem pagina. Até o
 * item 44g era isso que fazia a saída de T-05 devolver a lista filtrada na página 1, com corte novo; a
 * saída deixou de existir no conteúdo pelo critério 44g.10.
 *
 * **E `ate` aqui NÃO é o `ate` de `GET /dashboard`.** Lá é um **dia** (`AAAA-MM-DD`) que delimita a
 * janela do indicador; aqui é um **instante** ISO 8601 com fuso. Mesma palavra, dois endpoints, duas
 * gramáticas — registrado na §7.7 do contrato em vez de renomeado, porque o critério 14b.2 nomeia este
 * parâmetro.
 */
export type PaginacaoDaUrl = { pagina?: number; ate?: string; totalNoCorte?: number };

/** Um instante ISO 8601 **com fuso** — a §7.5 do contrato. `2026-09-09` sozinho seria meia-noite de qual
 *  lugar? */
const COM_FUSO = /[Zz]$|[+-]\d{2}:?\d{2}$/u;

export function lerPaginacaoDaUrl(parametros: URLSearchParams): PaginacaoDaUrl {
  const pagina = lerInteiroDaUrl(
    parametros,
    "pagina",
    1,
    PAGINA_MAXIMA,
    `Use um inteiro de 1 a ${String(PAGINA_MAXIMA)}.`,
  );
  const totalNoCorte = lerInteiroDaUrl(
    parametros,
    "totalNoCorte",
    0,
    Number.MAX_SAFE_INTEGER,
    "Use o total devolvido pela primeira página.",
  );

  const bruto = lerUnico(parametros, "ate");
  let ate: string | undefined;
  if (bruto !== undefined) {
    const instante = Date.parse(bruto);
    // **A ida e volta é o que separa uma data de algo que o `Date` aceita por acidente** — é a mesma
    // guarda de `lerDia`, mais acima neste arquivo.
    if (Number.isNaN(instante) || !COM_FUSO.test(bruto)) {
      throw new FormatoInvalido([
        {
          campo: "ate",
          codigo: "VALOR_INVALIDO",
          mensagem: "Use um instante ISO 8601 com fuso — o `ate` devolvido pela primeira página.",
        },
      ]);
    }
    ate = new Date(Math.min(instante, Date.now())).toISOString();
  }

  // Campo ausente é "decida por mim" — por isso o espalhamento condicional, e não `pagina: undefined`.
  return {
    ...(pagina === undefined ? {} : { pagina }),
    ...(ate === undefined ? {} : { ate }),
    ...(totalNoCorte === undefined ? {} : { totalNoCorte }),
  };
}

/**
 * Um inteiro de faixa, recusado em voz alta. Extraído porque `pagina` e `totalNoCorte` o querem igual.
 *
 * **`lerLimiteDaUrl` continua com o corpo próprio, e não passa por aqui:** ele assina sobre `Request`, a
 * faixa dele vem do contrato por outro caminho (`LIMITE_MAXIMO`) e a mensagem de recusa é dele. Unificar
 * os dois mudaria a mensagem de erro de um endpoint estável, e é refatoração de outro dia.
 */
function lerInteiroDaUrl(
  parametros: URLSearchParams,
  nome: string,
  minimo: number,
  maximo: number,
  mensagem: string,
): number | undefined {
  const bruto = lerUnico(parametros, nome);
  if (bruto === undefined) return undefined;

  const numero = Number(bruto);
  // `Number("2.5")` é 2.5 e `Number("1e2")` é 100 — os dois passam num `Number.isFinite`, e nenhum é o
  // que a pessoa escreveu. `/^\d+$/` é o que separa "o inteiro 2" de "algo que vira 2".
  if (!/^\d+$/u.test(bruto) || !Number.isInteger(numero) || numero < minimo || numero > maximo) {
    throw new FormatoInvalido([{ campo: nome, codigo: "VALOR_INVALIDO", mensagem }]);
  }

  return numero;
}

/**
 * Lê `?cursor=` da conversa — `null` quando ausente.
 *
 * **A recusa é a mesma que a listagem aplicava até o item 14b:** *"cursor ilegível é `400`, nunca a primeira
 * página"* — porque num *Carregar mais* isso vira a lista repetindo os mesmos vinte itens para sempre,
 * sem nenhum sinal de erro.
 *
 * **Duas funções e não um parâmetro**, pela mesma razão pela qual os cursores são dois tipos: o que volta
 * daqui é `CursorDeConversa`, e um parâmetro de *"qual formato"* faria o tipo de retorno depender de um
 * booleano.
 */
export function lerCursorDeConversaDaUrl(requisicao: Request): CursorDeConversa | null {
  const bruto = new URL(requisicao.url).searchParams.get("cursor");
  if (bruto === null || bruto === "") return null;

  const cursor = decodificarCursorDeConversa(bruto);
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

/** `z.uuid()`, e não expressão regular à mão: é a mesma forma dos schemas (`schemas/ocorrencia.ts`). */
const identificador = z.uuid();

function ehIdentificador(valor: unknown): valor is string {
  return identificador.safeParse(valor).success;
}

/**
 * Lê **um** valor de um parâmetro — e recusa o parâmetro repetido.
 *
 * **Por que recusar em vez de juntar.** O contrato declara os três filtros como `style: form,
 * explode: false` (`openapi.yaml`): a lista viaja **num parâmetro só, separada por vírgula**. Aceitar
 * também `?status=a&status=b` seria sustentar em silêncio uma segunda gramática que nenhuma tela produz e
 * que o contrato não descreve — e o dia em que as duas divergirem, ninguém sabe qual está certa.
 */
function lerUnico(parametros: URLSearchParams, nome: string): string | undefined {
  const todos = parametros.getAll(nome);
  if (todos.length > 1) {
    throw new FormatoInvalido([
      {
        campo: nome,
        codigo: "VALOR_INVALIDO",
        mensagem: "Envie os valores separados por vírgula, num parâmetro só.",
      },
    ]);
  }

  const bruto = todos[0];
  return bruto === undefined || bruto === "" ? undefined : bruto;
}

/**
 * Lê uma lista separada por vírgula — `undefined` quando ausente, exceção quando algum valor não serve.
 *
 * **Recusado, nunca ignorado**, pela razão que já está escrita no topo deste arquivo: descartar o valor
 * inválido devolveria um conjunto que o cliente não pediu, em silêncio.
 */
function lerLista<V extends string>(
  parametros: URLSearchParams,
  nome: string,
  eh: (valor: unknown) => valor is V,
  mensagem: string,
): readonly V[] | undefined {
  const bruto = lerUnico(parametros, nome);
  if (bruto === undefined) return undefined;

  const pedidos = bruto.split(",").map((valor) => valor.trim());
  if (!pedidos.every(eh)) {
    throw new FormatoInvalido([{ campo: nome, codigo: "VALOR_INVALIDO", mensagem }]);
  }

  return pedidos;
}

/**
 * Os quatro parâmetros de `GET /ocorrencias` — o **item 15**.
 *
 * **Assina sobre `URLSearchParams`, e não sobre `Request`, porque tem dois chamadores de formas
 * diferentes:** o `route.ts` tem a requisição, e a página tem os `searchParams` do App Router. Uma função
 * só é o que faz a página **validar antes de consultar** em vez de descobrir o filtro inválido por um
 * `400` que ela mesma provocou.
 *
 * **`categoriaId` inexistente não é erro aqui nem adiante:** é filtro que não casa com nada, e devolve
 * lista vazia. Um `422` diria a quem perguntasse se aquele identificador é categoria de **alguma**
 * organização, que é informação que o produto não dá.
 */
export function lerFiltroDeOcorrenciasDaUrl(parametros: URLSearchParams): FiltroDeOcorrencias {
  const status = lerLista(
    parametros,
    "status",
    ehStatusOcorrencia,
    'Use "aberta", "em_analise", "em_atendimento", "pausada", "resolvida" ou "cancelada", separados por vírgula.',
  );
  const categoriaId = lerLista(
    parametros,
    "categoriaId",
    ehIdentificador,
    "Use identificadores de categoria separados por vírgula.",
  );
  const prioridade = lerLista(
    parametros,
    "prioridade",
    ehPrioridade,
    'Use "baixa", "normal" ou "alta", separados por vírgula.',
  );

  const autor = lerUnico(parametros, "autor");
  if (autor !== undefined && autor !== "eu") {
    throw new FormatoInvalido([
      { campo: "autor", codigo: "VALOR_INVALIDO", mensagem: 'O único valor é "eu".' },
    ]);
  }

  // Campo ausente é "não filtre por esta dimensão" — por isso o espalhamento condicional em vez de
  // `status: undefined`, que faria `toStrictEqual({})` falhar e, pior, esconderia a diferença.
  return {
    ...(status === undefined ? {} : { status }),
    ...(categoriaId === undefined ? {} : { categoriaId }),
    ...(prioridade === undefined ? {} : { prioridade }),
    ...(autor === undefined ? {} : { apenasDoAutor: true }),
  };
}

/**
 * Se **algum** dos quatro está aplicado.
 *
 * É o segundo argumento do `vazioDaLista` que o item 14 declarou — e é o que faz o terceiro vazio ganhar
 * da visibilidade: quem chega por URL filtrada e recebe zero lê *"Nenhuma ocorrência com estes filtros."*,
 * **mesmo sem barra na tela**.
 */
export function algumFiltroAplicado(filtro: FiltroDeOcorrencias): boolean {
  return (
    filtro.status !== undefined ||
    filtro.categoriaId !== undefined ||
    filtro.prioridade !== undefined ||
    filtro.apenasDoAutor === true
  );
}

/**
 * Os `searchParams` do App Router virando `URLSearchParams`.
 *
 * **Preserva repetições de propósito:** `Record<string, string | string[]>` é como o Next entrega
 * `?status=a&status=b`, e é justamente o caso que `lerUnico` precisa enxergar para recusar. Achatar aqui
 * apagaria a evidência antes de a regra agir.
 */
export function consultaDe(
  parametros: Record<string, string | string[] | undefined>,
): URLSearchParams {
  const consulta = new URLSearchParams();
  for (const [nome, valor] of Object.entries(parametros)) {
    if (valor === undefined) continue;
    if (Array.isArray(valor)) for (const um of valor) consulta.append(nome, um);
    else consulta.append(nome, valor);
  }
  return consulta;
}

/**
 * ============================================================================
 *  Os dois parâmetros de `GET /dashboard` — e as três recusas
 * ============================================================================
 *
 * **Assina sobre `URLSearchParams` e não sobre `Request`**, pela mesma razão de
 * `lerFiltroDeOcorrenciasDaUrl`: tem dois chamadores de formas diferentes — o `route.ts` tem a requisição,
 * e a página tem os `searchParams` do App Router. Uma função só é o que faz a tela **validar antes de
 * consultar**, em vez de descobrir o período inválido por um `400` que ela mesma provocou.
 *
 * **Campo ausente é `undefined`, e o padrão de 90 dias NÃO mora aqui** — é a mesma disciplina do
 * `?limite=` e do `?situacao=`: *"quem decide o que acontece quando ninguém pede nada é a camada de
 * Aplicação"*. Esta camada traduz e recusa.
 *
 * **Três recusas, e as três são `400 FORMATO_INVALIDO`** — que é a resposta que o `openapi.yaml:2160` já
 * declara para este caminho:
 *
 * 1. **fora de formato** — `?de=01/06/2026`;
 * 2. **dia que não existe** — `?ate=2026-02-30`. Sem o teste de ida e volta, o `Date` do JavaScript o
 *    aceitaria como 2 de março, e a janela seria outra sem ninguém saber;
 * 3. **janela invertida** — `de > ate`. Uma janela que termina antes de começar não é uma janela, e
 *    devolver zeros diria *"não há dado"* onde o certo é *"a consulta não correu"* — a confusão que o item
 *    14 já nomeou (classe do achado R-15).
 *
 * A tela troca antes de chegar aqui (`trocarJanelaInvertida`, item 69); a recusa é o que a API responde.
 */
const DIA_ISO = /^\d{4}-\d{2}-\d{2}$/u;

/** A data existe e está em `AAAA-MM-DD`? A ida e volta separa `2026-02-30` de uma data. */
function ehDia(bruto: string): boolean {
  // **A ida e volta é o que separa `2026-02-30` de uma data**: o `Date` a aceita e devolve `2026-03-02`,
  // e comparar o resultado com o que se escreveu é o que revela a troca.
  const instante = new Date(`${bruto}T00:00:00Z`);
  return (
    DIA_ISO.test(bruto) &&
    !Number.isNaN(instante.getTime()) &&
    instante.toISOString().slice(0, 10) === bruto
  );
}

function lerDia(parametros: URLSearchParams, nome: "de" | "ate"): string | undefined {
  const bruto = lerUnico(parametros, nome);
  if (bruto === undefined) return undefined;

  if (!ehDia(bruto)) {
    throw new FormatoInvalido([
      { campo: nome, codigo: "VALOR_INVALIDO", mensagem: "Use uma data no formato AAAA-MM-DD." },
    ]);
  }

  return bruto;
}

export function lerJanelaDoDashboardDaUrl(parametros: URLSearchParams): {
  de?: string;
  ate?: string;
} {
  const de = lerDia(parametros, "de");
  const ate = lerDia(parametros, "ate");

  // Comparação de texto, e ela é correta: `YYYY-MM-DD` ordena como data porque é de comprimento fixo e do
  // mais significativo para o menos.
  if (de !== undefined && ate !== undefined && de > ate) {
    throw new FormatoInvalido([
      {
        campo: "de",
        codigo: "VALOR_INVALIDO",
        mensagem: "O início do período não pode ser depois do fim.",
      },
    ]);
  }

  // Campo ausente é "decida por mim" — por isso o espalhamento condicional, e não `de: undefined`.
  return { ...(de === undefined ? {} : { de }), ...(ate === undefined ? {} : { ate }) };
}

/**
 * **A troca da janela invertida é gesto da tela, e não do contrato** (item 69, `respostas.md` P1).
 *
 * Quem escolhe datas no calendário do sistema e erra a ordem quer o painel, não a página de erro — e na
 * tela a troca não é silenciosa, porque T-07 escreve o aviso. Para um cliente HTTP, `de > ate` continua
 * sendo defeito dele, e `lerJanelaDoDashboardDaUrl` continua o recusando: por isso a troca é uma função
 * à parte, chamada só pela página, **antes** da leitura.
 *
 * **Só troca o que a leitura aceitaria na outra ordem**: um `de` e um `ate`, os dois datas que existem.
 * Parâmetro repetido e data mal formada passam intactos e caem na recusa de sempre.
 */
export function trocarJanelaInvertida(parametros: URLSearchParams): {
  consulta: URLSearchParams;
  trocada: boolean;
} {
  const de = parametros.getAll("de");
  const ate = parametros.getAll("ate");
  const [umDe] = de;
  const [umAte] = ate;

  if (de.length !== 1 || ate.length !== 1 || umDe === undefined || umAte === undefined) {
    return { consulta: parametros, trocada: false };
  }
  if (!ehDia(umDe) || !ehDia(umAte) || umDe <= umAte) {
    return { consulta: parametros, trocada: false };
  }

  const consulta = new URLSearchParams(parametros);
  consulta.set("de", umAte);
  consulta.set("ate", umDe);
  return { consulta, trocada: true };
}
