import { LIMITE_PADRAO, podeLerOcorrencia, type QuemPergunta } from "./consultas";
import { OcorrenciaNaoEncontrada } from "./erros";
import type { ComentarioLido, CursorDeConversa, RepositorioEscopadoDeOcorrencias } from "./portas";

/**
 * ============================================================================
 *  O canal 1 — a leitura e a escrita, e NENHUMA das duas é comando
 * ============================================================================
 *
 * **`comentar` não entra em `COMANDOS`.** Não está no `Comando.ts`, não transiciona, não escreve na
 * trilha, e o `Canal de conversa` está **fora do limite do agregado** (`arquitetura.md:135-139`). O
 * contrato tem **dez** comandos, o item 27 fechou a lista, e o próprio arquivo declara que *"o próximo
 * comando que nascer começa fora da lista"*.
 *
 * **E por isso não há `comandoPermitido` aqui.** Não há linha para `comentar` na tabela de transições da
 * `arquitetura.md` §4, e **o contrato não publica `409 TRANSICAO_NAO_PERMITIDA` neste endpoint**
 * (`openapi.yaml`). Comenta-se nos **seis** estados, `resolvida` e `cancelada` inclusive — e o protótipo
 * escreve a razão na voz do produto: *"Se voltar a pingar depois da próxima chuva, **escreva aqui na
 * ocorrência**"* é o texto da resolução, dito ao Solicitante numa ocorrência já resolvida.
 */

/** A página que a Interface projeta. `temMais` vira `proximoCursor` lá, e só lá. */
export type PaginaDeConversa = { itens: readonly ComentarioLido[]; temMais: boolean };

/**
 * `GET /ocorrencias/{id}/comentarios` — **e a estrada direta do bloco 4 de T-05**, que é a mesma função.
 *
 * **`podeLerOcorrencia` JÁ É o critério 30.2**, e por isso não nasce predicado novo aqui. Ela devolve
 * `quem.podeLerTodas || lida.autor.pessoaId === quem.pessoaId`, e `ocorrencia.ler_todas` é do Gestor e
 * só dele — logo a função **já** diz *"Gestor da organização ou autor"*, palavra por palavra. O critério
 * fala de **participantes derivados, nunca listados**, e a derivação já existe em código, num lugar só.
 *
 * **`null` e `podeLerOcorrencia` falso dão o MESMO `404`** — §6.3, *"não confirmar a existência do que
 * você não pode alcançar"*. É a mesma sequência de `verLinhaDoTempo`.
 *
 * **Não uso `carregar` aqui, embora seja mais barato.** `carregar` devolve o **agregado**, e o item do
 * DoD que o lint não alcança existe justamente para que o agregado só saia por caminho de escrita. A
 * leitura usa a porta de leitura.
 *
 * **Pede uma linha a mais do que devolve.** É como se sabe que há próxima página **sem `count`**, que o
 * contrato recusou (§7.7) — *"contar exigiria uma segunda varredura da partição a cada página"* —, e é o
 * que garante que `proximoCursor` só existe quando há mesmo o que carregar.
 */
export async function verComentarios(
  repositorio: RepositorioEscopadoDeOcorrencias,
  id: string,
  quem: QuemPergunta,
  pagina: { limite?: number; cursor?: CursorDeConversa | null } = {},
): Promise<PaginaDeConversa> {
  const ocorrencia = await repositorio.porId(id);
  if (ocorrencia === null) throw new OcorrenciaNaoEncontrada();
  if (!podeLerOcorrencia(ocorrencia, quem)) throw new OcorrenciaNaoEncontrada();

  const limite = pagina.limite ?? LIMITE_PADRAO;

  const lidas = await repositorio.comentarios(id, {
    // **Uma linha a mais do que se devolve.** Quem editar esta função não pode perder isto: sem o `+ 1`,
    // `temMais` fica falso para sempre e o *Carregar mais* some numa conversa que tem mais.
    limite: limite + 1,
    cursor: pagina.cursor ?? null,
  });

  return { itens: lidas.slice(0, limite), temMais: lidas.length > limite };
}

/**
 * `POST /ocorrencias/{id}/comentarios`.
 *
 * **A escrita usa `carregar`, e é o precedente literal de `atribuirResponsavel`**: é a leitura mais
 * barata das duas — sem junção de nome e sem anexos —, e o que se pergunta a ela é *"esta ocorrência
 * existe nesta organização e eu a alcanço?"*. **Ler estado para decidir não é escrever estado.**
 *
 * **E não há segunda pergunta ao estado.** O agregado é carregado para provar existência e escopo, e o
 * `status` dele **não** é consultado: comentar é admitido nos seis estados. Ver o cabeçalho do módulo.
 *
 * **Um relógio, lido uma vez.** O mesmo instante carimba `mensagens.criado_em`,
 * `canais_conversa.criado_em` (quando o canal nasce) e `ocorrencias.atualizada_em` — é o que faz o
 * critério 30.1 ser verdade sem dois relógios discordando dentro do mesmo `COMMIT`.
 *
 * **O texto chega já aparado pelo schema**, num lugar só. Esta função não o apara de novo.
 */
export async function enviarComentario(
  repositorio: RepositorioEscopadoDeOcorrencias,
  id: string,
  quem: QuemPergunta,
  dados: { texto: string },
): Promise<ComentarioLido> {
  const carregada = await repositorio.carregar(id);
  if (carregada === null) throw new OcorrenciaNaoEncontrada();

  // **A autoria vem do agregado carregado**, e não de uma segunda leitura: `Ocorrencia` já a carrega, e
  // pedir `porId` só para conferir quem é o autor seria a terceira ida ao banco por mensagem enviada.
  if (!podeLerOcorrencia({ autor: { pessoaId: carregada.ocorrencia.autorPessoaId } }, quem)) {
    throw new OcorrenciaNaoEncontrada();
  }

  return repositorio.comentar(id, {
    autorPessoaId: quem.pessoaId,
    texto: dados.texto,
    em: new Date().toISOString(),
  });
}
