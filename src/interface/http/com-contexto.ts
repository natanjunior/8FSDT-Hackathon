import { cookies, headers } from "next/headers";
import { cache } from "react";
import type { ZodType } from "zod";

import {
  contextoDaRequisicao,
  NaoAutenticado,
  resolverContexto,
  SemOrganizacaoAtiva,
  type ContextoDaRequisicao,
  type ContextoDaSessao,
  type EscolhaDaSessao,
  type PortasGlobais,
  type RepositoriosEscopados,
  type ResolucaoDeContexto,
} from "@/aplicacao/contexto";
import {
  CodigoPublicoNaoEncontrado,
  lerConvite,
  type QuemAbreOConvite,
  type RepositorioDeConvites,
} from "@/aplicacao/organizacao";
import {
  montarPortaDeConvites,
  montarPortasEscopadas,
  montarPortasGlobais,
  type ArmazenamentoDeCookies,
} from "@/composicao";
import { PermissaoInsuficiente } from "@/dominio/erros";
import { FORMATO_DO_CODIGO, type Permissao } from "@/dominio/organizacao";
import { projetarConvite, type ConviteProjetado } from "@/interface/projecoes";

import {
  assinarOrganizacao,
  lerOrganizacaoAssinada,
  NOME_DO_COOKIE,
} from "./cookie-de-organizacao";
import {
  comOrganizacaoAtiva,
  CorpoNaoSuportado,
  FormatoInvalido,
  OrganizacaoDivergente,
  respostaDeProblema,
  type ErroDeCampo,
} from "./problema";
import { novoTraceId } from "./traco";

/**
 * ============================================================================
 *  `comContexto` — o ajudante do anel externo
 * ============================================================================
 *
 * A ADR-0005 diz que *"um só ajudante no anel externo evita que isso vire 37 fiações à mão"*, e deixou a
 * forma para o primeiro dia. Esta é a forma.
 *
 * **O que ele faz, em ordem, para toda requisição:**
 *
 * 1. Resolve a sessão e monta o contexto — chamando a camada de **Aplicação**, que é quem pode consultar
 *    `vinculos` (ADR-0003, correção de 20/08/2026).
 * 2. Grava o cookie quando o servidor escolheu a organização sozinho (contrato §4.3).
 * 3. Exige organização ativa, ou `403 SEM_ORGANIZACAO_ATIVA`.
 * 4. Confere `X-Organizacao-Id` como **afirmação**, e recusa com `409 ORGANIZACAO_DIVERGENTE` (§4.3).
 * 5. Confere a permissão com `vinculo.pode(...)`, nunca com o papel (§4.5).
 * 6. **Monta o repositório escopado e o passa** para a função de aplicação (ADR-0005).
 * 7. Valida a forma do corpo contra o schema, e traduz em `400` com `erros[]` (§6.2).
 * 8. Traduz toda recusa nomeada em `application/problem+json` (§6).
 *
 * **Por que o handler não consegue esquecer.** Não é convenção: é o que ele **não alcança**. `app/` não
 * pode importar `infraestrutura/` nem `composicao/` — regras 2 e 2b da ADR-0006, conferidas por
 * `eslint.config.mjs`. Então um `route.ts` que não passe por aqui não tem função de consulta, não tem porta
 * e não tem cliente: não tem como falar com o banco.
 *
 * **`semOrganizacao` é a lista fechada da ADR-0003 virada mecanismo.** Exatamente cinco operações rodam
 * sem escopo (contrato §4.4), e o lint só permite importar `semOrganizacao` nos cinco `route.ts` daquela
 * lista. Um quinto endpoint não é caso a resolver no código: é emenda à ADR.
 */

// ---------------------------------------------------------------------------
// O que o handler devolve
// ---------------------------------------------------------------------------

const MARCA_DE_RESPOSTA = Symbol("resposta-do-manipulador");

type RespostaDoManipulador = {
  readonly [MARCA_DE_RESPOSTA]: true;
  readonly corpo: unknown;
  readonly status: number;
  readonly cabecalhos: Readonly<Record<string, string>>;
};

/**
 * Para quando o handler precisa de status ou cabeçalho próprios — `201` com `Location`, por exemplo.
 * Sem isso, o que o handler devolve **é** o corpo, com `200`.
 */
export function resposta(
  corpo: unknown,
  opcoes: { status?: number; cabecalhos?: Record<string, string> } = {},
): RespostaDoManipulador {
  return {
    [MARCA_DE_RESPOSTA]: true,
    corpo,
    status: opcoes.status ?? 200,
    cabecalhos: opcoes.cabecalhos ?? {},
  };
}

function ehResposta(valor: unknown): valor is RespostaDoManipulador {
  return typeof valor === "object" && valor !== null && MARCA_DE_RESPOSTA in valor;
}

// ---------------------------------------------------------------------------
// As duas entradas
// ---------------------------------------------------------------------------

/** O que os 36 endpoints escopados recebem. */
export type EntradaEscopada<C> = {
  /** `{ usuarioId, pessoaId, nome, vinculo }` — e `vinculo.pode(x)` é a única pergunta de autorização. */
  ctx: ContextoDaRequisicao;
  /** Já escopados. É o argumento que a ADR-0005 acrescentou a toda função de aplicação. */
  repos: RepositoriosEscopados;
  corpo: C;
  parametros: Readonly<Record<string, string>>;
  requisicao: Request;
};

/** O que as **quatro** operações da §4.4 recebem. */
export type EntradaSemOrganizacao<C> = {
  /** Sem `vinculo`: quem chega aqui pode não ter nenhum. */
  ctx: ContextoDaSessao;
  /** A resolução inteira — é ela que `GET /contexto` projeta, sem refazer consulta nenhuma. */
  resolucao: ResolucaoDeContexto;
  /** O nome grita que **não** é escopado. Só as cinco operações da lista fechada o recebem. */
  portasGlobais: PortasGlobais;
  corpo: C;
  parametros: Readonly<Record<string, string>>;
  requisicao: Request;
  /**
   * Torna uma organização a ativa da sessão, gravando o cookie assinado na **própria resposta**
   * (contrato §4.3).
   *
   * **Está aqui, e não no handler, porque a assinatura é mecânica de sessão.** Um `route.ts` que montasse
   * o cookie seria a segunda cópia da regra do §4.3 — e é sempre a segunda cópia que diverge. Duas
   * operações precisam disto: `POST /organizacoes`, que a cria, e `PUT /contexto/organizacao`, que a
   * troca.
   */
  definirOrganizacaoAtiva: (organizacaoId: string) => void;
};

type Manipulador<E> = (entrada: E) => unknown | Promise<unknown>;

type ContextoDaRota = { params?: Promise<Record<string, string | string[] | undefined>> };
type RotaDoNext = (requisicao: Request, contexto?: ContextoDaRota) => Promise<Response>;

type OpcoesEscopadas<C> = {
  /**
   * A permissão que este endpoint exige (contrato §4.5). **Obrigatória e sem padrão**: um endpoint sem
   * autorização declarada não compila, que é o oposto de um endpoint sem autorização por esquecimento.
   * `"qualquer-vinculo-ativo"` é o valor para os dois casos em que o contrato diz literalmente isso
   * (`GET /categorias`, `GET /areas`).
   */
  exige: Permissao | "qualquer-vinculo-ativo";
  corpo?: ZodType<C>;
  /**
   * **Opt-in por endpoint:** corpo com zero byte vira `{}` e o schema roda sobre ele, em vez de `415`.
   *
   * Existe para os endpoints que declaram `requestBody: required: false` no `openapi.yaml` — hoje
   * `/analisar` e `POST /pedidos-de-entrada/{id}/recusar`. **Corpo presente continua sendo conferido**:
   * tipo não-JSON é `415`, JSON inválido é `400`. Ver `lerCorpoOpcional`.
   */
  corpoOpcional?: boolean;
  /**
   * Um passo de recusa que roda **sobre o corpo cru, antes do `schema`**.
   *
   * Existe porque `400 FORMATO_INVALIDO` e `422 CAMPO_NAO_SUPORTADO` respondem a perguntas diferentes
   * (§6.2): o primeiro é *"você escreveu errado"*, o segundo é *"o produto não faz isso"*. Um schema
   * Zod não distingue os dois — ele descarta o campo desconhecido de graça, e quem chamou fica
   * convencido de ter definido o status da própria ocorrência.
   *
   * Deve lançar um `ErroDeDominio`; a tradução para `problem+json` é a de sempre.
   */
  recusar?: (corpo: unknown) => void;
};

type OpcoesSemOrganizacao<C> = { corpo?: ZodType<C> };

// ---------------------------------------------------------------------------
// comContexto — os 36
// ---------------------------------------------------------------------------

export function comContexto<C = undefined>(
  opcoes: OpcoesEscopadas<C>,
  manipulador: Manipulador<EntradaEscopada<C>>,
): RotaDoNext {
  return async (requisicao, contextoDaRota) => {
    const traceId = novoTraceId();

    /**
     * **Fora do `try` porque quem precisa dela é o `catch`.** `resolucao` é `const` dentro do bloco e o
     * `catch` não a enxerga; esta é a única variável que atravessa a fronteira, e ela atravessa com o
     * mínimo — id e nome, que é o par que o `openapi.yaml` publica.
     *
     * **Fica `null` de propósito** quando o erro acontece antes da resolução — `NaoAutenticado`,
     * `SemOrganizacaoAtiva` —, e aí não há nome que dizer.
     */
    let organizacaoAtiva: { id: string; nome: string } | null = null;

    try {
      const { resolucao } = await abrirRequisicao();

      if (resolucao.ativo === null) throw new SemOrganizacaoAtiva();
      organizacaoAtiva = {
        id: resolucao.ativo.organizacao.id,
        nome: resolucao.ativo.organizacao.nome,
      };

      await conferirAfirmacaoDeOrganizacao(resolucao.ativo.organizacao.id);

      const ctx = contextoDaRequisicao(resolucao, resolucao.ativo);
      if (opcoes.exige !== "qualquer-vinculo-ativo" && !ctx.vinculo.pode(opcoes.exige)) {
        throw new PermissaoInsuficiente(opcoes.exige);
      }

      // A montagem é do anel externo, e a Aplicação recebe (ADR-0005). As portas globais NÃO entram na
      // entrada escopada: quem tem escopo não tem como alcançar o que atravessa organizações.
      const repos = montarPortasEscopadas(ctx.vinculo.organizacaoId);

      const resultado = await manipulador({
        ctx,
        repos,
        corpo: await lerCorpo(requisicao, opcoes.corpo, opcoes.recusar, opcoes.corpoOpcional === true),
        parametros: await lerParametros(contextoDaRota),
        requisicao,
      });

      return montarResposta(resultado);
    } catch (erro) {
      return registrarEResponder(erro, requisicao, traceId, organizacaoAtiva);
    }
  };
}

// ---------------------------------------------------------------------------
// semOrganizacao — os cinco da lista fechada (contrato §4.4)
// ---------------------------------------------------------------------------

export function semOrganizacao<C = undefined>(
  manipulador: Manipulador<EntradaSemOrganizacao<C>>,
): RotaDoNext;
export function semOrganizacao<C>(
  opcoes: OpcoesSemOrganizacao<C>,
  manipulador: Manipulador<EntradaSemOrganizacao<C>>,
): RotaDoNext;
export function semOrganizacao<C>(
  a: OpcoesSemOrganizacao<C> | Manipulador<EntradaSemOrganizacao<C>>,
  b?: Manipulador<EntradaSemOrganizacao<C>>,
): RotaDoNext {
  const opcoes: OpcoesSemOrganizacao<C> = typeof a === "function" ? {} : a;
  const manipulador = typeof a === "function" ? a : (b as Manipulador<EntradaSemOrganizacao<C>>);

  return async (requisicao, contextoDaRota) => {
    const traceId = novoTraceId();
    try {
      const { resolucao, portas, armazenamento } = await abrirRequisicao();

      const resultado = await manipulador({
        ctx: resolucao.sessao,
        resolucao,
        portasGlobais: portas,
        corpo: await lerCorpo(requisicao, opcoes.corpo),
        parametros: await lerParametros(contextoDaRota),
        requisicao,
        definirOrganizacaoAtiva: (organizacaoId) => {
          const { valor, opcoes: doCookie } = assinarOrganizacao(
            organizacaoId,
            resolucao.sessao.usuarioId,
          );
          armazenamento.definir([{ name: NOME_DO_COOKIE, value: valor, options: doCookie }]);
        },
      });

      return montarResposta(resultado);
    } catch (erro) {
      // **As cinco operações da §4.4 rodam antes de existir organização ativa**, então não há nome que
      // pôr no corpo. O `null` é escrito, e não herdado de um valor padrão: quem lê o `catch` vê a razão.
      return registrarEResponder(erro, requisicao, traceId, null);
    }
  };
}

// ---------------------------------------------------------------------------
// As etapas, uma a uma
// ---------------------------------------------------------------------------

/**
 * A etapa comum às duas portas: montar as portas globais, resolver o contexto e gravar o cookie quando o
 * servidor escolheu sozinho.
 *
 * **É aqui que os dois caminhos convergem**, e é por isso que não há duas resoluções a manter em
 * sincronia. O que a §4.4 enumera é o que acontece *depois* desta linha, não uma segunda máquina.
 *
 * **A resolução é memoizada por renderização**, e isto passou a importar quando a casca do item 44b
 * nasceu: layout e página resolvem contexto cada um, e sem o `cache` seriam duas leituras de cookie e
 * duas resoluções por navegação, em treze rotas.
 *
 * O alcance do `cache` do React é a passagem de renderização — requisições diferentes não se enxergam.
 * **A escrita de cookie da §4.3 continua correta:** ela passa a acontecer uma vez em vez de duas, que é o
 * que já se pretendia.
 */
const abrirRequisicao = cache(async function abrirRequisicao(): Promise<{
  resolucao: ResolucaoDeContexto;
  portas: PortasGlobais;
  armazenamento: Awaited<ReturnType<typeof armazenamentoDeCookies>>;
}> {
  const armazenamento = await armazenamentoDeCookies();
  const portas = montarPortasGlobais(armazenamento, await tokenPortador());

  const escolha: EscolhaDaSessao = {
    organizacaoEscolhida: (usuarioId) =>
      lerOrganizacaoAssinada(armazenamento.ler(NOME_DO_COOKIE), usuarioId),
  };

  const resolucao = await resolverContexto(portas, escolha);

  // Contrato §4.3: com exatamente um vínculo ativo, o servidor escolhe e grava o cookie **na própria
  // resposta**. Sem isso, todo login de todo usuário custaria um `PUT` antes de qualquer tela — uma
  // segunda espera cobrada de graça, sob a escala a zero do RNF5.
  if (resolucao.escolhidaAutomaticamente && resolucao.ativo !== null) {
    const { valor, opcoes } = assinarOrganizacao(
      resolucao.ativo.organizacao.id,
      resolucao.sessao.usuarioId,
    );
    armazenamento.definir([{ name: NOME_DO_COOKIE, value: valor, options: opcoes }]);
  }

  return { resolucao, portas, armazenamento };
});

// ---------------------------------------------------------------------------
// semSessao — a primeira operação sem sessão (item 86, ADR-0018)
// ---------------------------------------------------------------------------

/**
 * O que `GET /convites/{codigo}` recebe.
 *
 * **`resolucao` é `null` sem sessão, e nunca lança `NaoAutenticado`.** Com sessão, é a mesma resolução
 * das outras portas, e é dela que sai `quem`, sem consulta nenhuma. **Não há portas globais nem
 * escopadas aqui**: quem roda sem sessão recebe o convite e mais nada.
 */
export type EntradaSemSessao = {
  resolucao: ResolucaoDeContexto | null;
  quem: QuemAbreOConvite | null;
  convites: RepositorioDeConvites;
  parametros: Readonly<Record<string, string>>;
  requisicao: Request;
};

/**
 * **A quarta lista fechada** (`eslint.config.mjs`, `SEM_SESSAO`): só a rota e a página do convite a
 * importam. Um segundo endpoint sem sessão é ADR nova, e não uma linha de código.
 */
export function semSessao(manipulador: Manipulador<EntradaSemSessao>): RotaDoNext {
  return async (requisicao, contextoDaRota) => {
    const traceId = novoTraceId();
    try {
      const resolucao = await resolverSeHouverSessao();
      const resultado = await manipulador({
        resolucao,
        quem: quemAbre(resolucao),
        convites: montarPortaDeConvites(),
        parametros: await lerParametros(contextoDaRota),
        requisicao,
      });
      return montarResposta(resultado);
    } catch (erro) {
      // Sem sessão não há organização ativa a pôr no corpo; com sessão, esta operação também não é
      // escopada. O `null` é escrito pelo mesmo motivo do `semOrganizacao`.
      return registrarEResponder(erro, requisicao, traceId, null);
    }
  };
}

/**
 * A **estrada direta** de `GET /convites/{codigo}`, para `app/convite/[codigo]/page.tsx`: mesma
 * resolução, mesma consulta e mesma projeção, sem salto HTTP.
 *
 * **Normaliza o que veio digitado** (maiúscula, sem espaço nas pontas), como as oito casas de T-02
 * fazem, porque o endereço pode ter sido digitado à mão. **Formato inválido e código inexistente dão o
 * mesmo `convite: null`**: a tela não distingue um do outro (critério 86.3).
 */
export async function resolverConviteParaTela(
  codigoBruto: string,
): Promise<{ resolucao: ResolucaoDeContexto | null; convite: ConviteProjetado | null }> {
  const resolucao = await resolverSeHouverSessao();
  const codigo = decodificar(codigoBruto).trim().toUpperCase();
  if (!FORMATO_DO_CODIGO.test(codigo)) return { resolucao, convite: null };

  try {
    const lido = await lerConvite({ convites: montarPortaDeConvites() }, quemAbre(resolucao), codigo);
    return { resolucao, convite: projetarConvite(lido) };
  } catch (erro) {
    if (erro instanceof CodigoPublicoNaoEncontrado) return { resolucao, convite: null };
    throw erro;
  }
}

/** `%` solto no endereço faz `decodeURIComponent` lançar; o cru serve, e o formato o recusa em seguida. */
function decodificar(valor: string): string {
  try {
    return decodeURIComponent(valor);
  } catch {
    return valor;
  }
}

async function resolverSeHouverSessao(): Promise<ResolucaoDeContexto | null> {
  try {
    const { resolucao } = await abrirRequisicao();
    return resolucao;
  } catch (erro) {
    if (erro instanceof NaoAutenticado) return null;
    throw erro;
  }
}

function quemAbre(resolucao: ResolucaoDeContexto | null): QuemAbreOConvite | null {
  if (resolucao === null) return null;
  return {
    pessoaId: resolucao.sessao.pessoaId,
    codigosComVinculoAtivo: resolucao.vinculos.map((v) => v.organizacao.codigoPublico),
  };
}

/**
 * O `access_token` do cabeçalho `Authorization`, quando houver.
 *
 * É a segunda forma em que a sessão chega (contrato §4.1): `sessaoSupabase` é o cookie do PWA;
 * `bearerSupabase` é o que `curl`, Postman e o teste de ponta a ponta usam. Ler o cabeçalho é *traduzir
 * HTTP*, que é a única coisa que a tabela de camadas permite a esta camada — o provedor é quem valida.
 */
async function tokenPortador(): Promise<string | null> {
  const cabecalho = (await headers()).get("authorization");
  if (cabecalho === null) return null;

  const achado = /^Bearer\s+(.+)$/iu.exec(cabecalho.trim());
  return achado?.[1]?.trim() ?? null;
}

/**
 * A trava contra a aba esquecida (contrato §4.3).
 *
 * > `X-Organizacao-Id` **nunca escolhe** a organização — apenas confirma a que a sessão já escolheu.
 * > Ausente, não há verificação. Presente e diferente: `409`, e nada é executado.
 *
 * Confere-se **só no caminho escopado**. Nas cinco operações da §4.4 não há organização ativa a
 * confirmar — e em `GET /contexto`, que é justamente o pedido com que a aba desatualizada descobre a
 * divergência, um `409` a deixaria sem caminho de volta.
 */
async function conferirAfirmacaoDeOrganizacao(organizacaoAtiva: string): Promise<void> {
  const afirmada = (await headers()).get("x-organizacao-id");
  if (afirmada !== null && afirmada !== "" && afirmada !== organizacaoAtiva) {
    throw new OrganizacaoDivergente();
  }
}

/**
 * Lê e valida o corpo.
 *
 * **Com `corpoOpcional`, a decisão de o que é "ausente" muda de critério** — de cabeçalho para conteúdo.
 * Ver `lerCorpoOpcional`.
 */
async function lerCorpo<C>(
  requisicao: Request,
  schema: ZodType<C> | undefined,
  recusar?: (corpo: unknown) => void,
  corpoOpcional = false,
): Promise<C> {
  if (schema === undefined) return undefined as C;

  const bruto = corpoOpcional
    ? await lerCorpoOpcional(requisicao)
    : await lerCorpoObrigatorio(requisicao);

  // **Antes do schema, sobre o corpo cru.** Depois dele o campo ja foi descartado em silencio, e e o
  // silencio que o `422 CAMPO_NAO_SUPORTADO` existe para quebrar.
  recusar?.(bruto);

  const conferido = schema.safeParse(bruto);
  if (!conferido.success) throw new FormatoInvalido(conferido.error.issues.map(traduzirViolacao));

  return conferido.data;
}

/**
 * O caminho de sempre, dos endpoints cujo corpo é obrigatório.
 *
 * **`415` antes de `400`**: `Content-Type` diferente de `application/json` é recusado sem olhar o
 * conteúdo.
 */
async function lerCorpoObrigatorio(requisicao: Request): Promise<unknown> {
  const tipo = requisicao.headers.get("content-type");
  if (tipo === null || !tipo.toLowerCase().includes("application/json")) {
    throw new CorpoNaoSuportado(tipo);
  }

  try {
    return (await requisicao.json()) as unknown;
  } catch {
    throw new FormatoInvalido([
      { campo: "", codigo: "JSON_INVALIDO", mensagem: "O corpo não é JSON válido." },
    ]);
  }
}

/**
 * ============================================================================
 *  O corpo opcional — e por que "ausente" é ZERO BYTE
 * ============================================================================
 *
 * Cinco endpoints declaram `requestBody: required: false` no `openapi.yaml` — `/analisar`,
 * `/iniciar-atendimento`, `/retomar`, `/resolver` e o `/recusar` do item 8. Quem seguisse a
 * especificação e não mandasse corpo levava `415`, e o portão do DoD *"a especificação versionada
 * corresponde ao código"* ficava aberto.
 *
 * **A distinção que sustenta tudo:** *ausente* é **nenhum byte**, não *"sem `content-type`"*. Se fosse
 * pelo cabeçalho, um cliente que mandasse `{"observacao": "…"}` esquecendo o `content-type` teria a
 * observação **aceita e descartada em silêncio** — o modo de falha que o contrato mais evita, criado pelo
 * conserto de outro. Por isso o conteúdo é lido **antes** de o cabeçalho ser consultado.
 *
 * **Só aceita mais, e nunca menos** (contrato §11): nenhum cliente que funcionava deixa de funcionar.
 *
 * **Exportada porque é o que se pode testar.** `comContexto` inteiro depende de `cookies()` e `headers()`
 * do framework; esta função recebe um `Request` e mais nada, e é onde o critério 16.7 é afirmado.
 */
export async function lerCorpoOpcional(requisicao: Request): Promise<unknown> {
  const texto = await requisicao.text();
  if (texto === "") return {};

  const tipo = requisicao.headers.get("content-type");
  if (tipo === null || !tipo.toLowerCase().includes("application/json")) {
    throw new CorpoNaoSuportado(tipo);
  }

  try {
    return JSON.parse(texto) as unknown;
  } catch {
    throw new FormatoInvalido([
      { campo: "", codigo: "JSON_INVALIDO", mensagem: "O corpo não é JSON válido." },
    ]);
  }
}

/**
 * Traduz a violação da biblioteca de validação no `erros[]` do contrato (§6.1).
 *
 * O de-para existe para que o vocabulário da biblioteca **não** vire vocabulário do contrato: `codigo` é
 * *"o contrato de verdade… estável"*, e um código que muda quando a dependência muda não é estável.
 */
function traduzirViolacao(violacao: {
  path: ReadonlyArray<PropertyKey>;
  code: string;
  message: string;
  input?: unknown;
}): ErroDeCampo {
  const campo = violacao.path.map(String).join(".");

  let codigo = "VALOR_INVALIDO";
  if (violacao.code === "invalid_type") {
    codigo = violacao.input === undefined ? "OBRIGATORIO" : "TIPO_INVALIDO";
  } else if (violacao.code === "too_small") {
    codigo = "MUITO_CURTO";
  } else if (violacao.code === "too_big") {
    codigo = "MUITO_LONGO";
  } else if (violacao.code === "invalid_format") {
    codigo = "FORMATO_DE_CAMPO_INVALIDO";
  }

  return { campo, codigo, mensagem: violacao.message };
}

async function lerParametros(contexto: ContextoDaRota | undefined): Promise<Record<string, string>> {
  if (contexto?.params === undefined) return {};
  const cru = await contexto.params;
  const saida: Record<string, string> = {};
  for (const [chave, valor] of Object.entries(cru)) {
    if (typeof valor === "string") saida[chave] = valor;
    else if (Array.isArray(valor) && typeof valor[0] === "string") saida[chave] = valor[0];
  }
  return saida;
}

function montarResposta(resultado: unknown): Response {
  const { corpo, status, cabecalhos } = ehResposta(resultado)
    ? resultado
    : { corpo: resultado, status: 200, cabecalhos: {} as Record<string, string> };

  const semCorpo = corpo === undefined || corpo === null;

  return new Response(semCorpo ? null : JSON.stringify(corpo), {
    status: semCorpo && status === 200 ? 204 : status,
    headers: {
      ...(semCorpo ? {} : { "content-type": "application/json; charset=utf-8" }),
      ...cabecalhos,
    },
  });
}

/**
 * A linha de log de uma falha — o que o `traceId` do corpo (ou da tela) aponta.
 *
 * **Exportada porque as DUAS estradas do contrato §5 escrevem a mesma linha.** A estrada da API passa
 * pelo `comContexto`, que tem `Request` e gera o `traceId`; a **estrada direta** do Server Component não
 * passa por lugar nenhum — T-05 lê chamando `verOcorrencia` e recebe um `ErroDeDominio`, sem HTTP no meio.
 * Um `traceId` mostrado na tela que não aparecesse em log nenhum seria pior que não mostrar identificador:
 * mandaria o operador procurar o que não existe.
 *
 * **`caminho` e `metodo` vêm por parâmetro, e não de um `Request`**, exatamente porque a segunda estrada
 * não tem um. Nada de dado pessoal aqui, como na versão anterior.
 */
export function registrarFalha(
  erro: unknown,
  caminho: string,
  metodo: string,
  traceId: string,
): void {
  console.error(
    JSON.stringify({
      traceId,
      caminho,
      metodo,
      erro: erro instanceof Error ? `${erro.name}: ${erro.message}` : String(erro),
    }),
  );
}

function registrarEResponder(
  erro: unknown,
  requisicao: Request,
  traceId: string,
  organizacaoAtiva: { id: string; nome: string } | null,
): Response {
  const caminho = new URL(requisicao.url).pathname;

  // A linha de log é o que o `traceId` do corpo aponta (contrato §6.1 e §6.3): a informação que a resposta
  // não dá não é destruída, é movida para onde só o operador chega. Nada de dado pessoal aqui.
  registrarFalha(erro, caminho, requisicao.method, traceId);

  // **O log vê o original; a resposta vê a cópia.** A ordem importa: a cópia é um `ErroDeDominio` cru, e
  // logá-la trocaria `OcorrenciaNaoEncontrada: …` por `ErroDeDominio: …` em toda a API — apagando do log
  // justamente o nome que o `traceId` existe para ajudar a encontrar.
  return respostaDeProblema(comOrganizacaoAtiva(erro, organizacaoAtiva), caminho, traceId);
}

/**
 * A ponte entre o `cookies()` do framework e a porta que os clientes consomem.
 *
 * Mora na camada de **Interface** porque ler e escrever cookie é *traduzir HTTP* — a única coisa que a
 * tabela de camadas lhe permite. É o que mantém `next/headers` fora de `infraestrutura/`, que não deve
 * conhecer transporte.
 */
export async function armazenamentoDeCookies(): Promise<
  ArmazenamentoDeCookies & { ler(nome: string): string | undefined }
> {
  const jar = await cookies();
  return {
    ler: (nome) => jar.get(nome)?.value,
    todos: () => jar.getAll().map((c) => ({ name: c.name, value: c.value })),
    definir: (aDefinir) => {
      for (const c of aDefinir) {
        try {
          jar.set(c.name, c.value, c.options ?? {});
        } catch {
          // Server Component em renderização não pode gravar cookie. O provedor de autenticação chama
          // `setAll` para renovar a sessão; ali a gravação acontece no route handler ou na ação seguinte.
        }
      }
    },
  };
}

/**
 * A **estrada direta** do contrato §5, para uso do Server Component.
 *
 * *"HTTP obrigatório na escrita; leitura pode ir direto, mas todo modelo de leitura tem endpoint."* Esta
 * função é a estrada direta do `GET /contexto`: **mesma resolução e mesma projeção** que o route handler,
 * sem um salto HTTP interno — que a §5 recusou justamente por custar vCPU-s da franquia da ADR-0004.
 *
 * É por isso que a projeção mora na camada de Interface e não no handler (arquitetura.md §5.5): se
 * morasse lá, as duas estradas deixariam de produzir a mesma resposta.
 *
 * **Uma consequência declarada.** Server Component em renderização **não pode gravar cookie**, então a
 * escolha automática da organização única (contrato §4.3) não persiste por esta estrada. Não muda o
 * resultado — a resolução recalcula a escolha em toda requisição, porque é a mesma consulta —, só perde o
 * atalho. O cookie é gravado na primeira chamada ao `route.ts`.
 */
export async function resolverParaTela(): Promise<ResolucaoDeContexto> {
  const { resolucao } = await abrirRequisicao();
  return resolucao;
}

/**
 * O que uma tela escopada recebe. **A situação é explícita porque as três têm destinos diferentes**, e
 * quem decide para onde ir é a página — não este ajudante.
 */
export type EscopoDaTela =
  | {
      situacao: "pronto";
      ctx: ContextoDaRequisicao;
      repos: RepositoriosEscopados;
      resolucao: ResolucaoDeContexto;
    }
  | { situacao: "sem-organizacao"; resolucao: ResolucaoDeContexto }
  | { situacao: "sem-permissao"; ctx: ContextoDaRequisicao; resolucao: ResolucaoDeContexto };

/**
 * A **estrada direta** do contrato §5, na forma escopada — irmã de `resolverParaTela`.
 *
 * *"HTTP obrigatório na escrita; leitura pode ir direto"*. `resolverParaTela` serve a tela que só precisa
 * do contexto; esta serve a tela que precisa **ler dado da organização** — T-08 lê a fila de pedidos e as
 * áreas.
 *
 * **Por que ela existe em vez de a página chamar a própria API.** `app/` não pode importar `@/composicao`
 * (lint, regra 2b), então a página não tem como montar repositório; e um `fetch` interno custaria o salto
 * HTTP que a §5 recusou por vCPU-s da franquia da ADR-0004 — um salto que, sob escala a zero, é cobrado
 * do tempo de quem abre a tela.
 *
 * **Ela não redireciona.** Redirecionar daqui esconderia a decisão de navegação dentro de um ajudante de
 * transporte, e o mapa de navegação é do inventário (§3): quem o aplica é a página.
 *
 * @throws NaoAutenticado quando não há sessão — mesmo contrato de `resolverParaTela`.
 */
export async function resolverEscopoParaTela(
  exige: Permissao | "qualquer-vinculo-ativo",
): Promise<EscopoDaTela> {
  const { resolucao } = await abrirRequisicao();

  if (resolucao.ativo === null) return { situacao: "sem-organizacao", resolucao };

  const ctx = contextoDaRequisicao(resolucao, resolucao.ativo);
  if (exige !== "qualquer-vinculo-ativo" && !ctx.vinculo.pode(exige)) {
    return { situacao: "sem-permissao", ctx, resolucao };
  }

  return { situacao: "pronto", ctx, repos: montarPortasEscopadas(ctx.vinculo.organizacaoId), resolucao };
}
