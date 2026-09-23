"use client";

import { Suspense, use } from "react";

import type { VisibilidadeAplicada } from "@/aplicacao/ocorrencia";
import { ToggleGroup, ToggleGroupItem } from "@/interface/componentes/ui/toggle-group";
import { cn } from "@/interface/componentes/utilitarios";

import { CAIXA_DO_FILTRO, CONTAGEM_DO_FILTRO, OPCAO_DO_FILTRO } from "./filtro-rapido";
import { semPaginacao, useNavegacaoDaLista } from "./navegacao-da-lista";
import { RECORTE_MINHAS, RECORTE_TODAS } from "./rotulos";

/**
 * ============================================================================
 *  O recorte de T-03 — escolha única, e as palavras do critério 14.3
 * ============================================================================
 *
 * **Quem vê isto tem `ocorrencia.ler_todas`**, e quem decide é a página: aqui não há checagem de
 * permissão nenhuma. Quem não tem lê a mesma frase como texto, na mesma fatia do cabeçalho — é o
 * critério **44c.9**, e é a página que o desenha, porque um controle de uma opção só seria um alvo de
 * 44 px que não faz nada.
 *
 * **`type="single"` é o que produz `role="radiogroup"` e `role="radio"`**, e é disso que o critério
 * 44c.8 depende. Escolha única também é a verdade do recorte: as duas opções não coexistem.
 *
 * **A marcação não vive só na cor.** O `toggleVariants` do catálogo pinta o estado ligado com
 * `data-[state=on]:bg-accent`, que resolve para `--accent-bg` — **o mesmo fundo da ação principal da
 * tela**, que aqui é *Registrar ocorrência*, a dois centímetros dali na mesma linha. Duas coisas com o
 * mesmo fundo na mesma linha, uma delas botão e a outra não, é o que o ground sobrescrito evita: fundo de
 * superfície, texto de tinta, peso e sombra. A palavra continua sendo o sinal, e é o compromisso **A-5**.
 *
 * **Trocar de recorte descarta a paginação.** Conjunto novo, corte novo — `semPaginacao`.
 *
 * **As contagens chegam como PROMESSA, e não como número** (item 44p, critério 10). A página monta este
 * cabeçalho **fora** da fronteira de espera — é o que faz o título pintar antes da lista, e está escrito
 * lá em `app/(casca)/ocorrencias/page.tsx` desde o item 14b. Esperar os números aqui faria a tela inteira
 * esperar pela consulta, desfazendo aquela decisão; então o rótulo e o alvo de 44 px aparecem na hora, e
 * **só o número** fica sob um `Suspense` próprio, que chega junto com a lista.
 *
 * **O vazio da espera é vazio mesmo**, e não um traço nem um esqueleto: um placeholder que vira número
 * meio segundo depois é duas informações onde havia uma.
 */
export function SeletorDeRecorte({
  consultaAtual,
  visibilidadeAplicada,
  contagens,
}: {
  /** A *query string* atual, crua, como a página a recebeu. */
  consultaAtual: string;
  visibilidadeAplicada: VisibilidadeAplicada;
  /** Os dois números do painel, medidos pela mesma regra — guia §8, item 44p. */
  contagens: Promise<ContagensDoRecorte>;
}) {
  const { navegar } = useNavegacaoDaLista();

  function aoTrocar(valor: string): void {
    // O Radix devolve `""` quando se toca na opção já marcada. Escolha única não se desmarca.
    if (valor === "") return;

    const proximos = semPaginacao(new URLSearchParams(consultaAtual));
    if (valor === "minhas") proximos.set("autor", "eu");
    else proximos.delete("autor");

    navegar(proximos);
  }

  return (
    <ToggleGroup
      type="single"
      value={visibilidadeAplicada === "todas" ? "todas" : "minhas"}
      onValueChange={aoTrocar}
      aria-label="Recorte da lista"
      spacing={1}
      className={cn(CAIXA_DO_FILTRO, "md:w-auto")}
    >
      <Item valor="todas" rotulo={RECORTE_TODAS} contagens={contagens} />
      <Item valor="minhas" rotulo={RECORTE_MINHAS} contagens={contagens} />
    </ToggleGroup>
  );
}

/** Os dois números do painel que este seletor imprime — os dois medem o mesmo conjunto. */
export type ContagensDoRecorte = { readonly todas: number; readonly minhas: number };

function Item({
  valor,
  rotulo,
  contagens,
}: {
  valor: keyof ContagensDoRecorte;
  rotulo: string;
  contagens: Promise<ContagensDoRecorte>;
}) {
  return (
    <ToggleGroupItem
      value={valor}
      className={cn(OPCAO_DO_FILTRO, "flex-1 md:flex-none")}
    >
      {rotulo}
      <Suspense fallback={null}>
        <Quantos valor={valor} contagens={contagens} />
      </Suspense>
    </ToggleGroupItem>
  );
}

/**
 * **A mesma peça de T-08, T-09 e T-14** (`lista-de-ordem-manual.tsx:176-178`), e o número fica DENTRO do
 * nome acessível, como lá: esconder de quem usa leitor de tela um número que está na tela seria
 * negar-lhe o que todo mundo vê.
 */
function Quantos({
  valor,
  contagens,
}: {
  valor: keyof ContagensDoRecorte;
  contagens: Promise<ContagensDoRecorte>;
}) {
  return (
    <span className={CONTAGEM_DO_FILTRO}>
      {use(contagens)[valor]}
    </span>
  );
}
