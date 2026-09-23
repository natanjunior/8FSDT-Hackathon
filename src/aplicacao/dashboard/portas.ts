import type { AreaLida } from "@/aplicacao/organizacao";
import type { StatusOcorrencia } from "@/dominio/ocorrencia";

import type { Janela } from "./janela";

/**
 * ============================================================================
 *  O que o dashboard lê — e repare no que NÃO está aqui: escrita
 * ============================================================================
 *
 * **Sete métodos, os sete de leitura.** A invariante 3 — *"a trilha é imutável"* — costuma ser provada
 * por teste; aqui ela é provada pela **assinatura**: não existe método por onde este módulo grave. É o
 * primeiro modelo de leitura do projeto que não convive com escrita no mesmo repositório.
 *
 * **Nenhum tipo daqui é a forma de uma tabela** (ADR-0005). `LinhaDeResolucao` é o exemplo mais claro:
 * ela carrega `medianaDeHoras` e `somaDasNotas`, que não existem em coluna nenhuma — são o que a agregação
 * produz, e são o que permite ao envelope derivar dois indicadores de uma leitura só.
 *
 * **`AreaLida` vem do módulo de Organização, e não é cópia.** O `openapi.yaml:3266` declara
 * `recorrenciaPorArea[].area` como `$ref: Area`, com `required: [id, nome, tipo, ativa, ordem]` — que é
 * exatamente `AreaLida`. Um sexto formato de área no projeto seria o que diverge na primeira alteração.
 */

/**
 * O teto da amostra pequena — **três**, e o número é do critério 58.4.
 *
 * **Ele mora aqui porque descreve o que `resolucoesPorMes` devolve**, que é o contrato entre a Aplicação
 * e o repositório. O SQL o interpola, como já faz com `FUSO` e `TERMINAIS`, e a Aplicação o compara: os
 * dois lendo a mesma constante é o que impede que discordem.
 *
 * **A regra de produto mora na Aplicação, e não no SQL** — o `case` da consulta é economia de transporte,
 * para que um mês com duzentas resoluções não devolva duzentos números que ninguém vai ler. A razão é de
 * portão: `npm run verificar` não roda o projeto de integração, e uma regra que só vivesse no SQL seria
 * uma regra que o portão nunca confere.
 */
export const AMOSTRA_PEQUENA = 3;

/**
 * **Os três limites das faixas de idade, em dias inteiros.** Trocar esta linha move a consulta, a
 * resposta e os rótulos da tela, e mais nada.
 *
 * `0–7 · 8–30 · 31–90 · 90+` — a escolha é de quem opera, e o domínio decidiu: manutenção predial e
 * condomínio, onde uma semana ainda é prazo razoável para uma lâmpada ou um portão. O corte de suporte de
 * TI — `0–2 · 3–7` — trataria como atrasado o que aqui é normal, e a primeira faixa ficaria cheia todo
 * dia.
 *
 * **Ela mora aqui pela razão de `AMOSTRA_PEQUENA`:** descreve o que `abertasPorIdade` devolve, que é o
 * contrato entre a Aplicação e o repositório. O SQL a interpola, como já faz com `FUSO` e `TERMINAIS`; a
 * Aplicação deriva dela as faixas e completa os zeros; a resposta publica os dois números de cada faixa.
 * **Nenhum dos três escreve `7`, `30` ou `90`.**
 *
 * **Quantas faixas existem também sai daqui.** Um quarto limite acrescentado à lista cria uma quinta
 * faixa em toda a corrente, sem uma linha a mais em lugar nenhum.
 */
export const LIMITES_DAS_FAIXAS_DE_IDADE = [7, 30, 90] as const;

/**
 * O mínimo para uma dupla ser recorrência — **dois**, e o número é do critério 60.2.
 * *Uma ocorrência não é recorrência.*
 *
 * **Ela mora aqui pela razão das duas irmãs acima:** descreve o que `duplasRecorrentes` devolve, que é o
 * contrato entre a Aplicação e o repositório. O SQL a interpola, como já faz com `FUSO` e `TERMINAIS`, e a
 * Aplicação refiltra com ela — os dois lendo a mesma constante é o que impede que discordem.
 *
 * **O `having` do SQL é economia de transporte, e não a regra de produto.** Ele existe para que uma
 * organização com duzentas duplas de uma ocorrência não transporte duzentas linhas que ninguém vai ler. A
 * regra mora na Aplicação por razão de portão: `npm run verificar` não roda o projeto de integração, e uma
 * regra que só vivesse no SQL seria uma regra que o portão nunca confere.
 */
export const MINIMO_PARA_RECORRENCIA = 2;

/** Uma faixa de idade, em dias. `ateDias: null` é a faixa sem teto — a mais velha. */
export type FaixaDeIdade = { deDias: number; ateDias: number | null };

/**
 * As quatro faixas, **derivadas** dos limites e nunca escritas à mão — uma segunda lista seria a que
 * esquece de crescer quando um limite entrar.
 *
 * O `?? -1` é o começo da primeira: não há limite anterior ao índice `0`, e `-1 + 1` é `0`.
 */
export const FAIXAS_DE_IDADE: readonly FaixaDeIdade[] = [
  ...LIMITES_DAS_FAIXAS_DE_IDADE,
  null,
].map((ateDias, i) => ({ deDias: (LIMITES_DAS_FAIXAS_DE_IDADE[i - 1] ?? -1) + 1, ateDias }));

/**
 * Uma contagem por faixa, **como o banco a devolve**: `faixa` é o índice em `FAIXAS_DE_IDADE`, e só vêm
 * as faixas que têm alguém. Quem completa as vazias é o envelope, como faz com os seis status.
 */
export type ContagemPorFaixaDeIdade = { faixa: number; quantidade: number };

/** Uma contagem do backlog por status. **Só o que o banco tem** — quem completa os seis é o envelope. */
export type ContagemPorStatus = { status: StatusOcorrencia; quantidade: number };

/** Uma contagem por categoria. `{id, nome}` inline, como o `openapi.yaml:3229` declara. */
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
 * Uma dupla de Área e Categoria com as ocorrências dela no período.
 *
 * **`area` é `AreaLida` e `categoria` é o `{id, nome}` inline** — as mesmas formas que `PontoDeArea` e
 * `PontoDeCategoria` já publicam. Um segundo formato de Área no mesmo envelope seria o que diverge na
 * primeira alteração.
 */
export type DuplaRecorrente = {
  area: AreaLida;
  categoria: { id: string; nome: string };
  quantidade: number;
};

/**
 * Um mês de resoluções — **e ele alimenta DOIS indicadores**, que é a decisão central deste módulo.
 *
 * O bloco 4 quer a **mediana**, o **p90** e `resolvidas` por mês; o bloco 5 quer `media`, `avaliadas` e
 * `resolvidas` na janela inteira. Os dois contam **o mesmo conjunto** — o que foi resolvido dentro do
 * período —, e o critério **34.5** exige que os dois números batam. Derivando o bloco 5 destas linhas,
 * eles batem **por construção**; com duas consultas, eles bateriam por coincidência, e a coincidência
 * quebra no dia em que um `where` mudar sozinho.
 *
 * `somaDasNotas` é a soma das notas das avaliadas.
 *
 * `medianaDeHoras` e `p90DeHoras` saem de `percentile_cont` — **percentil contínuo, com interpolação
 * linear** entre os dois vizinhos do índice `fração × (n − 1)`. Os dois são tempo de calendário, com as
 * pausas dentro (critério 36.3), medidos entre `registrada_em` e o instante da resolução.
 *
 * `amostraEmHoras` traz as durações cruas, **ordenadas**, quando o mês teve `AMOSTRA_PEQUENA` resoluções
 * ou menos; acima disso vem **vazia, nunca nula** — um `readonly number[]` sem `| null` é um ramo a menos
 * para a Aplicação tratar, e o `null` que a API publica nasce onde ele significa alguma coisa.
 *
 * **Nenhum destes três campos é nulo numa linha devolvida**: o `group by` não produz linha para mês sem
 * resolução, e `registrada_em` e `ocorreu_em` são `not null`. Quem cria o `null` do mês vazio é a
 * Aplicação.
 */
export type LinhaDeResolucao = {
  mes: string;
  resolvidas: number;
  medianaDeHoras: number;
  p90DeHoras: number;
  amostraEmHoras: readonly number[];
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
   * Conta **só o que está em aberto** — os quatro status não terminais —, e por isso **não soma com
   * `backlogPorStatus`**, que conta os seis. As duas telas dizem o que cada uma conta (critério 56.4).
   *
   * Traz **toda categoria ativa**, mesmo a zero — é o critério 32.3, *"a estrutura ensina o que vai ser
   * medido"* —, **mais** a categoria desativada que ainda tem ocorrência em aberto, porque ainda há
   * trabalho nela.
   */
  abertasPorCategoria(): Promise<readonly ContagemPorCategoria[]>;
  /**
   * **Fotografia de agora**, a terceira — e a única que olha para o tempo do que **não** terminou.
   *
   * Conta o mesmo conjunto que `abertasPorCategoria` — os quatro status não terminais —, por outro corte:
   * há quanto tempo cada uma está aberta. **As duas somas fecham**, e é a propriedade que nenhum schema
   * declara: ela vive em dois `where` que ninguém obriga a concordar, e por isso tem prova de integração
   * e prova de tela.
   *
   * **Devolve só as faixas que têm alguém.** As quatro que a resposta publica são completadas pelo
   * envelope, a partir de `FAIXAS_DE_IDADE` — a mesma divisão de `backlogPorStatus` e dos seis status.
   *
   * **Sem parâmetro, como as duas irmãs:** não há como uma data de quem chama alcançar esta consulta.
   */
  abertasPorIdade(): Promise<readonly ContagemPorFaixaDeIdade[]>;
  /** Série mensal por categoria, dentro da janela, recortada por `ocorrencias.registrada_em`. */
  recorrenciaPorCategoria(janela: Janela): Promise<readonly PontoDeCategoria[]>;
  /** Série mensal por área, dentro da janela, recortada por `ocorrencias.registrada_em`. */
  recorrenciaPorArea(janela: Janela): Promise<readonly PontoDeArea[]>;
  /**
   * As duplas de Área e Categoria que se repetiram dentro da janela, recortadas por
   * `ocorrencias.registrada_em`, como as duas séries acima.
   *
   * **É a terceira leitura da recorrência, e ela responde outra pergunta.** As duas séries contam as
   * dimensões em separado: oito ocorrências da mesma categoria espalhadas por oito lugares produzem ali o
   * mesmo número que oito no mesmo lugar. O cruzamento só existe na linha da ocorrência.
   *
   * **Devolve só o que já passou do mínimo** — o `having` do SQL —, e a Aplicação refiltra com a mesma
   * constante. Lista vazia é resposta legítima: significa que nada se repetiu no período.
   */
  duplasRecorrentes(janela: Janela): Promise<readonly DuplaRecorrente[]>;
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
