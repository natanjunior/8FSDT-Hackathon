import type { Metadata } from "next";
import Link from "next/link";

import { FRASES_DE_FALHA } from "@/interface/componentes/frases-de-falha";
import { CLASSE_DO_CAMINHO, MolduraDeConta } from "@/interface/componentes/moldura-de-conta";

export const metadata: Metadata = { title: FRASES_DE_FALHA.inexistenteTitulo };

/**
 * **O endereço que não leva a lugar nenhum** (item 90, critério 3).
 *
 * Antes deste arquivo, um endereço errado entregava *"404 — This page could not be found."* em inglês
 * dentro de `<html lang="pt-BR">`, sem marca e sem caminho de volta — a WCAG 3.1.2, e contra o compromisso
 * de pt-BR em tudo.
 *
 * **Fora das duas cascas, dentro do layout raiz**, então herda `lang="pt-BR"`, o tema e o alto contraste.
 * Cobre a documentação com página inexistente, a edição de vínculo sem vínculo e qualquer rota que não
 * existe. Quem erra o endereço não está em lugar nenhum da aplicação ainda, e é por isso que a moldura das
 * telas de conta serve: ela dá a marca e o cartão sem prometer barra lateral.
 *
 * **O status continua `404`** — é o comportamento do framework, e não se mexe.
 */
export default function PaginaNaoEncontrada() {
  return (
    <MolduraDeConta
      titulo={FRASES_DE_FALHA.inexistenteTitulo}
      contexto={FRASES_DE_FALHA.inexistenteFrase}
      caminhos={
        <>
          <Link href="/" className={CLASSE_DO_CAMINHO}>
            {FRASES_DE_FALHA.abrirAplicacao}
          </Link>
          <Link href="/documentacao" className={CLASSE_DO_CAMINHO}>
            {FRASES_DE_FALHA.lerDocumentacao}
          </Link>
        </>
      }
    />
  );
}
