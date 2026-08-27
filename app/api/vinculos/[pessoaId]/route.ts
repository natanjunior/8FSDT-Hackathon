import { corrigirVinculo } from "@/aplicacao/organizacao";
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
 * O `DELETE` deste mesmo caminho é o item 10.
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

/** Escala a zero e cookie de sessão: nada aqui é cacheável (RNF5). */
export const dynamic = "force-dynamic";
