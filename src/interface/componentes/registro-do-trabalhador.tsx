"use client";

import { useEffect } from "react";

import { CAMINHO_DO_TRABALHADOR } from "@/interface/trabalhador/constantes";

/**
 * **Registra o trabalhador de serviço, e só em produção** (item 98). Em `npm run dev` ele brigaria com a
 * recarga a quente. A pilha local e o ponta a ponta rodam a imagem de produção, então ele está neles.
 *
 * `updateViaCache: "none"` faz o navegador ignorar o cache HTTP ao conferir o script, junto com o
 * `no-cache` da rota. Falha no registro é silenciosa de propósito: sem trabalhador, a aplicação é a de
 * antes do item.
 */
export function RegistroDoTrabalhador(): null {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register(CAMINHO_DO_TRABALHADOR, { scope: "/", updateViaCache: "none" })
      .catch(() => {});
  }, []);
  return null;
}
