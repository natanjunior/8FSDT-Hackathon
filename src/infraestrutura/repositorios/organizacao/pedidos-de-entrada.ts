import type {
  PedidoDaPessoa,
  RepositorioDePedidosDeEntrada,
  RepositorioGlobalDePedidosDeEntrada,
} from "@/aplicacao/organizacao";
import type { Consulta, Transacao } from "@/infraestrutura/clientes";

/**
 * ============================================================================
 *  `pedidos_de_entrada` — a escrita que roda fora do funil, e a leitura global
 * ============================================================================
 *
 * **Devolve objeto de leitura declarado, nunca a linha** (ADR-0005, parte 3): `observacao`, `decidido_em`
 * e `decidido_por_pessoa_id` existem na tabela e **não saem daqui** — o contrato diz que quem foi recusado
 * recebe `situacao` sem motivo, e um repositório que devolvesse a linha inteira poria a decisão de expor
 * nas mãos de quem projeta.
 */

/**
 * A escrita. **Uma das exatamente duas operações com licença para escrever fora do funil de escopo**
 * (ADR-0003, emenda de 20/08/2026): o `organizacao_id` vem do **Código da Organização apresentado na
 * requisição**, e o código é a credencial daquela escrita e de nenhuma outra. Código de A não cria pedido
 * em B — e é isso que o teste de integração da tarefa 8 confere, porque a regra de lint não o alcança.
 *
 * As três escritas acontecem na **mesma transação**, e a ordem importa: o pedido primeiro. Nome e contato
 * vêm depois para que nenhum desfecho de recusa deixe rastro — a correção do nome é *a última*, e gastá-la
 * num código digitado errado a queimaria.
 */
export function repositorioDePedidosDeEntrada(
  emTransacao: Transacao,
): RepositorioDePedidosDeEntrada {
  return {
    async registrar({ pessoaId, codigoPublico, nome, telefone }) {
      return emTransacao(async (consulta) => {
        const organizacoes = await consulta<{ id: string; nome: string }>(
          `select id, nome from organizacoes where codigo_publico = $1`,
          [codigoPublico],
        );
        const organizacao = organizacoes[0];
        if (organizacao === undefined) return { desfecho: "codigo-nao-encontrado" };

        const vinculos = await consulta<{ pessoa_id: string }>(
          `select pessoa_id
             from vinculos
            where pessoa_id = $1 and organizacao_id = $2 and revogado_em is null`,
          [pessoaId, organizacao.id],
        );
        if (vinculos.length > 0) return { desfecho: "ja-vinculado" };

        // `on conflict do nothing` sem alvo cobre **todos** os índices únicos da tabela — aqui, o parcial
        // `WHERE situacao = 'pendente'`. Zero linhas significa que já havia um pendente.
        const criados = await consulta<{ id: string; criado_em: Date }>(
          `insert into pedidos_de_entrada (organizacao_id, pessoa_id)
                values ($1, $2)
           on conflict do nothing
             returning id, criado_em`,
          [organizacao.id, pessoaId],
        );
        const criado = criados[0];
        if (criado === undefined) return { desfecho: "ja-pendente" };

        if (nome !== null) {
          // **O primeiro `UPDATE` do produto.** A migração 001 deixou ao hub a questão de quem mantém
          // `atualizado_em`; aqui a aplicação o escreve explicitamente, porque não há gatilho e uma coluna
          // de relógio que não anda é pior que a ausência dela.
          await consulta(`update pessoas set nome = $2, atualizado_em = now() where id = $1`, [
            pessoaId,
            nome,
          ]);
        }

        if (telefone !== null) {
          // `ordem` é a cadeia de tentativa, e `UNIQUE (pessoa_id, ordem)` recusa um segundo `1`. Nesta
          // fatia este endpoint é o único produtor de contato, então o `coalesce` sempre cai em 1 — ele
          // existe para que o item 9b não encontre uma bomba.
          //
          // `on conflict do nothing` é a decisão da spec §2.7: telefone já cadastrado **não** derruba o
          // pedido inteiro. `CONTATO_DUPLICADO` é código do item 9b, e não deste endpoint.
          await consulta(
            `insert into contatos (pessoa_id, tipo, valor, finalidade, ordem)
                  values ($1, 'telefone', $2, 'pessoal',
                          coalesce((select max(ordem) + 1 from contatos where pessoa_id = $1), 1))
             on conflict do nothing`,
            [pessoaId, telefone],
          );
        }

        return {
          desfecho: "registrado",
          pedido: {
            id: criado.id,
            organizacao: { nome: organizacao.nome },
            situacao: "pendente",
            criadoEm: criado.criado_em.toISOString(),
          },
        };
      });
    },
  };
}

/**
 * A leitura de `GET /contexto`. **Atravessa organizações de propósito** — é uma das quatro operações da
 * §4.4 —, e **parte de `pedidos_de_entrada` filtrando por `pessoa_id`**, nunca de `pessoas`.
 *
 * Devolve as **três** situações, em `criadoEm` decrescente (spec §2.6).
 */
export function repositorioGlobalDePedidosDeEntrada(
  consulta: Consulta,
): RepositorioGlobalDePedidosDeEntrada {
  return {
    async daPessoa(pessoaId) {
      const linhas = await consulta<{
        id: string;
        situacao: PedidoDaPessoa["situacao"];
        criado_em: Date;
        organizacao_nome: string;
      }>(
        `select p.id, p.situacao, p.criado_em, o.nome as organizacao_nome
           from pedidos_de_entrada p
           join organizacoes o on o.id = p.organizacao_id
          where p.pessoa_id = $1
          order by p.criado_em desc`,
        [pessoaId],
      );

      return linhas.map((linha) => ({
        id: linha.id,
        organizacao: { nome: linha.organizacao_nome },
        situacao: linha.situacao,
        criadoEm: linha.criado_em.toISOString(),
      }));
    },
  };
}
