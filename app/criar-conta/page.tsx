import type { Metadata } from "next";
import Link from "next/link";

import { FormularioDeCadastro } from "@/interface/componentes/formulario-de-cadastro";
import { CLASSE_DO_CAMINHO, MolduraDeConta } from "@/interface/componentes/moldura-de-conta";

/**
 * **T-11 · Criar conta.** Alcançada de T-01, e o botão "voltar" do navegador volta para lá.
 *
 * Não chama endpoint do contrato — chama o provedor pela ação de credencial. E não mostra a frase de
 * cold start do RNF5, porque não toca a nossa API: dizer *"acordando o servidor"* aqui seria explicar uma
 * espera que não é essa.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Criar conta" };

export default function TelaDeCriarConta() {
  return (
    <MolduraDeConta
      titulo="Criar conta"
      contexto="Uma conta só serve para todas as organizações de que você participar."
      caminhos={
        <Link href="/entrar" className={CLASSE_DO_CAMINHO}>
          Já tenho conta
        </Link>
      }
    >
      <FormularioDeCadastro />
    </MolduraDeConta>
  );
}
