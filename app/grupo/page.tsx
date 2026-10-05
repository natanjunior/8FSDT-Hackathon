import type { Metadata } from "next";
import Link from "next/link";

import { CartaoDeIntegrante } from "@/interface/componentes/cartao-de-integrante";
import { INTEGRANTES } from "@/interface/componentes/integrantes-do-grupo";
import { MarcaDoProduto } from "@/interface/componentes/marca";
import { Badge } from "@/interface/componentes/ui/badge";

// **Só o nome, sem o sufixo** (item 90): o `template` do layout raiz o acrescenta, e a aba continua
// saindo `"Grupo 1 · Resolve Aí"`, idêntica à de antes.
export const metadata: Metadata = { title: "Grupo 1" };

/**
 * ============================================================================
 *  A página pública do grupo — item 70
 * ============================================================================
 *
 * **Pública e estática.** Não há `proxy.ts` no projeto: cada página decide a própria sessão, e esta não
 * lê nenhuma. Quem está autenticado vê a mesma página (critério 70.1).
 *
 * **Fora das cascas**, como `app/entrar/` e `app/documentacao/`, e sem a `MolduraDeConta`: a moldura é uma
 * coluna de 420 px com um cartão, e aqui há uma grade. A marca no topo leva a `/`, que despacha cada
 * pessoa para a tela dela, com ou sem sessão.
 *
 * **A grade:** uma coluna no celular, duas a partir de `sm`, três a partir de `lg`. A última fileira fica
 * alinhada à esquerda (critério 70.4 e design §70).
 */
export default function PaginaDoGrupo() {
  return (
    <main className="mx-auto flex w-full max-w-[1080px] flex-col gap-10 px-4 pt-12 pb-16 sm:px-6">
      <Link href="/" className="inline-flex min-h-11 w-fit items-center">
        <MarcaDoProduto />
      </Link>

      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="outline">PosTech · 8FSDT</Badge>
          <span className="text-meta text-tinta-suave font-mono">Hackathon</span>
        </div>
        <h1 className="text-titulo-pagina text-tinta">Grupo 1</h1>
        <p className="text-corpo text-tinta-suave max-w-[60ch]">
          Turma 8FSDT — FIAP PosTech. Cinco pessoas construindo o Resolve Aí, o livro de ocorrências da sua
          organização.
        </p>
      </header>

      <ul aria-label="Integrantes" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {INTEGRANTES.map((integrante) => (
          <li key={integrante.rm}>
            <CartaoDeIntegrante integrante={integrante} />
          </li>
        ))}
      </ul>
    </main>
  );
}
