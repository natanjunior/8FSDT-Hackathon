import { encode } from "uqr";

/**
 * ============================================================================
 *  O QR do convite (item 86, ADR-0019)
 * ============================================================================
 *
 * **Desenhado no servidor, sem JavaScript de cliente e sem HTML cru.** O `uqr` devolve a matriz, e o SVG é
 * escrito aqui, módulo a módulo, num `path` só.
 *
 * **Escuro sobre claro em qualquer tema, inclusive no alto contraste.** Leitor de câmera falha com o QR
 * invertido, então o QR tem fundo branco próprio e não herda o tema. A zona de silêncio de quatro módulos
 * é a que a norma do QR pede, e é ela que deixa o leitor achar a borda.
 */
const ZONA_DE_SILENCIO = 4;

export function modulosDoQr(texto: string): boolean[][] {
  // Correção média: o link é curto, e a margem vale mais que a densidade num cartaz impresso.
  return encode(texto, { ecc: "M", border: 0 }).data;
}

export function QrDoLink({ link, rotulo }: { link: string; rotulo: string }) {
  const modulos = modulosDoQr(link);
  const lado = modulos.length + ZONA_DE_SILENCIO * 2;

  let caminho = "";
  modulos.forEach((linha, y) => {
    linha.forEach((escuro, x) => {
      if (escuro) caminho += `M${x + ZONA_DE_SILENCIO} ${y + ZONA_DE_SILENCIO}h1v1h-1z`;
    });
  });

  return (
    <svg
      role="img"
      aria-label={rotulo}
      viewBox={`0 0 ${lado} ${lado}`}
      shapeRendering="crispEdges"
      className="size-56 rounded-sm"
    >
      <rect width={lado} height={lado} fill="#ffffff" />
      <path d={caminho} fill="#000000" />
    </svg>
  );
}
