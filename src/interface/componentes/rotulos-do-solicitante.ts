import { STATUS, type StatusOcorrencia } from "@/dominio/ocorrencia";
import { nomeDoStatus, rotuloPadraoDoSolicitante } from "@/interface/projecoes";

/**
 * ============================================================================
 *  Os textos do Solicitante, na tela de configuração — item 100
 * ============================================================================
 *
 * **Funções e textos puros, com teste**, pela regra do item 20: decisão de texto de produto não mora num
 * `?:` dentro do JSX. O vizinho `regras-da-configuracao.ts` faz o mesmo pelas duas regras do item 99, e as
 * duas metades moram separadas porque as regras têm valor em palavra — *Sim* e *Não* — e os textos de
 * quem abriu têm texto livre.
 *
 * **A lista dos seis estados vem do Domínio.** Uma cópia local seria a segunda cópia que o comentário da
 * migração 018 diz que diverge; a proibição de fronteira alcança `@/aplicacao` e `@/composicao`, não
 * `@/dominio`.
 */

/** Um ponto do ciclo, na tela. É o estado do Domínio, e o alias existe só para ler melhor aqui. */
export type EstadoDaTela = StatusOcorrencia;

/** O que a organização customizou. Estado ausente é *"vale o padrão"*. */
export type Rotulos = Readonly<Partial<Record<EstadoDaTela, string>>>;

/**
 * **Quarenta caracteres depois do `trim`**, a mesma medida do `check` da migração 018 e do schema de
 * entrada. A frase padrão mais longa — *"Parada — esperando material chegar"* — tem 34.
 */
export const TETO_DO_ROTULO = 40;

/**
 * **A ordem é a do caminho, não a do alfabeto**, porque é assim que o Gestor lê a lista: uma ocorrência
 * anda por ela de cima para baixo.
 */
export const ESTADOS_DO_CICLO: readonly EstadoDaTela[] = STATUS;

/** O nome do ciclo de cada estado — a coluna que o Gestor lê, e que a customização não muda. */
export const NOME_DO_CICLO: Readonly<Record<EstadoDaTela, string>> = Object.fromEntries(
  STATUS.map((estado) => [estado, nomeDoStatus(estado)]),
) as Record<EstadoDaTela, string>;

export const TITULO_DOS_ROTULOS = "Textos do Solicitante";
export const APOIO_DO_CARTAO_DE_ROTULOS =
  "O texto que o Solicitante lê em cada ponto do ciclo.";
export const DESCRICAO_DOS_ROTULOS = "Seis textos, um por ponto do ciclo. Em branco, vale o padrão.";

/** O apoio do campo de `Pausada`: a consequência de um rótulo só para os quatro motivos, em uma linha. */
export const APOIO_DA_PAUSA = "O motivo aparece embaixo, na lista e na página da ocorrência.";

/** A marca do cartão quando a organização não customizou aquele ponto do ciclo. */
export const MARCA_DO_PADRAO = "padrão";

/** Salvar sem mudar acende esta frase, pela regra do critério 44g.9. */
export const ROTULOS_SEM_MUDANCA = "Altere um texto antes de salvar.";

export const AVISO_DE_ROTULOS_SALVOS = "Textos salvos";
export const FALHA_AO_SALVAR_ROTULOS = "Não foi possível salvar os textos";

/**
 * **Só o que mudou vai no corpo.** Nada mudou é objeto vazio, e o modal acende `ROTULOS_SEM_MUDANCA`.
 *
 * **Apagar vira `null`**, e não ausência: ausência é *não mexa*, e o texto que sumiu do campo é um pedido
 * de volta ao padrão. As duas ausências são coisas diferentes, e é por isso que o `null` existe.
 */
export function rotulosQueMudaram(
  atuais: Rotulos,
  escolhidos: Rotulos,
): Partial<Record<EstadoDaTela, string | null>> {
  const mudancas: Partial<Record<EstadoDaTela, string | null>> = {};
  for (const estado of ESTADOS_DO_CICLO) {
    const antes = atuais[estado] ?? "";
    const agora = (escolhidos[estado] ?? "").trim();
    if (agora === antes) continue;
    mudancas[estado] = agora === "" ? null : agora;
  }
  return mudancas;
}

/** As seis chaves de rótulo da trilha, como o banco as grava. */
export type ChaveDeRotulo = `rotulo_${EstadoDaTela}`;

export function ehChaveDeRotulo(chave: string): chave is ChaveDeRotulo {
  return chave.startsWith("rotulo_") && (STATUS as readonly string[]).includes(chave.slice(7));
}

/**
 * A linha da trilha para uma mudança de texto.
 *
 * **O padrão aparece por extenso, e o texto escrito aparece entre aspas curvas** — as mesmas da linha do
 * tempo, que marcam o que uma pessoa escreveu. Na trilha o padrão é gravado como texto vazio, porque um
 * Gestor pode escrever *padrão* como rótulo e o banco recusaria *"de padrão para padrão"*.
 */
export function fraseDaMudancaDeRotulo(m: {
  chave: ChaveDeRotulo;
  valorAnterior: string;
  valorNovo: string;
}): string {
  const estado = m.chave.slice(7) as EstadoDaTela;
  const de = m.valorAnterior === "" ? "do padrão" : `de “${m.valorAnterior}”`;
  const para = m.valorNovo === "" ? "para o padrão" : `para “${m.valorNovo}”`;
  return `Texto de ${NOME_DO_CICLO[estado]}: ${de} ${para}`;
}

/**
 * **Texto igual ao padrão é padrão** (item 100). Quem digita *"Em análise"* no campo de `em_analise` não
 * grava linha, e é o que mantém verdadeira a promessa de que sem customização não há linha nenhuma.
 *
 * **Mora na Interface, e não na Aplicação:** as frases padrão são texto de exibição e vivem nas projeções
 * daqui; a Aplicação não as pode importar, e não deveria — para ela, rótulo é um texto qualquer.
 *
 * **O `trim` acontece aqui TAMBÉM, e não é repetição do schema.** O schema já apara o que chega por
 * HTTP; esta função é pura e é chamada também de teste, e uma chamada com `"   "` tem de ver o padrão.
 * Sem isto, ela devolveria `"   "`, que o banco recusaria pelo `check` da migração 018 — erro de
 * servidor no lugar de um campo em branco.
 */
export function normalizarRotulos(
  pedido: Readonly<Partial<Record<EstadoDaTela, string | null>>>,
): Readonly<Partial<Record<EstadoDaTela, string | null>>> {
  return Object.fromEntries(
    Object.entries(pedido).map(([estado, texto]) => {
      const aparado = texto === null ? null : texto.trim();
      return [
        estado,
        aparado === null ||
        aparado === "" ||
        aparado === rotuloPadraoDoSolicitante(estado as EstadoDaTela)
          ? null
          : aparado,
      ];
    }),
  );
}
