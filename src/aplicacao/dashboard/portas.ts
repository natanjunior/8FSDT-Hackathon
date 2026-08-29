import type { AreaLida } from "@/aplicacao/organizacao";
import type { StatusOcorrencia } from "@/dominio/ocorrencia";

import type { Janela } from "./janela";

/**
 * ============================================================================
 *  O que o dashboard lê — e repare no que NÃO está aqui: escrita
 * ============================================================================
 *
 * **Cinco métodos, os cinco de leitura.** A invariante 3 — *"a trilha é imutável"* — costuma ser provada
 * por teste; aqui ela é provada pela **assinatura**: não existe método por onde este módulo grave. É o
 * primeiro modelo de leitura do projeto que não convive com escrita no mesmo repositório.
 *
 * **Nenhum tipo daqui é a forma de uma tabela** (ADR-0005). `LinhaDeResolucao` é o exemplo mais claro:
 * ela carrega `somaDeHoras` e `somaDasNotas`, que não existem em coluna nenhuma — são o que a agregação
 * produz, e são o que permite ao envelope derivar dois indicadores de uma leitura só.
 *
 * **`AreaLida` vem do módulo de Organização, e não é cópia.** O `openapi.yaml:3266` declara
 * `recorrenciaPorArea[].area` como `$ref: Area`, com `required: [id, nome, tipo, ativa, ordem]` — que é
 * exatamente `AreaLida`. Um sexto formato de área no projeto seria o que diverge na primeira alteração.
 */

/** Uma contagem do backlog por status. **Só o que o banco tem** — quem completa os seis é o envelope. */
export type ContagemPorStatus = { status: StatusOcorrencia; quantidade: number };

/** Uma contagem do backlog por categoria. `{id, nome}` inline, como o `openapi.yaml:3229` declara. */
export type ContagemPorCategoria = { categoria: { id: string; nome: string }; quantidade: number };

/**
 * O que os dois pontos de série têm em comum — o mês e o número.
 *
 * **Existe para que `agrupar` seja genérico sem conversão de tipo.** O plano trazia a alternativa com
 * `as unknown as` e recomendava esta forma; ela é a que compila sem um único `as`, e é a que faz o
 * compilador conferir que todo ponto novo carrega os dois campos de que o agrupamento depende.
 */
export type PontoMensal = { mes: string; quantidade: number };

/** Um ponto da série mensal de uma categoria. `mes` é `YYYY-MM` em America/Sao_Paulo. */
export type PontoDeCategoria = PontoMensal & { categoria: { id: string; nome: string } };

/** Um ponto da série mensal de uma área. **O `tipo` é o VIGENTE da Área**, não o congelado no registro. */
export type PontoDeArea = PontoMensal & { area: AreaLida };

/**
 * Um mês de resoluções — **e ele alimenta DOIS indicadores**, que é a decisão central deste módulo.
 *
 * O bloco 4 quer `horas` e `resolvidas` por mês; o bloco 5 quer `media`, `avaliadas` e `resolvidas` na
 * janela inteira. Os dois contam **o mesmo conjunto** — o que foi resolvido dentro do período —, e o
 * critério **34.5** exige que os dois números batam. Derivando o bloco 5 destas linhas, eles batem **por
 * construção**; com duas consultas, eles bateriam por coincidência, e a coincidência quebra no dia em que
 * um `where` mudar sozinho.
 *
 * `somaDeHoras` é a soma de (instante da resolução − `registrada_em`) em horas — **tempo de calendário,
 * com as pausas** (critério 36.3). `somaDasNotas` é a soma das notas das avaliadas.
 */
export type LinhaDeResolucao = {
  mes: string;
  resolvidas: number;
  somaDeHoras: number;
  avaliadas: number;
  somaDasNotas: number;
};

export interface RepositorioEscopadoDeDashboard {
  /**
   * **Fotografia de agora** — critério 33.2. Repare que **não recebe janela**: não é disciplina, é
   * assinatura. Não há como `de`/`ate` alcançarem esta consulta.
   */
  backlogPorStatus(): Promise<readonly ContagemPorStatus[]>;
  /**
   * **Fotografia de agora**, pela mesma razão da irmã acima.
   *
   * Traz **toda categoria ativa**, mesmo a zero — é o critério 32.3, *"a estrutura ensina o que vai ser
   * medido"* —, **mais** a categoria desativada que ainda tem ocorrência: escondê-la faria a soma por
   * categoria discordar da soma por status sem nada na tela explicando por quê.
   */
  backlogPorCategoria(): Promise<readonly ContagemPorCategoria[]>;
  /** Série mensal por categoria, dentro da janela, recortada por `ocorrencias.registrada_em`. */
  recorrenciaPorCategoria(janela: Janela): Promise<readonly PontoDeCategoria[]>;
  /** Série mensal por área, dentro da janela, recortada por `ocorrencias.registrada_em`. */
  recorrenciaPorArea(janela: Janela): Promise<readonly PontoDeArea[]>;
  /**
   * Um mês por linha, **recortado pelo INSTANTE DA RESOLUÇÃO** lido da trilha — nunca por `avaliada_em`.
   *
   * É o critério 34.5 e a §3.3 da spec: a âncora é a resolução, porque *"X de Y"* não sobrevive a `X > Y`
   * e porque `resolvidas` aparece duas vezes na mesma tela.
   *
   * **Uma resolução por ocorrência, por construção:** `resolvida` é poço da máquina de estados
   * (`MaquinaDeEstados.ts:18`), então a junção com a trilha é determinística e não precisa de desempate.
   */
  resolucoesPorMes(janela: Janela): Promise<readonly LinhaDeResolucao[]>;
}
