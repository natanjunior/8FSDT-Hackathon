import { cookies, headers } from "next/headers";
import type { ZodType } from "zod";

import {
  contextoDaRequisicao,
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
  montarPortasEscopadas,
  montarPortasGlobais,
  type ArmazenamentoDeCookies,
} from "@/composicao";
import { PermissaoInsuficiente } from "@/dominio/erros";
import type { Permissao } from "@/dominio/organizacao";

import {
  assinarOrganizacao,
  lerOrganizacaoAssinada,
  NOME_DO_COOKIE,
} from "./cookie-de-organizacao";
import {
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
 * **`semOrganizacao` é a lista fechada da ADR-0003 virada mecanismo.** Exatamente quatro operações rodam
 * sem escopo (contrato §4.4), e o lint só permite importar `semOrganizacao` nos quatro `route.ts` daquela
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

/** O que os 33 endpoints escopados recebem. */
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
  /** O nome grita que **não** é escopado. Só as quatro operações da lista fechada o recebem. */
  portasGlobais: PortasGlobais;
  corpo: C;
  parametros: Readonly<Record<string, string>>;
  requisicao: Request;
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
};

type OpcoesSemOrganizacao<C> = { corpo?: ZodType<C> };

// ---------------------------------------------------------------------------
// comContexto — os 33
// ---------------------------------------------------------------------------

export function comContexto<C = undefined>(
  opcoes: OpcoesEscopadas<C>,
  manipulador: Manipulador<EntradaEscopada<C>>,
): RotaDoNext {
  return async (requisicao, contextoDaRota) => {
    const traceId = novoTraceId();
    try {
      const { resolucao } = await abrirRequisicao();

      if (resolucao.ativo === null) throw new SemOrganizacaoAtiva();
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
        corpo: await lerCorpo(requisicao, opcoes.corpo),
        parametros: await lerParametros(contextoDaRota),
        requisicao,
      });

      return montarResposta(resultado);
    } catch (erro) {
      return registrarEResponder(erro, requisicao, traceId);
    }
  };
}

// ---------------------------------------------------------------------------
// semOrganizacao — os quatro da lista fechada (contrato §4.4)
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
      const { resolucao, portas } = await abrirRequisicao();

      const resultado = await manipulador({
        ctx: resolucao.sessao,
        resolucao,
        portasGlobais: portas,
        corpo: await lerCorpo(requisicao, opcoes.corpo),
        parametros: await lerParametros(contextoDaRota),
        requisicao,
      });

      return montarResposta(resultado);
    } catch (erro) {
      return registrarEResponder(erro, requisicao, traceId);
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
 */
async function abrirRequisicao(): Promise<{
  resolucao: ResolucaoDeContexto;
  portas: PortasGlobais;
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

  return { resolucao, portas };
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
 * Confere-se **só no caminho escopado**. Nas quatro operações da §4.4 não há organização ativa a
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
 * **`415` antes de `400`**: `Content-Type` diferente de `application/json` é recusado sem olhar o
 * conteúdo. Depois, o schema — que é a única coisa que a §5 permite à camada de Interface fazer.
 */
async function lerCorpo<C>(requisicao: Request, schema: ZodType<C> | undefined): Promise<C> {
  if (schema === undefined) return undefined as C;

  const tipo = requisicao.headers.get("content-type");
  if (tipo === null || !tipo.toLowerCase().includes("application/json")) {
    throw new CorpoNaoSuportado(tipo);
  }

  let bruto: unknown;
  try {
    bruto = await requisicao.json();
  } catch {
    throw new FormatoInvalido([
      { campo: "", codigo: "JSON_INVALIDO", mensagem: "O corpo não é JSON válido." },
    ]);
  }

  const conferido = schema.safeParse(bruto);
  if (!conferido.success) throw new FormatoInvalido(conferido.error.issues.map(traduzirViolacao));

  return conferido.data;
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

function registrarEResponder(erro: unknown, requisicao: Request, traceId: string): Response {
  const caminho = new URL(requisicao.url).pathname;

  // A linha de log é o que o `traceId` do corpo aponta (contrato §6.1 e §6.3): a informação que a resposta
  // não dá não é destruída, é movida para onde só o operador chega. Nada de dado pessoal aqui.
  console.error(
    JSON.stringify({
      traceId,
      caminho,
      metodo: requisicao.method,
      erro: erro instanceof Error ? `${erro.name}: ${erro.message}` : String(erro),
    }),
  );

  return respostaDeProblema(erro, caminho, traceId);
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
