import type {
  PedidoDeEntradaLido,
  RepositorioDePedidosDeEntrada,
  RepositorioEscopadoDePedidosDeEntrada,
  RepositorioGlobalDePedidosDeEntrada,
  ResultadoDaAprovacao,
  ResultadoDaRecusa,
  VinculoCriado,
} from "@/aplicacao/organizacao";
import { ehPapel, ehSituacaoDoPedido, ehTipoDeArea } from "@/dominio/organizacao";
import type { Consulta, Transacao } from "@/infraestrutura/clientes";
import type { ConsultaEscopada, TransacaoEscopada } from "@/infraestrutura/contexto";

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
        //
        // **`telefone_informado` entrou na migração 004**, e é o dado que o Gestor vê em T-08 antes de
        // decidir. Ele é gravado aqui **e** em `contatos` logo abaixo: um é do pedido, escopado e
        // congelado; o outro é da Pessoa, global e permanente (achado A-8-1 do item 8).
        const criados = await consulta<{ id: string; criado_em: Date }>(
          `insert into pedidos_de_entrada (organizacao_id, pessoa_id, telefone_informado)
                values ($1, $2, $3)
           on conflict do nothing
             returning id, criado_em`,
          [organizacao.id, pessoaId, telefone],
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
        situacao: string;
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

      return linhas.map((linha) => {
        if (!ehSituacaoDoPedido(linha.situacao)) {
          throw new Error(`situação de pedido desconhecida vinda do banco: ${linha.situacao}`);
        }
        return {
          id: linha.id,
          organizacao: { nome: linha.organizacao_nome },
          situacao: linha.situacao,
          criadoEm: linha.criado_em.toISOString(),
        };
      });
    },
  };
}

/**
 * ============================================================================
 *  O repositório **escopado** — o que o Gestor lê e decide
 * ============================================================================
 *
 * **Note o que não está aqui:** a palavra `organizacao_id` no `where` com um valor. Ela está em `$1`, e
 * `$1` é injetado pelo ponto de estrangulamento — este arquivo não sabe qual é a organização e **não tem
 * como saber** (ADR-0003).
 *
 * **A consulta parte de `pedidos_de_entrada`, que é escopada, e faz `JOIN` para `pessoas`.** O DoD manda
 * partir de `vinculos` e nunca de `pessoas`; aqui a partida não pode ser `vinculos` porque **quem tem
 * pedido pendente não tem vínculo** — é a D25 inteira. A regra é respeitada no que ela protege: nenhuma
 * consulta parte da tabela global. A defesa é a entrada na suíte de isolamento.
 *
 * **Devolve objeto de leitura declarado, nunca a linha** (ADR-0005): `observacao` existe na tabela e
 * **não sai daqui**, porque nenhum schema do contrato a devolve (achado A-8-2).
 */
export function repositorioEscopadoDePedidosDeEntrada(
  consulta: ConsultaEscopada,
  emTransacao: TransacaoEscopada,
): RepositorioEscopadoDePedidosDeEntrada {
  return {
    async listar({ situacoes }) {
      const linhas = await consulta<LinhaDePedido>(
        `select p.id,
                p.situacao,
                p.criado_em,
                p.decidido_em,
                p.telefone_informado,
                quem.id       as pessoa_id,
                quem.nome     as pessoa_nome,
                decisor.id    as decisor_id,
                decisor.nome  as decisor_nome
           from pedidos_de_entrada p
           join pessoas quem on quem.id = p.pessoa_id
           left join pessoas decisor on decisor.id = p.decidido_por_pessoa_id
          where p.organizacao_id = $1
            and p.situacao = any($2::situacao_pedido_entrada[])
          order by p.criado_em`,
        [situacoes],
      );

      return linhas.map(lerPedido);
    },

    async aprovar({ pedidoId, papel, areaId, decididoPorPessoaId }) {
      // **O argumento de tipo é obrigatório, não estilo.** `TransacaoEscopada` infere `T` do que o
      // trabalho devolve, e sem ele os `desfecho: "aprovado"` dos literais alargam para `string` — o
      // union discriminado deixa de casar com `ResultadoDaAprovacao`, e `npm run tipos` fecha em vermelho.
      return emTransacao<ResultadoDaAprovacao>(async (consulta) => {
        // 1 · A Área, quando informada. **`ativa` nenhuma constraint alcança** — a FK composta pega só a
        // Área de outra organização, e a resposta dos dois casos é a mesma (contrato §6.3).
        if (areaId !== null) {
          const areas = await consulta<{ id: string }>(
            `select id from areas where organizacao_id = $1 and id = $2 and ativa`,
            [areaId],
          );
          if (areas.length === 0) return { desfecho: "area-invalida" };
        }

        // 2 · A decisão. **O `where situacao = 'pendente'` é o que produz o `409`**: zero linhas significa
        // que outro Gestor chegou primeiro, e nenhuma leitura prévia cobriria essa corrida.
        const decididos = await consulta<{ pessoa_id: string }>(
          `update pedidos_de_entrada
              set situacao = 'aprovado',
                  decidido_em = now(),
                  decidido_por_pessoa_id = $3
            where organizacao_id = $1
              and id = $2
              and situacao = 'pendente'
        returning pessoa_id`,
          [pedidoId, decididoPorPessoaId],
        );

        const decidido = decididos[0];
        if (decidido === undefined) return await distinguirRecusa(consulta, pedidoId);

        // 3 · O Vínculo. `JA_VINCULADO` é violação da `PRIMARY KEY (pessoa_id, organizacao_id)`, tratada
        // no `catch` externo — e alcançável só por corrida, porque o índice parcial já impede dois
        // pedidos pendentes da mesma Pessoa.
        const criados = await consulta<{ criado_em: Date }>(
          `insert into vinculos (pessoa_id, organizacao_id, papel, area_id)
                values ($2, $1, $3, $4)
             returning criado_em`,
          [decidido.pessoa_id, papel, areaId],
        );

        return {
          desfecho: "aprovado",
          vinculo: await lerVinculoCriado(consulta, decidido.pessoa_id, criados[0]!.criado_em),
        };
      }).catch((erro: unknown) => {
        if (ehVinculoDuplicado(erro)) return { desfecho: "ja-vinculado" } as const;
        throw erro;
      });
    },

    async recusar({ pedidoId, observacao, decididoPorPessoaId }) {
      // Mesma razão do `aprovar` acima: sem o argumento de tipo, `desfecho: "recusado"` alarga.
      return emTransacao<ResultadoDaRecusa>(async (consulta) => {
        const recusados = await consulta<LinhaDePedido>(
          `update pedidos_de_entrada p
              set situacao = 'recusado',
                  observacao = $4,
                  decidido_em = now(),
                  decidido_por_pessoa_id = $3
            where p.organizacao_id = $1
              and p.id = $2
              and p.situacao = 'pendente'
        returning p.id,
                  p.situacao,
                  p.criado_em,
                  p.decidido_em,
                  p.telefone_informado,
                  (select id from pessoas where id = p.pessoa_id)             as pessoa_id,
                  (select nome from pessoas where id = p.pessoa_id)           as pessoa_nome,
                  (select id from pessoas where id = $3)                      as decisor_id,
                  (select nome from pessoas where id = $3)                    as decisor_nome`,
          [pedidoId, decididoPorPessoaId, observacao],
        );

        const recusado = recusados[0];
        if (recusado === undefined) return await distinguirRecusa(consulta, pedidoId);

        return { desfecho: "recusado", pedido: lerPedido(recusado) };
      });
    },
  };
}

/** A forma crua que as consultas deste repositório devolvem. **Não sai daqui** (ADR-0005). */
type LinhaDePedido = {
  id: string;
  situacao: string;
  criado_em: Date;
  decidido_em: Date | null;
  telefone_informado: string | null;
  pessoa_id: string;
  pessoa_nome: string;
  decisor_id: string | null;
  decisor_nome: string | null;
};

function lerPedido(linha: LinhaDePedido): PedidoDeEntradaLido {
  if (!ehSituacaoDoPedido(linha.situacao)) {
    // Enum do banco divergindo do código é migração aplicada sem código. Mesmo tratamento de `ehPapel`.
    throw new Error(`situação de pedido desconhecida vinda do banco: ${linha.situacao}`);
  }

  return {
    id: linha.id,
    pessoa: {
      pessoaId: linha.pessoa_id,
      nome: linha.pessoa_nome,
      telefoneInformado: linha.telefone_informado,
    },
    situacao: linha.situacao,
    criadoEm: linha.criado_em.toISOString(),
    decididoEm: linha.decidido_em === null ? null : linha.decidido_em.toISOString(),
    decididoPor:
      linha.decisor_id === null || linha.decisor_nome === null
        ? null
        : { pessoaId: linha.decisor_id, nome: linha.decisor_nome },
  };
}

/**
 * O `update` não pegou nada. **São dois casos, e a resposta de cada um é diferente:** o pedido existe
 * nesta organização e já foi decidido (`409`), ou ele não existe **aqui** (`404`) — e *"aqui"* inclui o
 * pedido de outra organização, que responde idêntico a inexistente (contrato §6.3).
 *
 * Esta é a **única** leitura prévia do arquivo, e ela acontece **depois** da escrita ter falhado: não há
 * corrida a perder, porque o estado já está decidido quando ela roda.
 */
async function distinguirRecusa(
  consulta: ConsultaEscopada,
  pedidoId: string,
): Promise<{ desfecho: "nao-encontrado" } | { desfecho: "ja-decidido" }> {
  const existentes = await consulta<{ id: string }>(
    `select id from pedidos_de_entrada where organizacao_id = $1 and id = $2`,
    [pedidoId],
  );
  return existentes.length === 0 ? { desfecho: "nao-encontrado" } : { desfecho: "ja-decidido" };
}

/**
 * O schema `Vinculo` do contrato, montado depois do `insert`.
 *
 * **`contatos` aparece aqui e não na lista de pedidos**, e a diferença é a §6.17: depois da aprovação a
 * Pessoa tem vínculo **nesta** organização, que é a condição de quem pode ler contato dela.
 */
async function lerVinculoCriado(
  consulta: ConsultaEscopada,
  pessoaId: string,
  criadoEm: Date,
): Promise<VinculoCriado> {
  const vinculos = await consulta<{
    papel: string;
    pessoa_nome: string;
    tem_conta: boolean;
    area_id: string | null;
    area_nome: string | null;
    area_tipo: string | null;
  }>(
    `select v.papel,
            p.nome                        as pessoa_nome,
            (p.usuario_id is not null)    as tem_conta,
            a.id                          as area_id,
            a.nome                        as area_nome,
            a.tipo                        as area_tipo
       from vinculos v
       join pessoas p on p.id = v.pessoa_id
       left join areas a on a.id = v.area_id and a.organizacao_id = v.organizacao_id
      where v.organizacao_id = $1
        and v.pessoa_id = $2`,
    [pessoaId],
  );

  const linha = vinculos[0];
  if (linha === undefined) throw new Error("vínculo recém-criado não encontrado — invariante violada");
  if (!ehPapel(linha.papel)) throw new Error(`papel desconhecido vindo do banco: ${linha.papel}`);

  // `ordem` **é** a cadeia de tentativa (modelo §6.17): ler fora dela apresentaria empate como
  // preferência, que é o defeito que o `UNIQUE (pessoa_id, ordem)` existe para impedir.
  const contatos = await consulta<{
    id: string;
    tipo: string;
    valor: string;
    finalidade: string;
    tem_whatsapp: boolean;
    ordem: number;
    observacao: string | null;
  }>(
    `select c.id, c.tipo, c.valor, c.finalidade, c.tem_whatsapp, c.ordem, c.observacao
       from contatos c
       join vinculos v on v.pessoa_id = c.pessoa_id and v.organizacao_id = $1
      where c.pessoa_id = $2
      order by c.ordem`,
    [pessoaId],
  );

  let area: VinculoCriado["area"] = null;
  if (linha.area_id !== null && linha.area_nome !== null) {
    if (!ehTipoDeArea(linha.area_tipo)) {
      throw new Error(`tipo de área desconhecido vindo do banco: ${String(linha.area_tipo)}`);
    }
    area = { id: linha.area_id, nome: linha.area_nome, tipo: linha.area_tipo };
  }

  return {
    pessoa: {
      pessoaId,
      nome: linha.pessoa_nome,
      contatos: contatos.map((c) => ({
        id: c.id,
        tipo: c.tipo === "email" ? "email" : "telefone",
        valor: c.valor,
        finalidade:
          c.finalidade === "trabalho" ? "trabalho" : c.finalidade === "recado" ? "recado" : "pessoal",
        temWhatsapp: c.tem_whatsapp,
        ordem: c.ordem,
        observacao: c.observacao,
      })),
    },
    papel: linha.papel,
    area,
    temConta: linha.tem_conta,
    criadoEm: criadoEm.toISOString(),
  };
}

/**
 * A violação da `PRIMARY KEY (pessoa_id, organizacao_id)` de `vinculos`, traduzida em desfecho.
 *
 * **Lê `code` e `constraint` de um objeto desconhecido, sem importar o driver** — mesma técnica de
 * `organizacoes.ts`. Confere as duas: `23505` sozinho pegaria qualquer unicidade da transação.
 */
function ehVinculoDuplicado(erro: unknown): boolean {
  if (typeof erro !== "object" || erro === null) return false;
  const comCodigo = erro as { code?: unknown; constraint?: unknown };
  return comCodigo.code === "23505" && comCodigo.constraint === "vinculos_pk";
}
