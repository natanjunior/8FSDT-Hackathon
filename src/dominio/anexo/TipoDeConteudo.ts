/**
 * O que pode ser anexado a uma ocorrência, e que tipo de coisa isso é.
 *
 * **Dois tipos, e nada mais** — é o escopo da primeira entrega (RNF8, e a capacidade *"anexar uma
 * imagem"*). O caminho do endpoint fala em *anexo* porque o conceito do domínio é **evidência**, e imagem
 * é um tipo dela; o dia em que outro entrar, o que muda é esta lista.
 *
 * **O cliente nunca envia o tipo do anexo.** O `tipo` da linha em `anexos` é **derivado** aqui, pelo
 * servidor, no ato de reivindicar (item 13b). É o que mantém o enum `tipo_anexo` fora de todo schema de
 * entrada — e é o que torna acrescentar um tipo novo uma mudança aditiva (contrato §11).
 */
export const TIPOS_DE_CONTEUDO_DE_ANEXO = ["image/jpeg", "image/png"] as const;

export type TipoDeConteudoDeAnexo = (typeof TIPOS_DE_CONTEUDO_DE_ANEXO)[number];

export function ehTipoDeConteudoDeAnexo(valor: unknown): valor is TipoDeConteudoDeAnexo {
  return typeof valor === "string" && (TIPOS_DE_CONTEUDO_DE_ANEXO as readonly string[]).includes(valor);
}

/** O enum `tipo_anexo` do banco (modelo §5). **Um valor, deliberadamente** — §7.8 do modelo. */
export const TIPOS_DE_ANEXO = ["imagem"] as const;

export type TipoDeAnexo = (typeof TIPOS_DE_ANEXO)[number];

/**
 * A derivação: do fato técnico (`image/jpeg`) para o conceito de domínio (`imagem`).
 *
 * Hoje ela é total — os dois tipos aceitos são imagem. Ela existe assim mesmo porque **é o lugar onde a
 * regra mora**: quando `application/pdf` entrar, muda esta função e mais nada.
 *
 * **Um mapa, e não um `return "imagem"` que ignora o argumento.** O `Record` sobre a união obriga o
 * `tsc` a exigir uma entrada para cada tipo aceito: acrescentar `application/pdf` à lista acima **quebra
 * a compilação aqui** até alguém dizer em que conceito ele cai. Um corpo constante aceitaria o tipo novo
 * em silêncio, derivando `imagem` para um PDF.
 */
const TIPO_POR_CONTEUDO: Readonly<Record<TipoDeConteudoDeAnexo, TipoDeAnexo>> = {
  "image/jpeg": "imagem",
  "image/png": "imagem",
};

export function tipoDeAnexo(tipoConteudo: TipoDeConteudoDeAnexo): TipoDeAnexo {
  return TIPO_POR_CONTEUDO[tipoConteudo];
}
