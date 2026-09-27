import Link from "next/link";
import { redirect } from "next/navigation";

import { FormularioDeEntrada } from "@/interface/componentes/formulario-de-entrada";
import { MolduraDeConta } from "@/interface/componentes/moldura-de-conta";
import { resolverParaTela } from "@/interface/http";

/**
 * **T-01 · Entrar** — a única tela que qualquer pessoa alcança sem sessão, e o destino de qualquer
 * redirecionamento por falta dela (a porta do produto).
 *
 * O `?destino=` é o que faz o link profundo sobreviver à autenticação: *"uma ocorrência que não pode ser
 * mandada por link é uma ocorrência que vai ser descrita por WhatsApp"*.
 *
 * **`?confirmacao=` é dormente.** Ele só chega aqui vindo de `/confirmar-conta`, que nada alcança nesta
 * entrega (Q-T9 fechada em 22/08/2026). O parâmetro fica, e é inofensivo: valor desconhecido é ignorado.
 *
 * **Quem acabou de trocar a senha em T-13 chega aqui com o aviso de sucesso**, que mora no layout raiz e
 * sobrevive à navegação. Até o item 44g era uma faixa lida de um parâmetro do endereço; o guia §7 trocou a
 * faixa de desfecho pelo aviso.
 *
 * **O pé leva à página do grupo e à documentação** (item 70), as duas públicas e em nova aba. Fica fora
 * dos caminhos debaixo do cartão, porque aqueles são sobre a conta e estes não.
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
    <MolduraDeConta
      titulo="Entrar"
      contexto="Entre para ver e acompanhar as ocorrências."
      apresentacao
      caminhos={
        <>
          <Link href="/criar-conta" className="text-tinta-marca text-interface py-1 underline underline-offset-4">
            Criar conta
          </Link>
          <Link
            href="/redefinir-senha"
            className="text-tinta-marca text-interface py-1 underline underline-offset-4"
          >
            Esqueci a senha
          </Link>
        </>
      }
      rodape={
        <p className="text-meta text-tinta-suave flex items-center gap-2">
          <Link
            href="/grupo"
            target="_blank" rel="noreferrer"
            className="inline-flex min-h-11 items-center underline-offset-4 hover:underline"
          >
            Feito pelo Grupo 1<span className="sr-only">, abre em nova aba</span>
          </Link>
          <span aria-hidden="true">·</span>
          <Link
            href="/documentacao"
            target="_blank" rel="noreferrer"
            className="inline-flex min-h-11 items-center underline-offset-4 hover:underline"
          >
            Documentação<span className="sr-only">, abre em nova aba</span>
          </Link>
        </p>
      }
    >
      <FormularioDeEntrada
        {...(destino !== undefined && destino.startsWith("/") ? { destino } : {})}
        {...(confirmacao === "confirmada" || confirmacao === "expirada" ? { confirmacao } : {})}
      />
    </MolduraDeConta>
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
