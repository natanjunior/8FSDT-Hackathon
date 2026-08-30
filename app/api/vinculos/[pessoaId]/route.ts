import { corrigirVinculo, removerVinculo } from "@/aplicacao/organizacao";
import { CampoNaoSuportado, FormatoInvalido, comContexto } from "@/interface/http";
import { projetarVinculo } from "@/interface/projecoes";
import { correcaoDeVinculoSchema } from "@/interface/schemas";

/**
 * **`PATCH /vinculos/{pessoaId}` — corrigir os dados de um vínculo.**
 *
 * A Pessoa é endereçada **através do vínculo**, dentro da organização ativa. Não existe endereço global de
 * Pessoa, e é isso que impede a consulta que a §4.3 do modelo proíbe.
 *
 * **Duas recusas acontecem aqui, antes da Aplicação, e a ordem entre elas é decisão:**
 *
 * 1. **`papel` → `422 CAMPO_NAO_SUPORTADO`.** Vem primeiro porque é a resposta mais informativa: quem
 *    mandou `{ papel }` sozinho precisa saber que o campo não é aceito, não que faltou preencher algo.
 * 2. **Corpo sem nada a corrigir → `400 FORMATO_INVALIDO`.** É o `minProperties: 1` do contrato.
 *
 * **E `{ "contatos": [] }` é corpo válido, não vazio:** ele diz *remova todos*. Quem colapsar vazio com
 * ausente aqui apaga o contato de quem só queria corrigir a unidade.
 *
 * O `DELETE` deste mesmo caminho é o item 10, e está logo abaixo.
 */
export const PATCH = comContexto(
  { exige: "vinculo.gerir", corpo: correcaoDeVinculoSchema },
  async ({ repos, corpo, parametros }) => {
    if (corpo.papel !== undefined) throw new CampoNaoSuportado(["papel"]);

    // `"areaId" in corpo` e não `corpo.areaId !== undefined`: `null` é um valor — *tire a unidade* — e
    // ausência é *não mexa*. `contatos` usa `=== undefined` porque `null` não é valor válido dele: ou vem
    // lista, ou não vem.
    if (corpo.nome === undefined && !("areaId" in corpo) && corpo.contatos === undefined) {
      throw new FormatoInvalido([
        {
          campo: "corpo",
          codigo: "OBRIGATORIO",
          mensagem: "Informe ao menos um campo para corrigir.",
        },
      ]);
    }

    const vinculo = await corrigirVinculo(repos.vinculos, {
      pessoaId: parametros["pessoaId"] ?? "",
      ...(corpo.nome === undefined ? {} : { nome: corpo.nome }),
      ...("areaId" in corpo ? { areaId: corpo.areaId ?? null } : {}),
      ...(corpo.contatos === undefined ? {} : { contatos: corpo.contatos }),
    });

    return projetarVinculo(vinculo);
  },
);

/**
 * **`DELETE /vinculos/{pessoaId}` — o único `DELETE` do contrato** (§8.2, P6), e o conserto do **PA-25**.
 *
 * **Não declara `corpo`, e isso tem três consequências que valem escrever.** `lerCorpo` devolve
 * `undefined` sem sequer olhar o `content-type` (`com-contexto.ts:364`), então o cabeçalho que
 * `cabecalhosDeEscrita` manda é inofensivo; não há `415`; e não há `400` — que é exatamente a lista de
 * respostas que o `openapi.yaml:706-731` publica.
 *
 * **O `204` sai de graça:** o handler não devolve nada, e `montarResposta` transforma corpo ausente com
 * status 200 em `204` sem `content-type` (`com-contexto.ts:478-490`). Escrever `resposta(null, { status:
 * 204 })` daria o mesmo resultado por um caminho mais longo.
 *
 * **A ordem das recusas é a de sempre:** `401` → `403 PERMISSAO_INSUFICIENTE` (no `comContexto`, antes de
 * o recurso ser tocado) → `409 ORGANIZACAO_DIVERGENTE` (a afirmação da §4.3) → `404` / `409` da Aplicação.
 */
export const DELETE = comContexto({ exige: "vinculo.gerir" }, async ({ repos, parametros }) => {
  await removerVinculo(repos.vinculos, parametros["pessoaId"] ?? "");
});

/** Escala a zero e cookie de sessão: nada aqui é cacheável (RNF5). */
export const dynamic = "force-dynamic";
