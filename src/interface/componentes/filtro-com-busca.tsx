"use client";

import { ChevronDown, X } from "lucide-react";
import { useState } from "react";

import {
  ROTULO_ACIMA,
  comValorUnico,
  filtrarOpcoes,
  primeirasOpcoes,
  rotuloDoGatilho,
  valorDoGatilho,
  type OpcaoComBusca,
} from "@/interface/componentes/filtros-da-lista";
import { Button } from "@/interface/componentes/ui/button";
import {
  Command,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/interface/componentes/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/interface/componentes/ui/popover";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/interface/componentes/ui/sheet";
import { cn } from "@/interface/componentes/utilitarios";
import { useIsMobile } from "@/interface/ganchos/use-mobile";

import { useNavegacaoDaLista } from "./navegacao-da-lista";

/**
 * ============================================================================
 *  Um filtro de T-03 com busca dentro — item 67, critério 67.1
 * ============================================================================
 *
 * **A anatomia é a dos três menus que já existem**, e a peça que abre é a do `SeletorDeArea` de T-04:
 * painel ancorado no gatilho na tela grande, gaveta de baixo no celular, pelo mesmo limiar de 768 px.
 *
 * **A busca é a nossa, e a do `cmdk` fica desligada** — `shouldFilter={false}`, e a lista chega filtrada
 * por `filtrarOpcoes`. O filtro de fábrica do `cmdk` é pontuação aproximada e acharia *Garagem* digitando
 * *"gm"*; duas buscas com regras diferentes na mesma aplicação é o que o projeto recusou no item 44l.
 *
 * **Escolha simples na tela, lista na URL.** O gatilho mostra um valor e escolher outro troca; o
 * parâmetro, porém, é lista separada por vírgula, como `status` e `categoriaId`. Endereço montado à mão
 * com dois valores filtra pelos dois, e o gatilho diz *"2 selecionados"* — a regra de contar em vez
 * de inventar nome, que `rotuloDoGatilho` e `valorDoGatilho` carregam.
 *
 * **As opções chegam prontas do servidor**, no mesmo `Promise.all` das categorias. Por isso não há estado
 * *carregando* aqui: quando o painel abre, a lista já existe.
 *
 * **Sem `aria-pressed`, e a diferença é o papel.** Os três menus de hoje são botões de alternar e o
 * carregam; aqui o gatilho é `combobox`, e `aria-pressed` não vale nesse papel. O estado ligado continua
 * carregando a palavra — o valor escolhido está dentro do nome acessível, que é o que o compromisso A-5
 * pede —, e a borda da marca acompanha sem ser a única pista.
 *
 * **Desde o item 120 o desenho é `EscolhaComBusca`**, que T-08 também usa para a etiqueta; este
 * componente é o embrulho de T-03, que escreve o endereço e põe o rótulo acima.
 */
export function FiltroComBusca({
  nome,
  parametro,
  opcoes,
  marcados,
  consultaAtual,
  textoDaBusca,
  textoDoVazio,
}: {
  /** O nome da dimensão, que é o rótulo acima do gatilho. */
  nome: string;
  parametro: string;
  opcoes: readonly OpcaoComBusca[];
  marcados: readonly string[];
  /** A *query string* atual, crua, como a página a recebeu. */
  consultaAtual: string;
  textoDaBusca: string;
  textoDoVazio: string;
}) {
  const { navegar } = useNavegacaoDaLista();
  return (
    <div className="flex flex-col gap-1.5">
      {/* `aria-hidden`: o nome acessível do gatilho já começa pelo nome da dimensão. */}
      <span aria-hidden="true" className={ROTULO_ACIMA}>
        {nome}
      </span>
      <EscolhaComBusca
        nome={nome}
        // O nome acessível contém o texto visível (WCAG 2.5.3): sem valor, *"Área: Qualquer"*, e não só *"Área"*.
        rotuloAcessivel={marcados.length === 0 ? `${nome}: Qualquer` : rotuloDoGatilho(nome, opcoes, marcados)}
        textoDoGatilho={valorDoGatilho(opcoes, marcados, "Qualquer")}
        ligado={marcados.length > 0}
        opcoes={opcoes}
        aoEscolher={(valor) => {
          navegar(comValorUnico(consultaAtual, parametro, valor));
        }}
        textoDaBusca={textoDaBusca}
        textoDoVazio={textoDoVazio}
      />
    </div>
  );
}

/**
 * **O desenho do filtro com busca, sem saber de endereço** (item 120): o gatilho, a lista com a busca do
 * projeto, o painel ancorado na tela grande e a gaveta de baixo no celular. Quem usa decide o que escolher
 * faz — T-03 navega, T-08 escreve o próprio endereço.
 */
export function EscolhaComBusca({
  id,
  nome,
  rotuloAcessivel,
  textoDoGatilho,
  ligado,
  opcoes,
  aoEscolher,
  textoDaBusca,
  textoDoVazio,
  comLimpar = true,
  fixa,
}: {
  /** O `id` do gatilho, para um `<label htmlFor>` de fora. */
  id?: string;
  /** O título da gaveta no celular e o nome do painel. */
  nome: string;
  /** O nome acessível do gatilho, com o valor dentro (compromisso A-5). */
  rotuloAcessivel: string;
  /** O que o gatilho mostra escrito. */
  textoDoGatilho: string;
  ligado: boolean;
  opcoes: readonly OpcaoComBusca[];
  aoEscolher: (valor: string | null) => void;
  textoDaBusca: string;
  textoDoVazio: string;
  /** Sem ele, a opção de limpar some — quem já oferece *Todas* entre as opções não precisa dela. */
  comLimpar?: boolean;
  /**
   * Uma opção desenhada **sempre primeiro**, fora da ordem alfabética e do corte de `primeirasOpcoes` e fora
   * da busca: o *Todas* de T-08. Sem ela, *Todas as etiquetas* cairia no meio da lista, e com dez etiquetas
   * antes de "T" sumiria antes de digitar, sem outra saída do filtro.
   */
  fixa?: OpcaoComBusca;
}) {
  const celular = useIsMobile();
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");

  // Antes de digitar, as dez primeiras por nome; digitando, todas as que casam.
  const visiveis = busca.trim() === "" ? primeirasOpcoes(opcoes) : filtrarOpcoes(opcoes, busca);

  function mudarAbertura(proximo: boolean) {
    setAberto(proximo);
    if (!proximo) setBusca("");
  }

  function escolher(valor: string | null) {
    aoEscolher(valor);
    setAberto(false);
    setBusca("");
  }

  const gatilho = (
    <Button
      type="button"
      id={id}
      variant="outline"
      role="combobox"
      aria-expanded={aberto}
      aria-label={rotuloAcessivel}
      className={cn(
        "border-linha bg-background text-tinta text-interface h-11 justify-start gap-1.5 rounded-sm border px-3 font-normal",
        "focus-visible:outline-marca focus-visible:outline-2 focus-visible:outline-offset-2",
        ligado && "border-marca text-tinta-marca font-semibold",
      )}
    >
      {textoDoGatilho}
      <ChevronDown aria-hidden="true" className="size-4 shrink-0" />
    </Button>
  );

  const item = (opcao: OpcaoComBusca) => (
    <CommandItem
      key={opcao.valor}
      value={opcao.valor}
      onSelect={() => {
        escolher(opcao.valor);
      }}
      className="text-interface text-tinta flex min-h-11 items-center justify-between gap-3 px-3"
    >
      <span className="truncate">{opcao.rotulo}</span>
      {opcao.complemento !== undefined && (
        <span className="text-meta text-tinta-suave shrink-0">{opcao.complemento}</span>
      )}
    </CommandItem>
  );

  const lista = (
    <Command shouldFilter={false} className="bg-transparent">
      <CommandInput
        value={busca}
        onValueChange={setBusca}
        placeholder={textoDaBusca}
        className="text-tinta"
      />
      <CommandList className="max-h-64">
        {fixa !== undefined && item(fixa)}
        {visiveis.length === 0 ? (
          /* Uma linha, sem botão: o caminho de saída é apagar o que foi digitado. */
          <p className="text-meta text-tinta-suave px-3 py-6 text-center">{textoDoVazio}</p>
        ) : (
          visiveis.map(item)
        )}
      </CommandList>
      {ligado && comLimpar && (
        <div className="border-linha border-t p-1">
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              escolher(null);
            }}
            className="text-interface text-tinta-suave h-11 w-full justify-start px-3 font-normal"
          >
            Limpar
          </Button>
        </div>
      )}
    </Command>
  );

  if (celular) {
    return (
      <Sheet open={aberto} onOpenChange={mudarAbertura}>
        <SheetTrigger asChild>{gatilho}</SheetTrigger>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className={cn(
            "bg-superficie border-linha max-h-[85dvh] gap-0 overflow-hidden rounded-t-xl p-0",
            "ease-(--curva-gaveta) data-[state=closed]:duration-(--tempo-gaveta) data-[state=open]:duration-(--tempo-gaveta)",
          )}
        >
          <SheetTitle className="text-titulo-bloco text-tinta px-4 pt-5 pr-14">{nome}</SheetTitle>
          {lista}
          <SheetClose asChild>
            {/* 44 px — compromisso A-3, a mesma medida do fechar do `Modal` do item 44i. */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Fechar"
              className="text-tinta-suave absolute top-3.5 right-3 rounded-sm"
            >
              <X aria-hidden="true" />
            </Button>
          </SheetClose>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Popover open={aberto} onOpenChange={mudarAbertura}>
      <PopoverTrigger asChild>{gatilho}</PopoverTrigger>
      <PopoverContent
        align="start"
        aria-label={nome}
        className="bg-superficie border-linha w-[280px] p-0"
      >
        {lista}
      </PopoverContent>
    </Popover>
  );
}
