"use client";

import { Suspense, use } from "react";

import type { VisibilidadeAplicada } from "@/aplicacao/ocorrencia";
import { Badge } from "@/interface/componentes/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/interface/componentes/ui/toggle-group";
import { cn } from "@/interface/componentes/utilitarios";

import {
  CAIXA_DO_FILTRO,
  CONTAGEM_DE_NAO_VISTAS,
  CONTAGEM_DO_FILTRO,
  OPCAO_DO_FILTRO,
} from "./filtro-rapido";
import { useNavegacaoDaLista } from "./navegacao-da-lista";
import {
  consultaDoRecorte,
  valorDoRecorte,
  type ContagensDoRecorte,
  type FormaDoNumero,
  type OpcaoDoRecorte,
} from "./opcoes-do-recorte";
import { palavraDeNaoVistas } from "./rotulos";

/**
 * ============================================================================
 *  O recorte de T-03 — escolha única, e as palavras do critério 14.3
 * ============================================================================
 *
 * **Quem decide as opções é a página**, que passa `opcoes`: aqui não há checagem de permissão nenhuma.
 *
 * **Desde o item 87, quem não tem `ler_todas` também recebe o controle**, com *Minhas ocorrências* e
 * *Compartilhadas comigo*: há duas opções, então há o que escolher, e o critério **44c.9** deixa de valer
 * para ele. Ele valia porque um controle de uma opção só seria um alvo de 44 px que não faz nada — e essa
 * razão é a que mudou, não a regra.
 *
 * **É o mesmo componente para as duas versões, e não um segundo.** Tudo o que ele carrega vale para as
 * duas: o `role="radiogroup"` do 44c.8, o fundo que não se confunde com a ação principal, o descarte da
 * paginação e o alvo de 44 px. Um segundo componente seria a cópia que diverge.
 *
 * **`type="single"` é o que produz `role="radiogroup"` e `role="radio"`**, e é disso que o critério
 * 44c.8 depende. Escolha única também é a verdade do recorte: as opções não coexistem.
 *
 * **A marcação não vive só na cor.** O `toggleVariants` do catálogo pinta o estado ligado com
 * `data-[state=on]:bg-accent`, que resolve para `--accent-bg` — **o mesmo fundo da ação principal da
 * tela**, que aqui é *Registrar ocorrência*, a dois centímetros dali na mesma linha. Duas coisas com o
 * mesmo fundo na mesma linha, uma delas botão e a outra não, é o que o ground sobrescrito evita: fundo de
 * superfície, texto de tinta, peso e sombra. A palavra continua sendo o sinal, e é o compromisso **A-5**.
 *
 * **Trocar de recorte descarta a paginação.** Conjunto novo, corte novo — é `consultaDoRecorte`.
 *
 * **As contagens chegam como PROMESSA, e não como número** (item 44p, critério 10). A página monta este
 * cabeçalho **fora** da fronteira de espera — é o que faz o título pintar antes da lista, e está escrito
 * lá em `app/(casca)/ocorrencias/page.tsx` desde o item 14b. Esperar os números aqui faria a tela inteira
 * esperar pela consulta, desfazendo aquela decisão; então o rótulo e o alvo de 44 px aparecem na hora, e
 * **só o número** fica sob um `Suspense` próprio, que chega junto com a lista. **As opções sem número não
 * esperam nada**, e é o que faz o cabeçalho de quem não tem `ler_todas` pintar inteiro na hora.
 *
 * **O vazio da espera é vazio mesmo**, e não um traço nem um esqueleto: um placeholder que vira número
 * meio segundo depois é duas informações onde havia uma.
 *
 * **Desde o item 88 a opção *Compartilhadas comigo* leva o número do que ainda não foi visto, numa pílula
 * da marca** — forma diferente porque o significado é diferente.
 */
export function SeletorDeRecorte({
  consultaAtual,
  visibilidadeAplicada,
  contagens,
  opcoes,
  podeLerTodas,
}: {
  /** A *query string* atual, crua, como a página a recebeu. */
  consultaAtual: string;
  visibilidadeAplicada: VisibilidadeAplicada;
  /** Os dois números do painel, medidos pela mesma regra — guia §8, item 44p. */
  contagens: Promise<ContagensDoRecorte>;
  /** O conjunto de opções, decidido pela página com `opcoesDoRecorte`. */
  opcoes: readonly OpcaoDoRecorte[];
  /** Muda o que *Minhas* escreve na URL — ver `consultaDoRecorte`. */
  podeLerTodas: boolean;
}) {
  const { navegar } = useNavegacaoDaLista();

  function aoTrocar(valor: string): void {
    // O Radix devolve `""` quando se toca na opção já marcada. Escolha única não se desmarca.
    if (valor === "") return;

    navegar(consultaDoRecorte(consultaAtual, valor as OpcaoDoRecorte["valor"], podeLerTodas));
  }

  return (
    <ToggleGroup
      type="single"
      value={valorDoRecorte(visibilidadeAplicada)}
      onValueChange={aoTrocar}
      aria-label="Recorte da lista"
      spacing={1}
      className={cn(CAIXA_DO_FILTRO, "md:w-auto")}
    >
      {opcoes.map((opcao) => (
        <Item key={opcao.valor} opcao={opcao} contagens={contagens} />
      ))}
    </ToggleGroup>
  );
}

export type { ContagensDoRecorte };

function Item({
  opcao,
  contagens,
}: {
  opcao: OpcaoDoRecorte;
  contagens: Promise<ContagensDoRecorte>;
}) {
  return (
    <ToggleGroupItem value={opcao.valor} className={cn(OPCAO_DO_FILTRO, "flex-1 md:flex-none")}>
      {opcao.rotulo}
      {opcao.contagem !== null && (
        <Suspense fallback={null}>
          <Quantos
            campo={opcao.contagem.campo}
            forma={opcao.contagem.forma}
            contagens={contagens}
          />
        </Suspense>
      )}
    </ToggleGroupItem>
  );
}

/**
 * **A mesma peça de T-08, T-09 e T-14** (`lista-de-ordem-manual.tsx:176-178`), e o número fica DENTRO do
 * nome acessível, como lá: esconder de quem usa leitor de tela um número que está na tela seria
 * negar-lhe o que todo mundo vê.
 *
 * **Duas formas, e a diferença é de significado** (item 88). `"total"` conta um conjunto que a pessoa pode
 * escolher ver, e `0` ali é informação: *Todas 0* diz que não há nenhuma. `"nao-vistas"` conta uma
 * pendência, e pendência zero **não é um número, é ausência** — uma pílula com `0` pediria leitura para
 * dizer que não há o que ler.
 *
 * **A palavra vai para o leitor de tela, e o número para os dois.** Sem ela, *"Compartilhadas comigo 3"* se
 * ouve como *"3 compartilhadas"*.
 */
function Quantos({
  campo,
  forma,
  contagens,
}: {
  campo: keyof ContagensDoRecorte;
  forma: FormaDoNumero;
  contagens: Promise<ContagensDoRecorte>;
}) {
  const quantas = use(contagens)[campo];

  if (forma === "total") {
    return <span className={CONTAGEM_DO_FILTRO}>{quantas}</span>;
  }
  if (quantas === 0) return null;

  return (
    <Badge className={CONTAGEM_DE_NAO_VISTAS}>
      <span className="sr-only">, </span>
      {quantas}
      <span className="sr-only"> {palavraDeNaoVistas(quantas)}</span>
    </Badge>
  );
}
