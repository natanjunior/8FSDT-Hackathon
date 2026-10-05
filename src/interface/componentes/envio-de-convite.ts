import { LOTE_DE_ENVIO, type MotivoDeNaoEnvio } from "@/dominio/organizacao";
import { dataCurta, dataEHora } from "@/interface/componentes/datas";

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
  encarregado: "Encarregados não usam o aplicativo",
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
  acrescentarEmail: "Adicionar e-mail",
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

/** O dia de Brasília de um instante, para comparar com o de agora. */
function diaEmBrasilia(iso: string): string {
  return dataCurta(iso);
}

/**
 * `Último convite por e-mail: hoje às 10:00`, ou `… em 28/09 às 10:00`. O dia é o de Brasília: um envio às
 * 23:30 visto às 00:10 do dia seguinte não é de hoje.
 */
export function linhaDoUltimoEnvio(iso: string, agora: Date): string {
  const [data, hora] = dataEHora(iso).split(" · ");
  const quando = diaEmBrasilia(iso) === diaEmBrasilia(agora.toISOString()) ? "hoje" : `em ${(data ?? "").slice(0, 5)}`;
  return `Último convite por e-mail: ${quando} às ${hora ?? ""}`;
}

export function fraseDoImpedimento(impedimento: "sem-email" | "limite-do-dia" | "limite-do-participante"): string {
  if (impedimento === "sem-email") return TEXTOS_DO_ENVIO.semEmail;
  if (impedimento === "limite-do-dia") return TEXTOS_DO_ENVIO.limiteDoDia;
  return TEXTOS_DO_ENVIO.limiteDoParticipante;
}

/** Um botão principal por vez: o e-mail quando pode sair; senão, o *Copiar* continua o principal. */
export function principalDoModal(situacao: { impedimento: string | null }): "email" | "copiar" {
  return situacao.impedimento === null ? "email" : "copiar";
}

/** O que o modal faz com a resposta de um envio de um: saiu, ou falhou (com o motivo, quando há). */
export function desfechoDoEnvioUnico(resposta: { status: number; corpo: unknown }): "saiu" | "falhou" {
  if (resposta.status !== 200) return "falhou";
  const enviados = (resposta.corpo as { enviados?: unknown } | null)?.enviados;
  return Array.isArray(enviados) && enviados.length === 1 ? "saiu" : "falhou";
}

/** A frase do motivo de um envio de um que não saiu; sem resumo, a de falha no envio. */
export function motivoDoEnvioUnico(corpo: unknown): string {
  const naoEnviados = (corpo as { naoEnviados?: Array<{ motivo?: MotivoDeNaoEnvio }> } | null)?.naoEnviados;
  const motivo = Array.isArray(naoEnviados) ? naoEnviados[0]?.motivo : undefined;
  return FRASE_DO_MOTIVO[motivo ?? "falha-no-envio"] ?? FRASE_DO_MOTIVO["falha-no-envio"];
}

export function vaiPara(email: string): string {
  return `Vai para ${email}`;
}

export function reciboDoEnvio(email: string): string {
  return `Convite enviado para ${email}`;
}
