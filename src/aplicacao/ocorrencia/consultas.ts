import { AnexoNaoEncontrado, type ArmazenamentoDeAnexos } from "@/aplicacao/anexo";
import type { ErroDeDominio } from "@/dominio/erros";

import { OcorrenciaNaoEncontrada, SoParaLeitura } from "./erros";
import type {
  AtribuicaoLida,
  ComentarioLido,
  FiltroDeOcorrencias,
  OcorrenciaExportadaLida,
  OcorrenciaLida,
  OcorrenciaResumoLida,
  OrdenacaoDeOcorrencias,
  RepositorioEscopadoDeOcorrencias,
  TransicaoLida,
} from "./portas";

/**
 * `GET /ocorrencias/{id}`.
 *
 * **O repositório escopado é a defesa**: ele não recebe o identificador da organização, e portanto não
 * tem como devolver a ocorrência de outra. `null` vira `404` — o mesmo `404` de inexistente, que é a
 * §6.3.
 *
 * **A visibilidade da primeira entrega** — autor ou `ocorrencia.ler_todas` — é aplicada pelo handler,
 * que é quem tem o `Vinculo`. Aqui fica o que não depende de quem pergunta.
 */
export async function verOcorrencia(
  repositorio: RepositorioEscopadoDeOcorrencias,
  id: string,
): Promise<OcorrenciaLida> {
  const ocorrencia = await repositorio.porId(id);
  if (ocorrencia === null) throw new OcorrenciaNaoEncontrada();
  return ocorrencia;
}

/**
 * **Posso AGIR sobre esta ocorrência?** Autor, ou `ocorrencia.ler_todas`. É a regra da primeira entrega,
 * sem mudança, e é o portão de toda escrita: os dez comandos, a mensagem, e compartilhar.
 *
 * **Recebe o autor, e não o objeto de leitura**, porque os escritores têm o agregado na mão, não a
 * `OcorrenciaLida` — e é isso que os obriga a escolher entre as duas funções em vez de herdar a errada.
 */
export function participaDaOcorrencia(autorPessoaId: string, quem: QuemPergunta): boolean {
  return quem.podeLerTodas || autorPessoaId === quem.pessoaId;
}

/**
 * **Posso VER esta ocorrência?** Quem participa, ou quem a recebeu compartilhada (item 87).
 *
 * A regra estava escrita duas vezes, copiada, antes do item 13b; e ainda havia uma terceira cópia em
 * linha na rota da trilha de auditoria, que o item 87 tirou. **Onde ela é chamada** é de quem tem o
 * `Vinculo`, e isso não justifica que ela seja escrita três vezes.
 *
 * **É o único lugar em que o compartilhamento entra na leitura** (critério 87.2). Não há permissão
 * `ler_compartilhada`: compartilhar é fato sobre uma linha, e não poder do papel. Criar a permissão
 * espalharia o conceito pela fronteira inteira, e o ponto único da ADR-0003 deixaria de ser um.
 */
export function podeLerOcorrencia(
  lida: {
    autor: { pessoaId: string };
    compartilhamentos: readonly { com: { pessoaId: string } }[];
  },
  quem: QuemPergunta,
): boolean {
  return (
    participaDaOcorrencia(lida.autor.pessoaId, quem) ||
    lida.compartilhamentos.some((compartilhamento) => compartilhamento.com.pessoaId === quem.pessoaId)
  );
}

/**
 * **A recusa de quem não participa, e ela tem DOIS desfechos** — a escada de `docs/api.md` (*Erros*).
 *
 * Quem recebeu PODE LER, então a recusa dele é `403`; quem não alcança a ocorrência leva `404`, sem
 * confirmar que ela existe. **Só roda no caminho da recusa**: o caminho feliz dos escritores não paga
 * consulta nenhuma a mais.
 */
export async function recusaDeQuemNaoParticipa(
  repositorio: Pick<RepositorioEscopadoDeOcorrencias, "compartilhamentoCom">,
  ocorrenciaId: string,
  pessoaId: string,
): Promise<ErroDeDominio> {
  const recebida = await repositorio.compartilhamentoCom(ocorrenciaId, pessoaId);
  return recebida === null ? new OcorrenciaNaoEncontrada() : new SoParaLeitura();
}

/** A representação pedida. `?variante=miniatura` é **outra representação do mesmo anexo**, não outro
 *  recurso — e é por isso que a autorização é a mesma (contrato §10.4). */
export type VarianteDoAnexo = "original" | "miniatura";

/**
 * `GET /ocorrencias/{id}/anexos/{anexoId}` — devolve a **URL assinada**, e o `302` é do handler.
 *
 * **Quatro passos, e o terceiro é o que faz a chave nunca sair:** a chave é lida, entregue ao assinador e
 * descartada dentro desta função. Ela não volta ao chamador e não existe em tipo nenhum que alimente
 * payload.
 *
 * **A autorização acontece a cada leitura** — é a ocorrência que decide quem vê, nunca a posse de um
 * link. Por isso a mesma regra de `GET /ocorrencias/{id}` roda aqui, e a recusa é o mesmo `404`.
 */
export async function verAnexoDaOcorrencia(
  repositorio: RepositorioEscopadoDeOcorrencias,
  armazenamento: ArmazenamentoDeAnexos,
  quem: QuemPergunta,
  pedido: { ocorrenciaId: string; anexoId: string; variante: VarianteDoAnexo },
): Promise<string> {
  const ocorrencia = await repositorio.porId(pedido.ocorrenciaId);
  if (ocorrencia === null) throw new OcorrenciaNaoEncontrada();
  if (!podeLerOcorrencia(ocorrencia, quem)) throw new OcorrenciaNaoEncontrada();

  const objeto = await repositorio.objetoDoAnexo(pedido.ocorrenciaId, pedido.anexoId);
  if (objeto === null) throw new AnexoNaoEncontrado();

  const chave = pedido.variante === "miniatura" ? objeto.thumbnailChave : objeto.chave;
  // Miniatura ausente é `404 ANEXO_NAO_ENCONTRADO`, e não o objeto principal disfarçado de prévia —
  // critério 13b.5 e §6.3.
  if (chave === null) throw new AnexoNaoEncontrado();

  return armazenamento.urlDeLeitura(chave);
}

/**
 * `GET /ocorrencias/{id}/trilha-de-auditoria`.
 *
 * **É a única forma de alcançar um registro de transição pela API, e é somente leitura.** Não existe
 * `POST`, `PATCH` nem `DELETE` neste recurso — se um dia aparecer escrita aqui, a garantia central do
 * produto terá sido perdida.
 *
 * Confere a ocorrência **antes** da trilha: uma ocorrência que não é desta organização tem de dar `404`,
 * não uma lista vazia — lista vazia diria *"existe e não tem registros"*, que é falso nos dois sentidos.
 */
export async function verTrilhaDeAuditoria(
  repositorio: RepositorioEscopadoDeOcorrencias,
  id: string,
): Promise<readonly TransicaoLida[]> {
  if ((await repositorio.porId(id)) === null) throw new OcorrenciaNaoEncontrada();
  return repositorio.trilha(id);
}

/**
 * ============================================================================
 *  `GET /ocorrencias/{id}/linha-do-tempo` — a intercalação (item 29)
 * ============================================================================
 *
 * **Um evento é o par (instante, fato).** `ocorridoEm` sobe para o topo do tipo porque é a **chave de
 * ordenação**, e o fato fica embrulhado no modelo de leitura de origem — inteiro, sem cópia de campo.
 *
 * **É o que faz a terceira fonte custar uma linha.** No dia do item 30, `mensagens` entra como mais um
 * `map` no arranjo abaixo; a ordenação não muda, e o projetor ganha uma forma. Achatar os campos aqui
 * obrigaria a copiar oito propriedades da transição e a lê-las renomeadas na projeção.
 */
export type EventoLido =
  | { tipo: "transicao"; ocorridoEm: string; transicao: TransicaoLida }
  | { tipo: "atribuicao"; ocorridoEm: string; atribuicao: AtribuicaoLida }
  | { tipo: "mensagem"; ocorridoEm: string; mensagem: ComentarioLido };

/**
 * O desempate de tipo, **declarado e não emergente**: no mesmo instante, a transição vem antes da
 * atribuição, e as duas antes da mensagem. É a ordem em que os fatos acontecem — `atribuirResponsavel` é
 * atividade *sobre* uma ocorrência que já está no estado que a transição pôs, e a mensagem é atividade
 * sobre as duas.
 *
 * **O valor 2 é o que NÃO mexe na ordem do par que já existe** (item 30). Os três carimbos vêm de
 * escritas diferentes e não colidem na prática; o peso existe para a ordenação continuar **total e
 * determinística**.
 */
const PESO_DO_TIPO: Readonly<Record<EventoLido["tipo"], number>> = {
  transicao: 0,
  atribuicao: 1,
  mensagem: 2,
};

/**
 * **Ordem crescente por instante** — do mais antigo para o mais recente, como a trilha e como o protótipo
 * desenha.
 *
 * **Comparação por `Date.parse`, não por string:** os dois ISO vêm de `toISOString()` e comparariam bem
 * como texto hoje, mas a igualdade textual é frágil (um `+00:00` no lugar do `Z` bastaria), e a ordenação
 * é o que a tela inteira significa.
 *
 * **O segundo desempate é `sequencia`, e não é preciosismo:** o `UNIQUE (ocorrencia_id, sequencia)` da
 * migração 005 existe precisamente para que *"a ordenação passe a ser determinística"*
 * (`modelo-de-dados.md:1430`). Reordenar por data e jogar fora a sequência seria desfazer no código o que
 * o banco garante.
 */
function porInstante(a: EventoLido, b: EventoLido): number {
  const instante = Date.parse(a.ocorridoEm) - Date.parse(b.ocorridoEm);
  if (instante !== 0) return instante;

  const tipo = PESO_DO_TIPO[a.tipo] - PESO_DO_TIPO[b.tipo];
  if (tipo !== 0) return tipo;

  if (a.tipo === "transicao" && b.tipo === "transicao") {
    return a.transicao.sequencia - b.transicao.sequencia;
  }
  return 0;
}

/**
 * `GET /ocorrencias/{id}/linha-do-tempo` — **e a estrada direta do bloco 3 de T-05**, que é a mesma
 * função.
 *
 * **Recebe `quem`, ao contrário do endpoint irmão, e a diferença é medida.** `verTrilhaDeAuditoria`
 * confere só a existência e deixa a visibilidade no handler — que por isso chama `verOcorrencia` antes e
 * paga um `porId` inteiro, e a função paga outro. Como `porId` lê trilha e anexos em paralelo, aquele
 * endpoint custa **duas ocorrências e três trilhas** para devolver uma trilha (achado A-2 da spec). Aqui
 * há **um `porId` só**, e a rota fica em três linhas.
 *
 * **`null` e `podeLerOcorrencia` falso dão o MESMO `404`** — é a §6.3 do contrato, *"não confirmar a
 * existência do que você não pode alcançar"*, e é o critério 29.4.
 *
 * **As duas fontes vão em paralelo:** é uma ida e volta ao banco, não duas.
 *
 * **Recusado — deduzir o autor do registro `sequencia = 1`** (premissa P1) para economizar o `porId`.
 * Funcionaria, e amarraria a regra de **visibilidade** a uma premissa de **escrita**; e usaria *"trilha
 * vazia"* como sinal de `404`, que é o que o comentário de `verTrilhaDeAuditoria` proíbe em voz alta.
 */
export async function verLinhaDoTempo(
  repositorio: RepositorioEscopadoDeOcorrencias,
  id: string,
  quem: QuemPergunta,
): Promise<readonly EventoLido[]> {
  const ocorrencia = await repositorio.porId(id);
  if (ocorrencia === null) throw new OcorrenciaNaoEncontrada();
  if (!podeLerOcorrencia(ocorrencia, quem)) throw new OcorrenciaNaoEncontrada();

  const [trilha, atribuicoes, mensagens] = await Promise.all([
    repositorio.trilha(id),
    repositorio.atribuicoes(id),
    repositorio.mensagens(id),
  ]);

  const eventos: EventoLido[] = [
    ...trilha.map((transicao) => ({
      tipo: "transicao" as const,
      ocorridoEm: transicao.ocorreuEm,
      transicao,
    })),
    // **`ocorridoEm` é `atribuidoEm`, nunca `encerradaEm`.** A atribuição encerrada fica no lugar em que
    // começou — é o *"aparece duas vezes"* do critério 29.3 lido literalmente.
    ...atribuicoes.map((atribuicao) => ({
      tipo: "atribuicao" as const,
      ocorridoEm: atribuicao.atribuidoEm,
      atribuicao,
    })),
    /**
     * **A terceira fonte — critério 30.7, e ela é o `map` a mais que o item 29 previu.**
     *
     * **Não pagina e não filtra por autor:** vêm todas as mensagens da ocorrência. O protótipo desenha,
     * nos quatro quadros de T-05, **uma** das duas mensagens do bloco 4 dentro do bloco 3 — a do
     * Solicitante, nunca a resposta do Gestor. **Não é regra, é desenho à mão:** o `oneOf` do contrato não
     * filtra por autor, o glossário diz *"mensagens"* sem qualificador, e um bloco 3 que mostrasse só um
     * lado da conversa seria mais estranho que o que se quis evitar.
     *
     * **É a única das três fontes sem limite natural**, e o custo está declarado na porta `mensagens`.
     */
    ...mensagens.map((mensagem) => ({
      tipo: "mensagem" as const,
      ocorridoEm: mensagem.criadoEm,
      mensagem,
    })),
  ];

  return eventos.sort(porInstante);
}

/**
 * A exportação de Ocorrências (item 124). **A permissão é conferida na porta**: o `route.ts` exige
 * `ocorrencia.ler_todas`, então quem chega aqui lê o conjunto inteiro, e não há recorte de autor a aplicar.
 */
export function exportarOcorrencias(
  repositorio: RepositorioEscopadoDeOcorrencias,
): Promise<readonly OcorrenciaExportadaLida[]> {
  return repositorio.exportar();
}

/** O padrão do contrato (`openapi.yaml`, parâmetro `Limite`). */
export const LIMITE_PADRAO = 20;
/** O teto do contrato. Quem pedir acima leva `400` — a recusa é da camada de Interface. */
export const LIMITE_MAXIMO = 100;

/** Quem está perguntando, reduzido ao que a listagem precisa saber. */
export type QuemPergunta = { pessoaId: string; podeLerTodas: boolean };

/** O recorte aplicado, declarado na resposta *"para que o cliente possa dizer ao usuário o que está
 *  vendo"* (`contrato-de-api.md` §8.5). */
export type VisibilidadeAplicada = "todas" | "apenas_minhas" | "compartilhadas_comigo";

/** O teto de página do contrato. Deslocamento fundo é varredura, e nenhuma tela pede o milésimo clique. */
export const PAGINA_MAXIMA = 1000;

/** As contagens de painel — as que respondem *"o que existe para você escolher"*. */
export type ContagensDoPainel = {
  todas: number;
  minhas: number;
  emAberto: number;
  semResponsavel: number;
};

/**
 * A página de `GET /ocorrencias` — item 14b, 09/09/2026.
 *
 * **`total`, `pagina` e `limite` montam a navegação; `contagens` escolhe o recorte.** É por isso que
 * `total` está solto e não dentro de `contagens`: são duas funções diferentes, e um controle de paginação
 * que precisasse ler dentro do painel para saber quantas páginas existem estaria acoplado ao painel.
 *
 * **`totalNoCorte` é eco.** Ele volta para que o cliente copie **um** campo em todo link, sempre o mesmo.
 * Sem o eco, o controle teria dois números parecidos na mão — `total` (recalculado, menor a cada saída) e
 * o da primeira página — e escolher o errado **desliga a compensação sem nenhum sintoma**: a lista
 * continua respondendo `200` com vinte itens, pulando os que saíram.
 */
export type PaginaDeOcorrencias = {
  itens: readonly OcorrenciaResumoLida[];
  /** O tamanho do conjunto **filtrado**, no corte, agora. */
  total: number;
  pagina: number;
  limite: number;
  /** O corte, ISO 8601 com fuso. A primeira página o fixa; as seguintes o repassam. */
  ate: string;
  /** O `total` da PRIMEIRA página, ecoado. Na primeira, é o próprio `total`. */
  totalNoCorte: number;
  /** `max(0, totalNoCorte − total)` — quanto o conjunto encolheu. Não custa consulta. */
  saidasDesdeOCorte: number;
  /** Quantas nasceram depois do corte **e casam com o recorte**. */
  novasDesdeOCorte: number;
  contagens: ContagensDoPainel;
  visibilidadeAplicada: VisibilidadeAplicada;
};

/**
 * `GET /ocorrencias` — e a **estrada direta** de T-03, que é a mesma função.
 *
 * **A visibilidade desce até o `where`, e isso não é otimização.** Em T-05 ela é uma pergunta sobre *uma*
 * ocorrência e pode ser respondida depois de ler. Numa lista, não: filtrar depois de paginar devolveria
 * páginas de tamanho aleatório e uma última página falsamente vazia. Por isso ela chega aqui como
 * `podeLerTodas` — calculado por `vinculo.pode("ocorrencia.ler_todas")`, nunca pelo papel (contrato §4.5)
 * — e sai como `autorPessoaId` no filtro.
 *
 * **Duas consultas, e a segunda depende da primeira** (item 14b, 09/09/2026). O painel vem antes porque
 * é dele que sai o `total`, e é do `total` que sai o deslocamento compensado. A alternativa — as duas em
 * paralelo — obrigaria a listar duas vezes.
 *
 * **A compensação de deslocamento é o que esta função tem de mais importante** (§3.3 da spec do 14b). O
 * corte imobiliza a fronteira superior do conjunto — `registrada_em` nunca muda — mas **não** imobiliza a
 * pertinência de cada item: o Gestor que tria enquanto navega faz o conjunto `?status=aberta` encolher, e
 * um deslocamento cru pularia exatamente os itens que ele ainda não viu. **Pular é pior que duplicar:**
 * duplicata se percebe e se ignora; ocorrência pulada numa fila de triagem não é atendida e ninguém
 * descobre.
 *
 * A garantia, enunciada: **se nada REENTRAR no conjunto filtrado dentro do corte, nenhum item é pulado** —
 * o deslocamento compensado é sempre menor ou igual à posição do primeiro item ainda não visto, e o preço
 * é rever, no máximo, os itens que saíram depois de onde o leitor parou. **Vale em qualquer
 * profundidade**, não só entre a página 1 e a 2: as saídas contadas desde o corte incluem as de dentro do
 * trecho já lido e as de depois dele, e o recuo nunca ultrapassa a fronteira do não visto.
 *
 * Para `?status=aberta` a garantia é **exata**, por construção da máquina de estados: nenhuma transição
 * leva a `aberta`, e nascimento novo está fora do corte. Onde ela afrouxa — filtros com reentrada, como
 * `?status=pausada` — é a premissa **P6**.
 */
export async function listarOcorrencias(
  repositorio: RepositorioEscopadoDeOcorrencias,
  quem: QuemPergunta,
  pagina: {
    limite?: number;
    pagina?: number;
    ate?: string;
    totalNoCorte?: number;
    filtro?: FiltroDeOcorrencias;
    /** A ordem da página (item 67). **Vai só para `listar`**: ordem não muda contagem nenhuma. */
    ordenacao?: OrdenacaoDeOcorrencias;
    /** Só o teste passa. **Um relógio, lido uma vez** — o mesmo instante corta as duas consultas. */
    agora?: string;
  } = {},
): Promise<PaginaDeOcorrencias> {
  const limite = pagina.limite ?? LIMITE_PADRAO;
  const numeroDaPagina = pagina.pagina ?? 1;

  // **A primeira página FIXA o corte; as seguintes o repassam.** É a única linha da listagem em que o
  // relógio entra, e ela é lida **uma vez**: as duas consultas recebem o mesmo texto, e é isso que
  // garante que o `total` descreva exatamente o conjunto de onde a página saiu.
  const ate = pagina.ate ?? pagina.agora ?? new Date().toISOString();

  /**
   * **Duas coisas produzem `apenas_minhas`, e só uma delas é permissão.**
   *
   * A primeira é não ter `ocorrencia.ler_todas` — a regra de visibilidade da primeira entrega. A segunda é
   * o `?autor=eu` do item 15, que é como *"o síndico morador"* vê as próprias **sem um segundo vínculo**
   * (contrato §8.5). Quem já só vê as próprias não muda de nada ao pedir: o parâmetro *"só faz diferença
   * para quem tem `ler_todas`"* (critério 28.1).
   */
  /**
   * **A aba do item 87 troca o recorte da página, e só o da página.** O conjunto é *"compartilhadas
   * comigo"*, que por definição quem pergunta pode ler — então o filtro de autor sai da página. O painel
   * NÃO muda: ele continua recortado pela permissão, e o `contar` recebe o recorte da aba à parte.
   */
  const compartilhadaComPessoaId =
    pagina.filtro?.compartilhadasComigo === true ? quem.pessoaId : undefined;

  const autorPessoaId =
    compartilhadaComPessoaId !== undefined
      ? undefined
      : quem.podeLerTodas && pagina.filtro?.apenasDoAutor !== true
        ? undefined
        : quem.pessoaId;

  /**
   * **O painel recorta por PERMISSÃO e não pelo pedido** — §3.6 da spec do 14b, e a diferença é a razão
   * de o número existir. Se o painel obedecesse a `?autor=eu`, `contagens.minhas` seria igual a `total`
   * sempre que o recorte estivesse ligado: o número que serve para **ligar** o recorte deixaria de
   * existir assim que ele fosse ligado.
   *
   * **Para o Solicitante os dois coincidem** — `podeLerTodas` é falso, e os dois viram `quem.pessoaId`.
   * É essa coincidência que o teste do 14b.6 fixa.
   */
  const visibilidadeDoPainel = quem.podeLerTodas ? undefined : quem.pessoaId;

  /**
   * **E o `total` viaja com o recorte DA PÁGINA, não com o do painel.**
   *
   * O `total` saiu da consulta da página e virou o quinto `FILTER` da do painel, e com a mudança ele
   * herdaria o recorte errado: o painel ignora `?autor=eu` de propósito, e o `total` **não pode**, porque
   * ele descreve a lista que está na tela e é o insumo da compensação. Um Gestor com `?autor=eu`
   * receberia o `total` da organização inteira ao lado das próprias — a navegação ofereceria páginas que
   * não existem, e `saidas` mediria a organização em vez do recorte.
   */
  const contagens = await repositorio.contar({
    ...(visibilidadeDoPainel === undefined ? {} : { autorPessoaId: visibilidadeDoPainel }),
    ...(autorPessoaId === undefined ? {} : { autorPessoaIdDaPagina: autorPessoaId }),
    ...(compartilhadaComPessoaId === undefined
      ? {}
      : { compartilhadaComPessoaIdDaPagina: compartilhadaComPessoaId }),
    pessoaIdDeQuemPergunta: quem.pessoaId,
    ate,
    ...(pagina.filtro === undefined ? {} : { filtro: pagina.filtro }),
  });

  const total = contagens.totalFiltrado;
  // Ausente é o caso da primeira página — e o do link colado à mão, que degrada para o deslocamento cru.
  const totalNoCorte = pagina.totalNoCorte ?? total;

  /**
   * **Duas linhas de aritmética, e nenhuma consulta.** É por isso que esta saída foi a escolhida e não
   * uma das caras (§3.3 da spec): ela troca um pulo garantido por, no máximo, uma repetição.
   *
   * **Os dois `Math.max` são a guarda contra `totalNoCorte` hostil**, que vem do cliente e é **dica, não
   * autoridade**: valor absurdamente alto limita o deslocamento em zero e repete a primeira página — feio
   * e inofensivo; valor menor que o total atual zera as saídas e devolve o deslocamento cru. **Nenhum
   * valor produz salto além do que um deslocamento sem compensação já produziria**, e é isso que torna o
   * parâmetro aceitável como público.
   */
  const saidasDesdeOCorte = Math.max(0, totalNoCorte - total);
  const deslocamento = Math.max(0, (numeroDaPagina - 1) * limite - saidasDesdeOCorte);

  const linhas = await repositorio.listar({
    ...(autorPessoaId === undefined ? {} : { autorPessoaId }),
    ...(compartilhadaComPessoaId === undefined ? {} : { compartilhadaComPessoaId }),
    limite,
    deslocamento,
    ate,
    ...(pagina.filtro === undefined ? {} : { filtro: pagina.filtro }),
    ...(pagina.ordenacao === undefined ? {} : { ordenacao: pagina.ordenacao }),
  });

  return {
    itens: linhas,
    total,
    pagina: numeroDaPagina,
    limite,
    ate,
    totalNoCorte,
    saidasDesdeOCorte,
    novasDesdeOCorte: contagens.novas,
    contagens: {
      todas: contagens.todas,
      minhas: contagens.minhas,
      emAberto: contagens.emAberto,
      semResponsavel: contagens.semResponsavel,
    },
    visibilidadeAplicada:
      compartilhadaComPessoaId !== undefined
        ? "compartilhadas_comigo"
        : autorPessoaId === undefined
          ? "todas"
          : "apenas_minhas",
  };
}
