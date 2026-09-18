import { createFromSource } from "fumadocs-core/search/server";

import { source } from "@/interface/documentacao/source";

/**
 * A busca da documentação.
 *
 * O índice é montado a partir das páginas na primeira consulta, e fica em memória enquanto o container
 * vive. O tokenizador padrão do Fumadocs já trata português.
 *
 * ---------------------------------------------------------------------------
 *  Por que o índice voltou a ser o conjunto inteiro de páginas
 * ---------------------------------------------------------------------------
 *
 * Durante a troca da estrutura houve uma lista de exclusão aqui: cada página substituída saía da barra
 * lateral e o arquivo dela ficava, porque as páginas ainda não trocadas apontavam para ela às centenas.
 * Um arquivo que continua existindo continua sendo compilado, e continuaria sendo indexado — e a busca
 * seria a única superfície capaz de levar o leitor a um endereço que a navegação não mostra mais.
 *
 * Os arquivos substituídos foram apagados quando o último ponteiro sumiu, então não há o que excluir: o
 * que está em `docs/` é o que está na navegação, e o verificador de tom falha se os dois divergirem.
 */
export const { GET } = createFromSource(source);
