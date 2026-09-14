"use client";

import type { VisibilidadeAplicada } from "@/aplicacao/ocorrencia";
import { ToggleGroup, ToggleGroupItem } from "@/interface/componentes/ui/toggle-group";

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
 */
export function SeletorDeRecorte({
  consultaAtual,
  visibilidadeAplicada,
}: {
  /** A *query string* atual, crua, como a página a recebeu. */
  consultaAtual: string;
  visibilidadeAplicada: VisibilidadeAplicada;
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
      className="bg-muted w-full rounded-sm p-1 md:w-auto"
    >
      <Item valor="todas" rotulo={RECORTE_TODAS} />
      <Item valor="minhas" rotulo={RECORTE_MINHAS} />
    </ToggleGroup>
  );
}

function Item({ valor, rotulo }: { valor: string; rotulo: string }) {
  return (
    <ToggleGroupItem
      value={valor}
      className={[
        "text-interface text-tinta-suave min-h-11 flex-1 rounded-sm px-3 font-normal md:flex-none",
        "data-[state=on]:bg-superficie data-[state=on]:text-tinta data-[state=on]:font-semibold",
        "data-[state=on]:shadow-sm",
      ].join(" ")}
    >
      {rotulo}
    </ToggleGroupItem>
  );
}
