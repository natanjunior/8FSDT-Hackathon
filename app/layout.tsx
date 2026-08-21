import type { Metadata, Viewport } from "next";

import "./globals.css";

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
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
