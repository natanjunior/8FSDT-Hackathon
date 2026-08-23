import type { CategoriaLida, RepositorioEscopadoDeCategorias } from "@/aplicacao/organizacao";
import type { ConsultaEscopada } from "@/infraestrutura/contexto";

/**
 * `GET /categorias` — a leitura que precede o registro, e onde se confirma que a semente nasceu.
 *
 * Note o que este arquivo **não** contém: um valor de organização. `$1` é injetado pelo ponto de
 * estrangulamento, e este repositório **não tem como saber** qual organização é (ADR-0003). Os parâmetros
 * de quem chama começam em `$2`.
 *
 * **Ordem: `ordem`, com desempate alfabético** (contrato §8.1). O `COLLATE "pt-BR-x-icu"` da coluna é o
 * que põe *"Área"* antes de *"Balcão"* — em collation C, o acento iria para o fim.
 */
export function repositorioEscopadoDeCategorias(
  consulta: ConsultaEscopada,
): RepositorioEscopadoDeCategorias {
  return {
    async listar({ apenasAtivas }) {
      const linhas = await consulta<{
        id: string;
        nome: string;
        icone: string;
        ativa: boolean;
        ordem: number;
      }>(
        `select id, nome, icone, ativa, ordem
           from categorias
          where organizacao_id = $1
            and (ativa or not $2::boolean)
          order by ordem, nome`,
        [apenasAtivas],
      );

      return linhas.map(
        (linha): CategoriaLida => ({
          id: linha.id,
          nome: linha.nome,
          icone: linha.icone,
          ativa: linha.ativa,
          ordem: linha.ordem,
        }),
      );
    },
  };
}
