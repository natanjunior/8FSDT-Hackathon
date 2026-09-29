"use client";

import { FRASES_DE_FALHA } from "@/interface/componentes/frases-de-falha";
import { Button } from "@/interface/componentes/ui/button";

/**
 * **A falha de uma tela da casca aparece dentro dela** (item 90, critério 4): a barra lateral e a barra
 * superior continuam de pé, e são elas o caminho de volta — é o que faz a pessoa ter para onde ir sem
 * recarregar. Mesma frase e mesma ação de `app/error.tsx`, sem o caminho secundário.
 *
 * **A forma é a de `OcorrenciaNaoEncontradaNaTela`**: título de página, frase de apoio, uma ação.
 *
 * **`retry()` e não `reset()`**, e nada do erro na tela — as duas razões estão em `app/error.tsx`.
 */
export default function FalhaDaTela({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-titulo-pagina text-tinta">{FRASES_DE_FALHA.paginaTitulo}</h1>
      <p className="text-corpo text-tinta-suave">{FRASES_DE_FALHA.paginaFrase}</p>
      <Button
        type="button"
        variant="outline"
        className="h-11 w-full font-medium md:w-auto md:self-start"
        onClick={() => retry()}
      >
        {FRASES_DE_FALHA.acao}
      </Button>
    </div>
  );
}
