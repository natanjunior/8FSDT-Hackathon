import { loader } from "fumadocs-core/source";
import { docs } from "@fonte/documentacao";

/**
 * ============================================================================
 *  A árvore de páginas da documentação
 * ============================================================================
 *
 * O `.source/` é gerado pelo `fumadocs-mdx` a partir do `source.config.ts`, e não é versionado. Quem o
 * produz é o `postinstall` do `package.json`, então um clone limpo o tem antes do primeiro `next build`.
 *
 * ---------------------------------------------------------------------------
 *  Dois detalhes de fronteira, e os dois são consequência de regra existente
 * ---------------------------------------------------------------------------
 *
 * **Por que este arquivo mora em `src/interface/` e não ao lado da rota.** A regra 3 da
 * [ADR-0006](../../../docs/adr/0006-organizacao-de-modulos.md) proíbe importação relativa para fora do
 * diretório, e exige o apelido, *"porque o lint lê o especificador, não o caminho resolvido"*. Uma pasta
 * de apoio dentro de `app/documentacao/` obrigaria a rota a fazer `../mdx`, que é o que a regra recusa.
 * Em `src/interface/`, que é a metade adaptadora da camada de Interface, a rota a alcança por `@/`.
 *
 * **Por que existe o apelido `@fonte/documentacao`.** O `.source/` fica na raiz, e alcançá-lo daqui seria
 * `../../../.source/server` — a mesma regra de novo. O apelido no `tsconfig.json` resolve pelo caminho
 * que a regra pede, em vez de por exceção a ela.
 */
export const source = loader({
  baseUrl: "/documentacao",
  source: docs.toFumadocsSource(),
});
