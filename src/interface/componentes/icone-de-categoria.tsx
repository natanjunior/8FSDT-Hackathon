import {
  Accessibility,
  Bug,
  Camera,
  Car,
  Dog,
  DoorOpen,
  Droplets,
  Flame,
  Hammer,
  Key,
  Lightbulb,
  Package,
  Paintbrush,
  Shield,
  Snowflake,
  Tag,
  Thermometer,
  Trash2,
  Trees,
  Unplug,
  Volume2,
  Wifi,
  Wind,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";

import { ICONE_PADRAO } from "@/dominio/organizacao";
import { GrupoDeEscolha } from "@/interface/componentes/campo";
import { ICONES_DE_CATEGORIA, type NomeDeIcone } from "@/interface/schemas";

/**
 * **O ícone da categoria — o item 4b.**
 *
 * **Vinte e cinco importações nomeadas, nunca `import * as`.** O `lucide-react` exporta mais de mil
 * ícones; o *namespace* leva todos para o pacote entregue ao celular, e o celular em rede móvel é o
 * cenário do RNF6. O teste da esteira usa *namespace* porque roda em Node e não é empacotado.
 *
 * **O `Record<NomeDeIcone, LucideIcon>` fecha metade do critério 4b.5 em tempo de compilação:** nome novo
 * na constante sem entrada aqui **não compila**. Sobra para o teste a metade que o tipo não alcança — que
 * o nome existe mesmo no `lucide-react`.
 */
export const DESENHO_DO_ICONE: Record<NomeDeIcone, LucideIcon> = {
  lightbulb: Lightbulb,
  unplug: Unplug,
  accessibility: Accessibility,
  "trash-2": Trash2,
  droplets: Droplets,
  shield: Shield,
  wrench: Wrench,
  zap: Zap,
  flame: Flame,
  thermometer: Thermometer,
  wind: Wind,
  snowflake: Snowflake,
  "door-open": DoorOpen,
  key: Key,
  camera: Camera,
  wifi: Wifi,
  package: Package,
  car: Car,
  dog: Dog,
  bug: Bug,
  trees: Trees,
  "volume-2": Volume2,
  hammer: Hammer,
  paintbrush: Paintbrush,
  tag: Tag,
};

/**
 * O desenho, **sempre `aria-hidden`**.
 *
 * **O ícone nunca é a informação:** o compromisso A-5 e o critério 4b.4 exigem que ele apareça *ao lado do
 * nome, nunca no lugar dele* — então a palavra está sempre na tela, visível na lista e em `sr-only` na
 * célula do seletor. Um leitor de tela que anunciasse *"Etiqueta Problemas de iluminação"* leria duas
 * vezes a mesma linha, uma delas com a palavra errada.
 *
 * **`nome` é `string` e não `NomeDeIcone`, de propósito.** A projeção declara `icone: string`, porque a
 * coluna é `varchar(40)` com `CHECK` de **forma** e a lista não mora no banco: um `psql` administrativo
 * pode gravar `xyz`. **A recomendação da §14.5 é degradar para o padrão em vez de quebrar**, e é o que
 * esta linha faz.
 */
export function IconeDeCategoria({ nome, className }: { nome: string; className?: string }) {
  const Desenho = DESENHO_DO_ICONE[nome as NomeDeIcone] ?? DESENHO_DO_ICONE[ICONE_PADRAO];
  return <Desenho className={className} aria-hidden />;
}

/**
 * **A grade de 25, e ela é um grupo de `radio` de verdade.**
 *
 * **Por que `input type="radio"` e não botões com `aria-label`** (spec §2.2): o compromisso **A-1** pede
 * *rótulo associado ao controle — `htmlFor` ↔ `id`*, e `aria-label` num botão dá **nome acessível**, que é
 * outra coisa. Com `radio` de verdade, teclado (setas), agrupamento e semântica de formulário vêm do
 * navegador, em vez de serem reimplementados — que é o risco que a ADR-0007 recusou ao não construir
 * controles do zero.
 *
 * **`sr-only` no `input`, nunca `display:none`:** o segundo tira a célula da ordem de foco, e o
 * compromisso **A-2** é ordem de foco igual à de leitura.
 *
 * **O anel de foco migra para o `<label>` por `peer-focus-visible`** — é o compromisso **A-4**, *foco
 * visível não removido*, e aqui ele é o mais frágil da tela: sem esta classe, quem navega por teclado
 * atravessa 25 células sem ver onde está.
 *
 * **A medida é o compromisso A-3**, que nomeia *"opções de escolha única"*: `size-11` são 44 px, e seis
 * por linha cabem em 312 px — 6 × 44 + 5 × 8 = 304. São **cinco linhas**, a última com uma célula.
 *
 * **O A-5 não se aplica à grade** (spec §2.4): aqui o desenho **é o objeto da escolha**, como as amostras
 * num seletor de cor — não um marcador que substitui palavra. Onde o A-5 vale é na exibição, e lá a
 * palavra está sempre ao lado.
 *
 * **A moldura é o `GrupoDeEscolha` do `campo.tsx`** desde o item 44k, para o rótulo e o espaço serem os
 * mesmos dos outros campos do modal.
 *
 * **O `id` de cada rádio leva um prefixo que vem de fora**, e isto é defeito que a página própria não
 * tinha: no modal, o seletor pode existir duas vezes no mesmo documento — o gatilho de criar no cabeçalho
 * e o de editar numa linha —, e `id` duplicado faria o clique no rótulo marcar o rádio da outra cópia.
 */
export function SeletorDeIcone({
  prefixo,
  valor,
  inerte = false,
  aoEscolher,
}: {
  /** O `useId` de quem monta o seletor: é ele que torna os 25 `id` únicos no documento. */
  prefixo: string;
  valor: NomeDeIcone;
  inerte?: boolean;
  aoEscolher: (nome: NomeDeIcone) => void;
}) {
  const escolhido = ICONES_DE_CATEGORIA.find((icone) => icone.nome === valor);

  return (
    <GrupoDeEscolha id={`${prefixo}-icone`} legenda="Ícone">
      <div className="grid w-fit grid-cols-6 gap-2">
        {ICONES_DE_CATEGORIA.map((icone) => (
          <div key={icone.nome} className="contents">
            <input
              id={`${prefixo}-icone-${icone.nome}`}
              type="radio"
              name={`${prefixo}-icone`}
              value={icone.nome}
              checked={valor === icone.nome}
              disabled={inerte}
              className="peer sr-only"
              onChange={() => {
                aoEscolher(icone.nome);
              }}
            />
            <label
              htmlFor={`${prefixo}-icone-${icone.nome}`}
              className="border-linha text-tinta-suave peer-checked:border-marca peer-checked:bg-accent peer-checked:text-tinta peer-focus-visible:ring-marca flex size-11 cursor-pointer items-center justify-center rounded-md border peer-focus-visible:ring-2"
            >
              <IconeDeCategoria nome={icone.nome} className="size-5" />
              <span className="sr-only">{icone.rotulo}</span>
            </label>
          </div>
        ))}
      </div>

      {/* A palavra do escolhido, **visível** — é o que faz a escolha ser legível sem passar o mouse
          célula a célula, e A-6 proíbe que isso viva num tooltip.

          **Sem texto de reserva escrito à mão:** `valor` é `NomeDeIcone`, então o `find` acha sempre, e
          repetir *"Etiqueta"* aqui criaria uma segunda fonte para um rótulo que já mora na constante. */}
      {escolhido !== undefined && (
        <p className="text-tinta-suave text-meta">
          Escolhido: <strong className="text-tinta font-medium">{escolhido.rotulo}</strong>. O ícone fica
          ao lado do nome, nunca no lugar dele.
        </p>
      )}
    </GrupoDeEscolha>
  );
}
