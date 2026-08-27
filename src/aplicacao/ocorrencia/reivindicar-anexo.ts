import {
  AnexoAcimaDoLimite,
  AnexoNaoReconhecido,
  type ArmazenamentoDeAnexos,
  type ObjetoDescrito,
} from "@/aplicacao/anexo";
import {
  TIPO_DE_CONTEUDO_DA_MINIATURA,
  ehTipoDeConteudoDeAnexo,
  tipoDeAnexo,
} from "@/dominio/anexo";
import type { DadosDeAnexo } from "@/dominio/ocorrencia";

/** O que o cliente manda em `anexos[]` — o schema `ReferenciaDeAnexo` do contrato. */
export type ReferenciaDeAnexo = {
  chave: string;
  ticket: string;
  titulo?: string | null;
};

/**
 * ============================================================================
 *  A reivindicação — seis recusas em sequência, e nenhuma delas toca o banco
 * ============================================================================
 *
 * **As três primeiras não tocam nem a rede.** O ticket é token assinado, e é isso que a §10.2 do contrato
 * comprou ao recusar a tabela de uploads pendentes: *"o token assinado carrega o mesmo estado sem linha
 * nenhuma"*. **Nada aqui lê `autorizacoes_de_upload`** — é o teste que o 13a escreveu para si mesmo, e é
 * o que preserva a suposição S-A13.
 *
 * **Duas ondas de ida e volta ao storage, não cinco:** `descrever` do principal e da miniatura juntos,
 * depois `marcarConfirmado` dos dois juntos. É o que mantém a reivindicação dentro do orçamento do RNF6.
 *
 * **A troca da etiqueta acontece ANTES do `COMMIT`, e a ordem é deliberada** (contrato §10.3): se fosse
 * depois, a falha inversa deixaria uma ocorrência apontando para um objeto que a faxina vai apagar — e
 * perder o anexo de uma ocorrência que existe é pior que guardar um objeto que ninguém referencia.
 */

/**
 * Os dois valores que a conferência 5 aceita.
 *
 * **`confirmado` está aqui de propósito, e é a decisão mais delicada da fatia.** Lido ao pé da letra, o
 * critério 13b.6 (*"objeto sem `estado=pendente` → 422"*) devolveria `422` no reenvio da S-T7 — onde o
 * objeto já é `confirmado` porque **nós** o promovemos na primeira tentativa —, justamente onde o
 * critério 13b.3 exige `409 ANEXO_JA_REIVINDICADO` com o `ocorrenciaId`.
 *
 * Quem responde *"já foi reivindicado"* é o `UNIQUE (chave)` de `anexos`, no `INSERT`: é o mecanismo que
 * o modelo §6.16 e o contrato §10.3 já escolheram, não custa leitura no caminho quente, e **recupera o
 * terceiro caso residual da §10.3** — objeto `confirmado` sem linha nenhuma, que com a leitura estrita
 * teria a foto perdida para sempre.
 *
 * **A propriedade que o 13b.6 comprou fica intacta:** objeto **sem** etiqueta — que é do que a
 * justificativa dele fala, palavra por palavra — continua recusado.
 */
const ESTADOS_CONHECIDOS = new Set(["pendente", "confirmado"]);

function etiquetaConhecida(objeto: ObjetoDescrito): boolean {
  return objeto.estado !== null && ESTADOS_CONHECIDOS.has(objeto.estado);
}

export async function reivindicarAnexo(
  armazenamento: ArmazenamentoDeAnexos,
  ctx: { organizacaoId: string; pessoaId: string; agora: string },
  referencia: ReferenciaDeAnexo,
): Promise<DadosDeAnexo> {
  // 1 · Assinatura.
  const carga = armazenamento.conferirTicket(referencia.ticket);
  if (carga === null) throw new AnexoNaoReconhecido();

  // 2 · Portador: organização E Pessoa. É o que amarra o escopo sem que a porta conheça organização —
  // e é o que torna impossível o `ocorrenciaId` do `409` apontar para fora.
  if (carga.organizacaoId !== ctx.organizacaoId || carga.pessoaId !== ctx.pessoaId) {
    throw new AnexoNaoReconhecido();
  }

  // 3 · Validade — os 15 minutos do ticket. O instante vem de quem chama; esta camada não lê relógio
  // sozinha, pela mesma razão que o agregado não lê.
  if (Date.parse(carga.expiraEm) <= Date.parse(ctx.agora)) throw new AnexoNaoReconhecido();

  // 4 · A `chave` do corpo é a do ticket.
  if (carga.chave !== referencia.chave) throw new AnexoNaoReconhecido();

  // O tipo autorizado tem de ser um dos que o produto emite. É o estreitamento que faz `tipoDeAnexo`
  // compilar — e um ticket com tipo fora da lista é um ticket que este servidor não assinaria.
  if (!ehTipoDeConteudoDeAnexo(carga.tipoConteudo)) throw new AnexoNaoReconhecido();

  // **Primeira onda.** Os dois `descrever` em paralelo: o caminho quente paga uma ida e volta, não duas.
  const [principal, miniatura] = await Promise.all([
    armazenamento.descrever(carga.chave),
    armazenamento.descrever(carga.chaveMiniatura).catch(() => null),
  ]);

  // 5 · O objeto existe, e tem etiqueta com valor conhecido.
  if (principal === null || !etiquetaConhecida(principal)) throw new AnexoNaoReconhecido();

  // 6 · O tipo real é o autorizado, e o tamanho real cabe no teto do TICKET.
  if (principal.tipoConteudo !== carga.tipoConteudo) throw new AnexoNaoReconhecido();
  if (principal.tamanhoBytes > carga.tamanhoMaximo) throw new AnexoAcimaDoLimite();

  // A miniatura só é candidata se existir, tiver etiqueta conhecida e for do tipo que o emissor
  // autorizou. Prévia de um objeto que não é a prévia seria pior que prévia nenhuma.
  const miniaturaCandidata =
    miniatura !== null &&
    etiquetaConhecida(miniatura) &&
    miniatura.tipoConteudo === TIPO_DE_CONTEUDO_DA_MINIATURA;

  // **Segunda onda.** As duas trocas de etiqueta juntas.
  const [confirmouPrincipal, confirmouMiniatura] = await Promise.all([
    armazenamento.marcarConfirmado(carga.chave),
    miniaturaCandidata
      ? armazenamento.marcarConfirmado(carga.chaveMiniatura).catch(() => false)
      : Promise.resolve(false),
  ]);

  // **A única falha desta fatia que não é `4xx`, e ela é deliberada.** Gravar a linha com o objeto ainda
  // `pendente` faria a faxina apagar a evidência de uma ocorrência viva em 24–48 h; criar a ocorrência
  // sem o anexo faria a pessoa sair da tela convencida de ter anexado. `500` é o único desfecho que não
  // mente: o texto continua no formulário, a `chave` continua válida pelos 15 minutos, e tentar de novo
  // funciona.
  if (!confirmouPrincipal) {
    throw new Error(
      `Não foi possível confirmar a etiqueta do anexo ${carga.chave} — a ocorrência não foi criada.`,
    );
  }

  return {
    // Derivado do que o servidor AUTORIZOU, nunca do que o cliente enviou — não há campo de tipo de
    // anexo em schema de entrada nenhum.
    tipo: tipoDeAnexo(carga.tipoConteudo),
    chave: carga.chave,
    // **Gravada só se as DUAS coisas passarem** — o `HEAD` e a troca de etiqueta. A chave de um objeto
    // que continua `pendente` produziria uma prévia que funciona hoje e some em 24–48 h.
    thumbnailChave: confirmouMiniatura ? carga.chaveMiniatura : null,
    nomeArquivo: principal.nomeArquivo,
    titulo: referencia.titulo ?? null,
    // Do `HEAD`, não do declarado — critério 13b.1.
    tipoConteudo: principal.tipoConteudo,
    tamanhoBytes: principal.tamanhoBytes,
    anexadoPorPessoaId: ctx.pessoaId,
    anexadoEm: ctx.agora,
  };
}
