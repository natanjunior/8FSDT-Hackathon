"use client";

import { ChevronDown, Search, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { FiltroComBusca } from "@/interface/componentes/filtro-com-busca";
import {
  comTitulo,
  comValorUnico,
  PARAMETROS_DE_FILTRO,
  semFiltros,
  type OpcaoComBusca,
} from "@/interface/componentes/filtros-da-lista";
import { Button } from "@/interface/componentes/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/interface/componentes/ui/dropdown-menu";
import { Input } from "@/interface/componentes/ui/input";
import { cn } from "@/interface/componentes/utilitarios";

import { semPaginacao, useNavegacaoDaLista } from "./navegacao-da-lista";

/** Um valor que o menu oferece: o que vai na URL, e a palavra que a pessoa lê. */
export type OpcaoDeFiltro = { valor: string; rotulo: string };

/**
 * ============================================================================
 *  A barra de filtros de T-03 — o item 15
 * ============================================================================
 *
 * **Quem a vê tem `ocorrencia.ler_todas`**, e quem decide isso é a página: aqui não há checagem de
 * permissão nenhuma. Componente que confere permissão é a segunda cópia da regra.
 *
 * **A URL é o estado.** Cada marca produz uma navegação, e a lista anterior fica pintada durante a
 * transição — que é o critério **15.4**, e que só funciona porque a fronteira de espera da listagem **não
 * é chaveada por `searchParams`** (critério **14.7**).
 *
 * **Ela não sabe ler URL, e isso é decisão.** Os rótulos e a consulta atual descem prontos do servidor,
 * que já os parseou com `lerFiltroDeOcorrenciasDaUrl`; chamar `useSearchParams()` aqui seria a segunda
 * leitura da mesma URL, com a segunda tabela de valores válidos atrás dela. A barra só **escreve** URL.
 *
 * **`push`, não `replace`:** numa tela cuja interação principal é filtrar, voltar-como-desfazer vale mais
 * que sair da tela num toque. **O preço, dito:** quatro marcas são quatro entradas de histórico.
 *
 * **A-5 — nada é comunicado só por cor.** O estado ligado **sempre carrega a palavra**, no próprio rótulo
 * do chip: `Status: Pausada`, `Status: 2 selecionados`. Borda, peso e `aria-pressed` acompanham;
 * sozinhos, não valeriam.
 *
 * **O recorte não mora mais aqui.** Desde o item 44c ele é o `toggle-group` do cabeçalho da página — a
 * barra é a das três dimensões do item 15, e recorte nunca foi uma delas.
 *
 * **Não há `⋯`.** O protótipo desenha um no celular e a **§16.5 dele o declara dívida** contra o A-5 —
 * símbolo sem palavra visível. A barra quebra linha em vez de esconder controle atrás de um caractere.
 */
export function BarraDeFiltros({
  consultaAtual,
  status,
  categorias,
  prioridades,
  areas,
  participantes,
}: {
  /** A *query string* atual, crua, como a página a recebeu. */
  consultaAtual: string;
  status: readonly OpcaoDeFiltro[];
  categorias: readonly OpcaoDeFiltro[];
  /** `null` quando quem lê não tem `ocorrencia.alterar_prioridade` — o mesmo portão da coluna (P-03). */
  prioridades: readonly OpcaoDeFiltro[] | null;
  /** As áreas ativas, com o tipo em *meta*. */
  areas: readonly OpcaoComBusca[];
  /**
   * `null` quando quem lê não tem `vinculo.gerir` — **e o campo some**. É a permissão que guarda a lista
   * de participantes; hoje as duas andam juntas no Gestor, e o dia em que se separarem o campo some sem
   * vazar lista de gente.
   */
  participantes: readonly OpcaoComBusca[] | null;
}) {
  const { navegar, pendente } = useNavegacaoDaLista();

  const atual = new URLSearchParams(consultaAtual);

  function marcados(nome: string): readonly string[] {
    const bruto = atual.get(nome);
    return bruto === null || bruto === "" ? [] : bruto.split(",");
  }

  function alternarValor(nome: string, valor: string): void {
    const proximos = new URLSearchParams(atual.toString());
    const atuais = marcados(nome);
    const novos = atuais.includes(valor) ? atuais.filter((um) => um !== valor) : [...atuais, valor];

    if (novos.length === 0) proximos.delete(nome);
    else proximos.set(nome, novos.join(","));

    navegar(semPaginacao(proximos));
  }

  /**
   * **`autor=eu` continua contando como filtro ligado**, e não é descuido: é ele que faz *"Limpar
   * filtros"* aparecer quando só o recorte está ligado, e é a mesma condição que `algumFiltroAplicado`
   * usa do lado do servidor.
   *
   * **A lista vem de `PARAMETROS_DE_FILTRO` desde o item 67**, e não de uma expressão escrita aqui: é a
   * mesma que *Limpar filtros* apaga, e um teste a prende à do servidor.
   */
  const algumLigado = PARAMETROS_DE_FILTRO.some((parametro) => {
    const bruto = atual.get(parametro);
    return bruto !== null && bruto !== "";
  });

  const paradasLigado = atual.get("parada") === "sim";

  return (
    <div
      aria-busy={pendente}
      className="border-linha flex flex-wrap items-center gap-2 border-b px-4 py-3"
    >
      <CampoDoTitulo consultaAtual={consultaAtual} />

      {/*
        **O filtro rápido da D15, e é um clique** — item 101. Não é opção do recorte *Todas · Minhas*: o
        recorte escolhe DE QUEM é o conjunto e as opções não coexistem; *paradas* estreita o conjunto e
        combina com o resto, inclusive com *Minhas*. É filtro, e mora com os filtros.

        **Uma palavra só, e sem contagem** (a spec §4): quem quer o número lê a frase do recorte.
      */}
      <button
        type="button"
        aria-pressed={paradasLigado}
        className={chip(paradasLigado)}
        onClick={() => {
          navegar(comValorUnico(consultaAtual, "parada", paradasLigado ? null : "sim"));
        }}
      >
        Paradas
      </button>

      <MenuDeFiltro
        nome="Status"
        parametro="status"
        opcoes={status}
        marcados={marcados("status")}
        aoAlternar={alternarValor}
      />
      <MenuDeFiltro
        nome="Categoria"
        parametro="categoriaId"
        opcoes={categorias}
        marcados={marcados("categoriaId")}
        aoAlternar={alternarValor}
      />
      {prioridades !== null && (
        <MenuDeFiltro
          nome="Prioridade"
          parametro="prioridade"
          opcoes={prioridades}
          marcados={marcados("prioridade")}
          aoAlternar={alternarValor}
        />
      )}

      <FiltroComBusca
        nome="Área"
        parametro="areaId"
        opcoes={areas}
        marcados={marcados("areaId")}
        consultaAtual={consultaAtual}
        textoDaBusca="Buscar área"
        textoDoVazio="Nenhuma área com esse nome."
      />

      {participantes !== null && (
        <FiltroComBusca
          nome="Responsável"
          parametro="responsavelPessoaId"
          opcoes={participantes}
          marcados={marcados("responsavelPessoaId")}
          consultaAtual={consultaAtual}
          textoDaBusca="Buscar participante"
          textoDoVazio="Ninguém com esse nome."
        />
      )}

      {/*
        **`Link`, e não o caminho limpo.** Limpar filtros mantém a ordem escolhida: quem limpou o recorte
        não pediu para a tabela voltar à coluna de origem (item 67).
      */}
      {algumLigado && (
        <Link
          href={`?${semFiltros(consultaAtual).toString()}`}
          className="text-tinta-marca text-interface ml-auto inline-flex min-h-11 items-center px-2 underline underline-offset-4"
        >
          Limpar filtros
        </Link>
      )}
    </div>
  );
}

/** O `.chip` do protótipo: **44 px de alvo** (A-3), e o estado ligado com borda, peso e cor — nunca só cor. */
function chip(ligado: boolean): string {
  return cn(
    "border-linha bg-background text-tinta text-interface inline-flex h-11 items-center gap-1.5 rounded-sm border px-3",
    "focus-visible:outline-marca focus-visible:outline-2 focus-visible:outline-offset-2",
    ligado && "border-marca text-tinta-marca font-semibold",
  );
}

/**
 * Um chip com o menu de múltipla escolha atrás.
 *
 * **O rótulo é o sinal.** Sem valor, o nome da dimensão; com um, o **nome do valor**; com mais de um, a
 * contagem. Nunca um ponto colorido, nunca um número solto.
 *
 * **Cada marca é uma navegação** — não há estado local de rascunho e não há botão *Aplicar*. Durante a
 * transição o React mantém a árvore anterior pintada, que é o critério **15.4**.
 */
function MenuDeFiltro({
  nome,
  parametro,
  opcoes,
  marcados,
  aoAlternar,
}: {
  nome: string;
  parametro: string;
  opcoes: readonly OpcaoDeFiltro[];
  marcados: readonly string[];
  aoAlternar: (parametro: string, valor: string) => void;
}) {
  const ligado = marcados.length > 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={chip(ligado)} aria-pressed={ligado}>
        {rotuloDoChip(nome, opcoes, marcados)}
        <ChevronDown aria-hidden="true" className="size-4 shrink-0" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {opcoes.map((opcao) => (
          <DropdownMenuCheckboxItem
            key={opcao.valor}
            checked={marcados.includes(opcao.valor)}
            onCheckedChange={() => aoAlternar(parametro, opcao.valor)}
          >
            {opcao.rotulo}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function rotuloDoChip(
  nome: string,
  opcoes: readonly OpcaoDeFiltro[],
  marcados: readonly string[],
): string {
  if (marcados.length === 0) return nome;
  if (marcados.length > 1) return `${nome}: ${marcados.length} selecionados`;

  // Um valor. Se ele não estiver no menu — categoria desativada que veio por link —, conta em vez de
  // inventar nome: é a mesma regra da `descricaoDoRecorte`.
  const opcao = opcoes.find((uma) => uma.valor === marcados[0]);
  return opcao === undefined ? `${nome}: 1 selecionado` : `${nome}: ${opcao.rotulo}`;
}

/** Quanto tempo sem digitar antes de a URL mudar. O desenho pediu 300 ms (`design-64-a-70.md`). */
const ESPERA_DA_DIGITACAO = 300;

/**
 * O campo de busca por título — item 67, critério 67.4.
 *
 * **`replace`, e não `push`.** Cada marca de filtro é um gesto e merece uma entrada de histórico; cada
 * pausa da digitação não é: com `push`, o voltar do navegador desfaria o texto letra por letra em vez de
 * sair do recorte. **O `X` usa `push`**, porque limpar é um gesto.
 *
 * **O campo não remonta quando a lista troca, e é por isso que ele não perde o foco.** O texto vive em
 * estado local; o que a URL diz só é copiado para dentro quando ela muda **por fora** — *Limpar filtros*,
 * o voltar do navegador. A comparação acontece durante a renderização, no padrão de ajustar estado sem
 * efeito, porque `setState` dentro de um efeito é o que a regra `react-hooks/set-state-in-effect`
 * reprova, e este projeto não tem `eslint-disable` para gastar.
 */
function CampoDoTitulo({ consultaAtual }: { consultaAtual: string }) {
  const { navegar } = useNavegacaoDaLista();
  const daUrl = new URLSearchParams(consultaAtual).get("titulo") ?? "";

  const [texto, setTexto] = useState(daUrl);
  const [urlVista, setUrlVista] = useState(daUrl);
  const cronometro = useRef<ReturnType<typeof setTimeout> | null>(null);

  // A URL mudou por fora: o campo acompanha. Durante a renderização, sem efeito.
  if (daUrl !== urlVista) {
    setUrlVista(daUrl);
    setTexto(daUrl);
  }

  // O cronômetro pendente morre com o componente — senão ele navegaria depois de a tela ter saído.
  useEffect(
    () => () => {
      if (cronometro.current !== null) clearTimeout(cronometro.current);
    },
    [],
  );

  function digitar(valor: string) {
    setTexto(valor);
    if (cronometro.current !== null) clearTimeout(cronometro.current);
    cronometro.current = setTimeout(() => {
      setUrlVista(valor.trim());
      navegar(comTitulo(consultaAtual, valor), { substituir: true });
    }, ESPERA_DA_DIGITACAO);
  }

  function limpar() {
    if (cronometro.current !== null) clearTimeout(cronometro.current);
    setTexto("");
    setUrlVista("");
    navegar(comTitulo(consultaAtual, ""));
  }

  return (
    <div className="relative w-full md:w-[280px]">
      <Search
        aria-hidden="true"
        className="text-tinta-suave pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
      />
      {/* O preflight do Tailwind 4 zera a decoração da busca e não o botão de cancelar; sem isto, Chrome e Safari
          desenham um segundo ✕ ao lado do nosso (item 104, A-107). O `type="search"` fica pelo teclado do celular. */}
      <Input
        type="search"
        value={texto}
        onChange={(evento) => {
          digitar(evento.target.value);
        }}
        aria-label="Buscar pelo título"
        placeholder="Buscar pelo título"
        className="border-linha text-interface text-tinta h-11 pr-11 pl-9 [&::-webkit-search-cancel-button]:appearance-none"
      />
      {texto !== "" && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={limpar}
          aria-label="Limpar a busca por título"
          className="text-tinta-suave absolute top-1/2 right-0 size-11 -translate-y-1/2 rounded-sm"
        >
          <X aria-hidden="true" />
        </Button>
      )}
    </div>
  );
}
