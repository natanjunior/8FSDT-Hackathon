import {
  AMOSTRA_PEQUENA,
  FUSO,
  type ContagemPorCategoria,
  type ContagemPorStatus,
  type Janela,
  type LinhaDeResolucao,
  type PontoDeArea,
  type PontoDeCategoria,
  type RepositorioEscopadoDeDashboard,
} from "@/aplicacao/dashboard";
import { TERMINAIS, type StatusOcorrencia } from "@/dominio/ocorrencia";
import type { TipoArea } from "@/dominio/organizacao";
import type { ConsultaEscopada } from "@/infraestrutura/contexto";

/**
 * ============================================================================
 *  As cinco agregações de `GET /dashboard`
 * ============================================================================
 *
 * Note o que este arquivo **não** contém: um valor de organização. `$1` é injetado pelo ponto de
 * estrangulamento, e este repositório **não tem como saber** qual organização é (ADR-0003). Os parâmetros
 * de quem chama começam em `$2` — aqui, `$2` é `de` e `$3` é `ate`.
 *
 * **Nenhum `insert`, nenhum `update`, nenhum `delete`.** Não é disciplina: a porta não tem método por onde
 * escrever, e este arquivo implementa a porta.
 *
 * **Nenhum índice novo foi criado para nenhuma destas consultas**, e é decisão do modelo, não pressa:
 * *"o plano correto para `GROUP BY` sobre toda a partição é varredura, não índice"*
 * (`modelo-de-dados.md:1290`). A única que tem índice à disposição é a da trilha —
 * `registros_transicao_organizacao_ocorreu_ix (organizacao_id, ocorreu_em desc)` —, e é por isso que o
 * recorte dela é **comparação de faixa contra a coluna crua**, e não uma função aplicada sobre ela: um
 * `where (ocorreu_em at time zone …)::date between …` desligaria o índice que o critério 36.4 manda usar.
 *
 * **Duas coisas são interpoladas, e as duas são constante de módulo.** O nome do fuso, importado de
 * `@/aplicacao/dashboard`, e a lista de status terminais, importada de `@/dominio/ocorrencia`. Nenhuma das
 * duas é dado de requisição, e escrevê-las no texto mantém a consulta legível e o `EXPLAIN` reproduzível.
 * Toda data de quem chama continua entrando por parâmetro.
 *
 * **A lista de terminais vem de `TERMINAIS` e nunca é escrita à mão aqui.** Um `('resolvida','cancelada')`
 * digitado seria a segunda cópia de *quais status são terminais* no projeto, e a segunda cópia é a que
 * esquece de crescer quando um terceiro terminal nascer.
 *
 * **Os `::int` e o `::float8` não são decoração.** O `pg` devolve `numeric` como **string**, para não
 * perder precisão. `count(*)` é `bigint` e `sum(...)` é `numeric`; sem os *casts*, `quantidade` chegaria
 * como `"12"` e a soma das notas como `"18"`, e o envelope somaria strings sem reclamar.
 */

/** Os terminais como literais SQL, `'resolvida', 'cancelada'` — ver a nota de interpolação acima. */
const TERMINAIS_EM_SQL = TERMINAIS.map((status) => `'${status}'`).join(", ");

const INICIO_DA_JANELA = `($2::date)::timestamp at time zone '${FUSO}'`;
const FIM_DA_JANELA = `(($3::date + 1)::timestamp at time zone '${FUSO}')`;

/** O rótulo `YYYY-MM` do mês **brasileiro** de um `timestamptz`. É a exceção da §7.5 do contrato. */
const mesDe = (coluna: string): string =>
  `to_char(date_trunc('month', ${coluna} at time zone '${FUSO}'), 'YYYY-MM')`;
const mesTruncadoDe = (coluna: string): string =>
  `date_trunc('month', ${coluna} at time zone '${FUSO}')`;

/**
 * A duração de uma resolução em horas — **tempo de calendário, com as pausas** (critério 36.3).
 *
 * **Extraída para constante porque aparece quatro vezes** na consulta: nos dois `percentile_cont`, e duas
 * vezes dentro do `array_agg` (no valor e na ordenação). Quatro cópias de uma expressão de tempo é a
 * quarta que diverge.
 *
 * **O `::float8` fica aqui, e é aqui que ele é necessário.** `extract(epoch from …)` devolve `numeric`, e
 * o `pg` entrega `numeric` como string. `percentile_cont` sobre `float8` devolve `float8`, e `float8[]`
 * chega como array de números — então nenhum dos três campos novos precisa de cast próprio.
 */
const HORAS_ATE_A_RESOLUCAO = `(extract(epoch from (r.ocorreu_em - o.registrada_em)) / 3600.0)::float8`;

const SELECT_DO_BACKLOG_POR_STATUS = `
  select o.status, count(*)::int as quantidade
    from ocorrencias o
   where o.organizacao_id = $1
   group by o.status`;

/**
 * **Conta só o que está em aberto** — os quatro status não terminais. Ela não soma com
 * `SELECT_DO_BACKLOG_POR_STATUS`, que conta os seis, e as duas telas dizem isso (critério 56.4).
 *
 * **`left join` a partir de `categorias`, e não de `ocorrencias`** — é o que faz a categoria ativa sem
 * nenhuma ocorrência aparecer com zero, que é o critério 32.3 na resposta.
 *
 * **O filtro de status vai no `on`, nunca no `where`.** No `where` o `left join` degeneraria em
 * `inner join` e a categoria ativa e vazia sumiria da resposta — o que quebraria o 32.3 e tornaria a
 * primeira metade do critério 56.6 impossível de afirmar: a categoria com cinco resolvidas e nada em
 * aberto não apareceria **com zero**, apareceria ausente.
 *
 * **O `having` continua onde estava, e a razão dele mudou.** Ele cobre a categoria **desativada** que
 * ainda carrega ocorrência: ela aparece porque ainda há trabalho nela. Antes deste item a justificativa
 * era fechar a soma com o bloco por status; as duas somas agora discordam de propósito. Os quatro casos:
 *
 * | Categoria | O que a consulta devolve |
 * |---|---|
 * | ativa, nada em aberto | aparece com zero |
 * | ativa, com abertas | aparece com o que está em aberto |
 * | desativada, com abertas | aparece — ainda há trabalho nela |
 * | desativada, só com terminais | some, porque não tem o que dizer num bloco que conta fila |
 */
const SELECT_DAS_ABERTAS_POR_CATEGORIA = `
  select c.id, c.nome, count(o.id)::int as quantidade
    from categorias c
    left join ocorrencias o
      on o.categoria_id = c.id
     and o.organizacao_id = c.organizacao_id
     and o.status not in (${TERMINAIS_EM_SQL})
   where c.organizacao_id = $1
   group by c.id, c.nome, c.ativa
  having c.ativa or count(o.id) > 0
   order by count(o.id) desc, c.nome`;

const SELECT_DA_RECORRENCIA_POR_CATEGORIA = `
  select c.id,
         c.nome,
         ${mesDe("o.registrada_em")} as mes,
         count(*)::int as quantidade
    from ocorrencias o
    join categorias c on c.id = o.categoria_id and c.organizacao_id = o.organizacao_id
   where o.organizacao_id = $1
     and o.registrada_em >= ${INICIO_DA_JANELA}
     and o.registrada_em <  ${FIM_DA_JANELA}
   group by c.id, c.nome, ${mesTruncadoDe("o.registrada_em")}
   order by c.nome, mes`;

/**
 * **`a.tipo` é o tipo VIGENTE da Área, não o `o.area_tipo` congelado no registro** (modelo §7.5).
 *
 * A resposta devolve a **Área**, e o schema `Area` do contrato descreve a Área como ela é hoje. O tipo
 * congelado é propriedade da ocorrência e viaja em `OcorrenciaResumo.area.tipo` — outro campo, outra
 * pergunta.
 *
 * **Cinco colunas e não três**, porque `openapi.yaml:3266` declara `$ref: Area`, e `Area` exige
 * `[id, nome, tipo, ativa, ordem]`. O exemplo do mesmo arquivo mostra três — é o achado **A-32-5** do
 * plano, e quem manda é o schema.
 */
const SELECT_DA_RECORRENCIA_POR_AREA = `
  select a.id,
         a.nome,
         a.tipo,
         a.ativa,
         a.ordem,
         ${mesDe("o.registrada_em")} as mes,
         count(*)::int as quantidade
    from ocorrencias o
    join areas a on a.id = o.area_id and a.organizacao_id = o.organizacao_id
   where o.organizacao_id = $1
     and o.registrada_em >= ${INICIO_DA_JANELA}
     and o.registrada_em <  ${FIM_DA_JANELA}
   group by a.id, a.nome, a.tipo, a.ativa, a.ordem, ${mesTruncadoDe("o.registrada_em")}
   order by a.nome, mes`;

/**
 * **A única consulta do dashboard que lê a trilha** — e é ela que os critérios 36.4 e 34.5 encomendam.
 *
 * **Parte de `registros_transicao` e junta pela chave composta** `(ocorrencia_id, organizacao_id)`, que é
 * a mesma da FK da migração 005. O `$1` está no `where` da trilha, e o par do `join` impede que uma
 * ocorrência de outra organização entre por baixo.
 *
 * **Uma linha por ocorrência resolvida, por construção:** `resolvida` é poço da máquina de estados, então
 * não há duas transições para `resolvida` na mesma ocorrência e a contagem não precisa de `distinct`.
 *
 * **`avaliadas` conta as resolvidas DESTE mês que têm nota** — inclusive as avaliadas depois da janela. É
 * o critério 34.5 lido literalmente: a âncora é a resolução, e `avaliada_em` não entra em `where` nenhum.
 *
 * **Tempo de CALENDÁRIO, com as pausas** (critério 36.3): a diferença é entre o instante da resolução e o
 * `registrada_em` da ocorrência, sem descontar nada.
 *
 * **Mediana e p90 por `percentile_cont`, que é o percentil CONTÍNUO** — ele ordena as durações, calcula o
 * índice `fração × (n − 1)` e **interpola linearmente** entre os dois vizinhos desse índice.
 * `percentile_disc` devolveria sempre um valor observado, e daria outro número sobre os mesmos dados. O
 * método fica escrito aqui e em `docs/api.md` porque quem lê o número precisa saber qual dos dois é.
 *
 * **Nenhuma ida a mais ao banco, nenhum índice novo** (critério 58.1): é a mesma varredura, o mesmo
 * `group by` e as mesmas linhas. O custo a mais é a ordenação dentro de cada grupo.
 *
 * **O `case` do `array_agg` é economia de transporte, e não a regra de produto** — essa mora na
 * Aplicação, com a mesma constante `AMOSTRA_PEQUENA`.
 */
const SELECT_DAS_RESOLUCOES = `
  select ${mesDe("r.ocorreu_em")} as mes,
         count(*)::int as resolvidas,
         percentile_cont(0.5) within group (order by ${HORAS_ATE_A_RESOLUCAO}) as mediana_de_horas,
         percentile_cont(0.9) within group (order by ${HORAS_ATE_A_RESOLUCAO}) as p90_de_horas,
         case when count(*) <= ${String(AMOSTRA_PEQUENA)}
              then array_agg(${HORAS_ATE_A_RESOLUCAO} order by ${HORAS_ATE_A_RESOLUCAO})
              else '{}'::float8[]
         end as amostra_em_horas,
         count(o.avaliacao_nota)::int as avaliadas,
         coalesce(sum(o.avaliacao_nota), 0)::int as soma_das_notas
    from registros_transicao r
    join ocorrencias o on o.id = r.ocorrencia_id and o.organizacao_id = r.organizacao_id
   where r.organizacao_id = $1
     and r.status_novo = 'resolvida'
     and r.ocorreu_em >= ${INICIO_DA_JANELA}
     and r.ocorreu_em <  ${FIM_DA_JANELA}
   group by ${mesTruncadoDe("r.ocorreu_em")}
   order by 1`;

type LinhaDeStatus = { status: StatusOcorrencia; quantidade: number };
type LinhaDeCategoria = { id: string; nome: string; quantidade: number };
type LinhaDeCategoriaMensal = { id: string; nome: string; mes: string; quantidade: number };
type LinhaDeAreaMensal = {
  id: string;
  nome: string;
  tipo: TipoArea;
  ativa: boolean;
  ordem: number;
  mes: string;
  quantidade: number;
};
type LinhaDeResolucaoDoBanco = {
  mes: string;
  resolvidas: number;
  mediana_de_horas: number;
  p90_de_horas: number;
  amostra_em_horas: number[];
  avaliadas: number;
  soma_das_notas: number;
};

export function repositorioEscopadoDeDashboard(
  consulta: ConsultaEscopada,
): RepositorioEscopadoDeDashboard {
  return {
    async backlogPorStatus(): Promise<readonly ContagemPorStatus[]> {
      const linhas = await consulta<LinhaDeStatus>(SELECT_DO_BACKLOG_POR_STATUS);
      return linhas.map((linha) => ({ status: linha.status, quantidade: linha.quantidade }));
    },

    async abertasPorCategoria(): Promise<readonly ContagemPorCategoria[]> {
      const linhas = await consulta<LinhaDeCategoria>(SELECT_DAS_ABERTAS_POR_CATEGORIA);
      return linhas.map((linha) => ({
        categoria: { id: linha.id, nome: linha.nome },
        quantidade: linha.quantidade,
      }));
    },

    async recorrenciaPorCategoria(janela: Janela): Promise<readonly PontoDeCategoria[]> {
      const linhas = await consulta<LinhaDeCategoriaMensal>(SELECT_DA_RECORRENCIA_POR_CATEGORIA, [
        janela.de,
        janela.ate,
      ]);
      return linhas.map((linha) => ({
        categoria: { id: linha.id, nome: linha.nome },
        mes: linha.mes,
        quantidade: linha.quantidade,
      }));
    },

    async recorrenciaPorArea(janela: Janela): Promise<readonly PontoDeArea[]> {
      const linhas = await consulta<LinhaDeAreaMensal>(SELECT_DA_RECORRENCIA_POR_AREA, [
        janela.de,
        janela.ate,
      ]);
      return linhas.map((linha) => ({
        area: {
          id: linha.id,
          nome: linha.nome,
          tipo: linha.tipo,
          ativa: linha.ativa,
          ordem: linha.ordem,
        },
        mes: linha.mes,
        quantidade: linha.quantidade,
      }));
    },

    async resolucoesPorMes(janela: Janela): Promise<readonly LinhaDeResolucao[]> {
      const linhas = await consulta<LinhaDeResolucaoDoBanco>(SELECT_DAS_RESOLUCOES, [
        janela.de,
        janela.ate,
      ]);
      return linhas.map((linha) => ({
        mes: linha.mes,
        resolvidas: linha.resolvidas,
        medianaDeHoras: linha.mediana_de_horas,
        p90DeHoras: linha.p90_de_horas,
        amostraEmHoras: linha.amostra_em_horas,
        avaliadas: linha.avaliadas,
        somaDasNotas: linha.soma_das_notas,
      }));
    },
  };
}
