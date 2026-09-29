import type { Metadata } from "next";
import Link from "next/link";

import { FormularioDeCadastro } from "@/interface/componentes/formulario-de-cadastro";
import { CLASSE_DO_CAMINHO, MolduraDeConta } from "@/interface/componentes/moldura-de-conta";
import { destinoSeguro } from "@/interface/http";

/**
 * **T-11 · Criar conta.** Alcançada de T-01, e o botão "voltar" do navegador volta para lá.
 *
 * Não chama endpoint do contrato — chama o provedor pela ação de credencial. E não mostra a frase de
 * cold start do RNF5, porque não toca a nossa API: dizer *"acordando o servidor"* aqui seria explicar uma
 * espera que não é essa.
 *
 * Com `?destino=`, quem cria a conta volta para lá, com a guarda de `/entrar` (item 86). Sem confirmação
 * de e-mail (Q-T9), a conta criada já entra.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Criar conta" };

export default async function TelaDeCriarConta({
  searchParams,
}: {
  searchParams: Promise<{ destino?: string }>;
}) {
  const volta = destinoSeguro((await searchParams).destino);

  return (
    <MolduraDeConta
      titulo="Criar conta"
      contexto="Uma conta só serve para todas as organizações de que você participar."
      caminhos={
        <Link
          href={volta === null ? "/entrar" : `/entrar?destino=${encodeURIComponent(volta)}`}
          className={CLASSE_DO_CAMINHO}
        >
          Já tenho conta
        </Link>
      }
    >
      <FormularioDeCadastro {...(volta !== null ? { destino: volta } : {})} />
    </MolduraDeConta>
  );
}
