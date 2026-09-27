"use client";

import { CalendarRange } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { DateRange } from "react-day-picker";
import { ptBR } from "react-day-picker/locale";

import {
  deDia,
  ehAFaixaAplicada,
  limitesDoCalendario,
  nomeDaFaixa,
  paraDia,
  rotuloDaFaixa,
  type AtalhosDoPeriodo,
  type ChaveDeAtalho,
  type Faixa,
} from "@/interface/componentes/faixa-de-periodo";
import { Button } from "@/interface/componentes/ui/button";
import { Calendar } from "@/interface/componentes/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/interface/componentes/ui/popover";
import { cn } from "@/interface/componentes/utilitarios";
import { useIsMobile } from "@/interface/ganchos/use-mobile";

/**
 * ============================================================================
 *  A faixa de período de T-07 — item 71
 * ============================================================================
 *
 * **A peça saiu do `<form method="get">` porque o calendário do catálogo é de cliente por construção.**
 * Essa propriedade se perde no primeiro byte do item, e a escolha que sobra é como o `Aplicar` navega.
 *
 * **`push` dentro de uma transição, e não formulário com campos ocultos.** Três razões:
 *
 * 1. é o que a barra de filtros de T-03 já faz, com a razão escrita em `navegacao-da-lista.tsx`: numa
 *    tela cuja interação principal é recortar, voltar como desfazer vale mais que sair da tela num toque;
 * 2. o painel do `popover` renderiza dentro de um portal, e um botão de envio dentro dele não pertence ao
 *    formulário — só voltaria a pertencer por um atributo que ninguém neste repositório usa;
 * 3. com navegação suave o painel continua montado, e fechá-lo passa a ser gesto escrito.
 *
 * **O preço, dito: sem JavaScript o período deixa de ser escolhível na tela.** O endereço continua
 * respondendo, e é o mesmo de sempre.
 *
 * **Não se reusa o `NavegacaoDaLista`.** Aquele provedor existe porque três peças de T-03 dividem um
 * estado de espera; aqui há uma peça só, e um contexto para um consumidor é cerimônia.
 *
 * **O rótulo do gatilho só muda depois de aplicar.** Ele é escrito a partir de `periodo`, que vem do
 * servidor; a escolha pendente dentro do painel não o toca.
 *
 * **O calendário não desabilita dia no futuro**, e é decisão: o teto seria uma segunda noção de *hoje*,
 * escrita no relógio de quem abre, ao lado da que a Aplicação já tem no fuso do produto. E faixa no
 * futuro precisa continuar alcançável, porque o painel responde a ela com os quadros vazios.
 *
 * **A casa do calendário mede 44 px**, e não os 32 do registro: o alvo de toque do lote vale para o que
 * mais se clica nesta peça. A conta cabe nas duas larguras, e a fusão de classes tem teste.
 */

/** Os quatro rótulos. As janelas vêm prontas da Aplicação; as palavras são daqui. */
const ATALHOS: ReadonlyArray<{ readonly chave: ChaveDeAtalho; readonly rotulo: string }> = [
  { chave: "sete", rotulo: "últimos 7 dias" },
  { chave: "trinta", rotulo: "últimos 30 dias" },
  { chave: "noventa", rotulo: "últimos 90 dias" },
  { chave: "mes", rotulo: "este mês" },
];

/** O menu de meses do catálogo formata no idioma do aparelho; o produto é todo em pt-BR. */
const MES_CURTO = new Intl.DateTimeFormat("pt-BR", { month: "short" });

export function SeletorDePeriodo({
  periodo,
  atalhos,
  consultaAtual,
}: {
  readonly periodo: Faixa;
  readonly atalhos: AtalhosDoPeriodo;
  /** A *query string* atual, crua, como a página a recebeu. */
  readonly consultaAtual: string;
}) {
  const celular = useIsMobile();
  const router = useRouter();
  const caminho = usePathname();
  const [, comecar] = useTransition();
  const [aberto, setAberto] = useState(false);
  const [escolha, setEscolha] = useState<DateRange | undefined>(undefined);

  const limites = limitesDoCalendario(periodo);
  const completa = escolha?.from !== undefined && escolha.to !== undefined;

  function aplicar(faixa: Faixa) {
    const proximos = new URLSearchParams(consultaAtual);
    proximos.set("de", faixa.de);
    proximos.set("ate", faixa.ate);
    setAberto(false);
    comecar(() => router.push(`${caminho}?${proximos.toString()}`));
  }

  /** Abrir parte sempre do recorte aplicado; fechar sem aplicar não deixa resíduo. */
  function mudarAbertura(proximo: boolean) {
    setAberto(proximo);
    if (proximo) setEscolha({ from: deDia(periodo.de), to: deDia(periodo.ate) });
  }

  return (
    <Popover open={aberto} onOpenChange={mudarAbertura}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          aria-label={nomeDaFaixa(periodo)}
          className="border-linha bg-superficie text-tinta text-interface min-h-11 justify-start gap-2 px-3 font-mono font-normal"
        >
          <CalendarRange aria-hidden="true" className="size-[15px] shrink-0" />
          {rotuloDaFaixa(periodo)}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        className="border-linha bg-superficie w-auto max-w-[calc(100vw-32px)] p-0"
      >
        <div className="flex flex-col md:flex-row">
          <div className="border-linha flex flex-wrap gap-1 border-b p-3 md:w-44 md:flex-col md:flex-nowrap md:border-r md:border-b-0">
            {ATALHOS.map(({ chave, rotulo }) => (
              <Button
                key={chave}
                type="button"
                variant="ghost"
                disabled={ehAFaixaAplicada(periodo, atalhos[chave])}
                onClick={() => aplicar(atalhos[chave])}
                className={cn(
                  "text-interface min-h-11 justify-start px-3 font-normal",
                  // O apagado do catálogo é meia opacidade, que sobre a tinta fraca some. A tinta fraca já
                  // diz "não faz nada", e ela está medida no tema.
                  ehAFaixaAplicada(periodo, atalhos[chave])
                    ? "text-tinta-suave disabled:opacity-100"
                    : "text-tinta",
                )}
              >
                {rotulo}
              </Button>
            ))}
          </div>

          <div className="flex flex-col">
            <Calendar
              mode="range"
              selected={escolha}
              onSelect={(faixa) => setEscolha(faixa)}
              numberOfMonths={celular ? 1 : 2}
              defaultMonth={deDia(periodo.de)}
              captionLayout="dropdown"
              startMonth={limites.inicio}
              endMonth={limites.fim}
              locale={ptBR}
              formatters={{ formatMonthDropdown: (mes) => MES_CURTO.format(mes) }}
              className="[--cell-size:--spacing(11)]"
            />

            <div className="border-linha flex justify-end border-t p-3">
              <Button
                type="button"
                variant="outline"
                disabled={!completa}
                onClick={() => {
                  // A seleção nasce completa, semeada com o recorte. Ela fica sem faixa num caso só —
                  // clicar no único dia de uma faixa de um dia —, e aplicar aí inventaria as duas pontas.
                  if (escolha?.from === undefined || escolha.to === undefined) return;
                  aplicar({ de: paraDia(escolha.from), ate: paraDia(escolha.to) });
                }}
                className="border-linha text-tinta text-interface min-h-11 w-full px-4 md:w-auto"
              >
                Aplicar
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
