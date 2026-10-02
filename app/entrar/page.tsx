import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { FormularioDeEntrada } from "@/interface/componentes/formulario-de-entrada";
import { LimpezaDaSaida } from "@/interface/componentes/limpeza-da-saida";
import { CLASSE_DO_CAMINHO, MolduraDeConta } from "@/interface/componentes/moldura-de-conta";
import { destinoSeguro, resolverParaTela } from "@/interface/http";

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
 * **O `?redefinicao=encerrada` vem de `/definir-senha`** sem recuperação em curso (item 116). Valor
 * desconhecido é ignorado, como o do `?confirmacao=`.
 *
 * **Quem acabou de trocar a senha em T-13 chega aqui com o aviso de sucesso**, que mora no layout raiz e
 * sobrevive à navegação. Até o item 44g era uma faixa lida de um parâmetro do endereço; o guia §7 trocou a
 * faixa de desfecho pelo aviso.
 *
 * O pé, com a página do grupo e a documentação, é da moldura desde o item 116.
 *
 * A guarda do `?destino=` é `destinoSeguro`, a mesma de `/criar-conta`, e o link para criar conta leva o
 * destino junto (item 86).
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Entrar" };

export default async function TelaDeEntrar({
  searchParams,
}: {
  searchParams: Promise<{ destino?: string; confirmacao?: string; redefinicao?: string }>;
}) {
  const { destino, confirmacao, redefinicao } = await searchParams;
  const volta = destinoSeguro(destino);

  // Quem já tem sessão não vê a porta. O shell resolve para onde ir.
  if (await temSessao()) redirect(volta ?? "/");

  return (
    <>
      <LimpezaDaSaida />
      <MolduraDeConta
        apresentacao
        titulo="Entrar"
        contexto="Entre para ver e acompanhar as ocorrências."
        caminhos={
          <>
            <Link
              href={
                volta === null ? "/criar-conta" : `/criar-conta?destino=${encodeURIComponent(volta)}`
              }
              className={CLASSE_DO_CAMINHO}
            >
              Criar conta
            </Link>
            <Link href="/redefinir-senha" className={CLASSE_DO_CAMINHO}>
              Esqueci a senha
            </Link>
          </>
        }
      >
        <FormularioDeEntrada
          {...(volta !== null ? { destino: volta } : {})}
          {...(confirmacao === "confirmada" || confirmacao === "expirada" ? { confirmacao } : {})}
          {...(redefinicao === "encerrada" ? { redefinicao } : {})}
        />
      </MolduraDeConta>
    </>
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
