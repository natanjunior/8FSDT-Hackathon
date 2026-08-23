import type { AreaLida, RepositorioEscopadoDeAreas } from "@/aplicacao/organizacao";
import { ehTipoDeArea } from "@/dominio/organizacao";
import type { ConsultaEscopada } from "@/infraestrutura/contexto";

/**
 * `GET /areas` — a segunda leitura que precede o registro. *Localização* é uma Área mais um complemento
 * em texto (D10), e é da Área que a visibilidade deriva.
 *
 * **`ordem` existe por medição:** o campo de Área custa ~12 s do orçamento de 60 do RNF6, e é o único
 * conserto que atua no **primeiro** registro de cada pessoa — busca e *"usadas recentemente"* só ajudam do
 * segundo em diante.
 */
export function repositorioEscopadoDeAreas(consulta: ConsultaEscopada): RepositorioEscopadoDeAreas {
  return {
    async listar({ apenasAtivas }) {
      const linhas = await consulta<{
        id: string;
        nome: string;
        tipo: string;
        ativa: boolean;
        ordem: number;
      }>(
        `select id, nome, tipo, ativa, ordem
           from areas
          where organizacao_id = $1
            and (ativa or not $2::boolean)
          order by ordem, nome`,
        [apenasAtivas],
      );

      return linhas.map((linha): AreaLida => {
        if (!ehTipoDeArea(linha.tipo)) {
          // O tipo `tipo_area` do banco e o do domínio saíram da mesma decisão (D10, D18). Se divergirem,
          // é migração aplicada sem código — falha alto, não em silêncio. Mesmo tratamento de `ehPapel`.
          throw new Error(`tipo de área desconhecido vindo do banco: ${linha.tipo}`);
        }
        return {
          id: linha.id,
          nome: linha.nome,
          tipo: linha.tipo,
          ativa: linha.ativa,
          ordem: linha.ordem,
        };
      });
    },
  };
}
