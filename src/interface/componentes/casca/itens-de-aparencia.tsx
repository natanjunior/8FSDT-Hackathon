"use client";

import { useState } from "react";

import { ItemDeContraste } from "@/interface/componentes/casca/item-de-contraste";
import { ItemDeTema } from "@/interface/componentes/casca/item-de-tema";
import {
  aplicarContraste,
  ATRIBUTO_DO_CONTRASTE,
  atributoDoTema,
  contrasteDoAtributo,
  cookieDoContraste,
  cookieDoTema,
  temaDoAtributo,
} from "@/interface/componentes/tema";

/**
 * **Os dois controles de aparência do menu da pessoa** (itens 72 e 85), e o estado deles num lugar só.
 *
 * **O contraste vence o tema** (spec 85 §4.1). Com ele ligado, *Tema escuro* fica desabilitado e guarda
 * o estado que tinha: trocar o tema ali mudaria uma escolha sem mudar nada na tela. Desligado o
 * contraste, volta o tema guardado.
 *
 * **Uma fonte só**: o estado inicial lê os dois atributos do `<html>`, os mesmos que o CSS lê. O
 * componente só monta com o menu aberto, então nunca renderiza no servidor.
 */
export function ItensDeAparencia() {
  const [escuro, setEscuro] = useState(
    () => temaDoAtributo(document.documentElement.getAttribute("data-theme")) === "escuro",
  );
  const [alto, setAlto] = useState(
    () => contrasteDoAtributo(document.documentElement.getAttribute(ATRIBUTO_DO_CONTRASTE)) === "alto",
  );

  function trocarTema(ligado: boolean) {
    const tema = ligado ? "escuro" : "claro";
    document.documentElement.setAttribute("data-theme", atributoDoTema(tema));
    // Grava `escuro` também: a escolha explícita fica registrada como escolha.
    document.cookie = cookieDoTema(tema);
    setEscuro(ligado);
  }

  function trocarContraste(ligado: boolean) {
    const contraste = ligado ? "alto" : "normal";
    aplicarContraste(document.documentElement, contraste);
    document.cookie = cookieDoContraste(contraste);
    setAlto(ligado);
  }

  return (
    <>
      <ItemDeTema escuro={escuro} desabilitado={alto} aoTrocar={trocarTema} />
      <ItemDeContraste alto={alto} aoTrocar={trocarContraste} />
    </>
  );
}
