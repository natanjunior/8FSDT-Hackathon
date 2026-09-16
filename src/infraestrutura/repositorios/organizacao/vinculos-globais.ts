import type { RepositorioGlobalDeVinculos, VinculoNaOrganizacao } from "@/aplicacao/contexto";
import { Vinculo, ehPapel } from "@/dominio/organizacao";
import type { Consulta } from "@/infraestrutura/clientes";

/**
 * Implementa a porta que roda **fora** do escopo de organização — uma das cinco exceções enumeradas
 * (contrato §4.4 · ADR-0003).
 *
 * Duas coisas a conferir na revisão, e as duas estão no Definition of Done:
 *
 * 1. **A consulta parte de `vinculos`** e faz `JOIN` para `organizacoes`. Nunca o contrário, e nunca de
 *    `pessoas` — que é global e não tem coluna de organização para filtrar (contrato §4.6, modelo §4.3).
 * 2. **Devolve agregado**, não linha: `Vinculo` mais um resumo declarado da Organização.
 */
export function repositorioGlobalDeVinculos(consulta: Consulta): RepositorioGlobalDeVinculos {
  return {
    async ativosDaPessoa(pessoaId) {
      const linhas = await consulta<{
        pessoa_id: string;
        organizacao_id: string;
        papel: string;
        organizacao_nome: string;
        codigo_publico: string;
      }>(
        `select v.pessoa_id,
                v.organizacao_id,
                v.papel,
                o.nome          as organizacao_nome,
                o.codigo_publico
           from vinculos v
           join organizacoes o on o.id = v.organizacao_id
          where v.pessoa_id = $1
            and v.revogado_em is null
          order by o.nome`,
        [pessoaId],
      );

      return linhas.map((linha): VinculoNaOrganizacao => {
        if (!ehPapel(linha.papel)) {
          // O tipo `papel_vinculo` do banco e o do domínio saíram da mesma decisão (D4, D27). Se
          // divergirem, é migração aplicada sem código — falha alto, não em silêncio.
          throw new Error(`papel desconhecido vindo do banco: ${linha.papel}`);
        }
        return {
          vinculo: Vinculo.de(linha.pessoa_id, linha.organizacao_id, linha.papel),
          organizacao: {
            id: linha.organizacao_id,
            nome: linha.organizacao_nome,
            codigoPublico: linha.codigo_publico,
          },
        };
      });
    },
  };
}
