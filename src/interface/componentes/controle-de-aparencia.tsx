import { SunMoon } from "lucide-react";

import { GrupoDeAparencia } from "@/interface/componentes/casca/itens-de-aparencia";
import { Button } from "@/interface/componentes/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/interface/componentes/ui/dropdown-menu";

/**
 * **O controle de aparência das telas de fora da casca** (item 114, critério 2).
 *
 * Quem precisa de alto contraste precisa dele **antes** de entrar, para ler o formulário de entrada e a
 * mensagem de erro. Até o item 114 as duas chaves moravam só no menu da pessoa, que só existe dentro da
 * casca. Este controle abre o mesmo `GrupoDeAparencia`, e é montado pela `MolduraDeConta` e pela
 * `EsperaDaMolduraDeConta`: com isso aparece em toda tela de fora da casca, no 404, na falha e nas esperas.
 *
 * **Ícone e palavra, e o ícone é fixo.** A palavra, porque a quem este controle serve não se pede que
 * reconheça um desenho. O ícone não diz o estado porque o gatilho é renderizado no servidor, e o estado só
 * se lê do `<html>` no cliente; quem diz o estado é o menu.
 *
 * **Montagem tardia, como no menu da pessoa.** O `GrupoDeAparencia` lê o `<html>` no inicializador do
 * estado, e só monta quando o menu abre. O gatilho não lê nada.
 *
 * **A documentação não o recebe.** Ela tem o interruptor de tema do Fumadocs, independente do produto
 * pelo item 72 (`app/documentacao/layout.tsx`). O 404, a falha e a espera da raiz aparecem também sob
 * endereço `/documentacao/...`, e lá mostram o controle: são telas do produto, e não da documentação
 * (spec 114 §3.5).
 */
export function ControleDeAparencia() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="text-interface text-tinta-suave min-h-11 gap-2 px-3 font-normal">
          <SunMoon aria-hidden="true" />
          Aparência
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-68 max-w-[calc(100vw-2rem)]">
        <GrupoDeAparencia />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
