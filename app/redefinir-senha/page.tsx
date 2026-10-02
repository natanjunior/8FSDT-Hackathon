import type { Metadata } from "next";
import Link from "next/link";

import { NaoAutenticado } from "@/aplicacao/contexto";
import { FormularioDeRedefinicao } from "@/interface/componentes/formulario-de-redefinicao";
import { CLASSE_DO_CAMINHO, MolduraDeConta } from "@/interface/componentes/moldura-de-conta";
import { resolverParaTela } from "@/interface/http";

export const metadata: Metadata = { title: "Redefinir senha" };

/**
 * **T-12 · Redefinir senha** — alcançada de T-01 e do erro de e-mail repetido em T-11.
 *
 * **Não redireciona quem tem sessão**, ao contrário de T-01 (decisão D-6b-5). O *"sem sessão"* do
 * inventário descreve quem chega aqui, não é guarda — e **esta continua sendo a única porta de trocar a
 * senha** que o produto tem. Desde o item 49 ela deixou de ser a única **alcançável**: **T-16 · Meus
 * dados** aponta para cá, na seção *Acesso*. A guarda fica, e a razão dela ficou melhor.
 *
 * **Com sessão, a tela sabe quem é** (item 106, critério 12): o e-mail vem preenchido e a saída volta
 * para Meus dados, de onde a pessoa veio. Sem isso, quem saía de Meus dados digitava o e-mail que tinha
 * acabado de ler, e a única saída era *Voltar para entrar*, uma tela que não é a dela.
 *
 * Não chama endpoint deste contrato: chama a ação de credencial, que chama o provedor (§4.1).
 */
export default async function TelaDeRedefinirSenha() {
  const sessao = await sessaoSeHouver();
  const saida =
    sessao === null
      ? { href: "/entrar", rotulo: "Voltar para entrar" }
      : { href: "/meus-dados", rotulo: "Voltar para Meus dados" };

  return (
    <MolduraDeConta
      apresentacao
      cartao={<FormularioDeRedefinicao emailInicial={sessao?.email ?? null} />}
      caminhos={
        <Link href={saida.href} className={CLASSE_DO_CAMINHO}>
          {saida.rotulo}
        </Link>
      }
    />
  );
}

/**
 * **`null` é *sem sessão*, e é o caminho normal desta tela.** Com sessão, `email` ainda pode ser `null`
 * quando o provedor não o informou: o campo vem vazio, e a saída continua sendo Meus dados.
 */
async function sessaoSeHouver(): Promise<{ email: string | null } | null> {
  try {
    const { sessao } = await resolverParaTela();
    return { email: sessao.email };
  } catch (erro) {
    if (erro instanceof NaoAutenticado) return null;
    throw erro;
  }
}
