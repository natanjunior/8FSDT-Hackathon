"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/interface/componentes/ui/dropdown-menu";
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
}: {
  /** A *query string* atual, crua, como a página a recebeu. */
  consultaAtual: string;
  status: readonly OpcaoDeFiltro[];
  categorias: readonly OpcaoDeFiltro[];
  /** `null` quando quem lê não tem `ocorrencia.alterar_prioridade` — o mesmo portão da coluna (P-03). */
  prioridades: readonly OpcaoDeFiltro[] | null;
}) {
  const caminho = usePathname();
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
   */
  const algumLigado =
    marcados("status").length > 0 ||
    marcados("categoriaId").length > 0 ||
    marcados("prioridade").length > 0 ||
    atual.get("autor") === "eu";

  return (
    <div
      aria-busy={pendente}
      className="border-linha flex flex-wrap items-center gap-2 border-b px-4 py-3"
    >
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

      {algumLigado && (
        <Link
          href={caminho}
          className="text-marca text-interface ml-auto px-2 py-1 underline underline-offset-4"
        >
          Limpar filtros
        </Link>
      )}

      {/*
        A espera carrega palavra, não só opacidade. `role="status"` para quem usa leitor de tela saber que
        a lista abaixo está sendo trocada — sem isso, a mudança é silenciosa.
      */}
      {pendente && (
        <p role="status" className="text-meta text-tinta-suave w-full">
          Atualizando a lista…
        </p>
      )}
    </div>
  );
}

/** O `.chip` do protótipo: **44 px de alvo** (A-3), e o estado ligado com borda, peso e cor — nunca só cor. */
function chip(ligado: boolean): string {
  return cn(
    "border-linha bg-superficie text-tinta text-interface inline-flex h-11 items-center gap-1.5 rounded-md border px-3",
    "focus-visible:outline-marca focus-visible:outline-2 focus-visible:outline-offset-2",
    ligado && "border-marca text-marca font-semibold",
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
        <span aria-hidden>▾</span>
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
