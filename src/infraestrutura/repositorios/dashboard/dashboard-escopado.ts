import {
  FUSO,
  type ContagemPorCategoria,
  type ContagemPorStatus,
  type Janela,
  type LinhaDeResolucao,
  type PontoDeArea,
  type PontoDeCategoria,
  type RepositorioEscopadoDeDashboard,
} from "@/aplicacao/dashboard";
import type { StatusOcorrencia } from "@/dominio/ocorrencia";
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
 * **O nome do fuso é interpolado, e é a única interpolação do arquivo.** Ele é constante de módulo
 * importada de `@/aplicacao/dashboard`, nunca dado de requisição — e escrevê-lo no texto mantém a consulta
 * legível e o `EXPLAIN` reproduzível. Toda data de quem chama continua entrando por parâmetro.
 *
 * **Os `::int` e o `::float8` não são decoração.** O `pg` devolve `numeric` como **string**, para não
 * perder precisão. `count(*)` é `bigint` e `sum(...)` é `numeric`; sem os *casts*, `quantidade` chegaria
 * como `"12"` e a soma de horas como `"373.5"`, e o envelope somaria strings sem reclamar.
 */

const INICIO_DA_JANELA = `($2::date)::timestamp at time zone '${FUSO}'`;
const FIM_DA_JANELA = `(($3::date + 1)::timestamp at time zone '${FUSO}')`;

/** O rótulo `YYYY-MM` do mês **brasileiro** de um `timestamptz`. É a exceção da §7.5 do contrato. */
const mesDe = (coluna: string): string =>
  `to_char(date_trunc('month', ${coluna} at time zone '${FUSO}'), 'YYYY-MM')`;
const mesTruncadoDe = (coluna: string): string =>
  `date_trunc('month', ${coluna} at time zone '${FUSO}')`;

const SELECT_DO_BACKLOG_POR_STATUS = `
  select o.status, count(*)::int as quantidade
    from ocorrencias o
   where o.organizacao_id = $1
   group by o.status`;

/**
 * **`left join` a partir de `categorias`, e não de `ocorrencias`** — é o que faz a categoria ativa sem
 * nenhuma ocorrência aparecer com zero, que é o critério 32.3 na resposta.
 *
 * **O `having` cobre o caso que ninguém tinha nomeado:** a categoria **desativada** que ainda carrega
 * ocorrências. Filtrar só `c.ativa` a esconderia, e a soma por categoria passaria a discordar da soma por
 * status sem nada na tela explicando a diferença. Ela entra; a ativa a zero também; a desativada e vazia
 * não.
 */
const SELECT_DO_BACKLOG_POR_CATEGORIA = `
  select c.id, c.nome, count(o.id)::int as quantidade
    from categorias c
    left join ocorrencias o
      on o.categoria_id = c.id
     and o.organizacao_id = c.organizacao_id
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
 */
const SELECT_DAS_RESOLUCOES = `
  select ${mesDe("r.ocorreu_em")} as mes,
         count(*)::int as resolvidas,
         sum(extract(epoch from (r.ocorreu_em - o.registrada_em)) / 3600.0)::float8 as soma_de_horas,
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
  soma_de_horas: number;
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

    async backlogPorCategoria(): Promise<readonly ContagemPorCategoria[]> {
      const linhas = await consulta<LinhaDeCategoria>(SELECT_DO_BACKLOG_POR_CATEGORIA);
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
        somaDeHoras: linha.soma_de_horas,
        avaliadas: linha.avaliadas,
        somaDasNotas: linha.soma_das_notas,
      }));
    },
  };
}
