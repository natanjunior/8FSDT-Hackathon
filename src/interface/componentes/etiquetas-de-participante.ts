import { filtrarPeloNome } from "@/interface/componentes/linhas-de-participantes";

/**
 * ============================================================================
 *  As etiquetas dos participantes, decididas fora do desenho — item 115
 * ============================================================================
 *
 * **O produto não tem teste de componente React**, e o que decide a tela mora aqui para ter teste. É o
 * precedente de `linhas-de-participantes.ts` e de `frases-da-remocao.ts`.
 *
 * **Duas regras de comparação, e cada uma tem o seu lugar.** Sugerir usa a busca do projeto
 * (`filtrarPeloNome`, item 44l), que ignora acento: quem digita *"ele"* quer ver *Elétrica*. Decidir se é
 * a MESMA etiqueta usa a regra do banco — apara e desce caixa, acento conta —, senão a tela ofereceria
 * *Criar* para o que o banco ia reaproveitar.
 */

export const LIMITE_DO_NOME = 30;
export const VISIVEIS_NA_LINHA = 2;
export const TEXTO_DO_LIMITE = "Até 30 caracteres.";

export type EtiquetaNaTela = { readonly id: string; readonly nome: string };

/** A identidade do índice `etiquetas_participante_nome_uq`, do lado de cá. */
export function chaveDoNome(nome: string): string {
  return nome.trim().toLocaleLowerCase("pt-BR");
}

/** **Duas, e o resto vira +N** (critério 10), na tela grande e no celular: uma regra só. */
export function cortarParaALinha(etiquetas: readonly EtiquetaNaTela[]): {
  visiveis: readonly EtiquetaNaTela[];
  restantes: readonly EtiquetaNaTela[];
} {
  return { visiveis: etiquetas.slice(0, VISIVEIS_NA_LINHA), restantes: etiquetas.slice(VISIVEIS_NA_LINHA) };
}

/** O nome acessível do *"+N"*: quem usa leitor de tela ouve quais ficaram de fora. */
export function nomeDoRestante(restantes: readonly EtiquetaNaTela[]): string {
  return `mais ${String(restantes.length)}: ${restantes.map((etiqueta) => etiqueta.nome).join(", ")}`;
}

export function sugestoes(
  todas: readonly EtiquetaNaTela[],
  daPessoa: readonly EtiquetaNaTela[],
  texto: string,
): readonly EtiquetaNaTela[] {
  const jaTem = new Set(daPessoa.map((etiqueta) => etiqueta.id));
  return filtrarPeloNome(
    todas.filter((etiqueta) => !jaTem.has(etiqueta.id)),
    texto,
  );
}

/** O que a opção *Criar* criaria, ou `null` quando não há o que criar. */
export function nomeParaCriar(todas: readonly EtiquetaNaTela[], texto: string): string | null {
  const nome = texto.trim();
  if (nome.length === 0 || nome.length > LIMITE_DO_NOME) return null;
  const chave = chaveDoNome(nome);
  return todas.some((etiqueta) => chaveDoNome(etiqueta.nome) === chave) ? null : nome;
}

/**
 * **Cada gesto da seleção múltipla é uma escrita só** (item 120). A peça devolve a lista inteira; aqui se
 * acha o que mudou. O valor que entra é o `id` de uma etiqueta existente, ou o texto aparado de uma nova
 * — a peça põe o texto do *Criar* na lista. A ordem não conta.
 */
export function diferencaDaEscolha(
  antes: readonly string[],
  depois: readonly string[],
): { tipo: "entrou"; valor: string } | { tipo: "saiu"; valor: string } | null {
  const entrou = depois.find((valor) => !antes.includes(valor));
  if (entrou !== undefined) return { tipo: "entrou", valor: entrou };
  const saiu = antes.find((valor) => !depois.includes(valor));
  if (saiu !== undefined) return { tipo: "saiu", valor: saiu };
  return null;
}

/**
 * **Quantas pessoas têm cada etiqueta, contado sobre os vínculos que a tela já tem** (critério 7). São os
 * ativos, e vínculo revogado não guarda etiqueta (o `revogar` as apaga), então o número é o do banco.
 * Etiqueta sem uso não aparece no mapa: ausente é zero.
 */
export function usoPorEtiqueta(
  vinculos: ReadonlyArray<{ readonly etiquetas: readonly EtiquetaNaTela[] }>,
): Readonly<Record<string, number>> {
  const uso: Record<string, number> = {};
  for (const vinculo of vinculos) {
    for (const etiqueta of vinculo.etiquetas) uso[etiqueta.id] = (uso[etiqueta.id] ?? 0) + 1;
  }
  return uso;
}

export function tituloDoApagar(nome: string): string {
  return `Apagar “${nome}”?`;
}

export function textoDoApagar(quantas: number): string {
  if (quantas === 0) return "Não está em ninguém.";
  if (quantas === 1) return "Está em 1 pessoa e sai dela.";
  return `Está em ${String(quantas)} pessoas e sai de todas.`;
}

/** **A palavra, nunca só o número** (compromisso A-5): a contagem ao lado de cada etiqueta (item 120). */
export function contagemDeParticipantes(quantos: number): string {
  if (quantos === 0) return "Nenhum participante";
  return quantos === 1 ? "1 participante" : `${String(quantos)} participantes`;
}

/** O recibo do modal *Nova etiqueta*: o banco reaproveita a grafia igual, e a frase diz que reaproveitou. */
export function reciboDaCriacao(nome: string, criada: boolean): string {
  return criada ? `${nome} criada` : `${nome} já existia`;
}

/** A busca do cartão da configuração é a do projeto, a mesma de sugerir: ignora acento (item 44l). */
export function filtrarEtiquetas(
  etiquetas: readonly EtiquetaNaTela[],
  texto: string,
): readonly EtiquetaNaTela[] {
  return filtrarPeloNome(etiquetas, texto);
}
