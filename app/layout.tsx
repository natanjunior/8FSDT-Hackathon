import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import "./globals.css";

/**
 * **As duas famílias que entram.**
 *
 * A `Geist` é o texto. A `Geist Mono` é dado: horário, contagem, identificador e rótulo de coluna — o
 * sétimo papel da escala do guia. Ela passou a ser carregada em 13/09/2026, revertendo metade do critério
 * 44.4: a razão daquele critério era que `font-mono` tinha dois consumidores em `app/page.tsx`, que hoje
 * tem zero, enquanto a trilha de auditoria tem oito.
 *
 * `Instrument Serif` continua fora, e continua sem consumidor. `next/font/google` traz a família em
 * **tempo de construção**: cada uma pesa no build e na imagem.
 *
 * **A variável vai no `<body>`, não no `<html>`.** O `globals.css` declara `--font-sans` no `:root`, que
 * *é* o `<html>` — as duas declarações disputariam por ordem de origem, que não é garantida. No `<body>`
 * não há disputa: ela vale para o elemento e tudo abaixo dele, e a do `:root` fica sendo o piso.
 */
const fonteDeTexto = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const fonteDeDado = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

/**
 * O casco da aplicação.
 *
 * `lang="pt-BR"` não é detalhe: o produto é pt-BR em recurso, campo, rótulo e mensagem (contrato §7.1), e é
 * o atributo que faz um leitor de tela pronunciar "Ocorrência" em vez de "Occurrence".
 */
export const metadata: Metadata = {
  title: "Resolve Aí",
  description:
    "Registre uma ocorrência do seu condomínio, empresa ou bairro e acompanhe até a resolução, " +
    "com trilha auditável de toda mudança de status.",
  applicationName: "Resolve Aí",
};

export const viewport: Viewport = {
  // O alvo primário de T-01 e T-02 é celular (inventário de telas).
  width: "device-width",
  initialScale: 1,
  // A marca em hex, porque `<meta name="theme-color">` não tem suporte confiável a oklch.
  // É a conversão de oklch(0.6031 0.1107 41.8526) — o --accent claro —, dentro do gamut sRGB.
  themeColor: "#b8694a",
};

export default function CascoDaAplicacao({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className={`${fonteDeTexto.variable} ${fonteDeDado.variable} min-h-dvh antialiased`}>
        {children}
      </body>
    </html>
  );
}
