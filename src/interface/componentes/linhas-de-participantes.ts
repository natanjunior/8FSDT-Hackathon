import { casaPeloNome, termosDaBusca } from "@/interface/componentes/busca-de-candidatos";
import type { ImpedimentoNaTela } from "@/interface/componentes/frases-da-remocao";
import {
  ROTULO_SEM_PAPEL,
  SEM_PEDIDOS,
  dataCurta,
  rotuloDoPapel,
} from "@/interface/componentes/frases-de-participantes";
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
 * seria ruído, e o critério 3 nomeia três coisas.
 */

export const POR_PAGINA = 20;

export const FILTROS = ["todos", "pedidos", "solicitantes", "gestores", "encarregados"] as const;
export type Filtro = (typeof FILTROS)[number];

export const COLUNAS_QUE_ORDENAM = ["pessoa", "papel", "unidade", "desde"] as const;
export type Coluna = (typeof COLUNAS_QUE_ORDENAM)[number];

export type Sentido = "crescente" | "decrescente";

export type Endereco = {
  readonly filtro: Filtro;
  readonly ordem: Coluna;
  readonly sentido: Sentido;
  readonly pagina: number;
};

export const ENDERECO_PADRAO: Endereco = {
  filtro: "todos",
  ordem: "pessoa",
  sentido: "crescente",
  pagina: 1,
};

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

type Comum = {
  readonly chave: string;
  readonly nome: string;
  readonly rotuloDoPapel: string;
  readonly unidade: string | null;
  readonly contato: string | null;
  readonly maisContatos: number;
  /** O instante, para ordenar. */
  readonly desde: string;
  /** O que a coluna escreve. */
  readonly desdeTexto: string;
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
 * O primeiro contato e quantos sobram. **A palavra WhatsApp acompanha o número** (A-5), e o resto não
 * abre na linha: a lista inteira está em *Editar participante*.
 */
export function contatoResumido(
  contatos: VinculoProjetado["pessoa"]["contatos"],
): { readonly texto: string | null; readonly mais: number } {
  const [primeiro] = contatos;
  if (primeiro === undefined) return { texto: null, mais: 0 };
  const texto =
    primeiro.tipo === "telefone"
      ? `${telefoneLegivel(primeiro.valor)}${primeiro.temWhatsapp ? " · WhatsApp" : ""}`
      : primeiro.valor;
  return { texto, mais: contatos.length - 1 };
}

export function linhaDoPedido(pedido: PedidoNaTabela): LinhaDePedido {
  return {
    tipo: "pedido",
    pedido,
    chave: `pedido:${pedido.id}`,
    nome: pedido.pessoa.nome,
    rotuloDoPapel: ROTULO_SEM_PAPEL,
    unidade: null,
    contato: pedido.pessoa.telefoneInformado === null ? null : telefoneLegivel(pedido.pessoa.telefoneInformado),
    maisContatos: 0,
    desde: pedido.criadoEm,
    desdeTexto: dataCurta(pedido.criadoEm),
  };
}

export function linhaDoVinculo(vinculo: VinculoProjetado, contexto: ContextoDaTabela): LinhaDeVinculo {
  const contato = contatoResumido(vinculo.pessoa.contatos);
  return {
    tipo: "vinculo",
    vinculo,
    chave: `vinculo:${vinculo.pessoa.pessoaId}`,
    nome: vinculo.pessoa.nome,
    papel: vinculo.papel,
    rotuloDoPapel: rotuloDoPapel(vinculo.papel),
    unidade: vinculo.area?.nome ?? null,
    contato: contato.texto,
    maisContatos: contato.mais,
    desde: vinculo.criadoEm,
    desdeTexto: dataCurta(vinculo.criadoEm),
    ehVoce: vinculo.pessoa.pessoaId === contexto.euPessoaId,
    impedimento: contexto.impedimentos[vinculo.pessoa.pessoaId] ?? null,
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
  return Date.parse(a.desde) - Date.parse(b.desde);
}

/**
 * **Os pedidos ficam no topo qualquer que seja a ordem** (critério 1), **sem unidade vai sempre para o
 * fim** nos dois sentidos, o empate é pelo nome e o último desempate é a chave — para a ordem não mudar
 * entre duas renderizações do mesmo conjunto.
 */
export function ordenarLinhas(
  linhas: readonly LinhaDeParticipante[],
  ordem: Coluna,
  sentido: Sentido,
): readonly LinhaDeParticipante[] {
  const fator = sentido === "crescente" ? 1 : -1;
  return [...linhas].sort((a, b) => {
    if (a.tipo !== b.tipo) return a.tipo === "pedido" ? -1 : 1;
    if (ordem === "unidade" && (a.unidade === null) !== (b.unidade === null)) {
      return a.unidade === null ? 1 : -1;
    }
    const primeiro = primaria(ordem, a, b) * fator;
    if (primeiro !== 0) return primeiro;
    const peloNome = ordem === "pessoa" ? 0 : porNome(a, b);
    if (peloNome !== 0) return peloNome;
    return a.chave < b.chave ? -1 : a.chave > b.chave ? 1 : 0;
  });
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
    ordem: umDe(COLUNAS_QUE_ORDENAM, parametros.get("ordem"), "pessoa"),
    sentido: parametros.get("sentido") === "decrescente" ? "decrescente" : "crescente",
    pagina: Number.isInteger(pagina) && pagina >= 1 ? pagina : 1,
  };
}

/** O que vai para o endereço. **O padrão não aparece**, para o endereço limpo continuar limpo. */
export function escreverEndereco(endereco: Endereco): string {
  const consulta = new URLSearchParams();
  if (endereco.filtro !== "todos") consulta.set("filtro", endereco.filtro);
  if (endereco.ordem !== "pessoa") consulta.set("ordem", endereco.ordem);
  if (endereco.sentido === "decrescente") consulta.set("sentido", "decrescente");
  if (endereco.pagina > 1) consulta.set("pagina", String(endereco.pagina));
  return consulta.toString();
}

/** Conjunto novo, primeira página — a regra de T-03 (`semPaginacao`). */
export function comFiltro(endereco: Endereco, filtro: Filtro): Endereco {
  return { ...endereco, filtro, pagina: 1 };
}

/** Na coluna ativa, inverte o sentido; em outra, ordena por ela, crescente. */
export function comOrdem(endereco: Endereco, coluna: Coluna): Endereco {
  return coluna === endereco.ordem
    ? { ...endereco, sentido: endereco.sentido === "crescente" ? "decrescente" : "crescente", pagina: 1 }
    : { ...endereco, ordem: coluna, sentido: "crescente", pagina: 1 };
}

export function naPagina(endereco: Endereco, pagina: number): Endereco {
  return { ...endereco, pagina };
}

export function ariaSort(endereco: Endereco, coluna: Coluna): "ascending" | "descending" | "none" {
  if (endereco.ordem !== coluna) return "none";
  return endereco.sentido === "crescente" ? "ascending" : "descending";
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
