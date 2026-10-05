import { cabecalhosDeEscrita } from "@/interface/componentes/afirmacao-de-organizacao";
import { MENSAGEM_SEM_CONEXAO, mensagemDoProblema } from "@/interface/componentes/retorno-de-acao";

/**
 * ============================================================================
 *  A chamada de comando de T-05 — um `fetch`, a frase do `409`, um lugar
 * ============================================================================
 *
 * **Módulo sem componente**, e é o ponto: a barra fazia isto dentro dela, e a partir do item 19 há um
 * segundo chamador — o modal de atribuição. Duas construções da **mesma** frase do `409` seriam a segunda
 * cópia de sempre.
 *
 * **Nenhum tipo do Domínio entra aqui.** `comando` é `string`, e o mapa de rótulos chega **pronto**, por
 * parâmetro: importar `rotulosDeStatus` arrastaria `@/interface/projecoes` e, com ele,
 * `comandosDisponiveis` — a máquina de estados inteira para dentro do pacote do navegador, que é
 * literalmente a segunda cópia que `acoesDisponiveis` existe para impedir.
 *
 * **Sem `"use client"`, e não é esquecimento:** quem tem estado é quem chama. Este arquivo não usa hook
 * nenhum, e a diretiva mora no componente.
 */

export type ResultadoDoComando = { ok: true } | { ok: false; aviso: string };

/**
 * Chama `POST /api/ocorrencias/{id}/{comando}` e traduz a resposta em **uma frase ou nada**.
 *
 * **A frase do `409` é a do inventário**, montada com o `statusAtual` que o contrato pôs no corpo do erro
 * exatamente para isto: *"Esta ocorrência mudou enquanto você estava olhando. Agora: …"*. É o caso
 * das duas pessoas triando ao mesmo tempo.
 *
 * **Quem repinta a tela é quem chama**, e não esta função — os dois chamadores repintam em momentos
 * diferentes, e embutir o `router.refresh()` aqui tiraria essa escolha deles.
 */
export async function executarComando(
  ocorrenciaId: string,
  comando: string,
  corpo: unknown,
  rotulosDeStatus: Readonly<Record<string, string>>,
  /**
   * A organização **com que a página renderizou** — a afirmação da §4.3, e é aqui que ela cobre os
   * **dez** comandos de uma vez. Nunca lida do cookie: a outra aba já o reescreveu.
   */
  organizacaoId: string,
): Promise<ResultadoDoComando> {
  try {
    const resposta = await fetch(`/api/ocorrencias/${ocorrenciaId}/${comando}`, {
      method: "POST",
      headers: cabecalhosDeEscrita(organizacaoId),
      body: JSON.stringify(corpo),
    });

    if (resposta.ok) return { ok: true };

    const problema = (await resposta.json().catch(() => null)) as unknown;
    return { ok: false, aviso: mensagemDoProblema(problema, frasesDoComando(problema, rotulosDeStatus)) };
  } catch {
    // `fetch` rejeitou antes de haver resposta — rede caiu. Sem este `catch` a rejeição aciona o Error
    // Boundary em vez de mostrar a linha de aviso. Nuvem sem SLA: rede instável é o caso esperado.
    return { ok: false, aviso: MENSAGEM_SEM_CONEXAO };
  }
}

/** A frase de quem perdeu o acesso à organização no meio do caminho, nos comandos e na conversa. */
const SEM_ACESSO_A_ORGANIZACAO = "Você não tem mais acesso a esta organização.";

/**
 * As frases da tela que não dependem de `statusAtual`, e por isso valem mesmo quando o corpo não o traz.
 * O `detail` publicado de cada código não muda: a troca é só na tela.
 */
const FRASES_FIXAS_DO_COMANDO: Readonly<Record<string, string>> = {
  SOMENTE_O_GESTOR_CANCELA_NESTE_ESTADO:
    "Agora só os Gestores podem cancelar. Peça o cancelamento nas mensagens.",
  SEM_VINCULO_NA_ORGANIZACAO: SEM_ACESSO_A_ORGANIZACAO,
  RESPONSAVEL_SEM_VINCULO_ATIVO: "Esta pessoa não participa mais desta organização. Escolha outra.",
  OCORRENCIA_NAO_ENCONTRADA: "Esta ocorrência não está mais disponível para você.",
};

/**
 * **A frase do `409` é a do inventário**, montada com o `statusAtual` que o contrato pôs no corpo do erro
 * para isto: *"Esta ocorrência mudou enquanto você estava olhando. Agora: …"*. O rótulo fica fora da
 * oração, porque o do Solicitante é livre e não concorda com frase nenhuma. Ela é a frase da tela para
 * `TRANSICAO_NAO_PERMITIDA` e para `PRIORIDADE_IMUTAVEL_EM_ESTADO_TERMINAL`, que é a mesma corrida vista
 * pelo seletor de prioridade. Sem `statusAtual`, valem só as frases fixas e, para o `409`, o `detail`.
 */
function frasesDoComando(
  problema: unknown,
  rotulosDeStatus: Readonly<Record<string, string>>,
): Readonly<Record<string, string>> {
  if (typeof problema !== "object" || problema === null) return FRASES_FIXAS_DO_COMANDO;
  const { statusAtual } = problema as { statusAtual?: unknown };
  if (typeof statusAtual !== "string") return FRASES_FIXAS_DO_COMANDO;
  const rotulo = rotulosDeStatus[statusAtual] ?? statusAtual;
  const mudou = `Esta ocorrência mudou enquanto você estava olhando. Agora: ${rotulo}.`;
  return {
    ...FRASES_FIXAS_DO_COMANDO,
    TRANSICAO_NAO_PERMITIDA: mudou,
    PRIORIDADE_IMUTAVEL_EM_ESTADO_TERMINAL: mudou,
  };
}

/** O que o `201` traz — o schema `Comentario` do contrato, projetado. */
export type ComentarioDoEnvio = {
  id: string;
  texto: string;
  autor: { pessoaId: string; nome: string };
  criadoEm: string;
};

export type ResultadoDoEnvio =
  | { ok: true; comentario: ComentarioDoEnvio }
  | { ok: false; aviso: string };

/**
 * `POST /api/ocorrencias/{id}/comentarios` — **a irmã de `executarComando`, e não o décimo primeiro
 * comando.**
 *
 * **Compartilha o corpo do `fetch`**: `cabecalhosDeEscrita(organizacaoId)` — a afirmação de organização
 * do item 7b —, o `detail` do problema como aviso, a frase genérica e a de conexão no `catch` de rede caída.
 *
 * **O que ela NÃO tem é o ramo do `409 TRANSICAO_NAO_PERMITIDA`**, e por isso não recebe
 * `rotulosDeStatus`: comentar não é comando, e o contrato **não publica** aquele erro neste endpoint.
 * Comenta-se nos seis estados.
 *
 * **Devolve o comentário inteiro no sucesso**, ao contrário de `executarComando`, que devolve `{ok:true}`
 * e deixa o repinte trazer o resto. Aqui o repinte **não bastaria**: a primeira página da conversa é a
 * **mais antiga**, então numa conversa de 25 mensagens a recém-escrita não estaria nela. O `201` traz o
 * objeto inteiro — critério 30.1 —, e é ele que a lista local acrescenta.
 *
 * *Recusado — passar `"comentarios"` no parâmetro `comando` de `executarComando`:* a URL bateria, e a
 * função passaria a chamar de comando o que `Comando.ts` declara, em noventa linhas, que não é um.
 * *Recusado — um módulo novo com o segundo `fetch`:* é a segunda cópia do tratamento de erro.
 */
export async function enviarComentario(
  ocorrenciaId: string,
  texto: string,
  organizacaoId: string,
): Promise<ResultadoDoEnvio> {
  try {
    const resposta = await fetch(`/api/ocorrencias/${ocorrenciaId}/comentarios`, {
      method: "POST",
      headers: cabecalhosDeEscrita(organizacaoId),
      body: JSON.stringify({ texto }),
    });

    if (resposta.ok) {
      return { ok: true, comentario: (await resposta.json()) as ComentarioDoEnvio };
    }

    const problema = (await resposta.json().catch(() => null)) as unknown;
    return {
      ok: false,
      aviso: mensagemDoProblema(problema, { SEM_VINCULO_NA_ORGANIZACAO: SEM_ACESSO_A_ORGANIZACAO }),
    };
  } catch {
    // `fetch` rejeitou antes de haver resposta — rede caiu. Sem este `catch` a rejeição aciona o Error
    // Boundary em vez de mostrar a linha de aviso. Nuvem sem SLA: rede instável é o caso esperado.
    return { ok: false, aviso: MENSAGEM_SEM_CONEXAO };
  }
}
