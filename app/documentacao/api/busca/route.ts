import { createFromSource } from "fumadocs-core/search/server";

import { source } from "@/interface/documentacao/source";

/**
 * A busca da documentação.
 *
 * O índice é montado a partir das páginas na primeira consulta, e fica em memória enquanto o container
 * vive. O tokenizador padrão do Fumadocs já trata português.
 */
export const { GET } = createFromSource(source);
