"use client";

import { useEffect } from "react";

import { PARAMETRO_DA_SAIDA } from "@/interface/trabalhador/constantes";
import { limparCachesDaOrigem } from "@/interface/trabalhador/limpeza";

/**
 * **O fim da saída, em T-01** (critério 98.3). `acaoDeSair` redireciona para `/entrar?saiu=1`; aqui os
 * caches da origem são apagados e o documento é trocado por um novo, sem o parâmetro.
 *
 * **Documento novo, e não navegação suave**: o roteador do cliente guarda as telas visitadas na memória da
 * aba, e o botão de voltar poderia devolvê-las. `replace` também tira `?saiu=1` do histórico.
 *
 * **O menu de pessoa e a moldura de conta continuam com `<form action={acaoDeSair}>`**, que é o que os
 * critérios 44b.4 e 44o.15 prendem: a mudança mora na ação e aqui.
 */
export function LimpezaDaSaida(): null {
  useEffect(() => {
    const endereco = new URL(window.location.href);
    if (!endereco.searchParams.has(PARAMETRO_DA_SAIDA)) return;
    let viva = true;
    void limparCachesDaOrigem().finally(() => {
      if (!viva) return;
      endereco.searchParams.delete(PARAMETRO_DA_SAIDA);
      window.location.replace(`${endereco.pathname}${endereco.search}`);
    });
    return () => {
      viva = false;
    };
  }, []);
  return null;
}
