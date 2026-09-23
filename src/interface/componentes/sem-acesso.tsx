import Link from "next/link";
import { ArrowLeft, LockKeyhole } from "lucide-react";

import {
  QUEM_USA_A_TELA,
  RECUSA_DE_ACESSO,
  SAIDA_DO_SEM_ACESSO,
  type PermissaoDeTela,
} from "@/interface/componentes/rotulos";
import { buttonVariants } from "@/interface/componentes/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/interface/componentes/ui/empty";
import { cn } from "@/interface/componentes/utilitarios";

/**
 * ============================================================================
 *  O estado sem acesso — item 44h, critérios 3 e 4
 * ============================================================================
 *
 * **Quem abre por link uma tela que o papel dele não alcança encontra sempre esta forma**, e ela era onze
 * cópias até o item 44h. A página devolve este componente no ramo `sem-permissao` e nada em volta dele: a
 * casca já desenha a moldura.
 *
 * ```tsx
 * if (escopo.situacao === "sem-permissao") {
 *   return <SemAcesso titulo="Categorias" permissao="organizacao.configurar" />;
 * }
 * ```
 *
 * **O contrato, que o 44i, o 44j e o 44k importam:** `titulo` é o `<h1>` da face normal da página, e
 * muda junto com ele; `permissao` é a que a página exige e faltou, e escolhe a frase de quem usa a tela.
 * Nenhuma outra propriedade.
 *
 * **De cima para baixo, pela prancheta:** o título no papel de página, e um cartão com o vazio do
 * catálogo: o cadeado num ladrilho, a frase de quem usa a tela, a recusa, e a saída para T-03. **É beco**,
 * porque a barra lateral de quem chega aqui não tem o item desta tela, e é por isso que ele tem saída no
 * conteúdo.
 *
 * **O que não entra:** região viva (o estado é o conteúdo desde a primeira pintura, e região viva que
 * nunca se atualiza é ruído para quem usa leitor de tela, o mesmo argumento do critério 44c.9); linha sob
 * o título (ela repetiria a frase do cartão); o nome da organização, que a barra superior já mostra.
 *
 * **Componente de servidor.** Não tem estado e não lê nada do navegador.
 */
export function SemAcesso({ titulo, permissao }: { titulo: string; permissao: PermissaoDeTela }) {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-titulo-pagina text-tinta">{titulo}</h1>

      <div className="border-linha bg-superficie rounded-lg border shadow-sm">
        <Empty className="px-6 py-14 md:px-6 md:py-14">
          <EmptyHeader>
            <EmptyMedia
              variant="icon"
              className="border-linha bg-background text-tinta-suave mb-3 size-13 rounded-lg border"
            >
              <LockKeyhole aria-hidden="true" className="size-5.5" />
            </EmptyMedia>
            <EmptyTitle className="text-titulo-bloco text-tinta">
              {QUEM_USA_A_TELA[permissao]}
            </EmptyTitle>
            <EmptyDescription className="text-corpo text-tinta-suave">{RECUSA_DE_ACESSO}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Link
              href="/ocorrencias"
              className={cn(
                buttonVariants({ variant: "outline" }),
                "border-linha text-tinta text-interface min-h-11 rounded-sm px-4 has-[>svg]:px-4",
              )}
            >
              <ArrowLeft aria-hidden="true" />
              {SAIDA_DO_SEM_ACESSO}
            </Link>
          </EmptyContent>
        </Empty>
      </div>
    </div>
  );
}
