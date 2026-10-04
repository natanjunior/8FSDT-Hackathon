import type {
  ConvitePessoalPorToken,
  LeituraDeConvitesPessoais,
  RepositorioDeConvitesPessoais,
  ResultadoDoAceite,
} from "@/aplicacao/organizacao";
import type { Papel } from "@/dominio/organizacao";
import type { Consulta, Transacao } from "@/infraestrutura/clientes";

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

type ConviteTravado = {
  id: string;
  organizacao_id: string;
  pessoa_id: string;
  papel: Papel;
  area_id: string | null;
};

/**
 * **A leitura e as escritas**, para as portas globais (com sessão). Espalha a leitura e soma o aceite.
 *
 * A transação é a global, e a organização passa explícita em cada instrução, como em
 * `pedidos-de-entrada.ts`: no instante do aceite a conta pode não ter organização ativa nenhuma.
 */
export function repositorioDeConvitesPessoais(
  consulta: Consulta,
  emTransacao: Transacao,
): RepositorioDeConvitesPessoais {
  return {
    ...leituraDeConvitesPessoais(consulta),

    /**
     * **A fusão** (item 121, spec §3.7). Uma transação, com o convite travado, e **a ordem é a garantia**:
     * os filhos são reapontados antes de o vínculo da P1 ser apagado, porque três chaves para `vinculos`
     * apagam em cascata e esquecer uma delas não dá erro — apaga dado. `chaves-da-fusao.ts` lista o que
     * esta função tem de cobrir, e o teste de catálogo reprova o que ninguém classificou.
     *
     * **Erro do banco não é traduzido.** Sobe, a transação desfaz tudo, e a tela diz que não foi possível
     * (critério 4). Os dois desfechos de domínio — não vale, já participa — voltam sem escrita nenhuma.
     */
    async aceitar(token, p2) {
      return emTransacao<ResultadoDoAceite>(async (sql) => {
        // 1 · confere, e trava: dois aceites simultâneos do mesmo link não fundem duas vezes.
        const [convite] = await sql<ConviteTravado>(
          `select c.id, c.organizacao_id, c.pessoa_id, v.papel, v.area_id
             from convites_pessoais c
             join vinculos v on v.pessoa_id = c.pessoa_id and v.organizacao_id = c.organizacao_id
             join pessoas p  on p.id = c.pessoa_id
            where c.token = $1
              and c.invalidado_em is null and c.aceito_em is null
              and v.revogado_em is null
              and p.usuario_id is null
              for update of c`,
          [token],
        );
        if (convite === undefined || convite.pessoa_id === p2) return { desfecho: "nao-vale" };
        const { id, organizacao_id: org, pessoa_id: p1, papel, area_id: area } = convite;

        // 2 e 3 · a conta já tem vínculo aqui? Ativo é o caso 2, que recusa; revogado é readmitido.
        const [existente] = await sql<{ revogado_em: Date | null }>(
          `select revogado_em from vinculos where pessoa_id = $1 and organizacao_id = $2 for update`,
          [p2, org],
        );
        if (existente !== undefined && existente.revogado_em === null) return { desfecho: "ja-participa" };

        if (existente !== undefined) {
          // O mesmo `update` da aprovação de pedido (`pedidos-de-entrada.ts`): o cadastro da P1 é aprovação
          // de Gestor da mesma natureza, e o produto não tem duas regras para readmitir.
          await sql(
            `update vinculos set papel = $3, area_id = $4, revogado_em = null, criado_em = now()
              where pessoa_id = $1 and organizacao_id = $2`,
            [p2, org, papel, area],
          );
        } else {
          // 4 · o vínculo da P2 nasce com o papel e a unidade do cadastro.
          await sql(`insert into vinculos (pessoa_id, organizacao_id, papel, area_id) values ($1, $2, $3, $4)`, [
            p2,
            org,
            papel,
            area,
          ]);
        }

        // 5 · aceito antes de reapontar: o índice de um vivo por vínculo não pode ver dois na P2.
        await sql(`update convites_pessoais set aceito_em = now() where id = $1`, [id]);
        await sql(
          `update atribuicoes set responsavel_pessoa_id = $3
            where organizacao_id = $1 and responsavel_pessoa_id = $2`,
          [org, p1, p2],
        );
        // A readmitida já tem os compartilhamentos antigos dela: fica o da P2, e o da P1 sai.
        await sql(
          `delete from compartilhamentos c1
            where c1.organizacao_id = $1 and c1.com_pessoa_id = $2
              and exists (select 1 from compartilhamentos c2
                           where c2.ocorrencia_id = c1.ocorrencia_id and c2.com_pessoa_id = $3)`,
          [org, p1, p2],
        );
        await sql(
          `update compartilhamentos set com_pessoa_id = $3
            where organizacao_id = $1 and com_pessoa_id = $2`,
          [org, p1, p2],
        );
        await sql(
          `update vinculos_etiquetas set pessoa_id = $3
            where organizacao_id = $1 and pessoa_id = $2`,
          [org, p1, p2],
        );
        // Todos os convites do vínculo, vivos e mortos: os envios do item 122 seguem pelo `id`.
        await sql(
          `update convites_pessoais set pessoa_id = $3
            where organizacao_id = $1 and pessoa_id = $2`,
          [org, p1, p2],
        );

        // 6 · os contatos: os da conta ficam na ordem que têm; os do cadastro vão para depois, sem repetir
        // o mesmo endereço (e-mail comparado em minúsculas). A preferência da própria pessoa vence.
        await sql(
          `insert into contatos (pessoa_id, tipo, valor, finalidade, tem_whatsapp, ordem, observacao)
           select $2, c.tipo, c.valor, c.finalidade, c.tem_whatsapp,
                  coalesce((select max(d.ordem) from contatos d where d.pessoa_id = $2), 0)
                    + row_number() over (order by c.ordem),
                  c.observacao
             from contatos c
            where c.pessoa_id = $1
              and not exists (select 1 from contatos d
                               where d.pessoa_id = $2 and d.tipo = c.tipo
                                 and (case when c.tipo = 'email' then lower(d.valor) = lower(c.valor)
                                           else d.valor = c.valor end))`,
          [p1, p2],
        );
        await sql(`delete from contatos where pessoa_id = $1`, [p1]);

        // 7 · o pedido pendente da conta, aprovado pelo cadastro: sem decisor, porque nenhum Gestor o decidiu.
        await sql(
          `update pedidos_de_entrada set situacao = 'aprovado', decidido_em = now()
            where organizacao_id = $1 and pessoa_id = $2 and situacao = 'pendente'`,
          [org, p2],
        );

        // 8 · por último. A P1 fica sem vínculo e sem conta, como a migração 014 prevê.
        await sql(`delete from vinculos where pessoa_id = $1 and organizacao_id = $2`, [p1, org]);

        return { desfecho: "aceito", organizacaoId: org };
      });
    },
  };
}
