"use client";

import { MapPin, X } from "lucide-react";
import { useState } from "react";

import { areasUsadas, lerAreasUsadas } from "@/interface/componentes/areas-usadas";
import type { PropsDoControle } from "@/interface/componentes/campo";
import { filtrarPeloNome } from "@/interface/componentes/linhas-de-participantes";
import { AREA, rotuloDoTipoDeArea } from "@/interface/componentes/registro-de-ocorrencia";
import { Button } from "@/interface/componentes/ui/button";
import {
  Command,
  CommandGroup,
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

/**
 * ============================================================================
 *  A área com busca — a decisão de agosto que este item finalmente constrói
 * ============================================================================
 *
 * **A §3 do `prototipo-low-fi.md` decidiu (b) e (c) juntos** — campo com busca, com as usadas
 * recentemente no topo — e o produto construiu um seletor nativo. Doze segundos do orçamento do RNF6
 * estavam num campo que não é o conteúdo da ocorrência: é só o endereço dela.
 *
 * **A busca é a nossa, e a do `cmdk` fica desligada.** `shouldFilter={false}`, e a lista chega já
 * filtrada por `filtrarPeloNome`, que envolve `termosDaBusca` e `casaPeloNome` de
 * `busca-de-candidatos.ts`: **prefixo de palavra, sem acento e sem caixa**. O filtro que o `cmdk` traz de
 * fábrica é pontuação aproximada, e acharia *Garagem* digitando *"gm"*. Duas buscas com regras diferentes
 * na mesma aplicação é o defeito que o critério 3 existe para impedir.
 *
 * **Dois blocos, e os dois são filtrados. Reparte primeiro, filtra depois** — é a ordem de composição que
 * `busca-de-candidatos.ts` declara como decisão, e é o que faz a área que está nos dois lugares
 * continuar nos dois enquanto casar. Bloco sem item não desenha o próprio título.
 *
 * **A duplicação entre os blocos é intencional, e está na prancheta** *"T-04 · celular · escolhendo a
 * área"*. Ela não produz o defeito que o modal de atribuição evita: lá, dois controles com o mesmo
 * `pessoaId` seriam duas ações diferentes sobre a mesma pessoa; aqui, escolher a mesma área por dois
 * caminhos dá o mesmo resultado, e o bloco de cima existe só para encurtar o caminho. **O `value` do
 * bloco de cima leva o prefixo `usada:`** porque o `cmdk` identifica item por `value`, e dois itens com o
 * mesmo valor acenderiam juntos na navegação por setas.
 *
 * **A peça que abre depende da largura**, pelo mesmo `useIsMobile` e pelo mesmo limiar de 768 px do
 * `Modal` do item 44i: painel ancorado no gatilho na tela grande, gaveta de baixo no celular. O primeiro
 * valor do gancho é `false` e a troca acontece depois da hidratação, com o painel fechado — o gatilho não
 * guarda estado, então remontá-lo não custa nada.
 *
 * **Quem nomeia o gatilho é o rótulo do `Campo`, por `htmlFor`**, exatamente como já acontece com o
 * gatilho do seletor de T-08 (item 44j) — que também é um botão, e `button` é elemento rotulável. Sem
 * esse precedente eu teria escrito `aria-labelledby`; com ele, a tela não inventa um segundo mecanismo.
 *
 * **Nenhum comentário deste arquivo escreve a tag crua entre sinais de menor e maior**, e não é
 * preciosismo: o critério G7 do guia casa por texto-fonte, e ele não distingue código de comentário — é
 * por isso que `seletor-de-prioridade.tsx` conta cinco e três deles são prosa. Escrever a tag aqui faria
 * o alcance de T-04 falhar a própria guarda.
 *
 * **A lista não pagina e não vira `virtual`.** O `contrato-de-api.md` §7.7 dá *"~15, ~30 e ≤ 200
 * linhas"* para áreas, e 200 itens numa lista rolável não pedem peça nova — é o mesmo argumento que o
 * guia §7 usa para a tabela sem biblioteca.
 */

export type AreaEscolhivel = {
  readonly id: string;
  readonly nome: string;
  readonly tipo: "comum" | "privativa";
};

const CLASSE_DO_ITEM =
  "text-interface text-tinta flex min-h-11 items-center justify-between gap-3 px-3";

function LinhaDaArea({ area }: { readonly area: AreaEscolhivel }) {
  return (
    <>
      <span className="truncate">{area.nome}</span>
      <span className="text-meta text-tinta-suave shrink-0">{rotuloDoTipoDeArea(area.tipo)}</span>
    </>
  );
}

export function SeletorDeArea({
  controle,
  areas,
  valor,
  organizacaoId,
  inerte,
  aoEscolher,
  aoSair,
}: {
  readonly controle: PropsDoControle;
  readonly areas: readonly AreaEscolhivel[];
  readonly valor: string;
  readonly organizacaoId: string;
  readonly inerte: boolean;
  readonly aoEscolher: (areaId: string) => void;
  /** *Sair* do campo, para o modo `campo` do formulário tocado: fechar o painel sem escolher conta. */
  readonly aoSair: () => void;
}) {
  const celular = useIsMobile();
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [guardadas, setGuardadas] = useState<readonly string[]>([]);

  const escolhida = areas.find((area) => area.id === valor);

  const usadasFiltradas = filtrarPeloNome(areasUsadas(guardadas, areas), busca);
  const todasFiltradas = filtrarPeloNome(areas, busca);
  const semResultado = usadasFiltradas.length === 0 && todasFiltradas.length === 0;

  /**
   * **A leitura acontece ao abrir, e no manipulador de abertura — não num efeito.** Ler no corpo do
   * componente divergiria entre o servidor e o cliente na primeira pintura, e o `localStorage` não existe
   * no servidor; ler num gancho de efeito chamaria `setState` dentro dele, que a regra
   * `react-hooks/set-state-in-effect` reprova — e este projeto não tem `eslint-disable` para gastar. O
   * manipulador é o lugar certo pelo argumento da própria regra: abrir é um evento, e ler a preferência
   * do aparelho é a resposta a ele.
   *
   * *(O nome do gancho não é escrito por extenso aqui: a guarda que protege esta decisão casa
   * texto-fonte e não distingue código de prosa.)*
   */
  function mudarAbertura(proximo: boolean) {
    setAberto(proximo);
    if (proximo) {
      setGuardadas(lerAreasUsadas(organizacaoId));
      return;
    }
    setBusca("");
    aoSair();
  }

  function escolher(areaId: string) {
    aoEscolher(areaId);
    setAberto(false);
    setBusca("");
  }

  const gatilho = (
    <Button
      {...controle}
      type="button"
      variant="outline"
      role="combobox"
      aria-expanded={aberto}
      disabled={inerte}
      className="border-linha bg-background text-interface text-tinta min-h-11 w-full justify-start gap-2 font-normal"
    >
      <MapPin aria-hidden="true" className="text-tinta-suave" />
      {escolhida === undefined ? (
        <span className="text-tinta-suave">{AREA.gatilhoVazio}</span>
      ) : (
        <span className="flex min-w-0 items-baseline gap-1.5">
          <span className="truncate">{escolhida.nome}</span>
          <span className="text-meta text-tinta-suave shrink-0">
            · {rotuloDoTipoDeArea(escolhida.tipo)}
          </span>
        </span>
      )}
    </Button>
  );

  const lista = (
    <Command shouldFilter={false} className="bg-transparent">
      <CommandInput
        value={busca}
        onValueChange={setBusca}
        placeholder={AREA.busca}
        className="text-tinta"
      />
      <CommandList className="max-h-[min(58dvh,320px)]">
        {semResultado ? (
          /* Uma linha, sem botão: o caminho de saída é apagar o que foi digitado. */
          <p className="text-corpo text-tinta-suave px-3 py-6 text-center">{AREA.semResultado}</p>
        ) : (
          <>
            {usadasFiltradas.length > 0 && (
              <CommandGroup heading={AREA.usadas}>
                {usadasFiltradas.map((area) => (
                  <CommandItem
                    key={`usada-${area.id}`}
                    value={`usada:${area.id}`}
                    onSelect={() => {
                      escolher(area.id);
                    }}
                    className={CLASSE_DO_ITEM}
                  >
                    <LinhaDaArea area={area} />
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {todasFiltradas.length > 0 && (
              <CommandGroup heading={AREA.todas}>
                {todasFiltradas.map((area) => (
                  <CommandItem
                    key={area.id}
                    value={area.id}
                    onSelect={() => {
                      escolher(area.id);
                    }}
                    className={CLASSE_DO_ITEM}
                  >
                    <LinhaDaArea area={area} />
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </>
        )}
      </CommandList>
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
          <SheetTitle className="text-titulo-bloco text-tinta px-4 pt-5 pr-14">
            {AREA.tituloDoPainel}
          </SheetTitle>
          {lista}
          <SheetClose asChild>
            {/* 44 px — compromisso A-3, a mesma medida do fechar do `Modal` do item 44i. */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={AREA.fechar}
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
        aria-label={AREA.tituloDoPainel}
        className="bg-superficie border-linha w-(--radix-popover-trigger-width) p-0"
      >
        {lista}
      </PopoverContent>
    </Popover>
  );
}
