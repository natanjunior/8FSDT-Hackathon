"use client";

import { XIcon } from "lucide-react";
import type { FormEvent, ReactNode } from "react";

import { IndicadorDeEnvio, RodapeDoFormulario } from "@/interface/componentes/campo";
import { Button } from "@/interface/componentes/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/interface/componentes/ui/dialog";
import { SheetContent } from "@/interface/componentes/ui/sheet";
import { cn } from "@/interface/componentes/utilitarios";
import { useIsMobile } from "@/interface/ganchos/use-mobile";

/**
 * ============================================================================
 *  O modal da família Organização — o cartão mostra, o modal edita (item 44i)
 * ============================================================================
 *
 * **O guia (§7, *Onde se mostra e onde se edita*) nomeia duas peças do catálogo**, e este componente é as
 * duas:
 *
 * | Largura | Peça |
 * |---|---|
 * | a partir de 768 px | `DialogContent`, centrado |
 * | abaixo de 768 px | `SheetContent` com `side="bottom"` |
 *
 * **Uma raiz só.** `Sheet` e `Dialog` são o mesmo primitivo do `radix-ui`, então o modal monta uma raiz
 * e troca só o conteúdo; título, descrição e fechar são as peças `Dialog*` nas duas larguras. **Quem
 * guarda o valor digitado é quem usa o modal**, e não o conteúdo: girar o aparelho com o modal aberto
 * troca a peça sem perder o texto.
 *
 * **A largura vem de `useIsMobile`**, o gancho com que a barra lateral escolhe entre barra e gaveta, e o
 * limiar é o mesmo `md` do `dialog.tsx`. O primeiro valor do gancho é `false` e nunca desenha nada: o
 * modal só abre por clique, depois da hidratação.
 *
 * **T-05 usa este componente desde 21/09/2026** (item 44p, critério 16). Os cinco modais dela montavam o
 * `Dialog` direto, com rodapé sem faixa e um confirmar azul ao lado de ações laranja na mesma tela. O
 * pedido do dono de 16/09 — que o comportamento do 44g valesse para as telas já construídas — não os
 * tinha alcançado.
 *
 * **O modal não sabe enviar.** Quem o usa liga `useEnvioDoModal` e passa `aberto`, `aoMudarAbertura` e
 * `enviando`; durante o envio o ciclo recusa o fechamento, e o modal só desabilita o fechar que ele mesmo
 * desenha. **O formulário envolve corpo e rodapé**: `Enter` no campo envia, e o principal é o botão de
 * envio do formulário.
 *
 * **A forma, pelas pranchetas *"T-15 · editar organização (Dialog)"* e *"T-16 · editar nome (Sheet, de
 * baixo)"*:** fundo de superfície; título no papel de bloco e descrição no de interface; no `dialog`, o
 * rodapé numa faixa com o chão da página e régua em cima; no `sheet`, os cantos de cima arredondados, o
 * rodapé sem faixa, e o fechar com 44 px (compromisso A-3). A gaveta usa o tempo e a curva do guia §6
 * pelos tokens `--tempo-gaveta` e `--curva-gaveta`, na forma com parênteses que o Tailwind emite com
 * `var()`; o `sheet.tsx` não muda o próprio padrão, porque a gaveta da barra lateral também o usa.
 *
 * **Só o corpo rola** (item 68a): o conteúdo é coluna com o teto de altura, e título e rodapé ficam fora da
 * rolagem. Sem `scroll-area` e sem teto próprio no corpo — com o teto no conteúdo, um segundo só desperdiça
 * altura em tela alta. Vale para os nove modais da família, e é o conserto que o item 66 pede no de atribuir.
 */

/** As duas classes de conteúdo, exportadas para o `ModalDeDados` de T-07 vestir a mesma forma. */
export const CONTEUDO_DO_DIALOG = "bg-superficie border-linha flex max-h-[85dvh] flex-col gap-0 overflow-hidden p-0";

export const CONTEUDO_DO_SHEET =
  "bg-superficie border-linha flex max-h-[90dvh] flex-col gap-0 overflow-hidden rounded-t-xl ease-(--curva-gaveta) data-[state=closed]:duration-(--tempo-gaveta) data-[state=open]:duration-(--tempo-gaveta)";

/** O rodapé na tela grande. Exportado para o portão de estilo, que mede esta cadeia (item 44q). */
export const RODAPE_DO_MODAL = "border-linha-suave bg-background border-t px-6 py-3.5";

export function Modal({
  aberto,
  aoMudarAbertura,
  enviando,
  gatilho,
  titulo,
  descricao,
  obrigatorios,
  todosObrigatorios = false,
  aoEnviar,
  aoFecharFoco,
  rodape,
  children,
}: {
  aberto: boolean;
  aoMudarAbertura: (proximo: boolean) => void;
  enviando: boolean;
  /** O botão que abre o modal. Recebe as propriedades do gatilho por `asChild`. */
  gatilho: ReactNode;
  titulo: string;
  descricao: string;
  /** Quantos campos obrigatórios o corpo tem; com zero, o rodapé não escreve a nota. */
  obrigatorios: number;
  /**
   * **Quando todo campo do corpo é obrigatório, a nota sai e o asterisco fica** (guia §7). Atravessa até
   * `RodapeDoFormulario`, que é quem decide — três dos seis formulários do critério 44p.11 só a alcançam
   * por aqui, e depois do critério 44p.16 os cinco modais de T-05 também.
   */
  todosObrigatorios?: boolean;
  aoEnviar: (evento: FormEvent<HTMLFormElement>) => void;
  /**
   * Opcional: para onde o foco vai quando o modal fecha (item 44j). Sem ela, o foco volta ao gatilho —
   * que é o certo, menos quando a linha do gatilho sai da tabela com a escrita que acabou de acontecer.
   */
  aoFecharFoco?: (evento: Event) => void;
  /** Os botões do rodapé, na ordem de leitura: `BotaoDeCancelar` e `BotaoDeConfirmar`. */
  rodape: ReactNode;
  children: ReactNode;
}) {
  const celular = useIsMobile();

  const formulario = (
    <form noValidate onSubmit={aoEnviar} className="flex min-h-0 flex-1 flex-col">
      <div className={cn("shrink-0", celular ? "px-4 pt-5 pr-14" : "px-6 pt-5.5 pr-14")}>
        <DialogTitle className="text-titulo-bloco text-tinta">{titulo}</DialogTitle>
        <DialogDescription className="text-interface text-tinta-suave mt-1.5">{descricao}</DialogDescription>
      </div>
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col gap-4.5 overflow-y-auto",
          celular ? "px-4 pt-4 pb-1.5" : "px-6 py-5",
        )}
      >
        {children}
      </div>
      <div className={cn("shrink-0", celular ? "px-4 pt-3 pb-5" : RODAPE_DO_MODAL)}>
        <RodapeDoFormulario obrigatorios={obrigatorios} todosObrigatorios={todosObrigatorios}>
          {rodape}
        </RodapeDoFormulario>
      </div>
    </form>
  );

  return (
    <Dialog open={aberto} onOpenChange={aoMudarAbertura}>
      <DialogTrigger asChild>{gatilho}</DialogTrigger>
      {celular ? (
        <SheetContent side="bottom" showCloseButton={false} onCloseAutoFocus={aoFecharFoco} className={CONTEUDO_DO_SHEET}>
          {formulario}
          <DialogClose asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={enviando}
              className="text-tinta-suave absolute top-2 right-2"
            >
              <XIcon aria-hidden="true" className="size-4.5" />
              <span className="sr-only">Fechar</span>
            </Button>
          </DialogClose>
        </SheetContent>
      ) : (
        <DialogContent onCloseAutoFocus={aoFecharFoco} className={CONTEUDO_DO_DIALOG}>{formulario}</DialogContent>
      )}
    </Dialog>
  );
}

/** O secundário do rodapé: fecha sem salvar, e fica inerte durante o envio. */
export function BotaoDeCancelar({ enviando }: { enviando: boolean }) {
  return (
    <DialogClose asChild>
      <Button
        type="button"
        variant="outline"
        disabled={enviando}
        className="border-linha text-interface min-h-11 rounded-sm px-4"
      >
        Cancelar
      </Button>
    </DialogClose>
  );
}

/**
 * O principal do rodapé, na cor da marca (guia §2: com o modal aberto, é a ação principal da tela).
 * **Nunca desabilitado por campo inválido** (guia §7): só fica inerte durante o envio, com o indicador e
 * o verbo no gerúndio. **A variante destrutiva** é a do guia para ação que recusa ou desativa, e chegou
 * com *Recusar pedido* (item 44j).
 */
export function BotaoDeConfirmar({
  enviando,
  rotulo,
  rotuloEnviando,
  variante = "marca",
}: {
  enviando: boolean;
  rotulo: string;
  rotuloEnviando: string;
  variante?: "marca" | "destrutiva";
}) {
  return (
    <Button
      type="submit"
      variant={variante === "destrutiva" ? "destructive" : "marca"}
      disabled={enviando}
      className="text-interface min-h-11 rounded-sm px-4 font-semibold"
    >
      <IndicadorDeEnvio ativo={enviando} />
      {enviando ? rotuloEnviando : rotulo}
    </Button>
  );
}
