import { LOTE_DE_ENVIO, type MotivoDeNaoEnvio } from "@/dominio/organizacao";

/**
 * ============================================================================
 *  O convite por e-mail — os textos e as decisões puras (item 122)
 * ============================================================================
 *
 * As frases da tela num lugar só, e as decisões que a lista, o diálogo de lote e o modal tomam, como
 * funções puras que o teste de interface prende sem montar componente. Sem código de erro na tela.
 */

/** As sete frases dos motivos, sem ponto final: são itens de lista no resumo. */
export const FRASE_DO_MOTIVO: Readonly<Record<MotivoDeNaoEnvio, string>> = {
  "vinculo-revogado": "Não participa mais",
  "sem-email": "Sem e-mail cadastrado",
  "ja-tem-conta": "Já usa o aplicativo",
  encarregado: "Encarregados não recebem convite",
  "limite-do-dia": "Este endereço já recebeu convite hoje",
  "limite-do-participante": "Já recebeu os 10 convites por e-mail",
  "falha-no-envio": "O e-mail não pôde ser enviado. Tente de novo mais tarde",
};

export const TEXTOS_DO_ENVIO = {
  limpar: "Limpar",
  enviar: "Enviar",
  enviando: "Enviando…",
  voltar: "Voltar",
  fechar: "Fechar",
  enviarPorEmail: "Enviar convite por e-mail",
  acrescentarEmail: "Acrescentar e-mail",
  falhaInteira:
    "Não foi possível concluir o envio. Parte dos convites pode ter saído: abra o convite de cada pessoa para ver o último envio.",
  limiteDoDia: "Este endereço já recebeu convite hoje. O próximo pode sair amanhã.",
  limiteDoParticipante: "Já recebeu os 10 convites por e-mail.",
  semEmail: "Sem e-mail cadastrado.",
} as const;

export function faixaDaSelecao(n: number): string {
  return n === 1 ? "1 selecionado" : `${String(n)} selecionados`;
}

export function rotuloDoBotaoEmMassa(n: number): string {
  return `Convidar por e-mail (${String(n)})`;
}

export function perguntaDoLote(n: number): string {
  return n === 1
    ? "Enviar convite por e-mail para 1 participante?"
    : `Enviar convite por e-mail para ${String(n)} participantes?`;
}

/** Acima do lote, a frase que pede para desmarcar; dentro dele, `null`. Não cortamos a seleção sozinhos. */
export function excessoDoLote(n: number): string | null {
  if (n <= LOTE_DE_ENVIO) return null;
  return `Envie até ${String(LOTE_DE_ENVIO)} por vez. Desmarque ${String(n - LOTE_DE_ENVIO)} para continuar.`;
}

export function tituloDosEnviados(n: number): string {
  return `Enviados (${String(n)})`;
}

export function tituloDosNaoEnviados(n: number): string {
  return `Não enviados (${String(n)})`;
}

/** O que o diálogo de lote faz com a resposta: o resumo, ou a falha inteira (rede, servidor, tempo). */
export function desfechoDoLote(status: number): "resumo" | "falha-inteira" {
  return status === 200 ? "resumo" : "falha-inteira";
}
