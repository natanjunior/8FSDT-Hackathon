"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { marcarComoNaoLida, registrarLeitura } from "@/aplicacao/ocorrencia";
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
  novoTraceId,
  registrarFalha,
  resolverEscopoParaTela,
} from "@/interface/http";
import {
  criarContaSchema,
  definirSenhaSchema,
  entrarSchema,
  mensagensPorCampo,
  pedirRedefinicaoSchema,
} from "@/interface/schemas";
import { PARAMETRO_DA_SAIDA } from "@/interface/trabalhador/constantes";

/**
 * ============================================================================
 *  As ações de credencial — T-01, T-11, T-12 e T-13
 * ============================================================================
 *
 * **Desde o item 88 há uma ação que não é de credencial:** a primeira abertura de uma ocorrência
 * compartilhada. O bloco dela, no fim do arquivo, explica por que ela não é endereço do contrato.
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

  // A marca de conclusão, e não só a limpeza (item 116): a página re-renderizada nesta mesma resposta lê
  // a marca e manda para a porta de sempre, e não para o aviso de link encerrado.
  armazenamento.concluir();
  return { concluido: true };
}

/**
 * O link "Sair" de T-02 e do shell.
 *
 * **O `?saiu=1` é o sinal para `LimpezaDaSaida`**, em T-01, apagar os caches e trocar o documento
 * (critério 98.3). Sem JavaScript o parâmetro é inofensivo: `/entrar` ignora o que não conhece.
 */
export async function acaoDeSair(): Promise<void> {
  await sair(montarCredenciais(await armazenamentoDeCookies()));
  redirect(`/entrar?${PARAMETRO_DA_SAIDA}=1`);
}

/**
 * ============================================================================
 *  T-05 · a leitura de quem abre — itens 88 e 117
 * ============================================================================
 *
 * **Ela não é endereço do contrato, e a ausência é decisão.** A leitura não é status, não grava
 * histórico, está fora do agregado `Ocorrencia`, e é lida **só por quem a escreveu** — nenhuma tela mostra
 * a outra pessoa se alguém já abriu. Um endereço a mais no `openapi.yaml` descreveria como
 * comando do produto o que é estado de quem lê. `docs/api.md`, em *O que a API não expõe*, registra a
 * ausência.
 *
 * **E ela é o único mecanismo que faz o número cair na volta pelo navegador.** O cache de cliente reusa a
 * entrada de T-03 em toda navegação de voltar, `router.refresh()` só limpa a rota atual, e `revalidatePath`
 * num route handler não alcança a memória do navegador. Numa função de servidor ele alcança. Sem isto, o
 * critério 88.1 passa em teste que volta por link e falha no gesto mais comum do celular.
 *
 * **Não devolve nada, e isso é da §6.3 do contrato.** Chamada com o identificador de uma ocorrência de
 * outra organização, ela não grava — a instrução não acha a linha — e não diz nada, nem que a ocorrência
 * existe.
 *
 * **Falha ao gravar não derrubaria a tela nem se ela pudesse:** a ocorrência já está lida quando isto roda.
 * O número fica um a mais até a próxima abertura, e a falha é registrada no formato de sempre.
 */
export async function acaoDeRegistrarLeitura(ocorrenciaId: string): Promise<void> {
  let escopo;
  try {
    // O Gestor também lê: a leitura não é poder de papel (item 117).
    escopo = await resolverEscopoParaTela("qualquer-vinculo-ativo");
  } catch {
    // Sem sessão não há o que marcar. A tela que a chamou já teria redirecionado.
    return;
  }
  if (escopo.situacao !== "pronto") return;

  try {
    await registrarLeitura(escopo.repos.ocorrencias, ocorrenciaId, {
      pessoaId: escopo.ctx.pessoaId,
    });
  } catch (erro) {
    registrarFalha(erro, `/ocorrencias/${ocorrenciaId}`, "ACAO", novoTraceId());
    return;
  }

  // **O layout da casca, e não `/ocorrencias`** (item 117): o sino mora nele, que não se renderiza de novo
  // na navegação, e só o tipo `layout` o alcança. Numa função de servidor isso atualiza a tela atual e faz
  // toda página visitada se refazer na volta. **O custo, dito:** uma segunda renderização de T-05 no
  // servidor a cada abertura — o preço de o número cair na hora.
  //
  // **E não o da raiz** (item 123): `"/"` expira a etiqueta que toda página pré-renderizada carrega, e a
  // documentação, que não aceita endereço fora da lista, passa a responder 404 até o processo reiniciar.
  revalidatePath("/(casca)", "layout");
}

/**
 * **Marcar como não lida** — item 117. Apaga a leitura de quem pediu; a ocorrência volta a contar e a
 * novidade mostrada é a mesma. Não é endereço do contrato, pela razão da leitura acima. *Marcar como lida*
 * é `acaoDeRegistrarLeitura`: é o mesmo gesto.
 */
export async function acaoDeMarcarComoNaoLida(ocorrenciaId: string): Promise<void> {
  let escopo;
  try {
    escopo = await resolverEscopoParaTela("qualquer-vinculo-ativo");
  } catch {
    return;
  }
  if (escopo.situacao !== "pronto") return;
  try {
    await marcarComoNaoLida(escopo.repos.ocorrencias, ocorrenciaId, { pessoaId: escopo.ctx.pessoaId });
  } catch (erro) {
    registrarFalha(erro, "/", "ACAO", novoTraceId());
    return;
  }
  revalidatePath("/(casca)", "layout");
}
