import { dataCurta } from "@/interface/componentes/datas";

/**
 * ============================================================================
 *  O convite pessoal — os textos e as decisões puras (item 121)
 * ============================================================================
 *
 * **Os textos de tela num lugar só**, e as decisões que o modal, o detalhe e a página tomam, como funções
 * puras que o teste de interface prende sem montar componente.
 *
 * **Nenhuma frase marca gênero.** O produto não sabe o gênero de quem o Gestor cadastrou, e o nome não diz:
 * *"o Jardim convida você"*, e não *"você foi convidada"*.
 */
export const TEXTOS_DO_CONVITE_PESSOAL = {
  botao: "Convidar",
  semConviteEncarregado: "Encarregados não usam o aplicativo.",
  semConviteComConta: "Já usa o aplicativo.",
  copiar: "Copiar",
  copiado: "Copiado",
  compartilhar: "Compartilhar",
  gerarNovo: "Gerar novo link",
  confirmarTitulo: "Gerar novo link?",
  confirmarCorpo: "O link atual deixa de funcionar, inclusive onde já foi enviado.",
  confirmar: "Gerar",
  gerando: "Gerando…",
  cancelar: "Cancelar",
  recibo: "Link novo gerado",
  falhaAoGerar: "Não foi possível gerar o link",
  rotuloDoLink: "Link do convite",
  naoVale: "Este convite não vale mais.",
  naoValeContexto: "Peça um link novo a quem enviou.",
  entrar: "Entrar",
  entrando: "Entrando…",
  jaTenhoConta: "Já tem conta?",
  falha: "Não foi possível concluir o convite. Tente de novo.",
} as const;

export function tituloDoModal(nome: string): string {
  return `Convidar ${nome}`;
}

/** O que o Gestor precisa saber antes de mandar o link a alguém. */
export function explicacaoDoModal(organizacao: string, papel: string): string {
  return `Quem abrir este link entra no ${organizacao} como ${papel}, sem precisar de aprovação.`;
}

/** `Gerado em dd/mm por {nome}`: o rastro que o Gestor tem de que o link mudou. */
export function rodapeDoModal(criadoEm: string, criadoPor: string): string {
  return `Gerado em ${dataCurta(criadoEm).slice(0, 5)} por ${criadoPor}`;
}

export function convitePelaFace(organizacao: string, papel: string): string {
  return `${organizacao} convida você para participar como ${papel}.`;
}

export function perguntaDoAceite(organizacao: string, papel: string): string {
  return `Entrar no ${organizacao} como ${papel}?`;
}

export function jaParticipa(organizacao: string): string {
  return `Você já participa do ${organizacao}.`;
}

/** A conta em uso, antes de confirmar: o link pode ter sido aberto no celular de outra pessoa da família. */
export function contaEmUso(nome: string): string {
  return `Você está como ${nome}.`;
}

/** O que o detalhe mostra no lugar do convite: o botão, ou a frase. */
export function conviteNoDetalhe(v: { papel: string; temConta: boolean }): "botao" | "encarregado" | "com-conta" {
  if (v.papel === "encarregado") return "encarregado";
  if (v.temConta) return "com-conta";
  return "botao";
}

/**
 * O que o botão *Entrar* faz com a resposta do aceite. `2xx` segue; `404` e `409` refazem a página, que
 * mostra *não vale* ou *já participa*; o resto, inclusive a rede (`0`), é a frase de falha (critério 4).
 */
export function desfechoDoAceite(status: number): "ir" | "refazer" | "falha" {
  if (status >= 200 && status < 300) return "ir";
  if (status === 404 || status === 409) return "refazer";
  return "falha";
}
