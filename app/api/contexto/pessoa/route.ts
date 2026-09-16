import { corrigirPessoa } from "@/aplicacao/contexto";
import { FormatoInvalido, semOrganizacao } from "@/interface/http";
import { correcaoDePessoaSchema } from "@/interface/schemas";

/**
 * `PATCH /contexto/pessoa` — *corrigir os próprios dados* (contrato §8.0), item 49.
 *
 * **O QUINTO endpoint da lista fechada da §4.4, e a emenda é declarada.** `pessoas` é tabela global: não
 * tem `organizacao_id`, e **não há filtro que o repositório escopado possa aplicar nela** (modelo §6.2).
 * Das duas portas do anel externo, só `semOrganizacao` entrega `portasGlobais` — `comContexto` não as
 * entrega de propósito, e está escrito na própria função. A revisão explícita que o contrato exige está
 * na spec §3.2, e o caminho deste arquivo entra em `eslint.config.mjs` por isso.
 *
 * **Singular, e sem `{pessoaId}`.** O singular é obrigatório: a regra 2 do `verificar:openapi` recusa
 * qualquer caminho que case com `pessoas`, e `pessoa` não casa. A ausência do identificador é o
 * **mecanismo de isolamento** — sem valor a passar, alterar os dados de outra pessoa não é improvável,
 * é impossível. É o mesmo argumento com que a §4.2 recusou `/organizacoes/{orgId}/ocorrencias`.
 *
 * **Sem `403`:** `Permissao` é atributo do `Vinculo` (contrato §4.5), e este endpoint roda sem vínculo —
 * o mesmo caso de `POST /pedidos-de-entrada`. **Sem `404`:** a Pessoa é a da sessão, e `resolverContexto`
 * garante que ela existe. **Sem `409`:** não há `UNIQUE` sobre `pessoas.nome`, e não deve haver.
 *
 * **Sem `X-Organizacao-Id`:** a afirmação de organização só roda dentro do `comContexto`, e não haveria
 * o que afirmar — renomear a si mesmo não é ato **dentro** de uma organização.
 *
 * **A resposta é `PessoaReferencia`, e não há projeção.** O schema publicado é `{ pessoaId, nome }`, que
 * é exatamente o que a porta devolve: uma função de projeção aqui copiaria campo a campo o que já está
 * na forma certa.
 */
export const PATCH = semOrganizacao(
  { corpo: correcaoDePessoaSchema },
  async ({ ctx, corpo, portasGlobais }) => {
    // **Recusado aqui, e não no schema:** *"informe ao menos um campo"* é regra do endpoint, e é a mesma
    // divisão de `PATCH /organizacoes` e `PATCH /areas/{areaId}`.
    if (corpo.nome === undefined) {
      throw new FormatoInvalido([
        {
          campo: "corpo",
          codigo: "OBRIGATORIO",
          mensagem: "Informe ao menos um campo para alterar.",
        },
      ]);
    }

    return corrigirPessoa(portasGlobais.pessoas, { pessoaId: ctx.pessoaId, nome: corpo.nome });
  },
);

/** Escala a zero e cookie de sessão: nada aqui é cacheável (RNF5). */
export const dynamic = "force-dynamic";
