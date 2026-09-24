import type {
  CorrecaoDeOrganizacao,
  OrganizacaoLida,
  RepositorioEscopadoDaOrganizacao,
} from "@/aplicacao/organizacao";
import type { ConsultaEscopada } from "@/infraestrutura/contexto";

/**
 * `PATCH /organizacoes` — a escrita de T-15, e a **única** escrita que este repositório tem.
 *
 * **O `where` é `id = $1`, e não `organizacao_id = $1`, porque a tabela é a própria organização.** O
 * ponto único continua sendo o mesmo: `$1` é injetado por `escoparConsulta`, este arquivo **não recebe**
 * o identificador, e a trava de execução — que exige `$1` na instrução — continua valendo. Não existe
 * valor a passar que alcance outra organização.
 *
 * **A leitura não mora aqui.** O nome e o código da organização ativa já vêm resolvidos no contexto de
 * toda requisição (`resolucao.ativo.organizacao`), e uma consulta a mais custaria uma ida ao banco para
 * ler o que a sessão acabou de ler.
 */
export function repositorioEscopadoDaOrganizacao(
  consulta: ConsultaEscopada,
): RepositorioEscopadoDaOrganizacao {
  return {
    async corrigir(correcao: CorrecaoDeOrganizacao): Promise<OrganizacaoLida> {
      const valores: unknown[] = [];
      // `$1` é a organização, amarrado pelo ponto único — os parâmetros de quem chama começam em `$2`.
      const marcador = (valor: unknown): string => {
        valores.push(valor);
        return `$${String(valores.length + 1)}`;
      };

      const atribuicoes: string[] = [];
      if (correcao.nome !== undefined) atribuicoes.push(`nome = ${marcador(correcao.nome)}`);

      // **O autor entra na própria instrução; o relógio não.** `atualizado_em` é carimbado pelo gatilho
      // da migração `012`, e o *quem* não teria como vir de lá.
      atribuicoes.push(`atualizado_por_pessoa_id = ${marcador(correcao.atualizadaPorPessoaId)}`);

      const linhas = await consulta<LinhaDaOrganizacao>(
        `update organizacoes
            set ${atribuicoes.join(", ")}
          where id = $1
      returning id, nome, codigo_publico`,
        valores,
      );

      const linha = linhas[0];
      // **Zero linhas não é desfecho de domínio.** `$1` é a organização da sessão, e a sessão só existe
      // porque um vínculo dela foi lido. Sem linha, o banco está em outro estado.
      if (linha === undefined) throw new Error("o update de organização não devolveu linha");

      return { id: linha.id, nome: linha.nome, codigoPublico: linha.codigo_publico };
    },
  };
}

type LinhaDaOrganizacao = {
  id: string;
  nome: string;
  codigo_publico: string;
};
