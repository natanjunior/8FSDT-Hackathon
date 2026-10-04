/**
 * ============================================================================
 *  O que a barra de T-03 decide, fora do `.tsx` — itens 15 e 67
 * ============================================================================
 *
 * **Por que isto não mora no componente.** O projeto não tem biblioteca de teste de componente
 * (ADR-0008), então o que fica dentro do `.tsx` não tem teste nenhum. É o precedente do
 * `busca-de-candidatos.ts` e do `vazio-da-lista.ts`: a decisão mora numa função pura, com teste, e o
 * componente só a chama.
 *
 * **Não conhece React nem `next`, e é de propósito.** O único `import` é o da busca do produto, que
 * também é pura — e é o que impede este arquivo de ganhar uma segunda regra de casamento. Por não
 * conhecer React, ele é chamado dos dois lados: a página monta aqui as opções dos campos com busca, e o
 * navegador filtra aqui enquanto alguém digita.
 */

import { casaPeloNome, termosDaBusca } from "./busca-de-candidatos";

/**
 * Os três parâmetros de **paginação**, que não são recorte.
 *
 * **Trocar de recorte ou de ordem descarta os três** — spec do 14b, §3.7: *"cursor é posição dentro de um
 * conjunto"*, e a frase vale igual com `pagina`, `ate` e `totalNoCorte` no lugar dele. Conjunto novo,
 * corte novo.
 */
const DA_PAGINACAO = ["pagina", "ate", "totalNoCorte"] as const;

export function semPaginacao(atual: URLSearchParams): URLSearchParams {
  const proximos = new URLSearchParams(atual.toString());
  for (const nome of DA_PAGINACAO) proximos.delete(nome);
  return proximos;
}

/**
 * Os oito parâmetros de **recorte** que a tela escreve.
 *
 * **A lista existe para ter UM lugar**: a barra usa-a para saber se algum filtro está ligado, e *"Limpar
 * filtros"* usa-a para saber o que apagar. Até o item 67 as duas coisas eram expressões escritas à mão em
 * lugares diferentes, e o dia em que divergissem seria o dia em que *Limpar* deixaria de limpar o que o
 * botão diz que limpa. Um teste prende esta lista a `algumFiltroAplicado`, do lado do servidor.
 *
 * **`ordem` e `sentido` não estão aqui**, e é a decisão da §4.4 da spec: ordem não recorta, e *"Limpar
 * filtros"* a mantém — quem limpou o recorte não pediu para a tabela voltar à coluna de origem.
 */
export const PARAMETROS_DE_FILTRO = [
  "status",
  "categoriaId",
  "prioridade",
  "autor",
  "titulo",
  "areaId",
  "responsavelPessoaId",
  // **`parada` é filtro, e não recorte de conjunto** (item 101): estreita o que já está na lista, entra
  // em `algumFiltroAplicado` e sai com *Limpar filtros*. A lista não está na ordem da barra, e não
  // precisa estar: ela serve a *"algum filtro está ligado?"* e a *"o que Limpar apaga"*.
  "parada",
] as const;

/** Apaga os oito recortes e a paginação. **Mantém a ordem.** */
export function semFiltros(consultaAtual: string): URLSearchParams {
  const proximos = semPaginacao(new URLSearchParams(consultaAtual));
  for (const nome of PARAMETROS_DE_FILTRO) proximos.delete(nome);
  return proximos;
}

/** Escreve **um** valor num parâmetro, ou o apaga com `null`. Tira a paginação: conjunto novo. */
export function comValorUnico(
  consultaAtual: string,
  parametro: string,
  valor: string | null,
): URLSearchParams {
  const proximos = semPaginacao(new URLSearchParams(consultaAtual));
  if (valor === null) proximos.delete(parametro);
  else proximos.set(parametro, valor);
  return proximos;
}

/** O texto do campo de título virando URL. **Aparado, e vazio apaga** — só espaço não é recorte. */
export function comTitulo(consultaAtual: string, texto: string): URLSearchParams {
  const aparado = texto.trim();
  return comValorUnico(consultaAtual, "titulo", aparado === "" ? null : aparado);
}

/** Uma opção de um campo com busca: o que vai na URL, o que a pessoa lê, e o complemento em *meta*. */
export type OpcaoComBusca = { valor: string; rotulo: string; complemento?: string };

/**
 * **Quantas opções aparecem antes de alguém digitar.** Dez, pela recomendação do desenho: uma lista
 * inteira de área ou de gente não cabe no popover e não ajuda a escolher — quem não vê o que quer digita.
 */
export const OPCOES_ANTES_DE_DIGITAR = 10;

/** As dez primeiras por nome. **Ordena por `pt-BR`**, senão *Área* viria depois de *Zeladoria*. */
export function primeirasOpcoes(
  opcoes: readonly OpcaoComBusca[],
  quantas: number = OPCOES_ANTES_DE_DIGITAR,
): readonly OpcaoComBusca[] {
  return [...opcoes]
    .sort((uma, outra) => uma.rotulo.localeCompare(outra.rotulo, "pt-BR"))
    .slice(0, quantas);
}

/**
 * As áreas viram opções, com o tipo em *meta*.
 *
 * **O tipo entra porque a palavra do dono é *unidade*, e ela é verdadeira só na metade privativa.** O
 * campo se chama *Área* porque recorta a coluna **Onde**, que mostra área comum e privativa; cada opção
 * diz qual das duas é, pela mesma frase que T-04 escreve no seletor de área.
 */
export function opcoesDeArea(
  areas: readonly { id: string; nome: string; tipo: "comum" | "privativa" }[],
  rotuloDoTipo: (tipo: "comum" | "privativa") => string,
): readonly OpcaoComBusca[] {
  return areas.map((area) => ({
    valor: area.id,
    rotulo: area.nome,
    complemento: rotuloDoTipo(area.tipo),
  }));
}

/**
 * Os participantes viram opções — **e a projeção é estreita de propósito**.
 *
 * `contatos[]` é dado pessoal sob o RNF10, e é a razão de `GET /vinculos` exigir `vinculo.gerir`. O que
 * desce ao navegador aqui é o par identificador e nome, e mais nada: não há como vazar contato porque o
 * objeto que alimenta o campo não o tem.
 */
export function opcoesDeResponsavel(
  vinculos: readonly { pessoa: { pessoaId: string; nome: string } }[],
): readonly OpcaoComBusca[] {
  return vinculos.map((vinculo) => ({
    valor: vinculo.pessoa.pessoaId,
    rotulo: vinculo.pessoa.nome,
  }));
}

/**
 * As opções que casam com o que foi digitado — **a mesma busca do resto do produto**: prefixo de palavra,
 * sem acento, sem caixa, todos os termos. Busca em branco devolve tudo, na ordem que chegou.
 */
export function filtrarOpcoes(
  opcoes: readonly OpcaoComBusca[],
  busca: string,
): readonly OpcaoComBusca[] {
  const termos = termosDaBusca(busca);
  if (termos.length === 0) return opcoes;
  return opcoes.filter((opcao) => casaPeloNome(opcao.rotulo, termos));
}

/**
 * O rótulo do gatilho de um filtro.
 *
 * **Sem valor, o nome da dimensão; com um, o nome do VALOR; com mais de um, a contagem.** É a mesma regra
 * dos três menus de hoje (`rotuloDoChip`), e é o que faz o estado ligado carregar palavra e não só cor.
 *
 * **Valor fora da lista conta em vez de inventar nome**: quem chegou por link a uma área desativada vê o
 * recorte aplicado sem ganhar um nome que o produto não tem.
 */
export function rotuloDoGatilho(
  nome: string,
  opcoes: readonly OpcaoComBusca[],
  marcados: readonly string[],
): string {
  if (marcados.length === 0) return nome;
  if (marcados.length > 1) return `${nome}: ${marcados.length} selecionados`;

  const opcao = opcoes.find((uma) => uma.valor === marcados[0]);
  return opcao === undefined ? `${nome}: 1 selecionado` : `${nome}: ${opcao.rotulo}`;
}

/**
 * **O gatilho com o rótulo acima mostra só o valor** (item 120, bloco 12): o nome da dimensão já está
 * escrito em cima, e repeti-lo diria *Área* duas vezes. Valor fora da lista conta em vez de inventar nome,
 * a mesma regra de `rotuloDoGatilho`. O nome acessível do gatilho continua o de `rotuloDoGatilho`.
 */
export function valorDoGatilho(
  opcoes: readonly OpcaoComBusca[],
  marcados: readonly string[],
  vazio: string,
): string {
  if (marcados.length === 0) return vazio;
  if (marcados.length > 1) return `${String(marcados.length)} selecionados`;
  return opcoes.find((uma) => uma.valor === marcados[0])?.rotulo ?? "1 selecionado";
}

/** O rótulo visível acima de um campo de filtro (item 120): o papel do rótulo de campo do formulário. */
export const ROTULO_ACIMA = "text-interface text-tinta font-medium";
