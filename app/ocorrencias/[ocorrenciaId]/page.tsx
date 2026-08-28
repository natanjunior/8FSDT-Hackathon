import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { NaoAutenticado } from "@/aplicacao/contexto";
import { OcorrenciaNaoEncontrada, podeLerOcorrencia, verOcorrencia } from "@/aplicacao/ocorrencia";
import { listarVinculos } from "@/aplicacao/organizacao";
import { BarraDeAcoes } from "@/interface/componentes/barra-de-acoes";
import { ModalDeAtribuicao, type Candidato } from "@/interface/componentes/modal-de-atribuicao";
import { ModalDeMotivo } from "@/interface/componentes/modal-de-motivo";
import { ModalDeObservacao } from "@/interface/componentes/modal-de-observacao";
import { ModalDeResolucao } from "@/interface/componentes/modal-de-resolucao";
import { MolduraDeTela } from "@/interface/componentes/moldura-de-tela";
import {
  acoesDaBarra,
  nomesDeStatus,
  rotuloDeComando,
  rotuloDePrioridade,
  rotulosDeStatus,
  vazioDaBarra,
} from "@/interface/componentes/rotulos";
import { lerFiltroDeOcorrenciasDaUrl, resolverEscopoParaTela } from "@/interface/http";
import { opcoesDeMotivoPausa, projetarOcorrenciaDetalhe } from "@/interface/projecoes";

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

  let lida;
  try {
    lida = await verOcorrencia(escopo.repos.ocorrencias, ocorrenciaId);
  } catch (erro) {
    // `404` indistinguível de "de outra organização" — §6.3. A tela não confirma existência.
    if (erro instanceof OcorrenciaNaoEncontrada) notFound();
    throw erro;
  }

  // **`escopo.ctx`, nao `escopo.resolucao`.** Depois dos dois `if` acima o TypeScript ja estreitou
  // `escopo` para a variante `"pronto"`, que carrega `ctx` — e `ContextoDaRequisicao` e quem tem
  // `pessoaId` e `vinculo`. `ResolucaoDeContexto` **nao tem `pessoaId`**: la ele mora em
  // `resolucao.sessao.pessoaId`, e `ativo` e `VinculoNaOrganizacao`, o que ainda exigiria um `!`.
  const vinculo = escopo.ctx.vinculo;
  // **A regra é uma função da Aplicação, chamada por quem tem o `Vinculo`.** Ela estava copiada aqui e
  // em `app/api/ocorrencias/[ocorrenciaId]/route.ts`; o item 13b seria a terceira cópia.
  const quem = {
    pessoaId: escopo.ctx.pessoaId,
    podeLerTodas: vinculo.pode("ocorrencia.ler_todas"),
  };
  if (!podeLerOcorrencia(lida, quem)) notFound();

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
        variante={varianteDe("pausar")}
        rotulosDeStatus={rotulos}
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
        <dl className="text-tinta-suave grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="font-medium">Prioridade</dt>
          <dd>{rotuloDePrioridade(detalhe.prioridade)}</dd>
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

        **A moldura é parte da mensagem.** Tracejada marca **andaime declarado** — comandos que ainda vão
        chegar, e ela sai no item 27. Sólida é **UI de produto**: em `resolvida` e em `cancelada` não há
        mesmo o que fazer, e nunca haverá. Escrever a frase de produto no vazio de andaime seria mentir
        sobre o estado da ocorrência; escrever a de andaime no terminal seria prometer comando que nunca
        vem.
      */}
      {vazio !== null && (
        <p
          className={`border-linha bg-superficie text-tinta-suave rounded-md border px-3 py-2.5 text-xs leading-relaxed ${
            vazio.andaime ? "border-dashed" : ""
          }`}
        >
          {vazio.texto}
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
        formularios={formularios}
        primario={primario}
        emMenu={emMenu}
      />
    </MolduraDeTela>
  );
}
