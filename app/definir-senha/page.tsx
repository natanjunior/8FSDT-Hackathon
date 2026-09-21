import { Link2Off } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { FormularioDeNovaSenha } from "@/interface/componentes/formulario-de-nova-senha";
import { MolduraDeConta } from "@/interface/componentes/moldura-de-conta";
import { buttonVariants } from "@/interface/componentes/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/interface/componentes/ui/empty";
import { armazenamentoDeRedefinicao } from "@/interface/http";

/**
 * **T-13 · Definir nova senha** — a única tela do produto alcançada **só de fora**, por um e-mail lido
 * quando é lido, possivelmente dias depois e em outro aparelho.
 *
 * **Três desfechos, e a separação entre eles é o que faz os critérios 3 e 4 conviverem:**
 *
 * | Situação | O que acontece |
 * |---|---|
 * | `?estado=expirado` | *"Este link expirou. Peça um novo."*, com os dois caminhos de saída — critério 3 |
 * | recuperação em curso | o formulário |
 * | nada disso | **volta a T-01** — critério 4: consumido o token, voltar nunca reencontra o formulário |
 *
 * O link vencido **não é o caso raro, é o provável**, e sem o caminho de volta a tela seria um beco — o
 * mesmo defeito que a face C de T-02 foi corrigida para não ter.
 */
export const dynamic = "force-dynamic";

export default async function TelaDeDefinirSenha({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>;
}) {
  const { estado } = await searchParams;

  if (estado === "expirado") {
    return (
      <MolduraDeConta
        titulo="Definir nova senha"
        caminhos={
          <Link href="/entrar" className="text-marca text-interface py-1 underline underline-offset-4">
            Voltar para entrar
          </Link>
        }
      >
        <Empty className="px-2 py-8 md:px-2 md:py-8">
          <EmptyHeader>
            <EmptyMedia
              variant="icon"
              className="border-linha bg-background text-tinta-suave mb-3 size-13 rounded-lg border"
            >
              <Link2Off aria-hidden="true" className="size-5.5" />
            </EmptyMedia>
            <EmptyTitle className="text-titulo-bloco text-tinta font-semibold">
              Este link expirou
            </EmptyTitle>
            <EmptyDescription className="text-corpo text-tinta-suave">Peça um novo.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Link
              href="/redefinir-senha"
              className={buttonVariants({ className: "text-interface min-h-11 px-4" })}
            >
              Pedir um novo link
            </Link>
          </EmptyContent>
        </Empty>
      </MolduraDeConta>
    );
  }

  // Sem recuperação em curso não há formulário a mostrar: ou o token já foi gasto, ou o endereço foi
  // digitado à mão. Nos dois casos o destino é a porta.
  if (!(await armazenamentoDeRedefinicao()).emCurso()) redirect("/entrar");

  return (
    <MolduraDeConta
      titulo="Definir nova senha"
      contexto="Escolha a senha que você vai usar para entrar."
      caminhos={
        <Link href="/entrar" className="text-marca text-interface py-1 underline underline-offset-4">
          Voltar para entrar
        </Link>
      }
    >
      <FormularioDeNovaSenha />
    </MolduraDeConta>
  );
}
