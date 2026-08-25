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
import { type NomeDeIcone } from "@/interface/schemas";

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
