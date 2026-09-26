"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";

import { vlibrasNaRota } from "@/interface/componentes/rota-do-vlibras";

/**
 * **O widget VLibras** (item 85, ADR-0017): tradução do texto da página para Libras, do governo federal.
 *
 * **Em toda tela do produto, e fora da documentação.** As páginas de `/documentacao` têm casca própria
 * (ADR-0009), e o botão flutuante disputaria espaço com a barra lateral e o índice delas.
 *
 * **`lazyOnload`**: carrega depois de tudo, sem disputar a partida a frio nem a primeira pintura. Se o
 * domínio do governo falhar, a página não percebe.
 *
 * **O contêiner é do React, e o que vai dentro é do widget.** Sair para a documentação desmonta o
 * contêiner e o botão some junto; voltar remonta, e o `onReady`, que roda a cada montagem, instancia de
 * novo.
 */
declare global {
  interface Window {
    VLibras?: { Widget: new (opcoes: { rootPath: string; position?: "R" | "L" }) => unknown };
  }
}

const ORIGEM = "https://vlibras.gov.br";

export function VLibras() {
  const caminho = usePathname();
  if (!vlibrasNaRota(caminho)) return null;

  return (
    <>
      {/* A marcação que o widget procura. `vw` é atributo próprio dele. */}
      <div {...{ vw: "" }} className="enabled">
        <div {...{ "vw-access-button": "" }} className="active" />
        <div {...{ "vw-plugin-wrapper": "" }}>
          <div className="vw-plugin-top-wrapper" />
        </div>
      </div>
      <Script
        src={`${ORIGEM}/app/vlibras-plugin.js`}
        strategy="lazyOnload"
        onReady={() => {
          if (window.VLibras) new window.VLibras.Widget({ rootPath: `${ORIGEM}/app`, position: "R" });
        }}
      />
    </>
  );
}
