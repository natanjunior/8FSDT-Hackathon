import type { ConvitePessoalVivo, RepositorioEscopadoDeConvitesPessoais } from "@/aplicacao/organizacao";
import type { ConsultaEscopada, TransacaoEscopada } from "@/infraestrutura/contexto";

/**
 * ============================================================================
 *  O convite pessoal, do lado do Gestor — item 121
 * ============================================================================
 *
 * **Toda consulta filtra `organizacao_id = $1`**, como todo repositório escopado. O token sai daqui em
 * claro, e a razão é a da migração 022: ele não concede acesso novo, e só quem tem `vinculo.gerir` chega a
 * esta porta.
 */

type LinhaDoVivo = {
  token: string;
  criado_em: Date;
  criado_por_pessoa_id: string;
  criado_por_nome: string;
};

const SELECIONAR_VIVO = `
  select c.token, c.criado_em, c.criado_por_pessoa_id, p.nome as criado_por_nome
    from convites_pessoais c
    join pessoas p on p.id = c.criado_por_pessoa_id
   where c.organizacao_id = $1 and c.pessoa_id = $2
     and c.invalidado_em is null and c.aceito_em is null`;

function projetar(linha: LinhaDoVivo): ConvitePessoalVivo {
  return {
    token: linha.token,
    criadoEm: linha.criado_em.toISOString(),
    criadoPor: { pessoaId: linha.criado_por_pessoa_id, nome: linha.criado_por_nome },
  };
}

export function repositorioEscopadoDeConvitesPessoais(
  consulta: ConsultaEscopada,
  emTransacao: TransacaoEscopada,
): RepositorioEscopadoDeConvitesPessoais {
  return {
    async vivoDe(pessoaId) {
      const [linha] = await consulta<LinhaDoVivo>(SELECIONAR_VIVO, [pessoaId]);
      return linha === undefined ? null : projetar(linha);
    },

    /**
     * **`on conflict … do nothing` e depois relê**, e é isso que torna a garantia idempotente no banco:
     * duas aberturas simultâneas do modal batem no índice parcial, a segunda não insere, e as duas leem o
     * mesmo vivo. Uma checagem-e-depois-insere perderia a corrida.
     */
    async garantir(pessoaId, token, porPessoaId) {
      await consulta(
        `insert into convites_pessoais (organizacao_id, pessoa_id, token, criado_por_pessoa_id)
              values ($1, $2, $3, $4)
         on conflict (organizacao_id, pessoa_id)
               where invalidado_em is null and aceito_em is null
         do nothing`,
        [pessoaId, token, porPessoaId],
      );
      const [linha] = await consulta<LinhaDoVivo>(SELECIONAR_VIVO, [pessoaId]);
      if (linha === undefined) throw new Error("garantir não achou o vivo depois do insert — invariante violada");
      return projetar(linha);
    },

    async renovar(pessoaId, token, porPessoaId) {
      return emTransacao<ConvitePessoalVivo>(async (dentro) => {
        await dentro(
          `update convites_pessoais set invalidado_em = now()
            where organizacao_id = $1 and pessoa_id = $2
              and invalidado_em is null and aceito_em is null`,
          [pessoaId],
        );
        await dentro(
          `insert into convites_pessoais (organizacao_id, pessoa_id, token, criado_por_pessoa_id)
           values ($1, $2, $3, $4)`,
          [pessoaId, token, porPessoaId],
        );
        const [linha] = await dentro<LinhaDoVivo>(SELECIONAR_VIVO, [pessoaId]);
        if (linha === undefined) throw new Error("renovar não achou o vivo — invariante violada");
        return projetar(linha);
      });
    },
  };
}
