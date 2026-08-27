import Link from "next/link";
import { redirect } from "next/navigation";

import { FormularioDeNovaSenha } from "@/interface/componentes/formulario-de-nova-senha";
import { MolduraDeTela } from "@/interface/componentes/moldura-de-tela";
import { buttonVariants } from "@/interface/componentes/ui/button";
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
      <MolduraDeTela titulo="Este link expirou">
        <p className="text-tinta-suave text-sm leading-relaxed">Peça um novo.</p>

        <Link href="/redefinir-senha" className={buttonVariants({ className: "h-12 w-fit px-6 text-base" })}>
          Pedir um novo link
        </Link>

        <Link href="/entrar" className="text-marca w-fit py-1 text-sm underline underline-offset-4">
          Voltar para entrar
        </Link>
      </MolduraDeTela>
    );
  }

  // Sem recuperação em curso não há formulário a mostrar: ou o token já foi gasto, ou o endereço foi
  // digitado à mão. Nos dois casos o destino é a porta.
  if (!(await armazenamentoDeRedefinicao()).emCurso()) redirect("/entrar");

  return (
    <MolduraDeTela titulo="Definir nova senha">
      <FormularioDeNovaSenha />
    </MolduraDeTela>
  );
}
