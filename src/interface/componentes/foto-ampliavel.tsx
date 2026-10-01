"use client";

import { Maximize2 } from "lucide-react";

import { Button } from "@/interface/componentes/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/interface/componentes/ui/dialog";

/**
 * **A foto de T-05, que abre em diálogo e não em aba nova** (item 66, critério 2).
 *
 * **As duas imagens continuam `div` com `background-image`**, e não por gosto: a tag de imagem gastaria o
 * primeiro `eslint-disable` do repositório (`@next/next/no-img-element`), e `next/image` faria os bytes do anexo
 * atravessarem o contêiner, que o contrato proíbe. Na miniatura é `bg-cover`; no diálogo, `bg-contain` sobre
 * o chão da página, que é o `object-contain` do design sem a tag.
 *
 * **Esc, clique fora e o foco de volta ao gatilho são do `Dialog` do `radix-ui`**: nada aqui os reescreve.
 * O fechar que o catálogo desenha tem 16 px; a regra `[&>button:last-child]` o leva a 44 px (compromisso
 * A-3) sem editar a peça.
 *
 * **A etiqueta *Ampliar* é persistente**, e não vive na passagem do ponteiro: no toque não há ponteiro, e
 * sem ela não haveria pista de que a foto abre.
 *
 * **O gatilho é o `Button` do catálogo em `ghost`, desfeito até virar moldura** (G7 do guia: nenhum
 * controle cru fora de `ui/`). Sai o fundo da passagem e o encolher do toque, que numa foto de 224 px de
 * altura seriam ruído.
 */
export function FotoAmpliavel({
  url,
  miniaturaUrl,
  titulo,
  nomeArquivo,
}: {
  url: string;
  miniaturaUrl: string | null;
  titulo: string | null;
  nomeArquivo: string | null;
}) {
  const nome = titulo ?? "Foto anexada à ocorrência";

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className="relative mt-1 block h-auto w-full rounded-lg p-0 text-left font-normal whitespace-normal hover:bg-transparent active:scale-100"
        >
          {/* `span` com `block`, e não `div`: dentro de botão só cabe conteúdo de frase. */}
          <span
            role="img"
            aria-label={nome}
            className="bg-superficie border-linha block h-56 w-full rounded-lg border bg-cover bg-center bg-no-repeat"
            // **Uma camada, e é a miniatura** (critério 106.2). Duas camadas faziam o navegador baixar o
            // original e a miniatura, e a de cima cobria a de baixo. Sem miniatura, cai no original; o
            // diálogo abaixo continua com o original. Sem elemento de imagem: seria o primeiro `eslint-disable`.
            style={{ backgroundImage: `url(${miniaturaUrl ?? url})` }}
          />
          <span className="bg-superficie text-tinta border-linha text-meta absolute right-3 bottom-3 inline-flex min-h-11 items-center gap-1.5 rounded-sm border px-3 font-medium">
            <Maximize2 aria-hidden="true" strokeWidth={1.9} className="size-[15px]" />
            Ampliar
          </span>
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-superficie border-linha gap-0 p-0 md:max-w-3xl [&>button:last-child]:top-1.5 [&>button:last-child]:right-1.5 [&>button:last-child]:grid [&>button:last-child]:size-11 [&>button:last-child]:place-items-center">
        <div className="border-linha-suave flex min-h-14 items-center border-b px-4 pr-14">
          <DialogTitle className="text-meta text-tinta-suave truncate">
            {nomeArquivo ?? nome}
          </DialogTitle>
          <DialogDescription className="sr-only">{nome}</DialogDescription>
        </div>
        <div
          role="img"
          aria-label={nome}
          className="bg-background h-[min(75dvh,720px)] w-full rounded-b-lg bg-contain bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${url})` }}
        />
      </DialogContent>
    </Dialog>
  );
}
