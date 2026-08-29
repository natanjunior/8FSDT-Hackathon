import Link from "next/link";
import { redirect } from "next/navigation";

import { NaoAutenticado } from "@/aplicacao/contexto";
import { OcorrenciaNaoEncontrada, podeLerOcorrencia, verOcorrencia } from "@/aplicacao/ocorrencia";
import { listarVinculos } from "@/aplicacao/organizacao";
import { BarraDeAcoes } from "@/interface/componentes/barra-de-acoes";
import { CampoDeSolucaoAplicada } from "@/interface/componentes/campo-de-solucao-aplicada";
import {
  MenuDeOrganizacao,
  type VinculoNoMenu,
} from "@/interface/componentes/menu-de-organizacao";
import { ModalDeAtribuicao, type Candidato } from "@/interface/componentes/modal-de-atribuicao";
import { ModalDeAvaliacao } from "@/interface/componentes/modal-de-avaliacao";
import { ModalDeMotivo } from "@/interface/componentes/modal-de-motivo";
import { ModalDeObservacao } from "@/interface/componentes/modal-de-observacao";
import { ModalDeResolucao } from "@/interface/componentes/modal-de-resolucao";
import { MolduraDeTela } from "@/interface/componentes/moldura-de-tela";
import { SeletorDePrioridade } from "@/interface/componentes/seletor-de-prioridade";
import {
  acoesDaBarra,
  AVISO_DE_VISIBILIDADE,
  AVISO_PARA_QUEM_NAO_GESTIONA,
  nomesDeStatus,
  ocorrenciaNaoEncontradaEm,
  rotuloDeComando,
  rotuloDePrioridade,
  rotulosDeStatus,
  vazioDaBarra,
} from "@/interface/componentes/rotulos";
import {
  lerFiltroDeOcorrenciasDaUrl,
  novoTraceId,
  registrarFalha,
  resolverEscopoParaTela,
} from "@/interface/http";
import {
  opcoesDeMotivoCancelamento,
  opcoesDeMotivoPausa,
  opcoesDePrioridade,
  projetarContexto,
  projetarOcorrenciaDetalhe,
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
 */
export const dynamic = "force-dynamic";

/**
 * O papel **em palavra**, para descer por prop ao modal.
 *
 * **Mora aqui e não em `rotulos.ts`** porque tem um consumidor só, e porque a lista de papéis é do módulo
 * de organização, não do de ocorrência. Se o segundo consumidor aparecer — T-08 já mostra papel, com o
 * próprio `rotuloDoPapel` em `lista-de-vinculos.tsx` —, o lugar dos dois é um módulo, e **isso é achado,
 * não conserto**: são duas cópias hoje, e a segunda nasceu aqui.
 */
const PAPEL_EM_PALAVRA: Readonly<Record<string, string>> = {
  gestor: "Gestor",
  encarregado: "Encarregado",
  solicitante: "Solicitante",
};

/**
 * **O `de=` é reconstruído, nunca repassado cru** — item 15, critério 15.3.
 *
 * Ele vem de uma URL que qualquer pessoa pode ter editado. Passar a *query string* adiante sem olhar seria
 * confiar em texto de fora; em vez disso ela atravessa a **mesma** leitura que a lista usa, e só os quatro
 * parâmetros conhecidos voltam para o endereço. Filtro estragado no `de=` degrada para o *Voltar* limpo —
 * a lista sem recorte —, que é o pior caso aceitável.
 *
 * **`catch {}` sem tipo é o único caminho honesto aqui**, e não é engolir erro: qualquer coisa que a
 * leitura recuse é lixo vindo de fora, e a resposta certa é a lista inteira — não uma tela de erro em
 * T-05, que é a tela que precisa abrir para quem recebeu o link por mensagem.
 */
function destinoDeVolta(de: string | undefined): string {
  if (de === undefined || de === "") return "/ocorrencias";
  try {
    const filtro = lerFiltroDeOcorrenciasDaUrl(new URLSearchParams(de));
    const consulta = new URLSearchParams();
    if (filtro.status !== undefined) consulta.set("status", filtro.status.join(","));
    if (filtro.categoriaId !== undefined) consulta.set("categoriaId", filtro.categoriaId.join(","));
    if (filtro.prioridade !== undefined) consulta.set("prioridade", filtro.prioridade.join(","));
    if (filtro.apenasDoAutor === true) consulta.set("autor", "eu");
    const texto = consulta.toString();
    return texto === "" ? "/ocorrencias" : `/ocorrencias?${texto}`;
  } catch {
    return "/ocorrencias";
  }
}

export default async function Ocorrencia({
  params,
  searchParams,
}: {
  params: Promise<{ ocorrenciaId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
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

  const parametros = await searchParams;
  const voltarPara = destinoDeVolta(typeof parametros.de === "string" ? parametros.de : undefined);

  /**
   * **Montado uma vez, usado pelos dois caminhos que chamavam `notFound()`** — o erro do `verOcorrencia` e
   * a recusa do `podeLerOcorrencia`. As duas causas dão a mesma resposta, de propósito (§6.3).
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
          resolucao.ativo === null
            ? null
            : { id: resolucao.ativo.organizacao.id, nome: resolucao.ativo.organizacao.nome }
        }
        vinculos={projetarContexto(resolucao).vinculos}
        traceId={traceId}
      />
    );
  };

  let lida;
  try {
    lida = await verOcorrencia(escopo.repos.ocorrencias, ocorrenciaId);
  } catch (erro) {
    // `404` indistinguível de "de outra organização" — §6.3. A tela não confirma existência, **e agora
    // diz em qual organização você está**, que é a compensação que o contrato comprou (critério 28.3).
    if (erro instanceof OcorrenciaNaoEncontrada) return naoEncontrada();
    throw erro;
  }

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
  if (!podeLerOcorrencia(lida, quem)) return naoEncontrada();

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
    .map((comando): { comando: string; rotulo: string | null } => ({
      comando,
      rotulo: rotuloDeComando(comando),
    }))
    .filter((acao): acao is { comando: string; rotulo: string } => acao.rotulo !== null);

  // Os dois mapas descem prontos: o navegador não monta rótulo, e as duas colunas respondem perguntas
  // diferentes — ver `rotulos.ts`.
  const rotulos = rotulosDeStatus();
  const nomes = nomesDeStatus();

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
   * **Quem gestiona, derivado UMA vez e lido por dois consumidores** — a frase do vazio da barra
   * (critério 18.6) e o aviso do modal de cancelamento (critério 18.7).
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
   * **Quem lê é o autor?** — lido por um consumidor só: o título do bloco da avaliação (*"Sua
   * avaliação"* × *"Avaliação do solicitante"*). **O convite NÃO usa isto:** ele usa
   * `acoesDisponiveis`, que já cruza autoria com *"ainda não avaliou"*.
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
    renderizaveis.map((acao) => acao.comando),
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
      />
    ),
    /**
     * **O quinto modal, e ele é o `ModalDeObservacao` reusado INTEIRO** — zero componente novo, zero
     * variante nova, zero linha alterada nele. O componente foi escrito parametrizado exatamente para
     * isto: *"o modal de `iniciar-atendimento` (item 22) e o de `retomar` (item 24) diferem em três
     * strings"* (`modal-de-observacao.tsx:25-28`).
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
      />
    ),
    /**
     * **O quinto modal, e o último** — não há sexto, porque não há décimo primeiro comando.
     *
     * **Entra SEMPRE, como os outros quatro**: não precisa de consulta nenhuma além do que a página já
     * leu. Quem decide se ele **aparece** continua sendo `acoesDisponiveis` — e ela já cruza *ser o autor*
     * com *ainda não avaliou* (`MaquinaDeEstados.ts:188-191`).
     *
     * **A ternária, e não `varianteDe`:** `ModalDeAvaliacao` aceita `"primario" | "secundario"`, e
     * `varianteDe` devolve as três. Em `resolvida`, `avaliar` é o **único** renderizável e é
     * `ACAO_PRIMARIA.resolvida` — ele nunca cai no menu, e a prova está em `barra-de-acoes.tsx:69-72`.
     */
    avaliar: (
      <ModalDeAvaliacao
        ocorrenciaId={detalhe.id}
        variante={primario === "avaliar" ? "primario" : "secundario"}
        rotulosDeStatus={rotulos}
        organizacaoId={organizacaoId}
      />
    ),
    ...(podeAtribuir
      ? {
          "atribuir-responsavel": (
            <ModalDeAtribuicao
              ocorrenciaId={detalhe.id}
              candidatos={candidatos}
              responsavelAtualPessoaId={detalhe.responsavel?.pessoaId ?? null}
              rotulosDeStatus={rotulos}
              organizacaoId={organizacaoId}
              variante={varianteDe("atribuir-responsavel")}
            />
          ),
        }
      : {}),
  };

  return (
    <MolduraDeTela titulo={detalhe.titulo}>
      {/* **Bloco 1 · Identidade.** `statusRotulo` sem rolar — é a resposta literal a "o que aconteceu
          com o meu pedido?". **A-5:** o status e a prioridade carregam a palavra, sempre. */}
      <section className="border-linha bg-superficie flex flex-col gap-2 rounded-md border px-4 py-3.5">
        <span className="text-tinta-fraca text-xs tracking-wide uppercase">Situação</span>
        <span className="text-tinta text-base leading-snug font-semibold">
          {detalhe.statusRotulo}
        </span>
        {/*
          **A prioridade sai do `<dl>` e vira a linha acima dele** — nas duas formas. `<label htmlFor>`
          dentro de `<dt>` é marcação errada, e o protótipo já a desenha fora da lista de pares nos dois
          recortes (`telas.html:2154-2158` para o Gestor, `:2276` e `:2473` para o Solicitante e para o
          estado terminal).

          **A presença do CONTROLE depende de `acoesDisponiveis`, não do dado** — a mesma forma que o item
          25 estabeleceu para o campo de solução aplicada. **A prioridade nunca some da tela:** ela é dado
          do bloco 1 desde o item 11, e o que muda é a forma.

          **O ramo de texto é servidor puro** — não há por que embarcar no navegador uma linha que não muda
          —, e `app/` continua sem `import` do Domínio: o que desce ao componente é `string`, uma lista de
          pares e um mapa de rótulos, nunca um tipo de comando.
        */}
        {detalhe.acoesDisponiveis.includes("alterar-prioridade") ? (
          <SeletorDePrioridade
            ocorrenciaId={detalhe.id}
            valorAtual={detalhe.prioridade}
            opcoes={opcoesDePrioridade()}
            rotulosDeStatus={rotulos}
            organizacaoId={organizacaoId}
          />
        ) : (
          <p className="text-tinta-suave text-sm">
            <span className="font-medium">Prioridade:</span>{" "}
            {rotuloDePrioridade(detalhe.prioridade)}
          </p>
        )}
        <dl className="text-tinta-suave grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="font-medium">Categoria</dt>
          <dd>{detalhe.categoria.nome}</dd>
          <dt className="font-medium">Onde</dt>
          <dd>
            {detalhe.area.nome} · {detalhe.area.tipo === "comum" ? "área comum" : "unidade privativa"}
            {detalhe.localizacaoComplemento !== null && ` — ${detalhe.localizacaoComplemento}`}
          </dd>
          <dt className="font-medium">Registrada por</dt>
          <dd>{detalhe.autor.nome}</dd>
          {/* **Nulo escreve *"sem responsável"***, que é a palavra que `lista-de-ocorrencias.tsx` já
              usa. **Não se inventa um terceiro texto:** o achado R-12 registra que `responsavel` nulo já
              tem dois — *"—"* na tabela larga e *"sem responsável"* no cartão —, e escolher o que já
              existe mantém o achado do tamanho que ele tem em vez de aumentá-lo. */}
          <dt className="font-medium">Responsável</dt>
          <dd>{detalhe.responsavel?.nome ?? "sem responsável"}</dd>
          <dt className="font-medium">Quando</dt>
          <dd>{new Date(detalhe.registradaEm).toLocaleString("pt-BR")}</dd>
        </dl>
      </section>

      {/*
        **O convite a avaliar — o critério 27.5, metade de T-05.**

        **A condição é `acoesDisponiveis`, e não uma segunda regra na tela.** `comandosDisponiveis` já
        cruza *ser o autor* com *ainda não avaliou*; recalcular isso no JSX seria a segunda cópia da
        máquina de estados que `acoesDisponiveis` existe para impedir. `status === "resolvida"` é
        redundante com a lista — `avaliar` só é admitido lá — e fica de fora.

        **O texto é literal do `inventario-de-telas.md:645`, e é a frase INTEIRA** — *"em T-05, onde o
        convite é chamada e não marca, a frase aparece inteira"* (`prototipo-low-fi.md:490`). Na lista é
        só *"Conte como foi"*, e é a Q-P8 respondida.

        **O `statusRotulo` não muda** — critério 27.5, e é a regra 3 do glossário §4: rótulo é estado, o
        convite é da tela.
      */}
      {detalhe.acoesDisponiveis.includes("avaliar") && (
        <p className="border-marca/40 bg-accent text-tinta rounded-md border px-3 py-2.5 text-sm">
          Resolvida. Conte como foi.
        </p>
      )}

      {/* **Bloco 2 · Conteúdo.** */}
      <section className="flex flex-col gap-2">
        <h2 className="text-tinta text-sm font-semibold">O que foi relatado</h2>
        <p className="text-tinta-suave text-sm leading-relaxed whitespace-pre-line">
          {detalhe.descricao}
        </p>

        {/*
          **A foto, e ela é `div` com `background-image` — não `<img>` e não `next/image`.**

          `<img>` dispara `@next/next/no-img-element`, e desativá-lo gastaria o **primeiro
          `eslint-disable` do repositório**, que o DoD lista como um dos instrumentos que substituem o
          revisor humano. `next/image` é pior: ele otimizaria no servidor, o que significa **os bytes do
          anexo atravessando o contêiner da aplicação** — o que a §10.1 do contrato proíbe na única frase
          em que ela é absoluta.

          **A miniatura é a SEGUNDA camada da mesma propriedade, e isso é CSS, não JavaScript.** A
          primeira camada cobre a segunda quando termina de carregar; até lá aparece a de ~15 KB. Sem uma
          linha de script, e sem tornar T-05 uma ilha de cliente. Com `miniaturaUrl` nula, a declaração
          tem uma camada só.

          **`role="img"` + `aria-label` dão ao leitor de tela o que o `alt` daria** (A-5).

          **Ampliar é um `<a>` em volta**, e não uma tela: *"ampliar uma foto é um gesto, não um
          destino"* (inventário). Custa um elemento e dá o gesto.
        */}
        {detalhe.anexos.map((anexo) => (
          <a key={anexo.id} href={anexo.url} target="_blank" rel="noreferrer" className="mt-1 block">
            <div
              role="img"
              aria-label={anexo.titulo ?? "Foto anexada à ocorrência"}
              className="bg-superficie border-linha h-56 w-full rounded-md border bg-cover bg-center bg-no-repeat"
              style={{
                backgroundImage:
                  anexo.miniaturaUrl === null
                    ? `url(${anexo.url})`
                    : `url(${anexo.url}), url(${anexo.miniaturaUrl})`,
              }}
            />
          </a>
        ))}
      </section>

      {/*
        **Bloco de solução aplicada — o primeiro bloco de T-05 cuja PRESENÇA depende de `acoesDisponiveis`.**
        Os anteriores dependem só do dado.

        **As três formas são do protótipo, e não desta tela** (`prototipo-low-fi.md`): *"o campo só
        existe quando o comando existe. Ele aparece quando `registrar-solucao-aplicada` está em
        `acoesDisponiveis`, **ou quando `solucaoAplicada` já tem conteúdo — e nesse caso como texto, não
        como campo**"*. A terceira forma é a que o **Solicitante** vê numa ocorrência resolvida, e é a
        única em que ele alcança esse dado na tela.

        **O ramo de texto é servidor puro** — não há por que embarcar no navegador um parágrafo que não
        muda —, e `app/` continua sem `import` do Domínio: o que desce ao componente é `string | null` e um
        mapa de rótulos, nunca um tipo de comando.
      */}
      {detalhe.acoesDisponiveis.includes("registrar-solucao-aplicada") ? (
        <CampoDeSolucaoAplicada
          ocorrenciaId={detalhe.id}
          valorAtual={detalhe.solucaoAplicada}
          rotulosDeStatus={rotulos}
          organizacaoId={organizacaoId}
        />
      ) : (
        detalhe.solucaoAplicada !== null && (
          <section className="flex flex-col gap-2">
            <h2 className="text-tinta text-sm font-semibold">Solução aplicada</h2>
            <p className="text-tinta-suave text-sm leading-relaxed whitespace-pre-line">
              {detalhe.solucaoAplicada}
            </p>
          </section>
        )
      )}

      {/*
        **A avaliação dada — e ela NÃO é escopo inventado.** O `inventario-de-telas.md:1520` manda a tela
        *"mostrar a avaliação"* ao lado da frase do `JA_AVALIADA`: uma tela que não sabe mostrá-la não
        consegue cumprir aquilo.

        **E sem ele a fatia entregaria um `200` silencioso na própria ação principal:** o autor avalia, o
        modal fecha, o convite some, a barra fica com *"Esta ocorrência está encerrada."* — e **nada** na
        tela diria que a nota foi registrada. `avaliacao` está no `OcorrenciaDetalhe` desde o item 11 e
        **ninguém a renderizava**; este é o item que a alcança.

        **Servidor puro, na forma do ramo de texto da solução aplicada** — não há por que embarcar no
        navegador um parágrafo que não muda.

        **Os dois títulos são texto novo de produto** — achado **A-2** da spec.
      */}
      {detalhe.avaliacao !== null && (
        <section className="flex flex-col gap-2">
          <h2 className="text-tinta text-sm font-semibold">
            {ehAutor ? "Sua avaliação" : "Avaliação do solicitante"}
          </h2>
          {/* **A-5: a nota carrega a palavra**, e nunca é só um número solto ou uma cor. */}
          <p className="text-tinta-suave text-sm leading-relaxed">
            Nota {detalhe.avaliacao.nota} de 5
          </p>
          {detalhe.avaliacao.comentario !== null && (
            <p className="text-tinta-suave text-sm leading-relaxed whitespace-pre-line">
              {detalhe.avaliacao.comentario}
            </p>
          )}
        </section>
      )}

      {/* **A primeira entrada da trilha** — a prova, para quem acabou de reclamar, de que o pedido
          existe. É o critério 11.2 visível na interface, e não só em teste. */}
      <section className="flex flex-col gap-2">
        <h2 className="text-tinta text-sm font-semibold">Histórico</h2>
        {/*
          **Este ramo nunca foi alcançável** — nenhuma transição existia —, e é o item 16 que o alcança.
          Sem o conserto, a tela passaria a dizer *"De aberta para em_analise"* na cara de quem acabou de
          reclamar. É o achado **A-1** da spec, e a coluna usada é a do **Gestor**: ela é substantivo e
          sobrevive dentro de *"De X para Y"*, enquanto a do Solicitante é uma oração inteira.
        */}
        <p className="text-tinta-suave text-sm">
          {detalhe.ultimaTransicao.statusAnterior === null
            ? "Registrada"
            : `De ${nomes[detalhe.ultimaTransicao.statusAnterior]} para ${nomes[detalhe.ultimaTransicao.statusNovo]}`}{" "}
          por {detalhe.ultimaTransicao.autor.nome} em{" "}
          {new Date(detalhe.ultimaTransicao.ocorreuEm).toLocaleString("pt-BR")}.
        </p>
      </section>

      {/*
        **A barra de ações, e o vazio dela.** A tela renderiza *exatamente* `acoesDisponiveis` — nada
        desabilitado, nada cinza (`inventario-de-telas.md`).

        **Com a lista vazia há SEMPRE uma frase**, e desde o item 26 são duas: renderizar nada é o `200`
        silencioso que a §8.5 do contrato existe para impedir — *"a tela não distingue 'não há o que
        fazer' de 'algo falhou ao montar a lista'"*.

        **A moldura é sempre sólida desde o item 27.** Ela era tracejada quando havia **andaime
        declarado** — comandos que ainda iam chegar —, e o critério 27.6 removeu esse ramo: com os dez
        comandos construídos, toda lista vazia é verdade sobre o produto pronto.
      */}
      {vazio !== null && (
        <p className="border-linha bg-superficie text-tinta-suave rounded-md border px-3 py-2.5 text-xs leading-relaxed">
          {vazio}
        </p>
      )}

      <Link href={voltarPara} className="text-marca py-1 text-sm underline underline-offset-4">
        Voltar
      </Link>

      {/*
        **Montada SEMPRE, e é a correção que a revisão trouxe.** Ela some sozinha quando não há botão nem
        aviso — mas quem decide isso é ela, não a tela.

        **Se a tela a montasse só com `acoes.length > 0`**, o `router.refresh()` que o `409` dispara
        trocaria o ramo do JSX, o componente perderia o `useState` e a frase *"Esta ocorrência mudou
        enquanto você estava olhando"* sumiria no mesmo repinte que a exibiu. **Nesta fatia isso seria
        100% dos `409`**: `analisar` é o único comando renderizável, então todo conflito zera a lista.

        **E ela vem depois do `Voltar`** porque leva o próprio espaçador: a barra é `fixed`, e folga
        colocada *acima* do `Voltar` não impede a barra de cobri-lo no fim da rolagem.
      */}
      <BarraDeAcoes
        ocorrenciaId={detalhe.id}
        acoes={renderizaveis}
        rotulosDeStatus={rotulos}
        organizacaoId={organizacaoId}
        formularios={formularios}
        primario={primario}
        emMenu={emMenu}
      />
    </MolduraDeTela>
  );
}

/**
 * **O `404` de ocorrência, desenhado pela própria tela** — critério 28.3, metade de T-05.
 *
 * A §7 do `inventario-de-telas.md` (`:1504`) especifica **três coisas**, e o bloco tem exatamente três:
 * a frase, **trocar de organização** e o **`traceId`**. Mais uma quarta que o inventário dá de graça em
 * toda tela de erro deste produto — uma saída que não seja o botão *voltar* do navegador.
 *
 * **Nada além disso.** Um parágrafo explicando que *"ela pode ter sido registrada em outra organização"*
 * seria texto de produto sem critério escrito, e o rótulo *"Você está em"* acima do menu já diz o mesmo
 * sem virar frase nova.
 *
 * **A `MolduraDeTela` é a mesma do caminho feliz**, e a frase é o `titulo` — isto é, o `<h1>`, que é como
 * o inventário a escreve. Zero componente novo.
 *
 * **O menu só aparece havendo organização ativa**, como em T-03: ele exige `id` e `nome` não-nulos, e
 * resolve sozinho o caso de **não haver outra** organização — mostra a atual e *"Entrar em outra
 * organização"* (`menu-de-organizacao.tsx:76-102`).
 *
 * **O documento volta com `200`, e não com `404`** — está declarado. Nada no projeto depende disso: o
 * produto inteiro está atrás de sessão, não há rastreador, e o `404` que o contrato governa é o da
 * **API**, que continua sendo `404`.
 */
function OcorrenciaNaoEncontradaNaTela({
  organizacaoAtiva,
  vinculos,
  traceId,
}: {
  organizacaoAtiva: { id: string; nome: string } | null;
  vinculos: readonly VinculoNoMenu[];
  traceId: string;
}) {
  return (
    <MolduraDeTela titulo={ocorrenciaNaoEncontradaEm(organizacaoAtiva?.nome ?? null)}>
      {organizacaoAtiva !== null && (
        <div className="border-linha bg-superficie flex flex-col gap-1 rounded-md border px-4 py-3">
          <span className="text-tinta-fraca text-xs tracking-wide uppercase">Você está em</span>
          <MenuDeOrganizacao
            vinculos={vinculos}
            organizacaoAtivaId={organizacaoAtiva.id}
            nomeDaOrganizacaoAtiva={organizacaoAtiva.nome}
          />
        </div>
      )}

      {/*
        **Sem o `?de=`, e é decisão.** O filtro que trouxe até aqui pode ser de outra organização, e
        reconstruí-lo seria carregar um recorte que não vale mais. **A-3:** `min-h-11`.
      */}
      <Link
        href="/ocorrencias"
        className="border-linha text-tinta inline-flex min-h-11 w-full items-center justify-center rounded-md border px-4 text-sm font-medium"
      >
        Voltar à lista
      </Link>

      {/*
        **O `traceId` carrega a palavra (A-5) e é copiável.** Ele existe porque a §6.3 do contrato diz
        para que serve — *"liga à linha de log"* — e porque `registrarFalha` acabou de escrever essa linha.
      */}
      <p className="text-tinta-fraca text-xs">
        Código para suporte: <code className="select-all">{traceId}</code>
      </p>
    </MolduraDeTela>
  );
}
