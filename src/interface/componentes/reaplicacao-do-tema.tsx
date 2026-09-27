"use client";

import { useLayoutEffect } from "react";

import { aplicarContraste, atributoDoTema, contrasteDoCookie, temaDoCookie } from "@/interface/componentes/tema";

/**
 * **Só existe por causa do modo de desenvolvimento.** Com `reactStrictMode`, o React remonta uma vez e
 * devolve o `<html>` aos atributos do JSX, apagando o `light` e o `data-contraste` que o script do `<head>`
 * pôs; por isso reaplica os dois atributos. Em produção reescreve o mesmo valor, sem efeito.
 *
 * **Mora no layout raiz, e não no controle**: o controle vive dentro do menu, que só monta quando abre.
 * `useLayoutEffect`, e não `useEffect`, porque roda antes da pintura.
 */
export function ReaplicacaoDoTema(): null {
  useLayoutEffect(() => {
    const raiz = document.documentElement;
    raiz.setAttribute("data-theme", atributoDoTema(temaDoCookie(document.cookie)));
    aplicarContraste(raiz, contrasteDoCookie(document.cookie));
  }, []);
  return null;
}
