import { createSearchAPI } from "fumadocs-core/search/server";

import { source } from "@/interface/documentacao/source";

/**
 * A busca da documentação.
 *
 * O índice é montado a partir das páginas na primeira consulta, e fica em memória enquanto o container
 * vive. O tokenizador padrão do Fumadocs já trata português.
 *
 * ---------------------------------------------------------------------------
 *  Por que o índice não é o conjunto inteiro de páginas
 * ---------------------------------------------------------------------------
 *
 * A troca da estrutura é página a página: a nova entra na navegação, e a que ela substitui sai da barra
 * lateral **mas continua no repositório**, porque centenas de links das páginas ainda não trocadas
 * apontam para ela. Arquivo que continua existindo continua sendo compilado, e por isso continuaria
 * sendo indexado.
 *
 * O efeito seria a busca devolver a página velha para quem procura o assunto novo — a única superfície
 * do site capaz de levar o leitor a um endereço que a navegação não mostra mais. Cada linha da lista
 * abaixo sai no dia em que o arquivo correspondente for apagado.
 */
const SUBSTITUIDAS = new Set([
  "/documentacao/arquitetura",
  "/documentacao/definition-of-done",
  "/documentacao/documentacao-da-demanda",
  "/documentacao/escopo",
  "/documentacao/event-storming",
  "/documentacao/fluxos-e-diagramas",
  "/documentacao/premissas-e-questoes-abertas",
  "/documentacao/prototipo-low-fi",
]);

export const { GET } = createSearchAPI("advanced", {
  indexes: () =>
    source
      .getPages()
      .filter((pagina) => !SUBSTITUIDAS.has(pagina.url))
      .map((pagina) => ({
        title: pagina.data.title,
        description: pagina.data.description,
        url: pagina.url,
        id: pagina.url,
        structuredData: pagina.data.structuredData,
      })),
});
