"use server";

import { redirect } from "next/navigation";

import {
  criarConta,
  definirSenha,
  entrar,
  pedirRedefinicaoDeSenha,
  sair,
  type RecusaDeCredencial,
} from "@/aplicacao/credenciais";
import { montarCredenciais } from "@/composicao";

import {
  armazenamentoDeCookies,
  armazenamentoDeRedefinicao,
  destinoDeConfirmacao,
  destinoSeguro,
} from "@/interface/http";
import {
  criarContaSchema,
  definirSenhaSchema,
  entrarSchema,
  mensagensPorCampo,
  pedirRedefinicaoSchema,
} from "@/interface/schemas";

/**
 * ============================================================================
 *  As ações de credencial — T-01, T-11, T-12 e T-13
 * ============================================================================
 *
 * **Não são endpoints deste contrato** (§4.1): são o subdomínio Genérico comprado no provedor. Por isso são
 * *Server Actions* e não `route.ts` — não têm caminho, não entram no `openapi.yaml`, e não devem entrar.
 *
 * **Por que aqui e não no formulário.** O formulário é componente de cliente e não tem como receber a porta
 * por injeção; se ele chamasse o SDK, o SDK estaria no bundle do navegador e a regra de fronteira do
 * ADR-0006 seria falsa. A ação roda no servidor, chama o ponto de composição, e devolve à tela **uma recusa
 * nomeada** — nunca o erro do provedor.
 */

export type EstadoDoFormulario = {
  readonly recusa?: RecusaDeCredencial;
  readonly erros?: Readonly<Record<string, string>>;
  /**
   * **DORMENTE** — em regime nenhum e-mail de confirmação é enviado (Q-T9, 22/08/2026). O que a mantém
   * assim é o interruptor do painel; o destino do link existe desde o item 6c.
   */
  readonly aviso?: "confirme-o-email";
  /** T-12: o pedido foi aceito. **Não diz se a conta existe** — nem poderia (critério 1). */
  readonly enviado?: boolean;
  /**
   * T-11 e T-13: a escrita terminou. **Quem navega é a tela**, porque o aviso de sucesso só sai do
   * navegador, e um `redirect()` aqui encerraria a ação antes de a tela saber que deu certo (item 44g).
   */
  readonly concluido?: true;
};

/** T-01 · Entrar. Ao final, navegação para o shell, que faz `GET /contexto` (inventário, T-01). */
export async function acaoDeEntrar(
  _anterior: EstadoDoFormulario,
  formulario: FormData,
): Promise<EstadoDoFormulario> {
  const conferido = entrarSchema.safeParse({
    email: formulario.get("email"),
    senha: formulario.get("senha"),
  });
  if (!conferido.success) return { erros: mensagensPorCampo(conferido.error.issues) };

  const resultado = await entrar(
    montarCredenciais(await armazenamentoDeCookies()),
    conferido.data.email,
    conferido.data.senha,
  );

  if (!resultado.ok) return { recusa: resultado.recusa };

  // O destino pretendido volta em `?destino=`, e é o que faz o link profundo sobreviver à autenticação
  // (inventário, §3, decisão 2). Sem ele, o shell resolve o mapa a partir de `GET /contexto`.
  const destino = destinoSeguro(formulario.get("destino"));
  redirect(destino ?? "/");
}

/** T-11 · Criar conta. O `nome` é obrigatório: é o metadado de onde o ACL semeia `pessoas.nome` (§4.1). */
export async function acaoDeCriarConta(
  _anterior: EstadoDoFormulario,
  formulario: FormData,
): Promise<EstadoDoFormulario> {
  const conferido = criarContaSchema.safeParse({
    nome: formulario.get("nome"),
    email: formulario.get("email"),
    senha: formulario.get("senha"),
  });
  if (!conferido.success) return { erros: mensagensPorCampo(conferido.error.issues) };

  // **Antes de qualquer ida ao provedor.** Se a origem não der para descobrir, isto lança aqui — e não
  // depois de a conta existir com um link que aterrissa na raiz (item 6c).
  const destino = await destinoDeConfirmacao();

  const resultado = await criarConta(
    montarCredenciais(await armazenamentoDeCookies()),
    conferido.data.nome,
    conferido.data.email,
    conferido.data.senha,
    destino,
  );

  if (!resultado.ok) return { recusa: resultado.recusa };

  // **DORMENTE.** A Q-T9 foi **fechada** em 22/08/2026: em regime a confirmação de e-mail não é
  // obrigatória, o provedor devolve sessão no `signUp`, e `precisaConfirmarEmail` é `false` — este ramo
  // não é alcançado, e T-11 termina devolvendo `concluido`, e a tela segue para `/`.
  //
  // **O que decide é o interruptor *Confirm email* do painel do provedor, não o código** — e desde o item
  // 6c o link que ele passaria a enviar já aponta para `/confirmar-conta`, montado a partir da origem
  // deste pedido. O ramo fica pelo dia em que o interruptor virar — e a validação daquele item **abre uma
  // janela de minutos para exatamente isso**. Quem a abre é o humano; nada aqui afirma que ela já foi
  // aberta.
  if ("precisaConfirmarEmail" in resultado && resultado.precisaConfirmarEmail) {
    return { aviso: "confirme-o-email" };
  }

  return { concluido: true };
}

/**
 * T-12 · pedir o link de redefinição.
 *
 * **A resposta é a mesma exista ou não a conta** (critério 1). O ACL já garante isso; aqui a garantia
 * aparece na forma da função: não há ramo que dependa da existência.
 */
export async function acaoDePedirRedefinicao(
  _anterior: EstadoDoFormulario,
  formulario: FormData,
): Promise<EstadoDoFormulario> {
  const conferido = pedirRedefinicaoSchema.safeParse({ email: formulario.get("email") });
  if (!conferido.success) return { erros: mensagensPorCampo(conferido.error.issues) };

  const resultado = await pedirRedefinicaoDeSenha(
    montarCredenciais(await armazenamentoDeCookies()),
    conferido.data.email,
  );

  if (!resultado.ok) return { recusa: resultado.recusa };
  return { enviado: true };
}

/**
 * T-13 · gravar a senha nova. A tela dá o aviso e segue para T-01.
 *
 * **`limpar()` antes de devolver**, como antes era antes do redirecionamento: sem o cookie de recuperação,
 * `/definir-senha` manda para T-01 sozinha, e é isso que faz o botão voltar não reencontrar o formulário
 * (critério 6b.4). **O link vencido continua sendo `redirect`**: é troca de face, não sucesso.
 */
export async function acaoDeDefinirSenha(
  _anterior: EstadoDoFormulario,
  formulario: FormData,
): Promise<EstadoDoFormulario> {
  const conferido = definirSenhaSchema.safeParse({ senha: formulario.get("senha") });
  if (!conferido.success) return { erros: mensagensPorCampo(conferido.error.issues) };

  const armazenamento = await armazenamentoDeRedefinicao();
  const resultado = await definirSenha(montarCredenciais(armazenamento), conferido.data.senha);

  if (!resultado.ok) {
    // A sessão de recuperação sumiu no meio do caminho. A face de link vencido é a que tem os dois
    // caminhos de saída, e ela já existe — mandar para lá é melhor que uma frase sem saída aqui.
    if (resultado.recusa === "LINK_INVALIDO_OU_EXPIRADO") {
      armazenamento.limpar();
      redirect("/definir-senha?estado=expirado");
    }
    return { recusa: resultado.recusa };
  }

  armazenamento.limpar();
  return { concluido: true };
}

/** O link "Sair" de T-02 e do shell. */
export async function acaoDeSair(): Promise<void> {
  await sair(montarCredenciais(await armazenamentoDeCookies()));
  redirect("/entrar");
}
