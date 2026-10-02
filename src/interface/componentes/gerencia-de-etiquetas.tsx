"use client";

import { Tags, Trash2 } from "lucide-react";

import { cabecalhosDeEscrita } from "@/interface/componentes/afirmacao-de-organizacao";
import { BotaoDeIcone } from "@/interface/componentes/botao-de-icone";
import { ErroDoFormulario, IndicadorDeEnvio } from "@/interface/componentes/campo";
import {
  textoDoApagar,
  tituloDoApagar,
  type EtiquetaNaTela,
} from "@/interface/componentes/etiquetas-de-participante";
import { mensagemDoProblema } from "@/interface/componentes/retorno-de-acao";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/interface/componentes/ui/alert-dialog";
import { Button, buttonVariants } from "@/interface/componentes/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/interface/componentes/ui/sheet";
import { cn } from "@/interface/componentes/utilitarios";
import { useEnvioDoModal, type DesfechoDoEnvio } from "@/interface/ganchos/use-envio-do-modal";

/**
 * ============================================================================
 *  T-08 · a gerência das etiquetas (item 115)
 * ============================================================================
 *
 * **Um painel aberto da própria tela de participantes, e não uma rota**: a gerência mora sob a mesma
 * permissão de quem atribui (`vinculo.gerir`), e um painel não acrescenta tela à lista de `docs/telas.md`.
 * **É o painel do item 87, e não o `Modal`**: o `Modal` é de formulário, e aqui nada se envia.
 *
 * **Só apagar.** Renomear, fundir e contagem na lista ficaram fora (decisão 8 do dono). O número aparece
 * na confirmação, e só nela.
 */
/** As classes da confirmação de remover (`remocao-de-vinculo.tsx`), para apagar ter a mesma cara. */
const CONTEUDO = "bg-superficie border-linha";
const TITULO = "text-titulo-bloco text-tinta";
const DESCRICAO = "text-corpo text-tinta-suave";
const BOTAO = "text-interface min-h-11 rounded-sm px-4";

export function GerenciaDeEtiquetas({
  etiquetas,
  uso,
  organizacaoId,
}: {
  etiquetas: readonly EtiquetaNaTela[];
  /** Por `id`, quantas pessoas a têm. **Ausente é zero.** */
  uso: Readonly<Record<string, number>>;
  organizacaoId: string;
}) {
  return (
    <Sheet>
      <SheetTrigger className={cn(buttonVariants({ variant: "outline" }), "text-interface min-h-11 rounded-sm px-4")}>
        <Tags aria-hidden="true" />
        Etiquetas
      </SheetTrigger>
      <SheetContent side="right" className="w-full max-w-none gap-0 sm:max-w-none md:max-w-md">
        <SheetHeader className="pr-14">
          <SheetTitle>Etiquetas</SheetTitle>
          <SheetDescription>Uma etiqueta nasce no detalhe de um participante. Aqui ela pode ser apagada.</SheetDescription>
        </SheetHeader>
        <ul className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4">
          {etiquetas.map((etiqueta) => (
            <li key={etiqueta.id} className="border-linha-suave flex items-center justify-between gap-3 border-b py-1">
              <span className="text-tinta text-interface min-w-0 truncate">{etiqueta.nome}</span>
              <ApagarEtiqueta etiqueta={etiqueta} quantas={uso[etiqueta.id] ?? 0} organizacaoId={organizacaoId} />
            </li>
          ))}
        </ul>
      </SheetContent>
    </Sheet>
  );
}

function ApagarEtiqueta({
  etiqueta,
  quantas,
  organizacaoId,
}: {
  etiqueta: EtiquetaNaTela;
  quantas: number;
  organizacaoId: string;
}) {
  const envio = useEnvioDoModal({
    enviar: async (): Promise<DesfechoDoEnvio<undefined>> => {
      const resposta = await fetch(`/api/etiquetas-de-participante/${etiqueta.id}`, {
        method: "DELETE",
        headers: cabecalhosDeEscrita(organizacaoId),
      });
      if (resposta.ok) return { ok: true };
      return { ok: false, aviso: mensagemDoProblema(await resposta.json().catch(() => null)) };
    },
    aoConcluir: () => ({ titulo: `${etiqueta.nome} apagada` }),
    tituloDaFalha: "Não foi possível apagar a etiqueta.",
  });

  return (
    <AlertDialog open={envio.aberto} onOpenChange={envio.mudarAbertura}>
      <AlertDialogTrigger asChild>
        <BotaoDeIcone
          rotulo={`Apagar ${etiqueta.nome}`}
          icone={<Trash2 aria-hidden="true" className="size-4" />}
          className="size-11 shrink-0"
        />
      </AlertDialogTrigger>
      <AlertDialogContent className={CONTEUDO}>
        <AlertDialogHeader>
          <AlertDialogTitle className={TITULO}>{tituloDoApagar(etiqueta.nome)}</AlertDialogTitle>
          <AlertDialogDescription className={DESCRICAO}>{textoDoApagar(quantas)}</AlertDialogDescription>
        </AlertDialogHeader>
        {envio.aviso !== null && <ErroDoFormulario>{envio.aviso}</ErroDoFormulario>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={envio.enviando} className={`border-linha ${BOTAO}`}>
            Cancelar
          </AlertDialogCancel>
          <Button
            type="button"
            variant="destructive"
            disabled={envio.enviando}
            onClick={() => void envio.confirmar()}
            className={`${BOTAO} font-semibold`}
          >
            <IndicadorDeEnvio ativo={envio.enviando} />
            {envio.enviando ? "Apagando…" : "Apagar etiqueta"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
