import type {
  EtiquetaLida,
  RepositorioEscopadoDeEtiquetas,
  ResultadoDaAtribuicaoDeEtiqueta,
  ResultadoDaRetiradaDeEtiqueta,
} from "@/aplicacao/organizacao";
import type { ConsultaEscopada, TransacaoEscopada } from "@/infraestrutura/contexto";

/**
 * ============================================================================
 *  As etiquetas dos participantes — item 115
 * ============================================================================
 *
 * **Toda consulta parte de uma tabela escopada e filtra `organizacao_id = $1`.** A junção carrega a
 * organização nas duas chaves compostas, então uma etiqueta de A não se liga a um vínculo de B nem que o
 * código errasse.
 *
 * **A identidade do nome é a do índice** `etiquetas_participante_nome_uq`: `lower(nome collate
 * "und-x-icu")`. A procura depois do `insert` usa a MESMA expressão; outra expressão acharia outra coisa.
 */
export function repositorioEscopadoDeEtiquetas(
  consulta: ConsultaEscopada,
  emTransacao: TransacaoEscopada,
): RepositorioEscopadoDeEtiquetas {
  return {
    listar() {
      return consulta<EtiquetaLida>(
        `select id, nome from etiquetas_participante where organizacao_id = $1 order by nome`,
      );
    },

    async criar(nome) {
      // A mesma dupla do `atribuir`: `on conflict do nothing` sem alvo, e a procura pela MESMA expressão do
      // índice. Dois ao mesmo tempo: um insere, o outro não insere e acha o que o primeiro gravou.
      const criadas = await consulta<EtiquetaLida>(
        `insert into etiquetas_participante (organizacao_id, nome) values ($1, $2)
         on conflict do nothing
         returning id, nome`,
        [nome],
      );
      if (criadas[0] !== undefined) return { etiqueta: criadas[0], criada: true };

      const [existente] = await consulta<EtiquetaLida>(
        `select id, nome from etiquetas_participante
          where organizacao_id = $1 and lower(nome collate "und-x-icu") = lower($2 collate "und-x-icu")`,
        [nome],
      );
      if (existente === undefined) throw new Error("etiqueta nem criada nem encontrada — invariante violada");
      return { etiqueta: existente, criada: false };
    },

    atribuir({ pessoaId, nome, porPessoaId }) {
      return emTransacao<ResultadoDaAtribuicaoDeEtiqueta>(async (dentro) => {
        // **A trava vem antes de qualquer escrita, e é `for update`.** `revogar` faz `update` nesta mesma
        // linha: travada aqui, a revogação espera o `COMMIT` e só então apaga as etiquetas — inclusive a
        // que acabou de entrar. Sem a trava, a etiqueta poderia chegar depois da limpeza e sobreviver à
        // revogação, que é o critério 115.9 quebrado por corrida.
        const ativos = await dentro<{ pessoa_id: string }>(
          `select pessoa_id from vinculos
            where organizacao_id = $1 and pessoa_id = $2 and revogado_em is null
              for update`,
          [pessoaId],
        );
        if (ativos.length === 0) return { desfecho: "nao-encontrado" };

        // `on conflict do nothing` sem alvo: o índice de expressão não serve de alvo nomeado, e a única
        // unicidade que um nome novo pode violar é ele.
        const criadas = await dentro<EtiquetaLida>(
          `insert into etiquetas_participante (organizacao_id, nome) values ($1, $2)
           on conflict do nothing
           returning id, nome`,
          [nome],
        );
        const etiqueta =
          criadas[0] ??
          (
            await dentro<EtiquetaLida>(
              `select id, nome from etiquetas_participante
                where organizacao_id = $1 and lower(nome collate "und-x-icu") = lower($2 collate "und-x-icu")`,
              [nome],
            )
          )[0];
        if (etiqueta === undefined) throw new Error("etiqueta nem criada nem encontrada — invariante violada");

        const atribuidas = await dentro<{ etiqueta_id: string }>(
          `insert into vinculos_etiquetas (organizacao_id, pessoa_id, etiqueta_id, atribuido_por_pessoa_id)
                values ($1, $2, $3, $4)
           on conflict do nothing
           returning etiqueta_id`,
          [pessoaId, etiqueta.id, porPessoaId],
        );

        return atribuidas.length === 0
          ? { desfecho: "ja-tinha", etiqueta }
          : { desfecho: "atribuida", etiqueta, criada: criadas.length > 0 };
      });
    },

    async tirar({ pessoaId, etiquetaId }) {
      const tiradas = await consulta<{ etiqueta_id: string }>(
        `delete from vinculos_etiquetas
          where organizacao_id = $1 and pessoa_id = $2 and etiqueta_id = $3
        returning etiqueta_id`,
        [pessoaId, etiquetaId],
      );
      if (tiradas.length > 0) return { desfecho: "tirada" };

      // Zero linhas, três causas — o movimento do `remover`. **Tirar o que a pessoa não tinha é sucesso**:
      // duas abas tirando a mesma etiqueta terminam no mesmo estado, e a segunda não é erro.
      const [vinculo, etiqueta] = await Promise.all([
        consulta(
          `select 1 from vinculos where organizacao_id = $1 and pessoa_id = $2 and revogado_em is null`,
          [pessoaId],
        ),
        consulta(`select 1 from etiquetas_participante where organizacao_id = $1 and id = $2`, [etiquetaId]),
      ]);
      const desfecho: ResultadoDaRetiradaDeEtiqueta =
        vinculo.length === 0
          ? { desfecho: "vinculo-nao-encontrado" }
          : etiqueta.length === 0
            ? { desfecho: "etiqueta-nao-encontrada" }
            : { desfecho: "tirada" };
      return desfecho;
    },

    async apagar(etiquetaId) {
      const apagadas = await consulta<{ id: string }>(
        `delete from etiquetas_participante where organizacao_id = $1 and id = $2 returning id`,
        [etiquetaId],
      );
      return apagadas.length > 0 ? { desfecho: "apagada" } : { desfecho: "nao-encontrada" };
    },
  };
}
