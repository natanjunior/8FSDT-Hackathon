"use server";

import { redirect } from "next/navigation";

import { criarConta, entrar, sair, type RecusaDeCredencial } from "@/aplicacao/credenciais";
import { montarCredenciais } from "@/composicao";

import { armazenamentoDeCookies } from "@/interface/http";
import { criarContaSchema, entrarSchema } from "@/interface/schemas";

/**
 * ============================================================================
 *  As ações de credencial — T-01 e T-11
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
  /** **DORMENTE** — nenhum e-mail de confirmação é enviado nesta entrega (Q-T9, 22/08/2026). */
  readonly aviso?: "confirme-o-email";
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
  if (!conferido.success) return { erros: porCampo(conferido.error.issues) };

  const resultado = await entrar(
    montarCredenciais(await armazenamentoDeCookies()),
    conferido.data.email,
    conferido.data.senha,
  );

  if (!resultado.ok) return { recusa: resultado.recusa };

  // O destino pretendido volta em `?destino=`, e é o que faz o link profundo sobreviver à autenticação
  // (inventário, §3, decisão 2). Sem ele, o shell resolve o mapa a partir de `GET /contexto`.
  const destino = formulario.get("destino");
  redirect(typeof destino === "string" && destino.startsWith("/") ? destino : "/");
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
  if (!conferido.success) return { erros: porCampo(conferido.error.issues) };

  const resultado = await criarConta(
    montarCredenciais(await armazenamentoDeCookies()),
    conferido.data.nome,
    conferido.data.email,
    conferido.data.senha,
  );

  if (!resultado.ok) return { recusa: resultado.recusa };

  // **DORMENTE.** A Q-T9 foi **fechada** em 22/08/2026: a confirmação de e-mail não é obrigatória, o
  // provedor devolve sessão no `signUp`, e `precisaConfirmarEmail` é sempre `false` — este ramo não é
  // alcançado. T-11 termina no `redirect("/")` abaixo, direto.
  //
  // A tela continua escrita para as duas configurações de propósito: o que decide é o interruptor
  // *Confirm email* do painel do provedor, não o código. O ramo fica pelo dia em que ele virar.
  if ("precisaConfirmarEmail" in resultado && resultado.precisaConfirmarEmail) {
    return { aviso: "confirme-o-email" };
  }

  redirect("/");
}

/** O link "Sair" de T-02 e do shell. */
export async function acaoDeSair(): Promise<void> {
  await sair(montarCredenciais(await armazenamentoDeCookies()));
  redirect("/entrar");
}

function porCampo(
  violacoes: ReadonlyArray<{ path: ReadonlyArray<PropertyKey>; message: string }>,
): Record<string, string> {
  const saida: Record<string, string> = {};
  for (const violacao of violacoes) {
    const campo = violacao.path.map(String).join(".");
    if (saida[campo] === undefined) saida[campo] = violacao.message;
  }
  return saida;
}
