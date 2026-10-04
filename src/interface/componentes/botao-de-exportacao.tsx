"use client";

import { Download } from "lucide-react";
import { useState } from "react";

import { IndicadorDeEnvio } from "@/interface/componentes/campo";
import { avisarErro, mensagemDoProblema, MENSAGEM_GENERICA } from "@/interface/componentes/retorno-de-acao";
import { buttonVariants } from "@/interface/componentes/ui/button";
import { cn } from "@/interface/componentes/utilitarios";

/**
 * **O botão *Exportar CSV*** (item 124). Busca por `fetch`, e não por `<a href download>`: um link direto
 * que recebe `403` ou `500` leva o navegador a uma página com o JSON cru do problema, e a tela promete a
 * frase em português que vem da resposta. Com `fetch`, o sucesso vira download pelo nome do
 * `Content-Disposition` e a falha fica na tela.
 *
 * **Enquanto busca, ele fica inerte e diz *Exportando…*** (o padrão do item 103): com a aplicação fria isso
 * pode levar os 20 s do cold start, e um botão que não responde convida o segundo clique. **No sucesso não
 * há aviso**: o download que o navegador mostra é o recibo.
 */
export function BotaoDeExportacao({ endereco, className }: { endereco: string; className?: string }) {
  const [exportando, setExportando] = useState(false);

  async function exportar(): Promise<void> {
    setExportando(true);
    const tentarDeNovo = { rotulo: "Tentar de novo", aoClicar: () => void exportar() };
    try {
      const resposta = await fetch(endereco, { headers: { accept: "text/csv" } });
      if (!resposta.ok) {
        const corpo: unknown = await resposta.json().catch(() => null);
        avisarErro("Não foi possível exportar o CSV", mensagemDoProblema(corpo), tentarDeNovo);
        return;
      }
      const nome =
        /filename="([^"]+)"/u.exec(resposta.headers.get("content-disposition") ?? "")?.[1] ?? "exportacao.csv";
      const url = URL.createObjectURL(await resposta.blob());
      const ancora = document.createElement("a");
      ancora.href = url;
      ancora.download = nome;
      ancora.click();
      URL.revokeObjectURL(url);
    } catch {
      avisarErro("Não foi possível exportar o CSV", MENSAGEM_GENERICA, tentarDeNovo);
    } finally {
      setExportando(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void exportar()}
      disabled={exportando}
      className={cn(buttonVariants({ variant: "outline" }), "text-interface min-h-11 shrink-0 gap-2 rounded-sm px-4", className)}
    >
      {exportando ? <IndicadorDeEnvio ativo /> : <Download aria-hidden="true" />}
      {exportando ? "Exportando…" : "Exportar CSV"}
    </button>
  );
}
