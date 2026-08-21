import { join } from "node:path";

import { parse } from "yaml";

import { ler, relatar, RAIZ } from "./comum.mjs";

/**
 * ============================================================================
 *  Verificador de contrato
 * ============================================================================
 *
 * As **três verificações mecânicas** que a §15 do contrato de API derivou, e que o Definition of Done cobra
 * por funcionalidade que toque um endpoint. Cada uma protege uma decisão estrutural que **se perde em
 * silêncio**:
 *
 * | Verificação | O que ela impede |
 * |---|---|
 * | `status` fora de **todo** schema de entrada | Que a `Ocorrência` ganhe um `PATCH` e a ADR-0001 caia junto |
 * | Nenhum caminho contém `pessoas` | O vazamento entre organizações mais provável do produto, subindo da consulta para a superfície |
 * | `organizacao` só nos dois caminhos permitidos | Que a organização volte a ser informada pelo cliente, contra a ADR-0003 |
 *
 * Mais duas de sanidade, sem as quais as três acima podem passar por acidente: o YAML **carrega**, e todo
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

process.exit(relatar("OpenAPI", { conferidos: operacoes.length, unidade: "operação", falhas, notas }));
