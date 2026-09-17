import { LogOut, UserRound } from "lucide-react";
import Link from "next/link";

import { acaoDeSair } from "@/interface/acoes";
import { Avatar, AvatarFallback } from "@/interface/componentes/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/interface/componentes/ui/dropdown-menu";

/** As iniciais de quem está na sessão — no máximo duas, do primeiro e do último nome. */
function iniciaisDe(nome: string): string {
  const partes = nome.trim().split(/\s+/u).filter(Boolean);
  if (partes.length === 0) return "?";
  const primeira = partes[0]?.[0] ?? "";
  const ultima = partes.length > 1 ? (partes[partes.length - 1]?.[0] ?? "") : "";
  return (primeira + ultima).toUpperCase();
}

/**
 * **O menu de pessoa da barra superior.**
 *
 * **O cabeçalho diz de quem é a conta** (item 44i, prancheta *"T-16 · o caminho até ela: menu de
 * pessoa"*): o avatar, o nome e o e-mail de entrada. **Ele não é alvo**: é o rótulo do menu, que o
 * teclado não visita. Sem e-mail do provedor, mostra só o nome. O e-mail chega da resolução de contexto
 * que o layout já fez, e nenhuma projeção o publica.
 *
 * ***Meus dados* é item com ícone**, e é o caminho até T-16. Até o item 44i o item imprimia o nome, com
 * *Meus dados* embaixo; com o nome no cabeçalho, o item diz só o destino.
 *
 * Sair permanece formulário com botão de envio, e não vira link: é ação que muda estado no servidor, e o
 * critério 44b.4 a manteve de propósito na forma que já tinha. O `min-h-11` do compromisso **A-3** fica
 * nos dois itens. **Os tamanhos vêm dos papéis**: o rótulo e o item do catálogo trazem tamanho próprio, e
 * a classe daqui o sobrescreve.
 */
export function MenuDePessoa({
  nomeDaPessoa,
  emailDaPessoa,
}: {
  nomeDaPessoa: string;
  /** O e-mail de entrada; `null` quando o provedor não o devolve. */
  emailDaPessoa: string | null;
}) {
  const iniciais = iniciaisDe(nomeDaPessoa);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Conta de ${nomeDaPessoa}`}
        className="inline-flex min-h-11 items-center gap-2"
      >
        <Avatar className="size-8">
          <AvatarFallback className="text-meta">{iniciais}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-68 max-w-[calc(100vw-2rem)]">
        <DropdownMenuLabel className="text-interface flex items-center gap-3 px-2.5 pt-2 pb-2.5 font-normal">
          <Avatar className="size-8">
            <AvatarFallback className="text-meta">{iniciais}</AvatarFallback>
          </Avatar>
          <span className="flex min-w-0 flex-col">
            <span className="text-tinta truncate font-semibold">{nomeDaPessoa}</span>
            {emailDaPessoa !== null && (
              <span className="text-meta text-tinta-suave truncate">{emailDaPessoa}</span>
            )}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="text-interface min-h-11">
          <Link href="/meus-dados">
            <UserRound aria-hidden="true" />
            Meus dados
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {/* **O formulário envolve o item, e não o contrário.** O `asChild` do Radix funde as props do
            `menuitem` no filho único, e um `<form>` não é focável nem responde ao teclado do menu — quem
            precisa receber o papel é o `<button>`. Sair continua sendo botão dentro de formulário, que é
            o que o critério 4 preserva. */}
        <form action={acaoDeSair}>
          <DropdownMenuItem asChild className="text-interface min-h-11">
            <button type="submit" className="w-full text-left">
              <LogOut aria-hidden="true" />
              Sair
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
