import { History } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { NaoAutenticado } from "@/aplicacao/contexto";
import { OcorrenciaNaoEncontrada, verTrilhaDeAuditoria } from "@/aplicacao/ocorrencia";
import { CabecalhoDaPagina } from "@/interface/componentes/cabecalho-da-pagina";
import { CaminhoDaPagina } from "@/interface/componentes/caminho-da-pagina";
import { OcorrenciaNaoEncontradaNaTela } from "@/interface/componentes/ocorrencia-nao-encontrada";
import { encurtarParaOCaminho, nomesDeStatus } from "@/interface/componentes/rotulos";
import { MarcadorDoStatus, SeloDeStatus } from "@/interface/componentes/selo-de-status";
import { dataHoraComSegundos } from "@/interface/componentes/trilha-de-auditoria";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/interface/componentes/ui/empty";
import {
  lerOcorrenciaDaTela,
  novoTraceId,
  registrarFalha,
  resolverEscopoParaTela,
  tituloDeAbaDaOcorrencia,
} from "@/interface/http";
import { nomeDoMotivoCancelamento, nomeDoMotivoPausa, projetarTransicao } from "@/interface/projecoes";

/**
 * ============================================================================
 *  T-06 · Trilha de auditoria — a tela que responde "prove"
 * ============================================================================
 *
 * **Endereço próprio, e é a tela que mais precisa de um:** é o que se leva para a assembleia, para a
 * imobiliária e para quem avalia. *"Cada transição de status deve ser auditável"* é o requisito central do
 * enunciado, e esta é a superfície dele.
 *
 * **A leitura vai pela estrada direta**, como T-05 e T-03: `app/` não monta repositório, e um `fetch`
 * interno custaria o salto HTTP que o contrato recusou. **São as MESMAS duas leituras do `route.ts`** —
 * `verOcorrencia` (a guarda e o título) e `verTrilhaDeAuditoria` —, e a projeção é a **mesma função**:
 * `projetarTransicao`. Dois transportes que projetassem por conta própria divergiriam.
 *
 * **Nenhuma ação, em lugar nenhum** (critério 44n.15). É a expressão de interface da invariante 3 do
 * agregado — *"o histórico é append-only"*: não existe `POST`, não existe `PATCH`, não existe `DELETE`
 * sobre registro de transição, e não pode existir. Se um dia aparecer botão aqui, a garantia central do
 * produto terá sido perdida.
 *
 * **A língua é a do produto, e a coluna é a neutra** (item 44n, critério 5). A tela imprimia o valor que o
 * banco guarda — o identificador do status, em caixa baixa e com sublinhado — sob o argumento de que
 * *"auditoria que traduz não é auditoria"*. Não se sustenta: o nome do status **é** *Em análise*, e aquele
 * identificador é só como ele é codificado. **A guarda de `formulario.test.ts` recusa o valor cru até em
 * comentário**, e é por isso que ele não aparece escrito aqui — a regra do critério 5 vale para o arquivo,
 * não só para o que se pinta. Os nomes saem
 * de `nomesDeStatus()`, a coluna neutra do glossário, **sem lente e para quem quer que abra a tela** — é
 * o que a spec do item 31 já declarava para esta tela, *"por definição"*. A consequência é assumida: um
 * Solicitante lê *Em execução* em T-05 e *Em atendimento* aqui, e é o preço de a trilha imprimir o nome
 * pelo qual o fato é chamado em todo lugar.
 *
 * **O autor vai pelo nome, sempre**, nunca *"Você"*: a segunda pessoa é da linha do tempo (`autoria()`),
 * e numa trilha ela apagaria de quem é o registro.
 *
 * **O trilho é escrito aqui, e é o da `ReguaDoCiclo`.** O catálogo não tem peça de linha do tempo, e a de
 * terceiro que a prancheta apontava traz uma segunda biblioteca de primitivos — ver o achado A6 da spec
 * do 44n. A régua vertical, o marcador e a ancoragem são os de `regua-do-ciclo.tsx`, que é a tela vizinha.
 */
export const dynamic = "force-dynamic";

/**
 * **A aba leva o título da ocorrência, depois do nome da tela** (item 90, spec §4.3), pela mesma função
 * `cache()` que a página usa: uma ida ao banco atende as duas. O que a autorização esconde sai como o
 * recuo `Trilha de auditoria`, sem confirmar existência.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ ocorrenciaId: string }>;
}): Promise<Metadata> {
  const { ocorrenciaId } = await params;
  const titulo = await tituloDeAbaDaOcorrencia(ocorrenciaId, "Trilha de auditoria");
  // Uma ocorrência chamada literalmente "Trilha de auditoria" sai sem o prefixo, e isso é aceito.
  return { title: titulo === "Trilha de auditoria" ? titulo : `Trilha de auditoria · ${titulo}` };
}

export default async function TrilhaDeAuditoria({
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
   * **Montado uma vez, usado pelos dois caminhos que dão o mesmo `404`** — o erro do `verOcorrencia` e a
   * recusa do `podeLerOcorrencia`. As duas causas dão a mesma resposta, de propósito (§6.3): a tela não
   * confirma a existência do que quem lê não pode alcançar.
   *
   * **A estrada direta não passa pelo `comContexto`**, então o `traceId` nasce aqui — e a linha de log é
   * a MESMA que `registrarEResponder` escreve, pela mesma função. Nunca uma segunda cópia do formato.
   */
  const resolucao = escopo.resolucao;
  const naoEncontrada = () => {
    const traceId = novoTraceId();
    registrarFalha(
      new OcorrenciaNaoEncontrada(),
      `/ocorrencias/${ocorrenciaId}/auditoria`,
      "GET",
      traceId,
    );

    return (
      <OcorrenciaNaoEncontradaNaTela
        organizacaoAtiva={
          resolucao.ativo === null ? null : { nome: resolucao.ativo.organizacao.nome }
        }
        traceId={traceId}
      />
    );
  };

  /**
   * **A MESMA leitura que o `generateMetadata` fez** (item 90): `lerOcorrenciaDaTela` é `cache()` do React,
   * e dentro dela mora a condição de leitura — função da Aplicação chamada por quem tem o `Vinculo`, nunca
   * uma quarta cópia. Inexistente, de outra organização e sem permissão chegam aqui como o mesmo `null`.
   */
  const lida = await lerOcorrenciaDaTela(ocorrenciaId);
  if (lida === null) return naoEncontrada();

  const registros = (await verTrilhaDeAuditoria(escopo.repos.ocorrencias, ocorrenciaId)).map(
    projetarTransicao,
  );

  /**
   * **O vazio aqui é defeito, e o defeito vai para o log — não para a tela.**
   *
   * A premissa P1 faz a criação gravar o primeiro registro, então toda ocorrência tem ao menos um. Uma
   * lista vazia significa que a invariante 2 da ADR-0001 foi violada. **Quem lê a tela não pode consertar
   * isso**, e as quatro regras de texto do guia §7 recusam a frase que anuncia defeito a quem não pode
   * agir: o que a tela diz é o que é, e o diagnóstico vai para onde o operador chega.
   *
   * **O `traceId` nasce aqui** porque este caminho chega como `200` e não tem um — e a linha de log é a
   * MESMA que `registrarEResponder` escreve, pela mesma função. Nunca uma segunda cópia do formato.
   *
   * **Fora do componente, de propósito:** escrever log dentro de um componente de servidor o faria
   * disparar de novo a cada recomposição que o Next decidir fazer.
   */
  if (registros.length === 0) {
    const vazio = new Error(
      `trilha vazia: ocorrencia=${ocorrenciaId} organizacao=${escopo.ctx.vinculo.organizacaoId}`,
    );
    vazio.name = "TrilhaVazia";
    registrarFalha(vazio, `/ocorrencias/${ocorrenciaId}/auditoria`, "GET", novoTraceId());
  }

  const nomes = nomesDeStatus();

  return (
    <div className="flex flex-col gap-6">
      {/* **O caminho de três níveis** (item 66, critério 3): a trilha sobe para a ocorrência por aqui, e
          não por um *voltar* no conteúdo. O título do meio entra cortado em 40 caracteres, inteiro no
          `title`. */}
      <CaminhoDaPagina
        anterior={[
          { rotulo: "Ocorrências", href: "/ocorrencias" },
          {
            rotulo: encurtarParaOCaminho(lida.titulo),
            href: `/ocorrencias/${lida.id}`,
            titulo: lida.titulo,
          },
        ]}
        atual="Trilha de auditoria"
      />

      <CabecalhoDaPagina
        titulo="Trilha de auditoria"
        fato={
          <>
            <span className="block truncate">{lida.titulo}</span>
            <span className="mt-1.5 flex flex-wrap items-center gap-2">
              {/* **A situação vem do agregado, e não do último registro** (critério 44n.8). Os dois
                  coincidem sempre; ler daqui é o que continua verdadeiro no caminho em que a trilha
                  chega vazia — que é justamente o caminho que o log acima registra. */}
              <SeloDeStatus status={lida.status} rotulo={nomes[lida.status]} />
              <span>{fatoDaTrilha(registros.length)}</span>
            </span>
          </>
        }
      />

      {/* **O invólucro é o do `SemAcesso`, e não o `Cartao`:** o `Cartao` exige `tituloId` e se nomeia por
          `aria-labelledby`, e o critério 44n.8 diz que o cartão passa a ter **só a lista**, sem cabeça.
          Quem se nomeia aqui é o `<ol>`. */}
      <div className="border-linha bg-superficie rounded-lg border shadow-sm">
        {registros.length === 0 ? <TrilhaSemRegistros /> : <Trilha registros={registros} nomes={nomes} />}
      </div>
    </div>
  );
}

/**
 * A segunda linha do cabeçalho — quantos registros, em que ordem, e que nenhum se altera (critério 44n.8).
 *
 * **O singular tem forma própria**, e não é capricho: *"do mais antigo para o mais recente"* não diz nada
 * sobre um registro só. **Com um, a ordem vira origem** — é a premissa P1 do domínio dita em voz de tela.
 */
function fatoDaTrilha(quantos: number): string {
  return quantos === 1
    ? "Um registro, o primeiro. Nenhum se altera nem se apaga."
    : `${String(quantos)} registros, do mais antigo para o mais recente. Nenhum se altera nem se apaga.`;
}

/** O que a projeção devolve, por registro. **É o `RegistroDeTransicao` do contrato**, sem `sequencia`. */
type RegistroProjetado = ReturnType<typeof projetarTransicao>;

/**
 * ============================================================================
 *  O trilho — uma forma só, tela grande e celular (critério 44n.1)
 * ============================================================================
 *
 * **Eram duas**, e mantê-las custava dobrado: a tabela de quatro colunas com linha de continuação, e o
 * bloco empilhado do celular. A que sobrou é a do celular crescida — que é a que já carregava **o nome de
 * cada campo ao lado do valor**, que é o que o compromisso A-7 passa a exigir.
 *
 * **A régua é a da `ReguaDoCiclo`** (`regua-do-ciclo.tsx:103-105`): `absolute`, um pixel, `--line-soft`, e
 * **não desce do último** — um trilho que continua depois do fim sugere registro por vir, e numa trilha
 * não há. Ela é `aria-hidden` porque é o desenho da relação que a ordem do `<ol>` já publica.
 *
 * **O `<ol>` tem nome**, e não é enfeite: a casca põe barra lateral e barra superior em toda tela
 * autenticada, e um `getByRole("list")` sem nome casaria com elas primeiro. É por este nome que o teste de
 * ponta a ponta alcança a trilha sem escopar por classe de CSS.
 *
 * **A numeração do registro saiu.** Ela era do recorte de celular, e o marcador ocupa aquele lugar:
 * numerar e marcar no mesmo ponto são dois sinais para a mesma coisa.
 */
function Trilha({
  registros,
  nomes,
}: {
  registros: readonly RegistroProjetado[];
  nomes: Record<string, string>;
}) {
  return (
    <ol aria-label="Registros da trilha" className="flex flex-col px-[15px] py-4 md:px-[18px] md:py-5">
      {registros.map((registro, indice) => (
        <li key={`${registro.ocorreuEm}-${String(indice)}`} className="relative flex gap-3 pb-5 last:pb-0">
          {indice < registros.length - 1 && (
            <span aria-hidden="true" className="bg-linha-suave absolute top-7 bottom-0 left-[12px] w-px" />
          )}

          <MarcadorDoStatus status={registro.statusNovo} />

          <div className="flex min-w-0 flex-col gap-1 pt-0.5">
            <Campo nome="novo status">
              <SeloDeStatus status={registro.statusNovo} rotulo={nomes[registro.statusNovo] ?? registro.statusNovo} />
            </Campo>
            <Campo nome="status anterior">
              {/* **A premissa P1, dita por extenso** (critério 44n.4). O travessão saiu: quem lê uma prova
                  precisa saber se o campo está vazio ou se a tela o escondeu. */}
              {registro.statusAnterior === null
                ? "primeiro registro, sem status anterior"
                : (nomes[registro.statusAnterior] ?? registro.statusAnterior)}
            </Campo>
            <Campo nome="data e hora">
              {/* Mono porque é dado temporal — o papel que o guia §3 dá à monoespaçada. */}
              <span className="font-mono tabular-nums">{dataHoraComSegundos(registro.ocorreuEm)}</span>
            </Campo>
            <Campo nome="autor">{registro.autor.nome}</Campo>
            {registro.motivoPausa !== null && (
              <Campo nome="motivo da pausa">{nomeDoMotivoPausa(registro.motivoPausa)}</Campo>
            )}
            {registro.motivoCancelamento !== null && (
              <Campo nome="motivo do cancelamento">
                {nomeDoMotivoCancelamento(registro.motivoCancelamento)}
              </Campo>
            )}
            <Campo nome="observação">
              <span className="whitespace-pre-line">{registro.observacao ?? "sem observação"}</span>
            </Campo>
          </div>
        </li>
      ))}
    </ol>
  );
}

/**
 * Uma linha `nome: valor` de um registro.
 *
 * **O nome do campo SEMPRE aparece** — é o compromisso A-7 na forma nova, e é o que faz esta tela valer
 * como prova: *"prova sem rótulo de campo é afirmação"*. Em minúscula, porque são rótulos dentro de um
 * registro e não títulos de coluna.
 */
function Campo({ nome, children }: { nome: string; children: React.ReactNode }) {
  return (
    <span className="text-tinta-suave text-meta flex flex-wrap items-baseline gap-x-1.5">
      {nome}: <span className="text-tinta font-medium">{children}</span>
    </span>
  );
}

/**
 * **A trilha sem registros — e ela deixou de ser um sermão** (critério 44n.9).
 *
 * O que estava aqui explicava a invariante 2 da ADR-0001, avisava que recarregar não adiantava e despejava
 * dois identificadores para a pessoa levar a alguém. As quatro regras de texto do guia §7, escritas em
 * 20/09/2026 por causa desta tela: diga o que é e não por que é · nada ilegível para quem lê · não anuncie
 * defeito a quem não pode consertar · se não há saída, não encha.
 *
 * **O diagnóstico não se perdeu, mudou de lugar:** ele é uma linha no log do servidor, escrita acima.
 *
 * **Sem ação**, e é a quarta regra: não há saída a oferecer. É o molde do `SemAcesso` (item 44h) sem o
 * `EmptyContent`.
 */
function TrilhaSemRegistros() {
  return (
    <Empty className="px-6 py-14 md:px-6 md:py-14">
      <EmptyHeader>
        <EmptyMedia
          variant="icon"
          className="border-linha bg-background text-tinta-suave mb-3 size-13 rounded-lg border"
        >
          <History aria-hidden="true" className="size-5.5" />
        </EmptyMedia>
        <EmptyTitle className="text-titulo-bloco text-tinta">
          Nenhuma alteração registrada
        </EmptyTitle>
        <EmptyDescription className="text-corpo text-tinta-suave">
          Quando o status desta ocorrência mudar, a mudança aparece aqui.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
