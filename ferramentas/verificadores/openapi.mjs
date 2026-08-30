import { existsSync } from "node:fs";
import { join } from "node:path";

import { parse } from "yaml";

import { curto, ler, relatar, RAIZ } from "./comum.mjs";

/**
 * ============================================================================
 *  Verificador de contrato
 * ============================================================================
 *
 * As **quatro verificações mecânicas** que a §15 do contrato de API derivou, e que o Definition of Done
 * cobra por funcionalidade que toque um endpoint. Cada uma protege uma decisão estrutural que **se perde em
 * silêncio**:
 *
 * | Verificação | O que ela impede |
 * |---|---|
 * | `status` fora de **todo** schema de entrada | Que a `Ocorrência` ganhe um `PATCH` e a ADR-0001 caia junto |
 * | Nenhum caminho contém `pessoas` | O vazamento entre organizações mais provável do produto, subindo da consulta para a superfície |
 * | `organizacao` só nos dois caminhos permitidos | Que a organização volte a ser informada pelo cliente, contra a ADR-0003 |
 * | `requestBody.required: false` ⇔ `corpoOpcional` na rota | Que a especificação publique um corpo dispensável e a rota responda `415` a quem confiar nela — e o contrário |
 *
 * > **Acrescentada em 30/08/2026** (item 15 da fila da frente de documentação). Este cabeçalho dizia
 * > *"as **três** verificações mecânicas"* e a tabela tinha três linhas. As três primeiras leem **só** o
 * > YAML; a quarta é a primeira que compara o YAML com os `route.ts` de `app/api/`.
 *
 * Mais duas de sanidade, sem as quais as quatro acima podem passar por acidente: o YAML **carrega**, e todo
 * `$ref` **resolve**. Um `$ref` quebrado esconde um schema inteiro da verificação de `status`.
 *
 * > **Sobre a primeira, e a §15 é explícita:** *"não é uma linha de `grep`, e a diferença importa. A palavra
 * > aparece mais de cem vezes no arquivo, e quase todas são legítimas: o schema `StatusOcorrencia`, o campo
 * > `status` do `Problema` — que é o código HTTP que a RFC 9457 exige —, os exemplos de resposta e as
 * > descrições. Buscar a palavra encontra tudo isso e não responde a pergunta. A verificação real distingue
 * > entrada de saída: percorre o `requestBody` de cada operação, segue os `$ref` até os schemas concretos, e
 * > confere que a propriedade `status` não existe em nenhum deles."*
 */

/**
 * Por padrão, a especificação versionada. Um argumento opcional aponta para outro arquivo — é como se
 * demonstra que este script recusa o que deve recusar, sem envenenar o arquivo de verdade:
 *
 *     node ferramentas/verificadores/openapi.mjs /tmp/openapi-envenenado.yaml
 */
const CAMINHO = process.argv[2] ?? join(RAIZ, "docs/api/openapi.yaml");

/** Os dois caminhos onde `organizacao` é permitido (contrato §4.4). */
const CAMINHOS_COM_ORGANIZACAO = new Set(["/organizacoes", "/contexto/organizacao"]);

const METODOS = ["get", "put", "post", "patch", "delete", "head", "options", "trace"];

const falhas = [];
const notas = [];

// ---------------------------------------------------------------------------
// 0 · O YAML carrega
// ---------------------------------------------------------------------------

let spec;
try {
  spec = parse(ler(CAMINHO));
} catch (erro) {
  console.error(`✗ OpenAPI: o YAML não carrega — ${erro instanceof Error ? erro.message : erro}`);
  process.exit(1);
}

if (typeof spec !== "object" || spec === null || typeof spec.paths !== "object") {
  console.error("✗ OpenAPI: o documento carregou mas não tem `paths` — não é uma especificação OpenAPI.");
  process.exit(1);
}

notas.push(`openapi ${String(spec.openapi)} · ${Object.keys(spec.paths).length} caminhos`);

// ---------------------------------------------------------------------------
// 1 · Todo `$ref` resolve
// ---------------------------------------------------------------------------

/** Resolve um `#/a/b/c` no próprio documento. Devolve `undefined` se não existir. */
function resolver(ref) {
  if (typeof ref !== "string" || !ref.startsWith("#/")) return undefined;
  let atual = spec;
  for (const parte of ref.slice(2).split("/")) {
    const chave = parte.replaceAll("~1", "/").replaceAll("~0", "~");
    if (typeof atual !== "object" || atual === null || !(chave in atual)) return undefined;
    atual = atual[chave];
  }
  return atual;
}

let refsConferidos = 0;

function andarPorRefs(no, trilha) {
  if (Array.isArray(no)) {
    no.forEach((item, i) => andarPorRefs(item, `${trilha}[${i}]`));
    return;
  }
  if (typeof no !== "object" || no === null) return;

  for (const [chave, valor] of Object.entries(no)) {
    if (chave === "$ref") {
      refsConferidos += 1;
      if (typeof valor !== "string" || !valor.startsWith("#/")) {
        falhas.push(`$ref externo ou malformado em ${trilha}: ${String(valor)}`);
      } else if (resolver(valor) === undefined) {
        falhas.push(`$ref não resolve em ${trilha}: ${valor}`);
      }
      continue;
    }
    andarPorRefs(valor, `${trilha}/${chave}`);
  }
}

andarPorRefs(spec, "#");
notas.push(`${refsConferidos} $ref conferidos`);

// ---------------------------------------------------------------------------
// 2 · `operationId` únicos
// ---------------------------------------------------------------------------

const operacoes = [];
for (const [caminho, item] of Object.entries(spec.paths)) {
  if (typeof item !== "object" || item === null) continue;
  for (const metodo of METODOS) {
    const operacao = item[metodo];
    if (typeof operacao === "object" && operacao !== null) {
      operacoes.push({ caminho, metodo, operacao });
    }
  }
}

const vistos = new Map();
for (const { caminho, metodo, operacao } of operacoes) {
  const id = operacao.operationId;
  if (typeof id !== "string" || id === "") {
    falhas.push(`sem operationId: ${metodo.toUpperCase()} ${caminho}`);
    continue;
  }
  const anterior = vistos.get(id);
  if (anterior !== undefined) {
    falhas.push(`operationId repetido "${id}": ${anterior} e ${metodo.toUpperCase()} ${caminho}`);
  } else {
    vistos.set(id, `${metodo.toUpperCase()} ${caminho}`);
  }
}

notas.push(`${operacoes.length} operações · ${vistos.size} operationId distintos`);

// ---------------------------------------------------------------------------
// 3 · `status` não aparece em NENHUM schema de entrada
//
// Segue `$ref` a partir de todo `requestBody`, e desce por `properties`,
// `items`, `allOf`, `oneOf`, `anyOf`, `additionalProperties` e `$defs`. Não é
// `grep`: a palavra `status` no `Problema` e no `StatusOcorrencia` é legítima —
// os dois são schemas de **saída**.
// ---------------------------------------------------------------------------

let schemasDeEntrada = 0;

function conferirEntrada(schema, trilha, visitados) {
  if (typeof schema !== "object" || schema === null) return;

  if (typeof schema.$ref === "string") {
    if (visitados.has(schema.$ref)) return; // recursão declarada: não é erro, é ciclo de schema
    visitados.add(schema.$ref);
    conferirEntrada(resolver(schema.$ref), `${trilha} → ${schema.$ref}`, visitados);
    return;
  }

  schemasDeEntrada += 1;

  const propriedades = schema.properties;
  if (typeof propriedades === "object" && propriedades !== null && "status" in propriedades) {
    falhas.push(
      `REGRA 1 VIOLADA — a propriedade \`status\` existe num schema de ENTRADA, em ${trilha}. ` +
        "Comando de domínio não vira campo (contrato §3.5, P1): mudar status é chamar um comando nomeado, " +
        "e cada comando grava o registro de transição. Um `status` escrevível derruba a ADR-0001.",
    );
  }

  for (const chave of ["items", "additionalProperties", "not"]) {
    conferirEntrada(schema[chave], `${trilha}/${chave}`, visitados);
  }
  for (const chave of ["allOf", "oneOf", "anyOf", "prefixItems"]) {
    const lista = schema[chave];
    if (Array.isArray(lista)) {
      lista.forEach((sub, i) => conferirEntrada(sub, `${trilha}/${chave}[${i}]`, visitados));
    }
  }
  for (const chave of ["properties", "$defs", "patternProperties"]) {
    const mapa = schema[chave];
    if (typeof mapa === "object" && mapa !== null) {
      for (const [nome, sub] of Object.entries(mapa)) {
        conferirEntrada(sub, `${trilha}/${chave}/${nome}`, visitados);
      }
    }
  }
}

for (const { caminho, metodo, operacao } of operacoes) {
  let corpo = operacao.requestBody;
  if (typeof corpo === "object" && corpo !== null && typeof corpo.$ref === "string") {
    corpo = resolver(corpo.$ref);
  }
  if (typeof corpo !== "object" || corpo === null) continue;

  const conteudo = corpo.content;
  if (typeof conteudo !== "object" || conteudo === null) continue;

  for (const [tipo, midia] of Object.entries(conteudo)) {
    if (typeof midia !== "object" || midia === null) continue;
    conferirEntrada(
      midia.schema,
      `${metodo.toUpperCase()} ${caminho} requestBody[${tipo}]`,
      new Set(),
    );
  }

  // Parâmetros também são entrada: um `?status=` de FILTRO é leitura legítima, mas um `status` em `path`
  // ou `cookie` seria escrita disfarçada. O contrato tem filtro por status em `GET /ocorrencias` (G2,
  // ENUNCIADO literal), então só `query` é aceitável.
  for (const parametro of [...(operacao.parameters ?? []), ...(spec.paths[caminho].parameters ?? [])]) {
    const p = typeof parametro?.$ref === "string" ? resolver(parametro.$ref) : parametro;
    if (typeof p === "object" && p !== null && p.name === "status" && p.in !== "query") {
      falhas.push(
        `REGRA 1 VIOLADA — parâmetro \`status\` em \`${String(p.in)}\` em ${metodo.toUpperCase()} ${caminho}. ` +
          "Só filtro em query é leitura; em path, header ou cookie é escrita disfarçada.",
      );
    }
  }
}

notas.push(`${schemasDeEntrada} schemas de entrada percorridos a partir de requestBody`);

// ---------------------------------------------------------------------------
// 4 · Nenhum caminho contém `pessoas` (contrato §4.6, P3)
// ---------------------------------------------------------------------------

for (const caminho of Object.keys(spec.paths)) {
  if (/pessoas/iu.test(caminho)) {
    falhas.push(
      `REGRA 2 VIOLADA — o caminho \`${caminho}\` contém "pessoas". \`pessoas\` é tabela global e não tem ` +
        "coluna de organização: toda listagem de gente é listagem de Vínculo, e todo endereço de gente é " +
        "`/vinculos/{pessoaId}` (contrato §4.6).",
    );
  }
}

// ---------------------------------------------------------------------------
// 5 · `organizacao` só nos dois caminhos permitidos (contrato §4.4, P2)
// ---------------------------------------------------------------------------

for (const caminho of Object.keys(spec.paths)) {
  if (!/organizac/iu.test(caminho)) continue;
  if (CAMINHOS_COM_ORGANIZACAO.has(caminho)) continue;
  falhas.push(
    `REGRA 3 VIOLADA — o caminho \`${caminho}\` nomeia organização. A organização vem da SESSÃO, nunca da ` +
      "URL (ADR-0003, contrato §4.2). Os únicos dois permitidos são " +
      `${[...CAMINHOS_COM_ORGANIZACAO].join(" e ")}.`,
  );
}

// E o outro lado da mesma regra: os dois permitidos têm de existir. Se um deles for renomeado, a
// verificação acima passaria a não conferir nada — e passaria calada.
for (const permitido of CAMINHOS_COM_ORGANIZACAO) {
  if (!(permitido in spec.paths)) {
    falhas.push(
      `caminho permitido ausente: \`${permitido}\`. A lista de exceções da §4.4 está desatualizada em ` +
        "relação ao contrato, e uma exceção que não aponta para nada não verifica nada.",
    );
  }
}

// ---------------------------------------------------------------------------
// 6 · `requestBody.required: false` no YAML ⇔ `corpoOpcional` no `route.ts`
//
// A quarta regra, e ela é de natureza diferente das três primeiras: aquelas leem
// só o YAML; esta compara o YAML com `app/api/**/route.ts`.
//
// **Por que ela existe.** `POST /pedidos-de-entrada/{pedidoId}/recusar` declarou
// `requestBody: required: false` desde o item 8 e a rota respondia
// `415 CORPO_NAO_SUPORTADO` a quem não mandasse corpo. O portão do Definition of
// Done *"a especificação versionada corresponde ao código"* ficou aberto do item
// 8 até 27/08/2026 — e nenhuma das três regras acima olha `required`.
//
// **A regra é simétrica de propósito.** `corpoOpcional` no `route.ts` e
// `requestBody.required: false` no YAML são a **mesma** afirmação escrita em dois
// lugares; qualquer um dos dois sozinho é uma promessa que o outro desmente. O
// lado que faltava ao item 15 da fila era o primeiro; o segundo custa a mesma
// leitura e fecha a porta dos dois lados.
// ---------------------------------------------------------------------------

/** `/ocorrencias/{ocorrenciaId}/analisar` → `app/api/ocorrencias/[ocorrenciaId]/analisar/route.ts`. */
function rotaDe(caminho) {
  const segmentos = caminho
    .split("/")
    .filter((parte) => parte !== "")
    .map((parte) =>
      parte.startsWith("{") && parte.endsWith("}") ? `[${parte.slice(1, -1)}]` : parte,
    );
  return join(RAIZ, "app", "api", ...segmentos, "route.ts");
}

/**
 * `[ =(]` no fim, e não `\b`: os três formatos que este repositório pode escrever são
 * `export const POST = …`, `export const POST=…` e `export async function POST(…`. A classe explícita
 * também impede que `POSTAR` case por engano.
 */
const ABERTURA = (metodo) =>
  new RegExp(`^export (?:const |async function |function )${metodo}[ =(]`, "mu");
const PROXIMA_ABERTURA = /^export (?:const |async function |function )[A-Z]+\b/mu;

/**
 * O trecho de um `route.ts` que pertence a um método, **sem os comentários**.
 *
 * Remover comentário não é elegância: cinco `route.ts` deste repositório escrevem **"SEM
 * `corpoOpcional`"** na prosa do próprio arquivo, justamente para dizer que a ausência é decidida. Uma
 * busca textual ingênua leria a explicação como se fosse a declaração — e a regra passaria a aprovar
 * exatamente o arquivo que ela existe para reprovar.
 */
function manipulador(fonte, metodo) {
  const abertura = ABERTURA(metodo).exec(fonte);
  if (abertura === null) return undefined;

  const resto = fonte.slice((abertura.index ?? 0) + 1);
  const proxima = PROXIMA_ABERTURA.exec(resto);
  const trecho = proxima === null ? resto : resto.slice(0, proxima.index);

  return trecho.replaceAll(/\/\*[\s\S]*?\*\//gu, " ").replaceAll(/^[ \t]*\/\/.*$/gmu, " ");
}

let rotasConferidas = 0;
let semRota = 0;

for (const { caminho, metodo, operacao } of operacoes) {
  const METODO = metodo.toUpperCase();

  let corpoDaOperacao = operacao.requestBody;
  if (
    typeof corpoDaOperacao === "object" &&
    corpoDaOperacao !== null &&
    typeof corpoDaOperacao.$ref === "string"
  ) {
    corpoDaOperacao = resolver(corpoDaOperacao.$ref);
  }
  const opcionalNoYaml =
    typeof corpoDaOperacao === "object" &&
    corpoDaOperacao !== null &&
    corpoDaOperacao.required === false;

  const arquivo = rotaDe(caminho);

  // **Rota ausente não é falha por si.** O regime declarado na §15 é *spec-first*: o YAML é a fonte da
  // verdade e o código conforma a ele, então a especificação pode nascer antes da rota. O que não pode
  // nascer sozinho é `required: false`, que é promessa de **comportamento** — sem rota, não há quem a
  // cumpra.
  if (!existsSync(arquivo)) {
    semRota += 1;
    if (opcionalNoYaml) {
      falhas.push(
        `REGRA 4 VIOLADA — ${METODO} ${caminho} declara \`requestBody.required: false\` e não existe ` +
          `\`${curto(arquivo)}\`. Corpo opcional é comportamento, e comportamento sem rota é promessa ` +
          "sem dono.",
      );
    }
    continue;
  }

  const trecho = manipulador(ler(arquivo), METODO);
  if (trecho === undefined) {
    if (opcionalNoYaml) {
      falhas.push(
        `REGRA 4 VIOLADA — ${METODO} ${caminho} declara \`requestBody.required: false\` e ` +
          `\`${curto(arquivo)}\` não exporta \`${METODO}\`.`,
      );
    }
    continue;
  }

  rotasConferidas += 1;

  const declaracao = /\bcorpoOpcional\b(?:\s*:\s*(true|false))?/u.exec(trecho);
  const opcionalNaRota = declaracao !== null && declaracao[1] !== "false";

  if (opcionalNoYaml && !opcionalNaRota) {
    falhas.push(
      `REGRA 4 VIOLADA — ${METODO} ${caminho} declara \`requestBody.required: false\`, e ` +
        `\`${curto(arquivo)}\` não passa \`corpoOpcional\` ao \`comContexto\`. A especificação publica um ` +
        "corpo dispensável e a rota responde `415 CORPO_NAO_SUPORTADO` a quem confiar nela.",
    );
  }

  if (!opcionalNoYaml && opcionalNaRota) {
    falhas.push(
      `REGRA 4 VIOLADA — \`${curto(arquivo)}\` passa \`corpoOpcional\` em ${METODO} ${caminho}, e o YAML ` +
        "**não** declara `requestBody.required: false`. A rota aceita corpo ausente e a especificação diz " +
        "que ele é obrigatório — o mesmo desencontro, do outro lado.",
    );
  }
}

notas.push(
  `${rotasConferidas} operações conferidas contra app/api/**/route.ts` +
    (semRota > 0 ? ` · ${semRota} sem rota (spec-first, §15)` : ""),
);

// ---------------------------------------------------------------------------

process.exit(relatar("OpenAPI", { conferidos: operacoes.length, unidade: "operação", falhas, notas }));
