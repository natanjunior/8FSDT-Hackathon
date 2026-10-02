import { casaPeloNome, termosDaBusca } from "@/interface/componentes/busca-de-candidatos";
import type { EtiquetaNaTela } from "@/interface/componentes/etiquetas-de-participante";
import type { ImpedimentoNaTela } from "@/interface/componentes/frases-da-remocao";
import {
  ROTULO_SEM_PAPEL,
  SEM_PEDIDOS,
  dataCurta,
  rotuloDoPapel,
} from "@/interface/componentes/frases-de-participantes";
import {
  SEM_ORDENACAO,
  ariaSortDa,
  escreverOrdenacao,
  lerOrdenacao,
  proximaOrdenacao,
  type Sentido,
} from "@/interface/componentes/ordenacao-em-tres-estados";
import { contatoEmLeitura } from "@/interface/componentes/regras-do-vinculo";
import { telefoneLegivel } from "@/interface/componentes/telefone";
import type { VinculoProjetado } from "@/interface/projecoes";

/**
 * ============================================================================
 *  A tabela de T-08, decidida fora do desenho — item 44j
 * ============================================================================
 *
 * **`GET /vinculos` devolve a lista inteira** (até 200, RNF3) e só filtra por papel, então filtrar,
 * ordenar, buscar e paginar não pedem servidor. O que a tabela desenha sai daqui, e o que decide tem
 * teste: o navegador não escolhe nada dentro do JSX.
 *
 * **Uma linha é um pedido ou um vínculo**, e as duas formas trazem as mesmas colunas, para a tabela não
 * ter dois desenhos. A origem viaja junto (`pedido`, `vinculo`), porque é dela que os modais precisam.
 *
 * **O endereço guarda filtro, ordem e página; a busca não.** Texto digitado a cada tecla no histórico
 * seria ruído, e o critério 3 nomeia três coisas. Sem `ordem` no endereço é sem ordenação, e vale a ordem
 * inicial (item 68a).
 */

export const POR_PAGINA = 20;

export const FILTROS = ["todos", "pedidos", "solicitantes", "gestores", "encarregados"] as const;
export type Filtro = (typeof FILTROS)[number];

export const COLUNAS_QUE_ORDENAM = ["pessoa", "papel", "unidade", "atualizacao"] as const;
export type Coluna = (typeof COLUNAS_QUE_ORDENAM)[number];

export type Endereco = {
  readonly filtro: Filtro;
  /** `null` é sem ordenação: vale a ordem inicial (item 68a). */
  readonly ordem: Coluna | null;
  readonly sentido: Sentido;
  readonly pagina: number;
  /**
   * `null` é *Todas*. Não é validado aqui: só a tabela sabe quais existem, e ela passa por
   * `etiquetaVigente` (item 115).
   */
  readonly etiqueta: string | null;
};

export const ENDERECO_PADRAO: Endereco = { filtro: "todos", ...SEM_ORDENACAO, pagina: 1, etiqueta: null };

export const ROTULO_DO_FILTRO: Readonly<Record<Filtro, string>> = {
  todos: "Todos",
  pedidos: "Pedidos de entrada",
  solicitantes: "Solicitantes",
  gestores: "Gestores",
  encarregados: "Encarregados",
};

/** O vazio de cada opção (guia §8). O de *Todos* é inalcançável pela tela: ver o teste. */
export const VAZIO_DO_FILTRO: Readonly<
  Record<Filtro, { readonly titulo: string; readonly corpo: string | null }>
> = {
  todos: { titulo: "Ninguém nesta organização.", corpo: null },
  pedidos: {
    titulo: SEM_PEDIDOS,
    corpo: "Os pedidos aparecem aqui quando alguém usa o código da organização.",
  },
  solicitantes: { titulo: "Nenhum Solicitante nesta organização.", corpo: null },
  gestores: { titulo: "Nenhum Gestor nesta organização.", corpo: null },
  encarregados: { titulo: "Nenhum Encarregado nesta organização.", corpo: null },
};

/** As mesmas palavras do modal do item 20 — é o mesmo evento (critério 10.6). */
export const TEXTO_DA_BUSCA_VAZIA = "Ninguém com esse nome.";

/** O que a tabela lê de `PedidoDeEntradaDetalhe` (contrato §4.6: o pedido não carrega lista de contatos). */
export type PedidoNaTabela = {
  readonly id: string;
  readonly pessoa: { readonly nome: string; readonly telefoneInformado: string | null };
  readonly criadoEm: string;
};

export type ContatoNaLinha = {
  readonly chave: string;
  /** O que se lê e o que se copia: o telefone já legível, ou o e-mail como está. */
  readonly valor: string;
  /** "Pessoal", "Trabalho", "Recado"; `null` no pedido, que não carrega finalidade. */
  readonly finalidade: string | null;
  readonly whatsapp: boolean;
};

type Comum = {
  readonly chave: string;
  readonly nome: string;
  readonly rotuloDoPapel: string;
  readonly unidade: string | null;
  readonly telefones: readonly ContatoNaLinha[];
  readonly emails: readonly ContatoNaLinha[];
  /** O instante da entrada. Fica, porque é a chave dos pedidos e o segundo termo da ordem inicial. */
  readonly desde: string;
  /**
   * O instante da última alteração, para ordenar. `null` é *nenhuma alteração registrada* — e a data de
   * entrada **não** entra no lugar: a coluna existe para não mostrar a criação vestida de atualização.
   */
  readonly atualizadoEm: string | null;
  /** O que a coluna escreve, ou `null` quando ela escreve o traço. */
  readonly atualizadoTexto: string | null;
  /** Em ordem alfabética. Pedido não tem (não é vínculo). Item 115. */
  readonly etiquetas: readonly EtiquetaNaTela[];
};

export type LinhaDePedido = Comum & { readonly tipo: "pedido"; readonly pedido: PedidoNaTabela };

export type LinhaDeVinculo = Comum & {
  readonly tipo: "vinculo";
  readonly vinculo: VinculoProjetado;
  readonly papel: string;
  readonly ehVoce: boolean;
  readonly impedimento: ImpedimentoNaTela | null;
};

export type LinhaDeParticipante = LinhaDePedido | LinhaDeVinculo;

export type ContextoDaTabela = {
  readonly euPessoaId: string;
  readonly impedimentos: Readonly<Record<string, ImpedimentoNaTela>>;
};

/**
 * Os contatos da linha, **separados por tipo e na ordem cadastrada** (item 68a): a célula mostra um ícone
 * por tipo, e o `popover` de cada um lista todos daquele tipo. Não há mais *"+N"*.
 */
function contatosPorTipo(contatos: VinculoProjetado["pessoa"]["contatos"]): {
  readonly telefones: readonly ContatoNaLinha[];
  readonly emails: readonly ContatoNaLinha[];
} {
  const naLinha = (contato: VinculoProjetado["pessoa"]["contatos"][number]): ContatoNaLinha => {
    const lido = contatoEmLeitura(contato);
    return { chave: contato.id, valor: lido.valor, finalidade: lido.finalidade, whatsapp: lido.whatsapp !== null };
  };
  return {
    telefones: contatos.filter((contato) => contato.tipo === "telefone").map(naLinha),
    emails: contatos.filter((contato) => contato.tipo === "email").map(naLinha),
  };
}

export function linhaDoPedido(pedido: PedidoNaTabela): LinhaDePedido {
  return {
    tipo: "pedido",
    pedido,
    chave: `pedido:${pedido.id}`,
    nome: pedido.pessoa.nome,
    rotuloDoPapel: ROTULO_SEM_PAPEL,
    unidade: null,
    telefones:
      pedido.pessoa.telefoneInformado === null
        ? []
        : [
            {
              chave: "telefone-informado",
              valor: telefoneLegivel(pedido.pessoa.telefoneInformado),
              finalidade: null,
              whatsapp: false,
            },
          ],
    emails: [],
    desde: pedido.criadoEm,
    // **Pedido pendente não foi alterado**: a coluna mostra o traço, como em vínculo nunca mexido.
    atualizadoEm: null,
    atualizadoTexto: null,
    etiquetas: [],
  };
}

export function linhaDoVinculo(vinculo: VinculoProjetado, contexto: ContextoDaTabela): LinhaDeVinculo {
  const contatos = contatosPorTipo(vinculo.pessoa.contatos);
  return {
    tipo: "vinculo",
    vinculo,
    chave: `vinculo:${vinculo.pessoa.pessoaId}`,
    nome: vinculo.pessoa.nome,
    papel: vinculo.papel,
    rotuloDoPapel: rotuloDoPapel(vinculo.papel),
    unidade: vinculo.area?.nome ?? null,
    telefones: contatos.telefones,
    emails: contatos.emails,
    desde: vinculo.criadoEm,
    atualizadoEm: vinculo.atualizadoEm,
    atualizadoTexto: vinculo.atualizadoEm === null ? null : dataCurta(vinculo.atualizadoEm),
    ehVoce: vinculo.pessoa.pessoaId === contexto.euPessoaId,
    impedimento: contexto.impedimentos[vinculo.pessoa.pessoaId] ?? null,
    etiquetas: vinculo.etiquetas,
  };
}

export function montarLinhas(
  entrada: {
    readonly pedidos: readonly PedidoNaTabela[];
    readonly vinculos: readonly VinculoProjetado[];
  } & ContextoDaTabela,
): readonly LinhaDeParticipante[] {
  return [
    ...entrada.pedidos.map(linhaDoPedido),
    ...entrada.vinculos.map((vinculo) => linhaDoVinculo(vinculo, entrada)),
  ];
}

const PAPEL_DO_FILTRO: Readonly<Record<"solicitantes" | "gestores" | "encarregados", string>> = {
  solicitantes: "solicitante",
  gestores: "gestor",
  encarregados: "encarregado",
};

export function pertenceAoFiltro(linha: LinhaDeParticipante, filtro: Filtro): boolean {
  if (filtro === "todos") return true;
  if (filtro === "pedidos") return linha.tipo === "pedido";
  return linha.tipo === "vinculo" && linha.papel === PAPEL_DO_FILTRO[filtro];
}

/**
 * **As contagens são do conjunto inteiro, e a busca não as muda.** É o *"o contador não mente"* da lista
 * anterior: a contagem responde *quantos há*, e a busca responde *quem casa*. O que a busca muda é a
 * faixa do rodapé.
 */
export function contagensDoFiltro(
  linhas: readonly LinhaDeParticipante[],
): Readonly<Record<Filtro, number>> {
  return {
    todos: linhas.length,
    pedidos: linhas.filter((linha) => pertenceAoFiltro(linha, "pedidos")).length,
    solicitantes: linhas.filter((linha) => pertenceAoFiltro(linha, "solicitantes")).length,
    gestores: linhas.filter((linha) => pertenceAoFiltro(linha, "gestores")).length,
    encarregados: linhas.filter((linha) => pertenceAoFiltro(linha, "encarregados")).length,
  };
}

/** **Reuso literal, sem cópia:** `termosDaBusca` e `casaPeloNome` são do item 20 e recebem `string`. */
export function filtrarPeloNome<T extends { readonly nome: string }>(
  itens: readonly T[],
  busca: string,
): readonly T[] {
  const termos = termosDaBusca(busca);
  if (termos.length === 0) return itens;
  return itens.filter((item) => casaPeloNome(item.nome, termos));
}

const COLACAO = new Intl.Collator("pt-BR", { sensitivity: "base" });

function porNome(a: LinhaDeParticipante, b: LinhaDeParticipante): number {
  return COLACAO.compare(a.nome, b.nome);
}

function primaria(coluna: Coluna, a: LinhaDeParticipante, b: LinhaDeParticipante): number {
  if (coluna === "pessoa") return porNome(a, b);
  if (coluna === "papel") return COLACAO.compare(a.rotuloDoPapel, b.rotuloDoPapel);
  if (coluna === "unidade") return COLACAO.compare(a.unidade ?? "", b.unidade ?? "");
  return Date.parse(a.atualizadoEm ?? "") - Date.parse(b.atualizadoEm ?? "");
}

/** **Sem valor vai sempre para o fim**, nos dois sentidos. Era a regra de *Unidade*, e agora são duas. */
function semValor(coluna: Coluna, linha: LinhaDeParticipante): boolean {
  if (coluna === "unidade") return linha.unidade === null;
  if (coluna === "atualizacao") return linha.atualizadoEm === null;
  return false;
}

/**
 * **Sem ordenação vale a ordem inicial** (item 68a): pedidos no topo pela entrada mais recente, depois os
 * vínculos pela **última atualização quando existe, e pela entrada quando não** (item 68b) — linha nunca
 * alterada fica onde estava.
 *
 * **Com uma coluna escolhida, ela manda**, e o pedido não tem lugar reservado. O empate é pelo nome e o
 * último desempate é a chave, para a ordem não mudar entre duas renderizações do mesmo conjunto.
 */
export function ordenarLinhas(
  linhas: readonly LinhaDeParticipante[],
  ordem: Coluna | null,
  sentido: Sentido,
): readonly LinhaDeParticipante[] {
  if (ordem === null) return [...linhas].sort(ordemInicial);
  const fator = sentido === "crescente" ? 1 : -1;
  return [...linhas].sort((a, b) => {
    const vazio = semValor(ordem, a);
    if (vazio !== semValor(ordem, b)) return vazio ? 1 : -1;
    // **Os dois sem valor não vão à primária**: `Date.parse("")` é `NaN`, e um comparador que devolve
    // `NaN` deixa a ordem indefinida. Vão direto ao desempate.
    const primeiro = vazio ? 0 : primaria(ordem, a, b) * fator;
    if (primeiro !== 0) return primeiro;
    return desempate(ordem === "pessoa" ? 0 : porNome(a, b), a, b);
  });
}

function ordemInicial(a: LinhaDeParticipante, b: LinhaDeParticipante): number {
  if (a.tipo !== b.tipo) return a.tipo === "pedido" ? -1 : 1;
  const maisRecente = Date.parse(relogioInicial(b)) - Date.parse(relogioInicial(a));
  if (maisRecente !== 0) return maisRecente;
  return desempate(porNome(a, b), a, b);
}

/** A última alteração quando ela existe, e a entrada quando não. O pedido cai sempre na entrada. */
function relogioInicial(linha: LinhaDeParticipante): string {
  return linha.atualizadoEm ?? linha.desde;
}

function desempate(peloNome: number, a: LinhaDeParticipante, b: LinhaDeParticipante): number {
  if (peloNome !== 0) return peloNome;
  return a.chave < b.chave ? -1 : a.chave > b.chave ? 1 : 0;
}

export type Pagina<T> = {
  readonly itens: readonly T[];
  readonly pagina: number;
  readonly totalDePaginas: number;
  readonly total: number;
  /** A primeira linha desta página, a partir de um. Zero quando a página não tem nenhuma. */
  readonly inicio: number;
  readonly fim: number;
};

export function paginar<T>(itens: readonly T[], pagina: number): Pagina<T> {
  const total = itens.length;
  const totalDePaginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const salto = (pagina - 1) * POR_PAGINA;
  const fatia = itens.slice(salto, salto + POR_PAGINA);
  return {
    itens: fatia,
    pagina,
    totalDePaginas,
    total,
    inicio: fatia.length === 0 ? 0 : salto + 1,
    fim: salto + fatia.length,
  };
}

/** `1–20 de 43`, com o travessão pequeno de faixa. */
export function faixaDaPagina(pagina: Pick<Pagina<unknown>, "inicio" | "fim" | "total">): string {
  return pagina.inicio === 0
    ? `0 de ${String(pagina.total)}`
    : `${String(pagina.inicio)}–${String(pagina.fim)} de ${String(pagina.total)}`;
}

function umDe<T extends string>(lista: readonly T[], valor: string | null, padrao: T): T {
  return lista.find((item) => item === valor) ?? padrao;
}

/** **Valor desconhecido vale o padrão, sem erro**: `?filtro=xyz` é *Todos*, `?pagina=0` é a primeira. */
export function lerEndereco(parametros: { get: (nome: string) => string | null }): Endereco {
  const pagina = Number(parametros.get("pagina"));
  return {
    filtro: umDe(FILTROS, parametros.get("filtro"), "todos"),
    ...lerOrdenacao(parametros, COLUNAS_QUE_ORDENAM),
    pagina: Number.isInteger(pagina) && pagina >= 1 ? pagina : 1,
    etiqueta: parametros.get("etiqueta") || null,
  };
}

/** O que vai para o endereço. **O padrão não aparece**, para o endereço limpo continuar limpo. */
export function escreverEndereco(endereco: Endereco): string {
  const consulta = new URLSearchParams();
  if (endereco.filtro !== "todos") consulta.set("filtro", endereco.filtro);
  if (endereco.etiqueta !== null) consulta.set("etiqueta", endereco.etiqueta);
  escreverOrdenacao(consulta, endereco);
  if (endereco.pagina > 1) consulta.set("pagina", String(endereco.pagina));
  return consulta.toString();
}

/** Conjunto novo, primeira página — a regra de T-03 (`semPaginacao`). */
export function comFiltro(endereco: Endereco, filtro: Filtro): Endereco {
  return { ...endereco, filtro, pagina: 1 };
}

/** Conjunto novo, primeira página — a regra de `comFiltro`. */
export function comEtiqueta(endereco: Endereco, etiqueta: string | null): Endereco {
  return { ...endereco, etiqueta, pagina: 1 };
}

/**
 * **Etiqueta que não existe mais vale *Todas*** (`respostas.md` P1). É o que acontece quando o Gestor apaga
 * na gerência a etiqueta que está filtrando: a lista volta inteira, em vez de ficar vazia sem motivo.
 */
export function etiquetaVigente(etiqueta: string | null, todas: readonly EtiquetaNaTela[]): string | null {
  return etiqueta !== null && todas.some((existente) => existente.id === etiqueta) ? etiqueta : null;
}

/** **Combina com o papel por E** (`respostas.md` P1). Pedido não tem etiqueta, e não pertence a nenhuma. */
export function pertenceAEtiqueta(linha: LinhaDeParticipante, etiqueta: string | null): boolean {
  if (etiqueta === null) return true;
  return linha.etiquetas.some((existente) => existente.id === etiqueta);
}

/**
 * **As contagens são do conjunto inteiro**, como as do papel (`contagensDoFiltro`): nenhuma régua segue a
 * escolha da outra (`respostas.md` P1). `todas` é o total; etiqueta sem uso conta `0`.
 */
export function contagensDeEtiquetas(
  linhas: readonly LinhaDeParticipante[],
  todas: readonly EtiquetaNaTela[],
): Readonly<Record<string, number>> {
  const contagens: Record<string, number> = { todas: linhas.length };
  for (const etiqueta of todas) {
    contagens[etiqueta.id] = linhas.filter((linha) => pertenceAEtiqueta(linha, etiqueta.id)).length;
  }
  return contagens;
}

/** O ciclo de três estados (item 68a), e a página volta à primeira. */
export function comOrdem(endereco: Endereco, coluna: Coluna): Endereco {
  return { ...endereco, ...proximaOrdenacao(endereco, coluna), pagina: 1 };
}

export function naPagina(endereco: Endereco, pagina: number): Endereco {
  return { ...endereco, pagina };
}

export function ariaSort(endereco: Endereco, coluna: Coluna): "ascending" | "descending" | "none" {
  return ariaSortDa(endereco, coluna);
}

export type EstadoDaTabela = "lista" | "vazio-do-filtro" | "busca-vazia" | "alem-do-fim";

/**
 * **A precedência é esta ordem**: o vazio da opção ganha da busca (a busca não escondeu nada), e a busca
 * ganha do além do fim (a paginação recomeça quando a busca muda).
 */
export function estadoDaTabela(entrada: {
  readonly noFiltro: number;
  readonly encontradas: number;
  readonly pagina: number;
  readonly totalDePaginas: number;
}): EstadoDaTabela {
  if (entrada.noFiltro === 0) return "vazio-do-filtro";
  if (entrada.encontradas === 0) return "busca-vazia";
  if (entrada.pagina > entrada.totalDePaginas) return "alem-do-fim";
  return "lista";
}
