"use client";

import { ChevronDown, X } from "lucide-react";
import { useState } from "react";

import {
  comValorUnico,
  filtrarOpcoes,
  primeirasOpcoes,
  rotuloDoGatilho,
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
 * com dois valores filtra pelos dois, e o gatilho diz *"Área: 2 selecionados"* — a regra de contar em vez
 * de inventar nome, que `rotuloDoGatilho` carrega.
 *
 * **As opções chegam prontas do servidor**, no mesmo `Promise.all` das categorias. Por isso não há estado
 * *carregando* aqui: quando o painel abre, a lista já existe.
 *
 * **Sem `aria-pressed`, e a diferença é o papel.** Os três menus de hoje são botões de alternar e o
 * carregam; aqui o gatilho é `combobox`, e `aria-pressed` não vale nesse papel. O estado ligado continua
 * carregando a palavra — o valor escolhido está dentro do rótulo, que é o que o compromisso A-5 pede —,
 * e a borda da marca acompanha sem ser a única pista.
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
  /** O nome da dimensão, que é o rótulo do gatilho sem valor. */
  nome: string;
  parametro: string;
  opcoes: readonly OpcaoComBusca[];
  marcados: readonly string[];
  /** A *query string* atual, crua, como a página a recebeu. */
  consultaAtual: string;
  textoDaBusca: string;
  textoDoVazio: string;
}) {
  const celular = useIsMobile();
  const { navegar } = useNavegacaoDaLista();
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");

  const ligado = marcados.length > 0;
  // Antes de digitar, as dez primeiras por nome; digitando, todas as que casam.
  const visiveis = busca.trim() === "" ? primeirasOpcoes(opcoes) : filtrarOpcoes(opcoes, busca);

  function mudarAbertura(proximo: boolean) {
    setAberto(proximo);
    if (!proximo) setBusca("");
  }

  function escolher(valor: string | null) {
    navegar(comValorUnico(consultaAtual, parametro, valor));
    setAberto(false);
    setBusca("");
  }

  const gatilho = (
    <Button
      type="button"
      variant="outline"
      role="combobox"
      aria-expanded={aberto}
      className={cn(
        "border-linha bg-superficie text-tinta text-interface h-11 justify-start gap-1.5 rounded-md border px-3 font-normal",
        "focus-visible:outline-marca focus-visible:outline-2 focus-visible:outline-offset-2",
        ligado && "border-marca text-tinta-marca font-semibold",
      )}
    >
      {rotuloDoGatilho(nome, opcoes, marcados)}
      <ChevronDown aria-hidden="true" className="size-4 shrink-0" />
    </Button>
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
        {visiveis.length === 0 ? (
          /* Uma linha, sem botão: o caminho de saída é apagar o que foi digitado. */
          <p className="text-meta text-tinta-suave px-3 py-6 text-center">{textoDoVazio}</p>
        ) : (
          visiveis.map((opcao) => (
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
          ))
        )}
      </CommandList>
      {ligado && (
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
