import { toast } from "sonner";

/**
 * ============================================================================
 *  O retorno de ação — as três formas do aviso e a frase genérica, num lugar só
 * ============================================================================
 *
 * **A regra é do guia §7, decidida em 16/09/2026:** todo salvamento que a pessoa pediu responde com um
 * aviso de sucesso, de erro ou de atenção, e o de atenção fica até ser fechado. O aviso mora no layout
 * raiz (`app/layout.tsx`) e sobrevive ao modal que o disparou e à atualização da página.
 *
 * **Nenhum componente chama o pacote direto.** A forma do aviso (duração, ícone, fechar) é decidida uma
 * vez, e é este módulo que as telas importam. É a mesma razão que pôs `executarComando` num módulo.
 *
 * **O título diz o que foi tentado; a mensagem diz por que falhou.** O aviso de erro leva o verbo da ação
 * (*"Não foi possível aprovar o pedido"*) e nenhuma descrição; a razão fica dentro do modal ou do
 * formulário, onde a pessoa decide o que fazer (prancheta *"T-08 · erro do servidor: no modal e em
 * toast"*).
 *
 * **Sem `"use client"`:** este arquivo não usa gancho. Quem chama é componente de cliente.
 */

/** A frase de quando não há frase melhor. **Existe uma vez só no produto** (critério 44g.6). */
export const MENSAGEM_GENERICA = "Não foi possível realizar a ação.";

/** Os dois títulos de aviso de uma ação: o do sucesso e o da falha. */
export type TextosDoRetorno = { readonly sucesso: string; readonly falha: string };

/** O aviso de uma escrita que deu certo. A forma `atencao` é a que fica até ser fechada. */
export type AvisoDeConclusao = {
  readonly forma?: "sucesso" | "atencao";
  readonly titulo: string;
  readonly descricao?: string;
};

/** As frases que uma tela escreveu para códigos que ela conhece (inventário de telas, §7). */
export type FrasesDaTela = Readonly<Record<string, string>>;

/**
 * A mensagem que vai para dentro do modal ou do formulário, a partir do corpo de um `problem+json`.
 *
 * Em ordem: (1) a frase da própria tela para aquele `codigo`; (2) o `detail` do servidor, quando a
 * resposta tem `codigo` **e** `detail`; (3) `MENSAGEM_GENERICA` em todo o resto: sem `codigo`,
 * `ERRO_INTERNO` (que vem sem `detail`, `problema.ts`), corpo que não é JSON.
 *
 * **Recebe `unknown`**, porque é o que `resposta.json()` devolve de verdade: quem chama não precisa
 * afirmar a forma do corpo antes de saber se ele tem forma.
 */
export function mensagemDoProblema(corpo: unknown, frasesDaTela: FrasesDaTela = {}): string {
  if (typeof corpo !== "object" || corpo === null) return MENSAGEM_GENERICA;

  const { codigo, detail } = corpo as { codigo?: unknown; detail?: unknown };
  if (typeof codigo !== "string" || codigo === "") return MENSAGEM_GENERICA;

  const daTela = frasesDaTela[codigo];
  if (daTela !== undefined) return daTela;

  if (typeof detail === "string" && detail.trim() !== "") return detail;
  return MENSAGEM_GENERICA;
}

function descricaoOpcional(descricao: string | undefined): { description?: string } {
  return descricao === undefined ? {} : { description: descricao };
}

export function avisarSucesso(titulo: string, descricao?: string): void {
  toast.success(titulo, descricaoOpcional(descricao));
}

export function avisarErro(titulo: string, descricao?: string): void {
  toast.error(titulo, descricaoOpcional(descricao));
}

/** **Fica até ser fechado**: o pacote não arma temporizador quando a duração é infinita. */
export function avisarAtencao(titulo: string, descricao?: string): void {
  toast.warning(titulo, { ...descricaoOpcional(descricao), duration: Number.POSITIVE_INFINITY });
}

export function avisarConclusao(aviso: AvisoDeConclusao): void {
  if (aviso.forma === "atencao") {
    avisarAtencao(aviso.titulo, aviso.descricao);
    return;
  }
  avisarSucesso(aviso.titulo, aviso.descricao);
}
