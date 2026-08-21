import { redirect } from "next/navigation";

import { FormularioDeEntrada } from "@/interface/componentes/formulario-de-entrada";
import { MolduraDeTela } from "@/interface/componentes/moldura-de-tela";
import { resolverParaTela } from "@/interface/http";

/**
 * **T-01 · Entrar** — a única tela que qualquer pessoa alcança sem sessão, e o destino de qualquer
 * redirecionamento por falta dela (inventário, §3, decisão 2).
 *
 * O `?destino=` é o que faz o link profundo sobreviver à autenticação: *"uma ocorrência que não pode ser
 * mandada por link é uma ocorrência que vai ser descrita por WhatsApp"*.
 */
export const dynamic = "force-dynamic";

export default async function TelaDeEntrar({
  searchParams,
}: {
  searchParams: Promise<{ destino?: string; confirmacao?: string }>;
}) {
  const { destino, confirmacao } = await searchParams;

  // Quem já tem sessão não vê a porta. O shell resolve para onde ir.
  if (await temSessao()) redirect(destino !== undefined && destino.startsWith("/") ? destino : "/");

  return (
    <MolduraDeTela titulo="Entrar">
      <FormularioDeEntrada
        {...(destino !== undefined && destino.startsWith("/") ? { destino } : {})}
        {...(confirmacao === "confirmada" || confirmacao === "expirada" ? { confirmacao } : {})}
      />
    </MolduraDeTela>
  );
}

async function temSessao(): Promise<boolean> {
  try {
    await resolverParaTela();
    return true;
  } catch {
    // `NaoAutenticado` é o caminho normal desta tela, não uma falha.
    return false;
  }
}
