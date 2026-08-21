import { FormularioDeCadastro } from "@/interface/componentes/formulario-de-cadastro";
import { MolduraDeTela } from "@/interface/componentes/moldura-de-tela";

/**
 * **T-11 · Criar conta.** Alcançada de T-01, e o botão "voltar" do navegador volta para lá (inventário, §3).
 *
 * Não chama endpoint do contrato — chama o provedor pela ação de credencial (§4.1). E não mostra a frase de
 * cold start do RNF5, porque não toca a nossa API: dizer *"acordando o servidor"* aqui seria explicar uma
 * espera que não é essa.
 */
export const dynamic = "force-dynamic";

export default function TelaDeCriarConta() {
  return (
    <MolduraDeTela titulo="Criar conta">
      <FormularioDeCadastro />
    </MolduraDeTela>
  );
}
