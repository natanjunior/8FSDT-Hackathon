import { globSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * ============================================================================
 *  As palavras que vazaram para a tela — item 126, critério 6
 * ============================================================================
 *
 * **Nenhum texto dos módulos de frase diz *vínculo*, *servidor*, *corte*, *recorte*, *identificador*,
 * *dashboard* ou *provedor*, nem põe *no* ou *do* antes do nome da organização.** São palavras de quem
 * desenvolve (o Vínculo, o servidor, o corte da paginação) ou concordância que só serve a nome masculino
 * (*"no Associação Vila Nova"*), e a revisão de UX writing de 04/10/2026 achou as duas coisas na tela.
 *
 * **O teste NÃO lê o arquivo cru, e é o ponto.** Os módulos de frase são comentados em português, e o
 * comentário fala de vínculo, de recorte e de servidor o tempo todo: uma busca no texto do arquivo nasceria
 * vermelha. A fonte passa pelo analisador do TypeScript, e só os nós que viram texto entram na conta:
 *
 * - `StringLiteral` e `NoSubstitutionTemplateLiteral`;
 * - as partes literais de um `TemplateExpression` (cabeça, meio e cauda), **nunca o código de dentro do
 *   `${…}`** — `corte` é nome de variável em `idade-em-aberto.ts`, e não texto.
 *
 * Comentário não é nó da árvore, e por isso não entra. Saem também os literais que são código e não texto:
 * o caminho de um `import`/`export`, o nome de uma propriedade (`"chave": …`) e o tipo literal
 * (`tipo: "vinculo"` numa declaração de tipo). E saem, nomeadas uma a uma, as **fichas de código** que
 * passam por valor: a permissão no formato `dominio.acao` (`"vinculo.gerir"`, `"dashboard.ler"`), o
 * discriminante `"vinculo"` e a chave `vinculo:${…}` de `linhas-de-participantes.ts`, e o código de motivo
 * `"vinculo-revogado"` do convite. Uma ficha de código não tem espaço nem maiúscula: o filtro exige as duas
 * condições, e por isso uma frase de tela nunca passa por ele.
 */

const RAIZ = fileURLToPath(new URL("../../", import.meta.url));

/** Os módulos de frase: a lista do item, e todo `frases-*.ts` que nascer depois. */
const MODULOS = [
  ...new Set([
    "src/interface/componentes/rotulos.ts",
    "src/interface/componentes/rotulos-do-solicitante.ts",
    "src/interface/componentes/sino.ts",
    "src/interface/componentes/registro-de-ocorrencia.ts",
    "src/interface/componentes/comando-de-ocorrencia.ts",
    "src/interface/componentes/retorno-de-acao.ts",
    "src/interface/componentes/convite-pessoal.ts",
    "src/interface/componentes/qr-da-area.ts",
    "src/interface/componentes/envio-de-convite.ts",
    "src/interface/componentes/regras-do-nome.ts",
    "src/interface/componentes/regras-da-configuracao.ts",
    "src/interface/componentes/etiquetas-de-participante.ts",
    "src/interface/componentes/linhas-de-participantes.ts",
    "src/interface/componentes/idade-em-aberto.ts",
    "src/interface/componentes/aba-da-configuracao.ts",
    // O e-mail do convite: é texto que a pessoa lê, mesmo saindo da camada de aplicação.
    "src/aplicacao/organizacao/envio-de-convite.ts",
    ...globSync("src/interface/componentes/frases-*.ts", { cwd: RAIZ }).map((c) => c.replace(/\\/gu, "/")),
  ]),
].sort();

const PALAVRAS = /\b(?:vinculos?|servidor(?:es)?|cortes?|recortes?|identificador(?:es)?|dashboards?|provedor(?:es)?)\b/iu;

/** `no `/`do ` no fim de um trecho literal, logo antes da interpolação. */
const ARTIGO_NO_FIM = /\b(?:no|do)\s$/iu;

/** Uma ficha de código: sem espaço e sem maiúscula. Nenhuma frase de tela tem essa forma. */
const FICHA_DE_CODIGO = /^[a-z0-9_.:-]*$/u;
const FICHAS_PERMITIDAS = [
  /^[a-z_]+\.[a-z_]+$/u, // permissão `dominio.acao`
  /^vinculo$/u, // discriminante de linhas-de-participantes.ts
  /^vinculo:$/u, // a chave `vinculo:${…}`, na cabeça do molde
  /^vinculo-revogado$/u, // código de motivo do convite
];

/** Sem acento: *vínculo* e *vinculo* são a mesma palavra para quem lê. */
function semAcento(texto: string): string {
  return texto.normalize("NFD").replace(/\p{Mn}/gu, "");
}

type Trecho = { arquivo: string; linha: number; texto: string; antesDe?: string };

/** Os trechos que viram texto. É aqui que o comentário fica de fora: ele não é nó da árvore. */
function trechosDeTexto(arquivo: string): Trecho[] {
  return trechosDaFonte(arquivo, readFileSync(RAIZ + arquivo, "utf8"));
}

function trechosDaFonte(arquivo: string, codigo: string): Trecho[] {
  const fonte = ts.createSourceFile(arquivo, codigo, ts.ScriptTarget.Latest, true);
  const trechos: Trecho[] = [];
  const linha = (no: ts.Node) => fonte.getLineAndCharacterOfPosition(no.getStart(fonte)).line + 1;

  function ehCodigo(no: ts.Node): boolean {
    const pai = no.parent;
    if (ts.isImportDeclaration(pai) || ts.isExportDeclaration(pai) || ts.isExternalModuleReference(pai)) return true;
    if (ts.isLiteralTypeNode(pai)) return true;
    if ((ts.isPropertyAssignment(pai) || ts.isPropertySignature(pai) || ts.isPropertyDeclaration(pai)) && pai.name === no) {
      return true;
    }
    return false;
  }

  function visitar(no: ts.Node): void {
    if ((ts.isStringLiteral(no) || ts.isNoSubstitutionTemplateLiteral(no)) && !ehCodigo(no)) {
      trechos.push({ arquivo, linha: linha(no), texto: no.text });
    } else if (ts.isTemplateExpression(no)) {
      const partes = [no.head, ...no.templateSpans.map((s) => s.literal)];
      no.templateSpans.forEach((span, i) => {
        trechos.push({ arquivo, linha: linha(partes[i]!), texto: partes[i]!.text, antesDe: span.expression.getText(fonte) });
      });
      trechos.push({ arquivo, linha: linha(no.templateSpans.at(-1)!.literal), texto: no.templateSpans.at(-1)!.literal.text });
      // As expressões de dentro do `${…}` podem trazer moldes e literais próprios: eles também são texto.
      for (const span of no.templateSpans) ts.forEachChild(span, visitar);
      return;
    } else if (
      ts.isBinaryExpression(no) &&
      no.operatorToken.kind === ts.SyntaxKind.PlusToken &&
      ts.isStringLiteral(no.left)
    ) {
      // `"no " + organizacao`: a concatenação também monta frase. O literal da esquerda entra aqui, com o
      // que vem depois dele, e não de novo na descida.
      trechos.push({ arquivo, linha: linha(no.left), texto: no.left.text, antesDe: no.right.getText(fonte) });
      visitar(no.right);
      return;
    }
    ts.forEachChild(no, visitar);
  }

  visitar(fonte);
  return trechos;
}

const ehFichaPermitida = (texto: string) =>
  FICHA_DE_CODIGO.test(texto) && FICHAS_PERMITIDAS.some((ficha) => ficha.test(texto));

describe("as palavras que vazaram para a tela — item 126, critério 6", () => {
  it("a lista de módulos é a do item, e cada um existe e tem texto", () => {
    expect(MODULOS.length).toBeGreaterThanOrEqual(21);
    for (const arquivo of MODULOS) expect(trechosDeTexto(arquivo).length, arquivo).toBeGreaterThan(0);
  });

  it("nenhum texto diz vínculo, servidor, corte, recorte, identificador, dashboard ou provedor", () => {
    const achados = MODULOS.flatMap(trechosDeTexto)
      .filter((t) => PALAVRAS.test(semAcento(t.texto)) && !ehFichaPermitida(t.texto))
      .map((t) => `${t.arquivo}:${String(t.linha)} «${t.texto}»`);
    expect(achados).toStrictEqual([]);
  });

  it("nenhum texto põe no/do antes do nome da organização", () => {
    const achados = MODULOS.flatMap(trechosDeTexto)
      .filter((t) => t.antesDe !== undefined && /organiza/iu.test(semAcento(t.antesDe)) && ARTIGO_NO_FIM.test(t.texto))
      .map((t) => `${t.arquivo}:${String(t.linha)} «${t.texto}\${${t.antesDe ?? ""}}»`);
    expect(achados).toStrictEqual([]);
  });

  /**
   * **A prova de que o teste não lê comentário e de que ele morde.** As duas metades do critério só valem se
   * o analisador separar as duas coisas: uma fonte com a palavra só no comentário passa, a mesma palavra
   * num literal é achada, e o *no* antes da organização também.
   */
  it("o analisador ignora o comentário e o código do ${…}, e acha a palavra e o artigo no texto", () => {
    const palavras = (codigo: string) =>
      trechosDaFonte("prova.ts", codigo)
        .filter((t) => PALAVRAS.test(semAcento(t.texto)))
        .map((t) => t.texto);
    const artigos = (codigo: string) =>
      trechosDaFonte("prova.ts", codigo).filter(
        (t) => t.antesDe !== undefined && /organiza/iu.test(t.antesDe) && ARTIGO_NO_FIM.test(t.texto),
      ).length;

    // Comentário em português com as palavras todas: nada.
    expect(palavras('/** O vínculo do servidor, no recorte do dashboard. */\nexport const A = "Tudo certo.";')).toStrictEqual([]);
    // `corte` como nome de variável dentro do `${…}`: nada.
    expect(palavras("const corte = 3;\nexport const B = `Há ${String(corte)} dias.`;")).toStrictEqual([]);
    // O nome de propriedade e o caminho do import também não são texto.
    expect(palavras('import { x } from "./vinculo";\nexport const C = { "recorte": x };')).toStrictEqual([]);
    // A mesma palavra num literal, numa ponta de molde ou num pedaço de concatenação: achada.
    expect(palavras('export const D = "Este vínculo não existe mais.";')).toStrictEqual(["Este vínculo não existe mais."]);
    expect(palavras("export const E = (n: string) => `O servidor de ${n} caiu.`;")).toStrictEqual(["O servidor de "]);
    // O artigo antes da organização, no molde e na soma; e "em", que concorda com todo nome, passa.
    expect(artigos("export const F = (organizacao: string) => `Você já participa do ${organizacao}.`;")).toBe(1);
    expect(artigos('export const G = (organizacao: string) => "Entrar no " + organizacao;')).toBe(1);
    expect(artigos("export const H = (organizacao: string) => `Entrar em ${organizacao}?`;")).toBe(0);
  });
});
