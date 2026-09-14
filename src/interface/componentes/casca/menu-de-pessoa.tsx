import { acaoDeSair } from "@/interface/acoes";
import { Avatar, AvatarFallback } from "@/interface/componentes/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
 * Sair permanece `<form>` com `<button>`, e não vira link: é ação que muda estado no servidor, e o
 * critério 44b.4 a manteve de propósito na forma que já tinha.
 */
export function MenuDePessoa({ nomeDaPessoa }: { nomeDaPessoa: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Conta de ${nomeDaPessoa}`}
        className="inline-flex min-h-11 items-center gap-2"
      >
        <Avatar className="size-8">
          <AvatarFallback className="text-meta">{iniciaisDe(nomeDaPessoa)}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        <DropdownMenuItem disabled className="flex-col items-start gap-0">
          <span className="text-tinta font-medium">{nomeDaPessoa}</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {/* **O formulário envolve o item, e não o contrário.** O `asChild` do Radix funde as props do
            `menuitem` no filho único, e um `<form>` não é focável nem responde ao teclado do menu — quem
            precisa receber o papel é o `<button>`. Sair continua sendo botão dentro de formulário, que é
            o que o critério 4 preserva. */}
        <form action={acaoDeSair}>
          <DropdownMenuItem asChild className="min-h-11">
            <button type="submit" className="w-full text-left">
              Sair
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
