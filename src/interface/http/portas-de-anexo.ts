import type { PortasDeAnexo } from "@/aplicacao/anexo";
import { montarPortasDeAnexo } from "@/composicao";

/**
 * **A única ponte entre `app/` e as duas portas do anexo**, e ela é de uso restrito.
 *
 * `comContexto` entrega `RepositoriosEscopados`, e só; `PortasGlobais` chega apenas pelas quatro operações
 * da §4.4, cuja lista o lint fecha. As portas do anexo não cabem em nenhum dos dois conjuntos: o emissor
 * não tem escopo a ter, e o livro-caixa é **global de propósito**.
 *
 * **A proteção é a mesma que a §4.4 usa, e pelo mesmo motivo.** `eslint.config.mjs` permite importar
 * `portasDeAnexo` em **um** arquivo — `app/api/anexos/autorizacoes/route.ts`. Um segundo endpoint que
 * queira assinar SAS não é caso a resolver no código: é uma linha naquele arquivo, escrita por quem
 * decidir que ele deve existir.
 *
 * **O que isto não afrouxa:** o endpoint continua escopado. Ele passa por `comContexto`, exige
 * `ocorrencia.registrar` e recebe `ctx` como qualquer outro — a `pessoaId` que o livro-caixa conta vem da
 * sessão resolvida, nunca do cliente.
 */
export function portasDeAnexo(): PortasDeAnexo {
  return montarPortasDeAnexo();
}
