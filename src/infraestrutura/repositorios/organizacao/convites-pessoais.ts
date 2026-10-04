import type { ConvitePessoalPorToken, LeituraDeConvitesPessoais } from "@/aplicacao/organizacao";
import type { Papel } from "@/dominio/organizacao";
import type { Consulta } from "@/infraestrutura/clientes";

/**
 * ============================================================================
 *  O convite pessoal, do lado de quem é convidado — item 121 (ADR-0021)
 * ============================================================================
 *
 * **Fora do funil de escopo, e enumerado**, como o convite por código (`convites.ts`). Quem chega aqui não
 * tem organização ativa de onde tirar o escopo: a leitura roda sem sessão, e o aceite parte da conta de
 * quem abre. O que protege a leitura é o que ela seleciona: dois nomes e um papel, e nenhum contato.
 *
 * **O token fica em claro** (migração 022): ele não concede acesso novo, só liga uma conta a um vínculo que
 * o Gestor já aprovou ao cadastrar.
 */

type LinhaPorToken = {
  pessoa_id: string;
  organizacao_id: string;
  nome_da_pessoa: string;
  nome_da_organizacao: string;
  papel: Papel;
};

/**
 * **A leitura, e só ela.** É o que o `semSessao` recebe: o objeto não tem método de escrita, e não só no
 * tipo.
 */
export function leituraDeConvitesPessoais(consulta: Consulta): LeituraDeConvitesPessoais {
  return {
    async vivoPorToken(token): Promise<ConvitePessoalPorToken | null> {
      const [linha] = await consulta<LinhaPorToken>(
        `select c.pessoa_id, c.organizacao_id, p.nome as nome_da_pessoa, o.nome as nome_da_organizacao, v.papel
           from convites_pessoais c
           join vinculos v      on v.pessoa_id = c.pessoa_id and v.organizacao_id = c.organizacao_id
           join pessoas p       on p.id = c.pessoa_id
           join organizacoes o  on o.id = c.organizacao_id
          where c.token = $1
            and c.invalidado_em is null and c.aceito_em is null
            and v.revogado_em is null
            and p.usuario_id is null`,
        [token],
      );
      return linha === undefined
        ? null
        : {
            pessoaId: linha.pessoa_id,
            organizacaoId: linha.organizacao_id,
            nomeDaPessoa: linha.nome_da_pessoa,
            nomeDaOrganizacao: linha.nome_da_organizacao,
            papel: linha.papel,
          };
    },
  };
}
