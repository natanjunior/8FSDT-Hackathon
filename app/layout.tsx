import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { ReaplicacaoDoTema } from "@/interface/componentes/reaplicacao-do-tema";
import { ID_DO_SCRIPT_DO_TEMA, SCRIPT_DO_TEMA } from "@/interface/componentes/tema";
import { Toaster } from "@/interface/componentes/ui/sonner";
import { COR_DA_MARCA } from "@/interface/manifesto";

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
  // **A cor da marca, uma só nos dois temas** (item 76, critério 10): o tema é cookie, e o navegador não
  // tem como saber qual a pessoa escolheu. Mora em `src/interface/manifesto.ts`, junto do manifesto.
  themeColor: COR_DA_MARCA,
};

export default function CascoDaAplicacao({ children }: { children: React.ReactNode }) {
  return (
    /* **Escuro por padrão, escrito no servidor** (item 72). Sem JavaScript nenhum a página já vem escura,
       e é isso que torna o "sem piscar" demonstrável: a pintura clara não tem de onde vir. O script do
       `<head>` troca para claro só quando o cookie pede, durante o parse e antes da primeira pintura.
       `suppressHydrationWarning` porque o atributo pode ter sido trocado antes de o React chegar. */
    <html lang="pt-BR" data-theme="dark" suppressHydrationWarning>
      <head>
        <script id={ID_DO_SCRIPT_DO_TEMA} dangerouslySetInnerHTML={{ __html: SCRIPT_DO_TEMA }} />
      </head>
      <body className={`${fonteDeTexto.variable} ${fonteDeDado.variable} min-h-dvh antialiased`}>
        <ReaplicacaoDoTema />
        {children}
        {/* **Depois de `{children}`, e uma vez só.** O aviso mora aqui para sobreviver ao modal que o
            disparou e à atualização da página (guia §7, ADR-0011). Ele desenha uma `<section>` em toda
            página, e vir depois do conteúdo é uma das duas razões pelas quais o teste de ponta a ponta,
            que acha o bloco *Situação* pela primeira `<section>` que contém a palavra, não o lê. */}
        <Toaster />
      </body>
    </html>
  );
}
