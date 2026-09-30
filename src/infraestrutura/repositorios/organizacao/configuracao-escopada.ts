import type {
  AlteracaoDeConfiguracao,
  ChaveDeConfiguracao,
  ConfiguracaoLida,
  RepositorioEscopadoDaConfiguracao,
} from "@/aplicacao/organizacao";
import type { LimiteDeCancelamentoDoSolicitante } from "@/dominio/ocorrencia";
import type { ConsultaEscopada } from "@/infraestrutura/contexto";

/**
 * `GET` e `PATCH /configuracao` — as regras da organização ativa e a trilha delas (item 99).
 *
 * **O `where` é `id = $1` em `organizacoes` e `organizacao_id = $1` na trilha**, e `$1` é injetado pelo
 * ponto único: este arquivo não recebe o identificador.
 *
 * **A escrita não toca `mudancas_de_configuracao`.** Quem grava a linha é o gatilho da migração 017, com
 * o `OLD` da linha travada — é o que faz a segunda de duas escritas simultâneas registrar o valor que a
 * primeira deixou. **`atualizado_por_pessoa_id` vai sempre na instrução**: é dele que o gatilho tira o
 * autor, e sem ele o banco recusa.
 *
 * **A leitura das mudanças parte de `vinculos`** para chegar ao nome, como toda leitura de gente.
 */
export function repositorioEscopadoDaConfiguracao(
  consulta: ConsultaEscopada,
): RepositorioEscopadoDaConfiguracao {
  async function ler(): Promise<ConfiguracaoLida> {
    const linhas = await consulta<LinhaDasRegras>(
      `select exigir_solucao_ao_resolver, limite_cancelamento_solicitante
         from organizacoes
        where id = $1`,
    );
    const regras = linhas[0];
    // **Zero linhas não é desfecho de domínio.** `$1` é a organização da sessão, e a sessão só existe
    // porque um vínculo dela foi lido. Sem linha, o banco está em outro estado.
    if (regras === undefined) throw new Error("a organização da sessão não devolveu linha");

    const mudancas = await consulta<LinhaDaMudanca>(
      `select m.chave, m.valor_anterior, m.valor_novo, m.ocorrida_em, m.autor_pessoa_id, p.nome as autor_nome
         from mudancas_de_configuracao m
         join vinculos v on v.pessoa_id = m.autor_pessoa_id and v.organizacao_id = m.organizacao_id
         join pessoas  p on p.id = v.pessoa_id
        where m.organizacao_id = $1
        order by m.ocorrida_em desc, m.chave`,
    );

    return {
      regras: {
        exigirSolucaoAoResolver: regras.exigir_solucao_ao_resolver,
        limiteDeCancelamentoDoSolicitante: regras.limite_cancelamento_solicitante,
      },
      mudancas: mudancas.map((m) => ({
        chave: m.chave,
        valorAnterior: m.valor_anterior,
        valorNovo: m.valor_novo,
        autor: { pessoaId: m.autor_pessoa_id, nome: m.autor_nome },
        ocorridaEm: m.ocorrida_em.toISOString(),
      })),
    };
  }

  return {
    ler,
    async alterar(alteracao: AlteracaoDeConfiguracao): Promise<ConfiguracaoLida> {
      const valores: unknown[] = [];
      // `$1` é a organização, amarrado pelo ponto único — os parâmetros de quem chama começam em `$2`.
      const marcador = (valor: unknown): string => {
        valores.push(valor);
        return `$${String(valores.length + 1)}`;
      };

      const atribuicoes: string[] = [];
      if (alteracao.exigirSolucaoAoResolver !== undefined) {
        atribuicoes.push(`exigir_solucao_ao_resolver = ${marcador(alteracao.exigirSolucaoAoResolver)}`);
      }
      if (alteracao.limiteDeCancelamentoDoSolicitante !== undefined) {
        atribuicoes.push(
          `limite_cancelamento_solicitante = ${marcador(
            alteracao.limiteDeCancelamentoDoSolicitante,
          )}::status_ocorrencia`,
        );
      }
      atribuicoes.push(`atualizado_por_pessoa_id = ${marcador(alteracao.atualizadaPorPessoaId)}`);

      await consulta(`update organizacoes set ${atribuicoes.join(", ")} where id = $1`, valores);
      return ler();
    },
  };
}

type LinhaDasRegras = {
  exigir_solucao_ao_resolver: boolean;
  limite_cancelamento_solicitante: LimiteDeCancelamentoDoSolicitante;
};

type LinhaDaMudanca = {
  chave: ChaveDeConfiguracao;
  valor_anterior: string;
  valor_novo: string;
  ocorrida_em: Date;
  autor_pessoa_id: string;
  autor_nome: string;
};
