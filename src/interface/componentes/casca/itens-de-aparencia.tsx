"use client";

import { useId, useState } from "react";

import { ItemDeContraste } from "@/interface/componentes/casca/item-de-contraste";
import { ItemDeTema } from "@/interface/componentes/casca/item-de-tema";
import { DropdownMenuGroup, DropdownMenuLabel } from "@/interface/componentes/ui/dropdown-menu";
import {
  aplicarContraste,
  ATRIBUTO_DO_CONTRASTE,
  atributoDoTema,
  contrasteDoAtributo,
  cookieDoContraste,
  cookieDoTema,
  temaDoAtributo,
  temaExibido,
} from "@/interface/componentes/tema";

/**
 * **O grupo *Aparência*** (itens 72, 85 e 114): o rótulo, as duas chaves, e o estado delas num lugar só.
 * Os dois menus o usam, o da pessoa na casca e o `ControleDeAparencia` fora dela, para que o desenho seja
 * um só.
 *
 * **Um grupo titulado** (critério 114.5), com o papel de rótulo dos grupos da barra lateral
 * (`casca/navegacao.tsx:139`): a forma avisa que estas linhas mudam a tela, e não levam a outra. O rótulo
 * não é alvo; as setas o pulam. O `aria-labelledby` dá nome ao grupo para o leitor.
 *
 * **Pronto para três** (critério 114.6). O Libras hoje flutua sobre a página; levá-lo para cá é do bloco
 * V-1 da auditoria, e ele entra como mais uma linha, depois do contraste.
 *
 * **O contraste vence o tema** (spec 85 §4.1). Com ele ligado, *Tema escuro* mostra o que a tela pinta
 * (`temaExibido`) e fica inerte; a escolha guardada continua no cookie e volta quando o contraste sai.
 * `trocarTema` também recusa a troca nesse estado: a guarda do item é a primeira, e esta é a segunda.
 *
 * **Uma fonte só**: o estado inicial lê os dois atributos do `<html>`, os mesmos que o CSS lê. O
 * componente só monta com o menu aberto, então nunca renderiza no servidor.
 */
export function GrupoDeAparencia() {
  const idDoRotulo = useId();
  const [escuro, setEscuro] = useState(
    () => temaDoAtributo(document.documentElement.getAttribute("data-theme")) === "escuro",
  );
  const [alto, setAlto] = useState(
    () => contrasteDoAtributo(document.documentElement.getAttribute(ATRIBUTO_DO_CONTRASTE)) === "alto",
  );

  function trocarTema(ligado: boolean) {
    if (alto) return;
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

  const exibido = temaExibido(escuro ? "escuro" : "claro", alto ? "alto" : "normal");

  return (
    <DropdownMenuGroup aria-labelledby={idDoRotulo}>
      <DropdownMenuLabel
        id={idDoRotulo}
        className="text-rotulo-coluna text-tinta-suave pt-2 pb-1 font-mono font-medium uppercase"
      >
        Aparência
      </DropdownMenuLabel>
      <ItemDeTema escuro={exibido === "escuro"} inerte={alto} aoTrocar={trocarTema} />
      <ItemDeContraste alto={alto} aoTrocar={trocarContraste} />
    </DropdownMenuGroup>
  );
}
