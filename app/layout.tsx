import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";

import "./globals.css";

/**
 * **A única família do tema Meridian que entra.**
 *
 * O tema traz três — `Geist`, `Instrument Serif` e `Geist Mono`. Serifada não tem consumidor nenhum no
 * produto, e monoespaçada tem dois (`font-mono` em `app/page.tsx`) que caem na pilha do sistema sem custo.
 * `next/font/google` traz a família em **tempo de construção**: cada uma pesa no build e na imagem.
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
  themeColor: "#b4341f",
};

export default function CascoDaAplicacao({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className={`${fonteDeTexto.variable} min-h-dvh antialiased`}>{children}</body>
    </html>
  );
}
