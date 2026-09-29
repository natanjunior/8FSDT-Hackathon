import type { RepositorioDeConvites } from "@/aplicacao/organizacao";
import type { Consulta } from "@/infraestrutura/clientes";

/**
 * ============================================================================
 *  O convite — as duas leituras de `GET /convites/{codigo}` (item 86, ADR-0018)
 * ============================================================================
 *
 * **Fora do funil de escopo, e enumeradas.** Nenhuma das duas tem organização ativa de onde tirar o
 * escopo: a primeira roda sem sessão, a segunda parte da pessoa da sessão. O que as protege é o que elas
 * selecionam: duas colunas na primeira, um booleano na segunda.
 *
 * **Devolve objeto de leitura declarado, nunca a linha** (ADR-0005, parte 3).
 */
export function repositorioDeConvites(consulta: Consulta): RepositorioDeConvites {
  return {
    async porCodigo(codigoPublico) {
      const linhas = await consulta<{ nome: string; codigo_publico: string }>(
        `select nome, codigo_publico from organizacoes where codigo_publico = $1`,
        [codigoPublico],
      );
      const linha = linhas[0];
      return linha === undefined ? null : { nome: linha.nome, codigoPublico: linha.codigo_publico };
    },

    async temPedidoPendente(pessoaId, codigoPublico) {
      const linhas = await consulta<{ existe: boolean }>(
        `select exists (
           select 1
             from pedidos_de_entrada p
             join organizacoes o on o.id = p.organizacao_id
            where p.pessoa_id = $1
              and o.codigo_publico = $2
              and p.situacao = 'pendente'
         ) as existe`,
        [pessoaId, codigoPublico],
      );
      return linhas[0]?.existe === true;
    },
  };
}
