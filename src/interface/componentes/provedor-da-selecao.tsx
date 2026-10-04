"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

import type { LinhaDeParticipante, LinhaDeVinculo } from "@/interface/componentes/linhas-de-participantes";
import {
  SELECAO_VAZIA,
  alternar,
  alternarPagina,
  type Selecao,
} from "@/interface/componentes/selecao-de-participantes";

/**
 * **A seleção de linhas mora acima do cabeçalho e da tabela** (item 122): o botão que a usa está no
 * cabeçalho, que é do servidor, e a seleção nasce na tabela, que é do cliente. **Nada no endereço, nada no
 * `localStorage`**: a seleção some ao recarregar.
 */
type ContextoDaSelecao = {
  selecao: Selecao;
  alternar: (linha: LinhaDeVinculo) => void;
  alternarPagina: (pagina: readonly LinhaDeParticipante[]) => void;
  limpar: () => void;
};

const Contexto = createContext<ContextoDaSelecao | null>(null);

export function ProvedorDaSelecao({ children }: { children: ReactNode }) {
  const [selecao, setSelecao] = useState<Selecao>(SELECAO_VAZIA);
  return (
    <Contexto.Provider
      value={{
        selecao,
        alternar: (linha) => setSelecao((atual) => alternar(atual, linha)),
        alternarPagina: (pagina) => setSelecao((atual) => alternarPagina(atual, pagina)),
        limpar: () => setSelecao(SELECAO_VAZIA),
      }}
    >
      {children}
    </Contexto.Provider>
  );
}

export function useSelecao(): ContextoDaSelecao {
  const contexto = useContext(Contexto);
  if (contexto === null) throw new Error("useSelecao só funciona dentro de ProvedorDaSelecao.");
  return contexto;
}
