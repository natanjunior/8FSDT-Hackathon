import Link from "next/link";
import { redirect } from "next/navigation";

import { NaoAutenticado } from "@/aplicacao/contexto";
import { FormularioDeNovaOrganizacao } from "@/interface/componentes/formulario-de-nova-organizacao";
import { CLASSE_DO_CAMINHO, MolduraDeConta } from "@/interface/componentes/moldura-de-conta";
import { resolverParaTela } from "@/interface/http";

/**
 * **Criar uma organização** — a tela que o dono separou da face A de T-02 em 20/09/2026 (critério 44o.4).
 *
 * **Alcançada pelo caminho abaixo do cartão da face A**, que é a tela de quem ainda não participa de
 * organização nenhuma. **Ela não recusa quem tem organização ativa** (critério 44o.5), porque o caso de
 * uso não recusa — *"um Gestor de A pode fundar B"* (`criar-organizacao.ts`). **Nenhuma tela a oferece a
 * quem já tem uma**: fundar uma segunda organização tendo uma ativa está fora desta entrega, por decisão de
 * 29/08/2026 reaplicada na spec do 44o. A rota fica honesta com a API, e o produto não abre o caminho.
 *
 * **A guarda é escrita aqui, e não extraída.** É a mesma de `app/organizacao/page.tsx` e dos dois layouts
 * de grupo, cada um no seu arquivo: `src/interface/http` não importa `next/navigation`, e abrir essa porta
 * para poupar oito linhas trocaria uma repetição conhecida por uma dependência nova.
 *
 * **A espera é a de T-02**: o `loading.tsx` de `app/organizacao/` vale para este filho também.
 */
export const dynamic = "force-dynamic";

export default async function TelaDeCriarOrganizacao() {
  await exigirSessao();

  return (
    <MolduraDeConta
      titulo="Criar uma organização"
      contexto="Você vira o Gestor dela, e recebe um código para as pessoas pedirem entrada."
      caminhos={
        <Link href="/organizacao" className={CLASSE_DO_CAMINHO}>
          Voltar
        </Link>
      }
    >
      <FormularioDeNovaOrganizacao />
    </MolduraDeConta>
  );
}

async function exigirSessao(): Promise<void> {
  try {
    await resolverParaTela();
  } catch (erro) {
    // Sem sessão vai para T-01, guardando o destino — a mesma regra das outras telas.
    if (erro instanceof NaoAutenticado) redirect("/entrar?destino=%2Forganizacao%2Fcriar");
    throw erro;
  }
}
