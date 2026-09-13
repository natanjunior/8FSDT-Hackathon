"use client";

import mermaid from "mermaid";
import { useEffect, useId, useState } from "react";

/**
 * Renderiza um bloco Mermaid do markdown.
 *
 * O `mermaid` já era dependência do projeto: o `verificar:mermaid` o usa para validar a sintaxe de todo
 * bloco do repositório. Aqui ele é usado para desenhar, e não custa dependência nova.
 *
 * **O tema é lido do documento, e não fixado.** A página renderiza em três estados: claro, escuro, e o
 * "sistema" de quem nunca escolheu. Um diagrama com tema fixo fica preto no fundo escuro em dois deles.
 */
function temaAtual(): "dark" | "default" {
  const declarado = document.documentElement.dataset.theme;
  if (declarado === "dark") return "dark";
  if (declarado === "light") return "default";
  if (document.documentElement.classList.contains("dark")) return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "default";
}

export function Diagrama({ texto }: { texto: string }) {
  const id = useId().replaceAll(":", "");
  const [svg, definirSvg] = useState("");
  const [falhou, definirFalhou] = useState(false);

  useEffect(() => {
    let cancelado = false;
    mermaid.initialize({ startOnLoad: false, theme: temaAtual(), securityLevel: "strict" });
    mermaid
      .render(`diagrama-${id}`, texto)
      .then(({ svg: desenhado }) => {
        if (!cancelado) definirSvg(desenhado);
      })
      .catch(() => {
        if (!cancelado) definirFalhou(true);
      });
    return () => {
      cancelado = true;
    };
  }, [id, texto]);

  // O `verificar:mermaid` roda no portão e não deixa diagrama quebrado chegar aqui. Se chegar, o texto
  // do diagrama é mais útil que uma caixa vazia.
  if (falhou) return <pre>{texto}</pre>;

  return <div className="overflow-x-auto" dangerouslySetInnerHTML={{ __html: svg }} />;
}
