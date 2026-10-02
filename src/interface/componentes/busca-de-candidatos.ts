import type { VinculoLido } from "@/aplicacao/organizacao";
import type { EtiquetaNaTela } from "@/interface/componentes/etiquetas-de-participante";

/**
 * ============================================================================
 *  A busca do modal de atribuição — a metade conferível do item 20
 * ============================================================================
 *
 * **Por que isto não é um `?:` dentro do JSX.** O produto não tem biblioteca de teste de componente React
 * — `jsdom` está instalado, mas não há `@testing-library`, e o `vitest.config.mts` roda as quatro pastas
 * de camada com `environment: "node"`. Então o que fica dentro do `.tsx` **não tem teste nenhum**, e a
 * fatia inteira dependeria de conferência manual. É o precedente exato do `vazio-da-lista.ts`: *"uma
 * decisão … mora numa função com teste"*.
 *
 * **Nenhum `import` de valor, e é de propósito.** O arquivo não conhece React, não conhece `next` e não
 * conhece o Domínio. Os dois `import type` do item 115 o compilador apaga. Isso o torna o arquivo mais barato de conferir do repositório e o único que o item 10 pode
 * reusar sem arrastar um `"use client"` junto (critério 10.6).
 *
 * ---------------------------------------------------------------------------
 *  A ordem de composição, que é decisão e não detalhe
 * ---------------------------------------------------------------------------
 *
 * **`repartirCandidatos` PRIMEIRO, `filtrarPorNome` depois, em cada bloco.** Invertê-las apaga a fileira
 * *"Atribuir a mim"* sempre que o texto digitado não casar o nome de quem está olhando — e a §3.7 da spec
 * decide o contrário em uma frase: *"se a busca escondesse a linha, o caso que o 20.5 existe para
 * dispensar da busca voltaria a depender dela"*.
 *
 * ---------------------------------------------------------------------------
 *  O que a busca casa
 * ---------------------------------------------------------------------------
 *
 * **Prefixo de palavra, sem acento e sem caixa. Só o `nome`.**
 *
 * - **Prefixo, e não pedaço** — é o que a §3 do protótipo já decidiu (`prototipo-low-fi.md:293`). Pedaço
 *   faria `"ana"` achar *Mariana*.
 * - **De palavra, e não do nome inteiro** — sobrenome é como se procura gente: `"silva"` tem de achar
 *   *Maria Silva*. É a adaptação ao campo; o protótipo falava de nomes de **Área**, que se procuram pelo
 *   começo.
 * - **Sem acento e sem caixa**, porque quem digita no celular não põe acento e o produto não pode punir
 *   isso.
 * - **`nome` e nada mais.** Não casa papel nem área: o critério 20.6 diz *"filtra a lista pelo nome"*, e
 *   casar a área faria `"garagem"` devolver meia organização sem que ninguém tenha pedido.
 */

/**
 * A projeção estreita que desce para o navegador — **`contatos[]` não vem junto**, porque é dado pessoal
 * sob o RNF10 e a razão de `GET /vinculos` exigir `vinculo.gerir`.
 *
 * **Mora aqui, e não no `modal-de-atribuicao.tsx`, desde o item 20:** o módulo puro precisa do tipo, e
 * importá-lo de um `"use client"` fecharia um ciclo entre os dois arquivos.
 */
export type Candidato = {
  pessoaId: string;
  nome: string;
  /** Em palavra, montado no servidor — o navegador não monta rótulo (A-5). */
  papel: string;
  /** A unidade, quando houver. É o que desempata homônimos. */
  area: string | null;
  /**
   * As etiquetas do participante (item 115), em ordem alfabética. Ao lado do nome, **sem filtro** (decisão 2
   * do dono): a busca do modal continua casando só o nome.
   */
  etiquetas: readonly EtiquetaNaTela[];
};

/**
 * **O candidato sai do `VinculoLido` da lista, e só dele** (critério 115.4): a escolha do responsável
 * recebe as etiquetas da mesma `lerVinculos` que a lista e o detalhe. A palavra do papel chega pronta,
 * porque quem a produz é a página (`PAPEL_EM_PALAVRA`).
 */
export function candidatoDoVinculo(lido: VinculoLido, papelEmPalavra: string): Candidato {
  return {
    pessoaId: lido.pessoa.pessoaId,
    nome: lido.pessoa.nome,
    papel: papelEmPalavra,
    area: lido.area?.nome ?? null,
    etiquetas: lido.etiquetas.map((etiqueta) => ({ id: etiqueta.id, nome: etiqueta.nome })),
  };
}

/**
 * **A palavra que reparte os dois blocos, e ela vem de fora.** `PAPEL_EM_PALAVRA`
 * (`app/ocorrencias/[ocorrenciaId]/page.tsx`) é quem a produz, e nada no compilador liga os dois lados —
 * o acoplamento existe desde o item 19. O que este arquivo acrescenta é **um teste que o fixa**: se a
 * palavra mudar lá, o caso daqui cai.
 */
const PAPEL_SOLICITANTE = "Solicitante";

/**
 * Combining Diacritical Marks — o bloco que o `NFD` separa da letra base.
 *
 * **Escrito com `\u`, e não com os caracteres combinantes literais**, por uma razão prática: eles são
 * invisíveis no editor e colam-se ao `[` anterior, o que faz a mesma expressão parecer um erro de digitação
 * em toda revisão futura.
 */
const DIACRITICOS = /[\u0300-\u036f]/g;

/** `trim` → minúsculas → `NFD` sem diacríticos → espaços colapsados. */
export function normalizarParaBusca(texto: string): string {
  return texto
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(DIACRITICOS, "")
    .replace(/\s+/g, " ");
}

/**
 * As palavras de um texto, já normalizadas. **Busca em branco é lista vazia, nunca `[""]`** — um termo
 * vazio casaria tudo por acidente em vez de por regra.
 *
 * **É exportada porque `casaPeloNome` é inútil sem ela**, e o critério 10.6 promete que T-08 vai reusar as
 * duas. Também é o que faz o filtro e o casamento compartilharem **uma** definição de *palavra*.
 */
export function termosDaBusca(busca: string): readonly string[] {
  const normalizada = normalizarParaBusca(busca);
  return normalizada === "" ? [] : normalizada.split(" ");
}

/** **Todos** os termos precisam casar o começo de **alguma** palavra do nome. Sem termo, casa. */
export function casaPeloNome(nome: string, termos: readonly string[]): boolean {
  if (termos.length === 0) return true;

  const palavras = termosDaBusca(nome);
  return termos.every((termo) => palavras.some((palavra) => palavra.startsWith(termo)));
}

/**
 * **Busca em branco devolve a lista inteira, na mesma ordem** — a de `order by p.nome` do repositório, que
 * é a mesma de T-08. Filtrar nunca reordena.
 */
export function filtrarPorNome(
  candidatos: readonly Candidato[],
  busca: string,
): readonly Candidato[] {
  const termos = termosDaBusca(busca);
  if (termos.length === 0) return candidatos;

  return candidatos.filter((candidato) => casaPeloNome(candidato.nome, termos));
}

/**
 * A repartição de **três** vias — e a terceira é a novidade do item 20.
 *
 * **Quem chama sai dos dois blocos.** Com a fileira *"Atribuir a mim"* no topo, deixar o nome dele também
 * no bloco *Gestores e Encarregados* produziria **dois controles que enviam o mesmo `pessoaId`** — e o
 * segundo, mais abaixo, sem explicar por que existe.
 *
 * **`eu` pode ser `null`**, e hoje isso é inalcançável: `podeAtribuir` exige `vinculo.gerir` e a lista é a
 * dos vínculos ativos. Quando for, a fileira não renderiza e o modal continua sendo o do item 19 — nada
 * quebra e nada é inventado.
 */
export function repartirCandidatos(
  candidatos: readonly Candidato[],
  euPessoaId: string,
): {
  eu: Candidato | null;
  executores: readonly Candidato[];
  solicitantes: readonly Candidato[];
} {
  let eu: Candidato | null = null;
  const executores: Candidato[] = [];
  const solicitantes: Candidato[] = [];

  for (const pessoa of candidatos) {
    if (pessoa.pessoaId === euPessoaId) {
      eu = pessoa;
      continue;
    }

    if (pessoa.papel === PAPEL_SOLICITANTE) {
      solicitantes.push(pessoa);
      continue;
    }

    executores.push(pessoa);
  }

  return { eu, executores, solicitantes };
}
