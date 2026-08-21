import type { PessoaReferencia, RepositorioEscopadoDeVinculos } from "@/aplicacao/contexto";
import { Vinculo, ehPapel } from "@/dominio/organizacao";
import type { ConsultaEscopada } from "@/infraestrutura/contexto";

/**
 * Implementa a porta **escopada**.
 *
 * Note o que este arquivo **não** contém: a palavra `organizacao_id` no `where`. Ela está em `$1`, e `$1`
 * é injetado pelo ponto de estrangulamento (`infraestrutura/contexto/escopo.ts`) — o repositório não sabe
 * qual é a organização e **não tem como saber**. É a ADR-0003 levada à assinatura: *o filtro é aplicado em
 * uma função*.
 *
 * A consulta parte de `vinculos` e faz `JOIN` para `pessoas` — a direção que a §4.3 do modelo de dados
 * exige, e a que o critério A4 mede com a mesma Pessoa vinculada a duas organizações.
 */
export function repositorioEscopadoDeVinculos(
  consulta: ConsultaEscopada,
): RepositorioEscopadoDeVinculos {
  return {
    async ativos() {
      const linhas = await consulta<{
        pessoa_id: string;
        organizacao_id: string;
        papel: string;
        pessoa_nome: string;
      }>(
        `select v.pessoa_id,
                v.organizacao_id,
                v.papel,
                p.nome as pessoa_nome
           from vinculos v
           join pessoas p on p.id = v.pessoa_id
          where v.organizacao_id = $1
            and v.revogado_em is null
          order by p.nome`,
      );

      return linhas.map((linha) => {
        if (!ehPapel(linha.papel)) {
          throw new Error(`papel desconhecido vindo do banco: ${linha.papel}`);
        }
        const pessoa: PessoaReferencia = { pessoaId: linha.pessoa_id, nome: linha.pessoa_nome };
        return {
          vinculo: Vinculo.de(linha.pessoa_id, linha.organizacao_id, linha.papel),
          pessoa,
        };
      });
    },
  };
}
