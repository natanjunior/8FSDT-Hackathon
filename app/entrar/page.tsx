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
 *
 * **`?confirmacao=` é dormente.** Ele só chega aqui vindo de `/confirmar-conta`, que nada alcança nesta
 * entrega (Q-T9 fechada em 22/08/2026). O parâmetro fica, e é inofensivo: valor desconhecido é ignorado.
 *
 * **`?senha=alterada` é vivo, e vem de T-13.** É a chegada de quem acabou de trocar a senha (item 6b,
 * D-6b-4). Quem já tinha sessão ao trocar **provavelmente** não passa por aqui — o `redirect` acima o leva
 * ao shell —, e o *provavelmente* é a **premissa P-6b-1**: se o provedor revogar as outras sessões ao ver a
 * senha mudar, essa pessoa cai aqui como qualquer outra, e o aviso é exatamente o certo para ela. **Os dois
 * desfechos são aceitáveis; o que não é aceitável é este comentário afirmar um deles sem fonte.**
 */
export const dynamic = "force-dynamic";

export default async function TelaDeEntrar({
  searchParams,
}: {
  searchParams: Promise<{ destino?: string; confirmacao?: string; senha?: string }>;
}) {
  const { destino, confirmacao, senha } = await searchParams;

  // Quem já tem sessão não vê a porta. O shell resolve para onde ir.
  if (await temSessao()) redirect(destino !== undefined && destino.startsWith("/") ? destino : "/");

  return (
    <MolduraDeTela titulo="Entrar">
      <FormularioDeEntrada
        {...(destino !== undefined && destino.startsWith("/") ? { destino } : {})}
        {...(confirmacao === "confirmada" || confirmacao === "expirada" ? { confirmacao } : {})}
        senhaAlterada={senha === "alterada"}
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
