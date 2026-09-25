"use client";

import Link from "next/link";
import { BookOpen, ExternalLink, GraduationCap, type LucideIcon } from "lucide-react";

import {
  SidebarFooter,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "@/interface/componentes/ui/sidebar";

/**
 * **O pé da barra lateral — item 76, critério 2.**
 *
 * **Documentação e Grupo 1 são páginas sobre o projeto**, e nenhuma das duas é da organização nem da
 * pessoa. Até o item 76 elas moravam no marco *Além desta organização*, junto de *Meus dados*; agora têm
 * marco próprio, no `SidebarFooter`, que é a peça do catálogo para o que fica no fim da coluna.
 *
 * **Componente próprio, e não parte da `Navegacao`**: o pé não depende de papel nem de contagem, então
 * não passa pelo `Suspense` que a navegação atravessa. Ele precisa do `useSidebar` para fechar a gaveta no
 * toque, e por isso é de cliente.
 *
 * **Componente de cliente.**
 */
export function PeDaBarra() {
  const { setOpenMobile } = useSidebar();
  const aoTocar = () => setOpenMobile(false);

  return (
    <SidebarFooter className="gap-0 px-2 pt-0 pb-4">
      <SidebarSeparator className="mx-2 mb-3" />
      <nav aria-label="Sobre o projeto" className="flex flex-col">
        <SidebarMenu>
          <ItemExterno endereco="/documentacao" rotulo="Documentação" Icone={BookOpen} aoTocar={aoTocar} />
          <ItemExterno endereco="/grupo" rotulo="Grupo 1" Icone={GraduationCap} aoTocar={aoTocar} />
        </SidebarMenu>
      </nav>
    </SidebarFooter>
  );
}

/**
 * **Um item que sai da casca — item 70.** A página do grupo e a documentação são públicas e abrem em nova
 * aba, então o item nunca é o lugar atual: não recebe `DestinoDaBarra`, não marca e não tem
 * `aria-current`. **A prop é `endereco`, e não `destino`**, porque a guarda do 44h conta todo `destino=`
 * da navegação como destino da barra.
 *
 * **As mesmas classes de altura e movimento do `ItemDeNavegacao`**, e o mesmo `aoTocar`: no celular, tocar
 * num item fecha a gaveta, e isso vale também para o que abre outra aba.
 *
 * **`size-3.5!` no ícone de saída**: o `cva` do `SidebarMenuButton` traz `[&>svg]:size-4`, que ganharia de
 * uma classe simples, e o design pede 14 px.
 *
 * **`min-w-0` no `<Link>`** (critério 76.1): ele é o filho flexível do `SidebarMenuButton`, e sem isso o
 * rótulo não encolhe abaixo da própria largura, e o corpo da barra ganha rolagem horizontal.
 */
function ItemExterno({
  endereco,
  rotulo,
  Icone,
  aoTocar,
}: {
  endereco: "/grupo" | "/documentacao";
  rotulo: string;
  Icone: LucideIcon;
  aoTocar: () => void;
}) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        className="text-interface/[17px] h-auto min-h-11 transition-[background-color,color,transform] duration-(--tempo-ponteiro) ease-(--curva-ponteiro) active:scale-[0.97]"
      >
        <Link href={endereco} target="_blank" rel="noreferrer" onClick={aoTocar} className="min-w-0">
          <Icone aria-hidden="true" className="text-tinta-suave" />
          <span className="min-w-0 flex-1 truncate">{rotulo}</span>
          <span className="sr-only">, abre em nova aba</span>
          <ExternalLink aria-hidden="true" className="text-tinta-suave size-3.5!" />
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
