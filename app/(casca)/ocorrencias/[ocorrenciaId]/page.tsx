import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { NaoAutenticado } from "@/aplicacao/contexto";
import {
  OcorrenciaNaoEncontrada,
  verComentarios,
  verLinhaDoTempo,
  type EventoLido,
} from "@/aplicacao/ocorrencia";
import { listarVinculos } from "@/aplicacao/organizacao";
import { AvisoDeAvaliacao } from "@/interface/componentes/aviso-de-avaliacao";
import { BarraDeAcoes } from "@/interface/componentes/barra-de-acoes";
import type { Candidato } from "@/interface/componentes/busca-de-candidatos";
import { CabecalhoDaOcorrencia } from "@/interface/componentes/cabecalho-da-ocorrencia";
import { CampoDeSolucaoAplicada } from "@/interface/componentes/campo-de-solucao-aplicada";
import { CaminhoDaPagina } from "@/interface/componentes/caminho-da-pagina";
import {
  Cartao,
  CorpoDoCartao,
  FaixaDoCartao,
  TITULO_DA_FAIXA,
} from "@/interface/componentes/cartao";
import { CICLO } from "@/interface/componentes/ciclo";
import { ConversaDaOcorrencia } from "@/interface/componentes/conversa-da-ocorrencia";
import { dataEHora } from "@/interface/componentes/datas";
import { FalhaDoCartao } from "@/interface/componentes/falha-do-cartao";
import { FichaDeLocal } from "@/interface/componentes/ficha-de-local";
import { AvatarDePessoa, FichaDePessoa } from "@/interface/componentes/ficha-de-pessoa";
import { FotoAmpliavel } from "@/interface/componentes/foto-ampliavel";
import { FRASES_DE_FALHA } from "@/interface/componentes/frases-de-falha";
import {
  autoria,
  fraseDaAtribuicao,
  fraseDaMensagem,
  fraseDaTransicao,
  partesDaAutoria,
} from "@/interface/componentes/linha-do-tempo";
import { ModalDeAtribuicao } from "@/interface/componentes/modal-de-atribuicao";
import { ModalDeAvaliacao } from "@/interface/componentes/modal-de-avaliacao";
import { ModalDeMotivo } from "@/interface/componentes/modal-de-motivo";
import { ModalDeObservacao } from "@/interface/componentes/modal-de-observacao";
import { ModalDeResolucao } from "@/interface/componentes/modal-de-resolucao";
import { OcorrenciaNaoEncontradaNaTela } from "@/interface/componentes/ocorrencia-nao-encontrada";
import { ReguaDoCiclo } from "@/interface/componentes/regua-do-ciclo";
import type { TextosDoRetorno } from "@/interface/componentes/retorno-de-acao";
import {
  LINHA_DA_PRIORIDADE,
  SeletorDePrioridade,
} from "@/interface/componentes/seletor-de-prioridade";
import {
  acoesDaBarra,
  AVISO_DE_VISIBILIDADE,
  encurtarParaOCaminho,
  AVISO_PARA_QUEM_NAO_GESTIONA,
  RETORNO_DA_MENSAGEM,
  RETORNO_DO_COMANDO,
  retornoDoComando,
  rotuloDeComando,
  rotuloDePrioridade,
  rotuloDoCampoDeConversa,
  rotulosDeStatus,
  vazioDaBarra,
  vazioDaConversa,
} from "@/interface/componentes/rotulos";
import { buttonVariants } from "@/interface/componentes/ui/button";
import { Skeleton } from "@/interface/componentes/ui/skeleton";
import { cn } from "@/interface/componentes/utilitarios";
import {
  lerOcorrenciaDaTela,
  novoTraceId,
  registrarFalha,
  resolverEscopoParaTela,
  tituloDeAbaDaOcorrencia,
} from "@/interface/http";
import {
  lenteDeRotulo,
  opcoesDeMotivoCancelamento,
  opcoesDeMotivoPausa,
  opcoesDePrioridade,
  projetarEventoDaLinhaDoTempo,
  projetarOcorrenciaDetalhe,
  projetarPaginaDeComentarios,
  segundaLinhaDeMotivo,
  type LenteDeRotulo,
} from "@/interface/projecoes";

/**
 * **T-05 · Ocorrência**, na forma mínima que o critério 11.7 encomenda: os **blocos 1 e 2** do
 * inventário — identidade e conteúdo. A linha do tempo (bloco 3) é o item 29, a conversa (bloco 4) é o
 * 30, e os onze comandos são os itens 16 a 27.
 *
 * **Endereço próprio, e é o mais importante do produto** (inventário): `/ocorrencias/{id}` é *"o link
 * que substitui descrever a ocorrência por WhatsApp — o comportamento exato que o produto veio
 * substituir"*. Por isso ele resolve de verdade e sobrevive a um recarregar, em vez de ser pintado com o
 * payload do `201` e quebrar na segunda visita.
 *
 * **A leitura vai pela estrada direta**, como T-09 e o shell: `app/` não monta repositório, e um `fetch`
 * interno custaria o salto HTTP que a §5 do contrato recusou.
 *
 * **Sem saída de retorno no conteúdo** (guia §7, decidido em 16/09/2026, critério 44g.10): dentro da casca,
 * quem navega é a barra lateral, e o botão voltar do navegador devolve a lista com o filtro que ela tinha,
 * porque o filtro mora no endereço da lista.
 */
export const dynamic = "force-dynamic";

/**
 * **A aba leva o título da ocorrência** (item 90, spec §4.3). Três abas abertas durante a demonstração é o
 * cenário que a auditoria descreve, e `Ocorrência` três vezes não o resolve.
 *
 * **Sem ida a mais ao banco:** `lerOcorrenciaDaTela` é `cache()` do React, e a página abaixo chama a mesma
 * função com o mesmo id. **Sem vazar existência:** a autorização é a mesma da página, e o que ela esconde
 * sai como o recuo `Ocorrência`.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ ocorrenciaId: string }>;
}): Promise<Metadata> {
  const { ocorrenciaId } = await params;
  return { title: await tituloDeAbaDaOcorrencia(ocorrenciaId, "Ocorrência") };
}

/**
 * O papel **em palavra**, para descer por prop ao modal.
 *
 * **Mora aqui e não em `rotulos.ts`** porque tem um consumidor só, e porque a lista de papéis é do módulo
 * de organização, não do de ocorrência. T-08 mostra papel com `rotuloDoPapel` de
 * `frases-de-participantes.ts` (item 44j), e este é a segunda cópia — o lugar dos dois é um módulo, e
 * **isso é achado, não conserto**.
 */
const PAPEL_EM_PALAVRA: Readonly<Record<string, string>> = {
  gestor: "Gestor",
  encarregado: "Encarregado",
  solicitante: "Solicitante",
};

export default async function Ocorrencia({
  params,
}: {
  params: Promise<{ ocorrenciaId: string }>;
}) {
  let escopo;
  try {
    escopo = await resolverEscopoParaTela("ocorrencia.ler_propria");
  } catch (erro) {
    if (erro instanceof NaoAutenticado) redirect("/entrar");
    throw erro;
  }

  if (escopo.situacao === "sem-organizacao") redirect("/organizacao");
  if (escopo.situacao === "sem-permissao") redirect("/");

  const { ocorrenciaId } = await params;

  /**
   * **Montado uma vez, e desde o item 90 há um caminho só até ele:** o `null` de `lerOcorrenciaDaTela`,
   * que já absorveu as três causas — não existe, é de outra organização, ou quem lê não pode. As três dão
   * a mesma resposta, de propósito (§6.3).
   *
   * **`resolucao` sai de `escopo` para um `const`** porque a estreiteza de um `let` não sobrevive dentro
   * de uma função aninhada — e é ela que a arrow abaixo captura.
   *
   * **`projetarContexto` roda só quando o erro acontece:** ela está dentro da arrow, não fora. É um `map`
   * em memória sobre vínculos já lidos, mas o caminho feliz não paga nem isso.
   */
  const resolucao = escopo.resolucao;
  const naoEncontrada = () => {
    const traceId = novoTraceId();

    // A estrada direta não passa pelo `comContexto`, então o `traceId` nasce aqui — e a linha de log é a
    // MESMA que `registrarEResponder` escreve, pela mesma função. Nunca uma segunda cópia do formato.
    registrarFalha(new OcorrenciaNaoEncontrada(), `/ocorrencias/${ocorrenciaId}`, "GET", traceId);

    return (
      <OcorrenciaNaoEncontradaNaTela
        organizacaoAtiva={
          resolucao.ativo === null ? null : { nome: resolucao.ativo.organizacao.nome }
        }
        traceId={traceId}
      />
    );
  };

  // **`escopo.ctx`, nao `escopo.resolucao`.** Depois dos dois `if` acima o TypeScript ja estreitou
  // `escopo` para a variante `"pronto"`, que carrega `ctx` — e `ContextoDaRequisicao` e quem tem
  // `pessoaId` e `vinculo`. `ResolucaoDeContexto` **nao tem `pessoaId`**: la ele mora em
  // `resolucao.sessao.pessoaId`, e `ativo` e `VinculoNaOrganizacao`, o que ainda exigiria um `!`.
  const vinculo = escopo.ctx.vinculo;

  /**
   * **A organização com que ESTA renderização aconteceu** — a afirmação da §4.3 (item 7b, critério
   * 7b.6).
   *
   * Desce por propriedade, e não é lida do cookie na hora do clique: numa aba deixada aberta em A
   * enquanto outra trocou para B, o cookie já diz B e a afirmação bateria consigo mesma. O que se
   * afirma é o que está **na tela**.
   */
  const organizacaoId = vinculo.organizacaoId;
  // **A regra é uma função da Aplicação, chamada por quem tem o `Vinculo`.** Ela estava copiada aqui e
  // em `app/api/ocorrencias/[ocorrenciaId]/route.ts`; o item 13b seria a terceira cópia.
  const quem = {
    pessoaId: escopo.ctx.pessoaId,
    podeLerTodas: vinculo.pode("ocorrencia.ler_todas"),
  };

  /**
   * **A linha do tempo parte AQUI, antes do `await` do detalhe — e é a segunda metade do critério 29.5.**
   *
   * A promessa não é esperada nesta função: ela desce para dentro do `<Suspense>`, e quem a espera é o
   * filho. É o idioma de T-03 (`app/ocorrencias/page.tsx:118-127`), e é o que faz os blocos 1 e 2
   * pintarem sem esperar o banco responder a segunda pergunta.
   *
   * **Custo declarado, porque é real:** a página passa a fazer **dois `porId` concorrentes** — um do
   * detalhe, outro dentro de `verLinhaDoTempo`. É exatamente o que o mundo de três requisições HTTP faria
   * (cada uma se autoriza sozinha), e ele **não soma latência**, porque as duas partem juntas; soma carga
   * no banco. A alternativa — esperar o detalhe para só então pedir a linha do tempo — é serializar duas
   * idas sob cold start, que é o que o critério 29.5 existe para impedir.
   *
   * **O `catch` de uma linha não é redundante.** Se a ocorrência não existir, ou se `podeLerOcorrencia`
   * recusar, esta função **retorna** e ninguém mais espera esta promessa — que vai rejeitar com a mesma
   * `OcorrenciaNaoEncontrada` e derrubaria o processo como rejeição não tratada. Anexar um tratador a
   * marca como tratada; **a promessa original continua rejeitando para o `<Suspense>`**, porque `catch`
   * devolve uma promessa nova em vez de alterar esta. **E quem recebe essa rejeição é a `FalhaDoCartao`
   * que envolve cada `<Suspense>`** (item 90): a falha fica no cartão que esperava o dado, e o relato, a
   * régua do cabeçalho e o selo continuam na tela.
   */
  const linhaDoTempoPedida = verLinhaDoTempo(escopo.repos.ocorrencias, ocorrenciaId, quem);
  linhaDoTempoPedida.catch(() => undefined);

  /**
   * **A terceira requisição da tela, e é a que o inventário já contava** — critério 29.5, *"as três
   * disparam juntas"*. Mesmo idioma do bloco 3: parte **antes** do `await` do detalhe e desce por
   * propriedade para dentro do `<Suspense>`, com o `catch` de uma linha que a marca como tratada sem
   * alterar a rejeição.
   *
   * **A projeção acontece aqui, no servidor**, porque projeção é da camada de Interface e o que atravessa
   * a fronteira para o componente de cliente precisa ser serializável.
   *
   * **Custo declarado, porque é real:** T-05 passa a abrir com **três `porId` concorrentes** — o do
   * detalhe, o de `verLinhaDoTempo` e o de `verComentarios`. É exatamente o que o mundo de três
   * requisições HTTP faria, cada uma se autorizando sozinha, e **não soma latência**, porque as três
   * partem juntas; soma carga. É o achado **A-3** da spec, e o conserto é maior que esta fatia.
   */
  const conversaPedida = verComentarios(escopo.repos.ocorrencias, ocorrenciaId, quem, {}).then(
    projetarPaginaDeComentarios,
  );
  conversaPedida.catch(() => undefined);

  /**
   * **A mesma leitura que o `generateMetadata` fez**, pela função `cache()` do React (item 90): uma ida ao
   * banco atende as duas. Ela já traz dentro o `podeLerOcorrencia`, então **inexistente, de outra
   * organização e sem permissão chegam aqui como o mesmo `null`** — que é a indistinguibilidade da §6.3, e
   * era o que os dois caminhos de antes construíam à mão. A tela **diz em qual organização você está**,
   * que é a compensação que o contrato comprou (critério 28.3).
   */
  const lida = await lerOcorrenciaDaTela(ocorrenciaId);
  if (lida === null) return naoEncontrada();

  const detalhe = projetarOcorrenciaDetalhe(lida, {
    pessoaId: escopo.ctx.pessoaId,
    permissoes: vinculo.permissoes,
  });

  /**
   * **A tela renderiza exatamente `acoesDisponiveis`** — e o filtro por rótulo não é uma segunda regra:
   * é a forma do comando na tela. Dois deles nunca serão botão (`alterar-prioridade` é seletor,
   * `registrar-solucao-aplicada` é campo), e os que ainda não existem não têm rótulo porque não existem.
   */
  const acoes = detalhe.acoesDisponiveis
    // **O retorno é anotado como `string`, e não é enfeite:** sem a anotação o `map` infere `comando` como
    // o literal `Comando`, e aí o guarda de tipo abaixo — que promete `{ comando: string }` — deixa de ser
    // atribuível ao próprio parâmetro (`TS2677`). Anotar aqui mantém o Domínio fora do `import` de `app/`.
    .map(
      (comando): { comando: string; rotulo: string | null; retorno: TextosDoRetorno | null } => ({
        comando,
        rotulo: rotuloDeComando(comando),
        retorno: retornoDoComando(comando),
      }),
    )
    .filter(
      (acao): acao is { comando: string; rotulo: string; retorno: TextosDoRetorno | null } =>
        acao.rotulo !== null,
    );

  /**
   * **A coluna que esta tela inteira fala** — item 31. Uma leitura, três consumidores: o `statusRotulo`
   * do bloco 1a (que já vem projetado no detalhe, pela derivação de `QuemLe`), o mapa que desce até os
   * modais, e a linha do tempo do bloco 3.
   */
  const lente = lenteDeRotulo(vinculo.permissoes);

  // Os dois mapas descem prontos: o navegador não monta rótulo, e as duas colunas respondem perguntas
  // diferentes — ver `rotulos.ts`.
  const rotulos = rotulosDeStatus(lente);

  /**
   * **O mesmo mapa, com a chave larga.** A régua e o selo recebem `status: string`, porque `app/` não
   * importa o Domínio (ADR-0006) — e `rotulos` é `Record<StatusOcorrencia, string>`, que **não se indexa
   * com `string`** sob `strict`. A atribuição anotada é o que alarga o tipo sem um `as`, usando a
   * assinatura de índice implícita que o TypeScript dá a tipos mapeados.
   *
   * **O `?? status` não é defensivo por gosto:** com `noUncheckedIndexedAccess` a leitura devolve
   * `string | undefined`, e o padrão tem de ser algo — o próprio nome interno, que é pior que o rótulo e
   * melhor que a palavra `undefined` na tela.
   */
  const rotuloLargo: Readonly<Record<string, string>> = rotulos;
  const nomeDoStatus = (status: string): string => rotuloLargo[status] ?? status;

  /**
   * **A lista de candidatos vem pela estrada direta**, como o resto de `app/`: a página chama
   * `listarVinculos`, não um `fetch` interno — *"`app/` não monta repositório, e um `fetch` interno
   * custaria o salto HTTP que a §5 do contrato recusou"*. O critério 19.3 diz *"a lista de candidatos é
   * `GET /vinculos`"*, e é a **mesma leitura**: aquele `route.ts` chama esta função.
   *
   * **Só quando `atribuir-responsavel` está em `acoesDisponiveis`.** É uma consulta a mais por abertura de
   * T-05, e ela não roda para o Solicitante nem em estado terminal — que é o caso dominante da tela.
   *
   * **A permissão que guarda a leitura é `vinculo.gerir`**, a mesma do endpoint. Hoje ela anda junto com
   * `ocorrencia.atribuir` (as duas são do Gestor, no mesmo `SO_DO_GESTOR`), e **o dia em que se separarem
   * é o dia em que `acoesDisponiveis` precisará de uma quarta fonte**. Fica declarado como suposição.
   */
  const podeAtribuir =
    acoes.some((acao) => acao.comando === "atribuir-responsavel") && vinculo.pode("vinculo.gerir");

  /**
   * **Quem gestiona, derivado UMA vez e lido por UM consumidor** — o aviso de visibilidade do modal de
   * cancelamento (critério 18.7). Eram dois até o item 27, que removeu o parâmetro `ehGestor` de
   * `vazioDaBarra`; o próprio `rotulos.ts` documenta a remoção, e o comentário aqui ficou para trás.
   * *(Corrigido no item 30, achado A-6 da spec.)*
   *
   * **`vinculo.pode("…")` com string literal é o idioma que esta página já usa** com `"vinculo.gerir"`,
   * logo acima, e com `"ocorrencia.ler_todas"`. É o que mantém `app/` sem `import` do Domínio desde o
   * item 11.
   *
   * **É `cancelar_qualquer`, e não um papel:** permissão é lista, nunca papel (contrato §4.5). O
   * Encarregado tem lista vazia e cai no mesmo ramo do Solicitante — e nem chega a abrir T-05.
   */
  const ehGestor = vinculo.pode("ocorrencia.cancelar_qualquer");

  /**
   * **Quem lê é o autor?** — lido por TRÊS consumidores: o título do bloco da avaliação (*"Sua
   * avaliação"* × *"Avaliação do solicitante"*, item 27) e as **duas** frases da conversa (o vazio e o
   * rótulo do campo, critério 30.4). **O convite a avaliar NÃO usa isto:** ele usa `acoesDisponiveis`,
   * que já cruza autoria com *"ainda não avaliou"*.
   */
  const ehAutor = detalhe.autor.pessoaId === escopo.ctx.pessoaId;

  const candidatos: readonly Candidato[] = podeAtribuir
    ? (await listarVinculos(escopo.repos.vinculos)).map((lido) => ({
        pessoaId: lido.pessoa.pessoaId,
        nome: lido.pessoa.nome,
        // **A palavra, montada aqui.** O navegador não monta rótulo, e `contatos[]` não desce: é dado
        // pessoal sob o RNF10, e a projeção estreita é o que impede o telefone de todo mundo de viajar.
        papel: PAPEL_EM_PALAVRA[lido.papel] ?? lido.papel,
        area: lido.area?.nome ?? null,
      }))
    : [];

  /**
   * **A barra só renderiza o que ela consegue renderizar.** Sem o modal, `atribuir-responsavel` viraria um
   * botão de disparo direto que faria `POST` sem `responsavelPessoaId` e levaria `400` — hoje inalcançável
   * (quem tem `ocorrencia.atribuir` tem `vinculo.gerir`), e amanhã não. É a mesma natureza do filtro por
   * rótulo lá em cima: não é uma segunda regra, é a **forma** do comando na tela.
   */
  const renderizaveis = acoes.filter(
    (acao) => acao.comando !== "atribuir-responsavel" || podeAtribuir,
  );

  /**
   * **`avaliar` não chega à barra** (item 66). O gatilho dele mora na faixa de avaliação, que é o único
   * *Avaliar* da tela. O vazio continua olhando `renderizaveis`: em `resolvida`, para a autora que ainda
   * não avaliou, a barra fica sem botão **e** sem frase, porque a ação da tela está na faixa.
   */
  const naBarra = renderizaveis.filter((acao) => acao.comando !== "avaliar");

  /**
   * **Qual ação ganha ênfase, e o que vai para o menu — uma fonte só.**
   *
   * A tela tinha **duas**: `acoes[0]?.comando` decidia a `variante` do modal, e `indice === 0` decidia a
   * `variant` do botão dentro da barra. Elas concordavam por sorte. Agora as duas leem o mesmo valor, e a
   * regra mora em `rotulos.ts` — que é o módulo do que a tela sabe sobre comandos. `acaoPrimaria`
   * continua sendo a dona da tabela `ACAO_PRIMARIA`; `acoesDaBarra` a chama e acrescenta a conta de
   * largura — **três renderizáveis ou mais → primário + *"Mais ações ▾"*** (item 23).
   *
   * **O R-08 morde aqui, e agora tem estado real que o prova:** em `em_analise` **sem** responsável,
   * `pausar` é permitido pela máquina de estados, e a derivação por `transicaoPermitida` — que o item
   * 22 recusou — daria ***Pausar*** como ação em destaque numa ocorrência que ninguém pegou ainda. A
   * tabela dá ***Atribuir***.
   */
  const { destaque: primario, emMenu } = acoesDaBarra(
    detalhe.status,
    naBarra.map((acao) => acao.comando),
  );

  /** A variante do gatilho de cada comando: no menu, é `DropdownMenuItem`; fora dele, botão. */
  function varianteDe(comando: string): "primario" | "secundario" | "menu" {
    if (emMenu.includes(comando)) return "menu";
    return primario === comando ? "primario" : "secundario";
  }

  /**
   * **Qual frase o vazio da barra mostra — e a moldura que vem com ela.**
   *
   * `null` quando há botão: a tela não mostra frase de vazio e barra ao mesmo tempo. **A regra mora em
   * `rotulos.ts`**, e a página não sabe o que é terminal — é a mesma disciplina do `acaoPrimaria`, e é o
   * que mantém `app/` sem `import` do Domínio desde o item 11.
   */
  const vazio = renderizaveis.length === 0 ? vazioDaBarra(detalhe.status) : null;

  /**
   * **Comando com formulário se monta sozinho.** A barra recebe o nó pronto; ela não conhece comando
   * nenhum e não ganha um `if` por comando.
   *
   * **`iniciar-atendimento` entra SEMPRE, e `atribuir-responsavel` não.** A diferença é custo: o de
   * atribuição precisa da lista de candidatos, que é uma consulta a mais; este não precisa de nada. Quem
   * decide se algum deles **aparece** continua sendo `acoesDisponiveis`.
   */
  const formularios = {
    "iniciar-atendimento": (
      <ModalDeObservacao
        ocorrenciaId={detalhe.id}
        comando="iniciar-atendimento"
        titulo="Iniciar atendimento"
        descricao="O trabalho começa agora."
        rotuloDoGatilho="Iniciar atendimento"
        rotuloDoCampo="Observação (opcional)"
        rotuloDeConfirmar="Iniciar"
        verboEnviando="Iniciando…"
        variante={primario === "iniciar-atendimento" ? "primario" : "secundario"}
        rotulosDeStatus={rotulos}
        organizacaoId={organizacaoId}
        retorno={RETORNO_DO_COMANDO["iniciar-atendimento"]}
      />
    ),
    /**
     * **Entra SEMPRE, como o de `iniciar-atendimento`.** A diferença de custo continua sendo a mesma: o
     * modal de atribuição precisa da lista de candidatos, que é uma consulta a mais; este não precisa de
     * nada além do que a página já leu. Quem decide se ele **aparece** continua sendo `acoesDisponiveis`.
     */
    resolver: (
      <ModalDeResolucao
        ocorrenciaId={detalhe.id}
        // **Hoje sempre `null`** — nada escreve a coluna antes desta fatia. Passa a ter caso no item 25.
        solucaoAplicadaAtual={detalhe.solucaoAplicada}
        variante={primario === "resolver" ? "primario" : "secundario"}
        rotulosDeStatus={rotulos}
        organizacaoId={organizacaoId}
        retorno={RETORNO_DO_COMANDO.resolver}
      />
    ),
    /**
     * **Entra SEMPRE, como os dois de cima.** Ele não precisa de consulta nenhuma além do que a página
     * já leu; quem decide se **aparece** continua sendo `acoesDisponiveis`.
     *
     * **Os quatro rótulos descem PRONTOS** — `nomeDoMotivoPausa`, e não `rotuloDeMotivoPausa`: o
     * primeiro responde *"o que ela está esperando?"*, que é a pergunta de um seletor; o segundo
     * responde *"o que aconteceu com a sua ocorrência"*, e dentro de um formulário chamado **Motivo**
     * seria uma frase respondendo a outra pergunta.
     */
    pausar: (
      <ModalDeMotivo
        ocorrenciaId={detalhe.id}
        comando="pausar"
        titulo="Pausar"
        descricao="O que a ocorrência está esperando."
        rotuloDoGrupo="Motivo"
        motivos={opcoesDeMotivoPausa()}
        rotuloDoGatilho="Pausar"
        rotuloDeConfirmar="Pausar"
        verboEnviando="Pausando…"
        avisoDeVisibilidade={AVISO_DE_VISIBILIDADE}
        variante={varianteDe("pausar")}
        rotulosDeStatus={rotulos}
        organizacaoId={organizacaoId}
        retorno={RETORNO_DO_COMANDO.pausar}
      />
    ),
    /**
     * **O quinto modal, e ele é o `ModalDeObservacao` reusado INTEIRO** — zero componente novo, zero
     * variante nova, zero linha alterada nele. O componente foi escrito parametrizado exatamente para
     * isto: *"o modal de `iniciar-atendimento` (item 22) e o de `retomar` (item 24) diferem em três
     * strings"* (o parágrafo *"Um componente parametrizado"* do cabeçalho de `modal-de-observacao.tsx`).
     *
     * **A descrição NÃO nomeia o destino, e é o critério 24.2 na tela.** *"Volta para Em atendimento"*
     * seria informar antes o que o critério manda descobrir depois — e seria uma frase que esta tela
     * não tem como saber se é verdade, porque ela não lê a trilha.
     *
     * **A ternária, e não `varianteDe`:** `ModalDeObservacao` aceita `"primario" | "secundario"`, e
     * `varianteDe` devolve as três — passá-lo não compila. É o mesmo que `iniciar-atendimento` e
     * `resolver` já fazem, logo acima.
     *
     * **O item 18 conferiu e NÃO há o que reabrir**, ao contrário do que este comentário prometia.
     * `pausada` passou mesmo a ter três renderizáveis — `atribuir`, `retomar` e `cancelar` —, e ainda
     * assim `retomar` **não pode** cair no menu: `ACAO_PRIMARIA.pausada === "retomar"`, e `acoesDaBarra`
     * remove o destaque de `emMenu` por construção. Sempre que `retomar` é renderizável, ele é o
     * destaque. A prova completa está no cabeçalho de `barra-de-acoes.tsx`, e virou teste.
     *
     * **Entra SEMPRE, como os três de cima**: não precisa de consulta nenhuma além do que a página já
     * leu. Quem decide se ele **aparece** continua sendo `acoesDisponiveis`.
     */
    retomar: (
      <ModalDeObservacao
        ocorrenciaId={detalhe.id}
        comando="retomar"
        titulo="Retomar"
        descricao="A ocorrência volta ao ponto em que estava antes da pausa."
        rotuloDoGatilho="Retomar"
        rotuloDoCampo="Observação (opcional)"
        rotuloDeConfirmar="Retomar"
        verboEnviando="Retomando…"
        variante={primario === "retomar" ? "primario" : "secundario"}
        rotulosDeStatus={rotulos}
        organizacaoId={organizacaoId}
        retorno={RETORNO_DO_COMANDO.retomar}
      />
    ),
    /**
     * **O quinto modal, e ele é o `ModalDeMotivo` reusado INTEIRO** — o mesmo componente do `pausar`,
     * com **uma** propriedade opcional a mais na opção (`descricao`) e **uma** propriedade a mais no
     * componente (`avisoDeVisibilidade`). Zero componente novo.
     *
     * **A lista é filtrada por PERMISSÃO, e não por `ehGestor`:** `opcoesDeMotivoCancelamento` recebe
     * `vinculo.permissoes` e consulta `motivosPermitidos` — a **mesma** função que o comando de
     * aplicação usa para lançar o `422`. Duas regras sobre quais motivos são de quem divergiriam, e a
     * divergência seria um motivo oferecido em tela que o servidor recusa no clique.
     *
     * **O aviso muda de sujeito — critério 18.7**, e esta é a primeira vez no produto em que um texto de
     * tela depende de quem está olhando. O predicado é **ser Gestor, não ser autor**: um Gestor que
     * criou a própria ocorrência lê a frase do Gestor, porque quem lê a observação dele são os Gestores.
     *
     * **`varianteDe` serve aqui**, ao contrário do `retomar`: `ModalDeMotivo` aceita as três variantes
     * desde o item 23, e `cancelar` **cai no menu nos quatro estados** — ele não é `ACAO_PRIMARIA` de
     * nenhum, e isso é correto: cancelar nunca é a ação em destaque.
     *
     * **Entra SEMPRE, como os quatro de cima**: não precisa de consulta nenhuma além do que a página já
     * leu. Quem decide se ele **aparece** continua sendo `acoesDisponiveis` — e é ela que esconde o
     * botão do Solicitante autor a partir de `Em atendimento` (critério 18.3).
     *
     * **O botão que confirma é `destructive`** (critério 44g.5): é a ação que cancela.
     */
    cancelar: (
      <ModalDeMotivo
        ocorrenciaId={detalhe.id}
        comando="cancelar"
        titulo="Cancelar a ocorrência"
        descricao="A ocorrência será encerrada sem resolução. Não há como reabrir."
        rotuloDoGrupo="Motivo"
        motivos={opcoesDeMotivoCancelamento(vinculo.permissoes)}
        rotuloDoGatilho="Cancelar"
        rotuloDeConfirmar="Cancelar a ocorrência"
        verboEnviando="Cancelando…"
        avisoDeVisibilidade={ehGestor ? AVISO_DE_VISIBILIDADE : AVISO_PARA_QUEM_NAO_GESTIONA}
        variante={varianteDe("cancelar")}
        rotulosDeStatus={rotulos}
        organizacaoId={organizacaoId}
        retorno={RETORNO_DO_COMANDO.cancelar}
        destrutivo
      />
    ),
    ...(podeAtribuir
      ? {
          "atribuir-responsavel": (
            <ModalDeAtribuicao
              ocorrenciaId={detalhe.id}
              candidatos={candidatos}
              euPessoaId={escopo.ctx.pessoaId}
              responsavelAtualPessoaId={detalhe.responsavel?.pessoaId ?? null}
              rotulosDeStatus={rotulos}
              organizacaoId={organizacaoId}
              variante={varianteDe("atribuir-responsavel")}
            />
          ),
        }
      : {}),
  };

  /**
   * **O título fixo do bloco 3, montado uma vez e usado em três lugares** — a espera, o recuo da falha e
   * o `id` que dá nome acessível à seção (item 90). Sem o `id` a seção perde o nome, então o recuo repete
   * o mesmo `h2` do `fallback` em vez de trocá-lo por uma frase.
   */
  const tituloFixoDaLinhaDoTempo = (
    <h2 id="bloco-linha-do-tempo" className={TITULO_DA_FAIXA}>
      Linha do tempo
    </h2>
  );

  return (
    <div className="flex flex-col gap-6">
      {/* **O caminho** (critério 66.3): o mesmo `CaminhoDaPagina` das telas de participante, com o título
          cortado em 40 caracteres e inteiro no `title`. */}
      <CaminhoDaPagina
        anterior={{ rotulo: "Ocorrências", href: "/ocorrencias" }}
        atual={encurtarParaOCaminho(detalhe.titulo)}
        tituloDoAtual={detalhe.titulo}
      />

      {/* **O cabeçalho: título, selo e ações** (item 66). A barra é montada SEMPRE: o `router.refresh()`
          que o `409` dispara trocaria o ramo do JSX e a frase *"Esta ocorrência mudou enquanto você estava
          olhando"* sumiria no mesmo repinte que a exibiu. */}
      <CabecalhoDaOcorrencia
        titulo={detalhe.titulo}
        status={detalhe.status}
        statusRotulo={detalhe.statusRotulo}
        vazio={vazio}
        acoes={
          <BarraDeAcoes
            ocorrenciaId={detalhe.id}
            acoes={naBarra}
            rotulosDeStatus={rotulos}
            organizacaoId={organizacaoId}
            formularios={formularios}
            primario={primario}
            emMenu={emMenu}
          />
        }
      />

      {/* **A faixa de avaliação, acima das duas colunas** (item 66, spec §3.5): no celular a coluna de
          apoio vem antes da narrativa, e a faixa é o único lugar onde se avalia. A condição é
          `acoesDisponiveis`, e não uma segunda regra na tela. */}
      {detalhe.acoesDisponiveis.includes("avaliar") && (
        <AvisoDeAvaliacao>
          <ModalDeAvaliacao
            ocorrenciaId={detalhe.id}
            variante="primario"
            rotulosDeStatus={rotulos}
            organizacaoId={organizacaoId}
            retorno={RETORNO_DO_COMANDO.avaliar}
          />
        </AvisoDeAvaliacao>
      )}

      {/* **Duas colunas a partir de `lg`, e a de apoio tem 280 px por conta.** Em 1024 px a casca já
          gasta 214 na lateral e 48 no respiro do `<main>`; com 24 de calha, a narrativa fica com 458 —
          mais que os 448 da coluna única de hoje. Com 320 ela ficaria com 418, e a tela estreitaria ao
          ganhar largura.

          **A coluna de apoio vem PRIMEIRO no documento**, porque é o que o inventário exige sem rolar no
          celular — `statusRotulo`, `titulo` e a última entrada da linha do tempo. A partir de `lg` ela é
          **colocada** na segunda coluna da grade. Quem lê por teclado ou por leitor de tela recebe a
          mesma sequência nas duas larguras; o que muda é onde ela é pintada.

          **Os dois invólucros são `<div>`, nunca `<section>`:** seção de layout sem nome só acrescenta
          marco de navegação vazio para quem usa leitor de tela. */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
        <div className="flex flex-col gap-4 lg:col-start-2 lg:row-start-1">
          {/* **A régua do ciclo é o primeiro cartão da coluna** (item 66): o cartão *Situação* saiu, e o
              selo mora no cabeçalho. Ela também carrega a segunda linha do motivo da pausa
              (`notaDaSaida`, critério 31.8), que morava naquele cartão. */}
          <section className="border-linha bg-superficie flex flex-col gap-3 rounded-lg border p-[15px] shadow-sm md:p-[18px]">
            <h2 className="text-tinta-suave text-rotulo-coluna font-mono uppercase">
              O ciclo
            </h2>
            {/* **A régua depende da promessa da linha do tempo**, então ela cai com a mesma falha — e o
                recuo é o trilho neutro mais a frase (item 90, critério 5). O estado atual continua dito
                pelo selo do cabeçalho, que vem do detalhe e não desta promessa. */}
            <FalhaDoCartao
              frase={FRASES_DE_FALHA.regua}
              antes={<EsqueletoDaRegua nomeDoStatus={nomeDoStatus} />}
            >
              <Suspense fallback={<EsqueletoDaRegua nomeDoStatus={nomeDoStatus} />}>
                <ReguaComDatas
                  eventos={linhaDoTempoPedida}
                  statusAtual={detalhe.status}
                  nomeDoStatus={nomeDoStatus}
                  notaDaSaida={segundaLinhaDeMotivo(detalhe.motivoPausa, detalhe.statusRotulo)}
                  rotuloDaSaida={detalhe.statusRotulo}
                />
              </Suspense>
            </FalhaDoCartao>
          </section>

          {/* **Bloco 1c · O resto da identidade**, com a faixa *Detalhes* (critério 44q.5). O `Cartao`
              continua `<section>`, e o teste de ponta a ponta o acha por *"Registrada por"*. */}
          <Cartao tituloId="bloco-detalhes">
            <FaixaDoCartao>
              <h2 id="bloco-detalhes" className={TITULO_DA_FAIXA}>
                Detalhes
              </h2>
            </FaixaDoCartao>
            <CorpoDoCartao>
              {/* **A presença do CONTROLE depende de `acoesDisponiveis`, não do dado** — a prioridade
                  nunca some da tela, e o que muda é só o lado direito da linha. **A linha é a mesma nos
                  dois casos** (item 44p, critério 20): antes, sem o controle, ela virava texto corrido
                  enquanto as outras cinco linhas do cartão continuavam rótulo e valor. */}
              {detalhe.acoesDisponiveis.includes("alterar-prioridade") ? (
                <SeletorDePrioridade
                  ocorrenciaId={detalhe.id}
                  valorAtual={detalhe.prioridade}
                  opcoes={opcoesDePrioridade()}
                  rotulosDeStatus={rotulos}
                  organizacaoId={organizacaoId}
                />
              ) : (
                <div className={LINHA_DA_PRIORIDADE}>
                  <span className="text-tinta-suave text-interface font-medium">Prioridade</span>
                  {/* Guia §2: `alta` recebe `--destructive`; `normal` e `baixa` não recebem cor. A palavra
                      é o sinal, sempre (A-5). */}
                  <span
                    className={
                      detalhe.prioridade === "alta"
                        ? "text-destructive text-interface font-medium"
                        : "text-tinta text-interface"
                    }
                  >
                    {rotuloDePrioridade(detalhe.prioridade)}
                  </span>
                </div>
              )}

              <dl className="text-tinta-suave grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-2 text-interface">
                <dt className="font-medium">Categoria</dt>
                <dd>{detalhe.categoria.nome}</dd>

                {/* **A ficha de local entra SEM cartão de ponteiro, e por decisão.** O próprio componente
                    declara que a referência do lugar *"vive no cartão de ponteiro, e também em T-05"* — e
                    T-05 é o outro lugar. Mostrá-la nos dois seria o mesmo texto duas vezes na mesma tela. */}
                <dt className="font-medium">Onde</dt>
                <dd className="flex flex-col gap-0.5">
                  <FichaDeLocal nomeDaArea={detalhe.area.nome} />
                  <span className="text-tinta-suave text-meta">
                    {detalhe.area.tipo === "comum" ? "área comum" : "unidade privativa"}
                    {detalhe.localizacaoComplemento !== null &&
                      ` — ${detalhe.localizacaoComplemento}`}
                  </span>
                </dd>

                {/* **As fichas de pessoa entram sem cartão por falta de dado**, e não por decisão:
                    `autor` e `responsavel` são `PessoaReferencia`, com `pessoaId` e `nome` e nada mais.
                    É o achado A-06 da spec, e o mesmo do 44c em T-03. */}
                <dt className="font-medium">Registrada por</dt>
                <dd>
                  <FichaDePessoa nome={detalhe.autor.nome} />
                </dd>

                <dt className="font-medium">Responsável</dt>
                <dd>
                  {detalhe.responsavel === null ? (
                    /* **Nulo escreve *"sem responsável"***, que é a palavra que a lista já usa. Não se
                       inventa um terceiro texto. */
                    <span className="text-tinta-suave">sem responsável</span>
                  ) : (
                    <FichaDePessoa nome={detalhe.responsavel.nome} />
                  )}
                </dd>

                <dt className="font-medium">Quando</dt>
                {/* **Com fuso, e não `toLocaleString` cru.** O Server Component roda em UTC. */}
                <dd className="font-mono">{dataEHora(detalhe.registradaEm)}</dd>

                {/* **A última mudança, como última linha de Detalhes** (item 66). Continua subida do
                    bloco 3, e é o que faz o topo pintar com UMA requisição: `ultimaTransicao` vem dentro do
                    `OcorrenciaDetalhe`. O atalho para a linha do tempo fica, porque no celular a linha do
                    tempo está bem abaixo. */}
                <dt className="font-medium">Última mudança</dt>
                <dd className="flex flex-col gap-1">
                  <span className="text-tinta-suave text-meta">
                    {autoria(
                      detalhe.ultimaTransicao.autor.nome,
                      detalhe.ultimaTransicao.autor.pessoaId === escopo.ctx.pessoaId,
                      dataEHora(detalhe.ultimaTransicao.ocorreuEm),
                    )}
                  </span>
                  {detalhe.ultimaTransicao.observacao !== null && (
                    <span className="text-tinta-suave text-corpo whitespace-pre-line">
                      {`“${detalhe.ultimaTransicao.observacao}”`}
                    </span>
                  )}
                  <a
                    href="#linha-do-tempo"
                    className="text-tinta-marca text-interface inline-flex min-h-11 items-center self-start font-medium"
                  >
                    ver a linha do tempo →
                  </a>
                </dd>
              </dl>
            </CorpoDoCartao>
          </Cartao>
        </div>

        <div className="flex flex-col gap-6 lg:col-start-1 lg:row-start-1">
          {/* **Bloco 2 · Conteúdo**, em cartão com faixa (critério 44q.5). O dado da faixa é o número de
              fotos, e ele usa o ternário, e não `&&`: a faixa testa `dado !== undefined`, e um `false`
              montaria o invólucro da direita vazio. `0 fotos` não se escreve. */}
          <Cartao tituloId="bloco-relato">
            <FaixaDoCartao
              dado={
                detalhe.anexos.length > 0
                  ? `${String(detalhe.anexos.length)} ${detalhe.anexos.length === 1 ? "foto" : "fotos"}`
                  : undefined
              }
            >
              <h2 id="bloco-relato" className={TITULO_DA_FAIXA}>
                O que foi relatado
              </h2>
            </FaixaDoCartao>
            <CorpoDoCartao>
              <p className="text-tinta-suave text-corpo whitespace-pre-line">
                {detalhe.descricao}
              </p>

              {/* **A foto abre em diálogo** (item 66, critério 2) — o porquê das duas camadas de fundo e da
                  etiqueta persistente está em `foto-ampliavel.tsx`. */}
              {detalhe.anexos.map((anexo) => (
                <FotoAmpliavel
                  key={anexo.id}
                  url={anexo.url}
                  miniaturaUrl={anexo.miniaturaUrl}
                  titulo={anexo.titulo}
                  nomeArquivo={anexo.nomeArquivo}
                />
              ))}
            </CorpoDoCartao>
          </Cartao>

          {/* **Bloco de solução aplicada.** As três formas são do protótipo: campo quando o comando
              existe, texto quando só há o dado, nada quando não há nem um nem outro. */}
          {detalhe.acoesDisponiveis.includes("registrar-solucao-aplicada") ? (
            <CampoDeSolucaoAplicada
              ocorrenciaId={detalhe.id}
              valorAtual={detalhe.solucaoAplicada}
              rotulosDeStatus={rotulos}
              organizacaoId={organizacaoId}
              retorno={RETORNO_DO_COMANDO["registrar-solucao-aplicada"]}
            />
          ) : (
            detalhe.solucaoAplicada !== null && (
              <Cartao tituloId="bloco-solucao">
                <FaixaDoCartao>
                  <h2 id="bloco-solucao" className={TITULO_DA_FAIXA}>
                    Solução aplicada
                  </h2>
                </FaixaDoCartao>
                <CorpoDoCartao>
                  <p className="text-tinta-suave text-corpo whitespace-pre-line">
                    {detalhe.solucaoAplicada}
                  </p>
                </CorpoDoCartao>
              </Cartao>
            )
          )}

          {/* **A avaliação dada.** Sem ela, o autor avalia, o modal fecha, o convite some e nada na tela
              diria que a nota foi registrada. */}
          {detalhe.avaliacao !== null && (
            <Cartao tituloId="bloco-avaliacao">
              <FaixaDoCartao>
                <h2 id="bloco-avaliacao" className={TITULO_DA_FAIXA}>
                  {ehAutor ? "Sua avaliação" : "Avaliação do solicitante"}
                </h2>
              </FaixaDoCartao>
              <CorpoDoCartao>
                {/* **A-5: a nota carrega a palavra**, e nunca é só um número solto ou uma cor. */}
                <p className="text-tinta-suave text-corpo">
                  Nota {detalhe.avaliacao.nota} de 5
                </p>
                {detalhe.avaliacao.comentario !== null && (
                  <p className="text-tinta-suave text-corpo whitespace-pre-line">
                    {detalhe.avaliacao.comentario}
                  </p>
                )}
              </CorpoDoCartao>
            </Cartao>
          )}

          {/* **Bloco 3 · A linha do tempo.** O `id` mora AQUI e não no filho, porque a âncora do bloco
              1b precisa existir enquanto o esqueleto está na tela. **Ele fica `<section>` com o `id`, e
              não vira `<Cartao>`**, pela mesma âncora; a classe é a do `Cartao` (item 44q). */}
          <section
            id="linha-do-tempo"
            aria-labelledby="bloco-linha-do-tempo"
            className="border-linha bg-superficie overflow-hidden rounded-lg border shadow-sm"
          >
            <FaixaDoCartao
              dado={
                /* **FORA do `<Suspense>`, de propósito:** dentro do `fallback` o link sumiria
                   justamente durante a espera, que é quando alguém desiste da tela. **`<a>` e não
                   `next/link`** porque T-06 é `force-dynamic` e o *prefetch* a renderizaria a cada
                   aparição na viewport. A faixa pinta o dado em mono versal; o botão desfaz os dois.
                   **Botão de contorno desde o item 64**, e sem a seta: botão não carrega seta de link. */
                <a
                  href={`/ocorrencias/${detalhe.id}/auditoria`}
                  className={cn(
                    buttonVariants({ variant: "outline" }),
                    "border-linha text-interface min-h-11 px-4 font-sans tracking-normal normal-case",
                  )}
                >
                  Ver a trilha de auditoria
                </a>
              }
            >
              {/* **Sem frase no recuo, de propósito:** o título é o nome acessível da seção, e a frase
                  da falha já está no corpo do mesmo cartão. Duas frases para uma falha só seriam duas
                  falhas na leitura de quem usa leitor de tela. */}
              <FalhaDoCartao frase={null} antes={tituloFixoDaLinhaDoTempo}>
                <Suspense fallback={tituloFixoDaLinhaDoTempo}>
                  <TituloDaLinhaDoTempo eventos={linhaDoTempoPedida} />
                </Suspense>
              </FalhaDoCartao>
            </FaixaDoCartao>
            <CorpoDoCartao>
              <FalhaDoCartao frase={FRASES_DE_FALHA.linhaDoTempo}>
                <Suspense fallback={<EsqueletoDaLinhaDoTempo />}>
                  <LinhaDoTempo
                    eventos={linhaDoTempoPedida}
                    pessoaIdDeQuemLe={escopo.ctx.pessoaId}
                    lente={lente}
                  />
                </Suspense>
              </FalhaDoCartao>
            </CorpoDoCartao>
          </section>

          {/* **Bloco 4 · A conversa.** A permissão é conferida aqui, como a página já faz com
              `vinculo.gerir` antes de montar o modal de atribuição. */}
          {vinculo.pode("ocorrencia.comentar") && (
            <ConversaDaOcorrencia
              ocorrenciaId={detalhe.id}
              primeiraPagina={conversaPedida}
              organizacaoId={organizacaoId}
              pessoaIdDeQuemLe={escopo.ctx.pessoaId}
              vazio={vazioDaConversa(ehAutor)}
              rotuloDoCampo={rotuloDoCampoDeConversa(ehAutor)}
              retorno={RETORNO_DA_MENSAGEM}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * **Quem espera a promessa é o filho** — o idioma de T-03 (`Lista`, em `app/ocorrencias/page.tsx`). Mora
 * dentro deste arquivo pela mesma razão que `Lista` mora dentro do dele: é o precedente da casa, e evita
 * dois arquivos novos que a ADR-0008 conta.
 *
 * **A projeção é a MESMA do endpoint**, e isso não é economia: *"existem dois transportes para a mesma
 * leitura"* (`contrato-de-api.md` §5), e a estrada direta que projetasse por conta própria deixaria as
 * duas divergirem.
 */
async function LinhaDoTempo({
  eventos,
  pessoaIdDeQuemLe,
  lente,
}: {
  eventos: Promise<readonly EventoLido[]>;
  pessoaIdDeQuemLe: string;
  /** A coluna do `glossario.md` §4 desta leitura — item 31, critério 31.7. */
  lente: LenteDeRotulo;
}) {
  const itens = (await eventos).map((evento) => projetarEventoDaLinhaDoTempo(evento, lente));

  return (
    <>
      {/* **Não há estado vazio, e é garantia e não sorte:** a premissa P1 faz o registro da criação
          nascer com a ocorrência, e o repositório trata trilha vazia como invariante violada. Toda linha
          do tempo tem ao menos um. O título, com a contagem, subiu para a faixa do cartão (item 44q). */}
      <ol className="flex flex-col">
        {itens.map((evento, indice) => (
          <li
            key={`${evento.tipo}-${evento.ocorridoEm}-${indice}`}
            className="relative flex gap-3 pb-4 last:pb-0"
          >
            {/* **O trilho, e ele não desce do último.** Mesmo desenho da régua do ciclo: um produto, um
                jeito de desenhar uma sequência no tempo. `aria-hidden` porque a relação já está na
                ordem do `<ol>`. */}
            {indice < itens.length - 1 && (
              <span aria-hidden className="bg-linha-suave absolute top-4 bottom-0 left-[5px] w-px" />
            )}

            {/* **Três formas de marcador, e nenhuma delas carrega informação sozinha** — a frase abaixo
                diz o que aconteceu, em palavras. Transição é cheio, atribuição é contorno, mensagem é
                contorno menor. */}
            {/* **O primeiro evento é a criação** (premissa P1), e veste a cor do selo *Aberta*, que é o
                estado que ele cria (critério 44q.7). A ordem é crescente. */}
            <span
              aria-hidden
              className={
                indice === 0 && evento.tipo === "transicao"
                  ? "bg-marca border-marca mt-1.5 size-[11px] shrink-0 rounded-full border"
                  : evento.tipo === "transicao"
                    ? "bg-tinta-suave border-tinta-suave mt-1.5 size-[11px] shrink-0 rounded-full border"
                    : evento.tipo === "atribuicao"
                      ? "border-tinta-suave mt-1.5 size-[11px] shrink-0 rounded-full border bg-transparent"
                      : "border-linha mt-2 size-[7px] shrink-0 rounded-full border bg-transparent"
              }
            />

            <span className="flex min-w-0 flex-col gap-0.5">
              {/* **A-5: nada só por cor.** Cada evento carrega quem, quando e o quê, em palavras. O
                  instante vai em monoespaçada, pelo guia §3 — dado temporal. **O rosto da pessoa vem
                  antes do nome** (critério 44q.7), a mesma peça da ficha. O texto do `<span>` de dentro
                  é o de `autoria(…)`, caractere por caractere. */}
              <span className="text-meta flex items-center gap-2">
                <AvatarDePessoa nome={evento.autor.nome} />
                {(() => {
                  const { quem, quando } = partesDaAutoria(
                    evento.autor.nome,
                    evento.autor.pessoaId === pessoaIdDeQuemLe,
                    dataEHora(evento.ocorridoEm),
                  );
                  return (
                    <span>
                      <span className="text-tinta font-medium">{quem}</span>
                      <span className="text-tinta-suave"> · </span>
                      <span className="text-tinta-suave font-mono tabular-nums">{quando}</span>
                    </span>
                  );
                })()}
              </span>
              <span className="text-tinta-suave text-corpo whitespace-pre-line">
                {evento.tipo === "transicao"
                  ? fraseDaTransicao(evento.rotulo, evento.observacao)
                  : evento.tipo === "mensagem"
                    ? fraseDaMensagem(evento.texto)
                    : fraseDaAtribuicao(
                        evento.responsavel.nome,
                        evento.responsavel.pessoaId === pessoaIdDeQuemLe,
                      )}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </>
  );
}

/**
 * O título da faixa da linha do tempo, com a contagem ao lado (item 44q, critério 5). Ele espera a mesma
 * promessa da lista, e esperar duas vezes não custa ida ao servidor. O `fallback` dele, na página, é o
 * cabeçalho **sem a contagem**: não se conta o que ainda não chegou.
 */
async function TituloDaLinhaDoTempo({ eventos }: { eventos: Promise<readonly EventoLido[]> }) {
  const quantos = (await eventos).length;
  return (
    <h2 id="bloco-linha-do-tempo" className={TITULO_DA_FAIXA}>
      Linha do tempo <span className="text-tinta-suave">{quantos}</span>
    </h2>
  );
}

/**
 * O estado 7 do protótipo (`telas.html:2824-2838`): três eventos em barra cinza. O cabeçalho, sem a
 * contagem, é o `fallback` do título na faixa. `animate-pulse` é a mesma classe de `EsqueletoDaLista`.
 */
function EsqueletoDaLinhaDoTempo() {
  return (
    <>
      <div aria-hidden className="flex flex-col">
        {(
          [
            [46, 88],
            [52, 74],
            [40, 92],
          ] as const
        ).map(([autor, frase], indice) => (
          <div key={autor} className="relative flex gap-3 pb-4">
            {indice < 2 && (
              <span className="bg-linha-suave absolute top-4 bottom-0 left-[5px] w-px" />
            )}
            <span className="border-linha mt-1.5 size-[11px] shrink-0 rounded-full border" />
            <div className="flex w-full flex-col gap-1.5">
              <Skeleton className="bg-secondary h-3" style={{ width: `${autor}%` }} />
              <Skeleton className="bg-secondary h-4" style={{ width: `${frase}%` }} />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/**
 * **A régua espera a linha do tempo, porque é ela quem sabe as datas.**
 *
 * `OcorrenciaDetalhe` traz `registradaEm`, `ultimaTransicao` e o `status` atual — e **não** a data de
 * cada passo alcançado. Elas só existem na trilha. A promessa já parte antes do `await` do detalhe
 * (critério 29.5), então esta fronteira de espera **não acrescenta requisição nenhuma**: ela reaproveita
 * a mesma promessa que o bloco 3 espera.
 *
 * **Custo declarado:** sob o cold start do RNF5 a régua pinta sem datas por um instante — é o achado
 * **A-05** da spec, e a alternativa seria mudar o contrato.
 */
async function ReguaComDatas({
  eventos,
  statusAtual,
  nomeDoStatus,
  notaDaSaida,
  rotuloDaSaida,
}: {
  eventos: Promise<readonly EventoLido[]>;
  statusAtual: string;
  nomeDoStatus: (status: string) => string;
  notaDaSaida: string | null;
  rotuloDaSaida: string;
}) {
  /**
   * **Só transições entram**, já ordenadas da mais antiga para a mais recente, que é como a linha do
   * tempo chega. Atribuição e mensagem não movem o ciclo.
   *
   * **`flatMap` com ternária, e não `filter` seguido de `map`.** `EventoLido` é união discriminada por
   * `tipo`, e `filter` com predicado booleano **não estreita** o tipo do elemento: o `map` seguinte não
   * enxergaria `evento.transicao` e o `tsc` recusaria. Dentro da ternária a narrowing acontece.
   */
  const transicoes = (await eventos).flatMap((evento) =>
    evento.tipo === "transicao"
      ? [{ status: evento.transicao.statusNovo, em: dataEHora(evento.ocorridoEm) }]
      : [],
  );

  return (
    <ReguaDoCiclo
      transicoes={transicoes}
      statusAtual={statusAtual}
      nomeDoStatus={nomeDoStatus}
      notaDaSaida={notaDaSaida}
      rotuloDaSaida={rotuloDaSaida}
    />
  );
}

/**
 * **O trilho sem datas, enquanto a linha do tempo não chega. O ciclo é visível no primeiro pixel.**
 *
 * **Não é `ReguaDoCiclo` com `transicoes={[]}`.** Sem data nenhuma, `lerOCiclo` marca como *por
 * alcançar* todo passo que não seja o atual — numa ocorrência em `em_atendimento` isso pintaria
 * *Aberta* e *Em análise* como pendentes, e numa `cancelada` riscaria os quatro e poria a marca de
 * saída **acima** de *Aberta*. Um ciclo falso, ainda que por um instante.
 *
 * **O esqueleto desenha o próprio trilho**, `aria-hidden` e sem distinção de estado entre os quatro
 * passos — nenhum alcançado, nenhum atual, nenhum riscado — e sem a marca de saída, que é exatamente o
 * dado que ainda não chegou. Só os nomes, na mesma geometria da régua de verdade.
 */
function EsqueletoDaRegua({ nomeDoStatus }: { nomeDoStatus: (status: string) => string }) {
  return (
    <div aria-hidden className="flex flex-col">
      {CICLO.map((status, indice) => (
        <div key={status} className="relative flex gap-3 pb-4 last:pb-0">
          {indice < CICLO.length - 1 && (
            <span className="bg-linha-suave absolute top-4 bottom-0 left-[5px] w-px" />
          )}
          <span className="border-linha mt-1.5 size-[11px] shrink-0 rounded-full border bg-transparent" />
          <span className="text-interface text-tinta-suave">{nomeDoStatus(status)}</span>
        </div>
      ))}
    </div>
  );
}
