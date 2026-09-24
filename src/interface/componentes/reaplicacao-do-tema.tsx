"use client";

import { useLayoutEffect } from "react";

import { atributoDoTema, temaDoCookie } from "@/interface/componentes/tema";

/**
 * **Só existe por causa do modo de desenvolvimento.** Com `reactStrictMode`, o React remonta uma vez e
 * devolve o `<html>` aos atributos do JSX, apagando o `light` que o script do `<head>` pôs. Em produção
 * reescreve o mesmo valor, sem efeito.
 *
 * **Mora no layout raiz, e não no controle**: o controle vive dentro do menu, que só monta quando abre.
 * `useLayoutEffect`, e não `useEffect`, porque roda antes da pintura.
 */
export function ReaplicacaoDoTema(): null {
  useLayoutEffect(() => {
    document.documentElement.setAttribute("data-theme", atributoDoTema(temaDoCookie(document.cookie)));
  }, []);
  return null;
}
