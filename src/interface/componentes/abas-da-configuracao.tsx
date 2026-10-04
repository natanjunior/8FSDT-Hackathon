"use client";

import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

import {
  ABAS_DA_CONFIGURACAO,
  CLASSE_DA_ABA,
  consultaDaAba,
  type AbaDaConfiguracao,
} from "@/interface/componentes/aba-da-configuracao";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/interface/componentes/ui/tabs";

/**
 * **As abas de T-15** (item 120). O servidor lê a aba do endereço e a passa como `inicial`, então o
 * recarregar abre na aba certa sem piscar a primeira.
 *
 * **Trocar de aba escreve o endereço com `replaceState`**: trocar de aba é olhar, e uma entrada de
 * histórico por aba faria o *Voltar* andar dentro da mesma página. E não há ida ao servidor: os três
 * conteúdos já vieram, porque as leituras são contagens baratas (item 106).
 *
 * **No celular a lista de abas quebra linha** e não rola de lado: a medida do item 112 pega controle além
 * da borda do contêiner de rolagem, e encurtar o nome mudaria o que o dono escreveu.
 */
export function AbasDaConfiguracao({
  inicial,
  disponiveis,
  conteudo,
}: {
  inicial: AbaDaConfiguracao;
  disponiveis: readonly AbaDaConfiguracao[];
  conteudo: Readonly<Partial<Record<AbaDaConfiguracao, ReactNode>>>;
}) {
  const caminho = usePathname();
  const [aba, setAba] = useState<AbaDaConfiguracao>(inicial);
  const abas = ABAS_DA_CONFIGURACAO.filter((uma) => disponiveis.includes(uma.valor));

  function escolher(valor: string): void {
    const proxima = abas.find((uma) => uma.valor === valor)?.valor;
    if (proxima === undefined) return;
    setAba(proxima);
    window.history.replaceState(null, "", `${caminho}${consultaDaAba(proxima)}`);
  }

  return (
    <Tabs value={aba} onValueChange={escolher} className="gap-5.5">
      {/* A altura é solta pelo MESMO modificador da base (`group-data-[orientation=horizontal]/tabs:h-9`):
          um `h-auto` puro perde em especificidade, e as abas de 44 px quebrando linha se sobreporiam. */}
      <TabsList variant="line" className="w-full flex-wrap justify-start group-data-[orientation=horizontal]/tabs:h-auto">
        {abas.map((uma) => (
          <TabsTrigger key={uma.valor} value={uma.valor} className={CLASSE_DA_ABA}>
            {uma.rotulo}
          </TabsTrigger>
        ))}
      </TabsList>
      {abas.map((uma) => (
        <TabsContent key={uma.valor} value={uma.valor} className="flex flex-col gap-5.5">
          {conteudo[uma.valor]}
        </TabsContent>
      ))}
    </Tabs>
  );
}
